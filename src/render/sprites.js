// Sprite lookup (prefix + frame + rotation) and cached voxel geometry per sprite lump.

import * as THREE from 'three';
import { decodePicture } from '../wad/graphics.js';
import { voxelize } from './voxelize.js';

// Index S_START..S_END lumps: prefix -> frame letter -> rotations[0..7] of { lump, flip }.
export function indexSprites(wad) {
  const sprites = new Map();
  const put = (prefix, frame, rotation, lump, flip) => {
    if (!sprites.has(prefix)) sprites.set(prefix, new Map());
    const frames = sprites.get(prefix);
    if (!frames.has(frame)) frames.set(frame, new Array(8).fill(null));
    const rots = frames.get(frame);
    if (rotation === 0) for (let r = 0; r < 8; r++) rots[r] ??= { lump, flip, all: true };
    else rots[rotation - 1] = { lump, flip, all: false };
  };
  for (const lump of wad.between('S_START', 'S_END')) {
    const n = lump.name;
    if (n.length < 6) continue;
    const prefix = n.slice(0, 4);
    put(prefix, n[4], Number(n[5]), lump.name, false);
    if (n.length >= 8) put(prefix, n[6], Number(n[7]), lump.name, true);
  }
  return sprites;
}

export function createSpriteLibrary(wad, palette) {
  const index = indexSprites(wad);
  const geometries = new Map();
  const pictures = new Map();

  const picture = (lumpName) => {
    if (!pictures.has(lumpName)) pictures.set(lumpName, decodePicture(wad.bytes(lumpName)));
    return pictures.get(lumpName);
  };

  return {
    has: (prefix) => index.has(prefix),
    // rotation: 0..7 in Doom's order (0 = facing the viewer).
    frame(prefix, letter, rotation) {
      const rots = index.get(prefix)?.get(letter);
      if (!rots) return null;
      return rots[rotation] ?? rots.find(Boolean);
    },
    picture,
    geometry(lumpName, flip) {
      const key = `${lumpName}:${flip ? 1 : 0}`;
      if (geometries.has(key)) return geometries.get(key);
      const pic = picture(lumpName);
      let geometry = null;
      if (pic) {
        const v = voxelize(pic, palette, { flip });
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(v.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(v.colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(v.indices, 1));
        geometry.computeBoundingSphere();
      }
      geometries.set(key, geometry);
      return geometry;
    },
  };
}
