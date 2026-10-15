import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, chooseSector, sectorOfPoint, cellOf, cellIndex, CELL, VOID, FENCE } from '../src/world/grid.js';
import { LINE_FLAGS } from '../src/wad/map.js';
import { loadTestMap, room, player, sector } from './helpers/levelHelper.js';

const cellsOf = (grid, s) => grid.sector.reduce((n, v) => n + (v === s ? 1 : 0), 0);

describe('chooseSector', () => {
  const isDoor = (s) => s === 7;

  test('the most samples win', () => {
    assert.equal(chooseSector(new Map([[VOID, 4], [0, 12]]), isDoor), 0);
    assert.equal(chooseSector(new Map([[7, 3], [VOID, 13]]), isDoor), VOID);
  });

  test('ties: doors beat void beat floor', () => {
    assert.equal(chooseSector(new Map([[0, 8], [7, 8]]), isDoor), 7);
    assert.equal(chooseSector(new Map([[VOID, 8], [7, 8]]), isDoor), 7);
    assert.equal(chooseSector(new Map([[0, 8], [VOID, 8]]), isDoor), VOID);
    assert.equal(chooseSector(new Map([[VOID, 8], [0, 8]]), isDoor), VOID);
  });

  test('empty counts give VOID', () => {
    assert.equal(chooseSector(new Map(), isDoor), VOID);
  });
});

describe('buildGrid on two rooms', () => {
  const { map } = loadTestMap({
    sectors: [sector(), sector({ floor: 16 })],
    rects: [room(0, 0, 0, 128, 128), room(1, 128, 0, 256, 128)],
    things: [player(64, 64)],
  });
  const grid = buildGrid(map);

  test('origin and size include a margin', () => {
    assert.equal(grid.cell, CELL);
    assert.equal(grid.originX, -48);
    assert.equal(grid.originY, -48);
    assert.equal(grid.width, Math.ceil((256 + 48) / CELL) + 3);
    assert.equal(grid.height, Math.ceil((128 + 48) / CELL) + 3);
    assert.equal(grid.sector.length, grid.width * grid.height);
  });

  test('cells take their sector; outside is VOID', () => {
    assert.equal(sectorOfPoint(grid, 64, 64), 0);
    assert.equal(sectorOfPoint(grid, 200, 100), 1);
    assert.equal(sectorOfPoint(grid, -10, 64), VOID);
    assert.equal(sectorOfPoint(grid, 64, 140), VOID);
    assert.equal(sectorOfPoint(grid, -1000, -1000), VOID);
    assert.equal(cellsOf(grid, 0), 64);
    assert.equal(cellsOf(grid, 1), 64);
  });

  test('cellOf/cellIndex', () => {
    assert.equal(cellOf(grid, -48, -48), 0);
    assert.equal(cellOf(grid, -49, 0), -1);
    assert.equal(cellIndex(grid, grid.width, 0), -1);
    assert.equal(cellIndex(grid, 1, 1), grid.width + 1);
  });

  test('no fences without blocking two-sided lines', () => {
    assert.ok(grid.fence.every((f) => f === FENCE.NONE));
  });
});

describe('thin features', () => {
  // Room A ends at x=136, the 8 unit strip 136..144 is `middle`, room B starts at 144.
  const layout = (middle, extraSectors = []) => loadTestMap({
    sectors: [sector(), sector(), ...extraSectors],
    rects: [room(0, 0, 0, 136, 128), room(1, 144, 0, 272, 128), ...middle],
    things: [player(64, 64)],
  }).map;

  test('a thin door sector keeps its cells', () => {
    const map = layout([room(2, 136, 32, 144, 96)], [sector({ ceiling: 0 })]);
    const asDoor = buildGrid(map, new Set([2]));
    assert.equal(sectorOfPoint(asDoor, 140, 64), 2);
    // The cell column is shared 8/8 with room A; door priority wins the tie on every row.
    for (let y = 40; y < 96; y += 16) assert.equal(sectorOfPoint(asDoor, 130, y), 2);
  });

  test('a thin wall stays solid', () => {
    const grid = buildGrid(layout([]));
    assert.equal(sectorOfPoint(grid, 140, 64), VOID);
  });

  test('a sector thinner than a quarter cell is rescued', () => {
    const { map } = loadTestMap({
      sectors: [sector(), sector({ floor: 8 }), sector()],
      rects: [room(0, 0, 0, 132, 128), room(1, 132, 0, 136, 128), room(2, 136, 0, 272, 128)],
      things: [player(64, 64)],
    });
    const grid = buildGrid(map);
    assert.ok(cellsOf(grid, 1) > 0, 'thin sector owns at least one cell');
    assert.equal(sectorOfPoint(grid, 136, 64), 1);
  });
});

describe('fences', () => {
  const build = (flags) => {
    const { map } = loadTestMap({
      sectors: [sector(), sector()],
      rects: [room(0, 0, 0, 128, 128), room(1, 128, 0, 256, 128)],
      lines: [{ front: 0, back: 1, flags }],
      things: [player(64, 64)],
    });
    return buildGrid(map);
  };
  const fenceAt = (grid, x, y) => grid.fence[cellOf(grid, x, y)];

  test('blocking two-sided lines fence every cell they cross', () => {
    const grid = build(LINE_FLAGS.BLOCKING);
    for (let y = 8; y < 128; y += 16) assert.equal(fenceAt(grid, 128, y), FENCE.ALL, `y=${y}`);
    assert.equal(fenceAt(grid, 64, 64), FENCE.NONE);
  });

  test('monster-blocking lines make monster fences', () => {
    const grid = build(LINE_FLAGS.BLOCK_MONSTERS);
    assert.equal(fenceAt(grid, 128, 64), FENCE.MONSTERS);
  });

  test('one-sided walls are not fences', () => {
    const grid = build(LINE_FLAGS.BLOCKING);
    assert.equal(fenceAt(grid, 0, 64), FENCE.NONE);
  });
});
