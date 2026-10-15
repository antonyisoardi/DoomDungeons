import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nextMap, parTime, parseMapName, mapName, episodesIn } from '../src/app/progression.js';

const episode = (e) => Array.from({ length: 9 }, (_, i) => `E${e}M${i + 1}`);
const ALL = [1, 2, 3, 4].flatMap(episode);

describe('nextMap', () => {
  test('normal exits advance one map', () => {
    assert.equal(nextMap('E1M1', 'normal', ALL), 'E1M2');
    assert.equal(nextMap('E1M3', 'normal', ALL), 'E1M4');
    assert.equal(nextMap('E1M7', 'normal', ALL), 'E1M8');
  });

  test('secret exits go to M9 from the right map, and M9 returns to the next map', () => {
    assert.equal(nextMap('E1M3', 'secret', ALL), 'E1M9');
    assert.equal(nextMap('E1M9', 'normal', ALL), 'E1M4');
    assert.equal(nextMap('E2M5', 'secret', ALL), 'E2M9');
    assert.equal(nextMap('E2M9', 'normal', ALL), 'E2M6');
    assert.equal(nextMap('E3M6', 'secret', ALL), 'E3M9');
    assert.equal(nextMap('E3M9', 'normal', ALL), 'E3M7');
    assert.equal(nextMap('E4M2', 'secret', ALL), 'E4M9');
    assert.equal(nextMap('E4M9', 'normal', ALL), 'E4M3');
  });

  test('a secret exit elsewhere behaves like a normal exit', () => {
    assert.equal(nextMap('E1M1', 'secret', ALL), 'E1M2');
  });

  test('M8 ends the episode', () => {
    assert.equal(nextMap('E1M8', 'normal', ALL), null);
    assert.equal(nextMap('E1M8', 'secret', ALL), null);
  });

  test('maps missing from the WAD end the run', () => {
    assert.equal(nextMap('E1M3', 'secret', ['E1M3', 'E1M4']), null);
    assert.equal(nextMap('E1M1', 'normal', ['E1M1']), null);
  });

  test('non-episode map names have no successor', () => {
    assert.equal(nextMap('MAP01', 'normal', ['MAP01', 'MAP02']), null);
  });
});

describe('par times and names', () => {
  test('parTime', () => {
    assert.equal(parTime('E1M1'), 30);
    assert.equal(parTime('E1M9'), 165);
    assert.equal(parTime('E4M6'), 390);
    assert.equal(parTime('E5M1'), 0);
    assert.equal(parTime('MAP01'), 0);
  });

  test('parseMapName / mapName', () => {
    assert.deepEqual(parseMapName('E2M7'), { episode: 2, map: 7 });
    assert.equal(parseMapName('e2m7'), null);
    assert.equal(mapName(3, 4), 'E3M4');
  });

  test('episodesIn lists episodes that have a first map', () => {
    assert.deepEqual(episodesIn(episode(1)), [1]);
    assert.deepEqual(episodesIn(ALL), [1, 2, 3, 4]);
    assert.deepEqual(episodesIn(['E2M2']), []);
  });
});
