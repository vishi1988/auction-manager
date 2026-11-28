// All auction money rules live here so the console, phone screens and
// owner bidding page always agree on what a legal bid is.
import type { AppState, Category, Player, Settings } from '../types';
import { money, r2 } from './format';

const EPS = 1e-9;

export function categoryOf(state: AppState, player: Player): Category {
  return state.categories.find((c) => c.id === player.categoryId) ?? state.categories[0]!;
}

export function basePriceOf(state: AppState, player: Player): number {
  return player.basePrice ?? categoryOf(state, player).base;
}

/** How much the next bid goes up by when the current bid is `amount`. */
export function stepFor(amount: number, settings: Settings, category?: Category): number {
  if (category?.increment) return category.increment;
  const slab = settings.slabs.find((s) => s.upTo == null || amount < s.upTo - EPS);
  return slab?.step ?? settings.slabs[settings.slabs.length - 1]?.step ?? 1;
}

export function currentPlayer(state: AppState): Player | null {
  const id = state.auction.currentPlayerId;
  return id ? state.players.find((p) => p.id === id) ?? null : null;
}

/** The highest real bid (draw entries match it but don't raise it). */
export function leadingBid(state: AppState) {
  const bids = state.auction.bids;
  for (let i = bids.length - 1; i >= 0; i--) if (!bids[i]!.tie) return bids[i]!;
  return null;
}

/**
 * Upper limit for this player: the category's own limit, else the auction's.
 * A limit below the player's base price is a setup mistake (for example limits
 * left in ₹ Crore after switching to points): nobody could bid, so it is ignored.
 */
export function upperLimitFor(state: AppState, player: Player): number | null {
  const cap = categoryOf(state, player).maxPrice ?? state.settings.maxPlayerPrice ?? null;
  return cap != null && cap < basePriceOf(state, player) - EPS ? null : cap;
}

/** Categories whose upper limit (own, or the auction's) is below their base price. */
export function limitsBelowBase(state: AppState): Category[] {
  return state.categories.filter((c) => {
    const cap = c.maxPrice ?? state.settings.maxPlayerPrice ?? null;
    return cap != null && cap < c.base - EPS;
  });
}

/** True once the bidding on the current player has reached its upper limit. */
export function atUpperLimit(state: AppState): boolean {
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  const cap = player ? upperLimitFor(state, player) : null;
  return !!lead && cap != null && lead.amount >= cap - EPS;
}

/** Teams that joined the lucky draw at the upper limit (besides the leader). */
export function tiedTeams(state: AppState): string[] {
  const lead = leadingBid(state);
  if (!lead) return [];
  const ids = state.auction.bids.filter((b) => b.tie && b.amount === lead.amount && b.teamId !== lead.teamId).map((b) => b.teamId);
  return [...new Set(ids)];
}

/** Everyone in the draw: the team that reached the limit plus those who joined. */
export function drawEntrants(state: AppState): string[] {
  const lead = leadingBid(state);
  return lead ? [lead.teamId, ...tiedTeams(state)] : [];
}

/**
 * At the upper limit, can this team say "yes, I want him at this price" and
 * enter the lucky draw? Only teams that bid on this player earlier may join.
 */
export function checkJoinDraw(state: AppState, teamId: string): BidCheck {
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  const amount = lead?.amount ?? 0;
  const no = (reason: string): BidCheck => ({ ok: false, reason, max: 0, amount });
  if (!state.settings.tieDraw || !player || !lead || state.auction.phase !== 'bidding' || state.auction.status !== 'live') return no('');
  if (!atUpperLimit(state)) return no('');
  if (lead.teamId === teamId) return no('In the draw');
  if (tiedTeams(state).includes(teamId)) return no('In the draw');
  if (state.settings.drawEntry === 'bidders' && !state.auction.bids.some((b) => b.teamId === teamId && !b.tie)) return no('Did not bid');
  const cat = categoryOf(state, player);
  const stats = teamStats(state, teamId);
  if (stats.count >= state.settings.maxSquad) return no('Squad full');
  if ((stats.byCategory[cat.id] ?? 0) >= cat.maxPerTeam) return no(cat.name + ' full');
  const max = maxBidFor(state, teamId, player);
  if (amount > max + EPS) return no('Max ' + money(max, state.settings.unit));
  return { ok: true, reason: 'Wants at limit', max, amount };
}

/** Amount the next bid on the current player would be (never above the upper limit). */
export function nextBidAmount(state: AppState): number {
  const player = currentPlayer(state);
  if (!player) return 0;
  const lead = leadingBid(state);
  const cap = upperLimitFor(state, player);
  const next = lead ? r2(lead.amount + stepFor(lead.amount, state.settings, categoryOf(state, player))) : basePriceOf(state, player);
  // A step that would jump past the limit stops exactly at the limit.
  return cap != null && lead && lead.amount < cap - EPS && next > cap ? cap : next;
}

export interface TeamStats {
  squad: Player[];
  count: number;
  spent: number;
  purseLeft: number;
  byCategory: Record<string, number>;
}

export function teamStats(state: AppState, teamId: string): TeamStats {
  const squad = state.players.filter(
    (p) => p.teamId === teamId && (p.status === 'sold' || p.status === 'retained'),
  );
  const spent = r2(squad.reduce((sum, p) => sum + (p.price ?? 0), 0));
  const byCategory: Record<string, number> = {};
  for (const p of squad) byCategory[p.categoryId] = (byCategory[p.categoryId] ?? 0) + 1;
  return { squad, count: squad.length, spent, purseLeft: r2(state.settings.purse - spent), byCategory };
}

/**
 * Money a team must keep after buying `player` so it can still complete its
 * minimum squad (and each category's minimum) at base prices.
 */
export function reserveAfterBuying(state: AppState, teamId: string, player: Player): number {
  const stats = teamStats(state, teamId);
  const slotsLeft = Math.max(0, state.settings.minSquad - (stats.count + 1));
  let reserved = 0;
  let slotsCovered = 0;
  for (const cat of state.categories) {
    const have = (stats.byCategory[cat.id] ?? 0) + (cat.id === player.categoryId ? 1 : 0);
    const need = Math.max(0, cat.minPerTeam - have);
    reserved += need * cat.base;
    slotsCovered += need;
  }
  const cheapest = Math.min(...state.categories.map((c) => c.base));
  reserved += Math.max(0, slotsLeft - slotsCovered) * cheapest;
  return r2(reserved);
}

/** Highest amount this team may bid for `player`. */
export function maxBidFor(state: AppState, teamId: string, player: Player): number {
  const { purseLeft } = teamStats(state, teamId);
  let max = state.settings.reserveCheck ? purseLeft - reserveAfterBuying(state, teamId, player) : purseLeft;
  const cap = upperLimitFor(state, player);
  if (cap != null) max = Math.min(max, cap);
  return r2(Math.max(0, max));
}

export interface BidCheck {
  ok: boolean;
  /** Short reason shown on the team button when a bid is not allowed. */
  reason: string;
  max: number;
  amount: number;
}

export function checkBid(state: AppState, teamId: string): BidCheck {
  const player = currentPlayer(state);
  const amount = nextBidAmount(state);
  if (!player || state.auction.phase !== 'bidding' || state.auction.status !== 'live') {
    return { ok: false, reason: 'No player on the block', max: 0, amount };
  }
  const unit = state.settings.unit;
  const max = maxBidFor(state, teamId, player);
  const stats = teamStats(state, teamId);
  const cat = categoryOf(state, player);
  const lead = leadingBid(state);
  const no = (reason: string): BidCheck => ({ ok: false, reason, max, amount });

  if (lead?.teamId === teamId) return no('Leading bid');
  if (stats.count >= state.settings.maxSquad) return no('Squad full');
  if ((stats.byCategory[cat.id] ?? 0) >= cat.maxPerTeam) return no(cat.name + ' full');
  if (atUpperLimit(state)) return no('Upper limit reached');
  if (amount > max + EPS) return no('Max ' + money(max, unit));
  return { ok: true, reason: 'Max ' + money(max, unit), max, amount };
}

/** Team that can use Right to Match on the current sale, if any. */
export function rtmCandidate(state: AppState): string | null {
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  if (!state.settings.rtm || !player?.previousTeamId || !lead) return null;
  const prev = state.teams.find((t) => t.id === player.previousTeamId);
  if (!prev || prev.id === lead.teamId || prev.rtmUsed >= state.settings.rtmCards) return null;
  if (tiedTeams(state).length) return null; // a lucky draw settles ties instead
  const stats = teamStats(state, prev.id);
  if (stats.count >= state.settings.maxSquad) return null;
  if (lead.amount > maxBidFor(state, prev.id, player) + EPS) return null;
  return prev.id;
}

/**
 * Players still marked as retained or sold by a team that no longer exists
 * (for example the team was deleted, or two devices changed it at once).
 * They are stuck: no team shows them and they cannot be picked again.
 */
export function orphanedPlayers(state: AppState): Player[] {
  const ids = new Set(state.teams.map((t) => t.id));
  return state.players.filter((p) => p.teamId && !ids.has(p.teamId));
}

/** Puts orphaned players back in the pool so they can be retained or auctioned again. Changes `state`. */
export function releaseOrphans(state: AppState): number {
  const stuck = orphanedPlayers(state);
  for (const p of stuck) Object.assign(p, { status: 'available', teamId: null, price: null });
  return stuck.length;
}
