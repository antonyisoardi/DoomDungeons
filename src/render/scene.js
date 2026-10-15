// Three.js scene for one level: block world, voxel things, dynamic lights, camera.

import * as THREE from 'three';
import { createWorldView } from './worldView.js';
import { createThingsView } from './thingsView.js';
import { createFollowCamera, CAMERA } from './camera.js';
import { createAnimator } from './animator.js';
import { MAX_DYNAMIC_LIGHTS } from './worldMaterial.js';

const FLASH_FRAMES = 4;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000);
  return renderer;
}

export function createLevelScene(renderer, resources, sprites, levelData) {
  const scene = new THREE.Scene();
  const view = createFollowCamera(window.innerWidth / window.innerHeight);
  const world = createWorldView(levelData.mesh, levelData.atlas, levelData.map.sectors.length);
  scene.add(world.object);
  const things = createThingsView(scene, sprites, CAMERA.YAW);
  const animator = createAnimator(world, levelData, resources);
  const flashes = [];
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const playerPos = new THREE.Vector3();

  function gatherLights(level, alpha) {
    const lights = [];
    const px = playerPos.x, pz = playerPos.z;
    for (const f of flashes) lights.push({ ...f, weight: -1e9 });
    for (const m of level.mobjs) {
      if (m.removed) continue;
      const color = m.def.light;
      if (!color) continue;
      const x = m.prevX + (m.x - m.prevX) * alpha, y = m.prevY + (m.y - m.prevY) * alpha;
      const isProjectile = m.kind === 'missile' || m.kind === 'effect';
      const radius = isProjectile ? 170 : 130;
      const strength = isProjectile ? 1.1 : 0.55;
      const d = Math.hypot(x - px, -y - pz);
      if (d > 900) continue;
      lights.push({
        x, y: m.z + 24, z: -y, radius, r: color[0] * strength, g: color[1] * strength, b: color[2] * strength,
        weight: d - (isProjectile ? 400 : 0),
      });
    }
    lights.sort((a, b) => a.weight - b.weight);
    return lights.slice(0, MAX_DYNAMIC_LIGHTS);
  }

  return {
    scene,
    view,
    world,
    things,
    snapTo(mobj) {
      playerPos.set(mobj.x, mobj.z, -mobj.y);
      view.snap(playerPos);
    },
    onEvent(event) {
      if (event.type === 'muzzleFlash') {
        const [r, g, b] = event.color;
        flashes.push({ x: event.x, y: event.z, z: -event.y, radius: 260, r: r * 1.4, g: g * 1.4, b: b * 1.4, frames: FLASH_FRAMES });
      } else if (event.type === 'floorFlat') {
        animator.setSectorFlat(event.sector, event.flat);
      } else if (event.type === 'switchTexture') {
        animator.setLineTexture(event.line, event.part, event.texture);
      }
    },
    // Ground point under the mouse, in Doom map coordinates, at height z.
    pickGround(screenX, screenY, z) {
      ndc.set((screenX / window.innerWidth) * 2 - 1, -(screenY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, view.camera);
      plane.constant = -z;
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      return { x: hit.x, y: -hit.z };
    },
    render(level, alpha, dt, time) {
      const p = level.playerMobj;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;
      const z = p.prevZ + (p.z - p.prevZ) * alpha;
      playerPos.set(x, z, -y);
      view.follow(playerPos, dt);
      world.updateSectors(level.sectors);
      world.setView(playerPos, view.forward);
      animator.tick(level.tic);
      const amp = level.player.powers.lightAmp > 0 ? 0.6 : 0;
      level.lightBoost = amp;
      world.material.uniforms.ambient.value = 1 + amp;
      world.setLights(gatherLights(level, alpha));
      for (let i = flashes.length - 1; i >= 0; i--) if (--flashes[i].frames <= 0) flashes.splice(i, 1);
      things.sync(level, alpha, time);
      renderer.render(scene, view.camera);
    },
    resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      view.resize(window.innerWidth / window.innerHeight);
    },
    dispose() {
      things.clear();
      world.object.geometry.dispose();
      world.material.dispose();
      world.atlasTexture.dispose();
    },
  };
}
