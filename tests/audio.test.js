import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMus, MUS_TICKS_PER_SECOND } from '../src/audio/mus.js';
import { decodeDmx } from '../src/audio/sfx.js';

function musLump(score) {
  const header = [0x4d, 0x55, 0x53, 0x1a, score.length & 255, score.length >> 8, 16, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  return Uint8Array.from([...header, ...score]);
}

describe('parseMus', () => {
  const score = [
    0x90, 0x80 | 60, 100, 0x81, 0x00, // ch0 play note 60 vol 100, last -> delay 128 (two-byte varlen)
    0x00, 60, //                         ch0 release note 60
    0xc1, 7, 90, 10, //                  ch1 controller 7 = 90, last -> delay 10
    0x11, 64, //                         ch1 play note 64 at the channel's last volume (default 100)
    0x9f, 0x80 | 35, 127, 5, //          ch15 (percussion) note 35 vol 127, delay 5
    0x2f, 0x40, //                       ch15 pitch bend
    0x3f, 10, //                         ch15 system event
    0x1f, 36, //                         ch15 note 36 keeps volume 127
    0x50, //                             measure end (no data)
    0x60, //                             score end
    0x90, 1, 0, //                       ignored after the end
  ];
  const { events, duration } = parseMus(musLump(score));

  test('decodes note on/off, controllers, bends and system events with timing', () => {
    assert.deepEqual(events, [
      { time: 0, type: 'on', channel: 0, note: 60, volume: 100 },
      { time: 128, type: 'off', channel: 0, note: 60 },
      { time: 128, type: 'controller', channel: 1, controller: 7, value: 90 },
      { time: 138, type: 'on', channel: 1, note: 64, volume: 100 },
      { time: 138, type: 'on', channel: 15, note: 35, volume: 127 },
      { time: 143, type: 'bend', channel: 15, value: 0x40 },
      { time: 143, type: 'system', channel: 15, value: 10 },
      { time: 143, type: 'on', channel: 15, note: 36, volume: 127 },
      { time: 143, type: 'end' },
    ]);
    assert.equal(duration, 143);
  });

  test('stops at the score length if there is no end event', () => {
    const { events: ev, duration: d } = parseMus(musLump([0x80, 60, 3]));
    assert.deepEqual(ev, [{ time: 0, type: 'off', channel: 0, note: 60 }]);
    assert.equal(d, 3);
  });

  test('rejects short or foreign lumps', () => {
    assert.throws(() => parseMus(new Uint8Array(4)), /too short/);
    assert.throws(() => parseMus(new Uint8Array(32)), /Not a MUS/);
    assert.throws(() => parseMus(null), /too short/);
  });

  test('ticks per second', () => {
    assert.equal(MUS_TICKS_PER_SECOND, 140);
  });
});

describe('decodeDmx', () => {
  function dmx(samples, { format = 3, rate = 11025, padding = 16 } = {}) {
    const bytes = new Uint8Array(8 + padding + samples.length + padding).fill(128);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, format, true);
    view.setUint16(2, rate, true);
    view.setUint32(4, samples.length + padding * 2, true);
    bytes.set(samples, 8 + padding);
    return bytes;
  }

  test('decodes unsigned 8-bit PCM to floats, skipping DMX padding', () => {
    const out = decodeDmx(dmx([128, 255, 0, 192]));
    assert.equal(out.rate, 11025);
    assert.deepEqual([...out.samples], [0, 127 / 128, -1, 0.5]);
  });

  test('clamps the sample count to the lump size', () => {
    const bytes = dmx([1, 2, 3, 4]);
    new DataView(bytes.buffer).setUint32(4, 9999, true);
    assert.equal(decodeDmx(bytes).samples.length, 4);
  });

  test('rejects other formats and tiny lumps', () => {
    assert.equal(decodeDmx(dmx([1], { format: 2 })), null);
    assert.equal(decodeDmx(new Uint8Array(4)), null);
    assert.equal(decodeDmx(null), null);
  });

  test('an empty sound decodes to no samples', () => {
    assert.equal(decodeDmx(dmx([])).samples.length, 0);
  });
});
