// Auction flow. Each function edits a draft AppState in place; the store
// wraps them so every change is saved and synced to other screens.
import { emptyAuction } from '../data/dummy';
import type { AppState, Player } from '../types';
import { money } from './format';
import { checkBid, checkJoinDraw, currentPlayer, drawEntrants, leadingBid, rtmCandidate } from './rules';

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildQueue(s: AppState, pool: Player[]): string[] {
  if (s.settings.order === 'manual') return [];
  if (s.settings.order === 'random') return shuffle(pool).map((p) => p.id);
  return s.categories.flatMap((c) => shuffle(pool.filter((p) => p.categoryId === c.id)).map((p) => p.id));
}

const availablePlayers = (s: AppState) => s.players.filter((p) => p.status === 'available');

function bump(s: AppState, event: AppState['auction']['lastEvent']) {
  s.auction.eventN++;
  s.auction.lastEvent = event;
}

function restartTimer(s: AppState, now: number, seconds: number) {
  s.auction.timerPausedLeft = null;
  s.auction.timerEndsAt = s.settings.timerMode === 'auto' ? now + seconds * 1000 : null;
}

export function startAuction(s: AppState, now: number) {
  s.auction = { ...structuredClone(emptyAuction), status: 'live', round: 1, eventN: s.auction.eventN };
  s.auction.queue = buildQueue(s, availablePlayers(s));
  nextPlayer(s, now);
}

/** Moves unsold players into a new round. Returns false when there are none. */
function startNextRound(s: AppState): boolean {
  if (!s.settings.reauction) return false;
  const unsold = s.players.filter((p) => p.status === 'unsold');
  if (!unsold.length) return false;
  for (const p of unsold) p.status = 'available';
  s.auction.round++;
  s.auction.queue = buildQueue(s, unsold);
  return true;
}

export function nextPlayer(s: AppState, now: number) {
  const a = s.auction;
  a.phase = 'bidding';
  a.bids = [];
  a.draw = null;
  a.currentPlayerId = null;
  a.timerEndsAt = null;

  const take = () => {
    while (a.queue.length) {
      const id = a.queue.shift()!;
      if (s.players.find((p) => p.id === id)?.status === 'available') return id;
    }
    return null;
  };

  let id = take();
  if (!id && !availablePlayers(s).length && startNextRound(s)) id = take();
  if (!id) {
    // Manual order: wait for the auctioneer to pick. Otherwise we are done.
    if (s.settings.order === 'manual' && availablePlayers(s).length) {
      bump(s, null);
      return;
    }
    a.status = 'finished';
    bump(s, null);
    return;
  }
  putOnBlock(s, id, now);
}

export function pickPlayer(s: AppState, playerId: string, now: number) {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || p.status !== 'available') return;
  s.auction.queue = s.auction.queue.filter((q) => q !== playerId);
  if (s.auction.status === 'idle' || s.auction.status === 'finished') s.auction.status = 'live';
  putOnBlock(s, playerId, now);
}

function putOnBlock(s: AppState, playerId: string, now: number) {
  const a = s.auction;
  a.currentPlayerId = playerId;
  a.phase = 'bidding';
  a.bids = [];
  a.draw = null;
  a.shown++;
  restartTimer(s, now, s.settings.timerStart);
  bump(s, 'enter');
}

export type BidResult = { ok: true; tie: boolean } | { ok: false; reason: string };

/**
 * A team bids the next amount.
 *
 * `seen` is the leading amount the bidder was looking at (null = no bids yet).
 * If someone else got in first the price has moved on, so the bid is rejected
 * rather than silently placed at a higher price than the owner meant.
 * Leave `seen` out for the auctioneer's own console, which always shows the latest price.
 */
export function placeBid(s: AppState, teamId: string, now: number, seen?: number | null): BidResult {
  const lead = leadingBid(s);
  const current = lead?.amount ?? null;
  if (seen !== undefined && seen !== current) {
    const leader = s.teams.find((t) => t.id === lead?.teamId);
    return { ok: false, reason: `Too late — ${leader?.name ?? 'another team'} bid ${money(current, s.settings.unit)} first` };
  }
  const check = checkBid(s, teamId);
  if (!check.ok) return { ok: false, reason: check.reason };
  s.auction.bids.push({ teamId, amount: check.amount, at: now });
  restartTimer(s, now, s.settings.timerAfterBid);
  bump(s, 'bid');
  return { ok: true, tie: false };
}

/**
 * At the upper limit, a team that bid on this player earlier says
 * "yes, I want him at this price" and enters the lucky draw.
 */
export function joinDraw(s: AppState, teamId: string, now: number): BidResult {
  const check = checkJoinDraw(s, teamId);
  if (!check.ok) return { ok: false, reason: check.reason || 'Draw not open' };
  s.auction.bids.push({ teamId, amount: check.amount, at: now, tie: true });
  bump(s, 'tie');
  return { ok: true, tie: true };
}

function pickWinner(teamIds: string[]): string {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return teamIds[r[0]! % teamIds.length]!;
}

/** How long the draw animation runs before the winner is shown. */
export const DRAW_MS = 4500;

/** Confirms the lucky draw result once it has been revealed. */
export function confirmDraw(s: AppState, now: number) {
  const d = s.auction.draw;
  if (s.auction.phase !== 'draw' || !d) return;
  finalizeSale(s, d.winnerId, d.amount, false, now, d.teamIds);
}

export function skipPlayer(s: AppState, now: number) {
  const id = s.auction.currentPlayerId;
  if (!id || s.auction.phase !== 'bidding') return;
  s.auction.queue.push(id);
  s.auction.shown--;
  nextPlayer(s, now);
}

function finalizeSale(s: AppState, teamId: string, amount: number, viaRtm: boolean, now: number, entrants?: string[]) {
  const player = currentPlayer(s)!;
  player.status = 'sold';
  player.teamId = teamId;
  player.price = amount;
  if (viaRtm) s.teams.find((t) => t.id === teamId)!.rtmUsed++;
  s.log.push({
    at: now,
    type: viaRtm ? 'rtm' : entrants ? 'draw' : 'sold',
    playerId: player.id,
    teamId,
    amount,
    round: s.auction.round,
    ...(entrants ? { entrants } : {}),
  });
  s.auction.phase = 'sold';
  s.auction.timerEndsAt = null;
  bump(s, 'sold');
}

export function markSold(s: AppState, now: number) {
  const lead = leadingBid(s);
  if (!lead || s.auction.phase !== 'bidding') return;
  const entrants = drawEntrants(s);
  if (s.settings.tieDraw && entrants.length > 1) {
    s.auction.phase = 'draw';
    s.auction.draw = { amount: lead.amount, teamIds: entrants, winnerId: pickWinner(entrants), startedAt: now };
    s.auction.timerEndsAt = null;
    bump(s, 'draw');
    return;
  }
  if (rtmCandidate(s)) {
    s.auction.phase = 'rtm';
    s.auction.timerEndsAt = null;
    bump(s, 'rtm');
    return;
  }
  finalizeSale(s, lead.teamId, lead.amount, false, now);
}

export function resolveRtm(s: AppState, useRtm: boolean, now: number) {
  const lead = leadingBid(s);
  const rtmTeam = rtmCandidate(s);
  if (s.auction.phase !== 'rtm' || !lead) return;
  if (useRtm && rtmTeam) finalizeSale(s, rtmTeam, lead.amount, true, now);
  else finalizeSale(s, lead.teamId, lead.amount, false, now);
}

export function markUnsold(s: AppState, now: number) {
  const player = currentPlayer(s);
  if (!player || s.auction.phase !== 'bidding') return;
  player.status = 'unsold';
  s.log.push({ at: now, type: 'unsold', playerId: player.id, round: s.auction.round });
  s.auction.phase = 'unsold';
  s.auction.timerEndsAt = null;
  bump(s, 'unsold');
}

/** Undo the last action on the current player: a result, the RTM prompt or the last bid. */
export function undo(s: AppState, now: number) {
  const a = s.auction;
  const player = currentPlayer(s);
  if (!player) return;
  if (a.phase === 'sold' || a.phase === 'unsold') {
    const entry = s.log[s.log.length - 1];
    if (entry?.playerId === player.id) {
      s.log.pop();
      if (entry.type === 'rtm') s.teams.find((t) => t.id === entry.teamId)!.rtmUsed--;
    }
    player.status = 'available';
    player.teamId = null;
    player.price = null;
    a.phase = 'bidding';
    a.draw = null;
  } else if (a.phase === 'rtm' || a.phase === 'draw') {
    a.phase = 'bidding';
    a.draw = null;
  } else if (a.bids.length) {
    a.bids.pop();
  } else {
    return;
  }
  restartTimer(s, now, s.settings.timerAfterBid);
  bump(s, 'undo');
}

export function pauseAuction(s: AppState, now: number) {
  const a = s.auction;
  if (a.status !== 'live') return;
  a.status = 'paused';
  a.timerPausedLeft = a.timerEndsAt ? Math.max(0, a.timerEndsAt - now) : null;
  a.timerEndsAt = null;
}

export function resumeAuction(s: AppState, now: number) {
  const a = s.auction;
  if (a.status !== 'paused') return;
  a.status = 'live';
  if (a.timerPausedLeft != null) a.timerEndsAt = now + a.timerPausedLeft;
  a.timerPausedLeft = null;
}

/** For the "manual" timer mode: the auctioneer starts the countdown. */
export function startTimer(s: AppState, now: number) {
  s.auction.timerEndsAt = now + s.settings.timerAfterBid * 1000;
  s.auction.timerPausedLeft = null;
}

/** Clears every sale but keeps teams, players and retained players. */
export function resetAuction(s: AppState) {
  for (const p of s.players) {
    if (p.status === 'sold' || p.status === 'unsold') {
      p.status = 'available';
      p.teamId = null;
      p.price = null;
    }
  }
  for (const t of s.teams) t.rtmUsed = 0;
  s.log = [];
  s.auction = { ...structuredClone(emptyAuction), eventN: s.auction.eventN + 1 };
}
