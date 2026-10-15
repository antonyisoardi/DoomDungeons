// Grid queries against the live sector state: what floor/ceiling a box sees and
// whether the cells under it can be entered.

import { CELL, VOID, FENCE } from '../../world/grid.js';

// Visit every cell overlapped by a square of half-size r centred on (x, y).
export function forEachCell(grid, x, y, r, fn) {
  const cx0 = Math.floor((x - r - grid.originX) / CELL);
  const cx1 = Math.floor((x + r - 0.001 - grid.originX) / CELL);
  const cy0 = Math.floor((y - r - grid.originY) / CELL);
  const cy1 = Math.floor((y + r - 0.001 - grid.originY) / CELL);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const inside = cx >= 0 && cy >= 0 && cx < grid.width && cy < grid.height;
      const cell = inside ? cy * grid.width + cx : -1;
      if (fn(cell, cx, cy) === false) return false;
    }
  }
  return true;
}

// Floor and ceiling a box would rest between, plus what blocks it.
// mode: 'player' | 'monster' | 'missile' | 'free'
export function boxPosition(grid, sectors, x, y, r, mode) {
  let floorz = -Infinity, ceilingz = Infinity, dropoffz = Infinity;
  let blocked = false;
  let sector = VOID;
  forEachCell(grid, x, y, r, (cell) => {
    const s = cell < 0 ? VOID : grid.sector[cell];
    if (s === VOID) { blocked = true; return mode === 'free'; }
    if (mode === 'player' || mode === 'monster') {
      const f = grid.fence[cell];
      if (f === FENCE.ALL || (f === FENCE.MONSTERS && mode === 'monster')) { blocked = true; return false; }
    }
    const sec = sectors[s];
    if (sec.floor > floorz) { floorz = sec.floor; sector = s; }
    ceilingz = Math.min(ceilingz, sec.ceiling);
    dropoffz = Math.min(dropoffz, sec.floor);
    return true;
  });
  if (floorz === -Infinity) { floorz = 0; ceilingz = 0; dropoffz = 0; }
  return { floorz, ceilingz, dropoffz, blocked, sector };
}

export function sectorIndexAt(grid, x, y) {
  const cx = Math.floor((x - grid.originX) / CELL);
  const cy = Math.floor((y - grid.originY) / CELL);
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return VOID;
  return grid.sector[cy * grid.width + cx];
}

// Walk the grid cells crossed by a segment (Amanatides-Woo DDA). fn(cell, tEnter) with t in [0, 1].
export function traceCells(grid, x0, y0, x1, y1, fn) {
  const gx0 = (x0 - grid.originX) / CELL, gy0 = (y0 - grid.originY) / CELL;
  const gx1 = (x1 - grid.originX) / CELL, gy1 = (y1 - grid.originY) / CELL;
  let cx = Math.floor(gx0), cy = Math.floor(gy0);
  const ex = Math.floor(gx1), ey = Math.floor(gy1);
  const dx = gx1 - gx0, dy = gy1 - gy0;
  const stepX = Math.sign(dx), stepY = Math.sign(dy);
  const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dy) : Infinity;
  let tMaxX = stepX > 0 ? (cx + 1 - gx0) * tDeltaX : stepX < 0 ? (gx0 - cx) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (cy + 1 - gy0) * tDeltaY : stepY < 0 ? (gy0 - cy) * tDeltaY : Infinity;
  let t = 0;
  for (let guard = 0; guard < 4096; guard++) {
    const inside = cx >= 0 && cy >= 0 && cx < grid.width && cy < grid.height;
    if (fn(inside ? cy * grid.width + cx : -1, t) === false) return false;
    if (cx === ex && cy === ey) return true;
    if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; cx += stepX; } else { t = tMaxY; tMaxY += tDeltaY; cy += stepY; }
    if (t > 1) return true;
  }
  return true;
}
