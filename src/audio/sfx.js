// Sound effects from the WAD's DMX lumps (8-bit unsigned PCM), positioned
// relative to the listener with Doom's distance falloff.

const CLIP_DISTANCE = 1200;
const CLOSE_DISTANCE = 160;
const MAX_VOICES = 24;

export function decodeDmx(bytes) {
  if (!bytes || bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0, true) !== 3) return null;
  const rate = view.getUint16(2, true);
  const count = view.getUint32(4, true);
  // DMX pads 16 bytes before and after the samples.
  const start = 8 + 16;
  const length = Math.max(0, Math.min(count - 32, bytes.length - start - 16));
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = (bytes[start + i] - 128) / 128;
  return { rate, samples };
}

export function createSfx(wad) {
  let ctx = null;
  let master = null;
  let volume = 0.7;
  let enabled = true;
  const buffers = new Map();
  const voices = [];

  function ensureContext() {
    if (ctx) return ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return ctx;
  }

  function buffer(name) {
    if (buffers.has(name)) return buffers.get(name);
    const decoded = decodeDmx(wad.bytes(name));
    let buf = null;
    if (decoded && decoded.samples.length && ensureContext()) {
      buf = ctx.createBuffer(1, decoded.samples.length, decoded.rate);
      buf.copyToChannel(decoded.samples, 0);
    }
    buffers.set(name, buf);
    return buf;
  }

  return {
    // Must be called from a user gesture once (browser autoplay rules).
    unlock() {
      ensureContext();
      if (ctx?.state === 'suspended') ctx.resume();
    },
    get context() { return ensureContext(); },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setEnabled(on) { enabled = on; },
    get enabled() { return enabled; },
    // pan: -1..1 screen position; distance in map units (0 = at the listener).
    play(name, { distance = 0, pan = 0, fallback = null, source = null } = {}) {
      if (!enabled || !ensureContext() || ctx.state !== 'running') return;
      if (distance > CLIP_DISTANCE) return;
      const buf = buffer(name) ?? (fallback ? buffer(fallback) : null);
      if (!buf) return;
      // One sound per source at a time, as in Doom.
      if (source !== null) {
        for (const v of voices) if (v.source === source) v.node.stop();
      }
      const gain = distance <= CLOSE_DISTANCE ? 1 : (CLIP_DISTANCE - distance) / (CLIP_DISTANCE - CLOSE_DISTANCE);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, pan * 0.8));
        node.connect(g).connect(panner).connect(master);
      } else node.connect(g).connect(master);
      const voice = { node, source };
      voices.push(voice);
      node.onended = () => {
        const i = voices.indexOf(voice);
        if (i >= 0) voices.splice(i, 1);
      };
      if (voices.length > MAX_VOICES) voices[0].node.stop();
      node.start();
    },
  };
}
