// Full-screen DOM screens: WAD picker, title/menus, intermission and episode end.

const MENU_SOUNDS = { move: 'DSPSTOP', pick: 'DSPISTOL', back: 'DSSWTCHX' };

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

export function createScreens(root, { sound } = {}) {
  const layer = el('div', 'screen hidden', root);
  let cleanup = null;

  function open(className) {
    close();
    layer.className = `screen ${className}`;
    layer.replaceChildren();
    return layer;
  }

  function close() {
    cleanup?.();
    cleanup = null;
    layer.className = 'screen hidden';
    layer.replaceChildren();
  }

  // items: [{ label, value, disabled }] -> resolves with value (or null on Escape if cancellable)
  function menu({ title, logo, subtitle, items, background, cancellable = false, footer }) {
    return new Promise((resolve) => {
      const node = open(logo ? 'menu-screen title-screen' : 'menu-screen');
      if (background) {
        background.classList.add('backdrop');
        node.appendChild(background);
      }
      const panel = el('div', 'panel', node);
      if (logo) el('div', 'logo', panel, logo);
      if (title) el('h1', 'title', panel, title);
      if (subtitle) el('p', 'subtitle', panel, subtitle);
      const list = el('div', 'menu', panel);
      let index = Math.max(0, items.findIndex((i) => !i.disabled));
      const buttons = items.map((item, i) => {
        const b = el('button', 'menu-item', list, item.label);
        b.disabled = !!item.disabled;
        if (item.hint) { el('span', 'hint', b, item.hint); b.classList.add('has-hint'); }
        b.addEventListener('mouseenter', () => { if (!item.disabled) select(i); });
        b.addEventListener('click', () => choose(i));
        return b;
      });
      if (footer) el('p', 'footer', panel, footer);
      function select(i) {
        if (i !== index) sound?.(MENU_SOUNDS.move);
        index = i;
        buttons.forEach((b, j) => b.classList.toggle('selected', j === index));
      }
      function choose(i) {
        if (items[i].disabled) return;
        sound?.(MENU_SOUNDS.pick);
        close();
        resolve(items[i].value);
      }
      const onKey = (e) => {
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          let i = index;
          do i = (i + 1) % items.length; while (items[i].disabled);
          select(i);
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          let i = index;
          do i = (i - 1 + items.length) % items.length; while (items[i].disabled);
          select(i);
        } else if (e.code === 'Enter' || e.code === 'Space') {
          choose(index);
        } else if (e.code === 'Escape' && cancellable) {
          sound?.(MENU_SOUNDS.back);
          close();
          resolve(null);
        } else return;
        e.preventDefault();
        e.stopPropagation();
      };
      window.addEventListener('keydown', onKey, true);
      cleanup = () => window.removeEventListener('keydown', onKey, true);
      select(index);
    });
  }

  // Press any key / click to continue.
  function waitForContinue(node) {
    return new Promise((resolve) => {
      let armed = false;
      setTimeout(() => { armed = true; }, 400);
      const go = (e) => {
        if (!armed) return;
        e.preventDefault();
        close();
        resolve();
      };
      window.addEventListener('keydown', go, true);
      node.addEventListener('click', go);
      cleanup = () => window.removeEventListener('keydown', go, true);
    });
  }

  function intermission({ background, finishedPatch, enteringPatch, finishedName, nextName, stats, time, par }) {
    const node = open('intermission');
    if (background) { background.classList.add('backdrop'); node.appendChild(background); }
    const panel = el('div', 'panel stats', node);
    const head = el('div', 'level-name', panel);
    if (finishedPatch) { const img = el('img', 'patch', head); img.src = finishedPatch; }
    else el('div', '', head, finishedName);
    el('div', 'finished', head, 'Finished');
    const pct = (a, b) => (b ? `${Math.round((a * 100) / b)}%` : '100%');
    const rows = [
      ['Kills', pct(stats.kills, stats.totalKills)],
      ['Items', pct(stats.items, stats.totalItems)],
      ['Secrets', pct(stats.secrets, stats.totalSecrets)],
      ['Time', formatTime(time)],
      ['Par', formatTime(par)],
    ];
    const table = el('div', 'stat-table', panel);
    for (const [label, value] of rows) {
      const row = el('div', 'stat-row', table);
      el('span', 'stat-label', row, label);
      el('span', 'stat-value', row, value);
    }
    if (nextName) {
      const next = el('div', 'level-name next', panel);
      el('div', 'entering', next, 'Entering');
      if (enteringPatch) { const img = el('img', 'patch', next); img.src = enteringPatch; }
      else el('div', '', next, nextName);
    }
    el('p', 'footer', panel, 'Press any key to continue');
    return waitForContinue(node);
  }

  function story({ title, text, background }) {
    const node = open('story');
    if (background) { background.classList.add('backdrop'); node.appendChild(background); }
    const panel = el('div', 'panel', node);
    el('h1', 'title', panel, title);
    el('p', 'story-text', panel, text);
    el('p', 'footer', panel, 'Press any key to continue');
    return waitForContinue(node);
  }

  function wadPicker({ message, onFile }) {
    const node = open('wad-picker');
    const panel = el('div', 'panel', node);
    el('h1', 'title', panel, 'DoomDungeons');
    el('p', 'subtitle', panel, message);
    const drop = el('label', 'drop', panel);
    el('span', '', drop, 'Drop DOOM.WAD or DOOM1.WAD here, or click to choose it');
    const input = el('input', '', drop);
    input.type = 'file';
    input.accept = '.wad,.WAD';
    const error = el('p', 'error', panel);
    el('p', 'footer', panel, 'Your WAD stays on this computer. The free shareware DOOM1.WAD gives you Episode 1; the full DOOM.WAD unlocks all four episodes.');
    const handle = async (file) => {
      if (!file) return;
      error.textContent = '';
      try { await onFile(file); } catch (err) { error.textContent = err.message; }
    };
    input.addEventListener('change', () => handle(input.files[0]));
    const over = (e) => { e.preventDefault(); drop.classList.add('over'); };
    const leave = () => drop.classList.remove('over');
    const dropped = (e) => { e.preventDefault(); leave(); handle(e.dataTransfer.files[0]); };
    node.addEventListener('dragover', over);
    node.addEventListener('dragleave', leave);
    node.addEventListener('drop', dropped);
  }

  function loading(text) {
    const node = open('loading');
    el('div', 'loading-text', node, text);
  }

  return { menu, intermission, story, wadPicker, loading, close, get open() { return !layer.classList.contains('hidden'); } };
}

export function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
