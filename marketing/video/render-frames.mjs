// Renders reel.html to numbered JPEG frames with headless Chrome.
//   node render-frames.mjs <outDir> [fps=30] [seconds=30] [only=t1,t2,...] [wa=+91...]
// Needs puppeteer-core (npm i puppeteer-core in the folder you run this from).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const [out, fpsArg, secArg, onlyArg, wa] = process.argv.slice(2);
const FPS = Number(fpsArg ?? 30), SECONDS = Number(secArg ?? 30);
mkdirSync(out, { recursive: true });

const chrome = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 }, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'] });
const page = await browser.newPage();
const url = new URL('./reel.html', import.meta.url).href + (wa ? '?wa=' + encodeURIComponent(wa) : '');
await page.goto(url, { waitUntil: 'networkidle0' });
const fontsOk = await page.evaluate(() => window.__ready);
console.log('fonts loaded:', fontsOk);
await new Promise((r) => setTimeout(r, 800));

const times = onlyArg ? onlyArg.split(',').map(Number) : Array.from({ length: FPS * SECONDS }, (_, i) => i / FPS);
let n = 0;
for (const t of times) {
  await page.evaluate((tt) => window.render(tt), t);
  const name = onlyArg ? `t${t.toFixed(2)}.jpg` : `f${String(n).padStart(5, '0')}.jpg`;
  await page.screenshot({ path: join(out, name), type: 'jpeg', quality: 93 });
  n++;
  if (n % 60 === 0) console.log(`${n}/${times.length}`);
}
await browser.close();
console.log('done', n);
