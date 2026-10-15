// Player settings persisted in localStorage (best effort).

const KEY = 'doomdungeons.settings';
const DEFAULTS = Object.freeze({ music: true, musicVolume: 0.75, sfxVolume: 0.75 });

const clamp01 = (v, d) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      music: typeof raw.music === 'boolean' ? raw.music : DEFAULTS.music,
      musicVolume: clamp01(raw.musicVolume, DEFAULTS.musicVolume),
      sfxVolume: clamp01(raw.sfxVolume, DEFAULTS.sfxVolume),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage disabled: settings just won't persist.
  }
}
