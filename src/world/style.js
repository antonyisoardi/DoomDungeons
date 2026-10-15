// Visual and physical constants for turning Doom sectors into blocks.

export const WALL_HEIGHT = 64; // walls stand this far above the highest neighbouring floor
export const DOOR_HEIGHT = 64; // a fully closed door block rises this high
export const PASSABLE_GAP = 56; // Doom player height: a sector this tall or more is open
export const MAX_STEP = 24; // Doom's step-up limit

export const FACE_SHADE = Object.freeze({ TOP: 1.0, NORTH: 0.82, SOUTH: 0.9, EAST: 0.7, WEST: 0.74, WALL_TOP: 0.55 });

export const KIND = Object.freeze({ FLOOR: 0, WALL: 1, DOOR: 2 });

// How high a sector's block stands. Closed doors (and any sector too low to walk
// into) rise up like a wall; as the ceiling opens they sink back to the floor.
export function displayTop(floor, ceiling) {
  const gap = ceiling - floor;
  const closed = Math.min(1, Math.max(0, 1 - gap / PASSABLE_GAP));
  return floor + DOOR_HEIGHT * closed;
}

// Doom light level (0-255) to a brightness multiplier tuned for a top-down view.
export const lightToBrightness = (light) => 0.22 + 0.9 * Math.min(1, Math.max(0, light / 255));
