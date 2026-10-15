// Projectiles (Doom's P_SpawnMissile, P_ExplodeMissile, missile collision).

import { createMobj, setSequence, removeMobj } from './mobj.js';
import { PROJECTILES } from '../info/projectiles.js';
import { xyMovement, zMovement } from './movement.js';
import { damageMobj, radiusAttack, playSound } from './combat.js';

// Doom's -fast / Nightmare missile speeds.
const FAST_MISSILES = new Set(['impBall', 'cacoBall', 'baronBall']);

function launch(level, source, type, angle, slope) {
  const def = PROJECTILES[type];
  const z = source.z + 32;
  const m = createMobj(level, def, 'missile', source.x, source.y, z, {
    missile: true, noGravity: true, source, angle,
  });
  const speed = level.fast && FAST_MISSILES.has(type) ? 20 : def.speed;
  m.momX = Math.cos(angle) * speed;
  m.momY = Math.sin(angle) * speed;
  m.momZ = slope * speed;
  setSequence(level, m, 'spawn');
  playSound(level, m, def.seeSound);
  // Doom's P_CheckMissileSpawn: nudge forward and explode at once if inside a wall.
  m.x += m.momX / 2;
  m.y += m.momY / 2;
  m.z += m.momZ / 2;
  const pos = level.position(m, m.x, m.y);
  m.floorz = pos.floorz;
  m.ceilingz = pos.ceilingz;
  if (pos.blocked || m.z < pos.floorz || m.z + m.height > pos.ceilingz) explodeMissile(level, m);
  return m;
}

// Monster missile aimed at its target (with the shadow wobble against invisible players).
export function spawnMissile(level, source, target, type) {
  let angle = Math.atan2(target.y - source.y, target.x - source.x);
  if (target.shadow || target.player?.powers.invisibility > 0) angle += (level.rng.spread() / 256) * (Math.PI / 4);
  const dist = Math.max(1, Math.hypot(target.x - source.x, target.y - source.y));
  const slope = (target.z + target.height / 2 - (source.z + 32)) / dist;
  return launch(level, source, type, angle, slope);
}

// Player missiles fly where the player aims; vertical aim tracks the targeted thing.
export function spawnPlayerMissile(level, source, angle, aimTarget, type) {
  let slope = 0;
  if (aimTarget) {
    const dist = Math.max(1, Math.hypot(aimTarget.x - source.x, aimTarget.y - source.y));
    slope = (aimTarget.z + aimTarget.height / 2 - (source.z + 32)) / dist;
  }
  return launch(level, source, type, angle, slope);
}

export function explodeMissile(level, m) {
  if (!m.missile) return;
  m.momX = m.momY = m.momZ = 0;
  m.missile = false;
  m.noClip = true;
  playSound(level, m, m.def.deathSound);
  setSequence(level, m, 'death');
  if (!m.removed && m.tics > 0) m.tics = Math.max(1, m.tics - (level.rng.random() & 3));
}

export function missileHitDamage(level, m) {
  return ((level.rng.random() % 8) + 1) * m.def.damage;
}

// One tic of missile flight.
export function missileThink(level, m) {
  const startX = m.x, startY = m.y;
  const blocked = xyMovement(level, m);
  if (m.removed) return;
  if (blocked) {
    if (blocked.blocker && blocked.blocker.shootable) {
      damageMobj(level, blocked.blocker, m, m.source, missileHitDamage(level, m));
    } else if (blocked.reason === 'height' && isSkyHit(level, m, blocked)) {
      removeMobj(level, m); // Doom: missiles vanish into the sky
      return;
    }
    level.shootLines(m.source, startX, startY, m.x, m.y);
    explodeMissile(level, m);
    return;
  }
  if (zMovement(level, m)) explodeMissile(level, m);
}

function isSkyHit(level, m, result) {
  const sector = level.sectors[result.sector];
  return sector && sector.ceilingFlat === 'F_SKY1' && m.z + m.height > result.ceilingz - 2;
}

export function missileExplodeAction(level, m) {
  radiusAttack(level, m, m.source, m.def.splash ?? 128);
}

// BFG: 40 invisible tracers fanning out from the shooter's facing.
export function bfgSpray(level, m) {
  const shooter = m.source;
  if (!shooter) return;
  for (let i = 0; i < 40; i++) {
    const angle = shooter.angle - Math.PI / 4 + (Math.PI / 2 / 40) * i;
    const hit = level.traceAttack(shooter, angle, 1024);
    if (!hit.target) continue;
    level.spawnEffect('bfgFlash', hit.target.x, hit.target.y, hit.target.z + hit.target.height / 4);
    let damage = 0;
    for (let j = 0; j < 15; j++) damage += (level.rng.random() & 7) + 1;
    damageMobj(level, hit.target, shooter, shooter, damage);
  }
}
