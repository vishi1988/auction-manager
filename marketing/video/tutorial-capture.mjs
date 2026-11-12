// Drives the real app (local dev server, no cloud) and saves the screenshots the tutorial is made of.
//   node tutorial-capture.mjs <outDir> [baseUrl=http://localhost:5173]
// Needs: puppeteer-core (this folder), the app running, and xlsx from ../../node_modules.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const XLSX = require('../../node_modules/xlsx');
const [out = 'tut', base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

// A small Excel sheet to import, built the same way an organiser would fill the template.
const rows = [
  ['Player No', 'Name', 'Age', 'Mobile', 'Role', 'Batting', 'Bowling', 'Category', 'Tag'],
  [1, 'Rohit Jadhav', 27, '9800000001', 'Batsman', 'Right hand', '', 'Marquee', ''],
  [2, 'Amit Patil', 24, '9800000002', 'All-rounder', 'Right hand', 'Right arm medium', 'Marquee', ''],
  [3, 'Sagar Shinde', 22, '9800000003', 'Bowler', 'Right hand', 'Right arm fast', 'Category A', ''],
  [4, 'Vikram Pawar', 29, '9800000004', 'Wicket-keeper', 'Left hand', '', 'Category A', ''],
  [5, 'Nilesh More', 31, '9800000005', 'Batsman', 'Right hand', '', 'Category A', ''],
  [6, 'Kunal Deshmukh', 20, '9800000006', 'Bowler', 'Left hand', 'Left arm spin', 'Category B', ''],
  [7, 'Prasad Kale', 26, '9800000007', 'All-rounder', 'Left hand', 'Right arm off-spin', 'Category B', ''],
  [8, 'Yash Gaikwad', 23, '9800000008', 'Fielder', 'Right hand', '', 'Category B', ''],
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Players');
const xlsxPath = join(out, 'players.xlsx');
XLSX.writeFile(wb, xlsxPath);

const chrome = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'] });
const page = await browser.newPage();
const DESKTOP = { width: 1440, height: 810, deviceScaleFactor: 2 };
const PHONE = { width: 390, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
await page.setViewport(DESKTOP);
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('ka-tutorial', '1'); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const meta = {};

/** Clicks the first visible button/link whose text contains `text`. */
async function clickText(text, selector = 'button, a, summary', { last = false, exact = false } = {}) {
  const ok = await page.evaluate((t, sel, lastOne, ex) => {
    const all = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && (ex ? e.innerText.replace(/\s+/g, ' ').trim() === t : e.innerText.replace(/\s+/g, ' ').trim().includes(t)));
    const el = lastOne ? all.at(-1) : all[0];
    if (!el) return false;
    el.click();
    return true;
  }, text, selector, last, exact);
  if (!ok) throw new Error('No button: ' + text);
  await sleep(500);
}

/** Draws a cursor and a pulsing ring on the element, returns its centre (for the zoom). */
async function mark(selectorOrText, { by = 'text', sel = 'button, a, label, h1, h2, .card, section' } = {}) {
  const box = await page.evaluate((q, mode, s) => {
    document.querySelectorAll('.tut-mark').forEach((n) => n.remove());
    const el = mode === 'css' ? document.querySelector(q) : [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null && e.innerText.replace(/\s+/g, ' ').trim().includes(q)).sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'tut-mark';
    ring.style.cssText = `position:fixed;left:${r.left - 8}px;top:${r.top - 8}px;width:${r.width + 16}px;height:${r.height + 16}px;border:4px solid #ff7a1a;border-radius:14px;box-shadow:0 0 0 6px rgba(255,122,26,.25),0 0 30px rgba(255,122,26,.55);z-index:99999;pointer-events:none`;
    const cur = document.createElement('div');
    cur.className = 'tut-mark';
    cur.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M5 3l14 8-6 2 4 7-3 1-4-7-5 4z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    cur.style.cssText = `position:fixed;left:${r.left + r.width * 0.55}px;top:${r.top + r.height * 0.55}px;z-index:100000;pointer-events:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))`;
    document.body.append(ring, cur);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }, selectorOrText, by, sel);
  await sleep(300);
  return box;
}

const clearMarks = () => page.evaluate(() => document.querySelectorAll('.tut-mark').forEach((n) => n.remove()));

async function shot(name, focus = null, vp = 'desktop') {
  await sleep(700);
  await page.screenshot({ path: join(out, name + '.png'), type: 'png' });
  meta[name] = { vp, focus: focus ? { x: focus.x / (vp === 'phone' ? PHONE.width : DESKTOP.width), y: focus.y / (vp === 'phone' ? PHONE.height : DESKTOP.height) } : null };
  await clearMarks();
  console.log('shot', name);
}

const goto = async (path, vp = DESKTOP) => {
  await page.setViewport(vp);
  await page.goto(base + path, { waitUntil: 'networkidle0' });
  await sleep(600);
};

// ---- fresh start: no demo auction, so the first screen is the empty "create your first auction" ----
await page.goto(base + '/', { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('auction-app:index', JSON.stringify({ organizer: { name: 'Vishal Chaskar', organisation: 'Shivaji Nagar Sports Club', mobile: '', city: 'Pune', email: '' }, auctions: [] }));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);

// 1. Home with nothing yet
await shot('s01_home', await mark('New auction'));

// 2. New auction form
await clickText('New auction');
await page.type('input[placeholder^="e.g. Shivaji"]', 'Shivaji Nagar Premier League 2026');
await page.type('input[placeholder="Ground / hall"]', 'Shivaji Nagar Ground, Pune');
await sleep(400);
await shot('s02_new', await mark('Create auction'));

// create it (empty auction)
await clickText('Create auction');
await page.waitForFunction(() => location.pathname.startsWith('/a/'), { timeout: 15000 });
await sleep(1200);
const auctionPath = await page.evaluate(() => location.pathname.match(/^\/a\/[^/]+/)[0]);
meta.auctionPath = auctionPath;

// 3. Overview checklist
await goto(auctionPath);
await shot('s03_overview', await mark('Get ready in 4 steps', { sel: 'h2' }));

// 4. Rules
await goto(auctionPath + '/settings?tab=squad');
await shot('s04_rules', await mark('Purse', { sel: 'label, h3, h2' }));
await goto(auctionPath + '/settings?tab=categories');
await shot('s05_categories', await mark('Base price', { sel: 'th' }));
await goto(auctionPath + '/settings?tab=bidding');
await shot('s05b_bidding', await mark('Bid increments', { sel: 'h3, h2, .section-title, strong' }));

// 5. Teams
await goto(auctionPath + '/teams');
await clickText('Add your first team');
await page.type('input[placeholder="e.g. Royal Strikers"]', 'Royal Strikers');
await page.type('input[placeholder="RS"]', 'RS');
await sleep(300);
await shot('s06_team_form', await mark('Add team', { sel: 'footer button' }));
await clickText('Add team', 'button', { last: true, exact: true });
await sleep(900);
await clickText('Add team', 'button', { exact: true });
await sleep(600);
await page.type('input[placeholder="e.g. Royal Strikers"]', 'Thunder Titans');
await page.type('input[placeholder="RS"]', 'TT');
await clickText('Add team', 'button', { last: true, exact: true });
await sleep(900);
await shot('s07_teams', await mark('button[aria-label*="owner bidding link"]', { by: 'css' }));

// 6. Players
await goto(auctionPath + '/players');
await shot('s08_players_empty', await mark('Import Excel'));
const fileInput = await page.$('input[type=file]');
await fileInput.uploadFile(xlsxPath);
await sleep(1500);
await shot('s08b_players', null);
await clickText('More', 'summary');
await sleep(500);
await shot('s09_regmenu', await mark('Copy registration form link'));
await page.keyboard.press('Escape');

// 7. Registration form on a phone
await goto(auctionPath + '/register', PHONE);
await shot('s10_register', null, 'phone');
await page.evaluate(() => window.scrollTo(0, 500));
await shot('s10b_register', null, 'phone');

// 8. Share links
await goto(auctionPath, DESKTOP);
await shot('s11_share', await mark('Share links', { sel: 'h2' }));

// 9. Auction day
await goto(auctionPath + '/console');
await shot('s12_console_ready', await mark('Start auction'));
await clickText('Start auction');
await sleep(1500);
await shot('s13_console_live', null);
await clickText('Royal Strikers', 'button');
await sleep(400);
await clickText('Thunder Titans', 'button');
await sleep(400);
await clickText('Royal Strikers', 'button');
await sleep(700);
await shot('s13b_bids', await mark('SOLD', { sel: 'button' }));
await clickText('SOLD', 'button');
await sleep(900);
await shot('s14_sold', null);
await sleep(3500);

// 10. Live screen and owner phone, both while the next player is on the block
await goto(auctionPath + '/console');
await sleep(500);
const next = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('Next')));
if (next) await clickText('Next', 'button').catch(() => {});
await sleep(800);
await goto(auctionPath + '/live');
await sleep(1200);
await shot('s15_live', null);

const teamId = await page.evaluate((p) => { const s = JSON.parse(localStorage.getItem('auction-app:auction:' + p.split('/')[2])); return s.teams[1].id; }, auctionPath);
await goto(auctionPath + '/owner/' + teamId, PHONE);
await sleep(800);
await shot('s16_owner', null, 'phone');

await goto(auctionPath + '/results', DESKTOP);
await shot('s17_results', null);

writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
await browser.close();
console.log('done');
