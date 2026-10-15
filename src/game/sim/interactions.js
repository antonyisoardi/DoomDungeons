// How things interact with lines and items: walking over triggers, using
// switches and doors, shooting trigger lines, picking items up, and noise.

import { activateLine, pointOnLineSide } from './specials/lines.js';
import { lineSpecial } from '../specials/table.js';
import { giveItem, pickupMessage, pickupSound } from './pickups.js';
import { removeMobj } from './mobj.js';
import { USE_RANGE } from '../constants.js';
import { LINE_FLAGS } from '../../wad/map.js';
import { PASSABLE_GAP } from '../../world/style.js';

const triggerOf = (line) => lineSpecial(line.special)?.trigger;

export function crossLines(level, mobj, x0, y0, x1, y1) {
  const moved = Math.hypot(x1 - x0, y1 - y0);
  for (const line of level.lineIndex.near(x1, y1, mobj.radius + moved + 8)) {
    if (!line.special || triggerOf(line) !== 'W') continue;
    const before = pointOnLineSide(level.map, line, x0, y0);
    const after = pointOnLineSide(level.map, line, x1, y1);
    if (before === after) continue;
    if (level.lineIndex.distance(line, x1, y1) > mobj.radius + moved + 1) continue;
    activateLine(level, line, mobj, 'walk', before);
  }
}

function facingScore(level, mobj, line) {
  const a = level.map.vertices[line.v1], b = level.map.vertices[line.v2];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const toLine = Math.atan2(my - mobj.y, mx - mobj.x);
  return Math.cos(toLine - mobj.angle);
}

// Nearest usable special line in front of the player within reach.
function findUseLine(level, mobj, reach, filter) {
  let best = null, bestScore = Infinity;
  for (const line of level.lineIndex.near(mobj.x, mobj.y, reach + 32)) {
    if (!filter(line)) continue;
    const d = level.lineIndex.distance(line, mobj.x, mobj.y);
    if (d > reach) continue;
    if (pointOnLineSide(level.map, line, mobj.x, mobj.y) !== 0) continue;
    const score = d - 24 * facingScore(level, mobj, line);
    if (score < bestScore) { best = line; bestScore = score; }
  }
  return best;
}

export function playerUse(level, mobj) {
  const usable = (line) => line.special && ['S', 'D'].includes(triggerOf(line));
  const line = findUseLine(level, mobj, USE_RANGE + mobj.radius / 2, usable);
  if (line) {
    activateLine(level, line, mobj, 'use', 0);
    return;
  }
  level.emit({ type: 'sound', name: 'DSNOWAY', x: mobj.x, y: mobj.y });
}

// Walking into a manual door opens it (no need to press use).
export function bumpDoors(level, mobj) {
  const closedDoor = (line) => {
    if (!line.special || triggerOf(line) !== 'D' || line.backSector < 0) return false;
    const sec = level.sectors[line.backSector];
    if (sec.mover && sec.mover.direction !== -1) return false;
    return sec.ceiling - sec.floor < PASSABLE_GAP;
  };
  const line = findUseLine(level, mobj, mobj.radius + 20, closedDoor);
  if (!line) return;
  const sp = lineSpecial(line.special);
  if (sp.key && !mobj.player.keys.has(sp.key)) {
    if (level.tic - (mobj.player.lockedMessageTic ?? -999) < 70) return;
    mobj.player.lockedMessageTic = level.tic;
  }
  activateLine(level, line, mobj, 'use', 0);
}

export function monsterUseDoors(level, actor, x, y) {
  let opened = false;
  for (const line of level.lineIndex.near(x, y, actor.radius + 16)) {
    if (!line.special || triggerOf(line) !== 'D') continue;
    if (level.lineIndex.distance(line, x, y) > actor.radius + 8) continue;
    const side = pointOnLineSide(level.map, line, actor.x, actor.y);
    if (activateLine(level, line, actor, 'use', side)) opened = true;
  }
  return opened;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (d === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function shootLines(level, shooter, x0, y0, x1, y1) {
  if (!shooter) return;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (const line of level.lineIndex.near(mx, my, Math.hypot(x1 - x0, y1 - y0) / 2 + 8)) {
    if (!line.special || triggerOf(line) !== 'G') continue;
    const a = level.map.vertices[line.v1], b = level.map.vertices[line.v2];
    if (!segmentsCross(x0, y0, x1, y1, a.x, a.y, b.x, b.y)) continue;
    activateLine(level, line, shooter, 'shoot', pointOnLineSide(level.map, line, x0, y0));
  }
}

export function touchItems(level, mobj) {
  const player = mobj.player;
  if (!player || player.dead) return;
  const r = mobj.radius;
  const items = [];
  level.blockmap.each(mobj.x - r, mobj.y - r, mobj.x + r, mobj.y + r, (m) => {
    if (m.kind !== 'pickup' || m.removed) return true;
    const reach = m.radius + r;
    if (Math.abs(m.x - mobj.x) >= reach || Math.abs(m.y - mobj.y) >= reach) return true;
    if (m.z > mobj.z + mobj.height || m.z < mobj.z - 8) return true;
    items.push(m);
    return true;
  });
  for (const item of items) {
    if (!giveItem(level, mobj, item)) continue;
    if (item.countItem) level.stats.items++;
    player.bonusCount = Math.min(player.bonusCount + 6, 18);
    level.message(pickupMessage(item, player), 'pickup');
    level.emit({ type: 'sound', name: pickupSound(item), global: true });
    removeMobj(level, item);
  }
}

// Doom's P_NoiseAlert: flood sound through open sectors; two sound-blocking lines stop it.
export function noiseAlert(level, emitter) {
  const start = level.sectorOf(emitter);
  if (start < 0) return;
  const reached = new Map(); // sector -> soundblocks + 1
  const stack = [[start, 0]];
  while (stack.length) {
    const [s, blocks] = stack.pop();
    if (reached.has(s) && reached.get(s) <= blocks + 1) continue;
    reached.set(s, blocks + 1);
    level.sectors[s].soundTarget = emitter;
    for (const line of level.sectorLines[s]) {
      if (line.back < 0) continue;
      const other = line.frontSector === s ? line.backSector : line.frontSector;
      if (other < 0) continue;
      const a = level.sectors[s], b = level.sectors[other];
      if (Math.min(a.ceiling, b.ceiling) - Math.max(a.floor, b.floor) <= 0) continue;
      if (line.flags & LINE_FLAGS.BLOCK_SOUND) {
        if (blocks === 0) stack.push([other, 1]);
      } else stack.push([other, blocks]);
    }
  }
}
