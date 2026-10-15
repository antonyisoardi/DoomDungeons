// State actions referenced by name from the info tables.

import { aLook, aChase, aFaceTarget, checkMeleeRange } from './ai.js';
import { setSequence } from './mobj.js';
import { playSound, damageMobj, radiusAttack } from './combat.js';
import { spawnMissile, missileExplodeAction, bfgSpray } from './missiles.js';
import { lineAttack } from './hitscan.js';
import { MISSILE_RANGE } from '../info/weapons.js';
import { SKULL_SPEED } from '../constants.js';

const BAM20 = (Math.PI * 2) / 4096; // (P_Random()-P_Random())<<20 in radians per unit

function bulletDamage(level) {
  return ((level.rng.random() % 5) + 1) * 3;
}

function fireBullets(level, actor, count, sound) {
  if (!actor.target) return;
  aFaceTarget(level, actor);
  playSound(level, actor, sound);
  const base = actor.angle;
  for (let i = 0; i < count; i++) {
    lineAttack(level, actor, base + level.rng.spread() * BAM20, MISSILE_RANGE, bulletDamage(level));
  }
}

function meleeOrMissile(level, actor, meleeDamage, missile, meleeSound) {
  if (!actor.target) return;
  aFaceTarget(level, actor);
  if (checkMeleeRange(level, actor)) {
    if (meleeSound) playSound(level, actor, meleeSound);
    damageMobj(level, actor.target, actor, actor, meleeDamage());
    return;
  }
  if (missile) spawnMissile(level, actor, actor.target, missile);
}

const BOSS_SPECIALS = {
  // map name -> [boss key, effect]
  E1M8: ['baron', (level) => level.triggerTagged('floor', 'lowerFloorToLowest', 666)],
  E2M8: ['cyberdemon', (level) => level.exitLevel('normal')],
  E3M8: ['spiderMastermind', (level) => level.exitLevel('normal')],
  E4M6: ['cyberdemon', (level) => level.triggerTagged('door', 'blazeOpen', 666)],
  E4M8: ['spiderMastermind', (level) => level.triggerTagged('floor', 'lowerFloorToLowest', 666)],
};

function bossDeath(level, actor) {
  const rule = BOSS_SPECIALS[level.mapName];
  if (!rule || rule[0] !== actor.def.key) return;
  if (!level.playerMobj || level.playerMobj.health <= 0) return;
  const othersAlive = level.mobjs.some((m) => m !== actor && m.def.key === actor.def.key && m.health > 0 && !m.removed);
  if (!othersAlive) rule[1](level);
}

export const ACTIONS = Object.freeze({
  look: aLook,
  chase: aChase,
  faceTarget: aFaceTarget,
  pain: (level, a) => playSound(level, a, a.player ? 'DSPLPAIN' : a.def.sounds?.pain),
  scream: (level, a) => {
    const sound = a.def.sounds?.death;
    if (!sound) return;
    if (a.def.key === 'cyberdemon' || a.def.key === 'spiderMastermind') {
      level.emit({ type: 'sound', name: sound, global: true });
    } else playSound(level, a, sound);
  },
  playerScream: (level, a) => playSound(level, a, a.health < -50 ? 'DSPDIEHI' : 'DSPLDETH'),
  xScream: (level, a) => playSound(level, a, 'DSSLOP'),
  fall: (level, a) => { a.solid = false; },
  posAttack: (level, a) => fireBullets(level, a, 1, 'DSPISTOL'),
  sPosAttack: (level, a) => fireBullets(level, a, 3, 'DSSHOTGN'),
  troopAttack: (level, a) => meleeOrMissile(level, a, () => ((level.rng.random() % 8) + 1) * 3, 'impBall', 'DSCLAW'),
  sargAttack: (level, a) => meleeOrMissile(level, a, () => ((level.rng.random() % 10) + 1) * 4, null, null),
  headAttack: (level, a) => meleeOrMissile(level, a, () => ((level.rng.random() % 6) + 1) * 10, 'cacoBall', null),
  bruisAttack: (level, a) => meleeOrMissile(level, a, () => ((level.rng.random() % 8) + 1) * 10, 'baronBall', 'DSCLAW'),
  cyberAttack: (level, a) => {
    if (!a.target) return;
    aFaceTarget(level, a);
    spawnMissile(level, a, a.target, 'rocket');
  },
  skullAttack: (level, a) => {
    const t = a.target;
    if (!t) return;
    a.skullFly = true;
    playSound(level, a, a.def.sounds?.attack);
    aFaceTarget(level, a);
    a.momX = Math.cos(a.angle) * SKULL_SPEED;
    a.momY = Math.sin(a.angle) * SKULL_SPEED;
    const dist = Math.max(1, Math.hypot(t.x - a.x, t.y - a.y) / SKULL_SPEED);
    a.momZ = (t.z + t.height / 2 - a.z) / dist;
  },
  spidRefire: (level, a) => {
    aFaceTarget(level, a);
    if (level.rng.random() < 10) return;
    const t = a.target;
    if (!t || t.health <= 0 || !level.checkSight(a, t)) setSequence(level, a, 'see');
  },
  hoof: (level, a) => { playSound(level, a, 'DSHOOF'); aChase(level, a); },
  metal: (level, a) => { playSound(level, a, 'DSMETAL'); aChase(level, a); },
  bossDeath,
  explode: (level, a) => {
    if (a.def.splash) missileExplodeAction(level, a);
    else radiusAttack(level, a, a.target ?? a, 128);
  },
  bfgSpray,
});
