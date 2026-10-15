import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, run, runUntil, pressUse, mobjsOfKind, room, player, sector } from './helpers/levelHelper.js';
import { inSequence } from '../src/game/sim/mobj.js';
import { spawnMissile } from '../src/game/sim/missiles.js';
import { newPlayerState } from '../src/game/sim/player.js';

// Maps sit away from the origin so blockmap bucket collisions near (0,0) do not double-count hits.
const O = 1024;
const hall = (things, length = 768) => ({ sectors: [sector()], rects: [room(0, O, O, O + length, O + 256)], things });
const ZOMBIEMAN = 3004, IMP = 3001, BARREL = 2035;

const firstOfKind = (level, kind) => level.mobjs.find((m) => m.kind === kind);

describe('barrels', () => {
  test('a barrel shot by the player explodes and sets off a barrel nearby', () => {
    const level = makeLevel(hall([player(O + 40, O + 128, 0), { x: O + 232, y: O + 128, type: BARREL }, { x: O + 232, y: O + 200, type: BARREL }], 512));
    const [shot, nearby] = level.mobjs.filter((m) => m.kind === 'barrel');
    const tics = runUntil(level, 200, () => shot.health <= 0, (lv) => { lv.player.input.fire = true; });
    assert.ok(tics > 0, 'barrel destroyed by gunfire');
    level.player.input.fire = false;
    run(level, 60);
    assert.ok(shot.removed, 'exploded and vanished');
    assert.ok(nearby.health <= 0 && nearby.removed, 'chain reaction');
    assert.equal(level.player.health, 100, 'player was out of blast range');
  });

  test('an exploding barrel plays DSBAREXP', () => {
    const level = makeLevel(hall([player(O + 40, O + 128, 0), { x: O + 232, y: O + 128, type: BARREL }], 512));
    level.damage(firstOfKind(level, 'barrel'), null, null, 100);
    run(level, 30);
    assert.ok(level.events.some((e) => e.type === 'sound' && e.name === 'DSBAREXP'));
  });

  test('a barrel blast hurts a player standing close to it', () => {
    const level = makeLevel(hall([player(O + 150, O + 128, 0), { x: O + 232, y: O + 128, type: BARREL }], 512));
    const barrel = firstOfKind(level, 'barrel');
    level.damage(barrel, null, null, 100);
    run(level, 30);
    assert.ok(level.player.health < 100 && level.player.health > 0, `health ${level.player.health}`);
  });
});

describe('monsters', () => {
  test('a zombieman facing away sleeps until the player fires, then hunts and shoots', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 180), { x: O + 600, y: O + 128, type: ZOMBIEMAN, angle: 0 }]));
    const zombie = firstOfKind(level, 'monster');
    run(level, 50);
    assert.ok(inSequence(zombie, 'spawn'), 'still asleep');
    assert.equal(zombie.target, null);

    level.player.input.fire = true; // aiming west, away from the zombie
    run(level, 2);
    level.player.input.fire = false;
    run(level, 30);
    assert.equal(zombie.target, level.playerMobj, 'heard the shot');
    assert.ok(!inSequence(zombie, 'spawn'));

    let shots = 0;
    const startX = zombie.x;
    run(level, 400, (lv) => {
      shots += lv.events.filter((e) => e.name === 'DSPISTOL' && e.source === zombie.id).length;
      lv.events.length = 0;
    });
    assert.ok(zombie.x < startX - 64, `moved toward the player (${startX} -> ${zombie.x})`);
    assert.ok(shots > 0, 'fired at the player');
  });

  test('an imp that sees the player throws fireballs that hurt', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0), { x: O + 500, y: O + 128, type: IMP, angle: 180 }]));
    let fireballs = 0;
    run(level, 400, (lv) => { fireballs += mobjsOfKind(lv, 'missile').filter((m) => m.sprite === 'BAL1' && m.prevX === m.x).length; });
    assert.ok(fireballs > 0, 'launched a fireball');
    assert.ok(level.player.health < 100);
  });

  test('killing a zombieman counts the kill and drops a clip', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0), { x: O + 300, y: O + 128, type: ZOMBIEMAN, angle: 0 }]));
    const zombie = firstOfKind(level, 'monster');
    assert.equal(level.stats.totalKills, 1);
    const tics = runUntil(level, 300, () => zombie.health <= 0, (lv) => { lv.player.input.fire = true; });
    assert.ok(tics > 0, 'zombie killed');
    assert.equal(level.stats.kills, 1);
    assert.ok(zombie.corpse && !zombie.solid && !zombie.shootable);
    const drop = mobjsOfKind(level, 'pickup').find((m) => m.dropped);
    assert.ok(drop, 'dropped a clip');
    assert.equal(drop.def.sprite, 'CLIP');
  });
});

describe('missiles', () => {
  test('an imp fireball hits the player for 3-24 and explodes', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]));
    const shooter = { x: O + 400, y: O + 128, z: 0, height: 56, radius: 20 };
    const ball = spawnMissile(level, shooter, level.playerMobj, 'impBall');
    assert.ok(ball.missile && ball.momX < 0);
    const tics = runUntil(level, 100, () => ball.removed);
    assert.ok(tics > 0);
    const damage = 100 - level.player.health;
    assert.ok(damage >= 3 && damage <= 24, `damage ${damage}`);
    assert.ok(level.events.some((e) => e.type === 'sound' && e.name === 'DSFIRXPL'));
    assert.ok(level.events.some((e) => e.type === 'playerHurt'));
  });

  test('a fireball into a wall explodes harmlessly', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]));
    const shooter = { x: O + 400, y: O + 128, z: 0, height: 56, radius: 20 };
    const ball = spawnMissile(level, shooter, { x: O + 400, y: O + 1000, z: 0, height: 56 }, 'impBall');
    runUntil(level, 100, () => ball.removed);
    assert.ok(ball.removed);
    assert.equal(level.player.health, 100);
  });

  test('the player\'s rocket launcher fires a rocket that splashes', () => {
    const carried = { ...newPlayerState(), weapons: new Set(['fist', 'pistol', 'rocketLauncher']), weapon: 'rocketLauncher' };
    carried.ammo = { ...carried.ammo, rockets: 5 };
    const level = makeLevel(hall([player(O + 64, O + 128, 0), { x: O + 400, y: O + 128, type: ZOMBIEMAN, angle: 180 }]), { carried });
    const zombie = firstOfKind(level, 'monster');
    level.player.input.fire = true;
    run(level, 2);
    level.player.input.fire = false;
    assert.equal(level.player.ammo.rockets, 4);
    runUntil(level, 60, () => mobjsOfKind(level, 'missile').some((m) => m.sprite === 'MISL'));
    run(level, 40);
    assert.ok(zombie.health <= 0, 'rocket killed the zombieman');
  });
});

describe('player death', () => {
  test('lethal damage kills the player; use after a second restarts', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]));
    level.damage(level.playerMobj, null, null, 1000);
    assert.ok(level.player.dead);
    assert.equal(level.player.health, 0);
    assert.ok(level.events.some((e) => e.type === 'playerDied'));

    level.player.input.moveX = 1;
    run(level, 10);
    assert.equal(level.playerMobj.x, O + 64, 'the dead do not walk');
    level.player.input.moveX = 0;

    pressUse(level);
    assert.equal(level.restart, false, 'too soon');
    run(level, 30);
    pressUse(level);
    assert.equal(level.restart, true);
  });

  test('weapons stop working when dead', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]));
    level.damage(level.playerMobj, null, null, 1000);
    const bullets = level.player.ammo.bullets;
    level.player.input.fire = true;
    run(level, 10);
    assert.equal(level.player.ammo.bullets, bullets);
  });
});

describe('weapons', () => {
  test('the pistol uses one bullet per shot at its refire rate', () => {
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]));
    run(level, 35 * 2, (lv) => { lv.player.input.fire = true; });
    const used = 50 - level.player.ammo.bullets;
    assert.ok(used >= 3 && used <= 4, `used ${used}`);
  });

  test('running dry switches to the best remaining weapon', () => {
    const carried = { ...newPlayerState(), ammo: { bullets: 0, shells: 0, rockets: 0, cells: 0 } };
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]), { carried });
    run(level, 20, (lv) => { lv.player.input.fire = true; });
    assert.equal(level.player.weapon, 'fist');
  });

  test('number keys switch weapons after the switch delay', () => {
    const carried = { ...newPlayerState(), weapons: new Set(['fist', 'pistol', 'shotgun']), ammo: { bullets: 50, shells: 10, rockets: 0, cells: 0 } };
    const level = makeLevel(hall([player(O + 64, O + 128, 0)]), { carried });
    level.player.input.weaponSlot = 3;
    run(level, 12);
    assert.equal(level.player.weapon, 'shotgun');
    level.player.input.weaponCycle = -1;
    run(level, 12);
    assert.equal(level.player.weapon, 'pistol');
  });
});
