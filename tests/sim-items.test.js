import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, run, messages, room, player, sector } from './helpers/levelHelper.js';
import { THING_BY_DOOMEDNUM } from '../src/game/info/things.js';
import { SKILL } from '../src/game/constants.js';

const ROOM = { sectors: [sector()], rects: [room(0, 0, 0, 512, 256)], things: [player(64, 128)] };

// Drop an item on the player and let them touch it. Returns true if it was taken.
// Items left behind are removed so later touches only see fresh items.
function touch(level, doomednum) {
  const p = level.playerMobj;
  const item = level.spawnThing(THING_BY_DOOMEDNUM.get(doomednum), p.x, p.y);
  level.touchItems(p);
  const taken = item.removed;
  if (!taken) level.removeMobj(item);
  return taken;
}

const CLIP = 2007, STIMPACK = 2011, MEDIKIT = 2012, GREEN_ARMOR = 2018, BLUE_ARMOR = 2019;
const BLUE_KEY = 5, SHOTGUN = 2001, HEALTH_BONUS = 2014, SOULSPHERE = 2013, BACKPACK = 8, BERSERK = 2023;

describe('pickups', () => {
  test('clip gives 10 bullets, capped at the maximum', () => {
    const level = makeLevel(ROOM);
    const pl = level.player;
    assert.ok(touch(level, CLIP));
    assert.equal(pl.ammo.bullets, 60);
    pl.ammo.bullets = 195;
    assert.ok(touch(level, CLIP));
    assert.equal(pl.ammo.bullets, 200);
    assert.ok(!touch(level, CLIP), 'full: left on the floor');
  });

  test('ammo is doubled on the easiest skill', () => {
    const level = makeLevel(ROOM, { skill: SKILL.BABY });
    touch(level, CLIP);
    assert.equal(level.player.ammo.bullets, 70);
  });

  test('stimpack: +10, not taken at full health', () => {
    const level = makeLevel(ROOM);
    assert.ok(!touch(level, STIMPACK));
    level.player.health = level.playerMobj.health = 50;
    assert.ok(touch(level, STIMPACK));
    assert.equal(level.player.health, 60);
    assert.equal(level.playerMobj.health, 60);
  });

  test('medikit: +25 capped at 100, with the "really need" message when low', () => {
    const level = makeLevel(ROOM);
    level.player.health = level.playerMobj.health = 90;
    assert.ok(touch(level, MEDIKIT));
    assert.equal(level.player.health, 100);
    level.player.health = level.playerMobj.health = 20;
    touch(level, MEDIKIT);
    assert.equal(level.player.health, 45);
    assert.match(messages(level).at(-1).text, /REALLY need/);
  });

  test('health bonus goes past 100 up to 200', () => {
    const level = makeLevel(ROOM);
    assert.ok(touch(level, HEALTH_BONUS));
    assert.equal(level.player.health, 101);
    level.player.health = 200;
    assert.ok(touch(level, HEALTH_BONUS), 'always picked up');
    assert.equal(level.player.health, 200);
    assert.equal(level.stats.items, 2);
  });

  test('soulsphere +100 up to 200', () => {
    const level = makeLevel(ROOM);
    touch(level, SOULSPHERE);
    assert.equal(level.player.health, 200);
  });

  test('green armor: 100 at class 1; not taken when already at 100', () => {
    const level = makeLevel(ROOM);
    assert.ok(touch(level, GREEN_ARMOR));
    assert.equal(level.player.armor, 100);
    assert.equal(level.player.armorClass, 1);
    assert.ok(!touch(level, GREEN_ARMOR));
    assert.ok(touch(level, BLUE_ARMOR));
    assert.deepEqual([level.player.armor, level.player.armorClass], [200, 2]);
  });

  test('blue keycard', () => {
    const level = makeLevel(ROOM);
    assert.ok(touch(level, BLUE_KEY));
    assert.ok(level.player.keys.has('blue'));
    assert.ok(messages(level).some((m) => m.text === 'Picked up a blue keycard.'));
  });

  test('shotgun: weapon, 8 shells, switches to it', () => {
    const level = makeLevel(ROOM);
    const pl = level.player;
    assert.ok(touch(level, SHOTGUN));
    assert.ok(pl.weapons.has('shotgun'));
    assert.equal(pl.ammo.shells, 8);
    assert.equal(pl.pendingWeapon, 'shotgun');
    run(level, 12);
    assert.equal(pl.weapon, 'shotgun');
    assert.ok(touch(level, SHOTGUN), 'a second shotgun still gives ammo');
    assert.equal(pl.ammo.shells, 16);
    assert.ok(level.events.some((e) => e.type === 'sound' && e.name === 'DSWPNUP'));
  });

  test('dropped weapons give half ammo', () => {
    const level = makeLevel(ROOM);
    const p = level.playerMobj;
    const item = level.spawnThing(THING_BY_DOOMEDNUM.get(SHOTGUN), p.x, p.y, { dropped: true });
    level.touchItems(p);
    assert.ok(item.removed);
    assert.equal(level.player.ammo.shells, 4);
  });

  test('backpack doubles capacity once and gives a clip of each', () => {
    const level = makeLevel(ROOM);
    const pl = level.player;
    touch(level, BACKPACK);
    assert.deepEqual(pl.maxAmmo, { bullets: 400, shells: 100, rockets: 100, cells: 600 });
    assert.deepEqual(pl.ammo, { bullets: 60, shells: 4, rockets: 1, cells: 20 });
    touch(level, BACKPACK);
    assert.equal(pl.maxAmmo.bullets, 400);
  });

  test('berserk heals to 100 and switches to the fist', () => {
    const level = makeLevel(ROOM);
    level.player.health = 30;
    touch(level, BERSERK);
    assert.equal(level.player.health, 100);
    assert.ok(level.player.powers.berserk);
    assert.equal(level.player.pendingWeapon, 'fist');
  });

  // The player starts at (64,128) so the touch query spans blockmap buckets (-1,-1)..(2,2);
  // buckets (1,1) and (-1,-1) hash to the same key, so the clip is visited and given twice.
  test('walking over an item picks it up once', () => {
    const level = makeLevel({ ...ROOM, things: [player(64, 128), { x: 160, y: 128, type: CLIP }] });
    level.player.input.moveX = 1;
    run(level, 15);
    assert.equal(level.player.ammo.bullets, 60);
    assert.equal(level.mobjs.filter((m) => m.kind === 'pickup' && !m.removed).length, 0);
  });
});

describe('armor absorption', () => {
  const hit = (armor, armorClass, damage) => {
    const level = makeLevel(ROOM);
    Object.assign(level.player, { armor, armorClass });
    level.damage(level.playerMobj, null, null, damage);
    return { health: level.player.health, armor: level.player.armor, armorClass: level.player.armorClass, mobjHealth: level.playerMobj.health };
  };

  test('green armor absorbs a third', () => {
    assert.deepEqual(hit(100, 1, 30), { health: 80, armor: 90, armorClass: 1, mobjHealth: 80 });
  });

  test('blue armor absorbs a half', () => {
    assert.deepEqual(hit(200, 2, 30), { health: 85, armor: 185, armorClass: 2, mobjHealth: 85 });
  });

  test('armor that runs out absorbs what is left and is lost', () => {
    assert.deepEqual(hit(5, 1, 30), { health: 75, armor: 0, armorClass: 0, mobjHealth: 75 });
  });

  test('no armor takes full damage', () => {
    assert.equal(hit(0, 0, 30).health, 70);
  });

  test('half damage on the easiest skill', () => {
    const level = makeLevel(ROOM, { skill: SKILL.BABY });
    level.damage(level.playerMobj, null, null, 30);
    assert.equal(level.player.health, 85);
  });

  test('invulnerability blocks damage', () => {
    const level = makeLevel(ROOM);
    level.player.powers.invulnerability = 100;
    level.damage(level.playerMobj, null, null, 50);
    assert.equal(level.player.health, 100);
  });
});
