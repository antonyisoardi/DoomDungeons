// Player weapons with Doom's timings (tics) and damage rules.

export const AMMO = Object.freeze({
  bullets: { max: 200, clip: 10 },
  shells: { max: 50, clip: 4 },
  rockets: { max: 50, clip: 1 },
  cells: { max: 300, clip: 20 },
});

// fire: the attack. refire: total tics between shots while held.
export const WEAPONS = Object.freeze({
  fist: { slot: 1, order: 0, ammo: null, perShot: 0, refire: 22, fireAt: 8, fire: 'punch', sprite: 'PUNG', icon: null, name: 'Fist' },
  chainsaw: { slot: 1, order: 1, ammo: null, perShot: 0, refire: 4, fireAt: 0, fire: 'saw', sprite: 'SAWG', icon: 'CSAWA0', name: 'Chainsaw', idleSound: 'DSSAWIDL' },
  pistol: { slot: 2, order: 2, ammo: 'bullets', perShot: 1, refire: 19, fireAt: 4, fire: 'pistol', sprite: 'PISG', icon: null, name: 'Pistol', sound: 'DSPISTOL' },
  shotgun: { slot: 3, order: 3, ammo: 'shells', perShot: 1, refire: 37, fireAt: 3, fire: 'shotgun', sprite: 'SHTG', icon: 'SHOTA0', name: 'Shotgun', sound: 'DSSHOTGN' },
  chaingun: { slot: 4, order: 5, ammo: 'bullets', perShot: 1, refire: 4, fireAt: 0, fire: 'chaingun', sprite: 'CHGG', icon: 'MGUNA0', name: 'Chaingun', sound: 'DSPISTOL' },
  rocketLauncher: { slot: 5, order: 6, ammo: 'rockets', perShot: 1, refire: 20, fireAt: 8, fire: 'rocket', sprite: 'MISG', icon: 'LAUNA0', name: 'Rocket Launcher' },
  plasmaRifle: { slot: 6, order: 7, ammo: 'cells', perShot: 1, refire: 3, cooldown: 20, fireAt: 0, fire: 'plasma', sprite: 'PLSG', icon: 'PLASA0', name: 'Plasma Rifle' },
  bfg: { slot: 7, order: 8, ammo: 'cells', perShot: 40, refire: 60, fireAt: 30, fire: 'bfg', sprite: 'BFGG', icon: 'BFUGA0', name: 'BFG 9000', chargeSound: 'DSBFG' },
});

export const WEAPON_SWITCH_TICS = 10;
export const MELEE_RANGE = 64;
export const SAW_RANGE = 65;
export const MISSILE_RANGE = 2048;

// Preferred weapon when ammo runs out (Doom's P_CheckAmmo order).
export const FALLBACK_ORDER = Object.freeze(['plasmaRifle', 'chaingun', 'shotgun', 'pistol', 'chainsaw', 'rocketLauncher', 'bfg', 'fist']);
