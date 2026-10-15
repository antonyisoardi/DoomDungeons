// Map objects ("mobjs"): monsters, the player, pickups, missiles and effects.
// The simulation updates these in place every tic for speed; everything that
// crosses into rendering/audio goes out through level.events.

let nextId = 1;

export function createMobj(level, def, kind, x, y, z, extra = {}) {
  const mobj = {
    id: nextId++,
    def,
    kind,
    x, y, z: 0,
    prevX: x, prevY: y, prevZ: 0,
    momX: 0, momY: 0, momZ: 0,
    angle: 0,
    radius: def.radius ?? 16,
    height: def.height ?? 16,
    floorz: 0, ceilingz: 0,
    health: def.health ?? 1,
    sprite: def.sprite,
    frame: 'A',
    bright: false,
    seq: null, stateIndex: 0, tics: -1,
    target: null, source: null,
    threshold: 0, reactionTime: def.reactionTime ?? 0, moveDir: 8, moveCount: 0,
    solid: false, shootable: false, float: !!def.float, noGravity: !!def.noGravity,
    missile: false, countKill: false, countItem: !!def.countItem, corpse: false,
    ambush: false, justHit: false, justAttacked: false, skullFly: false, shadow: !!def.shadow,
    noClip: false, dropped: false, removed: false, player: null,
    animTics: 0, animIndex: 0,
    ...extra,
  };
  const pos = level.position(mobj, x, y);
  mobj.floorz = pos.floorz;
  mobj.ceilingz = pos.ceilingz;
  mobj.z = z ?? (extra.hanging ? pos.ceilingz - mobj.height : pos.floorz);
  mobj.prevZ = mobj.z;
  level.addMobj(mobj);
  return mobj;
}

export function spriteForSequence(def, seqName) {
  if (seqName === 'death' && def.deathSprite) return def.deathSprite;
  return def.sprite;
}

// Enter a state sequence (Doom's P_SetMobjState). Returns false if the mobj was removed.
export function setSequence(level, mobj, seqName) {
  const seq = mobj.def.states?.[seqName];
  if (!seq) {
    removeMobj(level, mobj);
    return false;
  }
  mobj.seq = seq;
  mobj.sprite = spriteForSequence(mobj.def, seqName);
  return enterFrame(level, mobj, 0);
}

function enterFrame(level, mobj, index) {
  // Guard against zero-tic loops in bad data.
  for (let guard = 0; guard < 64; guard++) {
    const frame = mobj.seq.frames[index];
    mobj.stateIndex = index;
    mobj.frame = frame.frame;
    mobj.bright = frame.bright;
    mobj.tics = frame.tics;
    // Nightmare: monsters run their chase frames twice as fast.
    if (level.fast && mobj.kind === 'monster' && mobj.seq === mobj.def.states?.see && frame.tics > 1) mobj.tics = frame.tics >> 1;
    const seqBefore = mobj.seq;
    if (frame.action) {
      level.runAction(frame.action, mobj);
      if (mobj.removed) return false;
      if (mobj.seq !== seqBefore || mobj.stateIndex !== index) return true; // action changed state
    }
    if (mobj.tics !== 0) return true;
    const next = nextFrame(mobj);
    if (next === null) {
      removeMobj(level, mobj);
      return false;
    }
    index = next;
  }
  return true;
}

// Index of the next frame, switching sequence for "goto"; null for "stop".
function nextFrame(mobj) {
  const seq = mobj.seq;
  if (mobj.stateIndex + 1 < seq.frames.length) return mobj.stateIndex + 1;
  if (seq.next.type === 'stop') return null;
  if (seq.next.type === 'goto') {
    const target = mobj.def.states[seq.next.target];
    if (!target) return null;
    mobj.seq = target;
    mobj.sprite = spriteForSequence(mobj.def, seq.next.target);
  }
  return 0;
}

export function tickState(level, mobj) {
  if (!mobj.seq || mobj.tics === -1) return;
  mobj.tics--;
  if (mobj.tics > 0) return;
  const next = nextFrame(mobj);
  if (next === null) removeMobj(level, mobj);
  else enterFrame(level, mobj, next);
}

// Simple frame cycling for decorations and pickups without a state table.
export function tickAnimation(mobj, ticsPerFrame = 6) {
  const frames = mobj.def.frames;
  if (!frames || frames.length < 2) return;
  if (++mobj.animTics < ticsPerFrame) return;
  mobj.animTics = 0;
  mobj.animIndex = (mobj.animIndex + 1) % frames.length;
  mobj.frame = frames[mobj.animIndex];
}

export function removeMobj(level, mobj) {
  if (mobj.removed) return;
  mobj.removed = true;
  level.removeMobj(mobj);
}

export const inSequence = (mobj, name) => mobj.seq === mobj.def.states?.[name];
