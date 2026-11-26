import puppeteer from "puppeteer";

const URL = process.env.GAME_URL || "http://localhost:8080/";

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
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

const errors = [];
const logs = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !/favicon\.ico/.test(r.url()))
    errors.push(`HTTP ${r.status()} ${r.url()}`);
});
page.on("console", (m) => {
  logs.push(m.type() + ": " + m.text());
  if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
    errors.push("CONSOLE: " + m.text());
});

await page.goto(URL, { waitUntil: "load", timeout: 60000 });

// Wait for the loading overlay to hide (world built) or time out.
let built = false;
try {
  await page.waitForFunction(
    () => document.getElementById("loading")?.classList.contains("hidden"),
    { timeout: 60000 }
  );
  built = true;
} catch {}

// Let a few frames render.
await new Promise((r) => setTimeout(r, 1500));

const info = await page.evaluate(() => {
  const c = document.getElementById("scene");
  const gl = c?.getContext("webgl2") || c?.getContext("webgl");
  return {
    canvas: c ? { w: c.width, h: c.height } : null,
    hasGL: !!gl,
    stats: document.getElementById("stats")?.textContent,
    loadingHidden: document.getElementById("loading")?.classList.contains("hidden"),
  };
});

await page.screenshot({ path: "/artifacts/forest-palace-fort.png" });

console.log("BUILT:", built);
console.log("INFO:", JSON.stringify(info, null, 2));
console.log("ERRORS:", errors.length ? JSON.stringify(errors, null, 2) : "none");

await browser.close();

if (!built || errors.length) {
  process.exit(1);
}