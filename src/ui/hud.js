// In-game HUD: health with Doom's face, armour, ammo, keys, weapons, messages and screen tints.

import { WEAPONS } from '../game/info/weapons.js';

const MESSAGE_MS = 4000;
const KEY_PATCHES = { blue: 'STKEYS0', yellow: 'STKEYS1', red: 'STKEYS2' };
const AMMO_LABEL = { bullets: 'Bullets', shells: 'Shells', rockets: 'Rockets', cells: 'Cells' };

function el(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent?.appendChild(node);
  return node;
}

// Doom's status bar face (ST_updateFaceWidget, simplified).
function createFace(patches) {
  let look = 1, lookTimer = 0, grinTimer = 0, ouchTimer = 0;
  return {
    grin() { grinTimer = 70; },
    hurt(amount) { ouchTimer = amount > 20 ? 35 : 20; },
    patch(player) {
      if (player.dead || player.health <= 0) return patches.url('STFDEAD0');
      if (player.powers.invulnerability > 0) return patches.url('STFGOD0');
      const pain = Math.min(4, Math.floor(((100 - Math.min(100, player.health)) * 5) / 101));
      if (ouchTimer > 0) { ouchTimer--; return patches.url(ouchTimer > 20 ? `STFOUCH${pain}` : `STFKILL${pain}`); }
      if (grinTimer > 0) { grinTimer--; return patches.url(`STFEVL${pain}`); }
      if (--lookTimer <= 0) { look = Math.floor(Math.random() * 3); lookTimer = 17 + Math.floor(Math.random() * 35); }
      return patches.url(`STFST${pain}${look}`);
    },
  };
}

export function createHud(root, patches) {
  const hud = el('div', 'hud hidden', root);
  const tint = el('div', 'tint', hud);
  const messages = el('div', 'messages', hud);
  const center = el('div', 'center-text', hud);
  const powers = el('div', 'powers', hud);
  const bar = el('div', 'bar', hud);

  const healthBox = el('div', 'stat health', bar);
  const face = el('img', 'face', healthBox);
  const healthNum = el('div', 'num', healthBox);
  el('div', 'label', healthBox).textContent = 'Health';

  const armorBox = el('div', 'stat armor', bar);
  const armorNum = el('div', 'num', armorBox);
  el('div', 'label', armorBox).textContent = 'Armor';

  const weaponBox = el('div', 'stat weapon', bar);
  const weaponIcon = el('img', 'weapon-icon', weaponBox);
  const ammoNum = el('div', 'num', weaponBox);
  const weaponName = el('div', 'label', weaponBox);

  const slots = el('div', 'slots', bar);
  const slotEls = [1, 2, 3, 4, 5, 6, 7].map((n) => {
    const s = el('div', 'slot', slots);
    s.textContent = n;
    return s;
  });

  const keysBox = el('div', 'keys', bar);
  const keyEls = Object.fromEntries(Object.entries(KEY_PATCHES).map(([k, patch]) => {
    const img = el('img', 'key', keysBox);
    img.src = patches.url(patch) ?? '';
    img.alt = `${k} key`;
    return [k, img];
  }));

  const ammoTable = el('div', 'ammo-table', bar);
  const ammoRows = Object.fromEntries(Object.entries(AMMO_LABEL).map(([k, label]) => {
    const row = el('div', 'ammo-row', ammoTable);
    el('span', 'ammo-name', row).textContent = label;
    return [k, el('span', 'ammo-val', row)];
  }));

  const faceState = createFace(patches);
  const shown = [];
  let lastFace = null;

  return {
    show(on) { hud.classList.toggle('hidden', !on); },
    message(text) {
      const node = el('div', 'msg', messages);
      node.textContent = text;
      shown.push({ node, until: performance.now() + MESSAGE_MS });
      while (shown.length > 4) shown.shift().node.remove();
    },
    event(e) {
      if (e.type === 'playerHurt') faceState.hurt(e.amount);
      if (e.type === 'message' && e.kind === 'pickup' && /You got/.test(e.text)) faceState.grin();
    },
    setCenter(text) { center.textContent = text ?? ''; center.classList.toggle('visible', !!text); },
    update(level) {
      const p = level.player;
      const now = performance.now();
      while (shown.length && shown[0].until < now) shown.shift().node.remove();

      const f = faceState.patch(p);
      if (f !== lastFace) { face.src = f ?? ''; lastFace = f; }
      healthNum.textContent = `${Math.max(0, p.health)}%`;
      armorNum.textContent = `${p.armor}%`;
      armorBox.classList.toggle('blue', p.armorClass === 2);
      const w = WEAPONS[p.weapon];
      weaponName.textContent = w.name;
      ammoNum.textContent = w.ammo ? p.ammo[w.ammo] : '∞';
      const icon = w.icon ? patches.url(w.icon) : null;
      weaponIcon.style.visibility = icon ? 'visible' : 'hidden';
      if (icon && weaponIcon.src !== icon) weaponIcon.src = icon;

      slotEls.forEach((s, i) => {
        const slot = i + 1;
        const owned = Object.entries(WEAPONS).some(([k, def]) => def.slot === slot && p.weapons.has(k));
        s.classList.toggle('owned', owned);
        s.classList.toggle('active', w.slot === slot);
      });
      for (const [k, img] of Object.entries(keyEls)) img.classList.toggle('have', p.keys.has(k));
      for (const [k, cell] of Object.entries(ammoRows)) cell.textContent = `${p.ammo[k]} / ${p.maxAmmo[k]}`;

      const pw = p.powers;
      const parts = [];
      if (pw.invulnerability > 0) parts.push(`Invulnerable ${Math.ceil(pw.invulnerability / 35)}s`);
      if (pw.invisibility > 0) parts.push(`Invisible ${Math.ceil(pw.invisibility / 35)}s`);
      if (pw.radsuit > 0) parts.push(`Rad suit ${Math.ceil(pw.radsuit / 35)}s`);
      if (pw.lightAmp > 0) parts.push(`Light amp ${Math.ceil(pw.lightAmp / 35)}s`);
      if (pw.berserk) parts.push('Berserk');
      powers.textContent = parts.join('  ·  ');

      // Doom's palette flashes: red for damage, gold for pickups, green for the rad suit.
      let color = 'transparent';
      if (pw.invulnerability > 0 && (pw.invulnerability > 128 || pw.invulnerability & 8)) color = 'rgba(255,255,255,0.18)';
      else if (p.damageCount > 0) color = `rgba(255,0,0,${Math.min(0.55, p.damageCount / 60)})`;
      else if (p.bonusCount > 0) color = `rgba(215,186,69,${Math.min(0.3, p.bonusCount / 40)})`;
      else if (pw.radsuit > 0 && (pw.radsuit > 128 || pw.radsuit & 8)) color = 'rgba(0,255,0,0.12)';
      tint.style.background = color;
    },
  };
}
