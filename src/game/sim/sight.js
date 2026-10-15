// Line of sight through the grid with Doom-style top/bottom slope clipping.

import { traceCells } from './world.js';
import { VOID } from '../../world/grid.js';

export function checkSight(level, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const eye = from.z + from.height * 0.75;
  let top = (to.z + to.height - eye) / dist;
  let bottom = (to.z - eye) / dist;
  const { grid, sectors } = level;

  return traceCells(grid, from.x, from.y, to.x, to.y, (cell, t) => {
    const d = t * dist;
    if (d < 8 || dist - d < 8) return true; // own cells and target's cells
    const s = cell < 0 ? VOID : grid.sector[cell];
    if (s === VOID) return false;
    const sec = sectors[s];
    if (sec.ceiling <= sec.floor) return false;
    top = Math.min(top, (sec.ceiling - eye) / d);
    bottom = Math.max(bottom, (sec.floor - eye) / d);
    return bottom < top;
  });
}

// Is the target in the 180 degree arc in front of the looker?
export function inFront(looker, target) {
  const a = Math.atan2(target.y - looker.y, target.x - looker.x) - looker.angle;
  return Math.cos(a) >= 0;
}
