// Test data so the app can be tried end to end before real teams and
// players are uploaded. Everything here can be edited or reset in the app.
import type { AppState, AuctionState, Category, Player, Settings, Team } from '../types';
import { sportOf, type SportId } from './sports';

export const defaultSettings: Settings = {
  name: 'Local Premier League 2026',
  sport: 'cricket',
  venue: '',
  date: '2026-10-12T18:00',
  unit: 'Cr',
  purse: 10,
  minSquad: 10,
  maxSquad: 12,
  slabs: [
    { upTo: 1, step: 0.05 },
    { upTo: 3, step: 0.1 },
    { upTo: null, step: 0.25 },
  ],
  order: 'category',
  timerMode: 'auto',
  timerStart: 30,
  timerAfterBid: 15,
  theme: 'stadium',
  soldEffect: 'burst',
  rtm: true,
  rtmCards: 1,
  retention: true,
  maxRetained: 2,
  reauction: true,
  reserveCheck: true,
  keyboard: true,
  ownerBidding: true,
  selfRegistration: true,
  sound: true,
  maxPlayerPrice: null,
  tieDraw: true,
  drawEntry: 'bidders',
};

export const dummyCategories: Category[] = [
  { id: 'cat_m', name: 'Marquee', color: '#C9922E', base: 0.5, increment: 0.1, minPerTeam: 1, maxPerTeam: 1, maxPrice: 3 },
  { id: 'cat_a', name: 'Category A', color: '#1F6B4A', base: 0.3, increment: null, minPerTeam: 2, maxPerTeam: 4, maxPrice: null },
  { id: 'cat_b', name: 'Category B', color: '#2E5BFF', base: 0.2, increment: null, minPerTeam: 3, maxPerTeam: 5, maxPrice: null },
  { id: 'cat_c', name: 'Category C', color: '#8A8F87', base: 0.1, increment: null, minPerTeam: 0, maxPerTeam: 4, maxPrice: 1 },
];

export const dummyTeams: Team[] = [
  { id: 't_rs', name: 'Royal Strikers', short: 'RS', owner: 'Amit Patil', ownerMobile: '', color: '#E5484D', key: 'R', rtmUsed: 0 },
  { id: 't_tt', name: 'Thunder Titans', short: 'TT', owner: 'Rahul Deshmukh', ownerMobile: '', color: '#2E5BFF', key: 'T', rtmUsed: 0 },
  { id: 't_wx', name: 'Warriors XI', short: 'WX', owner: 'Sagar Jadhav', ownerMobile: '', color: '#FF7A1A', key: 'W', rtmUsed: 0 },
  { id: 't_sk', name: 'Super Kings', short: 'SK', owner: 'Nikhil Shinde', ownerMobile: '', color: '#7C4DDB', key: 'K', rtmUsed: 0 },
  { id: 't_gg', name: 'Gully Gladiators', short: 'GG', owner: 'Vikas More', ownerMobile: '', color: '#12A360', key: 'G', rtmUsed: 0 },
  { id: 't_su', name: 'Sixers United', short: 'SU', owner: 'Prashant Kale', ownerMobile: '', color: '#D6409F', key: 'Y', rtmUsed: 0 },
  { id: 't_bb', name: 'Blue Blasters', short: 'BB', owner: 'Ketan Pawar', ownerMobile: '', color: '#0EA5B7', key: 'B', rtmUsed: 0 },
  { id: 't_mm', name: 'Mighty Mavericks', short: 'MM', owner: 'Omkar Sawant', ownerMobile: '', color: '#475467', key: 'M', rtmUsed: 0 },
];

const first = [
  'Rohit', 'Sanket', 'Harshal', 'Akash', 'Vinay', 'Mahesh', 'Tushar', 'Mayur', 'Swapnil', 'Ganesh', 'Pratik', 'Yogesh',
  'Nilesh', 'Sameer', 'Aniket', 'Kunal', 'Rohan', 'Deepak', 'Ravi', 'Tejas', 'Umesh', 'Sagar', 'Amol', 'Chetan',
  'Rahul', 'Vijay', 'Suraj', 'Nitin', 'Dinesh', 'Siddharth', 'Kiran', 'Sachin', 'Ajay', 'Pravin', 'Omkar', 'Shubham',
];
const last = [
  'Pawar', 'Jadhav', 'Shinde', 'More', 'Kulkarni', 'Gore', 'Gaikwad', 'Patil', 'Kale', 'Salunkhe', 'Bhosale', 'Chavan',
  'Jagtap', 'Kadam', 'Deshpande', 'Mane', 'Thorat', 'Salve', 'Nalawade', 'Dhage', 'Lokhande', 'Wagh', 'Bhor', 'Ingale',
];
const cricketRoles = ['Batsman', 'Bowler', 'All-rounder', 'Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Bowler'];
const bowling: Record<string, string[]> = {
  Batsman: ['—', 'Right-arm medium', '—'],
  Bowler: ['Right-arm fast', 'Off spin', 'Left-arm fast', 'Leg spin', 'Right-arm medium', 'Left-arm spin'],
  'All-rounder': ['Right-arm medium', 'Off spin', 'Left-arm spin', 'Leg spin'],
  'Wicket-keeper': ['—'],
};

function makePlayers(sportId: SportId): Player[] {
  const sport = sportOf(sportId);
  const roles = sport.hasBatBowl ? cricketRoles : sport.roles;
  const players: Player[] = [];
  // 8 marquee, 24 A, 32 B, 32 C = 96 players
  const plan: [string, number][] = [['cat_m', 8], ['cat_a', 24], ['cat_b', 32], ['cat_c', 32]];
  let n = 0;
  for (const [categoryId, count] of plan) {
    for (let i = 0; i < count; i++) {
      const role = roles[n % roles.length]!;
      const bowl = bowling[role] ?? ['—'];
      players.push({
        id: 'p_' + (n + 1),
        no: 101 + n,
        name: first[(n * 7) % first.length] + ' ' + last[(n * 5 + Math.floor(n / 24)) % last.length],
        age: 19 + ((n * 3) % 17),
        role,
        batting: sport.hasBatBowl ? (n % 4 === 1 ? 'Left hand' : 'Right hand') : '',
        bowling: sport.hasBatBowl ? bowl[n % bowl.length]! : '',
        categoryId,
        tag: '',
        status: 'available',
        teamId: null,
        price: null,
        // Every 5th player played for a team last season, so RTM can be tried.
        previousTeamId: n % 5 === 2 ? dummyTeams[n % dummyTeams.length]!.id : null,
      });
      n++;
    }
  }
  // Tags and retained players, matching the design mock-ups.
  players[0]!.tag = 'Icon';
  players[9]!.tag = 'Captain';
  const retained: [number, string, number][] = [
    [1, 't_rs', 0.5],
    [10, 't_tt', 0.5],
    [12, 't_sk', 0.3],
    [40, 't_sk', 0.2],
    [14, 't_gg', 0.3],
    [16, 't_bb', 0.3],
  ];
  for (const [idx, teamId, price] of retained) {
    Object.assign(players[idx]!, { status: 'retained', teamId, price });
  }
  return players;
}

export const emptyAuction: AuctionState = {
  status: 'idle',
  round: 1,
  queue: [],
  currentPlayerId: null,
  phase: 'bidding',
  bids: [],
  timerEndsAt: null,
  timerPausedLeft: null,
  eventN: 0,
  lastEvent: null,
  shown: 0,
};

export const STATE_VERSION = 2;

/**
 * The default prices above are for a ₹10 Cr purse. When an auction uses a
 * different purse (e.g. 10,000 points), scale base prices, increments and
 * limits by the same ratio so the rules still make sense.
 */
function scaleMoney(s: AppState): AppState {
  const f = s.settings.purse / defaultSettings.purse;
  if (!f || f === 1) return s;
  const r = (x: number) => Math.round(x * f * 100) / 100;
  s.settings.slabs = defaultSettings.slabs.map((sl) => ({ upTo: sl.upTo == null ? null : r(sl.upTo), step: r(sl.step) }));  for (const c of s.categories) {
    c.base = r(c.base);
    if (c.increment != null) c.increment = r(c.increment);
    if (c.maxPrice != null) c.maxPrice = r(c.maxPrice);
  }
  for (const p of s.players) if (p.price != null) p.price = r(p.price);
  return s;
}

/** A ready-to-try auction with 8 teams and 96 players. */
export function createDummyState(sport: SportId = 'cricket', overrides: Partial<Settings> = {}): AppState {
  return scaleMoney({
    version: STATE_VERSION,
    settings: { ...structuredClone(defaultSettings), sport, ...overrides },
    categories: structuredClone(dummyCategories),
    teams: structuredClone(dummyTeams),
    players: makePlayers(sport),
    auction: structuredClone(emptyAuction),
    log: [],
  });
}

/** An empty auction: default rules and categories, no teams or players yet. */
export function createBlankState(settings: Partial<Settings>): AppState {
  return scaleMoney({
    version: STATE_VERSION,
    settings: { ...structuredClone(defaultSettings), ...settings },
    categories: structuredClone(dummyCategories),
    teams: [],
    players: [],
    auction: structuredClone(emptyAuction),
    log: [],
  });
}

/** Brings state saved by an older version of the app up to date. */
export function migrateState(s: AppState): AppState {
  // New settings get their defaults even on the same version.
  if (s.version === STATE_VERSION && Object.keys(defaultSettings).every((k) => k in s.settings)) return s;
  return {
    ...s,
    version: STATE_VERSION,
    settings: { ...structuredClone(defaultSettings), ...s.settings, sport: s.settings.sport ?? 'cricket', venue: s.settings.venue ?? '' },
  };
}
