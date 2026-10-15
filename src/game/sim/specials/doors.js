// Vertical doors (Doom's p_doors.c).

import { movePlane, MOVE, lowestCeilingAround, sectorsWithTag } from './sectors.js';
import { TICRATE } from '../../constants.js';

const VDOOR_SPEED = 2;
const VDOOR_WAIT = 150;
const BLAZE = new Set(['blazeRaise', 'blazeOpen', 'blazeClose']);

function sound(level, s, open, blaze) {
  const name = blaze ? (open ? 'DSBDOPN' : 'DSBDCLS') : open ? 'DSDOROPN' : 'DSDORCLS';
  level.emitSectorSound(s, name, open ? 'DSDOROPN' : 'DSDORCLS');
}

function createDoor(level, s, type, direction, topHeight, speed) {
  const door = {
    kind: 'door', sector: s, type, direction, topHeight, speed,
    topWait: VDOOR_WAIT, countdown: 0,
    think: () => thinkDoor(level, door),
  };
  level.sectors[s].mover = door;
  level.addThinker(door);
  return door;
}

function finish(level, door) {
  level.sectors[door.sector].mover = null;
  level.removeThinker(door);
}

function thinkDoor(level, door) {
  const s = door.sector;
  const sec = level.sectors[s];
  const blaze = BLAZE.has(door.type);
  if (door.direction === 0) {
    if (--door.countdown > 0) return;
    if (door.type === 'normal' || door.type === 'blazeRaise') { door.direction = -1; sound(level, s, false, blaze); }
    else if (door.type === 'close30ThenOpen') { door.direction = 1; sound(level, s, true, false); }
    return;
  }
  if (door.direction === 2) {
    // raiseIn5Mins initial wait
    if (--door.countdown > 0) return;
    door.direction = 1;
    door.type = 'normal';
    sound(level, s, true, false);
    return;
  }
  if (door.direction === -1) {
    const res = movePlane(level, s, door.speed, sec.floor, false, 'ceiling', -1);
    if (res === MOVE.PASTDEST) {
      if (door.type === 'close30ThenOpen') { door.direction = 0; door.countdown = 30 * TICRATE; return; }
      if (blaze) sound(level, s, false, true);
      finish(level, door);
    } else if (res === MOVE.CRUSHED && door.type !== 'close' && door.type !== 'blazeClose') {
      door.direction = 1; // something is in the way: reopen
      sound(level, s, true, blaze);
    }
    return;
  }
  const res = movePlane(level, s, door.speed, door.topHeight, false, 'ceiling', 1);
  if (res !== MOVE.PASTDEST) return;
  if (door.type === 'normal' || door.type === 'blazeRaise') { door.direction = 0; door.countdown = door.topWait; }
  else finish(level, door); // open, blazeOpen, close30ThenOpen
}

// Tagged doors (EV_DoDoor). Returns true if any door started.
export function doDoor(level, tag, type) {
  let started = false;
  for (const s of sectorsWithTag(level, tag)) {
    const sec = level.sectors[s];
    if (sec.mover) continue;
    started = true;
    const blaze = BLAZE.has(type);
    const speed = blaze ? VDOOR_SPEED * 4 : VDOOR_SPEED;
    if (type === 'close' || type === 'blazeClose') {
      createDoor(level, s, type, -1, lowestCeilingAround(level, s) - 4, speed);
      sound(level, s, false, blaze);
    } else if (type === 'close30ThenOpen') {
      createDoor(level, s, type, -1, sec.ceiling, speed);
      sound(level, s, false, false);
    } else {
      const top = lowestCeilingAround(level, s) - 4;
      createDoor(level, s, type, 1, top, speed);
      if (top !== sec.ceiling) sound(level, s, true, blaze);
    }
  }
  return started;
}

// Manual doors on the line itself (EV_VerticalDoor): acts on the sector behind the line.
export function verticalDoor(level, line, type, byPlayer) {
  const s = line.backSector;
  if (s < 0) return false;
  const sec = level.sectors[s];
  const blaze = BLAZE.has(type);
  const existing = sec.mover;
  if (existing && existing.kind === 'door') {
    if (type !== 'normal' && type !== 'blazeRaise') return false;
    if (existing.direction === -1) {
      existing.direction = 1; // re-open a closing door
      sound(level, s, true, blaze);
    } else if (byPlayer) {
      existing.direction = -1; // close it again
      sound(level, s, false, blaze);
    }
    return true;
  }
  if (existing) return false;
  const top = lowestCeilingAround(level, s) - 4;
  createDoor(level, s, type, 1, top, blaze ? VDOOR_SPEED * 4 : VDOOR_SPEED);
  sound(level, s, true, blaze);
  return true;
}

// Sector specials 10 and 14.
export function spawnDoorCloseIn30(level, s) {
  const door = createDoor(level, s, 'normal', 0, level.sectors[s].ceiling, VDOOR_SPEED);
  door.countdown = 30 * TICRATE;
  level.sectors[s].special = 0;
}

export function spawnDoorRaiseIn5Mins(level, s) {
  const door = createDoor(level, s, 'raiseIn5Mins', 2, lowestCeilingAround(level, s) - 4, VDOOR_SPEED);
  door.countdown = 5 * 60 * TICRATE;
  level.sectors[s].special = 0;
}
