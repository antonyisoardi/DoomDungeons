// Bucket grid for "things near here" queries.

const SIZE = 128;

export function createBlockmap() {
  const buckets = new Map();
  // Collision-free for |bucket| < 32768 (maps span at most 65536 units / 128 = 512 buckets).
  const key = (bx, by) => (bx + 32768) * 65536 + (by + 32768);

  return {
    link(mobj) {
      const k = key(Math.floor(mobj.x / SIZE), Math.floor(mobj.y / SIZE));
      mobj.bucket = k;
      if (!buckets.has(k)) buckets.set(k, new Set());
      buckets.get(k).add(mobj);
    },
    unlink(mobj) {
      if (mobj.bucket === undefined) return;
      buckets.get(mobj.bucket)?.delete(mobj);
      mobj.bucket = undefined;
    },
    relink(mobj) {
      const k = key(Math.floor(mobj.x / SIZE), Math.floor(mobj.y / SIZE));
      if (k === mobj.bucket) return;
      this.unlink(mobj);
      this.link(mobj);
    },
    // Calls fn for each thing whose bucket overlaps the box; stop early if fn returns false.
    each(x0, y0, x1, y1, fn) {
      const pad = 128; // largest radius (Spider Mastermind) sticking out of a bucket
      const bx0 = Math.floor((x0 - pad) / SIZE), bx1 = Math.floor((x1 + pad) / SIZE);
      const by0 = Math.floor((y0 - pad) / SIZE), by1 = Math.floor((y1 + pad) / SIZE);
      for (let bx = bx0; bx <= bx1; bx++) {
        for (let by = by0; by <= by1; by++) {
          const set = buckets.get(key(bx, by));
          if (!set) continue;
          for (const m of set) if (fn(m) === false) return;
        }
      }
    },
  };
}
