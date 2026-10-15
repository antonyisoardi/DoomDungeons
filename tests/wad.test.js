import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseWad, readName } from '../src/wad/wad.js';
import { buildWad, marker, writeName, encodeMapLumps, buildRectMap } from './helpers/wadBuilder.js';
import { room, player, sector } from './helpers/levelHelper.js';

const lump = (name, bytes = [1, 2, 3]) => ({ name, data: new Uint8Array(bytes) });

describe('readName', () => {
  test('stops at NUL and upper-cases', () => {
    const bytes = new Uint8Array(8);
    writeName(bytes, 0, 'abc');
    assert.equal(readName(bytes, 0), 'ABC');
  });

  test('reads at most `length` characters with no terminator', () => {
    const bytes = new Uint8Array([...'ABCDEFGHIJ'].map((c) => c.charCodeAt(0)));
    assert.equal(readName(bytes, 0), 'ABCDEFGH');
    assert.equal(readName(bytes, 2, 4), 'CDEF');
  });
});

describe('parseWad validation', () => {
  test('rejects non-ArrayBuffer input', () => {
    assert.throws(() => parseWad(new Uint8Array(16)), TypeError);
  });

  test('rejects files smaller than the header', () => {
    assert.throws(() => parseWad(new ArrayBuffer(8)), /too small/);
  });

  test('rejects a bad magic', () => {
    const buffer = buildWad([lump('A')]);
    new Uint8Array(buffer).set([0x5a, 0x5a, 0x5a, 0x5a], 0);
    assert.throws(() => parseWad(buffer), /Not a WAD/);
  });

  test('rejects a directory past the end of the file', () => {
    const buffer = buildWad([lump('A')]);
    new DataView(buffer).setInt32(4, 1000, true);
    assert.throws(() => parseWad(buffer), /corrupt/);
  });

  test('rejects a negative lump count', () => {
    const buffer = buildWad([lump('A')]);
    new DataView(buffer).setInt32(4, -1, true);
    assert.throws(() => parseWad(buffer), /corrupt/);
  });

  test('rejects a lump that points outside the file', () => {
    const buffer = buildWad([lump('A')]);
    const dir = new DataView(buffer).getInt32(8, true);
    new DataView(buffer).setInt32(dir + 4, 99999, true);
    assert.throws(() => parseWad(buffer), /out of bounds/);
  });

  test('accepts IWAD and PWAD', () => {
    assert.equal(parseWad(buildWad([lump('A')], 'IWAD')).type, 'IWAD');
    assert.equal(parseWad(buildWad([lump('A')], 'PWAD')).type, 'PWAD');
  });
});

describe('lump access', () => {
  const wad = parseWad(buildWad([lump('FIRST', [1]), lump('dup', [2]), lump('DUP', [3, 4])]));

  test('lists lumps in directory order with offsets and sizes', () => {
    assert.deepEqual(wad.lumps.map((l) => l.name), ['FIRST', 'DUP', 'DUP']);
    assert.deepEqual(wad.lumps.map((l) => l.size), [1, 1, 2]);
  });

  test('find/has are case-insensitive and later lumps win', () => {
    assert.ok(wad.has('first'));
    assert.equal(wad.find('dup').index, 2);
    assert.deepEqual([...wad.bytes('DUP')], [3, 4]);
    assert.equal(wad.find('missing'), null);
    assert.equal(wad.bytes('missing'), null);
  });

  test('view reads the lump bytes', () => {
    assert.equal(wad.view(wad.find('DUP')).getUint8(1), 4);
  });
});

describe('between()', () => {
  const wad = parseWad(buildWad([
    lump('BEFORE'),
    marker('F_START'), lump('FLAT1'), marker('F1_START'), lump('FLAT2'), marker('F_END'),
    lump('MID'),
    marker('FF_START'), lump('FLAT3'), marker('FF_END'),
    lump('AFTER'),
  ]));

  test('returns non-empty lumps between markers, including FF_ variants', () => {
    assert.deepEqual(wad.between('F_START', 'F_END').map((l) => l.name), ['FLAT1', 'FLAT2', 'FLAT3']);
  });

  test('returns nothing for absent markers', () => {
    assert.deepEqual(wad.between('S_START', 'S_END'), []);
  });
});

describe('maps', () => {
  const desc = { sectors: [sector()], rects: [room(0, 0, 0, 64, 64)], things: [player(32, 32)] };
  const mapLumps = encodeMapLumps(buildRectMap(desc));
  const wad = parseWad(buildWad([
    marker('E1M1'), ...mapLumps,
    marker('MAP01'), ...mapLumps,
    marker('E1M2'), lump('NOTMAP'),
    marker('E9M99'), ...mapLumps,
  ]));

  test('mapNames lists markers followed by THINGS', () => {
    assert.deepEqual(wad.mapNames(), ['E1M1', 'MAP01']);
  });

  test('mapLumps returns the ten lumps after the marker', () => {
    const lumps = wad.mapLumps('e1m1');
    assert.deepEqual(Object.keys(lumps).sort(), ['BLOCKMAP', 'LINEDEFS', 'NODES', 'REJECT', 'SECTORS', 'SEGS', 'SIDEDEFS', 'SSECTORS', 'THINGS', 'VERTEXES']);
    assert.equal(lumps.THINGS.index, wad.find('E1M1').index + 1);
  });

  test('mapLumps returns null for a missing map', () => {
    assert.equal(wad.mapLumps('E3M3'), null);
  });

  test('mapLumps does not read into the next map when a map has fewer than ten lumps', () => {
    const short = encodeMapLumps(buildRectMap(desc)).filter((l) => ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SECTORS'].includes(l.name));
    const other = encodeMapLumps(buildRectMap({ ...desc, things: [player(1, 1), player(2, 2)] }));
    const w = parseWad(buildWad([marker('E1M1'), ...short, marker('E1M2'), ...other]));
    assert.equal(w.mapLumps('E1M1').THINGS.index, 1);
  });
});
