// Parse Doom's MUS music format into timed events (140 ticks per second).

export const MUS_TICKS_PER_SECOND = 140;
export const PERCUSSION_CHANNEL = 15;

export function parseMus(bytes) {
  if (!bytes || bytes.length < 16) throw new Error('MUS lump too short');
  if (bytes[0] !== 0x4d || bytes[1] !== 0x55 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) throw new Error('Not a MUS lump');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const scoreLength = view.getUint16(4, true);
  const scoreStart = view.getUint16(6, true);
  const end = Math.min(bytes.length, scoreStart + scoreLength);
  const events = [];
  const lastVolume = new Array(16).fill(100);
  let at = scoreStart;
  let time = 0;

  while (at < end) {
    const desc = bytes[at++];
    const last = desc & 0x80;
    const type = (desc >> 4) & 7;
    const channel = desc & 15;
    switch (type) {
      case 0:
        events.push({ time, type: 'off', channel, note: bytes[at++] & 127 });
        break;
      case 1: {
        const b = bytes[at++];
        if (b & 0x80) lastVolume[channel] = bytes[at++] & 127;
        events.push({ time, type: 'on', channel, note: b & 127, volume: lastVolume[channel] });
        break;
      }
      case 2:
        events.push({ time, type: 'bend', channel, value: bytes[at++] });
        break;
      case 3:
        events.push({ time, type: 'system', channel, value: bytes[at++] });
        break;
      case 4: {
        const controller = bytes[at++];
        const value = bytes[at++];
        events.push({ time, type: 'controller', channel, controller, value });
        break;
      }
      case 5:
        break;
      case 6:
        events.push({ time, type: 'end' });
        return { events, duration: time };
      default:
        at++;
        break;
    }
    if (last) {
      let delay = 0;
      let b;
      do {
        b = bytes[at++];
        delay = delay * 128 + (b & 127);
      } while (b & 0x80 && at < end);
      time += delay;
    }
  }
  return { events, duration: time };
}
