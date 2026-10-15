import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { packAtlas, imageToRgba, resolveTileImage } from '../src/render/atlas.js';
import { TRANSPARENT } from '../src/wad/graphics.js';

const palette = Array.from({ length: 256 }, (_, i) => [i, (i * 2) & 255, 255 - i]);
const solid = (width, height, color) => ({ width, height, pixels: new Int16Array(width * height).fill(color) });

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('imageToRgba', () => {
  test('maps palette indices and makes TRANSPARENT clear', () => {
    const rgba = imageToRgba({ width: 2, height: 1, pixels: Int16Array.from([3, TRANSPARENT]) }, palette);
    assert.deepEqual([...rgba], [3, 6, 252, 255, 0, 0, 0, 0]);
  });
});

describe('packAtlas', () => {
  // Mixed sizes, enough to need several shelves in a 2048 wide atlas.
  const images = new Map();
  for (let i = 0; i < 30; i++) images.set(`T:W${i}`, solid(128 + (i % 3) * 64, 64 + (i % 4) * 32, i + 1));
  images.set('F:FLAT', solid(64, 64, 200));
  const keys = [...images.keys(), 'T:MISSING'];
  const atlas = packAtlas(keys, (k) => images.get(k) ?? null, palette);

  test('every key gets a rect inside the atlas', () => {
    assert.equal(atlas.width, 2048);
    assert.equal(atlas.rects.size, keys.length);
    for (const [key, r] of atlas.rects) {
      assert.ok(r.x >= 0 && r.y >= 0, key);
      assert.ok(r.x + r.width <= atlas.width, `${key} fits horizontally`);
      assert.ok(r.y + r.height <= atlas.height, `${key} fits vertically`);
    }
  });

  test('rects do not overlap', () => {
    const rects = [...atlas.rects.entries()];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        assert.ok(!overlaps(rects[i][1], rects[j][1]), `${rects[i][0]} vs ${rects[j][0]}`);
      }
    }
  });

  test('height is a power of two and data is RGBA', () => {
    assert.equal(Math.log2(atlas.height) % 1, 0);
    assert.equal(atlas.data.length, atlas.width * atlas.height * 4);
  });

  test('pixels are copied into their rects', () => {
    const r = atlas.rects.get('F:FLAT');
    const at = ((r.y + 5) * atlas.width + r.x + 7) * 4;
    assert.deepEqual([...atlas.data.slice(at, at + 4)], [...palette[200], 255]);
  });

  test('missing images become a 16x16 checker', () => {
    const r = atlas.rects.get('T:MISSING');
    assert.equal(r.width, 16);
    assert.equal(r.height, 16);
  });

  test('an empty key list still makes a valid atlas', () => {
    const empty = packAtlas([], () => null, palette);
    assert.equal(empty.height, 1);
    assert.equal(empty.rects.size, 0);
  });
});

describe('resolveTileImage', () => {
  const flat = solid(64, 64, 1);
  const tex = solid(8, 8, 2);
  const resources = { flats: new Map([['FLOOR', flat]]), textures: { get: (n) => (n === 'WALL' ? tex : null) } };

  test('looks up flats and textures by prefix', () => {
    assert.equal(resolveTileImage('F:FLOOR', resources), flat);
    assert.equal(resolveTileImage('T:WALL', resources), tex);
    assert.equal(resolveTileImage('F:NOPE', resources), null);
    assert.equal(resolveTileImage('T:NOPE', resources), null);
    assert.equal(resolveTileImage('X:WALL', resources), null);
  });
});
