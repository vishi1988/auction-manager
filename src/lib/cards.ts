// Pictures for WhatsApp and Instagram: a SOLD card for one player and a squad
// card for one team. Drawn on a canvas so they can be shared as an image file.
import { APP_NAME } from '../brand';
import type { AppState, Player, Sponsor, Team } from '../types';
import { initials, money } from './format';
import { categoryOf, teamStats } from './rules';

const W = 1080;
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const GOLD = '#f2b631';

function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ready() {
  // Canvas only uses a web font once the browser has loaded that weight.
  await Promise.all([`700 60px ${DISPLAY}`, `600 30px ${BODY}`, `800 30px ${BODY}`].map((f) => document.fonts?.load(f).catch(() => null)));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Draws text, shrinking the font until it fits `maxWidth`. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, weight: number, size: number, family: string) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (g.measureText(text).width > maxWidth && s > 14);
  g.fillText(text, x, y);
}

/** Image covering a box, cropped from the centre (top-weighted, so faces stay in). */
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.25, sw, sh, x, y, w, h);
}

function contain(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  g.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
}

function backdrop(g: CanvasRenderingContext2D, h: number, color: string) {
  g.fillStyle = '#070b16';
  g.fillRect(0, 0, W, h);
  const glow = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, h * 0.9);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(7, 11, 22, 0)');
  g.globalAlpha = 0.55;
  g.fillStyle = glow;
  g.fillRect(0, 0, W, h);
  g.globalAlpha = 1;
  // Thin gold frame.
  g.strokeStyle = 'rgba(242, 182, 49, 0.55)';
  g.lineWidth = 3;
  roundRect(g, 24, 24, W - 48, h - 48, 28);
  g.stroke();
}

function header(g: CanvasRenderingContext2D, state: AppState) {
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  fitText(g, state.settings.name.toUpperCase(), W / 2, 112, W - 160, 700, 54, DISPLAY);
  g.fillStyle = '#aab6ca';
  g.font = `800 20px ${BODY}`;
  g.fillText('P L A Y E R   A U C T I O N', W / 2, 150);
}

async function teamBadge(g: CanvasRenderingContext2D, team: Team, cx: number, cy: number, r: number) {
  const logo = await loadImage(team.logo);
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.clip();
  if (logo) cover(g, logo, cx - r, cy - r, r * 2, r * 2);
  else {
    g.fillStyle = team.color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(r * 0.85)}px ${DISPLAY}`;
    g.fillText(team.short, cx, cy + 2);
  }
  g.restore();
  g.textBaseline = 'alphabetic';
}

/** Sponsors along the bottom, then the product line. `top` is where the strip starts. */
async function footer(g: CanvasRenderingContext2D, sponsors: Sponsor[], top: number, h: number) {
  const shown = sponsors.filter((s) => s.logo || s.name.trim()).slice(0, 4);
  if (shown.length) {
    g.textAlign = 'center';
    g.fillStyle = '#8794ab';
    g.font = `800 18px ${BODY}`;
    g.fillText(shown.length === 1 ? 'S P O N S O R' : 'S P O N S O R S', W / 2, top + 20);
    const gap = 20;
    const boxW = Math.min(230, (W - 140 - gap * (shown.length - 1)) / shown.length);
    const boxH = 84;
    let x = (W - (boxW * shown.length + gap * (shown.length - 1))) / 2;
    for (const s of shown) {
      const logo = await loadImage(s.logo);
      if (logo) {
        g.fillStyle = '#ffffff';
        roundRect(g, x, top + 38, boxW, boxH, 12);
        g.fill();
        contain(g, logo, x + 10, top + 44, boxW - 20, boxH - 12);
      } else {
        g.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        g.lineWidth = 2;
        roundRect(g, x, top + 38, boxW, boxH, 12);
        g.stroke();
        g.fillStyle = '#ffffff';
        g.textAlign = 'center';
        fitText(g, s.name.toUpperCase(), x + boxW / 2, top + 38 + boxH / 2 + 11, boxW - 24, 700, 32, DISPLAY);
      }
      x += boxW + gap;
    }
  }
  g.textAlign = 'center';
  g.fillStyle = '#6b7890';
  g.font = `600 20px ${BODY}`;
  g.fillText('Made with ' + APP_NAME + '.com', W / 2, h - 52);
}

/** "SOLD" picture for one player: photo, name, team and price. 1080 x 1350. */
export async function soldCard(state: AppState, player: Player): Promise<HTMLCanvasElement> {
  await ready();
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const team = state.teams.find((t) => t.id === player.teamId);
  const cat = categoryOf(state, player);
  const color = team?.color ?? cat.color;
  const how = [...state.log].reverse().find((l) => l.playerId === player.id)?.type;
  const retained = player.status === 'retained';

  backdrop(g, H, color);
  header(g, state);

  // Photo
  const px = 300, py = 196, pw = 480, ph = 520;
  g.save();
  roundRect(g, px, py, pw, ph, 30);
  g.clip();
  const grad = g.createLinearGradient(px, py, px + pw, py + ph);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#0b1220');
  g.fillStyle = grad;
  g.fillRect(px, py, pw, ph);
  const photo = await loadImage(player.photo);
  if (photo) cover(g, photo, px, py, pw, ph);
  else {
    g.fillStyle = 'rgba(255, 255, 255, 0.9)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 220px ${DISPLAY}`;
    g.fillText(initials(player.name), px + pw / 2, py + ph / 2 + 10);
    g.textBaseline = 'alphabetic';
  }
  g.restore();
  g.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  g.lineWidth = 4;
  roundRect(g, px, py, pw, ph, 30);
  g.stroke();

  // Category tag on the photo
  g.font = `800 22px ${BODY}`;
  const tag = cat.name.toUpperCase();
  const tw = g.measureText(tag).width + 36;
  g.fillStyle = cat.color;
  roundRect(g, px + 18, py + 18, tw, 44, 10);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.fillText(tag, px + 36, py + 48);

  // SOLD stamp over the bottom edge of the photo
  g.save();
  g.translate(W / 2, py + ph + 6);
  g.rotate(-0.05);
  const stamp = g.createLinearGradient(-200, -50, 200, 50);
  stamp.addColorStop(0, '#ffe3a1');
  stamp.addColorStop(0.45, GOLD);
  stamp.addColorStop(1, '#b47a12');
  g.fillStyle = stamp;
  g.shadowColor = 'rgba(0, 0, 0, 0.5)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 12;
  const word = retained ? 'RETAINED' : 'SOLD';
  const sw = retained ? 420 : 320;
  roundRect(g, -sw / 2, -52, sw, 104, 16);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = '#1a1204';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 88px ${DISPLAY}`;
  g.fillText(word, 0, 6);
  g.restore();
  g.textBaseline = 'alphabetic';

  // Name and role
  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  fitText(g, player.name.toUpperCase(), W / 2, 880, W - 140, 700, 104, DISPLAY);
  g.fillStyle = '#cbd5e4';
  g.font = `600 28px ${BODY}`;
  const extra = how === 'rtm' ? ' · Right to Match' : how === 'draw' ? ' · Lucky draw' : '';
  g.fillText(`#${player.no} · ${player.role}${extra}`, W / 2, 928);

  // Team band
  if (team) {
    const by = 966, bh = 128;
    g.fillStyle = team.color;
    roundRect(g, 90, by, W - 180, bh, 22);
    g.fill();
    await teamBadge(g, team, 90 + 76, by + bh / 2, 46);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.font = `800 20px ${BODY}`;
    g.fillText(retained ? 'S T A Y S   W I T H' : 'G O E S   T O', 90 + 144, by + 46);
    g.fillStyle = '#ffffff';
    fitText(g, team.name.toUpperCase(), 90 + 144, by + 100, 430, 700, 56, DISPLAY);
    g.textAlign = 'right';
    fitText(g, money(player.price, state.settings.unit), W - 90 - 30, by + 86, 280, 700, 72, DISPLAY);
  }

  await footer(g, state.sponsors ?? [], 1128, H);
  return canvas;
}

/** Full squad of one team with prices. 1080 wide; the height grows with the squad. */
export async function squadCard(state: AppState, team: Team): Promise<HTMLCanvasElement> {
  await ready();
  const st = teamStats(state, team.id);
  const squad = [...st.squad].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  const rowH = 62;
  const listTop = 420;
  const hasSponsors = (state.sponsors ?? []).some((s) => s.logo || s.name.trim());
  const H = Math.max(1080, listTop + Math.max(1, squad.length) * rowH + 130 + (hasSponsors ? 170 : 0) + 110);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;

  backdrop(g, H, team.color);
  header(g, state);

  // Team band
  g.fillStyle = team.color;
  roundRect(g, 70, 190, W - 140, 180, 26);
  g.fill();
  await teamBadge(g, team, 70 + 104, 280, 64);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff';
  fitText(g, team.name.toUpperCase(), 70 + 196, 278, W - 140 - 230, 700, 76, DISPLAY);
  g.fillStyle = 'rgba(255, 255, 255, 0.9)';
  g.font = `600 26px ${BODY}`;
  g.fillText([team.owner ? 'Owner: ' + team.owner : '', st.count + ' players'].filter(Boolean).join(' · '), 70 + 196, 324);

  // Players
  g.textBaseline = 'middle';
  squad.forEach((p, i) => {
    const y = listTop + i * rowH;
    if (i % 2 === 0) {
      g.fillStyle = 'rgba(255, 255, 255, 0.055)';
      roundRect(g, 70, y, W - 140, rowH, 10);
      g.fill();
    }
    const mid = y + rowH / 2 + 1;
    g.textAlign = 'left';
    g.fillStyle = '#8794ab';
    g.font = `700 24px ${BODY}`;
    g.fillText(String(i + 1), 92, mid);
    g.fillStyle = '#ffffff';
    fitText(g, p.name, 146, mid, 470, 700, 30, BODY);
    g.fillStyle = '#aab6ca';
    fitText(g, p.role + (p.status === 'retained' ? ' · Retained' : ''), 640, mid, 220, 600, 22, BODY);
    g.textAlign = 'right';
    g.fillStyle = GOLD;
    g.font = `700 36px ${DISPLAY}`;
    g.fillText(money(p.price, state.settings.unit), W - 92, mid + 1);
  });
  if (!squad.length) {
    g.textAlign = 'center';
    g.fillStyle = '#8794ab';
    g.font = `600 28px ${BODY}`;
    g.fillText('No players yet', W / 2, listTop + rowH / 2);
  }
  g.textBaseline = 'alphabetic';

  // Totals
  const ty = listTop + Math.max(1, squad.length) * rowH + 30;
  g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(70, ty);
  g.lineTo(W - 70, ty);
  g.stroke();
  g.textAlign = 'left';
  g.fillStyle = '#cbd5e4';
  g.font = `600 26px ${BODY}`;
  g.fillText('Spent ' + money(st.spent, state.settings.unit), 92, ty + 50);
  g.textAlign = 'right';
  g.fillText('Purse left ' + money(st.purseLeft, state.settings.unit), W - 92, ty + 50);

  await footer(g, state.sponsors ?? [], ty + 96, H);
  return canvas;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands the picture to the phone's share sheet (WhatsApp, Instagram, …). On a
 * computer, where files cannot be shared that way, it is downloaded instead.
 */
export async function shareCanvas(canvas: HTMLCanvasElement, fileName: string, text: string, forceDownload = false): Promise<ShareOutcome> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('no image');
  const file = new File([blob], fileName, { type: 'image/png' });
  if (!forceDownload && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      // Sharing refused (some desktop browsers): fall back to a download.
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}
