// Monster thinking, ported from Doom's p_enemy.c (A_Look, A_Chase, P_NewChaseDir, P_Move).

import { setSequence } from './mobj.js';
import { tryMove } from './movement.js';
import { playSound } from './combat.js';
import { inFront } from './sight.js';
import { SKILL, approxDistance, FLOAT_SPEED } from '../constants.js';
import { MELEE_RANGE } from '../info/weapons.js';

export const DIRS = 8; // east, NE, north, NW, west, SW, south, SE; 8 = none
const NODIR = 8;
const DIR_X = [1, 0.7071, 0, -0.7071, -1, -0.7071, 0, 0.7071];
const DIR_Y = [0, 0.7071, 1, 0.7071, 0, -0.7071, -1, -0.7071];
const OPPOSITE = [4, 5, 6, 7, 0, 1, 2, 3, NODIR];
const DIAGONALS = [[3, 1], [5, 7]]; // [dy>0][dx<0 ? 0 : 1] -> NW/NE, SW/SE

function targetAlive(t) {
  return t && !t.removed && t.shootable && t.health > 0;
}

export function lookForPlayer(level, actor, allAround) {
  const player = level.playerMobj;
  if (!player || player.health <= 0 || player.player?.dead) return false;
  if (!level.checkSight(actor, player)) return false;
  if (!allAround && !inFront(actor, player)) {
    if (approxDistance(player.x - actor.x, player.y - actor.y) > MELEE_RANGE) return false;
  }
  actor.target = player;
  return true;
}

export function aLook(level, actor) {
  actor.threshold = 0;
  const heard = level.sectors[level.sectorOf(actor)]?.soundTarget;
  let found = false;
  if (heard && heard.shootable && !(actor.ambush && !level.checkSight(actor, heard))) {
    actor.target = heard;
    found = true;
  } else {
    found = lookForPlayer(level, actor, false);
  }
  if (!found) return;
  const see = actor.def.sounds?.see;
  if (see) {
    // Bosses roar at full volume everywhere.
    if (actor.def.boss) level.emit({ type: 'sound', name: Array.isArray(see) ? see[0] : see, global: true });
    else playSound(level, actor, see);
  }
  setSequence(level, actor, 'see');
}

export function checkMeleeRange(level, actor) {
  const t = actor.target;
  if (!targetAlive(t)) return false;
  const dist = approxDistance(t.x - actor.x, t.y - actor.y);
  if (dist >= MELEE_RANGE - 20 + t.radius) return false;
  return level.checkSight(actor, t);
}

export function checkMissileRange(level, actor) {
  const t = actor.target;
  if (!level.checkSight(actor, t)) return false;
  if (actor.justHit) {
    actor.justHit = false; // just got hit: fight back
    return true;
  }
  if (actor.reactionTime) return false;
  let dist = approxDistance(actor.x - t.x, actor.y - t.y) - 64;
  if (!actor.def.states.melee) dist -= 128;
  const key = actor.def.key;
  if (key === 'cyberdemon' || key === 'spiderMastermind' || key === 'lostSoul') dist /= 2;
  dist = Math.min(dist, key === 'cyberdemon' ? 160 : 200);
  return level.rng.random() >= dist;
}

// Step once in moveDir. Returns false if blocked (Doom's P_Move).
export function monsterMove(level, actor) {
  if (actor.moveDir === NODIR) return false;
  const speed = actor.def.speed;
  const nx = actor.x + DIR_X[actor.moveDir] * speed;
  const ny = actor.y + DIR_Y[actor.moveDir] * speed;
  const result = tryMove(level, actor, nx, ny);
  if (result.ok) {
    if (!actor.float) actor.z = actor.floorz;
    return true;
  }
  if (actor.float && result.reason === 'height') {
    actor.z += actor.z < result.floorz ? FLOAT_SPEED : -FLOAT_SPEED;
    return true;
  }
  // Monsters open plain doors they bump into.
  return level.monsterUseDoors(actor, nx, ny);
}

function tryWalk(level, actor) {
  if (!monsterMove(level, actor)) return false;
  actor.moveCount = level.rng.random() & 15;
  return true;
}

export function newChaseDir(level, actor) {
  const t = actor.target;
  if (!t) return;
  const oldDir = actor.moveDir;
  const turnaround = OPPOSITE[oldDir];
  const dx = t.x - actor.x, dy = t.y - actor.y;
  const d1 = dx > 10 ? 0 : dx < -10 ? 4 : NODIR;
  const d2 = dy < -10 ? 6 : dy > 10 ? 2 : NODIR;

  // Diagonal toward the target first.
  if (d1 !== NODIR && d2 !== NODIR) {
    actor.moveDir = DIAGONALS[dy < 0 ? 1 : 0][dx > 0 ? 1 : 0];
    if (actor.moveDir !== turnaround && tryWalk(level, actor)) return;
  }

  let a = d1, b = d2;
  if (level.rng.random() > 200 || Math.abs(dy) > Math.abs(dx)) [a, b] = [b, a];
  if (a === turnaround) a = NODIR;
  if (b === turnaround) b = NODIR;
  for (const dir of [a, b]) {
    if (dir === NODIR) continue;
    actor.moveDir = dir;
    if (tryWalk(level, actor)) return;
  }

  if (oldDir !== NODIR) {
    actor.moveDir = oldDir;
    if (tryWalk(level, actor)) return;
  }

  // Search all directions, randomly clockwise or counter-clockwise.
  const order = level.rng.random() & 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  for (const dir of order) {
    if (dir === turnaround) continue;
    actor.moveDir = dir;
    if (tryWalk(level, actor)) return;
  }
  if (turnaround !== NODIR) {
    actor.moveDir = turnaround;
    if (tryWalk(level, actor)) return;
  }
  actor.moveDir = NODIR;
}

function turnTowardMoveDir(actor) {
  if (actor.moveDir >= DIRS) return;
  const target = (actor.moveDir * Math.PI) / 4;
  let delta = Math.atan2(Math.sin(target - actor.angle), Math.cos(target - actor.angle));
  const step = Math.PI / 4;
  if (Math.abs(delta) <= step) actor.angle = target;
  else actor.angle += Math.sign(delta) * step;
}

export function aChase(level, actor) {
  if (actor.reactionTime) actor.reactionTime--;
  if (actor.threshold) {
    if (!targetAlive(actor.target)) actor.threshold = 0;
    else actor.threshold--;
  }
  turnTowardMoveDir(actor);

  if (!targetAlive(actor.target)) {
    if (lookForPlayer(level, actor, true)) return;
    setSequence(level, actor, 'spawn');
    return;
  }

  if (actor.justAttacked) {
    actor.justAttacked = false;
    if (level.skill !== SKILL.NIGHTMARE) newChaseDir(level, actor);
    return;
  }

  const states = actor.def.states;
  if (states.melee && checkMeleeRange(level, actor)) {
    playSound(level, actor, actor.def.sounds?.attack);
    setSequence(level, actor, 'melee');
    return;
  }

  if (states.missile && !(level.skill < SKILL.NIGHTMARE && actor.moveCount)) {
    if (checkMissileRange(level, actor)) {
      setSequence(level, actor, 'missile');
      actor.justAttacked = true;
      return;
    }
  }

  if (--actor.moveCount < 0 || !monsterMove(level, actor)) newChaseDir(level, actor);
  if (actor.def.sounds?.active && level.rng.random() < 3) playSound(level, actor, actor.def.sounds.active);
}

export function aFaceTarget(level, actor) {
  const t = actor.target;
  if (!t) return;
  actor.ambush = false;
  actor.angle = Math.atan2(t.y - actor.y, t.x - actor.x);
  if (t.shadow || t.player?.powers.invisibility > 0) actor.angle += (level.rng.spread() / 256) * (Math.PI / 4);
}
