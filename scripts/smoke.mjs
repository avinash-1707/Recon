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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Click into the canvas (?test=1 forces input active without real pointer lock).
await page.mouse.click(640, 360);
await wait(1500); // let enemies spawn + start patrolling
const enemiesOut = OUT.replace(/\.png$/, "-enemies.png");
await page.screenshot({ path: enemiesOut });
console.log(`enemies screenshot: ${enemiesOut}`);

// nudge forward + jump
await page.keyboard.down("KeyW");
await wait(300);
await page.keyboard.up("KeyW");
await page.keyboard.press("Space");
await wait(300);

// AR: switch, hold full-auto, screenshot MID-BURST (FP weapon + flash + tracer).
await page.keyboard.press("Digit2");
await wait(350);
await page.mouse.down();
await wait(220);
await page.screenshot({ path: OUT });
await wait(300);
await page.mouse.up();

// reload (let it fully finish before switching — switch is locked during reload)
await page.keyboard.press("KeyR");
await wait(2000);

// Sniper: switch, ADS, screenshot SCOPE overlay.
await page.keyboard.press("Digit3");
await wait(450);
await page.mouse.down({ button: "right" });
await wait(800);
const scopeOut = OUT.replace(/\.png$/, "-scope.png");
await page.screenshot({ path: scopeOut });
await page.mouse.up({ button: "right" });
await wait(400);
console.log(`scope screenshot: ${scopeOut}`);

// AR red-dot sight: switch, ADS, screenshot.
await page.keyboard.press("Digit2");
await wait(450);
await page.mouse.down({ button: "right" });
await wait(800);
const arAdsOut = OUT.replace(/\.png$/, "-ar-ads.png");
await page.screenshot({ path: arAdsOut });
await page.mouse.up({ button: "right" });
await wait(300);
console.log(`ar-ads screenshot: ${arAdsOut}`);

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
