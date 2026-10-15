// Non-monster map things: pickups, keys, obstacles and decorations.
// frames: fixed frame letters to animate through (4 tics each by default).

const pickup = (doomednum, sprite, give, message, extra = {}) => ({ doomednum, sprite, kind: 'pickup', give, message, radius: 20, height: 16, ...extra });
const decor = (doomednum, sprite, frames, extra = {}) => ({ doomednum, sprite, kind: 'decor', frames, radius: 16, height: 16, solid: false, ...extra });
const solid = (doomednum, sprite, frames, radius = 16, extra = {}) => decor(doomednum, sprite, frames, { solid: true, radius, height: 48, ...extra });
const hanging = (doomednum, sprite, frames, blocking) => decor(doomednum, sprite, frames, { hanging: true, solid: blocking, height: 68 });

const LIST = [
  // Weapons
  pickup(2001, 'SHOT', { weapon: 'shotgun', ammo: { shells: 8 } }, 'You got the shotgun!', { weaponPickup: true }),
  pickup(2002, 'MGUN', { weapon: 'chaingun', ammo: { bullets: 20 } }, 'You got the chaingun!', { weaponPickup: true }),
  pickup(2003, 'LAUN', { weapon: 'rocketLauncher', ammo: { rockets: 2 } }, 'You got the rocket launcher!', { weaponPickup: true }),
  pickup(2004, 'PLAS', { weapon: 'plasmaRifle', ammo: { cells: 40 } }, 'You got the plasma gun!', { weaponPickup: true }),
  pickup(2005, 'CSAW', { weapon: 'chainsaw' }, 'A chainsaw!  Find some meat!', { weaponPickup: true }),
  pickup(2006, 'BFUG', { weapon: 'bfg', ammo: { cells: 40 } }, 'You got the BFG9000!  Oh, yes.', { weaponPickup: true }),
  // Ammo
  pickup(2007, 'CLIP', { ammo: { bullets: 10 } }, 'Picked up a clip.'),
  pickup(2048, 'AMMO', { ammo: { bullets: 50 } }, 'Picked up a box of bullets.'),
  pickup(2008, 'SHEL', { ammo: { shells: 4 } }, 'Picked up 4 shotgun shells.'),
  pickup(2049, 'SBOX', { ammo: { shells: 20 } }, 'Picked up a box of shotgun shells.'),
  pickup(2010, 'ROCK', { ammo: { rockets: 1 } }, 'Picked up a rocket.'),
  pickup(2046, 'BROK', { ammo: { rockets: 5 } }, 'Picked up a box of rockets.'),
  pickup(2047, 'CELL', { ammo: { cells: 20 } }, 'Picked up an energy cell.'),
  pickup(17, 'CELP', { ammo: { cells: 100 } }, 'Picked up an energy cell pack.'),
  pickup(8, 'BPAK', { backpack: true }, 'Picked up a backpack full of ammo!'),
  // Health and armour
  pickup(2011, 'STIM', { health: 10, healthMax: 100 }, 'Picked up a stimpack.'),
  pickup(2012, 'MEDI', { health: 25, healthMax: 100 }, 'Picked up a medikit.'),
  pickup(2014, 'BON1', { health: 1, healthMax: 200, always: true }, 'Picked up a health bonus.', { frames: 'ABCDCB', countItem: true }),
  pickup(2015, 'BON2', { armorBonus: 1 }, 'Picked up an armor bonus.', { frames: 'ABCDCB', countItem: true }),
  pickup(2018, 'ARM1', { armor: 100, armorClass: 1 }, 'Picked up the armor.', { frames: 'AB' }),
  pickup(2019, 'ARM2', { armor: 200, armorClass: 2 }, 'Picked up the MegaArmor!', { frames: 'AB' }),
  pickup(2013, 'SOUL', { health: 100, healthMax: 200, always: true }, 'Supercharge!', { frames: 'ABCDCB', bright: true, countItem: true, powerSound: true }),
  pickup(83, 'MEGA', { health: 200, healthMax: 200, armor: 200, armorClass: 2, always: true }, 'MegaSphere!', { frames: 'ABCD', bright: true, countItem: true, powerSound: true }),
  // Power-ups
  pickup(2022, 'PINV', { power: 'invulnerability' }, 'Invulnerability!', { frames: 'ABCD', bright: true, countItem: true, powerSound: true }),
  pickup(2023, 'PSTR', { power: 'berserk', health: 100, healthMax: 100, always: true }, 'Berserk!', { bright: true, countItem: true, powerSound: true }),
  pickup(2024, 'PINS', { power: 'invisibility' }, 'Partial Invisibility', { frames: 'ABCD', bright: true, countItem: true, powerSound: true }),
  pickup(2025, 'SUIT', { power: 'radsuit' }, 'Radiation Shielding Suit', { bright: true, countItem: true, powerSound: true }),
  pickup(2026, 'PMAP', { power: 'allmap' }, 'Computer Area Map', { frames: 'ABCDCB', bright: true, countItem: true, powerSound: true }),
  pickup(2045, 'PVIS', { power: 'lightAmp' }, 'Light Amplification Visor', { frames: 'AB', bright: true, countItem: true, powerSound: true }),
  // Keys
  pickup(5, 'BKEY', { key: 'blue' }, 'Picked up a blue keycard.', { frames: 'AB', bright: true }),
  pickup(6, 'YKEY', { key: 'yellow' }, 'Picked up a yellow keycard.', { frames: 'AB', bright: true }),
  pickup(13, 'RKEY', { key: 'red' }, 'Picked up a red keycard.', { frames: 'AB', bright: true }),
  pickup(40, 'BSKU', { key: 'blue' }, 'Picked up a blue skull key.', { frames: 'AB', bright: true }),
  pickup(39, 'YSKU', { key: 'yellow' }, 'Picked up a yellow skull key.', { frames: 'AB', bright: true }),
  pickup(38, 'RSKU', { key: 'red' }, 'Picked up a red skull key.', { frames: 'AB', bright: true }),
  // Obstacles
  { doomednum: 2035, sprite: 'BAR1', kind: 'barrel', frames: 'AB', radius: 10, height: 42, solid: true, health: 20, sounds: { death: 'DSBAREXP' } },
  solid(2028, 'COLU', 'A', 16, { bright: true, light: [1, 0.95, 0.75] }),
  solid(48, 'ELEC', 'A', 16, { height: 128 }),
  solid(30, 'COL1', 'A'), solid(31, 'COL2', 'A'), solid(32, 'COL3', 'A'), solid(33, 'COL4', 'A'),
  solid(36, 'COL5', 'AB'), solid(37, 'COL6', 'A'),
  solid(41, 'CEYE', 'ABCB', 16, { bright: true }),
  solid(42, 'FSKU', 'ABC', 16, { bright: true }),
  solid(43, 'TRE1', 'A'), solid(54, 'TRE2', 'A', 32),
  solid(44, 'TBLU', 'ABCD', 16, { bright: true, light: [0.4, 0.5, 1] }),
  solid(45, 'TGRN', 'ABCD', 16, { bright: true, light: [0.4, 1, 0.4] }),
  solid(46, 'TRED', 'ABCD', 16, { bright: true, light: [1, 0.4, 0.3] }),
  solid(55, 'SMBT', 'ABCD', 16, { bright: true, light: [0.4, 0.5, 1] }),
  solid(56, 'SMGT', 'ABCD', 16, { bright: true, light: [0.4, 1, 0.4] }),
  solid(57, 'SMRT', 'ABCD', 16, { bright: true, light: [1, 0.4, 0.3] }),
  solid(47, 'SMIT', 'A'),
  solid(35, 'CBRA', 'A', 16, { bright: true, light: [1, 0.85, 0.5] }),
  decor(34, 'CAND', 'A', { bright: true, light: [1, 0.85, 0.5] }),
  solid(25, 'POL1', 'A', 16), solid(26, 'POL6', 'AB', 16), solid(27, 'POL4', 'A', 16),
  solid(28, 'POL2', 'A', 16), solid(29, 'POL3', 'AB', 16, { bright: true }),
  hanging(49, 'GOR1', 'ABCB', true), hanging(50, 'GOR2', 'A', true), hanging(51, 'GOR3', 'A', true),
  hanging(52, 'GOR4', 'A', true), hanging(53, 'GOR5', 'A', true),
  hanging(63, 'GOR1', 'ABCB', false), hanging(59, 'GOR2', 'A', false), hanging(61, 'GOR3', 'A', false),
  hanging(60, 'GOR4', 'A', false), hanging(62, 'GOR5', 'A', false),
  // Corpses and gore
  decor(10, 'PLAY', 'W'), decor(12, 'PLAY', 'W'), decor(15, 'PLAY', 'N'),
  decor(18, 'POSS', 'L'), decor(19, 'SPOS', 'L'), decor(20, 'TROO', 'M'), decor(21, 'SARG', 'N'),
  decor(22, 'HEAD', 'L'), decor(24, 'POL5', 'A'),
];

export const THING_BY_DOOMEDNUM = new Map(LIST.map((t) => [t.doomednum, Object.freeze(t)]));
export const PICKUP_BY_KEY = Object.freeze({
  clip: THING_BY_DOOMEDNUM.get(2007),
  shotgun: THING_BY_DOOMEDNUM.get(2001),
  chaingun: THING_BY_DOOMEDNUM.get(2002),
});

export const PLAYER_START = 1;
export const TELEPORT_DEST = 14;
