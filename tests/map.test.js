import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseWad } from '../src/wad/wad.js';
import { loadMap, pointInSector, sectorAt, sectorBoundaries, subsectorAt, LINE_FLAGS } from '../src/wad/map.js';
import { buildWad, marker, encodeMapLumps, buildRectMap } from './helpers/wadBuilder.js';
import { room, player, sector } from './helpers/levelHelper.js';

function loadRaw(raw, name = 'E1M1') {
  return loadMap(parseWad(buildWad([marker(name), ...encodeMapLumps(raw)])), name);
}

describe('loadMap field parsing', () => {
  const raw = {
    vertices: [{ x: -10, y: 20 }, { x: 300, y: -400 }],
    sectors: [
      { floor: -16, ceiling: 72, floorFlat: 'nukage1', ceilingFlat: 'F_SKY1', light: 200, special: 7, tag: 3 },
      { floor: 0, ceiling: 0 },
    ],
    sidedefs: [
      { xOffset: -4, yOffset: 8, upper: 'UP', lower: 'LOW', middle: 'MID', sector: 0 },
      { sector: 1 },
    ],
    linedefs: [
      { v1: 0, v2: 1, flags: LINE_FLAGS.TWO_SIDED | LINE_FLAGS.SECRET, special: 26, tag: 0xfffe, front: 0, back: 1 },
      { v1: 1, v2: 0, flags: LINE_FLAGS.BLOCKING, special: 0, tag: 0, front: 0, back: -1 },
    ],
    things: [{ x: -5, y: 6, angle: 270, type: 3004, flags: 12 }],
  };
  const map = loadRaw(raw);

  test('vertices are signed', () => {
    assert.deepEqual(map.vertices, [{ x: -10, y: 20 }, { x: 300, y: -400 }]);
  });

  test('sectors', () => {
    assert.deepEqual(map.sectors[0], {
      index: 0, floor: -16, ceiling: 72, floorFlat: 'NUKAGE1', ceilingFlat: 'F_SKY1', light: 200, special: 7, tag: 3,
    });
    assert.equal(map.sectors[1].index, 1);
  });

  test('sidedefs', () => {
    assert.deepEqual(map.sidedefs[0], { xOffset: -4, yOffset: 8, upper: 'UP', lower: 'LOW', middle: 'MID', sector: 0 });
    assert.equal(map.sidedefs[1].middle, '-');
  });

  test('linedefs resolve sectors and map 0xFFFF sidedefs to -1', () => {
    const [two, one] = map.linedefs;
    assert.equal(two.special, 26);
    assert.equal(two.tag, 0xfffe);
    assert.equal(two.flags, LINE_FLAGS.TWO_SIDED | LINE_FLAGS.SECRET);
    assert.equal(two.frontSector, 0);
    assert.equal(two.backSector, 1);
    assert.equal(one.back, -1);
    assert.equal(one.backSector, -1);
    assert.equal(one.index, 1);
  });

  test('things', () => {
    assert.deepEqual(map.things, [{ index: 0, x: -5, y: 6, angle: 270, type: 3004, flags: 12 }]);
  });

  test('empty BSP lumps parse as empty arrays', () => {
    assert.deepEqual([map.segs, map.subsectors, map.nodes], [[], [], []]);
  });

  test('throws for a missing map', () => {
    assert.throws(() => loadMap(parseWad(buildWad([marker('X')])), 'E1M1'), /not found/);
  });
});

describe('sector geometry without a BSP', () => {
  // A 256x256 room with a 64x64 pillar sector inside it (hole in the outer sector).
  const raw = buildRectMap({
    sectors: [sector(), sector({ floor: 32 })],
    rects: [
      room(0, 0, 0, 256, 96), room(0, 0, 160, 256, 256), room(0, 0, 96, 96, 160), room(0, 160, 96, 256, 160),
      room(1, 96, 96, 160, 160),
    ],
    things: [player(32, 32)],
  });
  const map = loadRaw(raw);
  const bounds = sectorBoundaries(map);

  test('sectorBoundaries skips lines with the same sector on both sides', () => {
    for (const lines of bounds) for (const l of lines) assert.notEqual(l.frontSector, l.backSector);
    assert.equal(bounds[1].length, 4);
  });

  test('pointInSector uses even-odd over boundary lines', () => {
    assert.ok(pointInSector(map, bounds[1], 128, 128));
    assert.ok(!pointInSector(map, bounds[1], 32, 32));
    assert.ok(pointInSector(map, bounds[0], 32, 32));
    assert.ok(!pointInSector(map, bounds[0], 128, 128)); // inside the hole
    assert.ok(!pointInSector(map, bounds[0], -5, 128));
  });

  test('sectorAt finds the sector or -1 for the void', () => {
    assert.equal(sectorAt(map, bounds, 128, 128), 1);
    assert.equal(sectorAt(map, bounds, 20, 200), 0);
    assert.equal(sectorAt(map, bounds, 300, 128), -1);
  });
});

describe('sectorAt with a BSP', () => {
  const raw = buildRectMap({
    sectors: [sector(), sector({ floor: 8 })],
    rects: [room(0, 0, 0, 128, 256), room(1, 128, 0, 256, 256)],
    things: [player(32, 32)],
  });
  const lineFacing = (s) => raw.linedefs.findIndex((l) => raw.sidedefs[l.front].sector === s && l.back < 0);
  const segs = new Uint8Array(24);
  const sv = new DataView(segs.buffer);
  [lineFacing(0), lineFacing(1)].forEach((line, i) => sv.setUint16(i * 12 + 6, line, true));
  const ssectors = new Uint8Array(8);
  const ssv = new DataView(ssectors.buffer);
  ssv.setUint16(0, 1, true); ssv.setUint16(2, 0, true);
  ssv.setUint16(4, 1, true); ssv.setUint16(6, 1, true);
  const nodes = new Uint8Array(28);
  const nv = new DataView(nodes.buffer);
  nv.setInt16(0, 128, true); nv.setInt16(2, 0, true); nv.setInt16(4, 0, true); nv.setInt16(6, 256, true);
  nv.setUint16(24, 0x8001, true); // right (east) child: subsector 1
  nv.setUint16(26, 0x8000, true); // left (west) child: subsector 0
  const map = loadRaw({ ...raw, segs, ssectors, nodes });
  const bounds = sectorBoundaries(map);

  test('walks the BSP to a subsector', () => {
    assert.equal(subsectorAt(map, 64, 100), 0);
    assert.equal(subsectorAt(map, 200, 100), 1);
  });

  test('returns the subsector sector, or -1 when the point is outside it', () => {
    assert.equal(sectorAt(map, bounds, 64, 100), 0);
    assert.equal(sectorAt(map, bounds, 200, 100), 1);
    assert.equal(sectorAt(map, bounds, -40, 100), -1);
  });
});
