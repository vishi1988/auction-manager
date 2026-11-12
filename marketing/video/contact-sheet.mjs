// Makes contact sheets of the captured screens for a quick review. node contact-sheet.mjs <dir>
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const dir = resolve(process.argv[2] ?? 'tut');
const files = readdirSync(dir).filter((f) => /^s\d.*\.png$/.test(f)).sort();
const chunks = [files.slice(0, 9), files.slice(9)];
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 1000 });
for (const [i, list] of chunks.entries()) {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;font:14px sans-serif;color:#fff">${list
    .map((f) => `<figure style="margin:0"><img src="${pathToFileURL(join(dir, f)).href}" style="width:100%;height:300px;object-fit:contain;background:#000"><figcaption>${f}</figcaption></figure>`)
    .join('')}</body>`;
  const file = join(dir, `sheet${i + 1}.html`);
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: join(dir, `sheet${i + 1}.png`) });
}
await browser.close();
