// Play MUS songs with a small Web Audio synth (a stand-in for Doom's OPL music).

import { parseMus, MUS_TICKS_PER_SECOND, PERCUSSION_CHANNEL } from './mus.js';

const LOOKAHEAD_S = 0.25;
const SCHEDULE_MS = 40;
const MASTER_GAIN = 0.11;

// General MIDI program -> simple voice.
function voiceFor(program) {
  if (program < 8) return { wave: 'triangle', attack: 0.005, decay: 0.6, sustain: 0.25, release: 0.2 };
  if (program < 16) return { wave: 'sine', attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.2 };
  if (program < 24) return { wave: 'square', attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.1, gain: 0.5 };
  if (program < 32) return { wave: 'sawtooth', attack: 0.004, decay: 0.25, sustain: 0.55, release: 0.12, gain: 0.75, drive: program >= 29 };
  if (program < 40) return { wave: 'square', attack: 0.004, decay: 0.2, sustain: 0.5, release: 0.08, gain: 0.8, lowpass: 900 };
  if (program < 56) return { wave: 'sawtooth', attack: 0.06, decay: 0.2, sustain: 0.7, release: 0.3, gain: 0.45, lowpass: 2200 };
  if (program < 64) return { wave: 'sawtooth', attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.15, gain: 0.55, lowpass: 2600 };
  if (program < 80) return { wave: 'square', attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.12, gain: 0.45, lowpass: 2400 };
  if (program < 88) return { wave: 'square', attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.1, gain: 0.5 };
  if (program < 96) return { wave: 'triangle', attack: 0.25, decay: 0.3, sustain: 0.8, release: 0.6, gain: 0.7 };
  return { wave: 'triangle', attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.2, gain: 0.6 };
}

const freq = (note) => 440 * 2 ** ((note - 69) / 12);

export function createMusic(wad, getContext) {
  let ctx = null, out = null, noise = null, drive = null;
  let song = null, songName = null;
  let timer = null;
  let startTime = 0, eventIndex = 0, loopOffset = 0, pausedAt = 0;
  let enabled = true, paused = false, volume = 1;
  const channels = [];
  const active = new Map(); // `${ch}:${note}` -> voice

  function setup() {
    if (ctx) return true;
    ctx = getContext();
    if (!ctx) return false;
    out = ctx.createGain();
    out.gain.value = MASTER_GAIN * volume;
    out.connect(ctx.destination);
    drive = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 3); }
    drive.curve = curve;
    drive.connect(out);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function resetChannels() {
    channels.length = 0;
    for (let i = 0; i < 16; i++) channels.push({ program: 0, volume: 100, pan: 64, bend: 0 });
  }

  function release(key, when) {
    const v = active.get(key);
    if (!v) return;
    active.delete(key);
    const r = v.voice.release;
    v.gain.gain.cancelScheduledValues(when);
    v.gain.gain.setTargetAtTime(0, when, r / 3);
    v.osc.stop(when + r + 0.05);
  }

  function drum(note, velocity, when) {
    const g = ctx.createGain();
    g.connect(out);
    const level = velocity * 0.9;
    if (note === 35 || note === 36) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(130, when);
      o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      g.gain.setValueAtTime(level * 1.6, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
      o.connect(g); o.start(when); o.stop(when + 0.3);
      return;
    }
    if (note >= 41 && note <= 50 && note !== 42 && note !== 44 && note !== 46 && note !== 49) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(90 + (note - 41) * 18, when);
      o.frequency.exponentialRampToValueAtTime(50 + (note - 41) * 8, when + 0.2);
      g.gain.setValueAtTime(level, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
      o.connect(g); o.start(when); o.stop(when + 0.35);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    const hat = note === 42 || note === 44 || note === 46;
    const cymbal = note === 49 || note === 57 || note === 51 || note === 55;
    filter.type = hat || cymbal ? 'highpass' : 'bandpass';
    filter.frequency.value = hat ? 7000 : cymbal ? 5000 : 1800;
    const length = note === 46 ? 0.25 : hat ? 0.06 : cymbal ? 0.9 : 0.18;
    g.gain.setValueAtTime(level * (hat ? 0.5 : 0.9), when);
    g.gain.exponentialRampToValueAtTime(0.001, when + length);
    src.connect(filter).connect(g);
    src.start(when, Math.random() * 0.5);
    src.stop(when + length + 0.05);
  }

  function noteOn(e, when) {
    const ch = channels[e.channel];
    const velocity = (e.volume / 127) * (ch.volume / 127);
    if (e.channel === PERCUSSION_CHANNEL) { drum(e.note, velocity, when); return; }
    const key = `${e.channel}:${e.note}`;
    release(key, when);
    const voice = voiceFor(ch.program);
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.value = freq(e.note + ch.bend);
    const gain = ctx.createGain();
    const peak = velocity * (voice.gain ?? 1);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + voice.attack);
    gain.gain.setTargetAtTime(peak * voice.sustain, when + voice.attack, voice.decay / 3);
    let node = osc;
    if (voice.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = voice.lowpass;
      node = node.connect(lp);
    }
    node = node.connect(gain);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = (ch.pan - 64) / 64; node = node.connect(panner); }
    node.connect(voice.drive ? drive : out);
    osc.start(when);
    active.set(key, { osc, gain, voice, channel: e.channel, note: e.note });
  }

  function handle(e, when) {
    const ch = channels[e.channel];
    switch (e.type) {
      case 'on': noteOn(e, when); break;
      case 'off': release(`${e.channel}:${e.note}`, when); break;
      case 'bend': {
        ch.bend = ((e.value - 128) / 128) * 2;
        for (const v of active.values()) if (v.channel === e.channel) v.osc.frequency.setValueAtTime(freq(v.note + ch.bend), when);
        break;
      }
      case 'controller':
        if (e.controller === 0) ch.program = e.value;
        else if (e.controller === 3) ch.volume = e.value;
        else if (e.controller === 4) ch.pan = e.value;
        break;
      case 'system':
        if (e.value === 10 || e.value === 11) for (const key of [...active.keys()]) if (key.startsWith(`${e.channel}:`)) release(key, when);
        break;
      default: break;
    }
  }

  function schedule() {
    if (!song || paused) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    for (;;) {
      if (eventIndex >= song.events.length) {
        // Loop the song.
        loopOffset += song.duration / MUS_TICKS_PER_SECOND;
        eventIndex = 0;
        resetChannels();
        if (song.duration === 0) return;
      }
      const e = song.events[eventIndex];
      const when = startTime + loopOffset + e.time / MUS_TICKS_PER_SECOND;
      if (when > horizon) return;
      if (e.type !== 'end') handle(e, Math.max(when, ctx.currentTime));
      eventIndex++;
    }
  }

  function stopAll() {
    const now = ctx ? ctx.currentTime : 0;
    for (const key of [...active.keys()]) release(key, now);
    clearInterval(timer);
    timer = null;
  }

  return {
    play(name) {
      if (name === songName && song && !paused) return;
      songName = name;
      if (ctx) stopAll();
      song = null;
      if (!enabled || !setup()) return;
      const bytes = wad.bytes(name);
      if (!bytes) return;
      try {
        song = parseMus(bytes);
      } catch (err) {
        console.warn(`DoomDungeons: cannot play ${name}`, err);
        return;
      }
      resetChannels();
      eventIndex = 0;
      loopOffset = 0;
      startTime = ctx.currentTime + 0.1;
      paused = false;
      timer = setInterval(schedule, SCHEDULE_MS);
      schedule();
    },
    stop() { if (ctx) stopAll(); song = null; songName = null; },
    pause(on) {
      if (!ctx || !song) return;
      if (on && !paused) {
        paused = true;
        pausedAt = ctx.currentTime;
        for (const key of [...active.keys()]) release(key, ctx.currentTime);
      } else if (!on && paused) {
        paused = false;
        startTime += ctx.currentTime - pausedAt; // resume where we left off
      }
    },
    setEnabled(on) {
      enabled = on;
      if (!on) { const name = songName; this.stop(); songName = name; } else if (songName) { const name = songName; songName = null; this.play(name); }
    },
    setVolume(v) { volume = v; if (out) out.gain.value = MASTER_GAIN * v; },
    get enabled() { return enabled; },
  };
}
