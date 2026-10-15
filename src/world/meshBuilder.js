// Turn the block grid into renderable faces. Output is plain typed arrays so it
// can be tested in Node; the renderer uploads them to the GPU.
//
// Vertices may "follow" a sector: their height comes from that sector's live
// display top (doors sinking, lifts moving), which the shader reads every frame.

import { CELL, VOID, cellIndex } from './grid.js';
import { WALL_HEIGHT, FACE_SHADE, KIND, displayTop } from './style.js';
import { createLineIndex } from './lineIndex.js';

export const UV_MODE = Object.freeze({ TOP: 0, SIDE_WORLD: 1, SIDE_RELATIVE: 2 });
export const STATIC = -1;

const NEIGHBOURS = [
  // dx, dy, edge from a to b (outward normal on the right), shade
  { dx: 1, dy: 0, edge: (x0, y0, x1, y1) => [x1, y0, x1, y1], shade: FACE_SHADE.EAST },
  { dx: -1, dy: 0, edge: (x0, y0, x1, y1) => [x0, y1, x0, y0], shade: FACE_SHADE.WEST },
  { dx: 0, dy: 1, edge: (x0, y0, x1, y1) => [x1, y1, x0, y1], shade: FACE_SHADE.NORTH },
  { dx: 0, dy: -1, edge: (x0, y0, x1, y1) => [x0, y0, x1, y0], shade: FACE_SHADE.SOUTH },
];

const isTexture = (name) => name && name !== '-';

function createBuffers() {
  return { position: [], uv: [], info: [], misc: [], tile: [], index: [] };
}

function createTileTable() {
  const keys = [];
  const lookup = new Map();
  return {
    keys,
    id(key) {
      if (!lookup.has(key)) { lookup.set(key, keys.length); keys.push(key); }
      return lookup.get(key);
    },
  };
}

// Choose the texture for the face between two cells by finding the linedef that separates them.
function createTexturePicker(map, lines) {
  const sidedefOf = (line, sector) => {
    if (line.frontSector === sector) return map.sidedefs[line.front];
    if (line.backSector === sector) return map.sidedefs[line.back];
    return null;
  };

  return function pick(midX, midY, ownSector, facingSector, role) {
    const between = (l) =>
      (l.frontSector === ownSector && l.backSector === facingSector) ||
      (l.backSector === ownSector && l.frontSector === facingSector);
    const touching = (l) => l.frontSector === facingSector || l.backSector === facingSector;
    const line = lines.nearest(midX, midY, 24, between) ?? lines.nearest(midX, midY, 40, touching);
    if (!line) return null;
    const facing = sidedefOf(line, facingSector) ?? map.sidedefs[line.front];
    const other = facing === map.sidedefs[line.front] && line.back >= 0 ? map.sidedefs[line.back] : map.sidedefs[line.front];
    const order = role === 'wall' ? ['middle', 'upper', 'lower'] : role === 'door' ? ['upper', 'middle', 'lower'] : ['lower', 'middle', 'upper'];
    for (const side of [facing, other]) {
      if (!side) continue;
      for (const part of order) {
        if (isTexture(side[part])) return { key: `T:${side[part]}`, line: side === map.sidedefs[line.front] ? line.index : -1, part };
      }
    }
    return null;
  };
}

export function buildWorldMesh(map, grid, doorSectors = new Set(), options = {}) {
  const fallbackWall = options.fallbackWall ?? 'T:STARTAN3';
  const lines = createLineIndex(map);
  const pickTexture = createTexturePicker(map, lines);
  const tiles = createTileTable();
  const out = createBuffers();
  const lineFaces = new Map(); // linedef -> [{ vertex, part }] for switch textures
  const sectorTops = new Map(); // sector -> [vertex] for floor flat changes
  const remember = (map_, key, value) => {
    if (!map_.has(key)) map_.set(key, []);
    map_.get(key).push(value);
  };
  const tops = map.sectors.map((s) => displayTop(s.floor, s.ceiling));
  let minFloor = Infinity;
  for (const s of map.sectors) minFloor = Math.min(minFloor, s.floor);
  const baseHeight = minFloor - WALL_HEIGHT;

  const vertex = (x, y, height, u, v, follow, vref, light, mode, shade, kind, tile) => {
    out.position.push(x, height, -y);
    out.uv.push(u, v);
    out.info.push(follow, vref, light, mode);
    out.misc.push(shade, kind);
    out.tile.push(tile);
    return out.position.length / 3 - 1;
  };
  const quad = (a, b, c, d) => out.index.push(a, b, c, a, c, d);

  const sectorAtCell = (cx, cy) => {
    const i = cellIndex(grid, cx, cy);
    return i < 0 ? VOID : grid.sector[i];
  };

  // Height of a wall column: tall enough to hide the tallest floor beside it.
  const wallTops = new Float32Array(grid.width * grid.height).fill(NaN);
  for (let cy = 0; cy < grid.height; cy++) {
    for (let cx = 0; cx < grid.width; cx++) {
      if (sectorAtCell(cx, cy) !== VOID) continue;
      let highest = -Infinity;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const s = sectorAtCell(cx + ox, cy + oy);
          if (s !== VOID) highest = Math.max(highest, tops[s], map.sectors[s].floor);
        }
      }
      if (highest > -Infinity) wallTops[cy * grid.width + cx] = highest + WALL_HEIGHT;
    }
  }

  const sideFace = (edge, top, bottom, shade, kind, tile, uvMode, lightSector) => {
    const [ax, ay, bx, by] = edge;
    const len = Math.hypot(bx - ax, by - ay);
    const dirX = (bx - ax) / len, dirY = (by - ay) / len;
    const ua = ax * dirX + ay * dirY;
    const ub = ua + len;
    const vref = uvMode === UV_MODE.SIDE_RELATIVE ? top.follow : STATIC;
    const v0 = vertex(ax, ay, bottom.height, ua, 0, bottom.follow, vref, lightSector, uvMode, shade, kind, tile);
    const v1 = vertex(bx, by, bottom.height, ub, 0, bottom.follow, vref, lightSector, uvMode, shade, kind, tile);
    const v2 = vertex(bx, by, top.height, ub, 0, top.follow, vref, lightSector, uvMode, shade, kind, tile);
    const v3 = vertex(ax, ay, top.height, ua, 0, top.follow, vref, lightSector, uvMode, shade, kind, tile);
    quad(v0, v1, v2, v3);
    return v0;
  };

  const topFace = (x0, y0, x1, y1, height, follow, lightSector, shade, kind, tile) => {
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const ids = corners.map(([x, y]) => vertex(x, y, height, x, -y, follow, STATIC, lightSector, UV_MODE.TOP, shade, kind, tile));
    quad(...ids);
    return ids[0];
  };

  for (let cy = 0; cy < grid.height; cy++) {
    for (let cx = 0; cx < grid.width; cx++) {
      const s = sectorAtCell(cx, cy);
      const x0 = grid.originX + cx * CELL, y0 = grid.originY + cy * CELL;
      const x1 = x0 + CELL, y1 = y0 + CELL;
      const wallTop = wallTops[cy * grid.width + cx];

      if (s !== VOID) {
        const sector = map.sectors[s];
        const isDoor = doorSectors.has(s);
        const kind = isDoor ? KIND.DOOR : KIND.FLOOR;
        remember(sectorTops, s, topFace(x0, y0, x1, y1, tops[s], s, s, FACE_SHADE.TOP, kind, tiles.id(`F:${sector.floorFlat}`)));
        for (const n of NEIGHBOURS) {
          const t = sectorAtCell(cx + n.dx, cy + n.dy);
          if (t === VOID || t === s) continue;
          const edge = n.edge(x0, y0, x1, y1);
          const midX = (edge[0] + edge[2]) / 2, midY = (edge[1] + edge[3]) / 2;
          const role = isDoor ? 'door' : 'step';
          const picked = pickTexture(midX, midY, s, t, role);
          const tex = picked?.key ?? (isDoor ? fallbackWall : `F:${sector.floorFlat}`);
          const first = sideFace(
            edge,
            { height: tops[s], follow: s },
            { height: tops[t], follow: t },
            n.shade, kind, tiles.id(tex),
            isDoor ? UV_MODE.SIDE_RELATIVE : UV_MODE.SIDE_WORLD,
            t,
          );
          if (picked && picked.line >= 0) remember(lineFaces, picked.line, { vertex: first, part: picked.part });
        }
        continue;
      }

      if (Number.isNaN(wallTop)) continue; // outer void: nothing to draw
      let wallTexture = null;
      for (const n of NEIGHBOURS) {
        const t = sectorAtCell(cx + n.dx, cy + n.dy);
        const edge = n.edge(x0, y0, x1, y1);
        if (t !== VOID) {
          const midX = (edge[0] + edge[2]) / 2, midY = (edge[1] + edge[3]) / 2;
          const picked = pickTexture(midX, midY, VOID, t, 'wall');
          const tex = picked?.key ?? fallbackWall;
          wallTexture ??= tex;
          const first = sideFace(edge, { height: wallTop, follow: STATIC }, { height: tops[t], follow: t }, n.shade, KIND.WALL, tiles.id(tex), UV_MODE.SIDE_WORLD, t);
          if (picked && picked.line >= 0) remember(lineFaces, picked.line, { vertex: first, part: picked.part });
        } else {
          const ni = cellIndex(grid, cx + n.dx, cy + n.dy);
          const neighbourTop = ni < 0 ? NaN : wallTops[ni];
          const bottom = Number.isNaN(neighbourTop) ? baseHeight : neighbourTop;
          if (bottom < wallTop) {
            sideFace(edge, { height: wallTop, follow: STATIC }, { height: bottom, follow: STATIC }, n.shade * 0.8, KIND.WALL, tiles.id(wallTexture ?? fallbackWall), UV_MODE.SIDE_WORLD, STATIC);
          }
        }
      }
      wallTexture ??= nearestWallTexture(grid, cx, cy, sectorAtCell, pickTexture) ?? fallbackWall;
      topFace(x0, y0, x1, y1, wallTop, STATIC, STATIC, FACE_SHADE.WALL_TOP, KIND.WALL, tiles.id(wallTexture));
    }
  }

  return Object.freeze({
    position: new Float32Array(out.position),
    uv: new Float32Array(out.uv),
    info: new Float32Array(out.info),
    misc: new Float32Array(out.misc),
    tile: new Uint16Array(out.tile),
    index: new Uint32Array(out.index),
    tileKeys: Object.freeze([...tiles.keys]),
    lineFaces,
    sectorTops,
  });
}

// Corner wall cells touch sectors only diagonally; borrow a texture from a diagonal neighbour.
function nearestWallTexture(grid, cx, cy, sectorAtCell, pickTexture) {
  for (const [ox, oy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const t = sectorAtCell(cx + ox, cy + oy);
    if (t === VOID) continue;
    const x = grid.originX + (cx + 0.5 + ox * 0.5) * CELL;
    const y = grid.originY + (cy + 0.5 + oy * 0.5) * CELL;
    const picked = pickTexture(x, y, VOID, t, 'wall');
    if (picked) return picked.key;
  }
  return null;
}
