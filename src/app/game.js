// Game controller: runs levels at Doom's 35 tics per second and moves between
// title, play, intermission and episode endings.

import { createLevel } from '../game/sim/level.js';
import { newPlayerState, carryOver } from '../game/sim/player.js';
import { TIC_MS, TICRATE } from '../game/constants.js';
import { buildLevelData } from './levelData.js';
import { createLevelScene } from '../render/scene.js';
import { nextMap, parTime, parseMapName } from './progression.js';

const MAX_CATCHUP_TICS = 8;

export function createGame({ renderer, resources, sprites, input, hud, automap, sfx, music, screens, onLeave }) {
  let session = null; // { skill, episode, carried }
  let level = null;
  let view = null;
  let mapName = null;
  let carriedAtStart = null;
  let running = false;
  let paused = false;
  let accumulator = 0;
  let lastTime = 0;
  let levelStart = 0;
  let deathShown = false;

  function playEvent(e) {
    if (e.type !== 'sound') return;
    if (e.global || !level) { sfx.play(e.name, { fallback: e.fallback }); return; }
    const p = level.playerMobj;
    const dx = e.x - p.x, dy = e.y - p.y;
    const distance = Math.hypot(dx, dy);
    // Pan by screen-space x: project onto the camera's right vector.
    const f = view.view.forward;
    const rightX = -f.z, rightY = -f.x; // camera right in Doom coordinates
    const pan = distance > 1 ? (dx * rightX + dy * rightY) / distance : 0;
    sfx.play(e.name, { distance, pan, fallback: e.fallback, source: e.source ?? null });
  }

  function drainEvents() {
    for (const e of level.events) {
      playEvent(e);
      view.onEvent(e);
      hud.event(e);
      if (e.type === 'message') hud.message(e.text);
    }
    level.events.length = 0;
  }

  function applyInput() {
    const player = level.player;
    const p = level.playerMobj;
    const axes = input.moveAxes();
    // Screen-relative movement: up = camera forward, right = camera right.
    const f = view.view.forward;
    const fx = f.x, fy = -f.z;
    const rx = fy, ry = -fx;
    player.input.moveX = fx * axes.y + rx * axes.x;
    player.input.moveY = fy * axes.y + ry * axes.x;
    if (input.mouse.inside) {
      const ground = view.pickGround(input.mouse.x, input.mouse.y, p.z + 32);
      if (ground) player.input.aimAngle = Math.atan2(ground.y - p.y, ground.x - p.x);
    }
    player.input.fire = input.fire();
    player.input.use = input.use();
    player.input.walk = input.walk();
    for (let slot = 1; slot <= 7; slot++) if (input.takePress(`Digit${slot}`)) player.input.weaponSlot = slot;
    const wheel = input.takeWheel();
    if (wheel) player.input.weaponCycle = Math.sign(wheel);
    if (input.takePress('KeyQ')) player.input.weaponCycle = -1;
  }

  async function startMap(name, carried) {
    screens.loading(`Loading ${name}…`);
    hud.show(false);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    view?.dispose();
    const data = buildLevelData(resources, name);
    mapName = name;
    carriedAtStart = carried;
    level = createLevel({ levelData: data, textures: resources.textures, mapName: name, skill: session.skill, carried });
    view = createLevelScene(renderer, resources, sprites, data);
    view.snapTo(level.playerMobj);
    screens.close();
    hud.show(true);
    automap.setLevel(level);
    automap.show(true);
    hud.setCenter(null);
    hud.message(name);
    music.play(`D_${name}`);
    deathShown = false;
    paused = false;
    accumulator = 0;
    lastTime = performance.now();
    levelStart = level.tic;
    input.clearPresses();
    running = true;
  }

  async function finishLevel(exitType) {
    running = false;
    const stats = { ...level.stats };
    const seconds = (level.tic - levelStart) / TICRATE;
    const carried = carryOver(level.player);
    const next = nextMap(mapName, exitType, resources.maps);
    const p = parseMapName(mapName);
    const patchName = (map) => (p ? `WILV${p.episode - 1}${map - 1}` : null);
    const nextP = next ? parseMapName(next) : null;
    hud.show(false);
    automap.show(false);
    music.play('D_INTER');
    await screens.intermission({
      background: resources.patches.picture(p ? `WIMAP${Math.min(2, p.episode - 1)}` : 'INTERPIC') ?? resources.patches.picture('INTERPIC'),
      finishedPatch: p ? resources.patches.url(patchName(p.map)) : null,
      enteringPatch: nextP ? resources.patches.url(patchName(nextP.map)) : null,
      finishedName: mapName,
      nextName: next,
      stats,
      time: seconds,
      par: parTime(mapName),
    });
    if (next) {
      await startMap(next, carried);
      return;
    }
    await onLeave({ type: 'episodeEnd', episode: p?.episode ?? 1 });
  }

  function tick() {
    applyInput();
    level.tick();
    drainEvents();
    if (level.player.dead && !deathShown) {
      deathShown = true;
      hud.setCenter('You died. Press E or click to restart the level.');
    }
    if (level.restart) {
      running = false;
      // Doom restarts a level from a pistol start after death.
      startMap(mapName, newPlayerState());
      return;
    }
    if (level.exit) finishLevel(level.exit);
  }

  function frame(now) {
    if (!running || !level) return;
    if (input.takePress('Escape') || input.takePress('KeyP')) {
      pause();
      return;
    }
    if (input.takePress('Tab')) automap.toggle();
    accumulator += now - lastTime;
    lastTime = now;
    let steps = 0;
    while (accumulator >= TIC_MS && running) {
      accumulator -= TIC_MS;
      tick();
      if (++steps >= MAX_CATCHUP_TICS) { accumulator = 0; break; }
    }
    if (!running || !view) return;
    const alpha = Math.min(1, accumulator / TIC_MS);
    view.render(level, alpha, Math.min(0.1, steps / TICRATE || 1 / 60), now / 1000);
    hud.update(level);
    automap.update();
  }

  async function pause() {
    running = false;
    paused = true;
    automap.show(false);
    music.pause(true);
    const choice = await onLeave({ type: 'pause' });
    music.pause(false);
    if (choice === 'resume') resume();
  }

  function resume() {
    if (!level) return;
    paused = false;
    running = true;
    lastTime = performance.now();
    input.clearPresses();
    hud.show(true);
    automap.show(true);
  }

  return {
    frame,
    async newGame(skill, episode) {
      session = { skill, episode };
      await startMap(`E${episode}M1`, newPlayerState());
    },
    async warp(name, skill) {
      session = { skill, episode: parseMapName(name)?.episode ?? 1 };
      await startMap(name, newPlayerState());
    },
    resume,
    restartLevel() { startMap(mapName, carriedAtStart ? { ...carriedAtStart, weapons: new Set(carriedAtStart.weapons), ammo: { ...carriedAtStart.ammo }, maxAmmo: { ...carriedAtStart.maxAmmo } } : newPlayerState()); },
    quitToTitle() {
      running = false;
      level = null;
      view?.dispose();
      view = null;
      hud.show(false);
      automap.show(false);
      automap.setLevel(null);
    },
    get active() { return !!level; },
    get paused() { return paused; },
    get level() { return level; },
    get scene() { return view; },
    resize() { view?.resize(); },
  };
}
