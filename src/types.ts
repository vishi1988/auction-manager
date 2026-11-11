import type { SportId } from './data/sports';

/** Playing role; the allowed values come from the auction's sport (see data/sports.ts). */
export type Role = string;
export type Tag = '' | 'Owner' | 'Captain' | 'Vice Captain' | 'Icon';
/** available = in the auction pool, hold = kept out of the auction for now */
export type PlayerStatus = 'available' | 'sold' | 'unsold' | 'retained' | 'hold';
export type Unit = 'Cr' | 'L' | 'pts';

export interface Category {
  id: string;
  name: string;
  color: string;
  base: number;
  /** Overrides the global increment slabs for this category when set. */
  increment: number | null;
  minPerTeam: number;
  maxPerTeam: number;
  /** Upper limit for players of this category; null = use the auction's limit. */
  maxPrice: number | null;
}

export interface IncrementSlab {
  /** Bids below this amount raise by `step`; null means "and above". */
  upTo: number | null;
  step: number;
}

export interface Settings {
  name: string;
  sport: SportId;
  venue: string;
  date: string;
  unit: Unit;
  purse: number;
  minSquad: number;
  maxSquad: number;
  slabs: IncrementSlab[];
  order: 'category' | 'random' | 'manual';
  timerMode: 'off' | 'auto' | 'manual';
  timerStart: number;
  timerAfterBid: number;
  theme: 'stadium' | 'light' | 'gold';
  /** What the live screen shows on SOLD. */
  soldEffect: 'fireworks' | 'confetti' | 'stamp' | 'none';
  rtm: boolean;
  rtmCards: number;
  retention: boolean;
  maxRetained: number;
  reauction: boolean;
  reserveCheck: boolean;
  keyboard: boolean;
  ownerBidding: boolean;
  selfRegistration: boolean;
  sound: boolean;
  /** Upper limit for any single player (a category can set its own). null = no limit. */
  maxPlayerPrice: number | null;
  /**
   * When a player's price hits the upper limit, the teams that bid on him and
   * still want him at that price go into a lucky draw instead of the first to reach it winning.
   */
  tieDraw: boolean;
  /** Who may join the draw at the limit: only teams that bid on the player, or any team that can afford him. */
  drawEntry: 'bidders' | 'any';
}

export interface Team {
  id: string;
  name: string;
  short: string;
  owner: string;
  ownerMobile: string;
  color: string;
  /** Keyboard key used to bid for this team in the console. */
  key: string;
  logo?: string;
  rtmUsed: number;
}

export interface Player {
  id: string;
  no: number;
  name: string;
  age?: number;
  mobile?: string;
  role: Role;
  batting: string;
  bowling: string;
  categoryId: string;
  tag: Tag;
  jerseyName?: string;
  jerseyNo?: string;
  tshirt?: string;
  photo?: string;
  /** Overrides the category base price when set. */
  basePrice?: number | null;
  status: PlayerStatus;
  teamId?: string | null;
  price?: number | null;
  /** Team the player played for last season — used for Right to Match. */
  previousTeamId?: string | null;
  selfRegistered?: boolean;
}

export interface Bid {
  teamId: string;
  amount: number;
  at: number;
  /** At the upper limit this team said "yes, I want him at this price" and joined the lucky draw. */
  tie?: boolean;
}

export interface Draw {
  amount: number;
  teamIds: string[];
  /** Chosen when the draw starts, so every screen shows the same result. */
  winnerId: string;
  startedAt: number;
}

export type AuctionPhase = 'bidding' | 'rtm' | 'draw' | 'sold' | 'unsold';

export interface AuctionState {
  status: 'idle' | 'live' | 'paused' | 'finished';
  round: number;
  queue: string[];
  currentPlayerId: string | null;
  phase: AuctionPhase;
  bids: Bid[];
  draw?: Draw | null;
  timerEndsAt: number | null;
  /** Remaining ms while paused, so the timer can resume. */
  timerPausedLeft: number | null;
  /** Bumped on every visible change so screens can replay animations. */
  eventN: number;
  lastEvent: 'enter' | 'bid' | 'tie' | 'draw' | 'sold' | 'unsold' | 'rtm' | 'undo' | null;
  /** Player number counter shown as "Player 29 of 96". */
  shown: number;
}

export interface LogEntry {
  at: number;
  type: 'sold' | 'unsold' | 'rtm' | 'draw';
  playerId: string;
  teamId?: string;
  amount?: number;
  /** Teams that took part in a lucky draw. */
  entrants?: string[];
  round: number;
}

/** The person running auctions. Will come from the login account later. */
export interface Organizer {
  name: string;
  organisation: string;
  mobile: string;
  city: string;
  email: string;
}

/** Summary of one auction, shown on the "My Auctions" page without loading all its data. */
export interface AuctionMeta {
  id: string;
  name: string;
  sport: SportId;
  date: string;
  venue: string;
  teams: number;
  players: number;
  status: AuctionState['status'];
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  version: number;
  settings: Settings;
  categories: Category[];
  teams: Team[];
  players: Player[];
  auction: AuctionState;
  log: LogEntry[];
}
