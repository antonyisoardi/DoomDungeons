// Palette, patch pictures, composite wall textures and flats.
// Images are { width, height, leftOffset, topOffset, pixels } where pixels holds
// palette indices and TRANSPARENT for holes.

import { readName } from './wad.js';

export const TRANSPARENT = -1;
const FLAT_SIZE = 64;

export function readPalette(wad, index = 0) {
  const bytes = wad.bytes('PLAYPAL');
  if (!bytes || bytes.length < 768 * (index + 1)) throw new Error('WAD has no PLAYPAL palette');
  const base = 768 * index;
  const colors = [];
  for (let i = 0; i < 256; i++) {
    colors.push(Object.freeze([bytes[base + i * 3], bytes[base + i * 3 + 1], bytes[base + i * 3 + 2]]));
  }
  return Object.freeze(colors);
}

export function decodePicture(bytes) {
  if (!bytes || bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(0, true);
  const height = view.getUint16(2, true);
  if (width === 0 || height === 0 || width > 4096 || height > 4096 || 8 + width * 4 > bytes.length) return null;
  const pixels = new Int16Array(width * height).fill(TRANSPARENT);

  for (let x = 0; x < width; x++) {
    let at = view.getUint32(8 + x * 4, true);
    let lastTop = -1;
    while (at < bytes.length) {
      let top = bytes[at];
      if (top === 0xff) break;
      // DeePsea tall patches: a top <= last top is relative.
      if (top <= lastTop) top += lastTop;
      lastTop = top;
      const length = bytes[at + 1];
      const start = at + 3;
      for (let i = 0; i < length && start + i < bytes.length; i++) {
        const y = top + i;
        if (y < height) pixels[y * width + x] = bytes[start + i];
      }
      at = start + length + 1;
    }
  }
  return Object.freeze({
    width,
    height,
    leftOffset: view.getInt16(4, true),
    topOffset: view.getInt16(6, true),
    pixels,
  });
}

export function readFlat(wad, lump) {
  const bytes = wad.data(lump);
  const pixels = new Int16Array(FLAT_SIZE * FLAT_SIZE);
  for (let i = 0; i < pixels.length; i++) pixels[i] = bytes[i % bytes.length];
  return Object.freeze({ width: FLAT_SIZE, height: FLAT_SIZE, leftOffset: 0, topOffset: 0, pixels });
}

export function loadFlats(wad) {
  const flats = new Map();
  for (const lump of wad.between('F_START', 'F_END')) flats.set(lump.name, readFlat(wad, lump));
  return flats;
}

function readPatchNames(wad) {
  const bytes = wad.bytes('PNAMES');
  if (!bytes) return [];
  const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(0, true);
  const names = [];
  for (let i = 0; i < count; i++) names.push(readName(bytes, 4 + i * 8));
  return names;
}

function readTextureDefs(wad, lumpName, patchNames) {
  const bytes = wad.bytes(lumpName);
  if (!bytes) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getInt32(0, true);
  const defs = [];
  for (let i = 0; i < count; i++) {
    const at = view.getInt32(4 + i * 4, true);
    const patchCount = view.getInt16(at + 20, true);
    const patches = [];
    for (let p = 0; p < patchCount; p++) {
      const pa = at + 22 + p * 10;
      patches.push({
        originX: view.getInt16(pa, true),
        originY: view.getInt16(pa + 2, true),
        name: patchNames[view.getInt16(pa + 4, true)],
      });
    }
    defs.push({
      name: readName(bytes, at),
      width: view.getInt16(at + 12, true),
      height: view.getInt16(at + 14, true),
      patches,
    });
  }
  return defs;
}

// Wall textures are composed lazily: most maps use a fraction of them.
export function createTextureLibrary(wad) {
  const patchNames = readPatchNames(wad);
  const defs = new Map();
  for (const def of [...readTextureDefs(wad, 'TEXTURE1', patchNames), ...readTextureDefs(wad, 'TEXTURE2', patchNames)]) {
    defs.set(def.name, def);
  }
  const patchCache = new Map();
  const textureCache = new Map();

  const patch = (name) => {
    if (!patchCache.has(name)) patchCache.set(name, decodePicture(wad.bytes(name)));
    return patchCache.get(name);
  };

  const compose = (def) => {
    const pixels = new Int16Array(def.width * def.height).fill(TRANSPARENT);
    for (const placed of def.patches) {
      const pic = placed.name ? patch(placed.name) : null;
      if (!pic) continue;
      for (let y = 0; y < pic.height; y++) {
        const ty = placed.originY + y;
        if (ty < 0 || ty >= def.height) continue;
        for (let x = 0; x < pic.width; x++) {
          const tx = placed.originX + x;
          const c = pic.pixels[y * pic.width + x];
          if (tx >= 0 && tx < def.width && c !== TRANSPARENT) pixels[ty * def.width + tx] = c;
        }
      }
    }
    return Object.freeze({ width: def.width, height: def.height, leftOffset: 0, topOffset: 0, pixels });
  };

  return Object.freeze({
    has: (name) => defs.has(name),
    get(name) {
      const key = (name ?? '').toUpperCase();
      if (!defs.has(key)) return null;
      if (!textureCache.has(key)) textureCache.set(key, compose(defs.get(key)));
      return textureCache.get(key);
    },
    patch,
  });
}

// Average opaque colour of an image, used for minimap/particle tints.
export function averageColor(image, palette) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const c of image.pixels) {
    if (c === TRANSPARENT) continue;
    const [pr, pg, pb] = palette[c];
    r += pr; g += pg; b += pb; n++;
  }
  return n ? [r / n, g / n, b / n] : [128, 128, 128];
}
