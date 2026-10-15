// Damage, death and explosions (Doom's P_DamageMobj, P_KillMobj, P_RadiusAttack).

import { setSequence, inSequence } from './mobj.js';
import { SKILL } from '../constants.js';
import { PICKUP_BY_KEY } from '../info/things.js';

const BASE_THRESHOLD = 100;
const pick = (level, v) => (Array.isArray(v) ? v[level.rng.random() % v.length] : v);

export function playSound(level, mobj, name) {
  const sound = pick(level, name);
  if (sound) level.emit({ type: 'sound', name: sound, x: mobj.x, y: mobj.y, source: mobj.id });
}

function absorbArmor(player, damage) {
  if (!player.armorClass) return damage;
  let saved = player.armorClass === 1 ? Math.floor(damage / 3) : Math.floor(damage / 2);
  if (player.armor <= saved) {
    saved = player.armor;
    player.armorClass = 0;
  }
  player.armor -= saved;
  return damage - saved;
}

export function damageMobj(level, target, inflictor, source, amount) {
  if (!target.shootable || target.health <= 0) return;
  let damage = amount;
  if (target.skullFly) {
    target.momX = target.momY = target.momZ = 0;
    target.skullFly = false;
  }
  const player = target.player;
  if (target.kind === 'barrel' && source) target.target = source; // the barrel's blast credits its killer
  if (player && level.skill === SKILL.BABY) damage >>= 1;

  // Knockback, unless it is the player's own chainsaw.
  const sawing = source?.player && source.player.weapon === 'chainsaw';
  if (inflictor && !sawing && !target.noClip) {
    let angle = Math.atan2(target.y - inflictor.y, target.x - inflictor.x);
    let thrust = (damage * 12.5) / (target.def.mass ?? 100);
    if (damage < 40 && damage > target.health && target.z - inflictor.z > 64 && level.rng.random() & 1) {
      angle += Math.PI;
      thrust *= 4;
    }
    target.momX += Math.cos(angle) * thrust;
    target.momY += Math.sin(angle) * thrust;
  }

  if (player) {
    if (player.powers.invulnerability > 0 && damage < 1000) return;
    damage = absorbArmor(player, damage);
    player.health = Math.max(0, player.health - damage);
    player.damageCount = Math.min(100, player.damageCount + damage);
    player.attacker = source;
    level.emit({ type: 'playerHurt', amount: damage });
  }

  target.health -= damage;
  if (target.health <= 0) {
    killMobj(level, source, target);
    return;
  }

  const painChance = target.def.painChance ?? 0;
  if (level.rng.random() < painChance && !target.skullFly && target.def.states?.pain) {
    target.justHit = true;
    setSequence(level, target, 'pain'); // the pain state's action plays the sound
  }
  target.reactionTime = 0;

  if (target.kind === 'monster' && source && source !== target && (!target.threshold || !target.target)) {
    target.target = source;
    target.threshold = BASE_THRESHOLD;
    if (inSequence(target, 'spawn') && target.def.states.see) setSequence(level, target, 'see');
  }
}

export function killMobj(level, source, target) {
  target.shootable = false;
  target.float = false;
  target.skullFly = false;
  if (target.def.key !== 'lostSoul') target.noGravity = false;
  target.corpse = true;
  target.solid = target.kind === 'barrel' ? target.solid : false;
  target.height = Math.max(4, target.height / 4);

  if (target.countKill) level.stats.kills++;
  if (target.player) {
    target.player.dead = true;
    target.player.attacker = source;
    level.emit({ type: 'playerDied' });
  }

  const states = target.def.states;
  const spawnHealth = target.def.health ?? 1;
  if (target.health < -spawnHealth && states.xdeath) setSequence(level, target, 'xdeath');
  else setSequence(level, target, 'death');
  if (!target.removed && target.tics > 0) target.tics = Math.max(1, target.tics - (level.rng.random() & 3));

  const drop = target.def.drop ? PICKUP_BY_KEY[target.def.drop] : null;
  if (drop) {
    const item = level.spawnThing(drop, target.x, target.y, { dropped: true });
    item.momZ = 4;
  }
}

// Splash damage around spot (rockets, barrels). Damage falls off linearly to 0 at `damage` units.
export function radiusAttack(level, spot, source, damage) {
  level.blockmap.each(spot.x - damage, spot.y - damage, spot.x + damage, spot.y + damage, (m) => {
    if (!m.shootable || m.removed || m.def.noSplash) return true;
    const dist = Math.max(0, Math.max(Math.abs(m.x - spot.x), Math.abs(m.y - spot.y)) - m.radius);
    if (dist >= damage) return true;
    if (level.checkSight(m, spot)) damageMobj(level, m, spot, source, Math.floor(damage - dist));
    return true;
  });
}
