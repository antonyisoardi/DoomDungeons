// Sector neighbourhood queries and plane movement (Doom's p_spec.c helpers and T_MovePlane).

import { damageMobj } from '../combat.js';

export function otherSector(line, sectorIndex) {
  if (line.frontSector === sectorIndex) return line.backSector >= 0 ? line.backSector : -1;
  if (line.backSector === sectorIndex) return line.frontSector;
  return -1;
}

export function neighbours(level, s) {
  const out = [];
  for (const line of level.sectorLines[s]) {
    const o = otherSector(line, s);
    if (o >= 0 && o !== s) out.push(level.sectors[o]);
  }
  return out;
}

export const lowestFloorAround = (level, s) => Math.min(level.sectors[s].floor, ...neighbours(level, s).map((n) => n.floor));
export const highestFloorAround = (level, s) => Math.max(-500, ...neighbours(level, s).map((n) => n.floor));
export const lowestCeilingAround = (level, s) => Math.min(32767, ...neighbours(level, s).map((n) => n.ceiling));
export const highestCeilingAround = (level, s) => Math.max(0, ...neighbours(level, s).map((n) => n.ceiling));
export const minLightAround = (level, s, max) => Math.min(max, ...neighbours(level, s).map((n) => n.light));
export const maxLightAround = (level, s) => Math.max(0, ...neighbours(level, s).map((n) => n.light));

export function nextHighestFloor(level, s, height) {
  const higher = neighbours(level, s).map((n) => n.floor).filter((f) => f > height);
  return higher.length ? Math.min(...higher) : height;
}

export function sectorsWithTag(level, tag) {
  return level.sectors.filter((s) => s.tag === tag && tag !== 0).map((s) => s.index);
}

// Re-fit every thing touching a sector after a plane moved. Returns true if something does not fit.
export function changeSector(level, s, crush) {
  let noFit = false;
  const box = level.sectorBoxes[s];
  if (!box) return false;
  const things = [];
  level.blockmap.each(box.x0, box.y0, box.x1, box.y1, (m) => { things.push(m); return true; });
  for (const m of things) {
    if (m.removed || m.missile || m.noClip) continue;
    if (!touchesSector(level, m, s)) continue;
    const oldFloor = m.floorz;
    const pos = level.position(m, m.x, m.y);
    const onFloor = Math.abs(m.z - oldFloor) < 0.5 && !m.def.hanging;
    m.floorz = pos.floorz;
    m.ceilingz = pos.ceilingz;
    if (onFloor) m.z = m.floorz;
    else if (m.z + m.height > m.ceilingz) m.z = Math.max(m.floorz, m.ceilingz - m.height);
    if (m.ceilingz - m.floorz >= m.height) continue;

    if (m.corpse && !m.player) {
      // Crushed corpses become gibs.
      m.def = { ...m.def, states: null };
      m.seq = null;
      m.sprite = 'POL5';
      m.frame = 'A';
      m.tics = -1;
      m.height = 0;
      m.radius = 0;
      m.solid = false;
      continue;
    }
    if (m.dropped) { level.removeMobj(m); m.removed = true; continue; }
    if (!m.shootable) continue;
    noFit = true;
    if (crush && (level.tic & 3) === 0) {
      damageMobj(level, m, null, null, 10);
      level.spawnEffect('blood', m.x, m.y, m.z + m.height / 2);
    }
  }
  return noFit;
}

function touchesSector(level, m, s) {
  let touches = false;
  level.forEachCellOf(m, (cell) => {
    if (cell >= 0 && level.grid.sector[cell] === s) touches = true;
    return !touches;
  });
  return touches;
}

export const MOVE = Object.freeze({ OK: 'ok', CRUSHED: 'crushed', PASTDEST: 'pastdest' });

// Doom's T_MovePlane. which: 'floor' | 'ceiling'; direction: 1 up, -1 down.
export function movePlane(level, s, speed, dest, crush, which, direction) {
  const sec = level.sectors[s];
  const last = sec[which];
  const restore = () => { sec[which] = last; changeSector(level, s, crush); };

  if (which === 'floor' && direction < 0) {
    if (sec.floor - speed < dest) {
      sec.floor = dest;
      if (changeSector(level, s, crush)) restore();
      return MOVE.PASTDEST;
    }
    sec.floor -= speed;
    if (changeSector(level, s, crush)) { restore(); return MOVE.CRUSHED; }
    return MOVE.OK;
  }
  if (which === 'floor') {
    if (sec.floor + speed > dest) {
      sec.floor = dest;
      if (changeSector(level, s, crush)) restore();
      return MOVE.PASTDEST;
    }
    sec.floor += speed;
    if (changeSector(level, s, crush)) {
      if (crush) return MOVE.CRUSHED;
      restore();
      return MOVE.CRUSHED;
    }
    return MOVE.OK;
  }
  if (direction < 0) {
    if (sec.ceiling - speed < dest) {
      sec.ceiling = dest;
      if (changeSector(level, s, crush)) restore();
      return MOVE.PASTDEST;
    }
    sec.ceiling -= speed;
    if (changeSector(level, s, crush)) {
      if (crush) return MOVE.CRUSHED;
      restore();
      return MOVE.CRUSHED;
    }
    return MOVE.OK;
  }
  if (sec.ceiling + speed > dest) {
    sec.ceiling = dest;
    changeSector(level, s, crush);
    return MOVE.PASTDEST;
  }
  sec.ceiling += speed;
  changeSector(level, s, crush);
  return MOVE.OK;
}
