// Nightmare skill: dead monsters rise again at their spawn point (Doom's P_NightmareRespawn).

import { spawnMonster } from './spawn.js';
import { removeMobj } from './mobj.js';
import { checkMove } from './movement.js';
import { TICRATE } from '../constants.js';

const RESPAWN_AFTER = 12 * TICRATE;

export function nightmareRespawn(level, corpse) {
  corpse.deadTics = (corpse.deadTics ?? 0) + 1;
  if (corpse.deadTics < RESPAWN_AFTER || !corpse.spawnPoint) return;
  if (level.tic & 31) return;
  if (level.rng.random() > 4) return;
  const { x, y, angle, ambush } = corpse.spawnPoint;
  const probe = { ...corpse, x, y, radius: corpse.def.radius, height: corpse.def.height, player: null, corpse: false, missile: false, skullFly: false, noClip: false };
  if (!checkMove(level, probe, x, y).ok) return;
  level.spawnEffect('teleportFog', corpse.x, corpse.y, corpse.z);
  level.spawnEffect('teleportFog', x, y, corpse.floorz);
  level.emit({ type: 'sound', name: 'DSTELEPT', x, y });
  const reborn = spawnMonster(level, corpse.def, x, y, angle, ambush);
  if (reborn.countKill) level.stats.totalKills--; // respawns don't raise the kill total
  removeMobj(level, corpse);
}
