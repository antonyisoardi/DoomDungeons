import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, run, runUntil, pressUse, messages, mobjsOfKind, room, player, sector } from './helpers/levelHelper.js';

const walk = (moveX, moveY = 0) => (level) => { level.player.input.moveX = moveX; level.player.input.moveY = moveY; };
const stop = (level) => { level.player.input.moveX = 0; level.player.input.moveY = 0; };

// Room 0 | door (sector 1, closed) | room 2. Both door lines face out of the door into the rooms.
function doorMap({ special = 1, start = player(200, 128, 0), doorProps = {} } = {}) {
  return {
    sectors: [sector(), sector({ ceiling: 0, ...doorProps }), sector()],
    rects: [room(0, 0, 0, 256, 256), room(1, 256, 64, 272, 192), room(2, 272, 0, 528, 256)],
    lines: [{ front: 0, back: 1, special }, { front: 2, back: 1, special }],
    things: [start],
  };
}

// Room 0 split in two by a line (special/tag) at x = 128, plus extra rects/sectors.
function splitRoom({ special, tag = 0, sectors = [], rects = [], things = [player(64, 128, 0)] }) {
  return {
    sectors: [sector(), sector(), ...sectors],
    rects: [room(0, 0, 0, 128, 256), room(1, 128, 0, 256, 256), ...rects],
    lines: [{ front: 0, back: 1, special, tag }],
    things,
  };
}

function crossEast(level, x = 150) {
  const tics = runUntil(level, 60, (lv) => lv.playerMobj.x > x, walk(1));
  stop(level);
  return tics;
}

describe('manual doors (special 1)', () => {
  test('use opens the door, it waits ~150 tics, then closes', () => {
    const level = makeLevel(doorMap());
    const door = level.sectors[1];
    pressUse(level);
    assert.ok(door.mover, 'door thinker started');
    assert.ok(level.events.some((e) => e.type === 'sound' && e.name === 'DSDOROPN'));
    run(level, 70);
    assert.equal(door.ceiling, 128 - 4, 'opens to the lowest neighbouring ceiling - 4');
    run(level, 140);
    assert.equal(door.ceiling, 124, 'still open while waiting');
    const closedAfter = runUntil(level, 200, () => door.ceiling === 0 && door.mover === null);
    assert.ok(closedAfter > 0, 'closes again and the thinker finishes');
  });

  test('use while open closes it early', () => {
    const level = makeLevel(doorMap());
    pressUse(level);
    run(level, 70);
    pressUse(level);
    assert.equal(level.sectors[1].mover.direction, -1);
  });

  test('out of reach or facing away from the back side does nothing', () => {
    const far = makeLevel(doorMap({ start: player(100, 128, 0) }));
    pressUse(far);
    assert.equal(far.sectors[1].mover, null);
    assert.ok(far.events.some((e) => e.name === 'DSNOWAY'));
  });

  test('walking into a closed door opens it', () => {
    const level = makeLevel(doorMap());
    run(level, 20, walk(1));
    assert.ok(level.sectors[1].ceiling > 0);
  });

  test('a closed door blocks; an open one lets the player through', () => {
    const level = makeLevel(doorMap());
    const p = level.playerMobj;
    level.player.input.moveX = 1;
    run(level, 10);
    assert.ok(p.x < 256 - 15, 'blocked while closed');
    run(level, 120);
    assert.ok(p.x > 272, `walked through, x=${p.x}`);
  });
});

describe('keyed doors (special 26, blue)', () => {
  test('refuses without the key and says why', () => {
    const level = makeLevel(doorMap({ special: 26 }));
    pressUse(level);
    run(level, 40);
    assert.equal(level.sectors[1].ceiling, 0);
    const locked = messages(level).filter((m) => m.kind === 'locked');
    assert.equal(locked.length, 1);
    assert.match(locked[0].text, /blue key/);
  });

  test('opens with the key', () => {
    const level = makeLevel(doorMap({ special: 26 }));
    level.player.keys.add('blue');
    pressUse(level);
    run(level, 70);
    assert.equal(level.sectors[1].ceiling, 124);
    assert.equal(messages(level).length, 0);
  });

  test('walking into it after picking up a blue keycard opens it', () => {
    const map = doorMap({ special: 26, start: player(64, 128, 0) });
    const level = makeLevel({ ...map, things: [...map.things, { x: 160, y: 128, type: 5 }] });
    run(level, 40, walk(1));
    assert.ok(level.player.keys.has('blue'));
    assert.ok(level.sectors[1].ceiling > 0);
    assert.equal(messages(level).filter((m) => m.kind === 'locked').length, 0);
  });

  test('bumping it without the key repeats the locked message at most every 2 seconds', () => {
    const level = makeLevel(doorMap({ special: 26 }));
    run(level, 100, walk(1));
    const locked = messages(level).filter((m) => m.kind === 'locked').length;
    assert.ok(locked >= 1 && locked <= 2, `locked messages: ${locked}`);
    assert.equal(level.sectors[1].ceiling, 0);
  });
});

describe('switches', () => {
  test('a tagged switch (103) opens its door, flips SW1 to SW2 and is used up', () => {
    const level = makeLevel({
      sectors: [sector(), sector({ ceiling: 0, tag: 9 }), sector()],
      rects: [room(0, 0, 0, 256, 256), room(1, 256, 64, 272, 192), room(2, 272, 0, 528, 256)],
      lines: [{ front: 0, back: -1, special: 103, tag: 9, middle: 'SW1COMM', at: [64, 0] }],
      things: [player(64, 40, 270)],
    });
    const line = level.lines.find((l) => l.special === 103);
    pressUse(level);
    run(level, 70);
    assert.equal(level.sectors[1].ceiling, 124);
    assert.equal(level.sideTextures[line.front].middle, 'SW2COMM');
    assert.ok(level.events.some((e) => e.type === 'switchTexture' && e.line === line.index));
    assert.equal(line.special, 0);
    run(level, 200);
    assert.equal(level.sectors[1].ceiling, 124, 'an "open" door stays open');
  });
});

describe('lifts (special 88, walk-over, repeatable)', () => {
  const liftMap = () => splitRoom({
    special: 88, tag: 5,
    sectors: [sector({ floor: 64, ceiling: 192, tag: 5 })],
    rects: [room(2, 256, 64, 384, 192)],
  });

  test('lowers to the lowest neighbouring floor, waits, then returns and stops', () => {
    const level = makeLevel(liftMap());
    const lift = level.sectors[2];
    assert.ok(crossEast(level) > 0, 'crossed the trigger line');
    assert.ok(lift.mover, 'lift started');
    const down = runUntil(level, 40, () => lift.floor === 0);
    assert.ok(down >= 0, 'reached the bottom');
    run(level, 60);
    assert.equal(lift.floor, 0, 'waits at the bottom');
    const up = runUntil(level, 120, () => lift.floor === 64 && lift.mover === null);
    assert.ok(up > 0, 'returned to the top and finished');
    assert.equal(level.lines.find((l) => l.tag === 5).special, 88, 'repeatable trigger stays armed');
  });
});

describe('teleporters (special 97)', () => {
  const teleMap = (start) => splitRoom({
    special: 97, tag: 7,
    sectors: [sector({ tag: 7 })],
    rects: [room(2, 512, 0, 768, 256)],
    things: [start, { x: 640, y: 160, type: 14, angle: 90 }],
  });

  test('moves the player to the destination in the tagged sector', () => {
    const level = makeLevel(teleMap(player(64, 128, 0)));
    crossEast(level, 140);
    const p = level.playerMobj;
    assert.deepEqual([p.x, p.y], [640, 160]);
    assert.equal(p.momX, 0);
    assert.ok(level.player.freezeTics > 0);
    assert.ok(level.events.some((e) => e.type === 'teleported'));
    assert.equal(mobjsOfKind(level, 'effect').filter((m) => m.sprite === 'TFOG').length, 2);
  });

  test('crossing from the back side does not teleport', () => {
    const level = makeLevel(teleMap(player(200, 128, 180)));
    runUntil(level, 60, (lv) => lv.playerMobj.x < 100, walk(-1));
    assert.ok(level.playerMobj.x < 128);
    assert.ok(level.playerMobj.x > 0);
  });
});

describe('exits and sector specials', () => {
  test('walking over special 52 exits the level', () => {
    const level = makeLevel(splitRoom({ special: 52 }));
    assert.equal(level.exit, null);
    crossEast(level);
    assert.equal(level.exit, 'normal');
  });

  test('walking over special 124 takes the secret exit', () => {
    const level = makeLevel(splitRoom({ special: 124 }));
    crossEast(level);
    assert.equal(level.exit, 'secret');
  });

  test('entering a secret sector (9) counts it once', () => {
    const map = splitRoom({ special: 0 });
    map.sectors[1] = sector({ special: 9 });
    const level = makeLevel(map);
    assert.equal(level.stats.totalSecrets, 1);
    assert.equal(level.stats.secrets, 0);
    crossEast(level, 160);
    run(level, 30);
    assert.equal(level.stats.secrets, 1);
    assert.equal(level.sectors[1].special, 0);
    assert.ok(messages(level).some((m) => m.kind === 'secret'));
  });

  test('a damaging floor (7) hurts 5 every 32 tics', () => {
    const map = splitRoom({ special: 0 });
    map.sectors[0] = sector({ special: 7 });
    const level = makeLevel(map);
    run(level, 100);
    assert.equal(level.player.health, 100 - 5 * 4);
    assert.equal(level.playerMobj.health, level.player.health);
  });

  test('a radiation suit protects from a damaging floor', () => {
    const map = splitRoom({ special: 0 });
    map.sectors[0] = sector({ special: 7 });
    const level = makeLevel(map);
    level.player.powers.radsuit = 1000;
    run(level, 100);
    assert.equal(level.player.health, 100);
  });

  test('blinking light sectors change light level', () => {
    const map = splitRoom({ special: 0 });
    map.sectors[1] = sector({ special: 3, light: 200 });
    map.sectors[0] = sector({ light: 100 });
    const level = makeLevel(map);
    const seen = new Set();
    run(level, 100, (lv) => seen.add(lv.sectors[1].light));
    assert.deepEqual([...seen].sort(), [100, 200]);
  });
});
