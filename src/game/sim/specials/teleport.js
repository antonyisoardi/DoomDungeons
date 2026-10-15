// Teleporters (Doom's EV_Teleport / P_TeleportMove).

import { sectorsWithTag } from './sectors.js';
import { damageMobj } from '../combat.js';

const PLAYER_FREEZE_TICS = 18;

function stompOrBlocked(level, mobj, x, y) {
  const victims = [];
  level.blockmap.each(x - mobj.radius, y - mobj.radius, x + mobj.radius, y + mobj.radius, (other) => {
    if (other === mobj || other.removed || !other.shootable) return true;
    const reach = other.radius + mobj.radius;
    if (Math.abs(other.x - x) < reach && Math.abs(other.y - y) < reach) victims.push(other);
    return true;
  });
  if (victims.length && !mobj.player) return false; // only players telefrag
  for (const v of victims) damageMobj(level, v, mobj, mobj, 10000);
  return true;
}

export function teleport(level, line, side, mobj, monstersOnly) {
  if (!mobj || mobj.missile) return false;
  if (side === 1) return false; // only from the front, so you can walk back out
  if (monstersOnly && mobj.player) return false;
  const tagged = new Set(sectorsWithTag(level, line.tag));
  const dest = level.mobjs.find((m) => m.kind === 'teleportDest' && tagged.has(level.sectorOf(m)));
  if (!dest) return false;

  const oldX = mobj.x, oldY = mobj.y, oldZ = mobj.z;
  if (!stompOrBlocked(level, mobj, dest.x, dest.y)) return false;
  mobj.x = dest.x;
  mobj.y = dest.y;
  const pos = level.position(mobj, dest.x, dest.y);
  mobj.floorz = pos.floorz;
  mobj.ceilingz = pos.ceilingz;
  mobj.z = pos.floorz;
  mobj.prevX = mobj.x; mobj.prevY = mobj.y; mobj.prevZ = mobj.z;
  level.blockmap.relink(mobj);

  level.spawnEffect('teleportFog', oldX, oldY, oldZ);
  level.spawnEffect('teleportFog', dest.x + 20 * Math.cos(dest.angle), dest.y + 20 * Math.sin(dest.angle), mobj.z);
  level.emit({ type: 'sound', name: 'DSTELEPT', x: dest.x, y: dest.y });
  if (mobj.player) {
    mobj.player.freezeTics = PLAYER_FREEZE_TICS;
    level.emit({ type: 'teleported' });
  }
  mobj.momX = mobj.momY = mobj.momZ = 0;
  mobj.angle = dest.angle;
  return true;
}
