// A running level: live sector state, things, thinkers and the per-tic update.

import { createRng } from './rng.js';
import { createBlockmap } from './blockmap.js';
import { boxPosition, sectorIndexAt, forEachCell } from './world.js';
import { moveMode } from './movement.js';
import { checkSight } from './sight.js';
import { traceAttack } from './hitscan.js';
import { damageMobj } from './combat.js';
import { ACTIONS } from './actions.js';
import { createPlayer } from './player.js';
import { spawnMapThings, spawnThing, spawnEffect } from './spawn.js';
import { spawnSectorSpecials } from './specials/sectorSpecials.js';
import { doFloor } from './specials/floors.js';
import { doDoor } from './specials/doors.js';
import { crossLines, playerUse, bumpDoors, monsterUseDoors, shootLines, touchItems, noiseAlert } from './interactions.js';
import { thinkMobj } from './think.js';
import { createLineIndex } from '../../world/lineIndex.js';
import { CELL } from '../../world/grid.js';
import { SKILL } from '../constants.js';

function copySectors(map) {
  return map.sectors.map((s) => ({ ...s, baseLight: s.light, mover: null, soundTarget: null }));
}

function sectorBoxes(grid, count) {
  const boxes = Array.from({ length: count }, () => null);
  for (let cy = 0; cy < grid.height; cy++) {
    for (let cx = 0; cx < grid.width; cx++) {
      const s = grid.sector[cy * grid.width + cx];
      if (s < 0) continue;
      const x = grid.originX + cx * CELL, y = grid.originY + cy * CELL;
      const b = boxes[s] ?? (boxes[s] = { x0: x, y0: y, x1: x + CELL, y1: y + CELL });
      b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x + CELL); b.y1 = Math.max(b.y1, y + CELL);
    }
  }
  return boxes;
}

export function createLevel({ levelData, textures, mapName, skill, carried, seed }) {
  const { map, grid } = levelData;
  const lines = map.linedefs.map((l) => ({ ...l }));
  const liveMap = { ...map, linedefs: lines };
  const sectorLines = map.sectors.map(() => []);
  for (const line of lines) {
    if (line.frontSector >= 0) sectorLines[line.frontSector].push(line);
    if (line.backSector >= 0 && line.backSector !== line.frontSector) sectorLines[line.backSector].push(line);
  }

  const level = {
    mapName, skill, map: liveMap, grid, textures,
    sectors: copySectors(map),
    lines,
    sectorLines,
    sectorBoxes: sectorBoxes(grid, map.sectors.length),
    sideTextures: map.sidedefs.map((s) => ({ upper: s.upper, middle: s.middle, lower: s.lower })),
    lineIndex: createLineIndex(liveMap),
    rng: createRng(seed ?? (Date.now() & 0xffffff)),
    blockmap: createBlockmap(),
    mobjs: [],
    thinkers: [],
    scheduled: [],
    events: [],
    tic: 0,
    stats: { kills: 0, totalKills: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0 },
    exit: null,
    restart: false,
    fast: skill === SKILL.NIGHTMARE,
    playerMobj: null,

    addMobj(m) { this.mobjs.push(m); if (!m.noClip || m.kind === 'teleportDest') this.blockmap.link(m); },
    removeMobj(m) { m.removed = true; this.blockmap.unlink(m); },
    addThinker(t) { this.thinkers.push(t); },
    removeThinker(t) { t.removed = true; },
    emit(event) { this.events.push(event); },
    message(text, kind) { this.emit({ type: 'message', text, kind }); },
    schedule(tics, fn) { this.scheduled.push({ at: this.tic + tics, fn }); },
    runAction(name, mobj) {
      const action = ACTIONS[name];
      if (action) action(this, mobj);
    },

    position(m, x, y) { return boxPosition(grid, this.sectors, x, y, m.radius, moveMode(m)); },
    sectorOf(m) { return sectorIndexAt(grid, m.x, m.y); },
    forEachCellOf(m, fn) { return forEachCell(grid, m.x, m.y, Math.max(1, m.radius), fn); },
    checkSight(a, b) { return checkSight(this, a, b); },
    traceAttack(shooter, angle, range) { return traceAttack(this, shooter, angle, range); },
    damage(target, inflictor, source, amount) { damageMobj(this, target, inflictor, source, amount); },

    spawnThing(def, x, y, opts) { return spawnThing(this, def, x, y, opts); },
    spawnEffect(name, x, y, z) { return spawnEffect(this, name, x, y, z); },

    crossLines(m, x0, y0, x1, y1) { crossLines(this, m, x0, y0, x1, y1); },
    playerUse(m) { playerUse(this, m); },
    bumpDoors(m) { bumpDoors(this, m); },
    monsterUseDoors(actor, x, y) { return monsterUseDoors(this, actor, x, y); },
    shootLines(shooter, x0, y0, x1, y1) { shootLines(this, shooter, x0, y0, x1, y1); },
    touchItems(m) { touchItems(this, m); },
    noiseAlert(emitter) { noiseAlert(this, emitter); },

    emitSectorSound(s, name, fallback) {
      const b = this.sectorBoxes[s];
      if (!b) return;
      this.emit({ type: 'sound', name, fallback, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
    },
    emitLineSound(line, name) {
      const a = map.vertices[line.v1], b = map.vertices[line.v2];
      this.emit({ type: 'sound', name, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    },
    triggerTagged(kind, type, tag) {
      if (kind === 'floor') doFloor(this, null, tag, type);
      else if (kind === 'door') doDoor(this, tag, type);
    },
    exitLevel(type) { if (!this.exit) this.exit = type; },
    requestRestart() { this.restart = true; },

    tick() { tickLevel(this); },
  };

  const player = createPlayer(carried);
  level.playerMobj = spawnMapThings(level, map.things, player);
  level.player = player;
  spawnSectorSpecials(level);
  return level;
}

function tickLevel(level) {
  for (const m of level.mobjs) {
    m.prevX = m.x; m.prevY = m.y; m.prevZ = m.z;
  }
  // Index loop: things spawned this tic (missiles, puffs) also think, like Doom's thinker list.
  for (let i = 0; i < level.mobjs.length; i++) {
    const m = level.mobjs[i];
    if (!m.removed) thinkMobj(level, m);
  }
  for (let i = 0; i < level.thinkers.length; i++) {
    const t = level.thinkers[i];
    if (!t.removed) t.think();
  }
  if (level.scheduled.length) {
    const due = level.scheduled.filter((s) => s.at <= level.tic);
    level.scheduled = level.scheduled.filter((s) => s.at > level.tic);
    for (const s of due) s.fn();
  }
  if (level.tic % 35 === 0) {
    level.mobjs = level.mobjs.filter((m) => !m.removed);
    level.thinkers = level.thinkers.filter((t) => !t.removed);
  }
  level.tic++;
}
