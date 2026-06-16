import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--window-size=1280,720"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on("console", (m) => { if (m.type() === "log") console.log("[b]", m.text()); });
await page.goto("http://localhost:3000/?test=1", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 4000));

const read = () => page.evaluate(() => window.__recon ? { w: window.__recon.weapon(), r: window.__recon.runtime() } : null);
console.log("initial:", JSON.stringify(await read()));

await page.mouse.move(640, 360);
// switch to AR + fire a moment
await page.keyboard.press("Digit2");
await new Promise((r) => setTimeout(r, 300));
await page.mouse.down();
await new Promise((r) => setTimeout(r, 400));
console.log("firing AR:", JSON.stringify(await read()));
await page.mouse.up();

// sniper + ADS
await new Promise((r) => setTimeout(r, 2500)); // wait any reload
await page.keyboard.press("Digit3");
await new Promise((r) => setTimeout(r, 400));
await page.mouse.down({ button: "right" });
await new Promise((r) => setTimeout(r, 700));
console.log("ADS sniper:", JSON.stringify(await read()));
await page.mouse.up({ button: "right" });

await browser.close();
