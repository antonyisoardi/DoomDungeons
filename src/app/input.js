// Keyboard and mouse -> player input. Movement is screen-relative (W is "up"
// on screen), aim follows the mouse cursor on the ground plane.

const MOVE_KEYS = Object.freeze({
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
});
const USE_KEYS = ['KeyE', 'Space', 'KeyF'];
const WALK_KEYS = ['ShiftLeft', 'ShiftRight'];

export function createInput(target) {
  const down = new Set();
  const pressed = new Set(); // keys pressed since last poll
  const mouse = { x: 0, y: 0, buttons: 0, inside: false };
  let wheel = 0;
  const listeners = [];

  const on = (el, type, fn, opts) => {
    el.addEventListener(type, fn, opts);
    listeners.push(() => el.removeEventListener(type, fn, opts));
  };

  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
  });
  on(window, 'keyup', (e) => down.delete(e.code));
  on(window, 'blur', () => { down.clear(); mouse.buttons = 0; });
  on(target, 'mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; });
  on(target, 'mousedown', (e) => { mouse.buttons |= 1 << e.button; pressed.add(`Mouse${e.button}`); e.preventDefault(); });
  on(window, 'mouseup', (e) => { mouse.buttons &= ~(1 << e.button); });
  on(target, 'contextmenu', (e) => e.preventDefault());
  on(target, 'wheel', (e) => { wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

  const any = (codes) => codes.some((c) => down.has(c));

  return {
    mouse,
    isDown: (code) => down.has(code),
    // Consume a key press (edge triggered).
    takePress(code) {
      const had = pressed.has(code);
      pressed.delete(code);
      return had;
    },
    takeWheel() { const w = wheel; wheel = 0; return w; },
    clearPresses() { pressed.clear(); wheel = 0; },
    // Screen-space move axes (-1..1): x right, y up.
    moveAxes() {
      return {
        x: (any(MOVE_KEYS.right) ? 1 : 0) - (any(MOVE_KEYS.left) ? 1 : 0),
        y: (any(MOVE_KEYS.up) ? 1 : 0) - (any(MOVE_KEYS.down) ? 1 : 0),
      };
    },
    // Held buttons, or a click that was released before the next tic.
    fire() {
      const clicked = pressed.delete('Mouse0');
      return clicked || (mouse.buttons & 1) !== 0 || down.has('ControlRight');
    },
    use() {
      const clicked = pressed.delete('Mouse2') | pressed.delete('Mouse1');
      return !!clicked || any(USE_KEYS) || (mouse.buttons & 6) !== 0;
    },
    walk: () => any(WALK_KEYS),
    dispose() { listeners.forEach((off) => off()); },
  };
}
