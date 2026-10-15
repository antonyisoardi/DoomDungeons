// Moving floors, stairs and donuts (Doom's p_floor.c).

import {
  movePlane, MOVE, sectorsWithTag, lowestFloorAround, highestFloorAround,
  lowestCeilingAround, nextHighestFloor, otherSector,
} from './sectors.js';

const FLOOR_SPEED = 1;

function createFloor(level, s, props) {
  const floor = {
    kind: 'floor', sector: s, crush: false, newFlat: null, newSpecial: null, ...props,
    think: () => thinkFloor(level, floor),
  };
  level.sectors[s].mover = floor;
  level.addThinker(floor);
  return floor;
}

function thinkFloor(level, f) {
  const res = movePlane(level, f.sector, f.speed, f.dest, f.crush, 'floor', f.direction);
  if (!(level.tic & 7)) level.emitSectorSound(f.sector, 'DSSTNMOV');
  if (res !== MOVE.PASTDEST) return;
  const sec = level.sectors[f.sector];
  if (f.newFlat !== null) {
    sec.floorFlat = f.newFlat;
    level.emit({ type: 'floorFlat', sector: f.sector, flat: f.newFlat });
  }
  if (f.newSpecial !== null) sec.special = f.newSpecial;
  sec.mover = null;
  level.removeThinker(f);
  level.emitSectorSound(f.sector, 'DSPSTOP');
}

// Height a sector rises by for raiseToTexture: its shortest lower texture.
function shortestLowerTexture(level, s) {
  let min = 32767;
  for (const line of level.sectorLines[s]) {
    if (line.back < 0) continue;
    for (const side of [line.front, line.back]) {
      const tex = level.textures.get(level.map.sidedefs[side].lower);
      if (tex) min = Math.min(min, tex.height);
    }
  }
  return min;
}

function lowestNeighbourAtHeight(level, s, height) {
  for (const line of level.sectorLines[s]) {
    const o = otherSector(line, s);
    if (o >= 0 && level.sectors[o].floor === height) return level.sectors[o];
  }
  return null;
}

// EV_DoFloor
export function doFloor(level, line, tag, type) {
  let started = false;
  for (const s of sectorsWithTag(level, tag)) {
    const sec = level.sectors[s];
    if (sec.mover) continue;
    started = true;
    const f = { speed: FLOOR_SPEED, direction: 1, dest: sec.floor };
    switch (type) {
      case 'lowerFloor': Object.assign(f, { direction: -1, dest: highestFloorAround(level, s) }); break;
      case 'lowerFloorToLowest': Object.assign(f, { direction: -1, dest: lowestFloorAround(level, s) }); break;
      case 'turboLower': {
        let dest = highestFloorAround(level, s);
        if (dest !== sec.floor) dest += 8;
        Object.assign(f, { direction: -1, speed: FLOOR_SPEED * 4, dest });
        break;
      }
      case 'raiseFloorCrush':
      case 'raiseFloor': {
        let dest = Math.min(lowestCeilingAround(level, s), sec.ceiling);
        if (type === 'raiseFloorCrush') dest -= 8;
        Object.assign(f, { dest, crush: type === 'raiseFloorCrush' });
        break;
      }
      case 'raiseFloorTurbo': Object.assign(f, { speed: FLOOR_SPEED * 4, dest: nextHighestFloor(level, s, sec.floor) }); break;
      case 'raiseFloorToNearest': f.dest = nextHighestFloor(level, s, sec.floor); break;
      case 'raiseFloor24': f.dest = sec.floor + 24; break;
      case 'raiseFloor512': f.dest = sec.floor + 512; break;
      case 'raiseFloor24AndChange': {
        const front = level.sectors[line.frontSector];
        f.dest = sec.floor + 24;
        sec.floorFlat = front.floorFlat;
        sec.special = front.special;
        level.emit({ type: 'floorFlat', sector: s, flat: front.floorFlat });
        break;
      }
      case 'raiseToTexture': f.dest = sec.floor + shortestLowerTexture(level, s); break;
      case 'lowerAndChange': {
        f.direction = -1;
        f.dest = lowestFloorAround(level, s);
        const model = lowestNeighbourAtHeight(level, s, f.dest);
        if (model) { f.newFlat = model.floorFlat; f.newSpecial = model.special; }
        break;
      }
      default: break;
    }
    createFloor(level, s, f);
  }
  return started;
}

// EV_BuildStairs: each step rises one stair height above the last.
export function buildStairs(level, tag, type) {
  const stairSize = type === 'turbo16' ? 16 : 8;
  const speed = type === 'turbo16' ? FLOOR_SPEED * 4 : FLOOR_SPEED / 4;
  let started = false;
  for (const first of sectorsWithTag(level, tag)) {
    if (level.sectors[first].mover) continue;
    started = true;
    let s = first;
    let height = level.sectors[s].floor + stairSize;
    createFloor(level, s, { direction: 1, speed, dest: height });
    const flat = level.sectors[s].floorFlat;
    for (;;) {
      let next = -1;
      for (const line of level.sectorLines[s]) {
        if (line.back < 0 || line.frontSector !== s) continue;
        const t = line.backSector;
        if (level.sectors[t].floorFlat !== flat) continue;
        height += stairSize;
        if (level.sectors[t].mover) continue;
        next = t;
        break;
      }
      if (next < 0) break;
      s = next;
      createFloor(level, s, { direction: 1, speed, dest: height });
    }
  }
  return started;
}

// EV_DoDonut: the ring rises to the outer floor while the centre lowers.
export function doDonut(level, tag) {
  let started = false;
  for (const s1 of sectorsWithTag(level, tag)) {
    if (level.sectors[s1].mover) continue;
    const firstLine = level.sectorLines[s1][0];
    const s2 = firstLine ? otherSector(firstLine, s1) : -1;
    if (s2 < 0) continue;
    let s3 = -1;
    for (const line of level.sectorLines[s2]) {
      const o = otherSector(line, s2);
      if (line.back >= 0 && o !== s1 && o >= 0) { s3 = o; break; }
    }
    if (s3 < 0) continue;
    started = true;
    const outer = level.sectors[s3];
    createFloor(level, s2, { direction: 1, speed: FLOOR_SPEED / 2, dest: outer.floor, newFlat: outer.floorFlat, newSpecial: 0 });
    createFloor(level, s1, { direction: -1, speed: FLOOR_SPEED / 2, dest: outer.floor });
  }
  return started;
}
