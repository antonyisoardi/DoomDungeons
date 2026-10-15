// Minecraft Dungeons style follow camera: fixed diagonal yaw, steep pitch, narrow FOV.

import * as THREE from 'three';

export const CAMERA = Object.freeze({
  FOV: 32,
  PITCH: (52 * Math.PI) / 180, // downward angle
  YAW: Math.PI / 4, // looking north-east... in Doom terms; see forward()
  DISTANCE: 820,
  FOLLOW_RATE: 10, // per second, exponential smoothing
});

export function createFollowCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(CAMERA.FOV, aspect, 16, 6000);
  const target = new THREE.Vector3();
  let zoom = 1;

  // Unit vector from camera toward the target on the ground plane.
  const forward = new THREE.Vector3(Math.sin(CAMERA.YAW), 0, -Math.cos(CAMERA.YAW));

  function place() {
    const d = CAMERA.DISTANCE * zoom;
    const horizontal = Math.cos(CAMERA.PITCH) * d;
    camera.position.set(
      target.x - forward.x * horizontal,
      target.y + Math.sin(CAMERA.PITCH) * d,
      target.z - forward.z * horizontal,
    );
    camera.lookAt(target);
  }

  return {
    camera,
    forward,
    target,
    snap(position) {
      target.copy(position);
      place();
    },
    follow(position, dt) {
      const k = 1 - Math.exp(-CAMERA.FOLLOW_RATE * dt);
      target.lerp(position, k);
      place();
    },
    setZoom(z) {
      zoom = Math.min(1.8, Math.max(0.45, z));
      place();
    },
    get zoom() { return zoom; },
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
  };
}
