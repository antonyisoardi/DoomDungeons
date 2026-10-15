// Vanilla Doom linedef specials as data.
// trigger: W = walk over, S = switch (use), G = gun (shoot), D = manual door (use, no tag).
// repeat: true for xR variants. Each entry: [special, trigger, repeat, kind, type, extra]

const RAW = [
  // Manual doors (act on the sector behind the line)
  [1, 'D', true, 'door', 'normal'],
  [26, 'D', true, 'door', 'normal', { key: 'blue' }],
  [27, 'D', true, 'door', 'normal', { key: 'yellow' }],
  [28, 'D', true, 'door', 'normal', { key: 'red' }],
  [31, 'D', false, 'door', 'open'],
  [32, 'D', false, 'door', 'open', { key: 'blue' }],
  [33, 'D', false, 'door', 'open', { key: 'red' }],
  [34, 'D', false, 'door', 'open', { key: 'yellow' }],
  [117, 'D', true, 'door', 'blazeRaise'],
  [118, 'D', false, 'door', 'blazeOpen'],
  // Tagged doors
  [2, 'W', false, 'door', 'open'],
  [3, 'W', false, 'door', 'close'],
  [4, 'W', false, 'door', 'normal'],
  [16, 'W', false, 'door', 'close30ThenOpen'],
  [29, 'S', false, 'door', 'normal'],
  [42, 'S', true, 'door', 'close'],
  [46, 'G', true, 'door', 'open'],
  [50, 'S', false, 'door', 'close'],
  [61, 'S', true, 'door', 'open'],
  [63, 'S', true, 'door', 'normal'],
  [75, 'W', true, 'door', 'close'],
  [76, 'W', true, 'door', 'close30ThenOpen'],
  [86, 'W', true, 'door', 'open'],
  [90, 'W', true, 'door', 'normal'],
  [103, 'S', false, 'door', 'open'],
  [105, 'W', true, 'door', 'blazeRaise'],
  [106, 'W', true, 'door', 'blazeOpen'],
  [107, 'W', true, 'door', 'blazeClose'],
  [108, 'W', false, 'door', 'blazeRaise'],
  [109, 'W', false, 'door', 'blazeOpen'],
  [110, 'W', false, 'door', 'blazeClose'],
  [111, 'S', false, 'door', 'blazeRaise'],
  [112, 'S', false, 'door', 'blazeOpen'],
  [113, 'S', false, 'door', 'blazeClose'],
  [114, 'S', true, 'door', 'blazeRaise'],
  [115, 'S', true, 'door', 'blazeOpen'],
  [116, 'S', true, 'door', 'blazeClose'],
  [99, 'S', true, 'door', 'blazeOpen', { key: 'blue' }],
  [133, 'S', false, 'door', 'blazeOpen', { key: 'blue' }],
  [134, 'S', true, 'door', 'blazeOpen', { key: 'red' }],
  [135, 'S', false, 'door', 'blazeOpen', { key: 'red' }],
  [136, 'S', true, 'door', 'blazeOpen', { key: 'yellow' }],
  [137, 'S', false, 'door', 'blazeOpen', { key: 'yellow' }],
  // Floors
  [5, 'W', false, 'floor', 'raiseFloor'],
  [18, 'S', false, 'floor', 'raiseFloorToNearest'],
  [19, 'W', false, 'floor', 'lowerFloor'],
  [23, 'S', false, 'floor', 'lowerFloorToLowest'],
  [24, 'G', false, 'floor', 'raiseFloor'],
  [30, 'W', false, 'floor', 'raiseToTexture'],
  [36, 'W', false, 'floor', 'turboLower'],
  [37, 'W', false, 'floor', 'lowerAndChange'],
  [38, 'W', false, 'floor', 'lowerFloorToLowest'],
  [45, 'S', true, 'floor', 'lowerFloor'],
  [55, 'S', false, 'floor', 'raiseFloorCrush'],
  [56, 'W', false, 'floor', 'raiseFloorCrush'],
  [58, 'W', false, 'floor', 'raiseFloor24'],
  [59, 'W', false, 'floor', 'raiseFloor24AndChange'],
  [60, 'S', true, 'floor', 'lowerFloorToLowest'],
  [64, 'S', true, 'floor', 'raiseFloor'],
  [65, 'S', true, 'floor', 'raiseFloorCrush'],
  [69, 'S', true, 'floor', 'raiseFloorToNearest'],
  [70, 'S', true, 'floor', 'turboLower'],
  [71, 'S', false, 'floor', 'turboLower'],
  [82, 'W', true, 'floor', 'lowerFloorToLowest'],
  [83, 'W', true, 'floor', 'lowerFloor'],
  [84, 'W', true, 'floor', 'lowerAndChange'],
  [91, 'W', true, 'floor', 'raiseFloor'],
  [92, 'W', true, 'floor', 'raiseFloor24'],
  [93, 'W', true, 'floor', 'raiseFloor24AndChange'],
  [94, 'W', true, 'floor', 'raiseFloorCrush'],
  [96, 'W', true, 'floor', 'raiseToTexture'],
  [98, 'W', true, 'floor', 'turboLower'],
  [101, 'S', false, 'floor', 'raiseFloor'],
  [102, 'S', false, 'floor', 'lowerFloor'],
  [119, 'W', false, 'floor', 'raiseFloorToNearest'],
  [128, 'W', true, 'floor', 'raiseFloorToNearest'],
  [129, 'W', true, 'floor', 'raiseFloorTurbo'],
  [130, 'W', false, 'floor', 'raiseFloorTurbo'],
  [131, 'S', false, 'floor', 'raiseFloorTurbo'],
  [132, 'S', true, 'floor', 'raiseFloorTurbo'],
  [140, 'S', false, 'floor', 'raiseFloor512'],
  [9, 'S', false, 'donut', 'donut'],
  // Platforms / lifts
  [10, 'W', false, 'plat', 'downWaitUpStay'],
  [21, 'S', false, 'plat', 'downWaitUpStay'],
  [62, 'S', true, 'plat', 'downWaitUpStay'],
  [88, 'W', true, 'plat', 'downWaitUpStay'],
  [120, 'W', true, 'plat', 'blazeDWUS'],
  [121, 'W', false, 'plat', 'blazeDWUS'],
  [122, 'S', false, 'plat', 'blazeDWUS'],
  [123, 'S', true, 'plat', 'blazeDWUS'],
  [14, 'S', false, 'plat', 'raiseAndChange', { amount: 32 }],
  [15, 'S', false, 'plat', 'raiseAndChange', { amount: 24 }],
  [20, 'S', false, 'plat', 'raiseToNearestAndChange'],
  [22, 'W', false, 'plat', 'raiseToNearestAndChange'],
  [47, 'G', false, 'plat', 'raiseToNearestAndChange'],
  [66, 'S', true, 'plat', 'raiseAndChange', { amount: 24 }],
  [67, 'S', true, 'plat', 'raiseAndChange', { amount: 32 }],
  [68, 'S', true, 'plat', 'raiseToNearestAndChange'],
  [95, 'W', true, 'plat', 'raiseToNearestAndChange'],
  [53, 'W', false, 'plat', 'perpetualRaise'],
  [87, 'W', true, 'plat', 'perpetualRaise'],
  [54, 'W', false, 'platStop', 'stop'],
  [89, 'W', true, 'platStop', 'stop'],
  // Ceilings and crushers
  [40, 'W', false, 'ceiling', 'raiseToHighest'],
  [41, 'S', false, 'ceiling', 'lowerToFloor'],
  [43, 'S', true, 'ceiling', 'lowerToFloor'],
  [44, 'W', false, 'ceiling', 'lowerAndCrush'],
  [49, 'S', false, 'ceiling', 'crushAndRaise'],
  [72, 'W', true, 'ceiling', 'lowerAndCrush'],
  [6, 'W', false, 'ceiling', 'fastCrushAndRaise'],
  [25, 'W', false, 'ceiling', 'crushAndRaise'],
  [73, 'W', true, 'ceiling', 'crushAndRaise'],
  [77, 'W', true, 'ceiling', 'fastCrushAndRaise'],
  [141, 'W', false, 'ceiling', 'silentCrushAndRaise'],
  [57, 'W', false, 'crushStop', 'stop'],
  [74, 'W', true, 'crushStop', 'stop'],
  // Stairs
  [7, 'S', false, 'stairs', 'build8'],
  [8, 'W', false, 'stairs', 'build8'],
  [100, 'W', false, 'stairs', 'turbo16'],
  [127, 'S', false, 'stairs', 'turbo16'],
  // Exits
  [11, 'S', false, 'exit', 'normal'],
  [51, 'S', false, 'exit', 'secret'],
  [52, 'W', false, 'exit', 'normal'],
  [124, 'W', false, 'exit', 'secret'],
  // Teleports
  [39, 'W', false, 'teleport', 'any'],
  [97, 'W', true, 'teleport', 'any'],
  [125, 'W', false, 'teleport', 'monster'],
  [126, 'W', true, 'teleport', 'monster'],
  // Lights
  [12, 'W', false, 'light', 'maxNeighbor'],
  [13, 'W', false, 'light', 'set', { level: 255 }],
  [35, 'W', false, 'light', 'set', { level: 35 }],
  [79, 'W', true, 'light', 'set', { level: 35 }],
  [80, 'W', true, 'light', 'maxNeighbor'],
  [81, 'W', true, 'light', 'set', { level: 255 }],
  [104, 'W', false, 'light', 'minNeighbor'],
  [138, 'S', true, 'light', 'set', { level: 255 }],
  [139, 'S', true, 'light', 'set', { level: 35 }],
  [17, 'W', false, 'light', 'strobe'],
  // Scrolling wall (visual only)
  [48, 'none', false, 'scroll', 'left'],
];

export const LINE_SPECIALS = new Map(
  RAW.map(([special, trigger, repeat, kind, type, extra = {}]) => [
    special,
    Object.freeze({ special, trigger, repeat, kind, type, ...extra }),
  ]),
);

export const lineSpecial = (special) => LINE_SPECIALS.get(special) ?? null;

export const SECTOR_SPECIALS = Object.freeze({
  LIGHT_BLINK_RANDOM: 1,
  LIGHT_BLINK_HALF: 2,
  LIGHT_BLINK_ONE: 3,
  DAMAGE_20_STROBE: 4,
  DAMAGE_10: 5,
  DAMAGE_5: 7,
  LIGHT_GLOW: 8,
  SECRET: 9,
  DOOR_CLOSE_30: 10,
  DAMAGE_20_EXIT: 11,
  LIGHT_SYNC_ONE: 12,
  LIGHT_SYNC_HALF: 13,
  DOOR_RAISE_5MIN: 14,
  DAMAGE_20: 16,
  LIGHT_FLICKER: 17,
});

// Sectors that behave like doors: rendered as blocks that sink when opened.
export function findDoorSectors(map) {
  const doors = new Set();
  for (const s of map.sectors) if (s.ceiling <= s.floor) doors.add(s.index);
  for (const line of map.linedefs) {
    const sp = lineSpecial(line.special);
    if (!sp || sp.kind !== 'door') continue;
    if (sp.trigger === 'D') {
      if (line.backSector >= 0) doors.add(line.backSector);
    } else if (line.tag) {
      for (const s of map.sectors) if (s.tag === line.tag) doors.add(s.index);
    }
  }
  for (const s of map.sectors) {
    if (s.special === SECTOR_SPECIALS.DOOR_CLOSE_30 || s.special === SECTOR_SPECIALS.DOOR_RAISE_5MIN) doors.add(s.index);
  }
  return doors;
}
