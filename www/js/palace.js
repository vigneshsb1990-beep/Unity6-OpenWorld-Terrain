// palace.js — A giant palace wrapped in a fortified curtain wall.
// Built entirely from primitives so it is crisp at any distance and cheap
// enough for mobile GPUs. Uses the 2K stone / roof / wood textures.
import * as THREE from "three";

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Triangular-prism gable roof (ridge along X).
function gableRoof(w, d, h, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(-d / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createPalace(materials) {
  const g = new THREE.Group();
  g.name = "palace-fort";

  const { stone, roof, wood, darkStone } = materials;

  // ---- foundation platform -------------------------------------------------
  g.add(box(150, 3, 150, darkStone, 0, -1.5, 0));

  // ---- curtain walls (square, half-size 60) --------------------------------
  const H = 18; // wall height
  const T = 5; // thickness
  const R = 60; // half extent
  const wallY = H / 2;
  g.add(box(2 * R + T, H, T, stone, 0, wallY, R)); // south (gate side)
  g.add(box(2 * R + T, H, T, stone, 0, wallY, -R)); // north
  g.add(box(T, H, 2 * R + T, stone, R, wallY, 0)); // east
  g.add(box(T, H, 2 * R + T, stone, -R, wallY, 0)); // west

  // ---- battlements (merlons) along wall tops -------------------------------
  g.add(createBattlements(R, H, T, stone));

  // ---- corner towers -------------------------------------------------------
  const towerH = 30;
  const towerR = 8;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(tower(sx * R, sz * R, towerR, towerH, stone, roof));
    }
  }

  // ---- gatehouse (south wall, +Z) -----------------------------------------
  g.add(gatehouse(R, H, stone, roof, wood));

  // ---- central keep --------------------------------------------------------
  const keep = new THREE.Group();
  keep.add(box(40, 46, 40, stone, 0, 23, 0));
  keep.add(box(44, 2, 44, darkStone, 0, 46, 0)); // cornice
  const keepRoof = gableRoof(46, 46, 14, roof);
  keepRoof.position.y = 47;
  keep.add(keepRoof);
  // corner turrets on the keep
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const t = tower(sx * 20, sz * 20, 4.5, 54, stone, roof, 8);
      keep.add(t);
    }
  }
  g.add(keep);

  // ---- palace wing (north side, residential) ------------------------------
  const wing = new THREE.Group();
  wing.add(box(70, 26, 26, stone, 0, 13, -34));
  const wingRoof = gableRoof(74, 30, 12, roof);
  wingRoof.position.set(0, 26, -34);
  wing.add(wingRoof);
  // rows of windows (dark insets)
  const winMat = materials.window;
  for (let i = -3; i <= 3; i++) {
    for (let r = 0; r < 2; r++) {
      wing.add(box(3, 4, 0.6, winMat, i * 9, 8 + r * 9, -20.9));
    }
  }
  g.add(wing);

  // ---- courtyard details ---------------------------------------------------
  // central fountain
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 7, 2, 24),
    darkStone
  );
  fountain.position.set(0, 1, 28);
  fountain.receiveShadow = true;
  g.add(fountain);

  return g;
}

function tower(x, z, r, h, stone, roof, roofH = 12) {
  const t = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 20), stone);
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  t.add(body);
  // corbelled top ring
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 2.5, 20), stone);
  ring.position.y = h;
  ring.castShadow = true;
  t.add(ring);
  // conical roof
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, roofH, 20), roof);
  cone.position.y = h + 1.25 + roofH / 2;
  cone.castShadow = true;
  t.add(cone);
  t.position.set(x, 0, z);
  return t;
}

function gatehouse(R, H, stone, roof, wood) {
  const gh = new THREE.Group();
  const z = R;
  // two flanking towers
  gh.add(tower(-14, z, 6, 26, stone, roof));
  gh.add(tower(14, z, 6, 26, stone, roof));
  // arch lintel spanning the gate
  gh.add(box(20, 8, 8, stone, 0, H - 4, z));
  // wooden doors (recessed)
  gh.add(box(12, 14, 1.5, wood, 0, 7, z + 2.6));
  // portcullis hint
  gh.add(box(12, 0.6, 0.6, materials_dark(wood), 0, 13, z + 3.2));
  return gh;
}

// small helper so gatehouse can darken the portcullis without extra materials
function materials_dark(wood) {
  const m = wood.clone();
  m.color = new THREE.Color(0x555555);
  return m;
}

function createBattlements(R, H, T, stone) {
  const group = new THREE.Group();
  const merlonW = 2.2;
  const gap = 2.2;
  const step = merlonW + gap;
  const geo = new THREE.BoxGeometry(merlonW, 3, T * 0.9);
  const count = Math.floor((2 * R) / step);
  const inst = new THREE.InstancedMesh(geo, stone, count * 4);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  let i = 0;
  const place = (x, z, rotY) => {
    m.makeRotationY(rotY);
    m.setPosition(x, H + 1.5, z);
    inst.setMatrixAt(i++, m);
  };
  for (let k = 0; k < count; k++) {
    const a = -R + step / 2 + k * step;
    place(a, R, 0); // south
    place(a, -R, 0); // north
    place(R, a, Math.PI / 2); // east
    place(-R, a, Math.PI / 2); // west
  }
  inst.count = i;
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
  return group;
}