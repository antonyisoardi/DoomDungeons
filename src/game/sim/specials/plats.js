// Lifts and moving platforms (Doom's p_plats.c).

import { movePlane, MOVE, sectorsWithTag, lowestFloorAround, highestFloorAround, nextHighestFloor } from './sectors.js';
import { TICRATE } from '../../constants.js';

const PLAT_SPEED = 1;
const PLAT_WAIT = 3 * TICRATE;
const STAYS_UP = new Set(['downWaitUpStay', 'blazeDWUS', 'raiseAndChange', 'raiseToNearestAndChange']);

function soundStart(level, p) { level.emitSectorSound(p.sector, 'DSPSTART'); }
function soundStop(level, p) { level.emitSectorSound(p.sector, 'DSPSTOP'); }

function finish(level, p) {
  level.sectors[p.sector].mover = null;
  level.removeThinker(p);
}

function thinkPlat(level, p) {
  if (p.status === 'stasis') return;
  if (p.status === 'up') {
    const res = movePlane(level, p.sector, p.speed, p.high, p.crush, 'floor', 1);
    if ((p.type === 'raiseAndChange' || p.type === 'raiseToNearestAndChange') && !(level.tic & 7)) {
      level.emitSectorSound(p.sector, 'DSSTNMOV');
    }
    if (res === MOVE.CRUSHED && !p.crush) {
      p.count = p.wait;
      p.status = 'down';
      soundStart(level, p);
    } else if (res === MOVE.PASTDEST) {
      p.count = p.wait;
      p.status = 'waiting';
      soundStop(level, p);
      if (STAYS_UP.has(p.type)) finish(level, p);
    }
  } else if (p.status === 'down') {
    const res = movePlane(level, p.sector, p.speed, p.low, false, 'floor', -1);
    if (res === MOVE.PASTDEST) {
      p.count = p.wait;
      p.status = 'waiting';
      soundStop(level, p);
    }
  } else if (p.status === 'waiting') {
    if (--p.count > 0) return;
    p.status = level.sectors[p.sector].floor === p.low ? 'up' : 'down';
    soundStart(level, p);
  }
}

// Re-activate perpetual platforms that were stopped (P_ActivateInStasis).
function activateInStasis(level, tag) {
  for (const t of level.thinkers) {
    if (t.kind === 'plat' && t.tag === tag && t.status === 'stasis') t.status = t.oldStatus;
  }
}

export function doPlat(level, line, tag, type, amount = 0) {
  if (type === 'perpetualRaise') activateInStasis(level, tag);
  let started = false;
  for (const s of sectorsWithTag(level, tag)) {
    const sec = level.sectors[s];
    if (sec.mover) continue;
    started = true;
    const p = { kind: 'plat', sector: s, tag, type, crush: false, speed: PLAT_SPEED, wait: 0, low: sec.floor, high: sec.floor, status: 'up', count: 0 };
    p.think = () => thinkPlat(level, p);
    const front = line ? level.sectors[line.frontSector] : null;
    switch (type) {
      case 'raiseToNearestAndChange':
        p.speed = PLAT_SPEED / 2;
        if (front) sec.floorFlat = front.floorFlat;
        p.high = nextHighestFloor(level, s, sec.floor);
        sec.special = 0;
        level.emitSectorSound(s, 'DSSTNMOV');
        break;
      case 'raiseAndChange':
        p.speed = PLAT_SPEED / 2;
        if (front) sec.floorFlat = front.floorFlat;
        p.high = sec.floor + amount;
        level.emitSectorSound(s, 'DSSTNMOV');
        break;
      case 'downWaitUpStay':
      case 'blazeDWUS':
        p.speed = PLAT_SPEED * (type === 'blazeDWUS' ? 8 : 4);
        p.low = Math.min(lowestFloorAround(level, s), sec.floor);
        p.high = sec.floor;
        p.wait = PLAT_WAIT;
        p.status = 'down';
        soundStart(level, p);
        break;
      case 'perpetualRaise':
        p.low = Math.min(lowestFloorAround(level, s), sec.floor);
        p.high = Math.max(highestFloorAround(level, s), sec.floor);
        p.wait = PLAT_WAIT;
        p.status = level.rng.random() & 1 ? 'up' : 'down';
        soundStart(level, p);
        break;
      default: break;
    }
    if (front && (type === 'raiseAndChange' || type === 'raiseToNearestAndChange')) {
      level.emit({ type: 'floorFlat', sector: s, flat: sec.floorFlat });
    }
    sec.mover = p;
    level.addThinker(p);
  }
  return started;
}

export function stopPlat(level, tag) {
  for (const t of level.thinkers) {
    if (t.kind === 'plat' && t.tag === tag && t.status !== 'stasis') {
      t.oldStatus = t.status;
      t.status = 'stasis';
    }
  }
  return true;
}
