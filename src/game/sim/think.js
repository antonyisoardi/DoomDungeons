// Per-tic update for each kind of map object (Doom's P_MobjThinker).

import { xyMovement, zMovement } from './movement.js';
import { tickState, tickAnimation, setSequence } from './mobj.js';
import { missileThink } from './missiles.js';
import { playerThink } from './player.js';
import { damageMobj } from './combat.js';
import { nightmareRespawn } from './respawn.js';

function physics(level, m) {
  if (m.momX || m.momY) xyMovement(level, m);
  if (m.removed) return;
  if (m.z !== m.floorz || m.momZ) zMovement(level, m);
}

function skullFlight(level, m) {
  const blocked = xyMovement(level, m);
  if (blocked) {
    if (blocked.blocker?.shootable) damageMobj(level, blocked.blocker, m, m, ((level.rng.random() % 8) + 1) * m.def.damage);
    m.skullFly = false;
    m.momX = m.momY = m.momZ = 0;
    setSequence(level, m, 'spawn');
    return;
  }
  zMovement(level, m);
}

export function thinkMobj(level, m) {
  switch (m.kind) {
    case 'player': {
      playerThink(level, m);
      const blocked = (m.momX || m.momY) ? xyMovement(level, m) : null;
      if (blocked && !m.player.dead) level.bumpDoors(m);
      if (m.z !== m.floorz || m.momZ) zMovement(level, m);
      tickState(level, m);
      return;
    }
    case 'monster':
      if (m.skullFly) skullFlight(level, m);
      else physics(level, m);
      if (!m.removed) tickState(level, m);
      if (m.corpse && level.fast && !m.removed) nightmareRespawn(level, m);
      return;
    case 'missile':
      if (m.missile) missileThink(level, m);
      if (!m.removed) tickState(level, m);
      return;
    case 'barrel':
      physics(level, m);
      if (!m.removed) tickState(level, m);
      return;
    case 'effect':
      m.z += m.momZ;
      tickState(level, m);
      return;
    case 'pickup':
    case 'decor':
      if (m.momX || m.momY || m.momZ || m.z !== m.floorz) {
        if (!m.def.hanging) physics(level, m);
      }
      tickAnimation(m);
      return;
    default:
      return;
  }
}
