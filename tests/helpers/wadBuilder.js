// Build synthetic WADs in memory for tests.
//
//   buildWad(lumps)            lumps: [{ name, data: Uint8Array }] -> ArrayBuffer
//   encodeMapLumps(raw)        raw map records -> the 10 map lumps (empty BSP)
//   buildRectMap(desc)         axis-aligned rectangles -> raw map records
//   buildTestWad({ maps })     a PWAD with PLAYPAL, PNAMES/TEXTURE1, a patch, flats and maps
//
// Map layout helper: every sector is one or more rectangles. Lines are generated
// automatically: shared edges become two-sided lines, outer edges one-sided walls.

const MAP_LUMP_ORDER = ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'];

export const WALL_TEXTURE = 'WALL';
export const FLOOR_FLAT = 'FLOOR';
export const CEIL_FLAT = 'CEIL';
export const PATCH_NAME = 'WALLPAT';

export const SKILL_ALL = 7;

// ---------------------------------------------------------------------------
// Byte helpers

export function writeName(bytes, offset, name, length = 8) {
  for (let i = 0; i < length; i++) bytes[offset + i] = i < name.length ? name.charCodeAt(i) : 0;
}

function recordLump(count, size, write) {
  const bytes = new Uint8Array(count * size);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < count; i++) write(view, i * size, bytes, i);
  return bytes;
}

// ---------------------------------------------------------------------------
// WAD container

export function buildWad(lumps, type = 'PWAD') {
  const dataSize = lumps.reduce((n, l) => n + (l.data?.length ?? 0), 0);
  const dirOffset = 12 + dataSize;
  const buffer = new ArrayBuffer(dirOffset + lumps.length * 16);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  writeName(bytes, 0, type, 4);
  view.setInt32(4, lumps.length, true);
  view.setInt32(8, dirOffset, true);
  let at = 12;
  lumps.forEach((lump, i) => {
    const data = lump.data ?? new Uint8Array(0);
    bytes.set(data, at);
    const entry = dirOffset + i * 16;
    view.setInt32(entry, at, true);
    view.setInt32(entry + 4, data.length, true);
    writeName(bytes, entry + 8, lump.name);
    at += data.length;
  });
  return buffer;
}

export const marker = (name) => ({ name, data: new Uint8Array(0) });

// ---------------------------------------------------------------------------
// Graphics lumps

// 14 palettes; palette 0 maps index i to (i, 255 - i, (i * 7) & 255) so colours are easy to predict.
export function buildPlaypal(count = 14) {
  const bytes = new Uint8Array(768 * count);
  for (let p = 0; p < count; p++) {
    for (let i = 0; i < 256; i++) {
      bytes[p * 768 + i * 3] = (i + p) & 255;
      bytes[p * 768 + i * 3 + 1] = (255 - i) & 255;
      bytes[p * 768 + i * 3 + 2] = (i * 7) & 255;
    }
  }
  return bytes;
}

// columns: array (one per x) of posts [{ top, pixels: [indices] }].
export function buildPicture({ width, height, leftOffset = 0, topOffset = 0, columns }) {
  const columnBytes = columns.map((posts) => {
    const out = [];
    for (const post of posts) out.push(post.top, post.pixels.length, 0, ...post.pixels, 0);
    out.push(0xff);
    return out;
  });
  const headerSize = 8 + width * 4;
  const total = headerSize + columnBytes.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, width, true);
  view.setUint16(2, height, true);
  view.setInt16(4, leftOffset, true);
  view.setInt16(6, topOffset, true);
  let at = headerSize;
  columnBytes.forEach((col, x) => {
    view.setUint32(8 + x * 4, at, true);
    bytes.set(col, at);
    at += col.length;
  });
  return bytes;
}

// A solid width x height patch filled with one colour.
export function solidPicture(width, height, color) {
  const columns = Array.from({ length: width }, () => [{ top: 0, pixels: new Array(height).fill(color) }]);
  return buildPicture({ width, height, columns });
}

export function buildPnames(names) {
  const bytes = new Uint8Array(4 + names.length * 8);
  new DataView(bytes.buffer).setInt32(0, names.length, true);
  names.forEach((n, i) => writeName(bytes, 4 + i * 8, n));
  return bytes;
}

// textures: [{ name, width, height, patches: [{ originX, originY, patch: index into PNAMES }] }]
export function buildTextureLump(textures) {
  const headerSize = 4 + textures.length * 4;
  const sizes = textures.map((t) => 22 + t.patches.length * 10);
  const bytes = new Uint8Array(headerSize + sizes.reduce((a, b) => a + b, 0));
  const view = new DataView(bytes.buffer);
  view.setInt32(0, textures.length, true);
  let at = headerSize;
  textures.forEach((t, i) => {
    view.setInt32(4 + i * 4, at, true);
    writeName(bytes, at, t.name);
    view.setInt16(at + 12, t.width, true);
    view.setInt16(at + 14, t.height, true);
    view.setInt16(at + 20, t.patches.length, true);
    t.patches.forEach((p, j) => {
      const pa = at + 22 + j * 10;
      view.setInt16(pa, p.originX, true);
      view.setInt16(pa + 2, p.originY, true);
      view.setInt16(pa + 4, p.patch, true);
    });
    at += sizes[i];
  });
  return bytes;
}

export function flatLump(color) {
  return new Uint8Array(64 * 64).fill(color);
}

// ---------------------------------------------------------------------------
// Map lumps

// raw: { vertices: [{x,y}], sectors: [...], sidedefs: [...], linedefs: [...], things: [...] }
// linedef front/back are sidedef indices (-1 or 0xffff for none).
export function encodeMapLumps(raw) {
  const vertexes = recordLump(raw.vertices.length, 4, (v, at, b, i) => {
    v.setInt16(at, raw.vertices[i].x, true);
    v.setInt16(at + 2, raw.vertices[i].y, true);
  });
  const sectors = recordLump(raw.sectors.length, 26, (v, at, b, i) => {
    const s = raw.sectors[i];
    v.setInt16(at, s.floor ?? 0, true);
    v.setInt16(at + 2, s.ceiling ?? 128, true);
    writeName(b, at + 4, s.floorFlat ?? FLOOR_FLAT);
    writeName(b, at + 12, s.ceilingFlat ?? CEIL_FLAT);
    v.setInt16(at + 20, s.light ?? 160, true);
    v.setInt16(at + 22, s.special ?? 0, true);
    v.setInt16(at + 24, s.tag ?? 0, true);
  });
  const sidedefs = recordLump(raw.sidedefs.length, 30, (v, at, b, i) => {
    const s = raw.sidedefs[i];
    v.setInt16(at, s.xOffset ?? 0, true);
    v.setInt16(at + 2, s.yOffset ?? 0, true);
    writeName(b, at + 4, s.upper ?? '-');
    writeName(b, at + 12, s.lower ?? '-');
    writeName(b, at + 20, s.middle ?? '-');
    v.setUint16(at + 28, s.sector, true);
  });
  const side = (n) => (n === undefined || n < 0 ? 0xffff : n);
  const linedefs = recordLump(raw.linedefs.length, 14, (v, at, b, i) => {
    const l = raw.linedefs[i];
    v.setUint16(at, l.v1, true);
    v.setUint16(at + 2, l.v2, true);
    v.setUint16(at + 4, l.flags ?? 0, true);
    v.setUint16(at + 6, l.special ?? 0, true);
    v.setUint16(at + 8, l.tag ?? 0, true);
    v.setUint16(at + 10, side(l.front), true);
    v.setUint16(at + 12, side(l.back), true);
  });
  const things = recordLump(raw.things.length, 10, (v, at, b, i) => {
    const t = raw.things[i];
    v.setInt16(at, t.x, true);
    v.setInt16(at + 2, t.y, true);
    v.setInt16(at + 4, t.angle ?? 0, true);
    v.setInt16(at + 6, t.type, true);
    v.setInt16(at + 8, t.flags ?? SKILL_ALL, true);
  });
  const data = {
    THINGS: things, LINEDEFS: linedefs, SIDEDEFS: sidedefs, VERTEXES: vertexes,
    SEGS: raw.segs ?? new Uint8Array(0), SSECTORS: raw.ssectors ?? new Uint8Array(0), NODES: raw.nodes ?? new Uint8Array(0),
    SECTORS: sectors, REJECT: new Uint8Array(0), BLOCKMAP: new Uint8Array(0),
  };
  return MAP_LUMP_ORDER.map((name) => ({ name, data: data[name] }));
}

// ---------------------------------------------------------------------------
// Rectangle map layout

const inside = (r, x, y) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;

// Axis-aligned segment {ax, ay, bx, by} contains (x, y), excluding its end points.
function segmentContains(seg, x, y) {
  if (seg.ax === seg.bx) return x === seg.ax && y > Math.min(seg.ay, seg.by) && y < Math.max(seg.ay, seg.by);
  return y === seg.ay && x > Math.min(seg.ax, seg.bx) && x < Math.max(seg.ax, seg.bx);
}

// desc: {
//   sectors: [{ floor, ceiling, floorFlat, ceilingFlat, light, special, tag }],
//   rects: [{ sector, x0, y0, x1, y1 }],      // non-overlapping, coordinates on a 16 unit grid ideally
//   lines: [{ front, back, special, tag, flags, upper, middle, lower }],
//            // properties for every generated line between sector `front` and `back` (-1 = void);
//            // the line is oriented so `front` is on its front (right) side.
//            // Optional `at: [x, y]` limits the properties to the generated segment through that point.
//   things: [{ x, y, angle, type, flags }],
// }
export function buildRectMap(desc) {
  const rects = desc.rects;
  const sectorAtPoint = (x, y) => {
    const r = rects.find((rr) => inside(rr, x, y));
    return r ? r.sector : -1;
  };

  // Split every rectangle edge at every coordinate where another rectangle edge starts or ends.
  const xs = new Set(), ys = new Set();
  for (const r of rects) { xs.add(r.x0); xs.add(r.x1); ys.add(r.y0); ys.add(r.y1); }
  const sortedX = [...xs].sort((a, b) => a - b);
  const sortedY = [...ys].sort((a, b) => a - b);
  const segments = new Map();
  const addSegment = (ax, ay, bx, by) => {
    const key = `${Math.min(ax, bx)},${Math.min(ay, by)},${Math.max(ax, bx)},${Math.max(ay, by)}`;
    if (!segments.has(key)) segments.set(key, { ax, ay, bx, by });
  };
  for (const r of rects) {
    for (const y of [r.y0, r.y1]) {
      const cuts = sortedX.filter((x) => x >= r.x0 && x <= r.x1);
      for (let i = 0; i + 1 < cuts.length; i++) addSegment(cuts[i], y, cuts[i + 1], y);
    }
    for (const x of [r.x0, r.x1]) {
      const cuts = sortedY.filter((y) => y >= r.y0 && y <= r.y1);
      for (let i = 0; i + 1 < cuts.length; i++) addSegment(x, cuts[i], x, cuts[i + 1]);
    }
  }

  const vertices = [];
  const vertexIds = new Map();
  const vertex = (x, y) => {
    const key = `${x},${y}`;
    if (!vertexIds.has(key)) { vertexIds.set(key, vertices.length); vertices.push({ x, y }); }
    return vertexIds.get(key);
  };
  const sidedefs = [];
  const linedefs = [];
  const lineProps = desc.lines ?? [];

  for (const seg of segments.values()) {
    let { ax, ay, bx, by } = seg;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    // Right of a->b is the front side.
    const nx = dy / len, ny = -dx / len;
    let right = sectorAtPoint(mx + nx, my + ny);
    let left = sectorAtPoint(mx - nx, my - ny);
    if (right === left) continue; // interior of one sector
    const onSegment = (p) => !p.at || segmentContains(seg, p.at[0], p.at[1]);
    const props = lineProps.find((p) => onSegment(p) &&
      ((p.front === right && (p.back ?? -1) === left) || (p.front === left && (p.back ?? -1) === right))) ?? {};
    // Orientation: requested front side, else whichever side is not void.
    const wantFront = props.front ?? (right >= 0 ? right : left);
    if (wantFront !== right) {
      [ax, ay, bx, by] = [bx, by, ax, ay];
      [right, left] = [left, right];
    }
    const twoSided = left >= 0;
    const front = sidedefs.length;
    sidedefs.push(twoSided
      ? { sector: right, upper: props.upper ?? WALL_TEXTURE, lower: props.lower ?? WALL_TEXTURE, middle: props.middle ?? '-' }
      : { sector: right, middle: props.middle ?? WALL_TEXTURE });
    let back = -1;
    if (twoSided) {
      back = sidedefs.length;
      sidedefs.push({ sector: left, upper: props.upper ?? WALL_TEXTURE, lower: props.lower ?? WALL_TEXTURE, middle: '-' });
    }
    linedefs.push({
      v1: vertex(ax, ay), v2: vertex(bx, by),
      flags: (props.flags ?? (twoSided ? 0 : 1)) | (twoSided ? 4 : 0),
      special: props.special ?? 0, tag: props.tag ?? 0, front, back,
    });
  }

  return { vertices, sectors: desc.sectors, sidedefs, linedefs, things: desc.things ?? [] };
}

// ---------------------------------------------------------------------------
// Whole test WAD

export function graphicsLumps() {
  return [
    { name: 'PLAYPAL', data: buildPlaypal() },
    { name: 'PNAMES', data: buildPnames([PATCH_NAME]) },
    { name: 'TEXTURE1', data: buildTextureLump([{ name: WALL_TEXTURE, width: 16, height: 16, patches: [{ originX: 0, originY: 0, patch: 0 }] }]) },
    marker('P_START'),
    { name: PATCH_NAME, data: solidPicture(16, 16, 42) },
    marker('P_END'),
    marker('F_START'),
    { name: FLOOR_FLAT, data: flatLump(10) },
    { name: CEIL_FLAT, data: flatLump(20) },
    marker('F_END'),
  ];
}

// maps: { E1M1: rectMapDesc | rawMap }
export function buildTestWad({ maps = {}, graphics = true, type = 'PWAD' } = {}) {
  const lumps = graphics ? graphicsLumps() : [];
  for (const [name, desc] of Object.entries(maps)) {
    const raw = desc.rects ? buildRectMap(desc) : desc;
    lumps.push(marker(name), ...encodeMapLumps(raw));
  }
  return buildWad(lumps, type);
}
