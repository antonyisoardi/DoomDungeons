import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrame, parseSequence, defineStates, times } from '../src/game/info/states.js';
import { MONSTERS } from '../src/game/info/monsters.js';
import { ACTIONS } from '../src/game/sim/actions.js';
import { PROJECTILES, EFFECTS, BARREL_STATES } from '../src/game/info/projectiles.js';
import { PLAYER_DEF } from '../src/game/sim/player.js';

describe('parseFrame', () => {
  test('frame, tics and action', () => {
    assert.deepEqual(parseFrame('A10 look'), { frame: 'A', tics: 10, bright: false, action: 'look' });
  });

  test('full bright and no action', () => {
    assert.deepEqual(parseFrame('F8!'), { frame: 'F', tics: 8, bright: true, action: null });
  });

  test('negative tics hold forever; whitespace is trimmed', () => {
    assert.deepEqual(parseFrame('  N-1 '), { frame: 'N', tics: -1, bright: false, action: null });
  });

  test('accepts Doom\'s extended frame letters', () => {
    assert.equal(parseFrame('[5').frame, '[');
    assert.equal(parseFrame('\\5').frame, '\\');
  });

  test('rejects malformed frames', () => {
    for (const bad of ['a10', 'A', 'AB10', 'A10 two words', '']) assert.throws(() => parseFrame(bad), /Bad state frame/, bad);
  });
});

describe('parseSequence', () => {
  test('defaults to loop', () => {
    const seq = parseSequence('spawn', ['A1', 'B2']);
    assert.equal(seq.frames.length, 2);
    assert.deepEqual(seq.next, { type: 'loop' });
  });

  test('stop and goto', () => {
    assert.deepEqual(parseSequence('death', ['A1', 'stop']).next, { type: 'stop' });
    assert.deepEqual(parseSequence('pain', ['A1', 'goto  see ']).next, { type: 'goto', target: 'see' });
  });

  test('a sequence needs frames', () => {
    assert.throws(() => parseSequence('empty', ['loop']), /no frames/);
  });

  test('defineStates freezes every sequence', () => {
    const states = defineStates({ a: ['A1'], b: ['B1', 'goto a'] });
    assert.ok(Object.isFrozen(states) && Object.isFrozen(states.a.frames));
    assert.equal(states.b.next.target, 'a');
  });

  test('times repeats steps', () => {
    assert.deepEqual(times(2, 'A1', 'B1'), ['A1', 'B1', 'A1', 'B1']);
  });
});

describe('info tables are consistent', () => {
  const tables = [
    ...Object.entries(MONSTERS).map(([k, m]) => [k, m.states]),
    ...Object.entries(PROJECTILES).map(([k, p]) => [k, p.states]),
    ...Object.entries(EFFECTS).map(([k, e]) => [k, e.states]),
    ['barrel', BARREL_STATES],
    ['player', PLAYER_DEF.states],
  ];

  test('every action names a known function', () => {
    for (const [name, states] of tables) {
      for (const seq of Object.values(states)) {
        for (const f of seq.frames) if (f.action) assert.ok(ACTIONS[f.action], `${name}.${seq.name}: ${f.action}`);
      }
    }
  });

  test('every goto targets an existing sequence', () => {
    for (const [name, states] of tables) {
      for (const seq of Object.values(states)) {
        if (seq.next.type === 'goto') assert.ok(states[seq.next.target], `${name}.${seq.name} -> ${seq.next.target}`);
      }
    }
  });

  test('every monster can spawn, chase and die', () => {
    for (const [name, m] of Object.entries(MONSTERS)) {
      for (const seq of ['spawn', 'see', 'death']) assert.ok(m.states[seq], `${name}.${seq}`);
      assert.ok(m.states.melee || m.states.missile, `${name} can attack`);
    }
  });
});
