// terrain.js — Procedural forest terrain + dirt path.
// Ground height comes from heightfield.js so a loaded Sketchfab terrain can
// transparently replace the procedural ground.
import * as THREE from "three";
import { heightAt } from "./heightfield.js";

export function createTerrain(materials) {
  const SIZE = 640;
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2); // lie flat, +Y up

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
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
    const z = THREE.MathUtils.lerp(300, 86, t);
    const x = Math.sin(t * Math.PI * 2) * 10;
    const y = heightAt(x, z) + 0.08;
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, 6), materials.dirt);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(x, y, z);
    seg.receiveShadow = true;
    group.add(seg);
  }
  return group;
}