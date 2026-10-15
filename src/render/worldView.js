// GPU side of the block world: geometry, atlas texture and live sector state.

import * as THREE from 'three';
import { createWorldMaterial, MAX_DYNAMIC_LIGHTS } from './worldMaterial.js';
import { displayTop, lightToBrightness } from '../world/style.js';

function atlasTexture(atlas) {
  const tex = new THREE.DataTexture(atlas.data, atlas.width, atlas.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function tileAttribute(mesh, atlas) {
  const data = new Float32Array(mesh.tile.length * 4);
  const rects = mesh.tileKeys.map((key) => atlas.rects.get(key));
  for (let i = 0; i < mesh.tile.length; i++) {
    const r = rects[mesh.tile[i]];
    data.set([r.x, r.y, r.width, r.height], i * 4);
  }
  return new THREE.BufferAttribute(data, 4);
}

export function createWorldView(mesh, atlas, sectorCount) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.position, 3));
  geometry.setAttribute('aUV', new THREE.BufferAttribute(mesh.uv, 2));
  geometry.setAttribute('aInfo', new THREE.BufferAttribute(mesh.info, 4));
  geometry.setAttribute('aMisc', new THREE.BufferAttribute(mesh.misc, 2));
  geometry.setAttribute('aTile', tileAttribute(mesh, atlas));
  geometry.setIndex(new THREE.BufferAttribute(mesh.index, 1));
  geometry.computeBoundingSphere();

  const stateData = new Float32Array(Math.max(1, sectorCount) * 4);
  const sectorTexture = new THREE.DataTexture(stateData, Math.max(1, sectorCount), 1, THREE.RGBAFormat, THREE.FloatType);
  sectorTexture.magFilter = THREE.NearestFilter;
  sectorTexture.minFilter = THREE.NearestFilter;
  sectorTexture.needsUpdate = true;

  const atlasTex = atlasTexture(atlas);
  const material = createWorldMaterial(atlasTex, sectorTexture, sectorCount);
  const object = new THREE.Mesh(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    atlas,
    atlasTexture: atlasTex,
    // sectors: [{ floor, ceiling, light }]
    updateSectors(sectors) {
      for (let i = 0; i < sectors.length; i++) {
        const s = sectors[i];
        stateData[i * 4] = displayTop(s.floor, s.ceiling);
        stateData[i * 4 + 1] = lightToBrightness(s.light);
      }
      sectorTexture.needsUpdate = true;
    },
    setView(playerPos, cameraForward) {
      material.uniforms.playerPos.value.copy(playerPos);
      material.uniforms.cameraFlat.value.set(cameraForward.x, 0, cameraForward.z).normalize();
    },
    // lights: [{ x, y, z, radius, r, g, b }] in three coordinates
    setLights(lights) {
      const pos = material.uniforms.lightPos.value;
      const col = material.uniforms.lightColor.value;
      for (let i = 0; i < MAX_DYNAMIC_LIGHTS; i++) {
        const l = lights[i];
        if (l) { pos[i].set(l.x, l.y, l.z, l.radius); col[i].set(l.r, l.g, l.b); } else pos[i].w = 0;
      }
    },
    // Replace one atlas tile's pixels (animated flats and textures).
    writeTile(key, rgba) {
      const r = atlas.rects.get(key);
      if (!r) return;
      for (let row = 0; row < r.height; row++) {
        atlas.data.set(rgba.subarray(row * r.width * 4, (row + 1) * r.width * 4), ((r.y + row) * atlas.width + r.x) * 4);
      }
      atlasTex.needsUpdate = true;
    },
    material,
  };
}
