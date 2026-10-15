// Instant-hit attacks: bullets, shotgun pellets, punches, chainsaw (Doom's P_LineAttack).
// Vertical aim is automatic as in Doom; walls and ledges still stop shots.

import { traceCells } from './world.js';
import { VOID } from '../../world/grid.js';

function rayHitsBox(x0, y0, dirX, dirY, range, m) {
  // Slab test against the thing's square bounding box.
  let tMin = 0, tMax = range;
  for (const [o, d, c] of [[x0, dirX, m.x], [y0, dirY, m.y]]) {
    if (Math.abs(d) < 1e-9) {
      if (o < c - m.radius || o > c + m.radius) return null;
      continue;
    }
    let t1 = (c - m.radius - o) / d, t2 = (c + m.radius - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

// Distance along the ray to the first wall/ledge that blocks a shot travelling from z0 to z1.
function wallDistance(level, x0, y0, dirX, dirY, range, z0, z1) {
  const { grid, sectors } = level;
  let hit = range;
  traceCells(grid, x0, y0, x0 + dirX * range, y0 + dirY * range, (cell, t) => {
    const d = t * range;
    if (d < 4) return true;
    const s = cell < 0 ? VOID : grid.sector[cell];
    const z = z0 + (z1 - z0) * (d / range);
    if (s === VOID || sectors[s].floor > z || sectors[s].ceiling < z || sectors[s].ceiling <= sectors[s].floor) {
      hit = Math.max(0, d - 2);
      return false;
    }
    return true;
  });
  return hit;
}

// Returns { target, x, y, z, distance } (target null for a wall/air hit).
export function traceAttack(level, shooter, angle, range) {
  const dirX = Math.cos(angle), dirY = Math.sin(angle);
  const shotZ = shooter.z + shooter.height / 2 + 8;
  const candidates = [];
  level.blockmap.each(
    Math.min(shooter.x, shooter.x + dirX * range), Math.min(shooter.y, shooter.y + dirY * range),
    Math.max(shooter.x, shooter.x + dirX * range), Math.max(shooter.y, shooter.y + dirY * range),
    (m) => {
      if (m === shooter || m.removed || !m.shootable) return true;
      const t = rayHitsBox(shooter.x, shooter.y, dirX, dirY, range, m);
      if (t !== null) candidates.push({ m, t });
      return true;
    },
  );
  candidates.sort((a, b) => a.t - b.t);
  for (const { m, t } of candidates) {
    const aimZ = m.z + m.height / 2;
    if (wallDistance(level, shooter.x, shooter.y, dirX, dirY, t, shotZ, aimZ) >= t - 1) {
      return { target: m, x: shooter.x + dirX * t, y: shooter.y + dirY * t, z: aimZ, distance: t };
    }
  }
  const d = wallDistance(level, shooter.x, shooter.y, dirX, dirY, range, shotZ, shotZ);
  return { target: null, x: shooter.x + dirX * d, y: shooter.y + dirY * d, z: shotZ, distance: d, wall: d < range };
}

// Hitscan attack with damage and effects. Shoot-trigger lines fire if the shot crosses them.
export function lineAttack(level, shooter, angle, range, damage) {
  const hit = traceAttack(level, shooter, angle, range);
  level.shootLines(shooter, shooter.x, shooter.y, hit.x, hit.y);
  if (hit.target) {
    const bleeds = hit.target.kind === 'monster' || hit.target.kind === 'player';
    level.spawnEffect(bleeds ? 'blood' : 'puff', hit.x - Math.cos(angle) * 4, hit.y - Math.sin(angle) * 4, hit.z);
    level.damage(hit.target, shooter, shooter, damage);
  } else if (hit.wall) {
    level.spawnEffect('puff', hit.x, hit.y, hit.z);
  }
  return hit;
}

// Doom's P_AimLineAttack horizontal assist: nearest visible shootable target close to the aim line.
export function aimAssist(level, shooter, angle, range, cone) {
  let best = null, bestScore = Infinity;
  level.blockmap.each(shooter.x - range, shooter.y - range, shooter.x + range, shooter.y + range, (m) => {
    if (m === shooter || m.removed || !m.shootable || m.kind === 'barrel' || m.health <= 0) return true;
    const dx = m.x - shooter.x, dy = m.y - shooter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 1) return true;
    let diff = Math.atan2(dy, dx) - angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const allowed = cone + Math.atan2(m.radius, dist);
    if (Math.abs(diff) > allowed) return true;
    const score = Math.abs(diff) * 400 + dist * 0.2;
    if (score < bestScore && level.checkSight(shooter, m)) { best = m; bestScore = score; }
    return true;
  });
  return best ? Math.atan2(best.y - shooter.y, best.x - shooter.x) : angle;
}
