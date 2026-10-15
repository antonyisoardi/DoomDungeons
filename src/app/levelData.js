// Static data for one map: parsed lumps, block grid, world mesh and texture atlas.

import { loadMap } from '../wad/map.js';
import { buildGrid } from '../world/grid.js';
import { buildWorldMesh } from '../world/meshBuilder.js';
import { findDoorSectors } from '../game/specials/table.js';
import { packAtlas, resolveTileImage } from '../render/atlas.js';

// Textures a level may switch to at runtime: switch partners and every floor flat.
function runtimeTileKeys(map, textures) {
  const keys = new Set();
  for (const side of map.sidedefs) {
    for (const name of [side.upper, side.middle, side.lower]) {
      if (/^SW[12]/.test(name)) {
        keys.add(`T:${name}`);
        const partner = `SW${name[2] === '1' ? '2' : '1'}${name.slice(3)}`;
        if (textures.has(partner)) keys.add(`T:${partner}`);
      }
    }
  }
  for (const s of map.sectors) keys.add(`F:${s.floorFlat}`);
  return keys;
}

export function buildLevelData(resources, mapName) {
  const map = loadMap(resources.wad, mapName);
  const doorSectors = findDoorSectors(map);
  const grid = buildGrid(map, doorSectors);
  const mesh = buildWorldMesh(map, grid, doorSectors);
  const keys = [...new Set([...mesh.tileKeys, ...runtimeTileKeys(map, resources.textures)])];
  const atlas = packAtlas(keys, (key) => resolveTileImage(key, resources), resources.palette);
  return Object.freeze({ map, doorSectors, grid, mesh, atlas });
}
