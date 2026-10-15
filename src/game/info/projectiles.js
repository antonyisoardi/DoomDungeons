// Missiles and short-lived effects (puffs, blood, explosions, teleport fog).

import { defineStates } from './states.js';

export const PROJECTILES = Object.freeze({
  impBall: {
    sprite: 'BAL1', speed: 10, radius: 6, height: 8, damage: 3, seeSound: 'DSFIRSHT', deathSound: 'DSFIRXPL',
    light: [1, 0.55, 0.2],
    states: defineStates({ spawn: ['A4!', 'B4!', 'loop'], death: ['C6!', 'D6!', 'E6!', 'stop'] }),
  },
  cacoBall: {
    sprite: 'BAL2', speed: 10, radius: 6, height: 8, damage: 5, seeSound: 'DSFIRSHT', deathSound: 'DSFIRXPL',
    light: [0.9, 0.3, 1],
    states: defineStates({ spawn: ['A4!', 'B4!', 'loop'], death: ['C6!', 'D6!', 'E6!', 'stop'] }),
  },
  baronBall: {
    sprite: 'BAL7', speed: 15, radius: 6, height: 16, damage: 8, seeSound: 'DSFIRSHT', deathSound: 'DSFIRXPL',
    light: [0.35, 1, 0.35],
    states: defineStates({ spawn: ['A4!', 'B4!', 'loop'], death: ['C6!', 'D6!', 'E6!', 'stop'] }),
  },
  rocket: {
    sprite: 'MISL', speed: 20, radius: 11, height: 8, damage: 20, seeSound: 'DSRLAUNC', deathSound: 'DSBAREXP',
    splash: 128, light: [1, 0.7, 0.3], trail: true,
    states: defineStates({ spawn: ['A1!', 'loop'], death: ['B8! explode', 'C6!', 'D4!', 'stop'] }),
  },
  plasma: {
    sprite: 'PLSS', speed: 25, radius: 13, height: 8, damage: 5, seeSound: 'DSPLASMA', deathSound: 'DSFIRXPL',
    light: [0.3, 0.5, 1], deathSprite: 'PLSE',
    states: defineStates({ spawn: ['A6!', 'B6!', 'loop'], death: ['A4!', 'B4!', 'C4!', 'D4!', 'E4!', 'stop'] }),
  },
  bfgBall: {
    sprite: 'BFS1', speed: 25, radius: 13, height: 8, damage: 100, seeSound: null, deathSound: 'DSRXPLOD',
    light: [0.3, 1, 0.3], deathSprite: 'BFE1',
    states: defineStates({ spawn: ['A4!', 'B4!', 'loop'], death: ['A8!', 'B8!', 'C8! bfgSpray', 'D8!', 'E8!', 'F8!', 'stop'] }),
  },
});

export const EFFECTS = Object.freeze({
  puff: { sprite: 'PUFF', states: defineStates({ spawn: ['A4!', 'B4', 'C4', 'D4', 'stop'] }) },
  blood: { sprite: 'BLUD', states: defineStates({ spawn: ['C8', 'B8', 'A8', 'stop'] }) },
  teleportFog: { sprite: 'TFOG', light: [0.4, 1, 0.4], states: defineStates({ spawn: ['A6!', 'B6!', 'A6!', 'B6!', 'C6!', 'D6!', 'E6!', 'F6!', 'G6!', 'H6!', 'I6!', 'J6!', 'stop'] }) },
  rocketExplosion: { sprite: 'MISL', light: [1, 0.6, 0.2], states: defineStates({ spawn: ['B8!', 'C6!', 'D4!', 'stop'] }) },
  bfgFlash: { sprite: 'BFE2', light: [0.3, 1, 0.3], states: defineStates({ spawn: ['A8!', 'B8!', 'C8!', 'D8!', 'stop'] }) },
  smoke: { sprite: 'PUFF', states: defineStates({ spawn: ['B4', 'C4', 'B4', 'C4', 'D4', 'stop'] }) },
});

export const BARREL_STATES = defineStates({
  spawn: ['A6', 'B6', 'loop'],
  death: ['A5!', 'B5! scream', 'C5!', 'D10! explode', 'E10!', 'stop'],
});

export const BARREL_DEATH_SPRITE = 'BEXP';
