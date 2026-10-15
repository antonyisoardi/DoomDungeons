// Draw every map object as a voxel figure that faces the camera, picking Doom's
// rotation frame from the thing's facing like the original renderer did.

import * as THREE from 'three';
import { lightToBrightness } from '../world/style.js';
import { sectorIndexAt } from '../game/sim/world.js';

const HIDDEN_KINDS = new Set(['teleportDest']);
const SHADOW_KINDS = new Set(['player', 'monster', 'pickup', 'barrel']);
const SPIN_SPEED = 1.4; // radians per second for pickups

function rotationIndex(viewAngle, thingAngle) {
  // Doom: rot = (angle(viewer->thing) - thing.angle + 22.5deg * 9) >> 29
  const a = viewAngle - thingAngle + (Math.PI / 8) * 9;
  const t = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(t / (Math.PI / 4)) & 7;
}

export function createThingsView(scene, sprites, cameraYaw) {
  const group = new THREE.Group();
  scene.add(group);
  const views = new Map();
  // Direction the camera looks, in Doom map coordinates.
  const viewAngle = Math.atan2(Math.cos(cameraYaw), Math.sin(cameraYaw));
  const shadowGeometry = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

  function createView(m) {
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(undefined, material);
    mesh.rotation.y = -cameraYaw;
    mesh.matrixAutoUpdate = true;
    group.add(mesh);
    let shadow = null;
    if (SHADOW_KINDS.has(m.kind)) {
      shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadow.renderOrder = 1;
      group.add(shadow);
    }
    return { mesh, shadow, lumpKey: null };
  }

  function dispose(id) {
    const v = views.get(id);
    if (!v) return;
    group.remove(v.mesh);
    v.mesh.material.dispose();
    if (v.shadow) group.remove(v.shadow);
    views.delete(id);
  }

  return {
    group,
    // alpha: interpolation between the previous and current tic. time: seconds, for spin/bob.
    sync(level, alpha, time) {
      const seen = new Set();
      for (const m of level.mobjs) {
        if (m.removed || HIDDEN_KINDS.has(m.kind) || !m.sprite) continue;
        seen.add(m.id);
        let v = views.get(m.id);
        if (!v) { v = createView(m); views.set(m.id, v); }

        const spin = m.kind === 'pickup';
        const rot = spin ? 0 : rotationIndex(viewAngle, m.angle);
        const frame = sprites.frame(m.sprite, m.frame, rot);
        if (!frame) { v.mesh.visible = false; continue; }
        const key = `${frame.lump}:${frame.flip}`;
        if (key !== v.lumpKey) {
          v.mesh.geometry = sprites.geometry(frame.lump, frame.flip) ?? new THREE.BufferGeometry();
          v.lumpKey = key;
        }
        v.mesh.visible = true;

        const x = m.prevX + (m.x - m.prevX) * alpha;
        const y = m.prevY + (m.y - m.prevY) * alpha;
        const z = m.prevZ + (m.z - m.prevZ) * alpha;
        const bob = spin ? 3 + Math.sin(time * 3 + m.id) * 3 : 0;
        v.mesh.position.set(x, z + bob, -y);
        v.mesh.rotation.y = spin ? time * SPIN_SPEED + m.id : -cameraYaw;

        const s = sectorIndexAt(level.grid, m.x, m.y);
        const light = s >= 0 ? level.sectors[s].light : 160;
        const lit = m.bright ? 1.15 : lightToBrightness(light) * 1.1 + (level.lightBoost ?? 0);
        const mat = v.mesh.material;
        if (m.shadow) {
          mat.transparent = true;
          mat.opacity = 0.25 + 0.15 * Math.sin(time * 20 + m.id);
          mat.color.setScalar(0.15);
        } else {
          mat.transparent = false;
          mat.opacity = 1;
          mat.color.setScalar(Math.min(1.4, lit));
        }

        if (v.shadow) {
          const r = Math.max(8, m.radius * 0.9);
          v.shadow.visible = !m.corpse || m.kind === 'barrel';
          v.shadow.scale.setScalar(r);
          v.shadow.position.set(x, m.floorz + 0.6, -y);
        }
      }
      for (const id of [...views.keys()]) if (!seen.has(id)) dispose(id);
    },
    clear() {
      for (const id of [...views.keys()]) dispose(id);
    },
  };
}
