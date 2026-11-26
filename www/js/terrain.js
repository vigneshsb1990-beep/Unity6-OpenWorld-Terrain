// terrain.js — Rolling forest terrain with a flattened plateau for the palace.
import * as THREE from "three";

// Smooth, tileable-ish rolling hills via summed sines (cheap, deterministic).
export function terrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.045) * Math.cos(z * 0.05) * 6.0;
  h += Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.09 + 0.4) * 2.5;
  h += Math.sin(x * 0.21 + 4.0) * Math.cos(z * 0.19 + 2.0) * 1.0;

  // Flatten a plateau in the middle so the palace sits level.
  const d = Math.sqrt(x * x + z * z);
  const plateau = 1.0 - smoothstep(70, 130, d); // 1 inside, 0 outside
  h = h * (1 - plateau) + 0.0 * plateau;

  // Gentle rise far away to hide the horizon edge.
  h += smoothstep(190, 320, d) * 22.0;
  return h;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createTerrain(materials) {
  const SIZE = 640;
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2); // lie flat, +Y up

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, materials.grass);
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}

// A dirt path leading from the forest edge up to the palace gate.
export function createPath(materials) {
  const group = new THREE.Group();
  group.name = "path";
  const steps = 60;
  const width = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const z = THREE.MathUtils.lerp(300, 86, t); // from forest to gate
    const x = Math.sin(t * Math.PI * 2) * 10;
    const y = terrainHeight(x, z) + 0.08;
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, 6), materials.dirt);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(x, y, z);
    seg.receiveShadow = true;
    group.add(seg);
  }
  return group;
}