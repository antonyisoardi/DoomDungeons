// Spatial hash of linedefs for "which line is near this point" queries.

const BUCKET = 64;

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function createLineIndex(map) {
  const buckets = new Map();
  const key = (bx, by) => (bx + 32768) * 65536 + (by + 32768);

  for (const line of map.linedefs) {
    const a = map.vertices[line.v1], b = map.vertices[line.v2];
    const x0 = Math.floor(Math.min(a.x, b.x) / BUCKET), x1 = Math.floor(Math.max(a.x, b.x) / BUCKET);
    const y0 = Math.floor(Math.min(a.y, b.y) / BUCKET), y1 = Math.floor(Math.max(a.y, b.y) / BUCKET);
    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        const k = key(bx, by);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(line);
      }
    }
  }

  // Lines whose bounding buckets overlap the circle (x, y, radius), without duplicates.
  function near(x, y, radius) {
    const seen = new Set();
    const out = [];
    const bx0 = Math.floor((x - radius) / BUCKET), bx1 = Math.floor((x + radius) / BUCKET);
    const by0 = Math.floor((y - radius) / BUCKET), by1 = Math.floor((y + radius) / BUCKET);
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        for (const line of buckets.get(key(bx, by)) ?? []) {
          if (seen.has(line.index)) continue;
          seen.add(line.index);
          out.push(line);
        }
      }
    }
    return out;
  }

  function distance(line, x, y) {
    const a = map.vertices[line.v1], b = map.vertices[line.v2];
    return distanceToSegment(x, y, a.x, a.y, b.x, b.y);
  }

  // Nearest line within radius accepted by the filter.
  function nearest(x, y, radius, accept = () => true) {
    let best = null, bestDist = radius;
    for (const line of near(x, y, radius)) {
      if (!accept(line)) continue;
      const d = distance(line, x, y);
      if (d <= bestDist) { best = line; bestDist = d; }
    }
    return best;
  }

  return Object.freeze({ near, nearest, distance });
}
