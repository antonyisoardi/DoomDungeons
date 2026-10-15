// The player: inventory, movement, use, powers and death (Doom's p_user.c).

import { defineStates } from '../info/states.js';
import { AMMO } from '../info/weapons.js';
import { PLAYER_ACCEL, WALK_ACCEL, PLAYER_RADIUS, PLAYER_HEIGHT, MAX_HEALTH } from '../constants.js';
import { weaponThink } from './weapons.js';
import { playerInSpecialSector } from './specials/sectorSpecials.js';
import { setSequence, inSequence } from './mobj.js';

export const PLAYER_DEF = Object.freeze({
  sprite: 'PLAY', radius: PLAYER_RADIUS, height: PLAYER_HEIGHT, health: MAX_HEALTH, mass: 100, painChance: 255,
  states: defineStates({
    spawn: ['A-1'],
    see: ['A4', 'B4', 'C4', 'D4', 'loop'],
    missile: ['E12', 'goto spawn'],
    flash: ['F6!', 'goto missile'],
    pain: ['G4', 'G4 pain', 'goto spawn'],
    death: ['H10', 'I10 playerScream', 'J10 fall', 'K10', 'L10', 'M10', 'N-1'],
    xdeath: ['O5', 'P5 xScream', 'Q5 fall', 'R5', 'S5', 'T5', 'U5', 'V5', 'W-1'],
  }),
});

export function newPlayerState() {
  return {
    health: MAX_HEALTH, armor: 0, armorClass: 0,
    weapons: new Set(['fist', 'pistol']), weapon: 'pistol', pendingWeapon: null,
    ammo: { bullets: 50, shells: 0, rockets: 0, cells: 0 },
    maxAmmo: Object.fromEntries(Object.entries(AMMO).map(([k, v]) => [k, v.max])),
    backpack: false,
  };
}

// Carry inventory between levels (keys and powers reset, as in Doom).
export function carryOver(player) {
  return {
    health: player.health, armor: player.armor, armorClass: player.armorClass,
    weapons: new Set(player.weapons), weapon: player.weapon, pendingWeapon: null,
    ammo: { ...player.ammo }, maxAmmo: { ...player.maxAmmo }, backpack: player.backpack,
  };
}

export function createPlayer(carried) {
  return {
    ...carried,
    keys: new Set(),
    powers: { invulnerability: 0, invisibility: 0, radsuit: 0, lightAmp: 0, berserk: false, allmap: false },
    input: { moveX: 0, moveY: 0, aimAngle: 0, fire: false, use: false, walk: false, weaponSlot: 0, weaponCycle: 0 },
    cooldown: 0, fireDelay: 0, refire: 0, switchTics: 0,
    damageCount: 0, bonusCount: 0, freezeTics: 0,
    dead: false, deadTics: 0, attacker: null, usedLast: false,
  };
}

function tickPowers(player, mobj) {
  const p = player.powers;
  for (const key of ['invulnerability', 'radsuit', 'lightAmp']) if (p[key] > 0) p[key]--;
  if (p.invisibility > 0 && --p.invisibility === 0) mobj.shadow = false;
  if (player.damageCount > 0) player.damageCount--;
  if (player.bonusCount > 0) player.bonusCount--;
}

function move(level, mobj, player) {
  const { moveX, moveY } = player.input;
  const onGround = mobj.z <= mobj.floorz + 0.5;
  if (!onGround || (!moveX && !moveY)) return false;
  const len = Math.hypot(moveX, moveY);
  const accel = player.input.walk ? WALK_ACCEL : PLAYER_ACCEL;
  mobj.momX += (moveX / len) * accel;
  mobj.momY += (moveY / len) * accel;
  return true;
}

function animate(level, mobj, moving) {
  if (inSequence(mobj, 'missile') || inSequence(mobj, 'flash') || inSequence(mobj, 'pain')) return;
  const speed = Math.hypot(mobj.momX, mobj.momY);
  if ((moving || speed > 1) && inSequence(mobj, 'spawn')) setSequence(level, mobj, 'see');
  else if (!moving && speed <= 1 && inSequence(mobj, 'see')) setSequence(level, mobj, 'spawn');
}

function deathThink(level, mobj, player) {
  player.deadTics++;
  if (player.attacker && player.attacker !== mobj && !player.attacker.removed) {
    mobj.angle = Math.atan2(player.attacker.y - mobj.y, player.attacker.x - mobj.x);
  }
  if (player.damageCount > 0) player.damageCount--;
  const pressed = player.input.use || player.input.fire;
  if (player.deadTics > 35 && pressed) level.requestRestart();
}

export function playerThink(level, mobj) {
  const player = mobj.player;
  if (player.dead) {
    deathThink(level, mobj, player);
    return;
  }
  let moving = false;
  if (player.freezeTics > 0) player.freezeTics--;
  else moving = move(level, mobj, player);
  mobj.angle = player.input.aimAngle;
  animate(level, mobj, moving);

  if (player.input.use && !player.usedLast) level.playerUse(mobj);
  player.usedLast = player.input.use;

  playerInSpecialSector(level, mobj);
  weaponThink(level, mobj);
  tickPowers(player, mobj);
}
