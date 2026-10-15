// Integration tests against the real shareware WAD. Skipped when wads/DOOM1.WAD is absent (e.g. CI).

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWad } from '../src/wad/wad.js';
import { createResources } from '../src/app/resources.js';
import { buildLevelData } from '../src/app/levelData.js';
import { createLevel } from '../src/game/sim/level.js';
import { newPlayerState } from '../src/game/sim/player.js';
import { pointOnLineSide } from '../src/game/sim/specials/lines.js';
import { SKILL } from '../src/game/constants.js';
import { decodePicture } from '../src/wad/graphics.js';
import { parseMus } from '../src/audio/mus.js';
import { decodeDmx } from '../src/audio/sfx.js';
import { PASSABLE_GAP } from '../src/world/style.js';

const WAD_PATH = fileURLToPath(new URL('../wads/DOOM1.WAD', import.meta.url));
const HAVE_WAD = existsSync(WAD_PATH);
const MAPS = Array.from({ length: 9 }, (_, i) => `E1M${i + 1}`);
const TICS = 2000;

function loadResources() {
  const file = readFileSync(WAD_PATH);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return createResources(parseWad(buffer));
}

// Small deterministic PRNG for test input.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function armedPlayer() {
  const p = newPlayerState();
  p.weapons = new Set(['fist', 'chainsaw', 'pistol', 'shotgun', 'chaingun', 'rocketLauncher', 'plasmaRifle', 'bfg']);
  p.ammo = { bullets: 200, shells: 50, rockets: 50, cells: 300 };
  return p;
}

// Change input every few tics: wander, aim, fire, use and switch weapons.
function randomInput(level, rand) {
  const input = level.player.input;
  if (rand() < 0.1) {
    const a = rand() * Math.PI * 2;
    input.moveX = rand() < 0.15 ? 0 : Math.cos(a);
    input.moveY = rand() < 0.15 ? 0 : Math.sin(a);
  }
  if (rand() < 0.1) input.aimAngle = rand() * Math.PI * 2;
  if (rand() < 0.05) input.fire = !input.fire;
  input.use = rand() < 0.05;
  input.walk = rand() < 0.1;
  if (rand() < 0.01) input.weaponSlot = 1 + Math.floor(rand() * 7);
  if (rand() < 0.01) input.weaponCycle = rand() < 0.5 ? -1 : 1;
}

describe('shareware DOOM1.WAD', { skip: !HAVE_WAD && 'wads/DOOM1.WAD not present' }, () => {
  let resources;
  const levelData = new Map();
  before(() => { resources = loadResources(); });

  test('contains E1M1..E1M9', () => {
    assert.deepEqual(resources.maps, MAPS);
    assert.equal(resources.wad.type, 'IWAD');
    assert.equal(resources.palette.length, 256);
    assert.ok(resources.flats.size > 50);
    assert.ok(resources.textures.has('STARTAN3'));
  });

  test('pictures, music and sounds decode', () => {
    const pic = decodePicture(resources.wad.bytes('TROOA1'));
    assert.ok(pic.width > 0 && pic.height > 0);
    const mus = parseMus(resources.wad.bytes('D_E1M1'));
    assert.ok(mus.events.length > 100 && mus.duration > 0);
    assert.equal(mus.events.at(-1).type, 'end');
    const sound = decodeDmx(resources.wad.bytes('DSPISTOL'));
    assert.equal(sound.rate, 11025);
    assert.ok(sound.samples.length > 1000);
  });

  for (const name of MAPS) {
    test(`${name}: builds grid, mesh, atlas and survives ${TICS} tics of random play`, () => {
      const data = buildLevelData(resources, name);
      levelData.set(name, data);
      assert.ok(data.map.linedefs.length > 0);
      assert.ok(data.grid.sector.some((s) => s >= 0));
      assert.ok(data.mesh.index.length > 0 && data.mesh.index.length % 6 === 0);
      for (const key of data.mesh.tileKeys) assert.ok(data.atlas.rects.has(key), `atlas has ${key}`);

      const level = createLevel({ levelData: data, textures: resources.textures, mapName: name, skill: SKILL.HARD, carried: armedPlayer(), seed: 99 });
      const rand = lcg(name.charCodeAt(3) * 7919);
      for (let t = 0; t < TICS; t++) {
        level.player.powers.invulnerability = 100; // keep playing the whole run
        randomInput(level, rand);
        level.tick();
        level.events.length = 0;
      }
      const p = level.playerMobj;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
      for (const s of level.sectors) assert.ok(Number.isFinite(s.floor) && Number.isFinite(s.ceiling));
      for (const m of level.mobjs) assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z), `mobj ${m.kind} position`);
    });
  }

  test('E1M1: using a door (special 1) from its front side raises its ceiling', () => {
    const data = levelData.get('E1M1') ?? buildLevelData(resources, 'E1M1');
    const level = createLevel({ levelData: data, textures: resources.textures, mapName: 'E1M1', skill: SKILL.MEDIUM, carried: newPlayerState(), seed: 5 });
    const { map } = level;
    const line = level.lines.find((l) => l.special === 1 && l.backSector >= 0 &&
      level.sectors[l.backSector].ceiling - level.sectors[l.backSector].floor < PASSABLE_GAP);
    assert.ok(line, 'E1M1 has a closed manual door');

    const a = map.vertices[line.v1], b = map.vertices[line.v2];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = (b.y - a.y) / len, ny = -(b.x - a.x) / len; // front (right-hand) normal
    const p = level.playerMobj;
    p.x = (a.x + b.x) / 2 + nx * 32;
    p.y = (a.y + b.y) / 2 + ny * 32;
    p.momX = p.momY = 0;
    level.blockmap.relink(p);
    assert.equal(pointOnLineSide(map, line, p.x, p.y), 0, 'player is on the front side');
    level.player.input.aimAngle = Math.atan2(-ny, -nx);

    const door = level.sectors[line.backSector];
    const before = door.ceiling;
    level.player.input.use = true;
    level.tick();
    level.player.input.use = false;
    for (let t = 0; t < 30; t++) level.tick();
    assert.ok(door.ceiling > before, `ceiling ${before} -> ${door.ceiling}`);
  });
});
