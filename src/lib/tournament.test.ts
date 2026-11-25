import { describe, expect, it } from 'vitest';
import { createDummyState } from '../data/dummy';
import { scoringOf } from '../data/sportStats';
import type { AppState, Match, TournamentSettings } from '../types';
import {
  defaultTournamentSettings,
  formatProblem,
  generateFixtures,
  leaderboard,
  matchPoints,
  parseOvers,
  oversText,
  potmOf,
  potsOf,
  resultText,
  roundRobin,
  scorecardWarnings,
  sidePlayers,
  slotLabel,
  slotTeamId,
  splitGroups,
  standings,
} from './tournament';

function setup(teamCount: number, over: Partial<TournamentSettings> = {}, sport = 'cricket'): AppState {
  const s = createDummyState(sport as 'cricket');
  s.teams = s.teams.slice(0, teamCount);
  while (s.teams.length < teamCount) s.teams.push({ ...s.teams[0]!, id: 't_x' + s.teams.length, name: 'Extra ' + s.teams.length, short: 'X' + s.teams.length });
  const settings = { ...defaultTournamentSettings(sport), ...over };
  s.tournament = { settings, matches: generateFixtures(s.teams, settings) };
  return s;
}

/** Plays a match: side a scores `a`, side b scores `b`. */
function play(m: Match, a: number, b: number, extra: Partial<Match> = {}) {
  m.status = 'done';
  m.scoreA = { score: a, wickets: 3, balls: 36 };
  m.scoreB = { score: b, wickets: 5, balls: 36 };
  m.battedFirst = 'a';
  Object.assign(m, extra);
}

describe('round robin', () => {
  it('pairs every team once, nobody twice in a round', () => {
    for (const n of [2, 3, 4, 5, 8]) {
      const ids = Array.from({ length: n }, (_, i) => 't' + i);
      const rounds = roundRobin(ids);
      const pairs = rounds.flat().map(([x, y]) => [x, y].sort().join('-'));
      expect(new Set(pairs).size).toBe((n * (n - 1)) / 2);
      expect(pairs.length).toBe((n * (n - 1)) / 2);
      for (const r of rounds) {
        const seen = r.flat();
        expect(new Set(seen).size).toBe(seen.length);
      }
    }
  });

  it('deals teams into level groups', () => {
    expect(splitGroups(['1', '2', '3', '4', '5', '6', '7'], 2)).toEqual([['1', '4', '5'], ['2', '3', '6', '7']]);
  });
});

describe('fixtures', () => {
  it('single league + semis + final', () => {
    const s = setup(6);
    const m = s.tournament!.matches;
    expect(m.filter((x) => x.stage === 'league')).toHaveLength(15);
    expect(m.filter((x) => x.stage === 'sf').map((x) => [x.a.from, x.b.from])).toEqual([['A1', 'A4'], ['A2', 'A3']]);
    const final = m.at(-1)!;
    expect(final.stage).toBe('final');
    expect(final.a.from).toMatch(/^W:/);
    expect(m.map((x) => x.no)).toEqual(m.map((_, i) => i + 1));
  });

  it('double round league', () => {
    const s = setup(4, { leagueRounds: 2, knockout: 'none' });
    expect(s.tournament!.matches).toHaveLength(12);
  });

  it('two groups: semis cross the groups', () => {
    const s = setup(8, { groups: 2 });
    const m = s.tournament!.matches;
    expect(m.filter((x) => x.stage === 'league')).toHaveLength(12);
    expect(new Set(m.filter((x) => x.stage === 'league').map((x) => x.group))).toEqual(new Set(['A', 'B']));
    expect(m.filter((x) => x.stage === 'sf').map((x) => [x.a.from, x.b.from])).toEqual([['A1', 'B2'], ['B1', 'A2']]);
  });

  it('IPL style playoffs', () => {
    const s = setup(5, { knockout: 'playoffs' });
    const ko = s.tournament!.matches.filter((x) => x.stage !== 'league');
    expect(ko.map((x) => x.stage)).toEqual(['q1', 'elim', 'q2', 'final']);
    expect(ko[2]!.a.from).toBe('L:' + ko[0]!.id);
    expect(ko[2]!.b.from).toBe('W:' + ko[1]!.id);
  });

  it('quarters with 3rd place match', () => {
    const s = setup(8, { leagueRounds: 0, knockout: 'quarters', thirdPlace: true });
    const m = s.tournament!.matches;
    expect(m.map((x) => x.stage)).toEqual(['qf', 'qf', 'qf', 'qf', 'sf', 'sf', 'third', 'final']);
    // No league: the teams go straight in, seed 1 against seed 8.
    expect(m[0]!.a.teamId).toBe(s.teams[0]!.id);
    expect(m[0]!.b.teamId).toBe(s.teams[7]!.id);
  });

  it('explains formats that cannot work', () => {
    const t = defaultTournamentSettings('cricket');
    expect(formatProblem(t, 6)).toBeNull();
    expect(formatProblem({ ...t, groups: 3 }, 9)).toMatch(/cannot be shared/);
    expect(formatProblem({ ...t, leagueRounds: 0, knockout: 'semis' }, 6)).toMatch(/exactly 4/);
    expect(formatProblem({ ...t, groups: 4 }, 6)).toMatch(/at least 8/);
    expect(formatProblem({ ...t, leagueRounds: 0, knockout: 'none' }, 4)).toMatch(/league, a knockout/);
  });
});

describe('results and points table', () => {
  it('works out wins, points and NRR', () => {
    const s = setup(4, { knockout: 'final' });
    const league = s.tournament!.matches.filter((m) => m.stage === 'league');
    // Every match: side a scores 60 in 6 overs, side b 50 in 6 overs.
    for (const m of league) play(m, 60, 50);
    const table = standings(s).A!;
    expect(table).toHaveLength(4);
    expect(table.reduce((n, r) => n + r.played, 0)).toBe(12);
    expect(table.reduce((n, r) => n + r.points, 0)).toBe(12);
    const top = table[0]!;
    expect(top.points).toBeGreaterThanOrEqual(table[1]!.points);
    // NRR: (runs for / overs) - (runs against / overs).
    const expected = top.for / (top.ballsFaced / 6) - top.against / (top.ballsBowled / 6);
    expect(top.nrr).toBeCloseTo(expected, 3);
  });

  it('counts a bowled-out side as facing the full overs', () => {
    const s = setup(2, { knockout: 'none' });
    const m = s.tournament!.matches[0]!;
    play(m, 60, 30);
    m.scoreB = { score: 30, wickets: 10, balls: 12, allOut: true };
    const [w, l] = standings(s).A!;
    expect(w!.ballsBowled).toBe(36);
    expect(w!.nrr).toBeCloseTo(60 / 6 - 30 / 6, 3);
    expect(l!.nrr).toBeCloseTo(-(60 / 6 - 30 / 6), 3);
  });

  it('abandoned matches give both teams no-result points', () => {
    const s = setup(2, { knockout: 'none' });
    s.tournament!.matches[0]!.status = 'abandoned';
    const rows = standings(s).A!;
    expect(rows.map((r) => [r.noResult, r.points])).toEqual([[1, 1], [1, 1]]);
  });

  it('writes results the cricket way', () => {
    const s = setup(2, { knockout: 'none' });
    const m = s.tournament!.matches[0]!;
    play(m, 80, 70);
    expect(resultText(s, m)).toMatch(/won by 10 runs$/);
    play(m, 70, 71, { battedFirst: 'a', scoreB: { score: 71, wickets: 4, balls: 32 } });
    expect(resultText(s, m)).toMatch(/won by 6 wickets, 4 balls left$/);
    play(m, 70, 70);
    expect(resultText(s, m)).toBe('Match tied');
    m.result = 'b';
    m.note = 'Super over';
    expect(resultText(s, m)).toMatch(/won \(Super over\)$/);
  });

  it('football uses goal difference', () => {
    const s = setup(3, { knockout: 'none' }, 'football');
    const [m1, m2, m3] = s.tournament!.matches;
    play(m1!, 5, 0);
    play(m2!, 1, 1);
    play(m3!, 1, 1);
    expect(resultText(s, m2!)).toBe('Match drawn');
    const table = standings(s).A!;
    expect(table[0]!.for - table[0]!.against).toBe(5);
  });

  it('fills knockout places once the league is over', () => {
    const s = setup(4, { knockout: 'final' });
    const final = s.tournament!.matches.at(-1)!;
    expect(slotLabel(s, final.a)).toBe('League #1');
    expect(slotTeamId(s, final.a)).toBeNull();
    const league = s.tournament!.matches.filter((m) => m.stage === 'league');
    for (const m of league) play(m, 60, 50);
    const table = standings(s).A!;
    expect(slotTeamId(s, final.a)).toBe(table[0]!.teamId);
    expect(slotTeamId(s, final.b)).toBe(table[1]!.teamId);
  });

  it('follows winners through the bracket', () => {
    const s = setup(4, { leagueRounds: 0, knockout: 'semis' });
    const [sf1, sf2, final] = s.tournament!.matches;
    expect(slotLabel(s, final!.a)).toBe('Winner of Semi-final (Match 1)');
    play(sf1!, 10, 20);
    play(sf2!, 30, 20);
    expect(slotTeamId(s, final!.a)).toBe(slotTeamId(s, sf1!.b));
    expect(slotTeamId(s, final!.b)).toBe(slotTeamId(s, sf2!.a));
  });
});

describe('award points and leaderboards', () => {
  it('adds stats and only the highest bonus', () => {
    const t = defaultTournamentSettings('cricket');
    // 55 runs, 3 fours, 2 sixes: 55 + 3 + 4 + 20 (50 bonus, not also the 30 one).
    expect(matchPoints({ runs: 55, fours: 3, sixes: 2 }, t)).toBe(82);
    expect(matchPoints({ wickets: 3, catches: 1 }, t)).toBe(60 + 10 + 10);
  });

  it('picks Player of the Match and Series automatically, or keeps the organiser choice', () => {
    const s = setup(2, { knockout: 'none', leagueRounds: 2 });
    const [m1, m2] = s.tournament!.matches;
    const [p1, p2] = s.players;
    play(m1!, 60, 50, { stats: { [p1!.id]: { runs: 40 }, [p2!.id]: { wickets: 1 } } });
    play(m2!, 60, 50, { stats: { [p1!.id]: { runs: 5 }, [p2!.id]: { wickets: 2 } } });
    expect(potmOf(s, m1!)).toBe(p1!.id);
    expect(potmOf(s, m2!)).toBe(p2!.id);
    expect(potsOf(s)).toBe(p2!.id);
    m1!.potm = p2!.id;
    expect(potmOf(s, m1!)).toBe(p2!.id);
    s.tournament!.settings.pots = 'manual';
    expect(potsOf(s)).toBeNull();
    s.tournament!.pots = p1!.id;
    expect(potsOf(s)).toBe(p1!.id);
  });

  it('builds Orange Cap and economy lists', () => {
    const s = setup(2, { knockout: 'none' });
    const m = s.tournament!.matches[0]!;
    const [p1, p2, p3] = s.players;
    play(m, 60, 50, {
      stats: {
        [p1!.id]: { runs: 32, balls: 20, ballsBowled: 12, runsGiven: 20 },
        [p2!.id]: { runs: 45, balls: 30, ballsBowled: 12, runsGiven: 10 },
        [p3!.id]: { runs: 6, balls: 1 },
      },
    });
    const sc = scoringOf('cricket');
    const board = (id: string) => leaderboard(s, sc.leaderboards.find((b) => b.id === id)!);
    expect(board('runs').map((r) => r.playerId)).toEqual([p2!.id, p1!.id, p3!.id]);
    // p3 faced only 1 ball: left out of strike rate.
    expect(board("sr").map((r) => r.playerId)).toEqual([p1!.id, p2!.id]);
    expect(board('econ')[0]!.playerId).toBe(p2!.id);
    expect(board('econ')[0]!.shown).toBe('5.00');
  });
});

describe('overs', () => {
  it('reads and writes overs', () => {
    expect(parseOvers('2.3')).toBe(15);
    expect(parseOvers('4')).toBe(24);
    expect(parseOvers('2.6')).toBeNull();
    expect(parseOvers('x')).toBeNull();
    expect(oversText(15)).toBe('2.3');
    expect(oversText(24)).toBe('4');
  });
});

describe('scorecard', () => {
  /** Two teams with three bought players each. */
  function withSquads() {
    const s = setup(2, { knockout: 'none' });
    const [ta, tb] = s.teams;
    s.players.slice(0, 3).forEach((p) => Object.assign(p, { status: 'sold', teamId: ta!.id }));
    s.players.slice(3, 6).forEach((p) => Object.assign(p, { status: 'sold', teamId: tb!.id }));
    const m = s.tournament!.matches[0]!;
    // The fixture may list either team first.
    if (m.a.teamId !== ta!.id) [m.a, m.b] = [m.b, m.a];
    return { s, m, a: s.players.slice(0, 3), b: s.players.slice(3, 6), spare: s.players[6]! };
  }

  it('lists the squad plus players added for the match', () => {
    const { s, m, a, spare } = withSquads();
    expect(sidePlayers(s, m, 'a').map((p) => p.id)).toEqual(a.map((p) => p.id));
    m.subs = { a: [spare.id] };
    expect(sidePlayers(s, m, 'a').map((p) => p.id)).toEqual([...a, spare].map((p) => p.id));
  });

  it('warns when the numbers do not add up', () => {
    const { s, m, a, b } = withSquads();
    play(m, 50, 40);
    m.scoreA = { score: 50, wickets: 1, balls: 36, extras: 4 };
    m.scoreB = { score: 40, wickets: 2, balls: 36 };
    m.stats = {
      [a[0]!.id]: { runs: 30, out: 1 },
      [a[1]!.id]: { runs: 16 },
      [b[0]!.id]: { runs: 40, out: 1 },
      [b[1]!.id]: { out: 1 },
    };
    expect(scorecardWarnings(s, m)).toEqual([]);
    m.stats[a[1]!.id] = { runs: 10 };
    m.stats[b[2]!.id] = { wickets: 2, ballsBowled: 30 };
    const w = scorecardWarnings(s, m);
    expect(w.some((x) => /batters' runs \(40\) \+ extras \(4\) = 44, but the team total is 50/.test(x))).toBe(true);
    expect(w.some((x) => /bowlers took 2 wickets, but .* lost only 1/.test(x))).toBe(true);
    expect(w.some((x) => /bowled 5 overs, but .* batted 6/.test(x))).toBe(true);
  });
});
