// Simulation constants (Doom map units and tics; 35 tics per second).

export const TICRATE = 35;
export const TIC_MS = 1000 / TICRATE;
export const GRAVITY = 1;
export const FRICTION = 0xe800 / 0x10000;
export const STOP_SPEED = 0x1000 / 0x10000;
export const MAX_MOVE = 30;
export const FLOAT_SPEED = 4;
export const PLAYER_RADIUS = 16;
export const PLAYER_HEIGHT = 56;
export const PLAYER_ACCEL = (0x32 * 2048) / 0x10000; // running thrust per tic
export const WALK_ACCEL = (0x19 * 2048) / 0x10000;
export const USE_RANGE = 64;
export const SKULL_SPEED = 20;
export const MAX_HEALTH = 100;
export const SOUL_HEALTH = 200;
export const MAX_ARMOR = 200;

export const POWER_TICS = Object.freeze({
  invulnerability: 30 * TICRATE,
  invisibility: 60 * TICRATE,
  radsuit: 60 * TICRATE,
  lightAmp: 120 * TICRATE,
});

export const SKILL = Object.freeze({ BABY: 0, EASY: 1, MEDIUM: 2, HARD: 3, NIGHTMARE: 4 });
export const SKILL_NAMES = Object.freeze(["I'm too young to die.", 'Hey, not too rough.', 'Hurt me plenty.', 'Ultra-Violence.', 'Nightmare!']);

export const ANG45 = Math.PI / 4;
export const ANG90 = Math.PI / 2;
export const ANG180 = Math.PI;
export const toRadians = (degrees) => (degrees * Math.PI) / 180;
export const normalizeAngle = (a) => {
  const t = a % (Math.PI * 2);
  return t < 0 ? t + Math.PI * 2 : t;
};
// Doom's P_AproxDistance
export const approxDistance = (dx, dy) => {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  return ax + ay - Math.min(ax, ay) / 2;
};
