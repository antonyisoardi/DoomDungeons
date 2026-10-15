// Linedef activation: walk-over, use (switches/doors) and shoot triggers.

import { lineSpecial } from '../../specials/table.js';
import { doDoor, verticalDoor } from './doors.js';
import { doFloor, buildStairs, doDonut } from './floors.js';
import { doPlat, stopPlat } from './plats.js';
import { doCeiling, crushStop } from './ceilings.js';
import { changeLights } from './lights.js';
import { teleport } from './teleport.js';
import { TICRATE } from '../../constants.js';

const MONSTER_WALK = new Set([39, 97, 125, 126, 4, 10, 88]);
const MONSTER_USE = new Set([1, 32, 33, 34]);
const MONSTER_SHOOT = new Set([46]);
const BUTTON_TICS = TICRATE;
const KEY_NAMES = { blue: 'blue', yellow: 'yellow', red: 'red' };

// Doom's P_PointOnLineSide: 0 = front (right of v1->v2), 1 = back.
export function pointOnLineSide(map, line, x, y) {
  const a = map.vertices[line.v1], b = map.vertices[line.v2];
  const dx = b.x - a.x, dy = b.y - a.y;
  return dx * (y - a.y) - dy * (x - a.x) < 0 ? 0 : 1;
}

function hasKey(player, key) {
  return player.keys.has(key);
}

function lockedMessage(level, mobj, sp) {
  if (!mobj.player) return;
  const object = sp.trigger === 'S' ? 'activate this object' : 'open this door';
  level.message(`You need a ${KEY_NAMES[sp.key]} key to ${object}`, 'locked');
  level.emit({ type: 'sound', name: 'DSOOF', x: mobj.x, y: mobj.y });
}

function runSpecial(level, line, sp, mobj, side) {
  const tag = line.tag;
  switch (sp.kind) {
    case 'door': return sp.trigger === 'D' ? verticalDoor(level, line, sp.type, !!mobj.player) : doDoor(level, tag, sp.type);
    case 'floor': return doFloor(level, line, tag, sp.type);
    case 'donut': return doDonut(level, tag);
    case 'plat': return doPlat(level, line, tag, sp.type, sp.amount);
    case 'platStop': return stopPlat(level, tag);
    case 'ceiling': return doCeiling(level, tag, sp.type);
    case 'crushStop': return crushStop(level, tag);
    case 'stairs': return buildStairs(level, tag, sp.type);
    case 'light': return changeLights(level, tag, sp.type, sp.level);
    case 'teleport': return teleport(level, line, side, mobj, sp.type === 'monster');
    case 'exit':
      level.exitLevel(sp.type);
      return true;
    default: return false;
  }
}

function switchName(name) {
  if (/^SW1/.test(name)) return `SW2${name.slice(3)}`;
  if (/^SW2/.test(name)) return `SW1${name.slice(3)}`;
  return null;
}

// Flip SW1xxx <-> SW2xxx on the line's front side; repeatable switches flip back after a second.
function changeSwitchTexture(level, line, repeat, sound) {
  const side = level.sideTextures[line.front];
  if (!side) return;
  for (const part of ['upper', 'middle', 'lower']) {
    const swapped = switchName(side[part]);
    if (!swapped) continue;
    const old = side[part];
    side[part] = swapped;
    level.emit({ type: 'switchTexture', line: line.index, part, texture: swapped });
    level.emitLineSound(line, sound);
    if (repeat) {
      level.schedule(BUTTON_TICS, () => {
        side[part] = old;
        level.emit({ type: 'switchTexture', line: line.index, part, texture: old });
        level.emitLineSound(line, 'DSSWTCHN');
      });
    }
    return;
  }
  level.emitLineSound(line, sound);
}

// how: 'walk' | 'use' | 'shoot'. Returns true if the special did something.
export function activateLine(level, line, mobj, how, side) {
  const sp = lineSpecial(line.special);
  if (!sp) return false;
  const want = how === 'walk' ? ['W'] : how === 'use' ? ['S', 'D'] : ['G'];
  if (!want.includes(sp.trigger)) return false;

  const isPlayer = !!mobj?.player;
  if (!isPlayer) {
    if (how === 'walk' && !MONSTER_WALK.has(sp.special)) return false;
    if (how === 'use' && (!MONSTER_USE.has(sp.special) || line.flags & 32)) return false;
    if (how === 'shoot' && !MONSTER_SHOOT.has(sp.special)) return false;
  } else if (sp.type === 'monster' && sp.kind === 'teleport') return false;

  if (sp.key && isPlayer && !hasKey(mobj.player, sp.key)) {
    lockedMessage(level, mobj, sp);
    return false;
  }

  const ok = runSpecial(level, line, sp, mobj, side);
  if (how === 'walk') {
    if (!sp.repeat) line.special = 0;
    return ok;
  }
  if (!ok) return false;
  if (sp.trigger === 'D') {
    if (!sp.repeat) line.special = 0;
    return true;
  }
  changeSwitchTexture(level, line, sp.repeat, sp.kind === 'exit' ? 'DSSWTCHX' : 'DSSWTCHN');
  if (!sp.repeat) line.special = 0;
  return true;
}
