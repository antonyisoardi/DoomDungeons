import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseWad } from '../src/wad/wad.js';
import { decodePicture, readPalette, createTextureLibrary, loadFlats, averageColor, TRANSPARENT } from '../src/wad/graphics.js';
import {
  buildWad, buildPicture, buildPlaypal, buildPnames, buildTextureLump, solidPicture, flatLump, marker,
} from './helpers/wadBuilder.js';

const T = TRANSPARENT;

describe('decodePicture', () => {
  // 3 wide, 5 tall. Column 0: two posts with a hole at y=2. Column 1: empty. Column 2: post from y=1.
  const bytes = buildPicture({
    width: 3, height: 5, leftOffset: -2, topOffset: 7,
    columns: [
      [{ top: 0, pixels: [1, 2] }, { top: 3, pixels: [3] }],
      [],
      [{ top: 1, pixels: [7, 8, 9] }],
    ],
  });
  const pic = decodePicture(bytes);

  test('reads the header', () => {
    assert.equal(pic.width, 3);
    assert.equal(pic.height, 5);
    assert.equal(pic.leftOffset, -2);
    assert.equal(pic.topOffset, 7);
  });

  test('decodes posts and leaves gaps transparent (row-major pixels)', () => {
    const rows = [];
    for (let y = 0; y < 5; y++) rows.push([...pic.pixels.slice(y * 3, y * 3 + 3)]);
    assert.deepEqual(rows, [
      [1, T, T],
      [2, T, 7],
      [T, T, 8],
      [3, T, 9],
      [T, T, T],
    ]);
  });

  test('clips posts that run past the bottom', () => {
    const tall = decodePicture(buildPicture({ width: 1, height: 2, columns: [[{ top: 1, pixels: [5, 6, 7] }]] }));
    assert.deepEqual([...tall.pixels], [T, 5]);
  });

  test('rejects garbage', () => {
    assert.equal(decodePicture(null), null);
    assert.equal(decodePicture(new Uint8Array(4)), null);
    assert.equal(decodePicture(new Uint8Array(8)), null); // width 0
    const lying = new Uint8Array(12);
    new DataView(lying.buffer).setUint16(0, 50, true); // 50 columns but no column table
    new DataView(lying.buffer).setUint16(2, 1, true);
    assert.equal(decodePicture(lying), null);
  });

  test('handles a lump that is a subarray of a larger buffer', () => {
    const big = new Uint8Array(bytes.length + 10);
    big.set(bytes, 10);
    const sub = decodePicture(big.subarray(10));
    assert.deepEqual([...sub.pixels], [...pic.pixels]);
  });
});

describe('readPalette', () => {
  const wad = parseWad(buildWad([{ name: 'PLAYPAL', data: buildPlaypal(2) }]));

  test('returns 256 frozen RGB triples', () => {
    const pal = readPalette(wad);
    assert.equal(pal.length, 256);
    assert.deepEqual(pal[3], [3, 252, 21]);
    assert.ok(Object.isFrozen(pal) && Object.isFrozen(pal[0]));
  });

  test('reads other palettes by index', () => {
    assert.deepEqual(readPalette(wad, 1)[0], [1, 255, 0]);
  });

  test('throws without PLAYPAL or past the last palette', () => {
    assert.throws(() => readPalette(wad, 2), /PLAYPAL/);
    assert.throws(() => readPalette(parseWad(buildWad([{ name: 'X', data: new Uint8Array(1) }]))), /PLAYPAL/);
  });
});

describe('texture library', () => {
  // Patch A: 4x4 solid colour 5. Patch B: 2x2 with a transparent pixel.
  const patchB = buildPicture({ width: 2, height: 2, columns: [[{ top: 0, pixels: [9, 9] }], [{ top: 1, pixels: [9] }]] });
  const wad = parseWad(buildWad([
    { name: 'PNAMES', data: buildPnames(['PATCHA', 'PATCHB']) },
    { name: 'TEXTURE1', data: buildTextureLump([
      { name: 'COMBO', width: 6, height: 4, patches: [{ originX: -2, originY: 0, patch: 0 }, { originX: 1, originY: 1, patch: 1 }] },
    ]) },
    { name: 'TEXTURE2', data: buildTextureLump([{ name: 'SECOND', width: 4, height: 4, patches: [{ originX: 0, originY: 0, patch: 0 }] }]) },
    { name: 'PATCHA', data: solidPicture(4, 4, 5) },
    { name: 'PATCHB', data: patchB },
  ]));
  const lib = createTextureLibrary(wad);

  test('knows textures from TEXTURE1 and TEXTURE2', () => {
    assert.ok(lib.has('COMBO'));
    assert.ok(lib.has('SECOND'));
    assert.equal(lib.get('NOPE'), null);
    assert.equal(lib.get(undefined), null);
  });

  test('composes patches with clipping and transparency', () => {
    const tex = lib.get('combo');
    assert.equal(tex.width, 6);
    assert.equal(tex.height, 4);
    const row = (y) => [...tex.pixels.slice(y * 6, y * 6 + 6)];
    // Patch A covers x 0..1 (clipped from -2), patch B at (1,1); B's transparent pixel keeps A's colour.
    assert.deepEqual(row(0), [5, 5, T, T, T, T]);
    assert.deepEqual(row(1), [5, 9, T, T, T, T]);
    assert.deepEqual(row(2), [5, 9, 9, T, T, T]);
    assert.deepEqual(row(3), [5, 5, T, T, T, T]);
  });

  test('caches composed textures', () => {
    assert.equal(lib.get('COMBO'), lib.get('COMBO'));
  });

  test('exposes decoded patches', () => {
    assert.equal(lib.patch('PATCHA').width, 4);
  });
});

describe('flats', () => {
  const wad = parseWad(buildWad([marker('F_START'), { name: 'FLAT1', data: flatLump(3) }, { name: 'SHORT', data: new Uint8Array([1, 2]) }, marker('F_END')]));
  const flats = loadFlats(wad);

  test('loads every flat between F_START and F_END as 64x64', () => {
    assert.deepEqual([...flats.keys()], ['FLAT1', 'SHORT']);
    assert.equal(flats.get('FLAT1').pixels.length, 4096);
    assert.ok(flats.get('FLAT1').pixels.every((c) => c === 3));
  });

  test('tiles short flats', () => {
    assert.deepEqual([...flats.get('SHORT').pixels.slice(0, 4)], [1, 2, 1, 2]);
  });
});

describe('averageColor', () => {
  const palette = Array.from({ length: 256 }, (_, i) => [i, 0, 0]);

  test('averages opaque pixels only', () => {
    assert.deepEqual(averageColor({ pixels: Int16Array.from([10, 20, T]) }, palette), [15, 0, 0]);
  });

  test('falls back to grey for an empty image', () => {
    assert.deepEqual(averageColor({ pixels: Int16Array.from([T]) }, palette), [128, 128, 128]);
  });
});
