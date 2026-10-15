// Compact animation/behaviour state notation, modelled on Doom's state table.
//
//   "A10 look"   frame A for 10 tics, call action "look" on entry
//   "F8! fire"   "!" = full bright
//   "N-1"        hold forever
// A sequence ends with "loop", "goto <seq>" or "stop" (remove the thing).

const FRAME = /^([A-Z\[\]\\])(-?\d+)(!?)(?:\s+(\w+))?$/;

export function parseFrame(text) {
  const m = FRAME.exec(text.trim());
  if (!m) throw new Error(`Bad state frame "${text}"`);
  return Object.freeze({ frame: m[1], tics: Number(m[2]), bright: m[3] === '!', action: m[4] ?? null });
}

export function parseSequence(name, steps) {
  const frames = [];
  let next = { type: 'loop' };
  for (const step of steps) {
    if (step === 'loop') next = { type: 'loop' };
    else if (step === 'stop') next = { type: 'stop' };
    else if (step.startsWith('goto ')) next = { type: 'goto', target: step.slice(5).trim() };
    else frames.push(parseFrame(step));
  }
  if (frames.length === 0) throw new Error(`State sequence "${name}" has no frames`);
  return Object.freeze({ name, frames: Object.freeze(frames), next: Object.freeze(next) });
}

export function defineStates(table) {
  const out = {};
  for (const [name, steps] of Object.entries(table)) out[name] = parseSequence(name, steps);
  return Object.freeze(out);
}

// Repeat each step n times (Doom's chase loops repeat frames with the same action).
export const times = (n, ...steps) => Array.from({ length: n }, () => steps).flat();
