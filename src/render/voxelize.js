// Turn a 2D Doom sprite into a chunky voxel model: every opaque pixel becomes a
// column of voxels whose depth grows toward the middle of the shape, so figures
// look sculpted rather than flat. Pure: returns typed arrays.

import { TRANSPARENT } from '../wad/graphics.js';

export const VOXEL_SHADE = Object.freeze({ FRONT: 1.0, BACK: 0.55, SIDE: 0.72, TOP: 0.95, BOTTOM: 0.5 });

// Manhattan distance from each opaque pixel to the nearest transparent one.
export function edgeDistance(width, height, opaque) {
  const dist = new Int32Array(width * height).fill(-1);
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!opaque[i]) continue;
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
        !opaque[i - 1] || !opaque[i + 1] || !opaque[i - width] || !opaque[i + width];
      if (edge) { dist[i] = 1; queue.push(i); }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width, y = (i / width) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (opaque[n] && dist[n] < 0) { dist[n] = dist[i] + 1; queue.push(n); }
    }
  }
  return dist;
}

export function voxelize(picture, palette, { flip = false, thickness = 1.6, maxDepth = 14, minDepth = 2 } = {}) {
  const { width, height } = picture;
  const opaque = new Uint8Array(width * height);
  for (let i = 0; i < opaque.length; i++) opaque[i] = picture.pixels[i] !== TRANSPARENT ? 1 : 0;
  const dist = edgeDistance(width, height, opaque);
  const half = new Float32Array(width * height);
  for (let i = 0; i < half.length; i++) {
    if (opaque[i]) half[i] = Math.min(maxDepth, minDepth + (dist[i] - 1) * thickness) / 2;
  }

  const positions = [];
  const colors = [];
  const indices = [];
  const quad = (pts, rgb, shade) => {
    const base = positions.length / 3;
    for (const p of pts) {
      positions.push(p[0], p[1], p[2]);
      colors.push((rgb[0] * shade) / 255, (rgb[1] * shade) / 255, (rgb[2] * shade) / 255);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : half[y * width + x]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!opaque[i]) continue;
      const rgb = palette[picture.pixels[i]];
      const h = half[i];
      // Screen column: flipped sprites mirror around their own offset.
      const col = flip ? width - 1 - x : x;
      const x0 = col - picture.leftOffset, x1 = x0 + 1;
      const y1 = picture.topOffset - y, y0 = y1 - 1;
      quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], rgb, VOXEL_SHADE.FRONT);
      quad([[x1, y0, -h], [x0, y0, -h], [x0, y1, -h], [x1, y1, -h]], rgb, VOXEL_SHADE.BACK);

      // Neighbours in screen space (account for flip when looking left/right).
      const left = at(flip ? x + 1 : x - 1, y), right = at(flip ? x - 1 : x + 1, y);
      const up = at(x, y - 1), down = at(x, y + 1);
      if (left < h) {
        quad([[x0, y0, -h], [x0, y0, -left], [x0, y1, -left], [x0, y1, -h]], rgb, VOXEL_SHADE.SIDE);
        quad([[x0, y0, left], [x0, y0, h], [x0, y1, h], [x0, y1, left]], rgb, VOXEL_SHADE.SIDE);
      }
      if (right < h) {
        quad([[x1, y0, h], [x1, y0, right], [x1, y1, right], [x1, y1, h]], rgb, VOXEL_SHADE.SIDE);
        quad([[x1, y0, -right], [x1, y0, -h], [x1, y1, -h], [x1, y1, -right]], rgb, VOXEL_SHADE.SIDE);
      }
      if (up < h) {
        quad([[x0, y1, h], [x1, y1, h], [x1, y1, up], [x0, y1, up]], rgb, VOXEL_SHADE.TOP);
        quad([[x0, y1, -up], [x1, y1, -up], [x1, y1, -h], [x0, y1, -h]], rgb, VOXEL_SHADE.TOP);
      }
      if (down < h) {
        quad([[x0, y0, down], [x1, y0, down], [x1, y0, h], [x0, y0, h]], rgb, VOXEL_SHADE.BOTTOM);
        quad([[x0, y0, -h], [x1, y0, -h], [x1, y0, -down], [x0, y0, -down]], rgb, VOXEL_SHADE.BOTTOM);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
  };
}
