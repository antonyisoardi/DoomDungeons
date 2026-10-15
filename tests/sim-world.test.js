import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createBlockmap } from '../src/game/sim/blockmap.js';
import { createRng } from '../src/game/sim/rng.js';
import { boxPosition, traceCells, forEachCell } from '../src/game/sim/world.js';
import { buildGrid, VOID } from '../src/world/grid.js';
import { createLineIndex, distanceToSegment } from '../src/world/lineIndex.js';
import { lineSpecial, findDoorSectors } from '../src/game/specials/table.js';
import { loadTestMap, room, player, sector } from './helpers/levelHelper.js';

describe('rng', () => {
  test('is deterministic per seed and stays in 0..255', () => {
    const a = createRng(42), b = createRng(42), c = createRng(43);
    const seqA = Array.from({ length: 50 }, a.random);
    assert.deepEqual(seqA, Array.from({ length: 50 }, b.random));
    assert.notDeepEqual(seqA, Array.from({ length: 50 }, c.random));
    assert.ok(seqA.every((v) => v >= 0 && v <= 255 && Number.isInteger(v)));
  });

  test('range and spread', () => {
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.range(3, 5);
      assert.ok(v >= 3 && v <= 5);
      const s = r.spread();
      assert.ok(s >= -255 && s <= 255);
    }
  });

  test('a zero seed still produces numbers', () => {
    const r = createRng(0);
    assert.ok(Array.from({ length: 10 }, r.random).some((v) => v !== 0));
  });
});

describe('blockmap', () => {
  const thing = (x, y) => ({ x, y });
  const visits = (bm, box) => {
    const seen = [];
    bm.each(...box, (m) => { seen.push(m); return true; });
    return seen;
  };

  test('finds linked things near a box and forgets unlinked ones', () => {
    const bm = createBlockmap();
    const a = thing(1000, 1000), far = thing(5000, 5000);
    bm.link(a); bm.link(far);
    assert.deepEqual(visits(bm, [990, 990, 1010, 1010]), [a]);
    bm.unlink(a);
    assert.deepEqual(visits(bm, [990, 990, 1010, 1010]), []);
  });

  test('relink follows a moved thing', () => {
    const bm = createBlockmap();
    const a = thing(1000, 1000);
    bm.link(a);
    a.x = 3000;
    bm.relink(a);
    assert.deepEqual(visits(bm, [990, 990, 1010, 1010]), []);
    assert.deepEqual(visits(bm, [2990, 990, 3010, 1010]), [a]);
  });

  test('returning false stops the walk', () => {
    const bm = createBlockmap();
    bm.link(thing(1000, 1000)); bm.link(thing(1001, 1001));
    let n = 0;
    bm.each(900, 900, 1100, 1100, () => { n++; return false; });
    assert.equal(n, 1);
  });

  test('each visits a thing once even near the map origin', () => {
    const bm = createBlockmap();
    const a = thing(160, 160); // bucket (1,1)
    bm.link(a);
    assert.equal(visits(bm, [-100, -100, 200, 200]).length, 1);
  });
});

describe('grid queries', () => {
  const { map } = loadTestMap({
    sectors: [sector({ floor: 0, ceiling: 128 }), sector({ floor: 24, ceiling: 100 })],
    rects: [room(0, 0, 0, 128, 128), room(1, 128, 0, 256, 128)],
    things: [player(64, 64)],
  });
  const grid = buildGrid(map);
  const sectors = map.sectors;

  test('boxPosition reports the highest floor and lowest ceiling under the box', () => {
    const pos = boxPosition(grid, sectors, 128, 64, 16, 'player');
    assert.deepEqual([pos.floorz, pos.ceilingz, pos.dropoffz, pos.blocked, pos.sector], [24, 100, 0, false, 1]);
  });

  test('boxPosition is blocked by void cells', () => {
    assert.equal(boxPosition(grid, sectors, 8, 64, 16, 'player').blocked, true);
    assert.equal(boxPosition(grid, sectors, 64, 64, 16, 'player').blocked, false);
  });

  test('forEachCell visits every overlapped cell', () => {
    let n = 0;
    forEachCell(grid, 64, 64, 16, () => { n++; });
    assert.equal(n, 4);
  });

  test('traceCells walks cells in order and reports void', () => {
    const cells = [];
    traceCells(grid, 8, 8, 248, 8, (cell, t) => { cells.push([grid.sector[cell], t]); });
    assert.equal(cells.length, 16);
    assert.equal(cells[0][0], 0);
    assert.equal(cells.at(-1)[0], 1);
    for (let i = 1; i < cells.length; i++) assert.ok(cells[i][1] >= cells[i - 1][1]);
    const toVoid = [];
    traceCells(grid, 64, 64, 64, 200, (cell) => { toVoid.push(cell < 0 ? VOID : grid.sector[cell]); });
    assert.equal(toVoid.at(-1), VOID);
  });
});

describe('line index', () => {
  const { map } = loadTestMap({
    sectors: [sector(), sector()],
    rects: [room(0, 0, 0, 128, 128), room(1, 128, 0, 256, 128)],
    lines: [{ front: 0, back: 1, special: 52 }],
    things: [player(64, 64)],
  });
  const index = createLineIndex(map);

  test('distanceToSegment', () => {
    assert.equal(distanceToSegment(5, 5, 0, 0, 10, 0), 5);
    assert.equal(distanceToSegment(-3, 4, 0, 0, 10, 0), 5);
    assert.equal(distanceToSegment(1, 1, 0, 0, 0, 0), Math.SQRT2);
  });

  test('near returns each line once and nearest honours the filter', () => {
    const near = index.near(128, 64, 40);
    assert.equal(new Set(near.map((l) => l.index)).size, near.length);
    const special = index.nearest(120, 64, 32, (l) => l.special === 52);
    assert.equal(special.special, 52);
    assert.equal(index.nearest(64, 64, 8), null);
  });
});

describe('special table', () => {
  test('lineSpecial looks up vanilla specials', () => {
    assert.deepEqual(
      (({ trigger, repeat, kind, type, key }) => ({ trigger, repeat, kind, type, key }))(lineSpecial(26)),
      { trigger: 'D', repeat: true, kind: 'door', type: 'normal', key: 'blue' },
    );
    assert.equal(lineSpecial(88).kind, 'plat');
    assert.equal(lineSpecial(9999), null);
  });

  test('findDoorSectors: manual door backs, tagged door targets, closed sectors and door sector specials', () => {
    const { map } = loadTestMap({
      sectors: [sector(), sector({ ceiling: 64 }), sector({ tag: 4 }), sector({ ceiling: 0 }), sector({ special: 10 })],
      rects: [room(0, 0, 0, 128, 128), room(1, 128, 0, 144, 128), room(2, 144, 0, 272, 128), room(3, 0, 128, 64, 144), room(4, 64, 128, 128, 144)],
      lines: [{ front: 0, back: 1, special: 1 }, { front: 1, back: 2, special: 2, tag: 4 }],
      things: [player(64, 64)],
    });
    assert.deepEqual([...findDoorSectors(map)].sort(), [1, 2, 3, 4]);
  });
});
