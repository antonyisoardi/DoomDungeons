// Shader for the block world. Per-sector state (display top, light) lives in a
// small float texture updated each tic so doors, lifts and flickering lights cost
// nothing to animate.

import * as THREE from 'three';

export const MAX_DYNAMIC_LIGHTS = 12;

const vertexShader = /* glsl */ `
  in vec2 aUV;
  in vec4 aInfo;   // follow sector, v-reference sector, light sector, uv mode
  in vec2 aMisc;   // face shade, kind
  in vec4 aTile;   // atlas rect in texels

  uniform sampler2D sectorState; // r = display top, g = brightness
  uniform float sectorCount;

  out vec2 vUV;
  out vec4 vTile;
  out float vShade;
  out float vKind;
  out vec3 vWorld;

  vec4 sectorAt(float index) {
    return texelFetch(sectorState, ivec2(int(index), 0), 0);
  }

  void main() {
    vec3 p = position;
    if (aInfo.x >= 0.0) p.y = sectorAt(aInfo.x).r;

    vec2 uv = aUV;
    if (aInfo.w > 0.5 && aInfo.w < 1.5) uv.y = -p.y;
    if (aInfo.w > 1.5) uv.y = sectorAt(aInfo.y).r - p.y;

    float brightness = aInfo.z >= 0.0 ? sectorAt(aInfo.z).g : 0.75;
    vShade = aMisc.x * brightness;
    vKind = aMisc.y;
    vUV = uv;
    vTile = aTile;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D atlas;
  uniform vec3 playerPos;
  uniform vec3 cameraFlat;  // camera forward on the ground plane
  uniform vec4 lightPos[${MAX_DYNAMIC_LIGHTS}];
  uniform vec3 lightColor[${MAX_DYNAMIC_LIGHTS}];
  uniform float ambient;

  in vec2 vUV;
  in vec4 vTile;
  in float vShade;
  in float vKind;
  in vec3 vWorld;
  out vec4 fragColor;

  void main() {
    // Cut away walls and doors that stand between the camera and the player.
    if (vKind > 0.5 && vWorld.y > playerPos.y + 20.0) {
      vec3 d = vWorld - playerPos;
      float along = dot(d.xz, cameraFlat.xz);
      vec2 side = d.xz - cameraFlat.xz * along;
      float r = length(side);
      if (along < 0.0 && along > -260.0 && r < 72.0) {
        float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
        if (dither > r / 72.0 * 0.85) discard;
      }
    }

    vec2 texel = vTile.xy + mod(floor(vUV), vTile.zw);
    vec4 color = texelFetch(atlas, ivec2(texel), 0);
    if (color.a < 0.5) discard;

    vec3 light = vec3(vShade * ambient);
    for (int i = 0; i < ${MAX_DYNAMIC_LIGHTS}; i++) {
      float radius = lightPos[i].w;
      if (radius <= 0.0) continue;
      float dist = length(vWorld - lightPos[i].xyz);
      float fall = max(0.0, 1.0 - dist / radius);
      light += lightColor[i] * fall * fall;
    }
    fragColor = vec4(color.rgb * light, 1.0);
  }
`;

export function createWorldMaterial(atlasTexture, sectorTexture, sectorCount) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms: {
      atlas: { value: atlasTexture },
      sectorState: { value: sectorTexture },
      sectorCount: { value: sectorCount },
      playerPos: { value: new THREE.Vector3() },
      cameraFlat: { value: new THREE.Vector3(0, 0, -1) },
      lightPos: { value: Array.from({ length: MAX_DYNAMIC_LIGHTS }, () => new THREE.Vector4()) },
      lightColor: { value: Array.from({ length: MAX_DYNAMIC_LIGHTS }, () => new THREE.Vector3()) },
      ambient: { value: 1.0 },
    },
    side: THREE.FrontSide,
  });
}
