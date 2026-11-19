// Builds the tutorial video: free voiceover (edge-tts) + the real screenshots from tutorial-capture.mjs.
//   node tutorial-build.mjs <shotsDir=tut> <workDir=tut-build> <out.mp4> [script=tutorial-script.json] [music.wav]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const [shotsDir = 'tut', work = 'tut-build', outFile = 'tutorial.mp4', scriptFile = 'tutorial-script.json', musicFile = ''] = process.argv.slice(2);
const FFDIR = 'C:/Users/VISHAL/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/';
const FFMPEG = process.env.FFMPEG ?? FFDIR + 'ffmpeg.exe';
const FFPROBE = process.env.FFPROBE ?? FFDIR + 'ffprobe.exe';
const PY = process.env.PYTHON ?? 'C:/Users/VISHAL/AppData/Local/Programs/Python/Python312/python.exe';
const script = JSON.parse(readFileSync(scriptFile, 'utf8'));
const meta = JSON.parse(readFileSync(join(shotsDir, 'meta.json'), 'utf8'));
mkdirSync(work, { recursive: true });
const W = resolve(work);
const FPS = 30;
const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const ff = (args) => run(FFMPEG, ['-y', '-loglevel', 'error', ...args]);

// ---------- 1. voiceover, one file per scene ----------
for (const s of script.scenes) {
  const mp3 = join(W, s.id + '.mp3');
  if (!existsSync(mp3)) {
    writeFileSync(join(W, s.id + '.txt'), s.text);
    run(PY, ['-I', '-m', 'edge_tts', '--voice', script.voice, '--rate=-4%', '--file', join(W, s.id + '.txt'), '--write-media', mp3]);
  }
  s.audio = mp3;
  s.voiceSec = Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim());
  s.dur = s.voiceSec + 1.0; // a little air before and after each line
  console.log(s.id, s.voiceSec.toFixed(1) + 's');
}

// ---------- 2. stage images: title cards, phone frames, captions ----------
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const page = await browser.newPage();
const shoot = async (html, file, { dsf = 1.5, transparent = false } = {}) => {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: dsf });
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: file, omitBackground: transparent });
};
const font = `font-family:'Segoe UI','Nirmala UI',Arial,sans-serif`;
// Words on the title cards; a script in another language gives its own under "ui".
const ui = {
  tagline: 'Free player auction software for local leagues',
  pill: 'Full tutorial · from setup to SOLD',
  outroTop: 'Create your first auction — free',
  sports: 'Cricket · Kabaddi · Volleyball · Football · Badminton and more',
  outroPill: 'Try it free · 2 teams',
  playerPhone: 'On the player’s phone',
  ownerPhone: 'On the team owner’s phone',
  phone: 'On the phone',
  ...(script.ui ?? {}),
};
const bg = 'background:radial-gradient(1200px 700px at 70% 20%,#1c2f5e 0%,#0b1220 60%)';

const cards = {
  intro: `<body style="margin:0;width:1920px;height:1080px;${bg};${font};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px">
    <div style="width:150px;height:150px;border-radius:36px;background:#ff7a1a;display:grid;place-items:center;font-size:72px;font-weight:800;box-shadow:0 20px 60px rgba(255,122,26,.45)">KH</div>
    <div style="font-size:112px;font-weight:800;letter-spacing:-2px">KhiladiAuction</div>
    <div style="font-size:44px;color:#c3cddc">${ui.tagline}</div>
    <div style="margin-top:18px;padding:14px 34px;border-radius:999px;background:rgba(255,255,255,.1);font-size:34px;font-weight:600">${ui.pill}</div></body>`,
  outro: `<body style="margin:0;width:1920px;height:1080px;${bg};${font};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px">
    <div style="font-size:60px;font-weight:700;color:#c3cddc">${ui.outroTop}</div>
    <div style="font-size:150px;font-weight:800;color:#ff9a4a;letter-spacing:-3px">khiladiauction.com</div>
    <div style="font-size:40px;color:#c3cddc">${ui.sports}</div>
    <div style="margin-top:20px;padding:16px 40px;border-radius:999px;background:#ff7a1a;font-size:40px;font-weight:700">${ui.outroPill}</div></body>`,
};
for (const [k, html] of Object.entries(cards)) await shoot(html, join(W, 'card_' + k + '.png'));

const phoneImages = Object.entries(meta).filter(([, v]) => v && v.vp === 'phone').map(([k]) => k);
const phoneLabel = { s10_register: ui.playerPhone, s10b_register: ui.playerPhone, s16_owner: ui.ownerPhone };
for (const name of phoneImages) {
  const src = pathToFileURL(resolve(shotsDir, name + '.png')).href;
  await shoot(`<body style="margin:0;width:1920px;height:1080px;${bg};${font};color:#fff;display:flex;align-items:center;justify-content:center;gap:90px">
    <div style="font-size:64px;font-weight:800;max-width:520px;line-height:1.1">${phoneLabel[name] ?? ui.phone}</div>
    <div style="height:960px;aspect-ratio:390/780;border-radius:64px;border:16px solid #05080f;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.6);background:#000"><img src="${src}" style="width:100%;height:100%;object-fit:cover;object-position:top"></div></body>`, join(W, 'stage_' + name + '.png'));
}
const captions = {};
for (const s of script.scenes) {
  if (!s.caption) continue;
  const f = join(W, 'cap_' + s.id + '.png');
  await shoot(`<body style="margin:0;width:1920px;height:1080px;background:transparent;${font}">
    <div style="position:absolute;left:64px;bottom:56px;display:flex;align-items:center;gap:18px;padding:18px 34px 18px 22px;border-radius:999px;background:rgba(11,18,32,.9);color:#fff;font-size:36px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.35)">
    <span style="width:22px;height:22px;border-radius:50%;background:#ff7a1a"></span>${s.caption}</div></body>`, f, { dsf: 1, transparent: true });
  captions[s.id] = f;
}
await browser.close();

// ---------- 3. one clip per scene: slow push-in on each screenshot, caption, fades ----------
const imgFor = (s, name) => (s.card ? join(W, 'card_' + s.card + '.png') : meta[name]?.vp === 'phone' ? join(W, 'stage_' + name + '.png') : resolve(shotsDir, name + '.png'));
const clips = [];
for (const s of script.scenes) {
  const shots = s.card ? [null] : s.shots;
  const each = s.dur / shots.length;
  const frames = Math.max(2, Math.round(each * FPS));
  const inputs = [];
  const chains = [];
  shots.forEach((name, i) => {
    inputs.push('-i', imgFor(s, name));
    const m = name ? meta[name] : null;
    const fx = m?.vp === 'phone' || !m?.focus ? 0.5 : m.focus.x;
    const fy = m?.vp === 'phone' || !m?.focus ? 0.5 : m.focus.y;
    const zoomEnd = m?.focus && m.vp !== 'phone' ? 0.12 : 0.05;
    chains.push(`[${i}:v]scale=2880:1620:force_original_aspect_ratio=increase,crop=2880:1620,zoompan=z='1+${zoomEnd}*on/${frames}':x='max(0,min(iw-iw/zoom,${fx}*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${fy}*ih-ih/zoom/2))':d=${frames}:s=1920x1080:fps=${FPS},format=yuv420p[v${i}]`);
  });
  const joined = shots.length > 1 ? `${shots.map((_, i) => `[v${i}]`).join('')}concat=n=${shots.length}:v=1:a=0[base]` : '[v0]null[base]';
  let filter = chains.join(';') + ';' + joined;
  let last = 'base';
  if (captions[s.id]) {
    inputs.push('-loop', '1', '-t', String(s.dur), '-i', captions[s.id]);
    filter += `;[${last}][${shots.length}:v]overlay=0:0:format=auto:shortest=1,format=yuv420p[cap]`;
    last = 'cap';
  }
  filter += `;[${last}]fade=t=in:st=0:d=0.3,fade=t=out:st=${(s.dur - 0.3).toFixed(2)}:d=0.3[out]`;
  const clip = join(W, 'clip_' + s.id + '.mp4');
  ff([...inputs, '-filter_complex', filter, '-map', '[out]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-t', s.dur.toFixed(2), clip]);
  clips.push(clip);
  console.log('clip', s.id);
}
writeFileSync(join(W, 'clips.txt'), clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
const silent = join(W, 'video_silent.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', join(W, 'clips.txt'), '-c', 'copy', silent]);

// ---------- 4. audio: each line placed at the start of its scene, music underneath ----------
let t = 0;
const ains = [];
const delays = [];
script.scenes.forEach((s, i) => {
  ains.push('-i', s.audio);
  delays.push(`[${i}:a]adelay=${Math.round((t + 0.5) * 1000)}|${Math.round((t + 0.5) * 1000)},volume=1.6[a${i}]`);
  t += s.dur;
});
const total = t;
let afilter = delays.join(';') + ';' + script.scenes.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${script.scenes.length}:normalize=0:dropout_transition=0[voice]`;
const aargs = [...ains];
if (musicFile && existsSync(musicFile)) {
  aargs.push('-stream_loop', '-1', '-i', musicFile);
  afilter += `;[${script.scenes.length}:a]volume=0.13,atrim=0:${total.toFixed(2)},afade=t=out:st=${(total - 3).toFixed(2)}:d=3[bed];[voice][bed]amix=inputs=2:normalize=0[mix]`;
} else afilter += ';[voice]anull[mix]';
const audioFile = join(W, 'audio.m4a');
ff([...aargs, '-filter_complex', afilter, '-map', '[mix]', '-t', total.toFixed(2), '-c:a', 'aac', '-b:a', '192k', audioFile]);

ff(['-i', silent, '-i', audioFile, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', resolve(outFile)]);
console.log('wrote', outFile, total.toFixed(1) + 's');
