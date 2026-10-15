// DoomDungeons entry point: find a WAD, show the title menu, run the game.

import { parseWad } from './wad/wad.js';
import { createResources } from './app/resources.js';
import { createSpriteLibrary } from './render/sprites.js';
import { createRenderer } from './render/scene.js';
import { createInput } from './app/input.js';
import { createGame } from './app/game.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createPatchCache } from './ui/patches.js';
import { createAutomap } from './ui/automap.js';
import { CAMERA } from './render/camera.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import { fetchBundledWad, loadStoredWad, storeWad, forgetWad, readFile } from './app/wadSource.js';
import { episodesIn, EPISODE_NAMES, EPISODE_ENDINGS } from './app/progression.js';
import { SKILL, SKILL_NAMES } from './game/constants.js';
import { loadSettings, saveSettings } from './app/settings.js';

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const settings = loadSettings();

function validateWad(buffer) {
  const wad = parseWad(buffer);
  if (!wad.has('PLAYPAL')) throw new Error('That WAD has no palette. Choose an IWAD such as DOOM.WAD or DOOM1.WAD.');
  if (!wad.mapNames().some((m) => /^E\dM\d$/.test(m))) {
    throw new Error('DoomDungeons plays Doom 1 maps (ExMy). This WAD has none.');
  }
  return wad;
}

async function obtainWad(screens) {
  const bundled = await fetchBundledWad();
  if (bundled) return validateWad(bundled.buffer);
  const stored = await loadStoredWad();
  if (stored) {
    try { return validateWad(stored.buffer); } catch { await forgetWad(); }
  }
  return new Promise((resolve) => {
    screens.wadPicker({
      message: 'DoomDungeons rebuilds Doom from your own copy of its data. Choose a Doom WAD to start.',
      async onFile(file) {
        const record = await readFile(file);
        const wad = validateWad(record.buffer);
        await storeWad(record);
        resolve(wad);
      },
    });
  });
}

async function boot() {
  const bootScreens = createScreens(uiRoot);
  bootScreens.loading('Looking for a WAD…');
  const wad = await obtainWad(bootScreens);
  bootScreens.loading('Building blocks…');

  const base = createResources(wad);
  const patches = createPatchCache(wad, base.palette);
  const resources = Object.freeze({ ...base, patches });
  const sprites = createSpriteLibrary(wad, resources.palette);
  const sfx = createSfx(wad);
  const music = createMusic(wad, () => sfx.context);
  sfx.setVolume(settings.sfxVolume);
  music.setVolume(settings.musicVolume);
  music.setEnabled(settings.music);

  bootScreens.close();
  const screens = createScreens(uiRoot, { sound: (name) => sfx.play(name) });
  const hud = createHud(uiRoot, patches);
  const automap = createAutomap(uiRoot, CAMERA.YAW);
  automap.show(false);
  const title = () => patches.picture('TITLEPIC');

  const game = createGame({
    renderer, resources, sprites, input, hud, automap, sfx, music, screens,
    async onLeave(reason) {
      if (reason.type === 'pause') return pauseMenu();
      if (reason.type === 'episodeEnd') {
        music.play('D_VICTOR');
        await screens.story({
          title: `${EPISODE_NAMES[reason.episode] ?? 'Episode'} complete`,
          text: EPISODE_ENDINGS[reason.episode] ?? 'You made it.',
          background: patches.picture(reason.episode === 1 ? 'HELP2' : 'CREDIT') ?? title(),
        });
        game.quitToTitle();
        titleMenu();
      }
      return null;
    },
  });

  async function optionsMenu(back) {
    for (;;) {
      const choice = await screens.menu({
        title: 'Options',
        background: title(),
        cancellable: true,
        items: [
          { label: `Music: ${settings.music ? 'On' : 'Off'}`, value: 'music' },
          { label: `Music volume: ${Math.round(settings.musicVolume * 100)}%`, value: 'musicVol' },
          { label: `Sound volume: ${Math.round(settings.sfxVolume * 100)}%`, value: 'sfxVol' },
          { label: 'Use a different WAD', value: 'wad' },
          { label: 'Back', value: 'back' },
        ],
      });
      if (choice === 'music') { settings.music = !settings.music; music.setEnabled(settings.music); }
      else if (choice === 'musicVol') { settings.musicVolume = (Math.round(settings.musicVolume * 4) + 1) % 5 / 4; music.setVolume(settings.musicVolume); }
      else if (choice === 'sfxVol') { settings.sfxVolume = (Math.round(settings.sfxVolume * 4) + 1) % 5 / 4; sfx.setVolume(settings.sfxVolume); }
      else if (choice === 'wad') { await forgetWad(); location.reload(); return; }
      else { saveSettings(settings); return back(); }
      saveSettings(settings);
    }
  }

  async function controlsScreen(back) {
    await screens.menu({
      title: 'Controls',
      background: title(),
      cancellable: true,
      items: [
        { label: 'Move', hint: 'W A S D / arrows', value: 0, disabled: true },
        { label: 'Aim', hint: 'mouse', value: 0, disabled: true },
        { label: 'Fire', hint: 'left mouse button', value: 0, disabled: true },
        { label: 'Use / open', hint: 'E, Space or right mouse button', value: 0, disabled: true },
        { label: 'Weapons', hint: '1–7, mouse wheel, Q', value: 0, disabled: true },
        { label: 'Walk', hint: 'hold Shift', value: 0, disabled: true },
        { label: 'Zoom', hint: '+ / −', value: 0, disabled: true },
        { label: 'Map', hint: 'Tab', value: 0, disabled: true },
        { label: 'Music on/off', hint: 'M', value: 0, disabled: true },
        { label: 'Pause', hint: 'Esc or P', value: 0, disabled: true },
        { label: 'Back', value: 'back' },
      ],
    });
    return back();
  }

  async function pauseMenu() {
    hud.show(false);
    const choice = await screens.menu({
      title: 'Paused',
      cancellable: true,
      items: [
        { label: 'Resume', value: 'resume' },
        { label: 'Restart level', value: 'restart' },
        { label: 'Options', value: 'options' },
        { label: 'Controls', value: 'controls' },
        { label: 'Quit to title', value: 'quit' },
      ],
    });
    if (choice === 'restart') { game.restartLevel(); return null; }
    if (choice === 'options') return optionsMenu(pauseMenu);
    if (choice === 'controls') return controlsScreen(pauseMenu);
    if (choice === 'quit') { game.quitToTitle(); music.play('D_INTRO'); titleMenu(); return null; }
    return 'resume';
  }

  async function newGameMenu() {
    const episodes = episodesIn(resources.maps);
    let episode = episodes[0];
    if (episodes.length > 1) {
      episode = await screens.menu({
        title: 'Which episode?',
        background: title(),
        cancellable: true,
        items: episodes.map((e) => ({ label: EPISODE_NAMES[e], value: e })),
      });
      if (!episode) return titleMenu();
    }
    const skill = await screens.menu({
      title: 'Choose skill level',
      background: title(),
      cancellable: true,
      items: SKILL_NAMES.map((name, value) => ({ label: name, value: value + 1 })),
    });
    if (!skill) return titleMenu();
    await game.newGame(skill - 1, episode);
  }

  async function titleMenu() {
    music.play('D_INTRO');
    const hasFullGame = episodesIn(resources.maps).length > 1;
    const choice = await screens.menu({
      logo: 'DoomDungeons',
      background: title(),
      subtitle: hasFullGame ? 'The Ultimate Block Hell' : 'Shareware Episode 1: Knee-Deep in the Dead',
      items: [
        { label: 'New Game', value: 'new' },
        { label: 'Options', value: 'options' },
        { label: 'Controls', value: 'controls' },
      ],
      footer: 'DoomDungeons is a fan project. Doom is a trademark of id Software.',
    });
    sfx.unlock();
    if (choice === 'new') return newGameMenu();
    if (choice === 'options') return optionsMenu(titleMenu);
    if (choice === 'controls') return controlsScreen(titleMenu);
    return titleMenu();
  }

  window.addEventListener('pointerdown', () => sfx.unlock());
  window.addEventListener('keydown', () => sfx.unlock());
  window.addEventListener('resize', () => game.resize());
  window.addEventListener('keydown', (e) => {
    const scene = game.scene;
    if (!scene || screens.open) return;
    if (e.key === '+' || e.key === '=') scene.view.setZoom(scene.view.zoom * 0.9);
    if (e.key === '-' || e.key === '_') scene.view.setZoom(scene.view.zoom * 1.1);
    if (e.code === 'KeyM') { settings.music = !settings.music; music.setEnabled(settings.music); saveSettings(settings); }
  });

  renderer.setAnimationLoop((now) => game.frame(now));

  // Debug/warp: ?map=E1M3&skill=3
  const params = new URLSearchParams(location.search);
  const warp = params.get('map');
  if (warp && resources.maps.includes(warp.toUpperCase())) {
    const skill = Math.min(SKILL.NIGHTMARE, Math.max(0, Number(params.get('skill') ?? 3) - 1));
    await game.warp(warp.toUpperCase(), skill);
  } else {
    titleMenu();
  }
  window.__doomdungeons = { game, resources, settings };
}

boot().catch((err) => {
  console.error(err);
  uiRoot.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = `DoomDungeons could not start: ${err.message}`;
  uiRoot.appendChild(box);
});
