// Moving things through the block world (Doom's P_TryMove / P_XYMovement / P_ZMovement).

import { GRAVITY, FRICTION, STOP_SPEED, MAX_MOVE, FLOAT_SPEED } from '../constants.js';
import { boxPosition } from './world.js';
import { MAX_STEP } from '../../world/style.js';

export function moveMode(mobj) {
  if (mobj.missile || mobj.skullFly) return 'missile';
  if (mobj.player) return 'player';
  return 'monster';
}

// Things that would overlap mobj at (x, y). Vanilla Doom treats things as infinitely tall,
// except for missiles and flying lost souls which check heights.
export function thingBlocking(level, mobj, x, y, z = mobj.z) {
  let blocker = null;
  const checkZ = mobj.missile || mobj.skullFly;
  level.blockmap.each(x - mobj.radius, y - mobj.radius, x + mobj.radius, y + mobj.radius, (other) => {
    if (other === mobj || other.removed || !(other.solid || other.shootable)) return true;
    if (!other.solid && !(checkZ && other.shootable)) return true;
    const reach = other.radius + mobj.radius;
    if (Math.abs(other.x - x) >= reach || Math.abs(other.y - y) >= reach) return true;
    if (checkZ && (z > other.z + other.height || z + mobj.height < other.z)) return true;
    if (mobj.missile && other === mobj.source) return true;
    blocker = other;
    return false;
  });
  return blocker;
}

// Result: { ok, blocker, floorz, ceilingz, reason }
export function checkMove(level, mobj, x, y) {
  const mode = moveMode(mobj);
  const pos = boxPosition(level.grid, level.sectors, x, y, mobj.radius, mode);
  if (mobj.noClip) return { ok: true, ...pos };
  if (pos.blocked) return { ok: false, reason: 'wall', ...pos };
  const blocker = thingBlocking(level, mobj, x, y);
  if (blocker) return { ok: false, reason: 'thing', blocker, ...pos };
  if (pos.ceilingz - pos.floorz < mobj.height) return { ok: false, reason: 'height', ...pos };
  if (mode === 'missile') {
    if (mobj.z < pos.floorz || mobj.z + mobj.height > pos.ceilingz) return { ok: false, reason: 'height', ...pos };
    return { ok: true, ...pos };
  }
  if (pos.ceilingz - mobj.z < mobj.height && !mobj.float) return { ok: false, reason: 'height', ...pos };
  if (pos.floorz - mobj.z > MAX_STEP && !mobj.float) return { ok: false, reason: 'step', ...pos };
  if (mobj.float && (pos.floorz > mobj.z + mobj.height || pos.ceilingz < mobj.z)) return { ok: false, reason: 'height', ...pos };
  // Monsters avoid dropping off ledges they could not climb back up.
  if (mode === 'monster' && !mobj.float && !mobj.corpse && pos.floorz - pos.dropoffz > MAX_STEP) {
    return { ok: false, reason: 'dropoff', ...pos };
  }
  return { ok: true, ...pos };
}

export function tryMove(level, mobj, x, y) {
  const result = checkMove(level, mobj, x, y);
  if (!result.ok) return result;
  const oldX = mobj.x, oldY = mobj.y;
  mobj.x = x;
  mobj.y = y;
  mobj.floorz = result.floorz;
  mobj.ceilingz = result.ceilingz;
  level.blockmap.relink(mobj);
  if (!mobj.missile && !mobj.noClip) level.crossLines(mobj, oldX, oldY, x, y);
  if (mobj.player) level.touchItems(mobj);
  return result;
}

// Momentum movement with sliding along walls. Returns the blocking result if stopped.
export function xyMovement(level, mobj) {
  if (!mobj.momX && !mobj.momY) return null;
  const speed = Math.hypot(mobj.momX, mobj.momY);
  if (speed > MAX_MOVE) {
    mobj.momX = (mobj.momX / speed) * MAX_MOVE;
    mobj.momY = (mobj.momY / speed) * MAX_MOVE;
  }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mobj.momX), Math.abs(mobj.momY)) / 8));
  const sx = mobj.momX / steps, sy = mobj.momY / steps;
  let blocked = null;
  for (let i = 0; i < steps && !mobj.removed; i++) {
    const r = tryMove(level, mobj, mobj.x + sx, mobj.y + sy);
    if (r.ok) continue;
    if (mobj.missile || mobj.skullFly) return r;
    blocked = r;
    // Slide: keep whichever axis still moves.
    const rx = sx ? tryMove(level, mobj, mobj.x + sx, mobj.y) : { ok: false };
    if (!rx.ok) mobj.momX = 0;
    const ry = sy ? tryMove(level, mobj, mobj.x, mobj.y + sy) : { ok: false };
    if (!ry.ok) mobj.momY = 0;
    if (!rx.ok && !ry.ok) break;
  }
  if (mobj.missile || mobj.skullFly) return blocked;
  applyFriction(mobj);
  return blocked;
}

function applyFriction(mobj) {
  if (mobj.z > mobj.floorz && !mobj.corpse) return; // no friction in the air
  const player = mobj.player;
  const idle = !player || (!player.input.moveX && !player.input.moveY);
  if (Math.abs(mobj.momX) < STOP_SPEED && Math.abs(mobj.momY) < STOP_SPEED && idle) {
    mobj.momX = 0;
    mobj.momY = 0;
    return;
  }
  mobj.momX *= FRICTION;
  mobj.momY *= FRICTION;
}

// Vertical movement: gravity, floating toward targets, landing. Returns 'floor'/'ceiling' on missile impact.
export function zMovement(level, mobj) {
  mobj.z += mobj.momZ;

  if (mobj.float && mobj.target && !mobj.skullFly && !mobj.corpse) {
    const dist = Math.hypot(mobj.target.x - mobj.x, mobj.target.y - mobj.y);
    const delta = mobj.target.z + mobj.height / 2 - mobj.z;
    if (delta < 0 && dist < -delta * 3) mobj.z -= FLOAT_SPEED;
    else if (delta > 0 && dist < delta * 3) mobj.z += FLOAT_SPEED;
  }

  if (mobj.z <= mobj.floorz) {
    if (mobj.skullFly) mobj.momZ = -mobj.momZ;
    if (mobj.momZ < 0) {
      if (mobj.player && mobj.momZ < -GRAVITY * 8) level.emit({ type: 'sound', name: 'DSOOF', x: mobj.x, y: mobj.y });
      mobj.momZ = 0;
    }
    mobj.z = mobj.floorz;
    if (mobj.missile) return 'floor';
  } else if (!mobj.noGravity) {
    mobj.momZ = mobj.momZ === 0 ? -GRAVITY * 2 : mobj.momZ - GRAVITY;
  }

  if (mobj.z + mobj.height > mobj.ceilingz) {
    if (mobj.momZ > 0) mobj.momZ = 0;
    mobj.z = Math.max(mobj.floorz, mobj.ceilingz - mobj.height);
    if (mobj.skullFly) mobj.momZ = -mobj.momZ;
    if (mobj.missile) return 'ceiling';
  }
  return null;
}
