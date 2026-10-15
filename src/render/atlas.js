// Pack palette-indexed images into one RGBA atlas (shelf packing). Pure: returns
// pixel data and rectangles so it can be tested without a GPU.

import { TRANSPARENT } from '../wad/graphics.js';

const ATLAS_WIDTH = 2048;
const MAX_HEIGHT = 8192;

export function imageToRgba(image, palette, out = new Uint8Array(image.width * image.height * 4)) {
  for (let i = 0; i < image.pixels.length; i++) {
    const c = image.pixels[i];
    if (c === TRANSPARENT) { out[i * 4 + 3] = 0; continue; }
    const [r, g, b] = palette[c];
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  return out;
}

function missingImage() {
  // Magenta/black checker so missing textures are obvious.
  const pixels = new Int16Array(16 * 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pixels[y * 16 + x] = ((x >> 3) ^ (y >> 3)) & 1 ? 0 : 251;
  return { width: 16, height: 16, pixels };
}

export function resolveTileImage(key, { flats, textures }) {
  const [kind, name] = [key.slice(0, 1), key.slice(2)];
  if (kind === 'F') return flats.get(name) ?? null;
  if (kind === 'T') return textures.get(name);
  return null;
}

export function packAtlas(keys, resolve, palette) {
  const entries = keys.map((key) => ({ key, image: resolve(key) ?? missingImage() }));
  const order = [...entries].sort((a, b) => b.image.height - a.image.height);
  let x = 0, y = 0, shelf = 0;
  const rects = new Map();
  for (const e of order) {
    const { width, height } = e.image;
    if (x + width > ATLAS_WIDTH) { x = 0; y += shelf; shelf = 0; }
    rects.set(e.key, { x, y, width, height });
    x += width;
    shelf = Math.max(shelf, height);
  }
  const height = Math.max(1, 2 ** Math.ceil(Math.log2(y + shelf)));
  if (height > MAX_HEIGHT) throw new Error('Texture atlas is too large');

  const data = new Uint8Array(ATLAS_WIDTH * height * 4);
  for (const e of entries) {
    const r = rects.get(e.key);
    const rgba = imageToRgba(e.image, palette);
    for (let row = 0; row < r.height; row++) {
      data.set(rgba.subarray(row * r.width * 4, (row + 1) * r.width * 4), ((r.y + row) * ATLAS_WIDTH + r.x) * 4);
    }
  }
  return Object.freeze({ width: ATLAS_WIDTH, height, data, rects });
}
