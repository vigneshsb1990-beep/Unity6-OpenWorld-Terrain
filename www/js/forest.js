// forest.js — Instanced low-poly trees scattered across the terrain.
import * as THREE from "three";
import { terrainHeight } from "./terrain.js";

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function createForest(materials, count = 520) {
  const group = new THREE.Group();
  group.name = "forest";
  const rnd = seeded(20241126);

  // --- shared geometries -----------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 4, 6);
  trunkGeo.translate(0, 2, 0);

  // three stacked cones merged into one foliage geometry (manual merge)
  const foliageGeo = mergeCones([
    { r: 3.2, h: 4.0, y: 4.0 },
    { r: 2.5, h: 3.6, y: 6.2 },
    { r: 1.7, h: 3.0, y: 8.2 },
  ]);

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, materials.bark, count);
  const foliageMesh = new THREE.InstancedMesh(foliageGeo, materials.leaves, count);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  foliageMesh.castShadow = true;
  foliageMesh.receiveShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 40) {
    guard++;
    const x = (rnd() - 0.5) * 600;
    const z = (rnd() - 0.5) * 600;
    const d = Math.sqrt(x * x + z * z);

    // keep the palace plateau clear
    if (d < 100) continue;
    // keep the path corridor clear
    if (Math.abs(x - Math.sin((z / 300) * Math.PI * 2) * 10) < 12 && z > 80) continue;

    const y = terrainHeight(x, z);
    const s = 0.7 + rnd() * 0.9;
    const rot = rnd() * Math.PI * 2;

    pos.set(x, y - 0.2, z);
    q.setFromAxisAngle(up, rot);
    scl.set(s, s * (0.9 + rnd() * 0.3), s);
    m.compose(pos, q, scl);
    trunkMesh.setMatrixAt(placed, m);
    foliageMesh.setMatrixAt(placed, m);

    // per-instance tint variation
    const tint = 0.75 + rnd() * 0.5;
    color.setRGB(0.35 * tint, 0.85 * tint, 0.45 * tint);
    foliageMesh.setColorAt(placed, color);

    placed++;
  }

  trunkMesh.count = placed;
  foliageMesh.count = placed;
  trunkMesh.instanceMatrix.needsUpdate = true;
  foliageMesh.instanceMatrix.needsUpdate = true;
  if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;

  group.add(trunkMesh, foliageMesh);
  return group;
}

// Merge several cone geometries into one BufferGeometry.
function mergeCones(parts) {
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const p of parts) {
    const g = new THREE.ConeGeometry(p.r, p.h, 8);
    g.translate(0, p.y + p.h / 2 - 1, 0);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const idx = g.index ? g.index.array : null;
    const push = (i) => {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    };
    if (idx) for (let i = 0; i < idx.length; i++) push(idx[i]);
    else for (let i = 0; i < pos.count; i++) push(i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}