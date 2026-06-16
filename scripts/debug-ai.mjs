import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--window-size=1280,720"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto("http://localhost:3000/?test=1", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 4000));
const read = () => page.evaluate(() => (window.__recon ? { hud: window.__recon.hud(), hp: window.__recon.player().health } : null));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.mouse.click(640, 360);
await page.keyboard.press("Digit3"); // sniper (one-shot body kill)
await wait(400);

for (let i = 0; i < 8; i++) {
  await page.mouse.down();
  await wait(120);
  await page.mouse.up();
  await wait(900);
  const r = await read();
  console.log(`t${i}: det=${r.hud.detection.toFixed(2)} alert=${r.hud.alert} alive=${r.hud.enemiesAlive}/${r.hud.enemiesTotal} hitTick=${r.hud.hitTick} kind=${r.hud.hitKind} hp=${r.hp}`);
}
await page.screenshot({ path: "/tmp/recon-ai-debug.png" });
await browser.close();
