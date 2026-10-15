// Spawning map things by their editor number, filtered by skill.

import { createMobj, setSequence } from './mobj.js';
import { MONSTER_BY_DOOMEDNUM } from '../info/monsters.js';
import { THING_BY_DOOMEDNUM, PLAYER_START, TELEPORT_DEST } from '../info/things.js';
import { EFFECTS, BARREL_STATES, BARREL_DEATH_SPRITE } from '../info/projectiles.js';
import { THING_FLAGS } from '../../wad/map.js';
import { SKILL, toRadians } from '../constants.js';
import { PLAYER_DEF } from './player.js';

const BARREL_DEF = Object.freeze({ ...THING_BY_DOOMEDNUM.get(2035), states: BARREL_STATES, deathSprite: BARREL_DEATH_SPRITE, mass: 100 });
const TELEPORT_DEST_DEF = Object.freeze({ sprite: null, radius: 1, height: 1 });

export function skillBit(skill) {
  if (skill <= SKILL.EASY) return THING_FLAGS.EASY;
  if (skill === SKILL.MEDIUM) return THING_FLAGS.MEDIUM;
  return THING_FLAGS.HARD;
}

export function spawnMonster(level, def, x, y, angle, ambush) {
  const m = createMobj(level, def, 'monster', x, y, null, {
    solid: true, shootable: true, countKill: def.countKill !== false, ambush, angle,
    spawnPoint: { x, y, angle, ambush },
  });
  if (m.countKill) level.stats.totalKills++;
  setSequence(level, m, 'spawn');
  if (m.tics > 0) m.tics = 1 + (level.rng.random() % m.tics);
  return m;
}

export function spawnThing(level, def, x, y, opts = {}) {
  if (def.kind === 'barrel') {
    const m = createMobj(level, BARREL_DEF, 'barrel', x, y, null, { solid: true, shootable: true, ...opts });
    setSequence(level, m, 'spawn');
    return m;
  }
  const m = createMobj(level, def, def.kind, x, y, null, {
    solid: !!def.solid, hanging: !!def.hanging, noGravity: !!def.hanging, ...opts,
  });
  m.frame = def.frames ? def.frames[0] : 'A';
  m.bright = !!def.bright;
  if (def.kind === 'pickup' && def.countItem) level.stats.totalItems++;
  return m;
}

export function spawnEffect(level, name, x, y, z) {
  const def = EFFECTS[name];
  if (!def) return null;
  const m = createMobj(level, def, 'effect', x, y, z, { noClip: true, noGravity: true });
  if (name === 'puff' || name === 'smoke') m.momZ = 1;
  setSequence(level, m, 'spawn');
  if (name === 'blood' && m.tics > 0) m.tics = Math.max(1, m.tics - (level.rng.random() & 3));
  return m;
}

export function spawnPlayer(level, start, player) {
  const m = createMobj(level, PLAYER_DEF, 'player', start.x, start.y, null, {
    solid: true, shootable: true, player, angle: toRadians(start.angle),
  });
  m.health = player.health;
  player.input.aimAngle = m.angle;
  setSequence(level, m, 'spawn');
  return m;
}

// Spawn everything in the map for the current skill. Returns the player mobj.
export function spawnMapThings(level, things, player) {
  const bit = skillBit(level.skill);
  let playerMobj = null;
  const unknown = new Set();
  for (const t of things) {
    if (t.type === PLAYER_START) {
      playerMobj ??= spawnPlayer(level, t, player);
      continue;
    }
    if (t.flags & THING_FLAGS.MULTIPLAYER) continue;
    if (!(t.flags & bit)) continue;
    if (t.type === TELEPORT_DEST) {
      createMobj(level, TELEPORT_DEST_DEF, 'teleportDest', t.x, t.y, null, { noClip: true, angle: toRadians(t.angle) });
      continue;
    }
    const monster = MONSTER_BY_DOOMEDNUM.get(t.type);
    if (monster) {
      spawnMonster(level, monster, t.x, t.y, toRadians(t.angle), !!(t.flags & THING_FLAGS.AMBUSH));
      continue;
    }
    const def = THING_BY_DOOMEDNUM.get(t.type);
    if (def) {
      const m = spawnThing(level, def, t.x, t.y);
      m.angle = toRadians(t.angle);
      continue;
    }
    if (t.type > 4 && t.type !== 11) unknown.add(t.type);
  }
  if (unknown.size) console.info('DoomDungeons: skipped unknown thing types', [...unknown].join(', '));
  if (!playerMobj) throw new Error('Map has no player 1 start');
  return playerMobj;
}
