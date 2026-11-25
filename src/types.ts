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
  /** Secret in this team's private bidding link. Viewers never receive it. */
  ownerKey?: string;
}

/** A sponsor shown on the live screen, the streaming overlay and share cards. */
export interface Sponsor {
  id: string;
  name: string;
  logo?: string;
}

/** A T-shirt ordered on top of the player's own: a second one for the player, or one for someone who is not playing. */
export interface ExtraTshirt {
  who: 'player' | 'other';
  /** Who it is for, when it is not for the player (family, friend, supporter). */
  name?: string;
  size: string;
  jerseyName?: string;
  jerseyNo?: string;
}

/** What a player sends from the registration form. */
export interface Registration {
  /** Given by the server; becomes the player's id. */
  id?: string;
  name: string;
  age?: number;
  mobile: string;
  role: Role;
  batting: string;
  bowling: string;
  jerseyName?: string;
  jerseyNo?: string;
  tshirt?: string;
  extraTshirts?: ExtraTshirt[];
  photo?: string;
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
  /** Size: S–XXL, or whatever the player typed (e.g. "3XL", "Kids 30"). */
  tshirt?: string;
  extraTshirts?: ExtraTshirt[];
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
/** What a person is to an auction: the owner, or someone the owner invited (see members.php). */
export type AccessRole = 'owner' | 'admin' | 'auctioneer' | 'data' | 'scorer';

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
  /** Only for auctions shared with this account; own auctions leave it out. */
  role?: AccessRole;
}

export interface AppState {
  version: number;
  settings: Settings;
  categories: Category[];
  teams: Team[];
  players: Player[];
  auction: AuctionState;
  log: LogEntry[];
  /** Sponsors of the tournament, in the order they are shown. */
  sponsors?: Sponsor[];
  /** Matches played after the auction, with scores and awards. Missing until the organiser sets it up. */
  tournament?: Tournament;
}

// ---------- tournament: fixtures, scores and awards after the auction ----------

/** Knockout stages that follow the league (or replace it when there is no league). */
export type KnockoutFormat = 'none' | 'final' | 'semis' | 'quarters' | 'playoffs';

export type MatchStage = 'league' | 'qf' | 'sf' | 'q1' | 'elim' | 'q2' | 'third' | 'final';

/** Extra points in the award table when a player reaches a mark in one match (e.g. 50 runs: +20). */
export interface StatBonus {
  stat: string;
  atLeast: number;
  points: number;
}

export interface TournamentSettings {
  /** How many times each team plays every other team in its group (0 = no league, straight to knockouts). */
  leagueRounds: number;
  /** Number of league groups (1 = all teams together). */
  groups: number;
  knockout: KnockoutFormat;
  /** Match for 3rd place between the semi-final losers. */
  thirdPlace: boolean;
  /** Cricket: overs per innings, balls per over and players per side (for "all out" and "won by N wickets"). */
  overs: number;
  ballsPerOver: number;
  playersPerSide: number;
  points: { win: number; draw: number; noResult: number; loss: number };
  /** Player of the Match: 'auto' gives it to the top scorer of award points, 'manual' lets the organiser choose. */
  potm: 'auto' | 'manual';
  /** Player of the Series, same choice. */
  pots: 'auto' | 'manual';
  /** Award points per unit of each stat (keys from the sport's stat list). */
  weights: Record<string, number>;
  /** Milestone bonuses; only the highest one reached per stat counts. */
  bonuses: StatBonus[];
}

/** One side of a match: a known team, or a place to be filled ("A1" = group A winner, "W:<match id>" = winner of a match). */
export interface Slot {
  teamId?: string | null;
  from?: string;
}

export interface SideScore {
  /** Runs / goals / points / sets. */
  score: number;
  /** Cricket only. */
  wickets?: number;
  balls?: number;
  allOut?: boolean;
  extras?: number;
}

export type MatchResult = 'a' | 'b' | 'draw' | 'nr';

export interface Match {
  id: string;
  /** Match number shown to people ("Match 7"). */
  no: number;
  stage: MatchStage;
  /** League group letter. */
  group?: string;
  a: Slot;
  b: Slot;
  date: string;
  time: string;
  ground: string;
  status: 'upcoming' | 'done' | 'abandoned';
  /** Cricket: overs for this match when different from the tournament setting (rain, short final). */
  overs?: number | null;
  toss?: { side: 'a' | 'b'; chose: 'bat' | 'bowl' } | null;
  /** Cricket: which side batted first. */
  battedFirst?: 'a' | 'b' | null;
  scoreA?: SideScore | null;
  scoreB?: SideScore | null;
  /** Set by the organiser to override the result worked out from the score (super over, walkover). */
  result?: MatchResult | null;
  /** Short note shown with the result, e.g. "Won the super over". */
  note?: string;
  /** Each player's numbers in this match: player id -> stat key -> value. */
  stats: Record<string, Record<string, number>>;
  /** Players who played for a side without being in its squad (guest, substitute). */
  subs?: { a?: string[]; b?: string[] };
  /** Player of the Match chosen by the organiser (manual mode, or overriding auto). */
  potm?: string | null;
}

export interface Tournament {
  settings: TournamentSettings;
  matches: Match[];
  /** Player of the Series chosen by the organiser. */
  pots?: string | null;
}
