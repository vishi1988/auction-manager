// Share pictures for the tournament: a match result, Player of the Match, and
// the final awards. Same look as the SOLD and squad cards (see cards.ts).
import { scoringOf } from '../data/sportStats';
import type { AppState, Match, Player, SideScore } from '../types';
import { backdrop, BODY, cover, DISPLAY, fitText, footer, GOLD, header, loadImage, ready, roundRect, teamBadge, W } from './cards';
import { initials } from './format';
import { leaderboard, matchName, oversText, potmOf, potsOf, resultOf, resultText, seriesRace, slotLabel, slotTeam, tournamentOf } from './tournament';

/** A player's match in a few words: "52 (24) · 3/18". */
export function statLine(state: AppState, line: Record<string, number> | undefined): string {
  if (!line) return '';
  const sc = scoringOf(state.settings.sport);
  const per = tournamentOf(state).settings.ballsPerOver;
  if (sc.tiebreak === 'nrr') {
    const parts: string[] = [];
    if (line.runs || line.balls) parts.push(`${line.runs ?? 0}${line.out ? '' : '*'} (${line.balls ?? 0})`);
    if (line.ballsBowled || line.wickets) parts.push(`${line.wickets ?? 0}/${line.runsGiven ?? 0} (${oversText(line.ballsBowled, per)})`);
    const field = [line.catches && `${line.catches} ct`, line.runOuts && `${line.runOuts} RO`, line.stumpings && `${line.stumpings} st`].filter(Boolean);
    if (field.length) parts.push(field.join(', '));
    return parts.join(' · ');
  }
  return sc.stats
    .filter((d) => line[d.key])
    .map((d) => (d.flag ? d.label : `${line[d.key]} ${d.label}`))
    .join(' · ');
}

function scoreText(state: AppState, s: SideScore | null | undefined): string {
  if (!s) return '–';
  if (scoringOf(state.settings.sport).tiebreak !== 'nrr') return String(s.score);
  return `${s.score}/${s.allOut ? 'all out' : s.wickets ?? 0}`;
}

function makeCanvas(h: number) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

async function photoBox(g: CanvasRenderingContext2D, p: Player, color: string, x: number, y: number, w: number, h: number, r: number) {
  g.save();
  roundRect(g, x, y, w, h, r);
  g.clip();
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#0b1220');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  const photo = await loadImage(p.photo);
  if (photo) cover(g, photo, x, y, w, h);
  else {
    g.fillStyle = 'rgba(255, 255, 255, 0.9)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(h * 0.42)}px ${DISPLAY}`;
    g.fillText(initials(p.name), x + w / 2, y + h / 2 + 6);
    g.textBaseline = 'alphabetic';
  }
  g.restore();
  g.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  g.lineWidth = 4;
  roundRect(g, x, y, w, h, r);
  g.stroke();
}

/** Gold label like the SOLD stamp. */
function stamp(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, size = 60) {
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.04);
  g.font = `700 ${size}px ${DISPLAY}`;
  const w = g.measureText(text).width + 70;
  const grad = g.createLinearGradient(-w / 2, -40, w / 2, 40);
  grad.addColorStop(0, '#ffe3a1');
  grad.addColorStop(0.45, GOLD);
  grad.addColorStop(1, '#b47a12');
  g.fillStyle = grad;
  g.shadowColor = 'rgba(0, 0, 0, 0.5)';
  g.shadowBlur = 26;
  g.shadowOffsetY = 10;
  roundRect(g, -w / 2, -size * 0.62, w, size * 1.24, 14);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = '#1a1204';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 4);
  g.restore();
  g.textBaseline = 'alphabetic';
}

const hasSponsors = (state: AppState) => (state.sponsors ?? []).some((s) => s.logo || s.name.trim());

/** Match result: both teams with scores, the result line and Player of the Match. 1080 x 1080 (taller with sponsors). */
export async function resultCard(state: AppState, m: Match): Promise<HTMLCanvasElement> {
  await ready();
  const H = hasSponsors(state) ? 1250 : 1080;
  const [canvas, g] = makeCanvas(H);
  const winSide = resultOf(m);
  const winner = winSide === 'a' || winSide === 'b' ? slotTeam(state, m[winSide]) : undefined;
  backdrop(g, H, winner?.color ?? '#2e5bff');
  header(g, state, matchName(m).toUpperCase());

  const per = tournamentOf(state).settings.ballsPerOver;
  const cricket = scoringOf(state.settings.sport).tiebreak === 'nrr';
  for (const [i, k] of (['a', 'b'] as const).entries()) {
    const y = 210 + i * 200;
    const team = slotTeam(state, m[k]);
    const won = winSide === k;
    g.fillStyle = won ? team?.color ?? '#1f2a44' : 'rgba(255, 255, 255, 0.07)';
    roundRect(g, 80, y, W - 160, 170, 24);
    g.fill();
    if (team) await teamBadge(g, team, 80 + 92, y + 85, 56);
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    fitText(g, slotLabel(state, m[k]).toUpperCase(), 80 + 176, y + 104, 470, 700, 60, DISPLAY);
    const s = k === 'a' ? m.scoreA : m.scoreB;
    g.textAlign = 'right';
    g.fillStyle = won ? '#ffffff' : '#cbd5e4';
    g.font = `700 76px ${DISPLAY}`;
    g.fillText(scoreText(state, s), W - 80 - 36, y + 100);
    if (cricket && s?.balls != null) {
      g.font = `600 24px ${BODY}`;
      g.fillStyle = 'rgba(255, 255, 255, 0.75)';
      g.fillText(`${oversText(s.balls, per)} overs`, W - 80 - 36, y + 138);
    }
  }

  g.textAlign = 'center';
  g.fillStyle = GOLD;
  fitText(g, resultText(state, m).toUpperCase(), W / 2, 660, W - 160, 700, 56, DISPLAY);

  const potmId = potmOf(state, m);
  const potm = potmId ? state.players.find((p) => p.id === potmId) : undefined;
  if (potm) {
    const y = 710;
    g.fillStyle = 'rgba(255, 255, 255, 0.07)';
    roundRect(g, 80, y, W - 160, 200, 24);
    g.fill();
    const team = state.teams.find((t) => t.id === potm.teamId);
    await photoBox(g, potm, team?.color ?? '#2e5bff', 104, y + 24, 152, 152, 20);
    g.textAlign = 'left';
    g.fillStyle = GOLD;
    g.font = `800 22px ${BODY}`;
    g.fillText('⭐  P L A Y E R   O F   T H E   M A T C H', 290, y + 64);
    g.fillStyle = '#ffffff';
    fitText(g, potm.name.toUpperCase(), 290, y + 124, W - 160 - 240, 700, 58, DISPLAY);
    g.fillStyle = '#cbd5e4';
    fitText(g, statLine(state, m.stats[potm.id]), 290, y + 166, W - 160 - 240, 600, 28, BODY);
  }

  await footer(g, state.sponsors ?? [], 950, H);
  return canvas;
}

/** Player of the Match picture: photo, name, team and what they did. 1080 x 1350. */
export async function potmCard(state: AppState, m: Match, playerId: string): Promise<HTMLCanvasElement> {
  await ready();
  const H = 1350;
  const [canvas, g] = makeCanvas(H);
  const p = state.players.find((x) => x.id === playerId)!;
  const team = state.teams.find((t) => t.id === p.teamId);
  const color = team?.color ?? '#2e5bff';
  backdrop(g, H, color);
  header(g, state, 'PLAYER OF THE MATCH');

  await photoBox(g, p, color, 300, 196, 480, 520, 30);
  stamp(g, 'PLAYER OF THE MATCH', W / 2, 722, 54);

  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  fitText(g, p.name.toUpperCase(), W / 2, 880, W - 140, 700, 104, DISPLAY);
  g.fillStyle = GOLD;
  fitText(g, statLine(state, m.stats[p.id]) || p.role, W / 2, 940, W - 160, 700, 46, DISPLAY);

  const by = 980, bh = 120;
  g.fillStyle = 'rgba(255, 255, 255, 0.07)';
  roundRect(g, 90, by, W - 180, bh, 22);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  fitText(g, `${slotLabel(state, m.a)}  vs  ${slotLabel(state, m.b)}`.toUpperCase(), W / 2, by + 54, W - 240, 700, 44, DISPLAY);
  g.fillStyle = '#cbd5e4';
  fitText(g, `${matchName(m)} · ${resultText(state, m)}`, W / 2, by + 96, W - 240, 600, 24, BODY);

  await footer(g, state.sponsors ?? [], 1128, H);
  return canvas;
}

/** Final awards: champion, Player of the Series and every leaderboard winner. Height grows with the list. */
export async function awardsCard(state: AppState): Promise<HTMLCanvasElement> {
  await ready();
  const sc = scoringOf(state.settings.sport);
  const tour = tournamentOf(state);
  const final = tour.matches.find((m) => m.stage === 'final');
  const fr = final ? resultOf(final) : null;
  const champion = final && (fr === 'a' || fr === 'b') ? slotTeam(state, final[fr]) : undefined;
  const potsId = potsOf(state);
  const pots = potsId ? state.players.find((p) => p.id === potsId) : undefined;
  const potsPts = seriesRace(state).find((r) => r.playerId === potsId)?.points;
  const rows = sc.leaderboards
    .map((b) => ({ b, top: leaderboard(state, b)[0] }))
    .filter((x): x is { b: typeof x.b; top: NonNullable<typeof x.top> } => !!x.top);

  const rowH = 96;
  let y = 196;
  const champH = champion ? 190 : 0;
  const potsH = pots ? 260 : 0;
  const H = Math.max(1080, y + champH + potsH + rows.length * rowH + 60 + (hasSponsors(state) ? 170 : 0) + 110);
  const [canvas, g] = makeCanvas(H);
  backdrop(g, H, champion?.color ?? '#f2b631');
  header(g, state, 'TOURNAMENT AWARDS');

  if (champion) {
    g.fillStyle = champion.color;
    roundRect(g, 70, y, W - 140, 166, 26);
    g.fill();
    await teamBadge(g, champion, 70 + 96, y + 83, 58);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.font = `800 22px ${BODY}`;
    g.fillText('🏆  C H A M P I O N S', 70 + 180, y + 62);
    g.fillStyle = '#ffffff';
    fitText(g, champion.name.toUpperCase(), 70 + 180, y + 128, W - 140 - 220, 700, 72, DISPLAY);
    y += champH;
  }

  if (pots) {
    const team = state.teams.find((t) => t.id === pots.teamId);
    g.fillStyle = 'rgba(255, 255, 255, 0.07)';
    roundRect(g, 70, y, W - 140, 236, 26);
    g.fill();
    await photoBox(g, pots, team?.color ?? '#2e5bff', 96, y + 26, 184, 184, 22);
    g.textAlign = 'left';
    g.fillStyle = GOLD;
    g.font = `800 22px ${BODY}`;
    g.fillText('P L A Y E R   O F   T H E   S E R I E S', 316, y + 72);
    g.fillStyle = '#ffffff';
    fitText(g, pots.name.toUpperCase(), 316, y + 142, W - 140 - 270, 700, 72, DISPLAY);
    g.fillStyle = '#cbd5e4';
    fitText(g, [team?.name, potsPts ? `${potsPts} points` : ''].filter(Boolean).join(' · '), 316, y + 188, W - 140 - 270, 600, 28, BODY);
    y += potsH;
  }

  g.textBaseline = 'middle';
  rows.forEach(({ b, top }, i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) {
      g.fillStyle = 'rgba(255, 255, 255, 0.055)';
      roundRect(g, 70, ry, W - 140, rowH - 8, 14);
      g.fill();
    }
    const mid = ry + (rowH - 8) / 2;
    const p = state.players.find((x) => x.id === top.playerId);
    g.textAlign = 'left';
    g.fillStyle = GOLD;
    fitText(g, `${b.icon} ${b.title}`.toUpperCase(), 96, mid, 330, 700, 34, DISPLAY);
    g.fillStyle = '#ffffff';
    fitText(g, p?.name ?? '', 440, mid, 400, 700, 30, BODY);
    g.textAlign = 'right';
    g.fillStyle = '#ffffff';
    g.font = `700 40px ${DISPLAY}`;
    g.fillText(top.shown, W - 96, mid + 2);
  });
  g.textBaseline = 'alphabetic';
  if (!champion && !pots && !rows.length) {
    g.textAlign = 'center';
    g.fillStyle = '#8794ab';
    g.font = `600 30px ${BODY}`;
    g.fillText('Awards appear once scorecards are filled in', W / 2, 400);
  }

  await footer(g, state.sponsors ?? [], y + rows.length * rowH + 40, H);
  return canvas;
}
