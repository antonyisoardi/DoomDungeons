// Player weapon handling: switching, ammo, refire timing and the attacks themselves.

import { WEAPONS, FALLBACK_ORDER, WEAPON_SWITCH_TICS, MELEE_RANGE, SAW_RANGE, MISSILE_RANGE } from '../info/weapons.js';
import { lineAttack, aimAssist, traceAttack } from './hitscan.js';
import { spawnPlayerMissile } from './missiles.js';
import { playSound } from './combat.js';
import { setSequence } from './mobj.js';

const BAM18 = (Math.PI * 2) / 16384; // (P_Random()-P_Random())<<18 in radians per unit
const AIM_CONE = (7 * Math.PI) / 180;

export function hasAmmoFor(player, weaponKey) {
  const w = WEAPONS[weaponKey];
  return !w.ammo || player.ammo[w.ammo] >= w.perShot;
}

export function bestWeapon(player) {
  return FALLBACK_ORDER.find((w) => player.weapons.has(w) && hasAmmoFor(player, w)) ?? 'fist';
}

// Weapons sharing a number key cycle (1: fist/chainsaw).
export function weaponForSlot(player, slot) {
  const inSlot = Object.entries(WEAPONS)
    .filter(([key, w]) => w.slot === slot && player.weapons.has(key))
    .map(([key]) => key);
  if (inSlot.length === 0) return null;
  const at = inSlot.indexOf(player.weapon);
  if (slot === 1 && player.powers.berserk && at < 0) return 'fist';
  return inSlot[(at + 1) % inSlot.length];
}

export function cycleWeapon(player, direction) {
  const owned = Object.entries(WEAPONS)
    .filter(([key]) => player.weapons.has(key))
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key]) => key);
  const at = owned.indexOf(player.weapon);
  return owned[(at + direction + owned.length) % owned.length];
}

function bulletDamage(level) {
  return 5 * ((level.rng.random() % 3) + 1);
}

function gunShot(level, mobj, accurate, angle) {
  const spread = accurate ? 0 : level.rng.spread() * BAM18;
  lineAttack(level, mobj, angle + spread, MISSILE_RANGE, bulletDamage(level));
}

function muzzleFlash(level, mobj, color = [1, 0.85, 0.5]) {
  level.emit({ type: 'muzzleFlash', x: mobj.x, y: mobj.y, z: mobj.z + 40, color });
}

const FIRE = {
  punch(level, mobj, angle) {
    const player = mobj.player;
    let damage = ((level.rng.random() % 10) + 1) << 1;
    if (player.powers.berserk) damage *= 10;
    const hit = lineAttack(level, mobj, angle + level.rng.spread() * BAM18, MELEE_RANGE, damage);
    if (hit.target) playSound(level, mobj, 'DSPUNCH');
  },
  saw(level, mobj, angle) {
    const damage = 2 * ((level.rng.random() % 10) + 1);
    const hit = lineAttack(level, mobj, angle + level.rng.spread() * BAM18, SAW_RANGE, damage);
    playSound(level, mobj, hit.target ? 'DSSAWHIT' : 'DSSAWFUL');
  },
  pistol(level, mobj, angle) {
    playSound(level, mobj, 'DSPISTOL');
    gunShot(level, mobj, mobj.player.refire <= 1, angle);
    muzzleFlash(level, mobj);
  },
  shotgun(level, mobj, angle) {
    playSound(level, mobj, 'DSSHOTGN');
    for (let i = 0; i < 7; i++) gunShot(level, mobj, false, angle);
    muzzleFlash(level, mobj);
  },
  chaingun(level, mobj, angle) {
    playSound(level, mobj, 'DSPISTOL');
    gunShot(level, mobj, mobj.player.refire <= 1, angle);
    muzzleFlash(level, mobj);
  },
  rocket(level, mobj, angle, target) {
    spawnPlayerMissile(level, mobj, angle, target, 'rocket');
    muzzleFlash(level, mobj);
  },
  plasma(level, mobj, angle, target) {
    spawnPlayerMissile(level, mobj, angle, target, 'plasma');
    muzzleFlash(level, mobj, [0.4, 0.6, 1]);
  },
  bfg(level, mobj, angle, target) {
    spawnPlayerMissile(level, mobj, angle, target, 'bfgBall');
    muzzleFlash(level, mobj, [0.4, 1, 0.4]);
  },
};

function aimedTarget(level, mobj, angle, range) {
  const assisted = aimAssist(level, mobj, angle, range, AIM_CONE);
  const hit = traceAttack(level, mobj, assisted, range);
  return { angle: assisted, target: hit.target };
}

function startSwitch(player, weapon) {
  if (weapon === player.weapon || !player.weapons.has(weapon)) {
    player.pendingWeapon = null;
    return;
  }
  player.pendingWeapon = weapon;
  player.switchTics = WEAPON_SWITCH_TICS;
}

export function weaponThink(level, mobj) {
  const player = mobj.player;
  const input = player.input;

  if (player.pendingWeapon && !player.switchTics && player.pendingWeapon !== player.weapon) {
    startSwitch(player, player.pendingWeapon);
  }
  if (player.switchTics > 0) {
    player.switchTics--;
    if (player.switchTics === Math.floor(WEAPON_SWITCH_TICS / 2) && player.pendingWeapon) {
      player.weapon = player.pendingWeapon;
      player.pendingWeapon = null;
      if (player.weapon === 'chainsaw') playSound(level, mobj, 'DSSAWUP');
    }
    return;
  }
  if (player.cooldown > 0) player.cooldown--;

  if (player.fireDelay > 0 && --player.fireDelay === 0) executeFire(level, mobj);

  if (input.weaponSlot) {
    const w = weaponForSlot(player, input.weaponSlot);
    input.weaponSlot = 0;
    if (w) startSwitch(player, w);
    return;
  }
  if (input.weaponCycle) {
    const w = cycleWeapon(player, input.weaponCycle);
    input.weaponCycle = 0;
    if (w) startSwitch(player, w);
    return;
  }

  const w = WEAPONS[player.weapon];
  if (!input.fire) {
    if (player.refire && player.weapon === 'plasmaRifle') player.cooldown = Math.max(player.cooldown, w.cooldown);
    player.refire = 0;
    if (player.weapon === 'chainsaw' && !(level.tic % 8)) playSound(level, mobj, 'DSSAWIDL');
    return;
  }
  if (player.cooldown > 0 || player.fireDelay > 0) return;
  if (!hasAmmoFor(player, player.weapon)) {
    startSwitch(player, bestWeapon(player));
    return;
  }
  if (w.ammo) player.ammo[w.ammo] -= w.perShot;
  player.refire++;
  player.cooldown = w.refire;
  if (w.chargeSound) playSound(level, mobj, w.chargeSound);
  level.noiseAlert(mobj);
  setSequence(level, mobj, 'missile');
  if (w.fireAt === 0) executeFire(level, mobj);
  else player.fireDelay = w.fireAt;
}

function executeFire(level, mobj) {
  const player = mobj.player;
  const w = WEAPONS[player.weapon];
  const range = w.fire === 'punch' ? MELEE_RANGE : w.fire === 'saw' ? SAW_RANGE : MISSILE_RANGE;
  const { angle, target } = aimedTarget(level, mobj, player.input.aimAngle, Math.min(range + 32, 1200));
  mobj.angle = angle;
  FIRE[w.fire](level, mobj, angle, target);
  if (w.fire !== 'punch' && w.fire !== 'saw') setSequence(level, mobj, 'flash');
}
