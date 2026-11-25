// What gets counted for each sport once matches are played: the numbers typed
// in for every player, the default award points for each, and the leaderboards
// (Orange Cap, Golden Boot, ...). Everything here is only a starting point:
// the organiser can change the award points in the tournament setup.
import type { StatBonus } from '../types';
import type { SportId } from './sports';

export interface StatDef {
  key: string;
  /** Column heading on the scorecard. */
  short: string;
  label: string;
  /** Scorecard section it is typed in. */
  group: string;
  /** A tick box (0 or 1) rather than a count, e.g. "out" or "clean sheet". */
  flag?: boolean;
  /** Cricket overs bowled are kept as balls and typed as "2.3". */
  overs?: boolean;
}

export interface Leaderboard {
  id: string;
  label: string;
  /** Short title such as "Orange Cap". */
  title: string;
  icon: string;
  /** Stats added up for this list. */
  keys: string[];
  /** Special lists worked out from several stats (cricket strike rate and economy). */
  calc?: 'strikeRate' | 'economy';
}

export interface SportScoring {
  /** What a team scores: "Runs", "Goals", "Points", "Sets". */
  scoreLabel: string;
  /** True when a level score is a draw (cricket calls it a tie). */
  drawLabel: string;
  /** Tie-break in the points table after points. */
  tiebreak: 'nrr' | 'diff';
  stats: StatDef[];
  weights: Record<string, number>;
  bonuses: StatBonus[];
  leaderboards: Leaderboard[];
}

const CRICKET: SportScoring = {
  scoreLabel: 'Runs',
  drawLabel: 'Tie',
  tiebreak: 'nrr',
  stats: [
    { key: 'runs', short: 'R', label: 'Runs', group: 'Batting' },
    { key: 'balls', short: 'B', label: 'Balls faced', group: 'Batting' },
    { key: 'fours', short: '4s', label: 'Fours', group: 'Batting' },
    { key: 'sixes', short: '6s', label: 'Sixes', group: 'Batting' },
    { key: 'out', short: 'Out', label: 'Out', group: 'Batting', flag: true },
    { key: 'ballsBowled', short: 'O', label: 'Overs bowled', group: 'Bowling', overs: true },
    { key: 'runsGiven', short: 'R', label: 'Runs given', group: 'Bowling' },
    { key: 'wickets', short: 'W', label: 'Wickets', group: 'Bowling' },
    { key: 'maidens', short: 'M', label: 'Maidens', group: 'Bowling' },
    { key: 'catches', short: 'Ct', label: 'Catches', group: 'Fielding' },
    { key: 'runOuts', short: 'RO', label: 'Run-outs', group: 'Fielding' },
    { key: 'stumpings', short: 'St', label: 'Stumpings', group: 'Fielding' },
  ],
  weights: { runs: 1, fours: 1, sixes: 2, wickets: 20, maidens: 10, catches: 10, runOuts: 10, stumpings: 15 },
  bonuses: [
    { stat: 'runs', atLeast: 30, points: 10 },
    { stat: 'runs', atLeast: 50, points: 20 },
    { stat: 'wickets', atLeast: 3, points: 10 },
    { stat: 'wickets', atLeast: 5, points: 20 },
  ],
  leaderboards: [
    { id: 'runs', label: 'Most runs', title: 'Orange Cap', icon: '🟠', keys: ['runs'] },
    { id: 'wickets', label: 'Most wickets', title: 'Purple Cap', icon: '🟣', keys: ['wickets'] },
    { id: 'fielding', label: 'Best fielder', title: 'Best Fielder', icon: '🧤', keys: ['catches', 'runOuts', 'stumpings'] },
    { id: 'sixes', label: 'Most sixes', title: 'Most Sixes', icon: '💥', keys: ['sixes'] },
    { id: 'sr', label: 'Best strike rate', title: 'Best Strike Rate', icon: '⚡', keys: ['runs'], calc: 'strikeRate' },
    { id: 'econ', label: 'Best economy', title: 'Best Economy', icon: '🎯', keys: ['runsGiven'], calc: 'economy' },
  ],
};

const goalSport = (keeperStat: string): SportScoring => ({
  scoreLabel: 'Goals',
  drawLabel: 'Draw',
  tiebreak: 'diff',
  stats: [
    { key: 'goals', short: 'G', label: 'Goals', group: 'Attack' },
    { key: 'assists', short: 'A', label: 'Assists', group: 'Attack' },
    { key: keeperStat, short: 'Sv', label: 'Saves', group: 'Defence' },
    { key: 'cleanSheet', short: 'CS', label: 'Clean sheet', group: 'Defence', flag: true },
    { key: 'yellow', short: 'YC', label: 'Yellow card', group: 'Discipline' },
    { key: 'red', short: 'RC', label: 'Red card', group: 'Discipline', flag: true },
  ],
  weights: { goals: 10, assists: 6, [keeperStat]: 2, cleanSheet: 6, yellow: -2, red: -5 },
  bonuses: [{ stat: 'goals', atLeast: 3, points: 10 }],
  leaderboards: [
    { id: 'goals', label: 'Most goals', title: 'Golden Boot', icon: '👟', keys: ['goals'] },
    { id: 'assists', label: 'Most assists', title: 'Top Assists', icon: '🎯', keys: ['assists'] },
    { id: 'saves', label: 'Most saves', title: 'Golden Glove', icon: '🧤', keys: [keeperStat] },
    { id: 'cleanSheets', label: 'Clean sheets', title: 'Clean Sheets', icon: '🛡️', keys: ['cleanSheet'] },
  ],
});

const pointsOnly = (scoreLabel: string): SportScoring => ({
  scoreLabel,
  drawLabel: 'Draw',
  tiebreak: 'diff',
  stats: [{ key: 'points', short: 'Pts', label: 'Points scored', group: 'Scoring' }],
  weights: { points: 1 },
  bonuses: [],
  leaderboards: [{ id: 'points', label: 'Most points', title: 'Top Scorer', icon: '⭐', keys: ['points'] }],
});

const SCORING: Record<SportId, SportScoring> = {
  cricket: CRICKET,
  football: goalSport('saves'),
  hockey: goalSport('saves'),
  kabaddi: {
    scoreLabel: 'Points',
    drawLabel: 'Tie',
    tiebreak: 'diff',
    stats: [
      { key: 'raidPoints', short: 'RP', label: 'Raid points', group: 'Raiding' },
      { key: 'superRaids', short: 'SR', label: 'Super raids', group: 'Raiding' },
      { key: 'tacklePoints', short: 'TP', label: 'Tackle points', group: 'Defence' },
      { key: 'superTackles', short: 'ST', label: 'Super tackles', group: 'Defence' },
    ],
    weights: { raidPoints: 1, superRaids: 3, tacklePoints: 1, superTackles: 3 },
    bonuses: [
      { stat: 'raidPoints', atLeast: 10, points: 5 },
      { stat: 'tacklePoints', atLeast: 5, points: 5 },
    ],
    leaderboards: [
      { id: 'raid', label: 'Most raid points', title: 'Best Raider', icon: '⚡', keys: ['raidPoints'] },
      { id: 'tackle', label: 'Most tackle points', title: 'Best Defender', icon: '🛡️', keys: ['tacklePoints'] },
      { id: 'total', label: 'Most total points', title: 'Top Scorer', icon: '⭐', keys: ['raidPoints', 'tacklePoints'] },
    ],
  },
  volleyball: {
    scoreLabel: 'Sets',
    drawLabel: 'Draw',
    tiebreak: 'diff',
    stats: [
      { key: 'attacks', short: 'Att', label: 'Attack points', group: 'Points' },
      { key: 'blocks', short: 'Blk', label: 'Block points', group: 'Points' },
      { key: 'aces', short: 'Ace', label: 'Service aces', group: 'Points' },
    ],
    weights: { attacks: 1, blocks: 2, aces: 2 },
    bonuses: [],
    leaderboards: [
      { id: 'total', label: 'Most points', title: 'Top Scorer', icon: '⭐', keys: ['attacks', 'blocks', 'aces'] },
      { id: 'blocks', label: 'Most blocks', title: 'Best Blocker', icon: '🧱', keys: ['blocks'] },
      { id: 'aces', label: 'Most aces', title: 'Best Server', icon: '🎯', keys: ['aces'] },
    ],
  },
  basketball: {
    scoreLabel: 'Points',
    drawLabel: 'Draw',
    tiebreak: 'diff',
    stats: [
      { key: 'points', short: 'Pts', label: 'Points', group: 'Scoring' },
      { key: 'rebounds', short: 'Reb', label: 'Rebounds', group: 'Other' },
      { key: 'assists', short: 'Ast', label: 'Assists', group: 'Other' },
      { key: 'steals', short: 'Stl', label: 'Steals', group: 'Other' },
      { key: 'blocks', short: 'Blk', label: 'Blocks', group: 'Other' },
    ],
    weights: { points: 1, rebounds: 1, assists: 1, steals: 2, blocks: 2 },
    bonuses: [{ stat: 'points', atLeast: 20, points: 5 }],
    leaderboards: [
      { id: 'points', label: 'Most points', title: 'Top Scorer', icon: '🏀', keys: ['points'] },
      { id: 'rebounds', label: 'Most rebounds', title: 'Top Rebounder', icon: '🙌', keys: ['rebounds'] },
      { id: 'assists', label: 'Most assists', title: 'Top Assists', icon: '🎯', keys: ['assists'] },
    ],
  },
  badminton: {
    scoreLabel: 'Games',
    drawLabel: 'Draw',
    tiebreak: 'diff',
    stats: [
      { key: 'matchesWon', short: 'MW', label: 'Matches won', group: 'Results' },
      { key: 'gamesWon', short: 'GW', label: 'Games won', group: 'Results' },
    ],
    weights: { matchesWon: 10, gamesWon: 3 },
    bonuses: [],
    leaderboards: [
      { id: 'wins', label: 'Most matches won', title: 'Most Wins', icon: '🏸', keys: ['matchesWon'] },
      { id: 'games', label: 'Most games won', title: 'Most Games', icon: '⭐', keys: ['gamesWon'] },
    ],
  },
  other: pointsOnly('Points'),
};

export const scoringOf = (sport: string | undefined): SportScoring => SCORING[(sport ?? 'cricket') as SportId] ?? SCORING.cricket;
