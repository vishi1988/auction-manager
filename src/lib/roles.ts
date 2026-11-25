import type { AccessRole } from '../types';

/** The roles an owner can give to people (the owner role itself is not given out). */
export const MEMBER_ROLES = ['admin', 'auctioneer', 'data', 'scorer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABEL: Record<AccessRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  auctioneer: 'Auctioneer',
  data: 'Data entry',
  scorer: 'Scorer',
};

export const ROLE_HELP: Record<AccessRole, string> = {
  owner: 'Created the auction. Can do everything, including deleting it and choosing admins.',
  admin: 'Can do everything except delete the auction or choose other admins.',
  auctioneer: 'Runs the Auction console: start, bids, SOLD and UNSOLD. Cannot change rules, teams or players.',
  data: 'Adds and edits players and teams, collects registrations and fills in match scores. Cannot run the auction or change rules.',
  scorer: 'Fills in match scores and player scorecards only. Cannot change the auction, teams, players or the tournament format.',
};

/** The admin screens of an auction, for deciding who may open which. */
export type Area = 'settings' | 'teams' | 'players' | 'console' | 'results' | 'team' | 'matches';

const ACCESS: Record<Area, AccessRole[]> = {
  settings: ['owner', 'admin'],
  teams: ['owner', 'admin', 'data'],
  players: ['owner', 'admin', 'data'],
  console: ['owner', 'admin', 'auctioneer'],
  results: ['owner', 'admin', 'auctioneer', 'data', 'scorer'],
  team: ['owner', 'admin', 'auctioneer', 'data', 'scorer'],
  matches: ['owner', 'admin', 'data', 'scorer'],
};

/**
 * May this role open this screen? `null` means the auction is only being
 * watched from another device, which keeps the older behaviour: every screen
 * opens but nothing can be changed.
 */
export const canOpen = (role: AccessRole | null, area: Area) => role === null || ACCESS[area].includes(role);

/** Which screen a path inside an auction belongs to ('' for the overview, which everyone sees). */
export function areaOfPath(path: string): Area | null {
  const m = /^\/(settings|teams|players|console|results|team|matches)(\/|\?|$)/.exec(path);
  return m ? (m[1] as Area) : null;
}

/** May this role change the tournament format and make fixtures? (A scorer only fills in scores.) */
export const canSetUpTournament = (role: AccessRole | null) => role !== 'scorer';
