// Sector specials: light effects spawned at level start, damaging floors and secrets.

import { SECTOR_SPECIALS as S } from '../../specials/table.js';
import { spawnLightFlash, spawnStrobeFlash, spawnGlowingLight, spawnFireFlicker, FAST_DARK, SLOW_DARK } from './lights.js';
import { spawnDoorCloseIn30, spawnDoorRaiseIn5Mins } from './doors.js';
import { damageMobj } from '../combat.js';

export function spawnSectorSpecials(level) {
  for (const sec of level.sectors) {
    const s = sec.index;
    switch (sec.special) {
      case S.LIGHT_BLINK_RANDOM: spawnLightFlash(level, s); break;
      case S.LIGHT_BLINK_HALF: spawnStrobeFlash(level, s, FAST_DARK, false); break;
      case S.LIGHT_BLINK_ONE: spawnStrobeFlash(level, s, SLOW_DARK, false); break;
      case S.DAMAGE_20_STROBE: spawnStrobeFlash(level, s, FAST_DARK, false); break;
      case S.LIGHT_GLOW: spawnGlowingLight(level, s); break;
      case S.SECRET: level.stats.totalSecrets++; break;
      case S.DOOR_CLOSE_30: spawnDoorCloseIn30(level, s); break;
      case S.LIGHT_SYNC_ONE: spawnStrobeFlash(level, s, SLOW_DARK, true); break;
      case S.LIGHT_SYNC_HALF: spawnStrobeFlash(level, s, FAST_DARK, true); break;
      case S.DOOR_RAISE_5MIN: spawnDoorRaiseIn5Mins(level, s); break;
      case S.LIGHT_FLICKER: spawnFireFlicker(level, s); break;
      default: break;
    }
  }
}

// Doom's P_PlayerInSpecialSector: called each tic while the player stands on the floor.
export function playerInSpecialSector(level, mobj) {
  const s = level.sectorOf(mobj);
  if (s < 0) return;
  const sec = level.sectors[s];
  if (mobj.z > sec.floor + 0.5) return;
  const player = mobj.player;
  const everyHalfSecond = (level.tic & 31) === 0;
  const suit = player.powers.radsuit > 0;
  switch (sec.special) {
    case S.DAMAGE_10:
      if (!suit && everyHalfSecond) damageMobj(level, mobj, null, null, 10);
      break;
    case S.DAMAGE_5:
      if (!suit && everyHalfSecond) damageMobj(level, mobj, null, null, 5);
      break;
    case S.DAMAGE_20:
    case S.DAMAGE_20_STROBE:
      if ((!suit || level.rng.random() < 5) && everyHalfSecond) damageMobj(level, mobj, null, null, 20);
      break;
    case S.SECRET:
      level.stats.secrets++;
      sec.special = 0;
      level.message('A secret is revealed!', 'secret');
      level.emit({ type: 'sound', name: 'DSGETPOW', global: true });
      break;
    case S.DAMAGE_20_EXIT:
      player.powers.invulnerability = 0; // cheats off, as in Doom
      if (everyHalfSecond) damageMobj(level, mobj, null, null, 20);
      if (player.health <= 10) level.exitLevel('normal');
      break;
    default: break;
  }
}
