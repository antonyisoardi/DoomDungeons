// Ceilings and crushers (Doom's p_ceilng.c).

import { movePlane, MOVE, sectorsWithTag, highestCeilingAround } from './sectors.js';

const CEIL_SPEED = 1;
const CRUSHERS = new Set(['crushAndRaise', 'fastCrushAndRaise', 'silentCrushAndRaise']);

function finish(level, c) {
  level.sectors[c.sector].mover = null;
  level.removeThinker(c);
}

function thinkCeiling(level, c) {
  if (c.direction === 0) return; // in stasis
  const silent = c.type === 'silentCrushAndRaise';
  if (c.direction === 1) {
    const res = movePlane(level, c.sector, c.speed, c.top, false, 'ceiling', 1);
    if (!(level.tic & 7) && !silent) level.emitSectorSound(c.sector, 'DSSTNMOV');
    if (res !== MOVE.PASTDEST) return;
    if (CRUSHERS.has(c.type)) {
      if (silent) level.emitSectorSound(c.sector, 'DSPSTOP');
      c.direction = -1;
      c.speed = c.baseSpeed;
    } else finish(level, c);
    return;
  }
  const res = movePlane(level, c.sector, c.speed, c.bottom, c.crush, 'ceiling', -1);
  if (!(level.tic & 7) && !silent) level.emitSectorSound(c.sector, 'DSSTNMOV');
  if (res === MOVE.PASTDEST) {
    if (CRUSHERS.has(c.type)) {
      if (silent) level.emitSectorSound(c.sector, 'DSPSTOP');
      c.speed = c.baseSpeed; // back to full speed for the climb, as in Doom
      c.direction = 1;
    } else finish(level, c);
  } else if (res === MOVE.CRUSHED && (c.type === 'crushAndRaise' || c.type === 'silentCrushAndRaise' || c.type === 'lowerAndCrush')) {
    c.speed = CEIL_SPEED / 8; // slow down while squashing something
  }
}

function activateInStasis(level, tag) {
  for (const t of level.thinkers) {
    if (t.kind === 'ceiling' && t.tag === tag && t.direction === 0) t.direction = t.oldDirection;
  }
}

export function doCeiling(level, tag, type) {
  if (CRUSHERS.has(type)) activateInStasis(level, tag);
  let started = false;
  for (const s of sectorsWithTag(level, tag)) {
    const sec = level.sectors[s];
    if (sec.mover) continue;
    started = true;
    const c = { kind: 'ceiling', sector: s, tag, type, crush: false, speed: CEIL_SPEED, top: sec.ceiling, bottom: sec.floor, direction: -1 };
    switch (type) {
      case 'fastCrushAndRaise':
        Object.assign(c, { crush: true, top: sec.ceiling, bottom: sec.floor + 8, speed: CEIL_SPEED * 2 });
        break;
      case 'silentCrushAndRaise':
      case 'crushAndRaise':
        Object.assign(c, { crush: true, top: sec.ceiling, bottom: sec.floor + 8 });
        break;
      case 'lowerAndCrush':
        Object.assign(c, { crush: true, bottom: sec.floor + 8 });
        break;
      case 'lowerToFloor':
        c.bottom = sec.floor;
        break;
      case 'raiseToHighest':
        Object.assign(c, { top: highestCeilingAround(level, s), direction: 1 });
        break;
      default: break;
    }
    c.baseSpeed = c.speed;
    c.think = () => thinkCeiling(level, c);
    sec.mover = c;
    level.addThinker(c);
  }
  return started;
}

export function crushStop(level, tag) {
  let stopped = false;
  for (const t of level.thinkers) {
    if (t.kind === 'ceiling' && t.tag === tag && t.direction !== 0) {
      t.oldDirection = t.direction;
      t.direction = 0;
      stopped = true;
    }
  }
  return stopped;
}
