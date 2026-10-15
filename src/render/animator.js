// Texture changes at runtime: Doom's animated flats/walls, switch flips and
// floor flats changed by specials.

import { imageToRgba, resolveTileImage } from './atlas.js';

const ANIM_TICS = 8;

// Doom's built-in animation sequences (first, last, isFlat). Frames run in WAD order.
const ANIMDEFS = [
  ['NUKAGE1', 'NUKAGE3', true], ['FWATER1', 'FWATER4', true], ['SWATER1', 'SWATER4', true],
  ['LAVA1', 'LAVA4', true], ['BLOOD1', 'BLOOD3', true], ['RROCK05', 'RROCK08', true],
  ['SLIME01', 'SLIME04', true], ['SLIME05', 'SLIME08', true], ['SLIME09', 'SLIME12', true],
  ['BLODGR1', 'BLODGR4', false], ['SLADRIP1', 'SLADRIP3', false], ['BLODRIP1', 'BLODRIP4', false],
  ['FIREWALA', 'FIREWALL', false], ['GSTFONT1', 'GSTFONT3', false], ['FIRELAVA', 'FIRELAV3', false],
  ['FIREMAG1', 'FIREMAG3', false], ['FIREBLU1', 'FIREBLU2', false], ['ROCKRED1', 'ROCKRED3', false],
  ['BFALL1', 'BFALL4', false], ['SFALL1', 'SFALL4', false], ['WFALL1', 'WFALL4', false], ['DBRAIN1', 'DBRAIN4', false],
];

function flatSequence(resources, first, last) {
  const names = [...resources.flats.keys()];
  const a = names.indexOf(first), b = names.indexOf(last);
  return a >= 0 && b > a ? names.slice(a, b + 1) : null;
}

function textureSequence(first, last) {
  // Wall texture frames share a stem and count up (SLADRIP1..3, FIREWALA..L).
  const stem = first.slice(0, -1);
  const from = first.at(-1), to = last.at(-1);
  if (last.slice(0, -1) !== stem) return [first, last];
  const out = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(stem + String.fromCharCode(c));
  return out;
}

export function createAnimator(world, levelData, resources) {
  const { atlas, mesh } = levelData;
  const tileAttr = world.object.geometry.getAttribute('aTile');
  const sequences = [];

  for (const [first, last, isFlat] of ANIMDEFS) {
    const names = isFlat ? flatSequence(resources, first, last) : textureSequence(first, last);
    if (!names) continue;
    const prefix = isFlat ? 'F' : 'T';
    const keys = names.map((n) => `${prefix}:${n}`);
    const present = keys.filter((k) => atlas.rects.has(k));
    if (!present.length) continue;
    const frames = keys.map((k) => resolveTileImage(k, resources)).filter(Boolean);
    if (frames.length < 2) continue;
    const rgba = frames.map((img) => imageToRgba(img, resources.palette));
    for (const key of present) sequences.push({ key, frames: rgba, offset: keys.indexOf(key) });
  }

  let lastStep = -1;

  function setTile(vertexStart, count, key) {
    const r = atlas.rects.get(key);
    if (!r) return;
    for (let v = vertexStart; v < vertexStart + count; v++) tileAttr.setXYZW(v, r.x, r.y, r.width, r.height);
    tileAttr.needsUpdate = true;
  }

  return {
    tick(tic) {
      const step = Math.floor(tic / ANIM_TICS);
      if (step === lastStep) return;
      lastStep = step;
      for (const s of sequences) {
        const frame = s.frames[(step + s.offset) % s.frames.length];
        const r = atlas.rects.get(s.key);
        if (frame.length === r.width * r.height * 4) world.writeTile(s.key, frame);
      }
    },
    setLineTexture(line, part, texture) {
      for (const face of mesh.lineFaces.get(line) ?? []) {
        if (face.part === part) setTile(face.vertex, 4, `T:${texture}`);
      }
    },
    setSectorFlat(sector, flat) {
      for (const v of mesh.sectorTops.get(sector) ?? []) setTile(v, 4, `F:${flat}`);
    },
  };
}
