// Touching items (Doom's P_TouchSpecialThing and P_Give*).

import { AMMO, WEAPONS } from '../info/weapons.js';
import { SKILL, POWER_TICS } from '../constants.js';

export function giveAmmo(level, player, type, amount, dropped = false) {
  if (player.ammo[type] >= player.maxAmmo[type]) return false;
  let n = dropped ? Math.floor(amount / 2) || 1 : amount;
  if (level.skill === SKILL.BABY || level.skill === SKILL.NIGHTMARE) n *= 2;
  const hadNone = player.ammo[type] === 0;
  player.ammo[type] = Math.min(player.maxAmmo[type], player.ammo[type] + n);
  if (hadNone) autoSwitchForAmmo(player, type);
  return true;
}

// Doom switches away from the fist/pistol when ammo for something better arrives.
function autoSwitchForAmmo(player, type) {
  const current = player.weapon;
  const owns = (w) => player.weapons.has(w);
  if (type === 'bullets' && current === 'fist') player.pendingWeapon = owns('chaingun') ? 'chaingun' : 'pistol';
  if (type === 'shells' && (current === 'fist' || current === 'pistol') && owns('shotgun')) player.pendingWeapon = 'shotgun';
  if (type === 'cells' && (current === 'fist' || current === 'pistol') && owns('plasmaRifle')) player.pendingWeapon = 'plasmaRifle';
  if (type === 'rockets' && current === 'fist' && owns('rocketLauncher')) player.pendingWeapon = 'rocketLauncher';
}

function giveWeapon(level, player, weapon, ammo, dropped) {
  let gotAmmo = false;
  for (const [type, amount] of Object.entries(ammo ?? {})) gotAmmo = giveAmmo(level, player, type, amount, dropped) || gotAmmo;
  if (player.weapons.has(weapon)) return gotAmmo;
  player.weapons.add(weapon);
  player.pendingWeapon = weapon;
  return true;
}

function giveArmor(player, amount, armorClass) {
  if (player.armor >= amount) return false;
  player.armor = amount;
  player.armorClass = armorClass;
  return true;
}

function givePower(player, mobj, power) {
  if (power === 'berserk') {
    player.powers.berserk = true;
    if (player.weapon !== 'fist') player.pendingWeapon = 'fist';
    return true;
  }
  if (power === 'allmap') {
    if (player.powers.allmap) return false;
    player.powers.allmap = true;
    return true;
  }
  player.powers[power] = POWER_TICS[power];
  if (power === 'invisibility') mobj.shadow = true;
  return true;
}

function setHealth(player, mobj, value) {
  player.health = value;
  mobj.health = value;
}

// Returns true if the item was taken.
export function giveItem(level, mobj, item) {
  const player = mobj.player;
  const give = item.def.give;
  let taken = false;

  if (give.weapon) taken = giveWeapon(level, player, give.weapon, give.ammo, item.dropped) || taken;
  else if (give.ammo) for (const [type, amount] of Object.entries(give.ammo)) taken = giveAmmo(level, player, type, amount, item.dropped) || taken;

  if (give.backpack) {
    if (!player.backpack) {
      for (const type of Object.keys(AMMO)) player.maxAmmo[type] *= 2;
      player.backpack = true;
    }
    for (const [type, info] of Object.entries(AMMO)) giveAmmo(level, player, type, info.clip);
    taken = true;
  }
  if (give.health !== undefined) {
    if (give.always || player.health < give.healthMax) {
      const value = give.healthMax === 200 && give.health === 200 ? 200 : Math.min(give.healthMax, player.health + give.health);
      setHealth(player, mobj, Math.max(player.health, value));
      taken = true;
    }
  }
  if (give.armor !== undefined) taken = giveArmor(player, give.armor, give.armorClass) || taken || !!give.always;
  if (give.armorBonus) {
    player.armor = Math.min(200, player.armor + give.armorBonus);
    if (!player.armorClass) player.armorClass = 1;
    taken = true;
  }
  if (give.power) taken = givePower(player, mobj, give.power) || taken;
  if (give.key) {
    if (!player.keys.has(give.key)) player.keys.add(give.key);
    taken = true;
  }
  return taken;
}

export function pickupMessage(item, player) {
  if (item.def.sprite === 'MEDI' && player.health < 25 + 25) return 'Picked up a medikit that you REALLY need!';
  return item.def.message;
}

export function pickupSound(item) {
  if (item.def.weaponPickup) return 'DSWPNUP';
  if (item.def.powerSound) return 'DSGETPOW';
  return 'DSITEMUP';
}

export const WEAPON_NAMES = Object.freeze(Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.name])));
