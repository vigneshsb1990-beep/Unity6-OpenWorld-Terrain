// preview.mjs — Render clean preview screenshots of the game from several angles.
import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";

const URL = process.env.GAME_URL || "http://localhost:8080/";
const OUT = "/artifacts";
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });

await page.goto(URL, { waitUntil: "load", timeout: 60000 });
await page.waitForFunction(
  () => document.getElementById("loading")?.classList.contains("hidden"),
  { timeout: 60000 }
);
await new Promise((r) => setTimeout(r, 800));

// Clean art: hide HUD/stats.
await page.evaluate(() => {
  document.getElementById("hud").style.display = "none";
  document.getElementById("stats").style.display = "none";
});

const shots = [
  { name: "preview-1-hero", radius: 150, phi: 1.0, theta: 0.6 },
  { name: "preview-2-aerial", radius: 300, phi: 0.55, theta: 0.9 },
  { name: "preview-3-low", radius: 120, phi: 1.28, theta: 2.5 },
  { name: "preview-4-gate", radius: 95, phi: 1.15, theta: 0.0 },
];

for (const s of shots) {
  await page.evaluate((r, p, t) => {
    const g = window.__game;
    g.controls.autoRotate = false;
    g.controls.setView(r, p, t);
    g.renderer.render(g.scene, g.camera);
  }, s.radius, s.phi, s.theta);
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log("saved", `${OUT}/${s.name}.png`);
}

await browser.close();