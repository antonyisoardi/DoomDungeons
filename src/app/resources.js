// Everything decoded once per WAD and shared by every level.

import { readPalette, loadFlats, createTextureLibrary } from '../wad/graphics.js';

export function createResources(wad) {
  return Object.freeze({
    wad,
    palette: readPalette(wad),
    flats: loadFlats(wad),
    textures: createTextureLibrary(wad),
    maps: wad.mapNames(),
  });
}
