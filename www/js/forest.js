// forest.js — Realistic forest: alpha-cutout tree billboards (trunk + leaf
// clusters), 3D hero trunks for parallax, ground undergrowth, and wind sway.
import * as THREE from "three";
import { terrainHeight } from "./terrain.js";
import { makeTreeTexture, makeBark, makeGrassTuft } from "./treetextures.js";

// Shared wind clock, advanced from main.js each frame.
export const windTime = { value: 0 };
export function updateWind(t) {
  windTime.value = t;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

// Merge `n` vertical planes crossed around Y into one geometry (base at y=0).
function crossedPlanes(n, w, h) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let p = 0; p < n; p++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    g.rotateY((p / n) * Math.PI);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i++) indices.push(base + idx[i]);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Inject wind sway into a standard material's vertex shader.
function addWind(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.35;
       #else
         float ph = 0.0;
       #endif
       float sway = sin(uTime * 1.2 + ph) * 0.05 + sin(uTime * 2.3 + ph * 1.7) * 0.02;
       float bend = pow(uv.y, 2.0);
       transformed.x += sway * bend;
       transformed.z += sway * 0.6 * bend;`
    );
  };
  mat.customProgramCacheKey = () => "wind";
}

export function createForest(count = 560) {
  const group = new THREE.Group();
  group.name = "forest";
  const R = rng(20241126);

  // ---- tree species (distinct silhouettes / tints) ------------------------
  const species = [
    { tex: makeTreeTexture({ seed: 11, hue: 110, sat: 45, light: 30, spread: 0.6 }), weight: 0.5 },
    { tex: makeTreeTexture({ seed: 23, hue: 95, sat: 40, light: 27, spread: 0.5, leafDensity: 1.2 }), weight: 0.3 },
    { tex: makeTreeTexture({ seed: 37, hue: 125, sat: 50, light: 34, spread: 0.7 }), weight: 0.2 },
  ];

  const treeGeo = crossedPlanes(3, 1, 1); // unit; scaled per instance
  const meshes = species.map((sp) => {
    const mat = new THREE.MeshStandardMaterial({
      map: sp.tex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });
    addWind(mat);
    const m = new THREE.InstancedMesh(treeGeo, mat, count);
    m.castShadow = true;
    m.receiveShadow = true;
    // cutout-correct shadow depth material
    m.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: sp.tex,
      alphaTest: 0.35,
    });
    m.count = 0;
    group.add(m);
    return m;
  });

  // ---- distribute instances ----------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const counts = species.map(() => 0);

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 50) {
    guard++;
    const x = (R() - 0.5) * 600;
    const z = (R() - 0.5) * 600;
    const d = Math.hypot(x, z);
    if (d < 100) continue; // palace plateau
    if (Math.abs(x - Math.sin((z / 300) * Math.PI * 2) * 10) < 13 && z > 78) continue; // path

    // pick species by weight
    let r = R();
    let si = 0;
    for (let i = 0; i < species.length; i++) {
      if (r < species[i].weight) {
        si = i;
        break;
      }
      r -= species[i].weight;
    }

    const y = terrainHeight(x, z);
    const h = 16 + R() * 16; // tree height
    pos.set(x, y - 0.3, z);
    q.setFromAxisAngle(up, R() * Math.PI * 2);
    scl.set(h * (0.85 + R() * 0.3), h, h * (0.85 + R() * 0.3));
    m4.compose(pos, q, scl);
    const mesh = meshes[si];
    mesh.setMatrixAt(counts[si], m4);
    const tint = 0.8 + R() * 0.4;
    col.setRGB(tint, tint, tint);
    mesh.setColorAt(counts[si], col);
    counts[si]++;
    placed++;
  }
  meshes.forEach((m, i) => {
    m.count = counts[i];
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  // ---- 3D hero trunks near the path (parallax up close) -------------------
  group.add(createHeroTrees(R));

  // ---- ground undergrowth (grass + ferns) --------------------------------
  group.add(createUndergrowth(R));

  return group;
}

function createHeroTrees(R) {
  const g = new THREE.Group();
  const bark = makeBark(512);
  bark.map.repeat.set(1, 3);
  bark.normal.repeat.set(1, 3);
  const barkMat = new THREE.MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 1,
  });
  const canopyTex = makeTreeTexture({ seed: 99, hue: 105, sat: 48, light: 31, spread: 0.65 });
  const canopyMat = new THREE.MeshStandardMaterial({
    map: canopyTex,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  addWind(canopyMat);
  const canopyGeo = crossedPlanes(3, 1, 1);

  const spots = [
    [70, 120],
    [-64, 150],
    [40, 210],
    [-80, 250],
    [95, 300],
    [-40, 330],
  ];
  for (const [x, z] of spots) {
    const y = terrainHeight(x, z);
    const trunkH = 7 + R() * 3;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.6, trunkH, 8),
      barkMat
    );
    trunk.position.set(x, y + trunkH / 2, z);
    trunk.castShadow = trunk.receiveShadow = true;
    g.add(trunk);

    const ch = 16 + R() * 6;
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(x, y + trunkH - 2, z);
    canopy.scale.set(ch * 0.9, ch, ch * 0.9);
    canopy.castShadow = true;
    g.add(canopy);
  }
  return g;
}

function createUndergrowth(R) {
  const g = new THREE.Group();
  const tuftTex = makeGrassTuft(256, 5, false);
  const fernTex = makeGrassTuft(256, 8, true);
  const geo = crossedPlanes(2, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: tuftTex,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  addWind(mat);
  const matFern = new THREE.MeshStandardMaterial({
    map: fernTex,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  addWind(matFern);

  const N = 1600;
  const grass = new THREE.InstancedMesh(geo, mat, N);
  const fern = new THREE.InstancedMesh(geo, matFern, N);
  grass.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let gi = 0;
  let fi = 0;
  let guard = 0;
  while ((gi < N || fi < N) && guard < N * 30) {
    guard++;
    const x = (R() - 0.5) * 560;
    const z = (R() - 0.5) * 560;
    const d = Math.hypot(x, z);
    if (d < 74) continue; // keep palace grounds clear
    const y = terrainHeight(x, z);
    const s = 0.7 + R() * 1.1;
    pos.set(x, y - 0.1, z);
    q.setFromAxisAngle(up, R() * Math.PI * 2);
    scl.set(s, s * (0.8 + R() * 0.6), s);
    m4.compose(pos, q, scl);
    if (R() < 0.75 && gi < N) grass.setMatrixAt(gi++, m4);
    else if (fi < N) fern.setMatrixAt(fi++, m4);
  }
  grass.count = gi;
  fern.count = fi;
  grass.instanceMatrix.needsUpdate = true;
  fern.instanceMatrix.needsUpdate = true;
  g.add(grass, fern);
  return g;
}