// Doom-style automap drawn on a 2D canvas: a corner minimap and a full overlay
// (Tab). Lines are revealed as the player gets near them, or all at once with
// the computer area map. The map turns with the camera so "up" matches the view.

import { LINE_FLAGS } from '../wad/map.js';

const REVEAL_RADIUS = 640;
const REVEAL_EVERY_TICS = 6;
const COLORS = Object.freeze({
  wall: '#fc0000',
  step: '#bc7844',
  ceiling: '#fcfc00',
  plain: '#808080',
  hidden: '#4040a0',
  secret: '#fc0000',
  player: '#ffffff',
  monster: '#fc6060',
  item: '#60fc60',
  key: { blue: '#4080ff', yellow: '#fcfc00', red: '#fc2020' },
});

export function createAutomap(root, cameraYaw) {
  const mini = document.createElement('canvas');
  mini.className = 'minimap';
  const full = document.createElement('canvas');
  full.className = 'automap hidden';
  root.append(mini, full);
  let seen = new Uint8Array(0);
  let level = null;
  let lastReveal = -1;
  let fullOpen = false;
  // Rotate so camera-forward points up the screen.
  const rotation = Math.atan2(Math.cos(cameraYaw), Math.sin(cameraYaw)) - Math.PI / 2;
  const cos = Math.cos(-rotation), sin = Math.sin(-rotation);

  function lineColor(line) {
    if (line.flags & LINE_FLAGS.SECRET) return COLORS.wall;
    if (line.back < 0) return COLORS.wall;
    const a = level.sectors[line.frontSector], b = level.sectors[line.backSector];
    if (!a || !b) return COLORS.wall;
    if (a.floor !== b.floor) return COLORS.step;
    if (a.ceiling !== b.ceiling) return COLORS.ceiling;
    return null; // plain two-sided lines are not drawn, as in Doom
  }

  function reveal() {
    const p = level.playerMobj;
    for (const line of level.lineIndex.near(p.x, p.y, REVEAL_RADIUS)) {
      if (level.lineIndex.distance(line, p.x, p.y) <= REVEAL_RADIUS) seen[line.index] = 1;
    }
  }

  function draw(canvas, scale, alpha) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
    const p = level.playerMobj;
    const px = p.prevX + (p.x - p.prevX) * 0.5, py = p.prevY + (p.y - p.prevY) * 0.5;
    const toScreen = (x, y) => {
      const dx = x - px, dy = y - py;
      return [w / 2 + (dx * cos - dy * sin) * scale, h / 2 - (dx * sin + dy * cos) * scale];
    };
    const allmap = level.player.powers.allmap;
    const verts = level.map.vertices;
    ctx.lineWidth = 1.2;
    for (const line of level.lines) {
      if (line.flags & LINE_FLAGS.NEVER_ON_MAP) continue;
      const known = seen[line.index] || line.flags & LINE_FLAGS.ALWAYS_ON_MAP;
      if (!known && !allmap) continue;
      let color = lineColor(line);
      if (!known) color = line.back < 0 || color ? COLORS.hidden : null;
      if (!color) continue;
      const [x0, y0] = toScreen(verts[line.v1].x, verts[line.v1].y);
      const [x1, y1] = toScreen(verts[line.v2].x, verts[line.v2].y);
      if ((x0 < 0 && x1 < 0) || (y0 < 0 && y1 < 0) || (x0 > w && x1 > w) || (y0 > h && y1 > h)) continue;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // Player arrow.
    const [cx, cy] = toScreen(px, py);
    const a = p.angle;
    const tip = toScreen(px + Math.cos(a) * 24, py + Math.sin(a) * 24);
    const l = toScreen(px + Math.cos(a + 2.5) * 16, py + Math.sin(a + 2.5) * 16);
    const r = toScreen(px + Math.cos(a - 2.5) * 16, py + Math.sin(a - 2.5) * 16);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(l[0], l[1]);
    ctx.lineTo(cx, cy);
    ctx.lineTo(r[0], r[1]);
    ctx.closePath();
    ctx.fill();
  }

  return {
    setLevel(next) {
      level = next;
      seen = new Uint8Array(next ? next.lines.length : 0);
      lastReveal = -1;
    },
    toggle() {
      fullOpen = !fullOpen;
      full.classList.toggle('hidden', !fullOpen);
    },
    show(on) {
      mini.classList.toggle('hidden', !on);
      if (!on) { fullOpen = false; full.classList.add('hidden'); }
    },
    get open() { return fullOpen; },
    update() {
      if (!level) return;
      if (level.tic - lastReveal >= REVEAL_EVERY_TICS) {
        reveal();
        lastReveal = level.tic;
      }
      draw(mini, 0.09, 0.45);
      if (fullOpen) draw(full, 0.22, 0.7);
    },
  };
}
