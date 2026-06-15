// Headless smoke test: load the game with a fresh client (no HMR history),
// drive a few inputs, capture console/page errors, screenshot.
// Usage: node scripts/smoke.mjs [url] [outPng]
import puppeteer from "puppeteer-core";

const URL = process.argv[2] ?? "http://localhost:3000/";
const OUT = process.argv[3] ?? "/tmp/recon-smoke.png";
const CHROME = "/usr/bin/google-chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    "--window-size=1280,720",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

const errors = [];
const warns = [];
page.on("console", (m) => {
  const t = m.type();
  const txt = m.text();
  if (t === "error") errors.push(txt);
  else if (t === "warning") warns.push(txt);
});
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("requestfailed", (r) =>
  errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText ?? ""}`),
);

await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
// Let the engine boot, assets stream, physics settle.
await new Promise((r) => setTimeout(r, 4000));

// Engage pointer lock + drive some input to exercise the controller.
await page.mouse.click(640, 360);
await new Promise((r) => setTimeout(r, 400));
for (const key of ["KeyW", "KeyW", "Space", "KeyV", "KeyV"]) {
  await page.keyboard.down(key);
  await new Promise((r) => setTimeout(r, 250));
  await page.keyboard.up(key);
}
await new Promise((r) => setTimeout(r, 600));

await page.screenshot({ path: OUT });

// Filter known-harmless three.js 0.184 deprecation chatter.
const IGNORE = [
  /THREE.Clock: .* deprecated/i,
  /deprecated parameters for the initialization/i,
  /PCFSoftShadowMap has been deprecated/i,
  /Multiple instances of Three.js/i,
];
const realErrors = errors.filter((e) => !IGNORE.some((re) => re.test(e)));

console.log("=== ERRORS (filtered) ===");
console.log(realErrors.length ? realErrors.join("\n") : "(none)");
console.log(`\nraw errors: ${errors.length}, warnings: ${warns.length}`);
console.log(`screenshot: ${OUT}`);

await browser.close();
process.exit(realErrors.length ? 1 : 0);
