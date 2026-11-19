import type { AccessRole } from '../types';

/** The roles an owner can give to people (the owner role itself is not given out). */
export const MEMBER_ROLES = ['admin', 'auctioneer', 'data'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABEL: Record<AccessRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  auctioneer: 'Auctioneer',
  data: 'Data entry',
};

export const ROLE_HELP: Record<AccessRole, string> = {
  owner: 'Created the auction. Can do everything, including deleting it and choosing admins.',
  admin: 'Can do everything except delete the auction or choose other admins.',
  auctioneer: 'Runs the Auction console: start, bids, SOLD and UNSOLD. Cannot change rules, teams or players.',
  data: 'Adds and edits players and teams, and collects registrations. Cannot run the auction or change rules.',
};

/** The admin screens of an auction, for deciding who may open which. */
export type Area = 'settings' | 'teams' | 'players' | 'console' | 'results' | 'team';

const ACCESS: Record<Area, AccessRole[]> = {
  settings: ['owner', 'admin'],
  teams: ['owner', 'admin', 'data'],
  players: ['owner', 'admin', 'data'],
  console: ['owner', 'admin', 'auctioneer'],
  results: ['owner', 'admin', 'auctioneer', 'data'],
  team: ['owner', 'admin', 'auctioneer', 'data'],
};

/**
 * May this role open this screen? `null` means the auction is only being
 * watched from another device, which keeps the older behaviour: every screen
 * opens but nothing can be changed.
 */
export const canOpen = (role: AccessRole | null, area: Area) => role === null || ACCESS[area].includes(role);

/** Which screen a path inside an auction belongs to ('' for the overview, which everyone sees). */
export function areaOfPath(path: string): Area | null {
  const m = /^\/(settings|teams|players|console|results|team)(\/|\?|$)/.exec(path);
  return m ? (m[1] as Area) : null;
}
