// Matches after the auction: making fixtures, working out results, the points
// table (with NRR for cricket), leaderboards and award points. Pure functions:
// screens call them with the auction state and show what comes back.
import { scoringOf, type Leaderboard } from '../data/sportStats';
import type { AppState, Match, MatchResult, MatchStage, Player, SideScore, Slot, Team, Tournament, TournamentSettings } from '../types';

// ---------- setup ----------

export function defaultTournamentSettings(sport: string): TournamentSettings {
  const sc = scoringOf(sport);
  return {
    leagueRounds: 1,
    groups: 1,
    knockout: 'semis',
    thirdPlace: false,
    overs: 6,
    ballsPerOver: 6,
    playersPerSide: 11,
    points: { win: 2, draw: 1, noResult: 1, loss: 0 },
    potm: 'auto',
    pots: 'auto',
    weights: { ...sc.weights },
    bonuses: sc.bonuses.map((b) => ({ ...b })),
  };
}

/** The auction's tournament, or an empty one with default settings. */
export function tournamentOf(s: AppState): Tournament {
  return s.tournament ?? { settings: defaultTournamentSettings(s.settings.sport), matches: [] };
}

export const GROUP_LETTERS = 'ABCDEFGH';

export const STAGE_LABEL: Record<MatchStage, string> = {
  league: 'League',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  q1: 'Qualifier 1',
  elim: 'Eliminator',
  q2: 'Qualifier 2',
  third: '3rd place',
  final: 'Final',
};

/** How many teams the knockout stage needs. */
export function knockoutSize(k: TournamentSettings['knockout']): number {
  return { none: 0, final: 2, semis: 4, quarters: 8, playoffs: 4 }[k];
}

/** A reason the chosen format cannot be made with these teams, or null when it is fine. */
export function formatProblem(t: TournamentSettings, teamCount: number): string | null {
  if (teamCount < 2) return 'Add at least 2 teams first.';
  const ko = knockoutSize(t.knockout);
  if (t.leagueRounds === 0) {
    if (ko === 0) return 'Choose a league, a knockout, or both.';
    if (teamCount !== ko) return `Knockout only needs exactly ${ko} teams (you have ${teamCount}). Add a league stage, or pick another knockout.`;
    return null;
  }
  if (t.groups < 1 || t.groups > GROUP_LETTERS.length) return 'Groups must be between 1 and 8.';
  if (teamCount < t.groups * 2) return `${t.groups} groups need at least ${t.groups * 2} teams.`;
  if (ko) {
    if (ko % t.groups !== 0) return `${ko} knockout places cannot be shared equally between ${t.groups} groups. Use ${ko === 2 ? '1 or 2' : ko === 4 ? '1, 2 or 4' : '1, 2, 4 or 8'} groups.`;
    const perGroup = ko / t.groups;
    const smallest = Math.floor(teamCount / t.groups);
    if (perGroup > smallest) return `Each group would need ${perGroup} qualifiers but the smallest group has ${smallest} teams.`;
  }
  return null;
}

// ---------- fixtures ----------

let idSeq = 0;
const newMatchId = () => 'm_' + Date.now().toString(36) + (idSeq++).toString(36) + Math.random().toString(36).slice(2, 5);

/** Every pair of teams once, spread into rounds so no team plays twice in a round (circle method). */
export function roundRobin(ids: string[]): [string, string][][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[i]!;
      const y = list[n - 1 - i]!;
      if (x && y) round.push(r % 2 && i === 0 ? [y, x] : [x, y]);
    }
    rounds.push(round);
    // Keep the first team still and turn the rest one place.
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Teams dealt into groups like cards (1st to A, 2nd to B, ... then back), so groups stay level. */
export function splitGroups(ids: string[], groups: number): string[][] {
  const out: string[][] = Array.from({ length: groups }, () => []);
  ids.forEach((id, i) => {
    const lap = Math.floor(i / groups);
    const pos = i % groups;
    out[lap % 2 ? groups - 1 - pos : pos]!.push(id);
  });
  return out;
}

/**
 * Qualifier places in seed order: every group winner first, then every
 * runner-up, ... ("A1", "B1", "A2", "B2"). Seed 1 meets the last seed, so
 * teams from the same group meet as late as possible.
 */
function seeds(groups: number, size: number, single: boolean): string[] {
  const out: string[] = [];
  for (let pos = 1; out.length < size; pos++) for (let g = 0; g < groups && out.length < size; g++) out.push((single ? 'A' : GROUP_LETTERS[g]) + pos);
  return out;
}

export function blankMatch(no: number, stage: MatchStage, a: Slot, b: Slot, group?: string): Match {
  return { id: newMatchId(), no, stage, ...(group ? { group } : {}), a, b, date: '', time: '', ground: '', status: 'upcoming', stats: {} };
}

/** Makes the full fixture list. Existing matches are not looked at: the caller replaces them. */
export function generateFixtures(teams: Team[], t: TournamentSettings): Match[] {
  const ids = teams.map((x) => x.id);
  const matches: Match[] = [];
  const add = (stage: MatchStage, a: Slot, b: Slot, group?: string) => {
    const m = blankMatch(matches.length + 1, stage, a, b, group);
    matches.push(m);
    return m;
  };

  if (t.leagueRounds > 0) {
    const groups = splitGroups(ids, Math.max(1, t.groups));
    const perGroup = groups.map((g) => roundRobin(g));
    for (let leg = 0; leg < t.leagueRounds; leg++) {
      const most = Math.max(...perGroup.map((r) => r.length));
      // Round by round, groups taking turns, so every team gets rest between games.
      for (let r = 0; r < most; r++) {
        perGroup.forEach((rounds, gi) => {
          for (const [x, y] of rounds[r] ?? []) {
            const [home, away] = leg % 2 ? [y, x] : [x, y];
            add('league', { teamId: home }, { teamId: away }, t.groups > 1 ? GROUP_LETTERS[gi] : undefined);
          }
        });
      }
    }
  }

  const size = knockoutSize(t.knockout);
  if (!size) return matches;
  // Without a league the teams go straight in, in the order they were added.
  const slot = (code: string, i: number): Slot => (t.leagueRounds > 0 ? { from: code } : { teamId: ids[i] ?? null });
  const s = seeds(t.leagueRounds > 0 ? t.groups : 1, size, t.leagueRounds === 0 || t.groups === 1);
  const pair = (i: number) => [slot(s[i]!, i), slot(s[size - 1 - i]!, size - 1 - i)] as const;
  const win = (m: Match): Slot => ({ from: 'W:' + m.id });
  const lose = (m: Match): Slot => ({ from: 'L:' + m.id });

  if (t.knockout === 'playoffs') {
    const q1 = add('q1', slot(s[0]!, 0), slot(s[1]!, 1));
    const el = add('elim', slot(s[2]!, 2), slot(s[3]!, 3));
    const q2 = add('q2', lose(q1), win(el));
    add('final', win(q1), win(q2));
    return matches;
  }
  if (t.knockout === 'final') {
    add('final', ...pair(0));
    return matches;
  }
  let semis: Match[];
  if (t.knockout === 'quarters') {
    // Bracket order 1v8, 4v5 | 2v7, 3v6: seeds 1 and 2 can only meet in the final.
    const q = [0, 3, 1, 2].map((i) => add('qf', ...pair(i)));
    semis = [add('sf', win(q[0]!), win(q[1]!)), add('sf', win(q[2]!), win(q[3]!))];
  } else {
    semis = [add('sf', ...pair(0)), add('sf', ...pair(1))];
  }
  if (t.thirdPlace) add('third', lose(semis[0]!), lose(semis[1]!));
  add('final', win(semis[0]!), win(semis[1]!));
  return matches;
}

// ---------- results ----------

/** Balls a side used for NRR: a side bowled out counts the full quota. */
function ballsForNrr(score: SideScore | null | undefined, quota: number): number {
  if (!score) return 0;
  if (score.allOut) return quota;
  return score.balls ?? quota;
}

const matchOvers = (m: Match, t: TournamentSettings) => m.overs ?? t.overs;

/** Who won: the organiser's choice when set, otherwise the higher score. Null while not played. */
export function resultOf(m: Match): MatchResult | null {
  if (m.status === 'abandoned') return 'nr';
  if (m.status !== 'done') return null;
  if (m.result) return m.result;
  const a = m.scoreA?.score;
  const b = m.scoreB?.score;
  if (a == null || b == null) return null;
  return a > b ? 'a' : b > a ? 'b' : 'draw';
}

/** Overs shown the cricket way: 14 balls of 6 -> "2.2". */
export function oversText(balls: number | undefined, perOver = 6): string {
  const b = balls ?? 0;
  return Math.floor(b / perOver) + (b % perOver ? '.' + (b % perOver) : '');
}

/** "2.3" -> 15 balls. Accepts "2" and "2.0". Returns null when it is not a valid overs number. */
export function parseOvers(text: string, perOver = 6): number | null {
  const m = /^\s*(\d+)(?:\.(\d))?\s*$/.exec(text);
  if (!m) return null;
  const extra = Number(m[2] ?? 0);
  if (extra >= perOver) return null;
  return Number(m[1]) * perOver + extra;
}

/** "Lions won by 12 runs" / "won by 4 wickets" / "Match tied". */
export function resultText(s: AppState, m: Match): string {
  const r = resultOf(m);
  if (!r) return '';
  const t = tournamentOf(s).settings;
  const sc = scoringOf(s.settings.sport);
  const teamA = slotTeam(s, m.a);
  const teamB = slotTeam(s, m.b);
  const note = m.note ? ` (${m.note})` : '';
  if (r === 'nr') return (m.status === 'abandoned' ? 'Abandoned' : 'No result') + note;
  if (r === 'draw') return `Match ${sc.drawLabel === 'Tie' ? 'tied' : 'drawn'}${note}`;
  const winner = r === 'a' ? teamA : teamB;
  const name = winner?.name ?? 'Winner';
  const ws = r === 'a' ? m.scoreA : m.scoreB;
  const ls = r === 'a' ? m.scoreB : m.scoreA;
  if (m.result || !ws || !ls) return `${name} won${note}`;
  if (sc.tiebreak === 'nrr' && m.battedFirst) {
    if (m.battedFirst === r) {
      const runs = ws.score - ls.score;
      return `${name} won by ${runs} run${runs === 1 ? '' : 's'}${note}`;
    }
    const wkts = Math.max(0, t.playersPerSide - 1 - (ws.wickets ?? 0));
    const left = matchOvers(m, t) * t.ballsPerOver - (ws.balls ?? 0);
    const balls = left > 0 ? `, ${left} ball${left === 1 ? '' : 's'} left` : '';
    return `${name} won by ${wkts} wicket${wkts === 1 ? '' : 's'}${balls}${note}`;
  }
  return `${name} won ${ws.score}–${ls.score}${note}`;
}

// ---------- points table ----------

export interface StandingRow {
  teamId: string;
  group: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  noResult: number;
  points: number;
  /** Runs / goals scored and conceded. */
  for: number;
  against: number;
  /** Cricket: balls faced and bowled (bowled-out sides count the full quota). */
  ballsFaced: number;
  ballsBowled: number;
  nrr: number;
  /** Results of the last few matches, newest last: W, L, D, N. */
  form: string[];
}

function emptyRow(teamId: string, group: string): StandingRow {
  return { teamId, group, played: 0, won: 0, lost: 0, drawn: 0, noResult: 0, points: 0, for: 0, against: 0, ballsFaced: 0, ballsBowled: 0, nrr: 0, form: [] };
}

/** League groups and the teams in each, as the fixtures put them. */
export function leagueGroups(s: AppState): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of tournamentOf(s).matches) {
    if (m.stage !== 'league') continue;
    const g = m.group ?? 'A';
    const list = (out[g] ??= []);
    for (const id of [m.a.teamId, m.b.teamId]) if (id && !list.includes(id)) list.push(id);
  }
  return out;
}

/** Points table of every league group, best team first. */
export function standings(s: AppState): Record<string, StandingRow[]> {
  const tour = tournamentOf(s);
  const t = tour.settings;
  const sc = scoringOf(s.settings.sport);
  const groups = leagueGroups(s);
  const rows: Record<string, StandingRow> = {};
  for (const [g, ids] of Object.entries(groups)) for (const id of ids) rows[id] = emptyRow(id, g);

  const matches = [...tour.matches].filter((m) => m.stage === 'league').sort((x, y) => x.no - y.no);
  for (const m of matches) {
    const r = resultOf(m);
    const a = m.a.teamId ? rows[m.a.teamId] : undefined;
    const b = m.b.teamId ? rows[m.b.teamId] : undefined;
    if (!r || !a || !b) continue;
    a.played++;
    b.played++;
    if (r === 'nr') {
      for (const x of [a, b]) {
        x.noResult++;
        x.points += t.points.noResult;
        x.form.push('N');
      }
      continue;
    }
    if (r === 'draw') {
      for (const x of [a, b]) {
        x.drawn++;
        x.points += t.points.draw;
        x.form.push('D');
      }
    } else {
      const [w, l] = r === 'a' ? [a, b] : [b, a];
      w.won++;
      w.points += t.points.win;
      w.form.push('W');
      l.lost++;
      l.points += t.points.loss;
      l.form.push('L');
    }
    const sa = m.scoreA;
    const sb = m.scoreB;
    // A result set by hand without a score (walkover) counts for points only.
    if (!sa || !sb) continue;
    a.for += sa.score;
    a.against += sb.score;
    b.for += sb.score;
    b.against += sa.score;
    if (sc.tiebreak === 'nrr') {
      const quota = matchOvers(m, t) * t.ballsPerOver;
      const fa = ballsForNrr(sa, quota);
      const fb = ballsForNrr(sb, quota);
      a.ballsFaced += fa;
      a.ballsBowled += fb;
      b.ballsFaced += fb;
      b.ballsBowled += fa;
    }
  }

  const out: Record<string, StandingRow[]> = {};
  for (const row of Object.values(rows)) {
    if (sc.tiebreak === 'nrr') {
      const per = t.ballsPerOver;
      const rf = row.ballsFaced ? row.for / (row.ballsFaced / per) : 0;
      const ra = row.ballsBowled ? row.against / (row.ballsBowled / per) : 0;
      row.nrr = Math.round((rf - ra) * 1000) / 1000;
    }
    row.form = row.form.slice(-5);
    (out[row.group] ??= []).push(row);
  }
  const teamName = (id: string) => s.teams.find((x) => x.id === id)?.name ?? '';
  for (const list of Object.values(out)) {
    list.sort(
      (x, y) =>
        y.points - x.points ||
        (sc.tiebreak === 'nrr' ? y.nrr - x.nrr : y.for - y.against - (x.for - x.against)) ||
        y.won - x.won ||
        y.for - x.for ||
        teamName(x.teamId).localeCompare(teamName(y.teamId)),
    );
  }
  return out;
}

/** True once every league match of a group has a result (so its places are final). */
function groupFinished(s: AppState, group: string): boolean {
  const list = tournamentOf(s).matches.filter((m) => m.stage === 'league' && (m.group ?? 'A') === group);
  return list.length > 0 && list.every((m) => resultOf(m) !== null);
}

// ---------- knockout places ----------

/** The team in a slot: chosen by hand, or worked out from the table / an earlier match. */
export function slotTeamId(s: AppState, slot: Slot, depth = 0): string | null {
  if (slot.teamId) return slot.teamId;
  const code = slot.from;
  if (!code || depth > 20) return null;
  const wl = /^([WL]):(.+)$/.exec(code);
  if (wl) {
    const m = tournamentOf(s).matches.find((x) => x.id === wl[2]);
    if (!m) return null;
    const r = resultOf(m);
    if (r !== 'a' && r !== 'b') return null;
    const side = (wl[1] === 'W') === (r === 'a') ? m.a : m.b;
    return slotTeamId(s, side, depth + 1);
  }
  const gp = /^([A-H])(\d+)$/.exec(code);
  if (gp) {
    if (!groupFinished(s, gp[1]!)) return null;
    return standings(s)[gp[1]!]?.[Number(gp[2]) - 1]?.teamId ?? null;
  }
  return null;
}

export function slotTeam(s: AppState, slot: Slot): Team | undefined {
  const id = slotTeamId(s, slot);
  return id ? s.teams.find((t) => t.id === id) : undefined;
}

/** Words for a place not yet filled: "Winner of Match 9", "Group A #1", "League #2". */
export function slotLabel(s: AppState, slot: Slot): string {
  const team = slotTeam(s, slot);
  if (team) return team.name;
  const code = slot.from ?? '';
  const wl = /^([WL]):(.+)$/.exec(code);
  if (wl) {
    const m = tournamentOf(s).matches.find((x) => x.id === wl[2]);
    return `${wl[1] === 'W' ? 'Winner' : 'Loser'} of ${m ? matchName(m) : 'match'}`;
  }
  const gp = /^([A-H])(\d+)$/.exec(code);
  if (gp) {
    const single = Object.keys(leagueGroups(s)).length <= 1;
    return `${single ? 'League' : 'Group ' + gp[1]} #${gp[2]}`;
  }
  return 'To be decided';
}

export const matchName = (m: Match) => (m.stage === 'league' ? `Match ${m.no}` : `${STAGE_LABEL[m.stage]} (Match ${m.no})`);

// ---------- players: stats, award points, leaderboards ----------

/** The squad that plays for a team: bought and retained players. */
export function squadOf(s: AppState, teamId: string): Player[] {
  return s.players.filter((p) => p.teamId === teamId && (p.status === 'sold' || p.status === 'retained'));
}

/** Players listed on a side's scorecard: the team's squad plus anyone added for this match. */
export function sidePlayers(s: AppState, m: Match, side: 'a' | 'b'): Player[] {
  const teamId = slotTeamId(s, m[side]);
  const squad = teamId ? squadOf(s, teamId) : [];
  const extra = (m.subs?.[side] ?? []).map((id) => s.players.find((p) => p.id === id)).filter((p): p is Player => !!p && !squad.includes(p));
  return [...squad, ...extra];
}

const sum = (m: Match, ids: string[], key: string) => ids.reduce((n, id) => n + (m.stats[id]?.[key] ?? 0), 0);

/**
 * Things on a cricket scorecard that do not add up, in plain words, so a
 * typing mistake is noticed before awards are worked out. Empty when all is well.
 */
export function scorecardWarnings(s: AppState, m: Match): string[] {
  if (scoringOf(s.settings.sport).tiebreak !== 'nrr') return [];
  const t = tournamentOf(s).settings;
  const out: string[] = [];
  for (const side of ['a', 'b'] as const) {
    const other = side === 'a' ? 'b' : 'a';
    const score = side === 'a' ? m.scoreA : m.scoreB;
    const ids = sidePlayers(s, m, side).map((p) => p.id).filter((id) => m.stats[id]);
    const bowlers = sidePlayers(s, m, other).map((p) => p.id).filter((id) => m.stats[id]);
    const name = slotLabel(s, m[side]);
    if (!score || (!ids.length && !bowlers.length)) continue;
    const runs = sum(m, ids, 'runs');
    // Only check batting once some batting is typed (a card may have bowling only so far).
    const batting = runs + sum(m, ids, 'balls') + sum(m, ids, 'out') > 0;
    if (batting && runs +(score.extras ?? 0) !== score.score) {
      out.push(`${name}: batters' runs (${runs}) + extras (${score.extras ?? 0}) = ${runs + (score.extras ?? 0)}, but the team total is ${score.score}.`);
    }
    const outs = sum(m, ids, 'out');
    if (batting && score.wickets != null && outs !== score.wickets) out.push(`${name}: ${outs} batters marked out, but the score says ${score.wickets} wickets.`);
    const taken = sum(m, bowlers, 'wickets');
    if (bowlers.length && score.wickets != null && taken > score.wickets) out.push(`${slotLabel(s, m[other])} bowlers took ${taken} wickets, but ${name} lost only ${score.wickets}.`);
    const bowled = sum(m, bowlers, 'ballsBowled');
    if (bowlers.length && score.balls != null && bowled > 0 && bowled !== score.balls) {
      out.push(`${slotLabel(s, m[other])} bowled ${oversText(bowled, t.ballsPerOver)} overs, but ${name} batted ${oversText(score.balls, t.ballsPerOver)}.`);
    }
  }
  return out;
}

/** Award points for one player in one match: stat x points, plus the highest bonus reached per stat. */
export function matchPoints(line: Record<string, number> | undefined, t: TournamentSettings): number {
  if (!line) return 0;
  let pts = 0;
  for (const [k, w] of Object.entries(t.weights)) pts += (line[k] ?? 0) * w;
  const best: Record<string, number> = {};
  for (const b of t.bonuses) if ((line[b.stat] ?? 0) >= b.atLeast) best[b.stat] = Math.max(best[b.stat] ?? 0, b.points);
  for (const v of Object.values(best)) pts += v;
  return pts;
}

/** Played matches with a result (abandoned ones excluded: their numbers are not counted). */
const counted = (tour: Tournament) => tour.matches.filter((m) => m.status === 'done');

/** Player of the Match: the organiser's choice, or in auto mode the player with most award points. */
export function potmOf(s: AppState, m: Match): string | null {
  if (m.potm) return m.potm;
  const t = tournamentOf(s).settings;
  if (t.potm !== 'auto' || m.status !== 'done') return null;
  return topScorers(m, t)[0]?.playerId ?? null;
}

/** Players of a match by award points, best first (suggestions for Player of the Match). */
export function topScorers(m: Match, t: TournamentSettings): { playerId: string; points: number }[] {
  return Object.entries(m.stats)
    .map(([playerId, line]) => ({ playerId, points: matchPoints(line, t) }))
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points);
}

export interface PlayerTotals {
  playerId: string;
  matches: number;
  stats: Record<string, number>;
  points: number;
  potm: number;
}

/** Every player's tournament totals. */
export function playerTotals(s: AppState): PlayerTotals[] {
  const tour = tournamentOf(s);
  const out: Record<string, PlayerTotals> = {};
  for (const m of counted(tour)) {
    for (const [pid, line] of Object.entries(m.stats)) {
      const row = (out[pid] ??= { playerId: pid, matches: 0, stats: {}, points: 0, potm: 0 });
      row.matches++;
      for (const [k, v] of Object.entries(line)) row.stats[k] = (row.stats[k] ?? 0) + v;
      row.points += matchPoints(line, tour.settings);
    }
    const p = potmOf(s, m);
    if (p && out[p]) out[p].potm++;
  }
  return Object.values(out);
}

/** Player of the Series: the organiser's choice, or in auto mode the most award points. */
export function potsOf(s: AppState): string | null {
  const tour = tournamentOf(s);
  if (tour.pots) return tour.pots;
  if (tour.settings.pots !== 'auto') return null;
  return seriesRace(s)[0]?.playerId ?? null;
}

export const seriesRace = (s: AppState) => playerTotals(s).filter((x) => x.points > 0).sort((a, b) => b.points - a.points || b.potm - a.potm);

export interface LeaderRow {
  playerId: string;
  value: number;
  /** Text shown, e.g. "152.4" for strike rate. */
  shown: string;
  matches: number;
}

/** One leaderboard (Orange Cap, Golden Boot, ...), best first. */
export function leaderboard(s: AppState, board: Leaderboard): LeaderRow[] {
  const per = tournamentOf(s).settings.ballsPerOver;
  const rows: LeaderRow[] = [];
  for (const p of playerTotals(s)) {
    const st = p.stats;
    if (board.calc === 'strikeRate') {
      // At least 10 balls faced, so one lucky six does not top the list.
      if ((st.balls ?? 0) < 10) continue;
      const v = ((st.runs ?? 0) / st.balls!) * 100;
      rows.push({ playerId: p.playerId, value: v, shown: v.toFixed(1), matches: p.matches });
    } else if (board.calc === 'economy') {
      if ((st.ballsBowled ?? 0) < per * 2) continue;
      const v = (st.runsGiven ?? 0) / (st.ballsBowled! / per);
      rows.push({ playerId: p.playerId, value: v, shown: v.toFixed(2), matches: p.matches });
    } else {
      const v = board.keys.reduce((sum, k) => sum + (st[k] ?? 0), 0);
      if (v > 0) rows.push({ playerId: p.playerId, value: v, shown: String(v), matches: p.matches });
    }
  }
  // Economy: lower is better.
  return rows.sort((a, b) => (board.calc === 'economy' ? a.value - b.value : b.value - a.value) || a.matches - b.matches);
}
