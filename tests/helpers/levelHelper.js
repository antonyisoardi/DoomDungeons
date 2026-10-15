// Build a running simulation level from a compact rectangle map description.

import { parseWad } from '../../src/wad/wad.js';
import { loadMap } from '../../src/wad/map.js';
import { createTextureLibrary } from '../../src/wad/graphics.js';
import { buildGrid } from '../../src/world/grid.js';
import { findDoorSectors } from '../../src/game/specials/table.js';
import { createLevel } from '../../src/game/sim/level.js';
import { newPlayerState } from '../../src/game/sim/player.js';
import { SKILL } from '../../src/game/constants.js';
import { buildTestWad } from './wadBuilder.js';

export const PLAYER_START = 1;

export function loadTestMap(desc, name = 'E1M1') {
  const wad = parseWad(buildTestWad({ maps: { [name]: desc } }));
  return { wad, map: loadMap(wad, name) };
}

export function makeLevel(desc, { skill = SKILL.MEDIUM, seed = 1234, carried = newPlayerState(), mapName = 'E1M1' } = {}) {
  const { wad, map } = loadTestMap(desc, mapName);
  const doorSectors = findDoorSectors(map);
  const grid = buildGrid(map, doorSectors);
  return createLevel({
    levelData: { map, grid, doorSectors },
    textures: createTextureLibrary(wad),
    mapName, skill, carried, seed,
  });
}

// Advance n tics; `each(level, i)` runs before every tic (to steer input).
export function run(level, n, each) {
  for (let i = 0; i < n; i++) {
    each?.(level, i);
    level.tick();
  }
}

// Run until predicate(level) is true or `max` tics pass. Returns the number of tics run, or -1.
export function runUntil(level, max, predicate, each) {
  for (let i = 0; i < max; i++) {
    if (predicate(level)) return i;
    each?.(level, i);
    level.tick();
  }
  return predicate(level) ? max : -1;
}

// Press use for one tic then release.
export function pressUse(level) {
  level.player.input.use = true;
  level.tick();
  level.player.input.use = false;
}

export const room = (sector, x0, y0, x1, y1) => ({ sector, x0, y0, x1, y1 });
export const player = (x, y, angle = 0) => ({ x, y, angle, type: PLAYER_START });
export const sector = (props = {}) => ({ floor: 0, ceiling: 128, light: 160, special: 0, tag: 0, ...props });

export const messages = (level) => level.events.filter((e) => e.type === 'message');
export const mobjsOfKind = (level, kind) => level.mobjs.filter((m) => m.kind === kind && !m.removed);
