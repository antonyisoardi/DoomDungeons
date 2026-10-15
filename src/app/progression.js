// Map order for Doom 1 episodes, including secret levels.

const SECRET_EXIT_FROM = { 1: 3, 2: 5, 3: 6, 4: 2 };
const AFTER_SECRET = { 1: 4, 2: 6, 3: 7, 4: 3 };
const PAR_TIMES = {
  1: [30, 75, 120, 90, 165, 180, 180, 30, 165],
  2: [90, 90, 90, 120, 90, 360, 240, 30, 170],
  3: [90, 45, 90, 150, 90, 90, 165, 30, 135],
  4: [165, 255, 135, 150, 180, 390, 135, 360, 180],
};

export function parseMapName(name) {
  const m = /^E(\d)M(\d)$/.exec(name);
  return m ? { episode: Number(m[1]), map: Number(m[2]) } : null;
}

export const mapName = (episode, map) => `E${episode}M${map}`;

// Returns the next map name, or null when the episode is over.
export function nextMap(current, exitType, available) {
  const p = parseMapName(current);
  if (!p) return null;
  let next;
  if (exitType === 'secret' && SECRET_EXIT_FROM[p.episode] === p.map) next = 9;
  else if (p.map === 9) next = AFTER_SECRET[p.episode];
  else if (p.map === 8) return null;
  else next = p.map + 1;
  const name = mapName(p.episode, next);
  return available.includes(name) ? name : null;
}

export function parTime(name) {
  const p = parseMapName(name);
  return p ? PAR_TIMES[p.episode]?.[p.map - 1] ?? 0 : 0;
}

export function episodesIn(available) {
  return [1, 2, 3, 4].filter((e) => available.includes(mapName(e, 1)));
}

export const EPISODE_NAMES = Object.freeze({
  1: 'Knee-Deep in the Dead',
  2: 'The Shores of Hell',
  3: 'Inferno',
  4: 'Thy Flesh Consumed',
});

// Short end-of-episode summaries (our own words, not Doom's finale text).
export const EPISODE_ENDINGS = Object.freeze({
  1: 'The Phobos Anomaly is silent. The Barons of Hell lie broken among the blocks, but the teleporter has carried you somewhere worse: Deimos, the moon that vanished. The fight goes on in The Shores of Hell.',
  2: 'The Cyberdemon is down and Deimos sits on the edge of Hell itself. There is only one way home, and it runs straight through the Inferno.',
  3: 'The Spider Mastermind is dead. Hell is quiet for now, and Earth is in sight. Something tells you it will not stay quiet for long.',
  4: 'Hell has followed you home, and you have sent it back again. The blocks settle. For now, Earth is safe.',
});
