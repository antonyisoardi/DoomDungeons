import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, run, room, player, sector } from './helpers/levelHelper.js';
import { PLAYER_RADIUS } from '../src/game/constants.js';

// Room 0 (floor 0) | room 1, a 24 unit step | room 2, a further 40 unit ledge.
const STEPS = {
  sectors: [sector({ ceiling: 200 }), sector({ floor: 24, ceiling: 200 }), sector({ floor: 64, ceiling: 200 })],
  rects: [room(0, 0, 0, 256, 256), room(1, 256, 0, 384, 256), room(2, 384, 0, 512, 256)],
  things: [player(64, 128)],
};

const walk = (moveX, moveY) => (level) => { level.player.input.moveX = moveX; level.player.input.moveY = moveY; };

describe('player movement', () => {
  test('spawns on the floor at the start spot', () => {
    const level = makeLevel(STEPS);
    const p = level.playerMobj;
    assert.deepEqual([p.x, p.y, p.z], [64, 128, 0]);
    assert.equal(level.sectorOf(p), 0);
  });

  test('thrust accelerates the player and friction stops them', () => {
    const level = makeLevel(STEPS);
    const p = level.playerMobj;
    run(level, 8, walk(1, 0));
    const moved = p.x - 64;
    assert.ok(moved > 40, `moved ${moved}`);
    run(level, 60, walk(0, 0));
    assert.equal(p.momX, 0);
    assert.equal(p.y, 128);
  });

  test('walls (void cells) block movement', () => {
    const level = makeLevel(STEPS);
    const p = level.playerMobj;
    run(level, 60, walk(-1, 0));
    assert.ok(p.x >= PLAYER_RADIUS && p.x < PLAYER_RADIUS + 8, `x=${p.x}`);
    run(level, 60, walk(0, -1));
    assert.ok(p.y >= PLAYER_RADIUS && p.y < PLAYER_RADIUS + 8, `y=${p.y}`);
  });

  test('steps up to 24 units are climbed; higher ledges block', () => {
    const level = makeLevel(STEPS);
    const p = level.playerMobj;
    run(level, 120, walk(1, 0));
    assert.equal(p.z, 24, 'stood on the step');
    assert.equal(level.sectorOf(p), 1);
    assert.ok(p.x <= 384 - PLAYER_RADIUS && p.x > 384 - PLAYER_RADIUS - 16, `stopped at the ledge, x=${p.x}`);
  });

  test('sliding along a wall keeps the free axis moving', () => {
    const level = makeLevel(STEPS);
    const p = level.playerMobj;
    run(level, 40, walk(0, -1)); // to the south wall
    const y = p.y;
    run(level, 10, walk(0.5, -1)); // push diagonally into it
    assert.ok(p.x > 64 + 20, `slid east, x=${p.x}`);
    assert.ok(Math.abs(p.y - y) < 1);
  });

  test('solid things block the player', () => {
    const level = makeLevel({ ...STEPS, things: [player(64, 128), { x: 160, y: 128, type: 2035 }] });
    const p = level.playerMobj;
    run(level, 60, walk(1, 0));
    assert.ok(p.x <= 160 - 10 - PLAYER_RADIUS, `stopped by barrel, x=${p.x}`);
  });
});
