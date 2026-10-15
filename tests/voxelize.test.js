import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { voxelize, edgeDistance, VOXEL_SHADE } from '../src/render/voxelize.js';
import { TRANSPARENT } from '../src/wad/graphics.js';

const palette = Array.from({ length: 256 }, () => [255, 128, 0]);
const picture = (width, height, pixels, leftOffset = 0, topOffset = 0) =>
  ({ width, height, leftOffset, topOffset, pixels: Int16Array.from(pixels) });

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], positions[i + a]); max[a] = Math.max(max[a], positions[i + a]); }
  }
  return { min, max };
}

describe('edgeDistance', () => {
  test('distance to the nearest hole grows toward the middle', () => {
    const dist = edgeDistance(5, 5, new Uint8Array(25).fill(1));
    assert.equal(dist[0], 1);
    assert.equal(dist[6], 2);
    assert.equal(dist[12], 3);
  });

  test('transparent pixels get -1', () => {
    const dist = edgeDistance(3, 1, Uint8Array.from([1, 0, 1]));
    assert.deepEqual([...dist], [1, -1, 1]);
  });
});

describe('voxelize', () => {
  test('a single opaque pixel becomes a closed box', () => {
    const mesh = voxelize(picture(1, 1, [7], 3, 10), palette);
    const verts = mesh.positions.length / 3;
    assert.equal(mesh.colors.length, mesh.positions.length);
    assert.equal(mesh.indices.length % 6, 0);
    assert.equal(verts % 4, 0);
    // Front and back faces, plus each of the four sides (split into two quads at z=0).
    assert.equal(verts, 4 * (2 + 4 * 2));
    const { min, max } = bounds(mesh.positions);
    assert.deepEqual(min, [-3, 9, -1]);
    assert.deepEqual(max, [-2, 10, 1]);
  });

  test('front faces carry the palette colour at full shade', () => {
    const mesh = voxelize(picture(1, 1, [7]), palette);
    assert.deepEqual([...mesh.colors.slice(0, 3)].map((c) => +c.toFixed(4)), [1, +(128 / 255).toFixed(4), 0]);
    assert.equal(VOXEL_SHADE.FRONT, 1);
  });

  test('a fully transparent picture gives empty geometry', () => {
    const mesh = voxelize(picture(2, 2, [TRANSPARENT, TRANSPARENT, TRANSPARENT, TRANSPARENT]), palette);
    assert.equal(mesh.positions.length, 0);
    assert.equal(mesh.indices.length, 0);
  });

  test('flip mirrors around the left offset', () => {
    const pic = picture(3, 1, [1, TRANSPARENT, TRANSPARENT]);
    const normal = bounds(voxelize(pic, palette).positions);
    const flipped = bounds(voxelize(pic, palette, { flip: true }).positions);
    assert.deepEqual([normal.min[0], normal.max[0]], [0, 1]);
    assert.deepEqual([flipped.min[0], flipped.max[0]], [2, 3]);
  });

  test('inner pixels are thicker, capped by maxDepth', () => {
    const big = voxelize(picture(9, 9, new Array(81).fill(1)), palette, { maxDepth: 6 });
    const { min, max } = bounds(big.positions);
    assert.equal(max[2], 3);
    assert.equal(min[2], -3);
  });

  test('indices reference existing vertices', () => {
    const mesh = voxelize(picture(4, 4, [1, 1, TRANSPARENT, 1, 1, 1, 1, 1, TRANSPARENT, 1, 1, 1, 1, 1, 1, TRANSPARENT]), palette);
    const verts = mesh.positions.length / 3;
    assert.ok(mesh.indices instanceof Uint16Array);
    assert.ok(mesh.indices.every((i) => i < verts));
  });
});
