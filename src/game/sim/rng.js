// Deterministic 0-255 random source standing in for Doom's P_Random table.

export function createRng(seed = 0x1234567) {
  let state = seed >>> 0 || 1;
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state & 0xff;
  };
  return {
    random: next,
    // (P_Random() - P_Random()): symmetric spread in -255..255
    spread: () => next() - next(),
    range: (min, max) => min + (next() % (max - min + 1)),
  };
}
