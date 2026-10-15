// Doom map lumps -> plain data. Coordinates stay in Doom map units (y points north).

import { readName } from './wad.js';

const NONE = 0xffff;

function records(wad, lump, size, read) {
  if (!lump) return [];
  const view = wad.view(lump);
  const bytes = wad.data(lump);
  const out = [];
  for (let at = 0; at + size <= lump.size; at += size) out.push(read(view, at, bytes, out.length));
  return out;
}

const side = (v) => (v === NONE ? -1 : v);

export function loadMap(wad, name) {
  const lumps = wad.mapLumps(name);
  if (!lumps || !lumps.THINGS) throw new Error(`Map ${name} not found in WAD`);

  const vertices = records(wad, lumps.VERTEXES, 4, (v, at) => ({ x: v.getInt16(at, true), y: v.getInt16(at + 2, true) }));

  const sectors = records(wad, lumps.SECTORS, 26, (v, at, b, index) => ({
    index,
    floor: v.getInt16(at, true),
    ceiling: v.getInt16(at + 2, true),
    floorFlat: readName(b, at + 4),
    ceilingFlat: readName(b, at + 12),
    light: v.getInt16(at + 20, true),
    special: v.getInt16(at + 22, true),
    tag: v.getInt16(at + 24, true),
  }));

  const sidedefs = records(wad, lumps.SIDEDEFS, 30, (v, at, b) => ({
    xOffset: v.getInt16(at, true),
    yOffset: v.getInt16(at + 2, true),
    upper: readName(b, at + 4),
    lower: readName(b, at + 12),
    middle: readName(b, at + 20),
    sector: v.getUint16(at + 28, true),
  }));

  const linedefs = records(wad, lumps.LINEDEFS, 14, (v, at, b, index) => {
    const line = {
      index,
      v1: v.getUint16(at, true),
      v2: v.getUint16(at + 2, true),
      flags: v.getUint16(at + 4, true),
      special: v.getUint16(at + 6, true),
      tag: v.getUint16(at + 8, true),
      front: side(v.getUint16(at + 10, true)),
      back: side(v.getUint16(at + 12, true)),
    };
    return line;
  });
  for (const line of linedefs) {
    line.frontSector = line.front >= 0 ? sidedefs[line.front]?.sector ?? -1 : -1;
    line.backSector = line.back >= 0 ? sidedefs[line.back]?.sector ?? -1 : -1;
  }

  const things = records(wad, lumps.THINGS, 10, (v, at, b, index) => ({
    index,
    x: v.getInt16(at, true),
    y: v.getInt16(at + 2, true),
    angle: v.getInt16(at + 4, true),
    type: v.getInt16(at + 6, true),
    flags: v.getInt16(at + 8, true),
  }));

  const segs = records(wad, lumps.SEGS, 12, (v, at) => ({
    v1: v.getUint16(at, true),
    v2: v.getUint16(at + 2, true),
    linedef: v.getUint16(at + 6, true),
    side: v.getInt16(at + 8, true),
  }));

  const subsectors = records(wad, lumps.SSECTORS, 4, (v, at) => ({ count: v.getUint16(at, true), first: v.getUint16(at + 2, true) }));

  const nodes = records(wad, lumps.NODES, 28, (v, at) => ({
    x: v.getInt16(at, true),
    y: v.getInt16(at + 2, true),
    dx: v.getInt16(at + 4, true),
    dy: v.getInt16(at + 6, true),
    right: v.getUint16(at + 24, true),
    left: v.getUint16(at + 26, true),
  }));

  return { name, vertices, sectors, sidedefs, linedefs, things, segs, subsectors, nodes };
}

// R_PointInSubsector: walk the BSP to the subsector that holds (x, y).
export function subsectorAt(map, x, y) {
  if (map.nodes.length === 0) return 0;
  let node = map.nodes.length - 1;
  while (!(node & 0x8000)) {
    const n = map.nodes[node];
    const leftSide = (x - n.x) * n.dy - (y - n.y) * n.dx <= 0;
    node = leftSide ? n.left : n.right;
  }
  return node & 0x7fff;
}

export function sectorOfSubsector(map, ss) {
  const sub = map.subsectors[ss];
  const seg = map.segs[sub.first];
  const line = map.linedefs[seg.linedef];
  const sd = seg.side ? line.back : line.front;
  return map.sidedefs[sd]?.sector ?? -1;
}

// Lines that bound each sector (ignoring lines with the same sector on both sides).
export function sectorBoundaries(map) {
  const bounds = map.sectors.map(() => []);
  for (const line of map.linedefs) {
    const { frontSector: f, backSector: b } = line;
    if (f === b) continue;
    if (f >= 0) bounds[f].push(line);
    if (b >= 0) bounds[b].push(line);
  }
  return bounds;
}

// Even-odd point in polygon test over a sector's boundary lines.
export function pointInSector(map, boundaryLines, x, y) {
  let inside = false;
  for (const line of boundaryLines) {
    const a = map.vertices[line.v1];
    const b = map.vertices[line.v2];
    if ((a.y > y) !== (b.y > y)) {
      const cross = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (x < cross) inside = !inside;
    }
  }
  return inside;
}

// Sector containing the point, or -1 for the void outside the map.
export function sectorAt(map, bounds, x, y) {
  if (map.nodes.length === 0 || map.subsectors.length === 0) {
    // No BSP (hand-built test maps): test every sector, innermost (fewest lines) first.
    let found = -1;
    for (let s = 0; s < bounds.length; s++) {
      if (!pointInSector(map, bounds[s], x, y)) continue;
      if (found < 0 || bounds[s].length < bounds[found].length) found = s;
    }
    return found;
  }
  const s = sectorOfSubsector(map, subsectorAt(map, x, y));
  if (s >= 0 && pointInSector(map, bounds[s], x, y)) return s;
  return -1;
}

export const LINE_FLAGS = Object.freeze({
  BLOCKING: 1,
  BLOCK_MONSTERS: 2,
  TWO_SIDED: 4,
  UPPER_UNPEGGED: 8,
  LOWER_UNPEGGED: 16,
  SECRET: 32,
  BLOCK_SOUND: 64,
  NEVER_ON_MAP: 128,
  ALWAYS_ON_MAP: 256,
});

export const THING_FLAGS = Object.freeze({ EASY: 1, MEDIUM: 2, HARD: 4, AMBUSH: 8, MULTIPLAYER: 16 });
