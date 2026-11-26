# Forest Palace Fort — Android 3D Game

A 3D Android game built with **Three.js** (WebGL) packaged as a **Capacitor**
native Android app. The first playable slice is a **forest terrain** surrounding
a **giant palace with a fortified curtain wall**, all rendered with
**procedurally generated 2048×2048 (2K) textures** — no binary art assets ship
with the game.

## What's in this slice

- **Forest terrain** — rolling hills (200×200 segment heightmap) with a flattened
  plateau for the palace, plus a dirt path from the forest edge to the gate.
- **Forest** — ~540 realistic trees across **8 species**: oak, maple (autumn
  tint), birch (white bark), poplar, pine/conifer, willow (hanging strands),
  dead/bare, and palm — all **alpha-cutout billboards** (procedural trunk +
  leaf/needle clusters, 3 crossed cards, per-instance tint/rotation/scale).
- **Understory** — ~2,000 plants: bushes, ferns, tall grass/reeds, wildflowers,
  and short grass tufts (crossed billboards).
- **3D hero trunks** near the path with bark + normal maps for close-up parallax.
- **Wind sway** — vertex-shader animation (stronger toward the canopy) with
  per-plant phase; cutout-correct shadows via a custom depth material.
- **Giant palace with fort** — 120×120 curtain walls with battlements, four
  corner towers with conical roofs, a twin-tower gatehouse with wooden doors,
  a tall central keep with corner turrets, and a residential palace wing.
- **2K procedural textures** (generated at runtime on a canvas):
  grass, dirt, fort stone (running-bond bricks), terracotta roof tiles, wood
  planks, plus realistic **tree billboards, bark (+ normal map), and grass/fern
  tufts**.
- **Controls** — drag to orbit, pinch to zoom (touch), mouse drag + wheel on
  desktop, with a slow auto-rotate when idle.

## Project layout

```
www/                 Web game (bundled into the APK)
  index.html
  css/style.css
  js/main.js         Scene, lights, sky, orbit controls
  js/textures.js     Procedural 2K surface textures
  js/treetextures.js Full vegetation library (trees, plants, grass, bark)
  js/terrain.js      Heightmap terrain + path
  js/forest.js       Realistic billboard forest + undergrowth + wind
  js/palace.js       Palace + fort
  vendor/            three.module.js + three.core.js (offline)
android/             Native Android (Capacitor) project
scripts/smoke.mjs    Headless smoke test (Puppeteer)
```

## Use a real terrain from Sketchfab

The game loads `www/assets/terrain.glb` if present; otherwise it uses the
procedural terrain. To pull a CC-licensed terrain from Sketchfab:

1. Get a free API token: Sketchfab → **Settings → API → Copy token**.
2. Download a model (replace `<uid>` with the model's UID from its URL):

   ```bash
   SKETCHFAB_TOKEN=your_token node scripts/fetch-sketchfab.mjs <uid>
   # saves to www/assets/terrain.glb
   ```

3. Reload. The terrain is auto-scaled to ~620 units, centered, and a height
   sampler is built by raycasting it, so trees, plants and the palace sit on the
   real ground. The token is read from the environment and never stored.

Find downloadable models with:
`curl -s "https://api.sketchfab.com/v3/search?type=models&q=terrain&downloadable=true"`

## Run in a browser (fast iteration)

```bash
npm install
npm start            # serves www/ at http://localhost:8080
```

## Build the Android app

Requires **Node 18+**, **JDK 17**, and the **Android SDK** (Android Studio).

```bash
npm install
npx cap add android      # already done; safe to re-run
npx cap sync android
npx cap open android     # opens in Android Studio → Run / Build APK
```

Or build the debug APK from the CLI:

```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

> Note: this cloud sandbox has no JDK/Android SDK, so the APK is not compiled
> here. The native project is fully generated and ready to open in Android
> Studio. The game itself was verified to build and render via the headless
> smoke test (`node scripts/smoke.mjs`).

## Performance notes

- Textures are generated once at load (a short "Growing the forest…" screen
  covers this).
- Trees and battlements use `InstancedMesh` to keep draw calls low.
- Shadow map is 1024²; pixel ratio is capped at 2 for mobile GPUs.
- ~104k triangles in the default view (billboards keep the forest cheap).