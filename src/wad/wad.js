// WAD container: header + lump directory. Everything downstream reads lumps through this.

const HEADER_SIZE = 12;
const DIR_ENTRY_SIZE = 16;
const MAP_LUMPS = new Set(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']);

export function readName(bytes, offset, length = 8) {
  let name = '';
  for (let i = 0; i < length; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    name += String.fromCharCode(c);
  }
  return name.toUpperCase();
}

export function parseWad(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError('parseWad expects an ArrayBuffer');
  if (buffer.byteLength < HEADER_SIZE) throw new Error('File is too small to be a WAD');
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const type = readName(bytes, 0, 4);
  if (type !== 'IWAD' && type !== 'PWAD') throw new Error(`Not a WAD file (header "${type}")`);
  const count = view.getInt32(4, true);
  const dirOffset = view.getInt32(8, true);
  if (count < 0 || dirOffset < 0 || dirOffset + count * DIR_ENTRY_SIZE > buffer.byteLength) {
    throw new Error('WAD directory is corrupt');
  }

  const lumps = [];
  for (let i = 0; i < count; i++) {
    const at = dirOffset + i * DIR_ENTRY_SIZE;
    const offset = view.getInt32(at, true);
    const size = view.getInt32(at + 4, true);
    if (offset < 0 || size < 0 || offset + size > buffer.byteLength) throw new Error(`Lump ${i} is out of bounds`);
    lumps.push(Object.freeze({ index: i, name: readName(bytes, at + 8), offset, size }));
  }
  return createWad(type, buffer, Object.freeze(lumps));
}

function createWad(type, buffer, lumps) {
  // Later lumps win, as in Doom (PWADs override).
  const byName = new Map();
  for (const lump of lumps) byName.set(lump.name, lump);

  const data = (lump) => new Uint8Array(buffer, lump.offset, lump.size);
  const find = (name) => byName.get(name.toUpperCase()) ?? null;

  return Object.freeze({
    type,
    lumps,
    find,
    has: (name) => byName.has(name.toUpperCase()),
    data,
    view: (lump) => new DataView(buffer, lump.offset, lump.size),
    bytes: (name) => {
      const lump = find(name);
      return lump ? data(lump) : null;
    },
    // Lumps strictly between two markers, e.g. F_START/F_END. Accepts "FF_START" style variants.
    between(start, end) {
      const out = [];
      let inside = false;
      for (const lump of lumps) {
        if (lump.name === start || lump.name === start[0] + start) { inside = true; continue; }
        if (lump.name === end || lump.name === end[0] + end) { inside = false; continue; }
        if (inside && lump.size > 0) out.push(lump);
      }
      return out;
    },
    // Lumps following a map marker (THINGS, LINEDEFS, ...).
    mapLumps(mapName) {
      const marker = lumps.findIndex((l) => l.name === mapName.toUpperCase());
      if (marker < 0) return null;
      const result = {};
      for (let i = marker + 1; i < lumps.length && MAP_LUMPS.has(lumps[i].name); i++) result[lumps[i].name] = lumps[i];
      return result;
    },
    mapNames() {
      return lumps
        .filter((l, i) => /^(E\dM\d|MAP\d\d)$/.test(l.name) && lumps[i + 1]?.name === 'THINGS')
        .map((l) => l.name);
    },
  });
}
