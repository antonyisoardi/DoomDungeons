// Light effects (Doom's p_lights.c) and light-changing line specials.

import { minLightAround, maxLightAround, sectorsWithTag } from './sectors.js';

const STROBE_BRIGHT = 5;
export const FAST_DARK = 15;
export const SLOW_DARK = 35;
const GLOW_SPEED = 8;

function addLight(level, light) {
  light.think = () => light.tick(level);
  level.addThinker(light);
  return light;
}

export function spawnLightFlash(level, s) {
  const sec = level.sectors[s];
  const max = sec.light, min = minLightAround(level, s, sec.light);
  const light = {
    kind: 'light', count: (level.rng.random() & 64) + 1,
    tick(lv) {
      if (--this.count) return;
      if (sec.light === max) { sec.light = min; this.count = (lv.rng.random() & 7) + 1; }
      else { sec.light = max; this.count = (lv.rng.random() & 64) + 1; }
    },
  };
  return addLight(level, light);
}

export function spawnStrobeFlash(level, s, darkTime, inSync) {
  const sec = level.sectors[s];
  const max = sec.light;
  let min = minLightAround(level, s, sec.light);
  if (min === max) min = 0;
  const light = {
    kind: 'light', count: inSync ? 1 : (level.rng.random() & 7) + 1,
    tick() {
      if (--this.count) return;
      if (sec.light === min) { sec.light = max; this.count = STROBE_BRIGHT; }
      else { sec.light = min; this.count = darkTime; }
    },
  };
  return addLight(level, light);
}

export function spawnGlowingLight(level, s) {
  const sec = level.sectors[s];
  const max = sec.light, min = minLightAround(level, s, sec.light);
  const light = {
    kind: 'light', direction: -1,
    tick() {
      if (this.direction < 0) {
        sec.light -= GLOW_SPEED;
        if (sec.light <= min) { sec.light += GLOW_SPEED; this.direction = 1; }
      } else {
        sec.light += GLOW_SPEED;
        if (sec.light >= max) { sec.light -= GLOW_SPEED; this.direction = -1; }
      }
    },
  };
  return addLight(level, light);
}

export function spawnFireFlicker(level, s) {
  const sec = level.sectors[s];
  const max = sec.light, min = minLightAround(level, s, sec.light) + 16;
  const light = {
    kind: 'light', count: 4,
    tick(lv) {
      if (--this.count) return;
      const amount = (lv.rng.random() & 3) * 16;
      sec.light = sec.light - amount < min ? min : max - amount;
      this.count = 4;
    },
  };
  return addLight(level, light);
}

// Line specials 12, 13, 35, 79-81, 104, 138, 139, 17.
export function changeLights(level, tag, type, value) {
  for (const s of sectorsWithTag(level, tag)) {
    const sec = level.sectors[s];
    if (type === 'set') sec.light = value;
    else if (type === 'maxNeighbor') sec.light = maxLightAround(level, s);
    else if (type === 'minNeighbor') sec.light = minLightAround(level, s, sec.light);
    else if (type === 'strobe') spawnStrobeFlash(level, s, SLOW_DARK, false);
  }
  return true;
}
