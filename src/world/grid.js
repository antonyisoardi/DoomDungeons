// Rasterise a Doom map onto a block grid. Each cell is CELL map units square and
// belongs to one sector (or VOID). The grid drives rendering, collision and line of sight.

import { sectorAt, sectorBoundaries, LINE_FLAGS } from '../wad/map.js';

export const CELL = 16;
export const VOID = -1;
const SAMPLES = 4; // per axis: thin (8 unit) doors and walls still land in a cell
const PAD = 3; // cells of margin around the map

export const FENCE = Object.freeze({ NONE: 0, ALL: 1, MONSTERS: 2 });

function mapBounds(map) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of map.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
}

// Pick a cell's sector from its samples. Ties: doors beat void beat floor, so
// thin doors stay closed and thin walls stay solid.
export function chooseSector(counts, isDoor) {
  let best = VOID, bestScore = -1;
  for (const [sector, count] of counts) {
    const priority = sector === VOID ? 1 : isDoor(sector) ? 2 : 0;
    const score = count * 4 + priority;
    if (score > bestScore) { best = sector; bestScore = score; }
  }
  return best;
}

export function buildGrid(map, doorSectors = new Set()) {
  const bounds = mapBounds(map);
  const originX = Math.floor(bounds.minX / CELL) * CELL - PAD * CELL;
  const originY = Math.floor(bounds.minY / CELL) * CELL - PAD * CELL;
  const width = Math.ceil((bounds.maxX - originX) / CELL) + PAD;
  const height = Math.ceil((bounds.maxY - originY) / CELL) + PAD;
  const boundaries = sectorBoundaries(map);
  const isDoor = (s) => doorSectors.has(s);

  const sector = new Int16Array(width * height).fill(VOID);
  const coverage = new Map(); // sector -> [{cell, count}] for rescuing tiny sectors
  const step = CELL / SAMPLES;

  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const counts = new Map();
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = originX + cx * CELL + (sx + 0.5) * step;
          const y = originY + cy * CELL + (sy + 0.5) * step;
          const s = sectorAt(map, boundaries, x, y);
          counts.set(s, (counts.get(s) ?? 0) + 1);
        }
      }
      const cell = cy * width + cx;
      sector[cell] = chooseSector(counts, isDoor);
      for (const [s, count] of counts) {
        if (s === VOID) continue;
        if (!coverage.has(s)) coverage.set(s, []);
        coverage.get(s).push({ cell, count });
      }
    }
  }

  rescueSmallSectors(sector, coverage, map.sectors.length);
  const fence = rasteriseFences(map, { originX, originY, width, height });
  return Object.freeze({ cell: CELL, originX, originY, width, height, sector, fence });
}

// A sector narrower than half a cell can lose every cell; give it the cells it covers most.
function rescueSmallSectors(sector, coverage, sectorCount) {
  const owned = new Uint32Array(sectorCount);
  for (const s of sector) if (s >= 0) owned[s]++;
  for (const [s, cells] of coverage) {
    if (owned[s] > 0) continue;
    const max = Math.max(...cells.map((c) => c.count));
    for (const c of cells) if (c.count === max && sector[c.cell] !== VOID) sector[c.cell] = s;
  }
}

// Impassable two-sided lines (railings, windows) become fence cells.
function rasteriseFences(map, g) {
  const fence = new Uint8Array(g.width * g.height);
  for (const line of map.linedefs) {
    if (line.back < 0) continue;
    const kind = line.flags & LINE_FLAGS.BLOCKING ? FENCE.ALL : line.flags & LINE_FLAGS.BLOCK_MONSTERS ? FENCE.MONSTERS : 0;
    if (!kind) continue;
    const a = map.vertices[line.v1];
    const b = map.vertices[line.v2];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / 4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.floor((a.x + (b.x - a.x) * t - g.originX) / CELL);
      const cy = Math.floor((a.y + (b.y - a.y) * t - g.originY) / CELL);
      if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) continue;
      const cell = cy * g.width + cx;
      fence[cell] = fence[cell] === FENCE.ALL ? FENCE.ALL : kind;
    }
  }
  return fence;
}

export const cellIndex = (grid, cx, cy) =>
  cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height ? -1 : cy * grid.width + cx;

export const cellOf = (grid, x, y) => cellIndex(grid, Math.floor((x - grid.originX) / CELL), Math.floor((y - grid.originY) / CELL));

export const sectorOfPoint = (grid, x, y) => {
  const c = cellOf(grid, x, y);
  return c < 0 ? VOID : grid.sector[c];
};
