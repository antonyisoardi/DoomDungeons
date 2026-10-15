// Doom 1 monsters: stats and states transcribed from Doom's info tables.

import { defineStates } from './states.js';

const chase = (letters, tics, extra = {}) =>
  [...letters].flatMap((l) => [`${l}${tics} ${extra[l] ?? 'chase'}`, `${l}${tics} chase`]);

export const MONSTERS = Object.freeze({
  zombieman: {
    doomednum: 3004, sprite: 'POSS', health: 20, speed: 8, radius: 20, height: 56, mass: 100,
    painChance: 200, reactionTime: 8, drop: 'clip',
    sounds: { see: ['DSPOSIT1', 'DSPOSIT2', 'DSPOSIT3'], attack: 'DSPISTOL', pain: 'DSPOPAIN', death: ['DSPODTH1', 'DSPODTH2', 'DSPODTH3'], active: 'DSPOSACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: [...chase('ABCD', 4), 'loop'],
      missile: ['E10 faceTarget', 'F8! posAttack', 'E8', 'goto see'],
      pain: ['G3', 'G3 pain', 'goto see'],
      death: ['H5', 'I5 scream', 'J5 fall', 'K5', 'L-1'],
      xdeath: ['M5', 'N5 xScream', 'O5 fall', 'P5', 'Q5', 'R5', 'S5', 'T5', 'U-1'],
    }),
  },
  shotgunGuy: {
    doomednum: 9, sprite: 'SPOS', health: 30, speed: 8, radius: 20, height: 56, mass: 100,
    painChance: 170, reactionTime: 8, drop: 'shotgun',
    sounds: { see: ['DSPOSIT1', 'DSPOSIT2', 'DSPOSIT3'], attack: 'DSSHOTGN', pain: 'DSPOPAIN', death: ['DSPODTH1', 'DSPODTH2', 'DSPODTH3'], active: 'DSPOSACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: [...chase('ABCD', 3), 'loop'],
      missile: ['E10 faceTarget', 'F10! sPosAttack', 'E10', 'goto see'],
      pain: ['G3', 'G3 pain', 'goto see'],
      death: ['H5', 'I5 scream', 'J5 fall', 'K5', 'L-1'],
      xdeath: ['M5', 'N5 xScream', 'O5 fall', 'P5', 'Q5', 'R5', 'S5', 'T5', 'U-1'],
    }),
  },
  imp: {
    doomednum: 3001, sprite: 'TROO', health: 60, speed: 8, radius: 20, height: 56, mass: 100,
    painChance: 200, reactionTime: 8,
    sounds: { see: ['DSBGSIT1', 'DSBGSIT2'], attack: 'DSCLAW', pain: 'DSPOPAIN', death: ['DSBGDTH1', 'DSBGDTH2'], active: 'DSBGACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: [...chase('ABCD', 3), 'loop'],
      melee: ['E8 faceTarget', 'F8 faceTarget', 'G6 troopAttack', 'goto see'],
      missile: ['E8 faceTarget', 'F8 faceTarget', 'G6 troopAttack', 'goto see'],
      pain: ['H2', 'H2 pain', 'goto see'],
      death: ['I8', 'J8 scream', 'K6', 'L6 fall', 'M-1'],
      xdeath: ['N5', 'O5 xScream', 'P5', 'Q5 fall', 'R5', 'S5', 'T5', 'U-1'],
    }),
  },
  demon: {
    doomednum: 3002, sprite: 'SARG', health: 150, speed: 10, radius: 30, height: 56, mass: 400,
    painChance: 180, reactionTime: 8,
    sounds: { see: 'DSSGTSIT', attack: 'DSSGTATK', pain: 'DSDMPAIN', death: 'DSSGTDTH', active: 'DSDMACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: [...chase('ABCD', 2), 'loop'],
      melee: ['E8 faceTarget', 'F8 faceTarget', 'G8 sargAttack', 'goto see'],
      pain: ['H2', 'H2 pain', 'goto see'],
      death: ['I8', 'J8 scream', 'K4', 'L4 fall', 'M4', 'N-1'],
    }),
  },
  lostSoul: {
    doomednum: 3006, sprite: 'SKUL', health: 100, speed: 8, radius: 16, height: 56, mass: 50,
    painChance: 256, reactionTime: 8, float: true, noGravity: true, damage: 3, countKill: false,
    sounds: { attack: 'DSSKLATK', pain: 'DSDMPAIN', death: 'DSFIRXPL', active: 'DSDMACT' },
    states: defineStates({
      spawn: ['A10! look', 'B10! look', 'loop'],
      see: ['A6! chase', 'B6! chase', 'loop'],
      missile: ['C10! faceTarget', 'D4! skullAttack', 'C4!', 'D4!', 'goto missileLoop'],
      missileLoop: ['C4!', 'D4!', 'loop'],
      pain: ['E3!', 'E3! pain', 'goto see'],
      death: ['F6!', 'G6! scream', 'H6!', 'I6! fall', 'J6!', 'K6!', 'stop'],
    }),
  },
  cacodemon: {
    doomednum: 3005, sprite: 'HEAD', health: 400, speed: 8, radius: 31, height: 56, mass: 400,
    painChance: 128, reactionTime: 8, float: true, noGravity: true,
    sounds: { see: 'DSCACSIT', pain: 'DSDMPAIN', death: 'DSCACDTH', active: 'DSDMACT' },
    states: defineStates({
      spawn: ['A10 look', 'loop'],
      see: ['A3 chase', 'loop'],
      missile: ['B5 faceTarget', 'C5 faceTarget', 'D5! headAttack', 'goto see'],
      pain: ['E3', 'E3 pain', 'F6', 'goto see'],
      death: ['G8', 'H8 scream', 'I8', 'J8', 'K8 fall', 'L-1'],
    }),
  },
  baron: {
    doomednum: 3003, sprite: 'BOSS', health: 1000, speed: 8, radius: 24, height: 64, mass: 1000,
    painChance: 50, reactionTime: 8, boss: 'baron',
    sounds: { see: 'DSBRSSIT', pain: 'DSDMPAIN', death: 'DSBRSDTH', active: 'DSDMACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: [...chase('ABCD', 3), 'loop'],
      melee: ['E8 faceTarget', 'F8 faceTarget', 'G8 bruisAttack', 'goto see'],
      missile: ['E8 faceTarget', 'F8 faceTarget', 'G8 bruisAttack', 'goto see'],
      pain: ['H2', 'H2 pain', 'goto see'],
      death: ['I8', 'J8 scream', 'K8', 'L8 fall', 'M8', 'N8 bossDeath', 'O-1'],
    }),
  },
  cyberdemon: {
    doomednum: 16, sprite: 'CYBR', health: 4000, speed: 16, radius: 40, height: 110, mass: 1000,
    painChance: 20, reactionTime: 8, boss: 'cyberdemon', noSplash: true,
    sounds: { see: 'DSCYBSIT', pain: 'DSDMPAIN', death: 'DSCYBDTH', active: 'DSDMACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: ['A3 hoof', 'A3 chase', 'B3 chase', 'B3 chase', 'C3 chase', 'C3 chase', 'D3 metal', 'D3 chase', 'loop'],
      missile: ['E6 faceTarget', 'F12 cyberAttack', 'E12 faceTarget', 'F12 cyberAttack', 'E12 faceTarget', 'F12 cyberAttack', 'goto see'],
      pain: ['G10 pain', 'goto see'],
      death: ['H10', 'I10 scream', 'J10', 'K10', 'L10', 'M10 fall', 'N10', 'O10', 'P30', 'P-1 bossDeath'],
    }),
  },
  spiderMastermind: {
    doomednum: 7, sprite: 'SPID', health: 3000, speed: 12, radius: 128, height: 100, mass: 1000,
    painChance: 40, reactionTime: 8, boss: 'spider', noSplash: true,
    sounds: { see: 'DSSPISIT', attack: 'DSSHOTGN', pain: 'DSDMPAIN', death: 'DSSPIDTH', active: 'DSDMACT' },
    states: defineStates({
      spawn: ['A10 look', 'B10 look', 'loop'],
      see: ['A3 metal', 'A3 chase', 'B3 chase', 'B3 chase', 'C3 metal', 'C3 chase', 'D3 chase', 'D3 chase', 'E3 metal', 'E3 chase', 'F3 chase', 'F3 chase', 'loop'],
      missile: ['A20! faceTarget', 'G4! sPosAttack', 'H4! sPosAttack', 'H1! spidRefire', 'goto missileLoop'],
      missileLoop: ['G4! sPosAttack', 'H4! sPosAttack', 'H1! spidRefire', 'loop'],
      pain: ['I3', 'I3 pain', 'goto see'],
      death: ['J20 scream', 'K10 fall', 'L10', 'M10', 'N10', 'O10', 'P10', 'Q10', 'R10', 'S30', 'S-1 bossDeath'],
    }),
  },
});

// Spectre: a demon drawn as a shimmering shadow.
export const SPECTRE = Object.freeze({ ...MONSTERS.demon, doomednum: 58, shadow: true });

export const MONSTER_BY_DOOMEDNUM = new Map([
  ...Object.entries(MONSTERS).map(([key, m]) => [m.doomednum, { key, ...m }]),
  [58, { key: 'spectre', ...SPECTRE }],
]);
