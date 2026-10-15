import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid } from '../src/world/grid.js';
import { buildWorldMesh, UV_MODE, STATIC } from '../src/world/meshBuilder.js';
import { KIND, displayTop, lightToBrightness, DOOR_HEIGHT, PASSABLE_GAP } from '../src/world/style.js';
import { findDoorSectors } from '../src/game/specials/table.js';
import { loadTestMap, room, player, sector } from './helpers/levelHelper.js';

describe('displayTop', () => {
  test('closed doors stand DOOR_HEIGHT above the floor', () => {
    assert.equal(displayTop(0, 0), DOOR_HEIGHT);
    assert.equal(displayTop(16, 16), 16 + DOOR_HEIGHT);
    assert.equal(displayTop(0, -8), DOOR_HEIGHT); // clamped
  });

  test('open sectors sit at the floor', () => {
    assert.equal(displayTop(0, PASSABLE_GAP), 0);
    assert.equal(displayTop(-24, 200), -24);
  });

  test('half-open doors sink proportionally', () => {
    assert.equal(displayTop(0, PASSABLE_GAP / 2), DOOR_HEIGHT / 2);
  });

  test('lightToBrightness is clamped and increasing', () => {
    assert.ok(lightToBrightness(0) < lightToBrightness(128));
    assert.equal(lightToBrightness(-50), lightToBrightness(0));
    assert.equal(lightToBrightness(999), lightToBrightness(255));
  });
});

describe('buildWorldMesh', () => {
  // Room 0, a closed door (sector 1), room 2 with a raised floor.
  const { map } = loadTestMap({
    sectors: [sector(), sector({ ceiling: 0 }), sector({ floor: 16 })],
    rects: [room(0, 0, 0, 128, 128), room(1, 128, 32, 144, 96), room(2, 144, 0, 272, 128)],
    lines: [{ front: 0, back: 1, special: 1 }, { front: 2, back: 1, special: 1 }],
    things: [player(64, 64)],
  });
  const doors = findDoorSectors(map);
  const grid = buildGrid(map, doors);
  const mesh = buildWorldMesh(map, grid, doors);
  const vertexCount = mesh.position.length / 3;

  test('door sectors are detected', () => {
    assert.deepEqual([...doors], [1]);
  });

  test('produces consistent, non-empty typed arrays', () => {
    assert.ok(mesh.position instanceof Float32Array && vertexCount > 0);
    assert.equal(mesh.uv.length, vertexCount * 2);
    assert.equal(mesh.info.length, vertexCount * 4);
    assert.equal(mesh.misc.length, vertexCount * 2);
    assert.equal(mesh.tile.length, vertexCount);
    assert.ok(mesh.index instanceof Uint32Array);
    assert.equal(mesh.index.length % 6, 0);
    assert.ok(mesh.index.every((i) => i < vertexCount));
    assert.ok(mesh.position.every(Number.isFinite));
  });

  test('tile keys cover floor flats and wall textures', () => {
    assert.ok(mesh.tileKeys.includes('F:FLOOR'));
    assert.ok(mesh.tileKeys.includes('T:WALL'));
    assert.ok(mesh.tile.every((t) => t < mesh.tileKeys.length));
  });

  test('door side faces use SIDE_RELATIVE uv mode; floor sides use SIDE_WORLD', () => {
    let doorSides = 0, floorSides = 0;
    for (let v = 0; v < vertexCount; v++) {
      const kind = mesh.misc[v * 2 + 1];
      const mode = mesh.info[v * 4 + 3];
      if (kind === KIND.DOOR && mode !== UV_MODE.TOP) {
        assert.equal(mode, UV_MODE.SIDE_RELATIVE);
        doorSides++;
      }
      if (kind === KIND.FLOOR && mode !== UV_MODE.TOP) {
        assert.equal(mode, UV_MODE.SIDE_WORLD);
        floorSides++;
      }
    }
    assert.ok(doorSides > 0, 'door has side faces');
    assert.ok(floorSides > 0, 'the step up to room 2 has side faces');
  });

  test('door tops follow the door sector and stand at its display top', () => {
    let found = 0;
    for (let v = 0; v < vertexCount; v++) {
      if (mesh.misc[v * 2 + 1] !== KIND.DOOR || mesh.info[v * 4 + 3] !== UV_MODE.TOP) continue;
      assert.equal(mesh.info[v * 4], 1); // follow sector 1
      assert.equal(mesh.position[v * 3 + 1], displayTop(0, 0));
      found++;
    }
    assert.ok(found >= 4);
  });

  test('walls are static and taller than the floors beside them', () => {
    let walls = 0;
    for (let v = 0; v < vertexCount; v++) {
      if (mesh.misc[v * 2 + 1] !== KIND.WALL || mesh.info[v * 4 + 3] !== UV_MODE.TOP) continue;
      assert.equal(mesh.info[v * 4], STATIC);
      assert.ok(mesh.position[v * 3 + 1] >= 64);
      walls++;
    }
    assert.ok(walls > 0);
  });

  test('every sector has top faces and the door lines have faces', () => {
    assert.deepEqual([...mesh.sectorTops.keys()].sort(), [0, 1, 2]);
    const doorLines = map.linedefs.filter((l) => l.special === 1).map((l) => l.index);
    assert.ok(doorLines.some((l) => mesh.lineFaces.has(l)));
  });

  test('y is flipped into three.js space (z = -y)', () => {
    let minZ = Infinity, maxZ = -Infinity;
    for (let v = 0; v < vertexCount; v++) {
      minZ = Math.min(minZ, mesh.position[v * 3 + 2]);
      maxZ = Math.max(maxZ, mesh.position[v * 3 + 2]);
    }
    assert.ok(maxZ <= 16 && minZ >= -144);
  });
});
