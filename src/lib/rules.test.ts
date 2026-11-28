import { describe, expect, it } from 'vitest';
import { createDummyState } from '../data/dummy';
import type { AppState } from '../types';
import { confirmDraw, joinDraw, markSold, markUnsold, nextPlayer, pickPlayer, placeBid, resetAuction, resolveRtm, startAuction, undo } from './auction';
import { atUpperLimit, checkBid, checkJoinDraw, currentPlayer, drawEntrants, leadingBid, limitsBelowBase, maxBidFor, nextBidAmount, orphanedPlayers, releaseOrphans, reserveAfterBuying, stepFor, teamStats } from './rules';

const NOW = 1_000_000;

function freshState(): AppState {
  const s = createDummyState();
  s.settings.order = 'manual';
  return s;
}

/** Puts a specific player on the block. */
function onBlock(s: AppState, playerId: string) {
  pickPlayer(s, playerId, NOW);
}

const catA = (s: AppState) => s.players.find((p) => p.categoryId === 'cat_a' && p.status === 'available' && !p.previousTeamId)!;

describe('new auctions', () => {
  it('scales demo prices to the purse (points)', () => {
    const s = createDummyState('kabaddi', { unit: 'pts', purse: 10000 });
    expect(s.categories[0]!.base).toBe(500);
    expect(s.settings.slabs[0]).toEqual({ upTo: 1000, step: 50 });
    expect(s.players.find((p) => p.status === 'retained')!.price).toBe(500);
    expect(s.players[0]!.role).toBe('Raider');
    expect(s.players[0]!.bowling).toBe('');
  });
});

describe('increments', () => {
  it('uses the slab for the current amount', () => {
    const s = freshState();
    expect(stepFor(0.3, s.settings)).toBe(0.05);
    expect(stepFor(1, s.settings)).toBe(0.1);
    expect(stepFor(2.95, s.settings)).toBe(0.1);
    expect(stepFor(3, s.settings)).toBe(0.25);
  });

  it('uses the category increment when set', () => {
    const s = freshState();
    expect(stepFor(0.5, s.settings, s.categories[0])).toBe(0.1);
  });

  it('first bid is the base price, then goes up by the step', () => {
    const s = freshState();
    const p = catA(s);
    onBlock(s, p.id);
    expect(nextBidAmount(s)).toBe(0.3);
    expect(placeBid(s, 't_rs', NOW)).toEqual({ ok: true, tie: false });
    expect(nextBidAmount(s)).toBe(0.35);
  });
});

describe('who can bid', () => {
  it('blocks the leading team from bidding again', () => {
    const s = freshState();
    onBlock(s, catA(s).id);
    placeBid(s, 't_rs', NOW);
    expect(checkBid(s, 't_rs')).toMatchObject({ ok: false, reason: 'Leading bid' });
    expect(checkBid(s, 't_tt').ok).toBe(true);
  });

  it('keeps enough purse to finish the minimum squad', () => {
    const s = freshState();
    const p = catA(s);
    // Team with 0 players: after buying it still needs 9 players incl. 1 marquee (0.5),
    // 1 more A (0.3) and 3 B (0.2 each) = 0.5 + 0.3 + 0.6 + 4 x 0.1 = 1.8
    expect(reserveAfterBuying(s, 't_wx', p)).toBe(1.8);
    expect(maxBidFor(s, 't_wx', p)).toBe(8.2);
  });

  it('blocks a bid above what the team can afford', () => {
    const s = freshState();
    const p = catA(s);
    // Give Mighty Mavericks 9 cheap players worth 9.5 so only 0.5 is left.
    s.players
      .filter((x) => x.status === 'available' && x.id !== p.id)
      .slice(0, 9)
      .forEach((x, i) => Object.assign(x, { status: 'sold', teamId: 't_mm', price: i === 0 ? 9.5 : 0 }));
    const stats = teamStats(s, 't_mm');
    expect(stats.purseLeft).toBe(0.5);
    onBlock(s, p.id);
    placeBid(s, 't_rs', NOW); // 0.30
    placeBid(s, 't_tt', NOW); // 0.35
    placeBid(s, 't_rs', NOW); // 0.40
    placeBid(s, 't_tt', NOW); // 0.45
    placeBid(s, 't_rs', NOW); // 0.50
    expect(checkBid(s, 't_mm').ok).toBe(false);
  });

  it('blocks a full squad and a full category', () => {
    const s = freshState();
    const marquee = s.players.filter((p) => p.categoryId === 'cat_m' && p.status === 'available');
    Object.assign(marquee[0]!, { status: 'sold', teamId: 't_wx', price: 0.5 });
    onBlock(s, marquee[1]!.id);
    expect(checkBid(s, 't_wx')).toMatchObject({ ok: false, reason: 'Marquee full' });

    s.players.filter((p) => p.status === 'available' && p.id !== marquee[1]!.id).slice(0, 12)
      .forEach((p) => Object.assign(p, { status: 'sold', teamId: 't_gg', price: 0.1 }));
    expect(checkBid(s, 't_gg')).toMatchObject({ ok: false, reason: 'Squad full' });
  });

  it('stops at the category max price', () => {
    const s = freshState();
    s.categories[1]!.maxPrice = 0.35;
    onBlock(s, catA(s).id);
    placeBid(s, 't_rs', NOW);
    placeBid(s, 't_tt', NOW);
    expect(checkBid(s, 't_rs')).toMatchObject({ ok: false, reason: 'Upper limit reached' });
  });

  it('ignores an upper limit below the base price (limits left in Crore after switching to points)', () => {
    const s = freshState();
    s.settings.unit = 'pts';
    s.settings.purse = 20000;
    for (const c of s.categories) Object.assign(c, { base: 500, increment: 500 });
    s.categories[1]!.maxPrice = 1;
    onBlock(s, catA(s).id);
    expect(limitsBelowBase(s).map((c) => c.id)).toContain(s.categories[1]!.id);
    expect(checkBid(s, 't_rs')).toMatchObject({ ok: true, amount: 500 });
    placeBid(s, 't_rs', NOW);
    expect(checkBid(s, 't_tt')).toMatchObject({ ok: true, amount: 1000 });
  });
});

/** A lakh-based local auction: 10 L upper limit, bids go up 1 L at a time. */
function lakhAuction(): AppState {
  const s = freshState();
  s.settings.unit = 'L';
  s.settings.purse = 100;
  s.settings.maxPlayerPrice = 10;
  const a = s.categories[1]!;
  a.base = 1;
  a.increment = 1;
  onBlock(s, catA(s).id);
  return s;
}

describe('upper limit lucky draw', () => {
  it('three owners bid 1 L to 10 L; at the limit the earlier bidders join a lucky draw', () => {
    const s = lakhAuction();
    const order = ['t_wx', 't_gg', 't_bb'];
    for (let i = 0; i < 10; i++) expect(placeBid(s, order[i % 3]!, NOW + i).ok).toBe(true);
    expect(leadingBid(s)).toMatchObject({ teamId: 't_wx', amount: 10 }); // WX said 10 L first
    expect(atUpperLimit(s)).toBe(true);

    // Nobody can go above 10 L
    expect(checkBid(s, 't_gg')).toMatchObject({ ok: false, reason: 'Upper limit reached' });
    // Super Kings never bid on this player, so it cannot enter the draw
    expect(checkJoinDraw(s, 't_sk')).toMatchObject({ ok: false, reason: 'Did not bid' });
    // GG and BB say "yes, we want him at 10 L"
    expect(joinDraw(s, 't_gg', NOW + 20).ok).toBe(true);
    expect(joinDraw(s, 't_bb', NOW + 21).ok).toBe(true);
    expect(joinDraw(s, 't_bb', NOW + 22).ok).toBe(false); // already in
    expect(drawEntrants(s)).toEqual(['t_wx', 't_gg', 't_bb']);

    markSold(s, NOW + 30);
    expect(s.auction.phase).toBe('draw');
    const d = s.auction.draw!;
    expect(d).toMatchObject({ amount: 10, teamIds: ['t_wx', 't_gg', 't_bb'] });
    expect(d.teamIds).toContain(d.winnerId);

    confirmDraw(s, NOW + 9000);
    expect(currentPlayer(s)).toMatchObject({ status: 'sold', teamId: d.winnerId, price: 10 });
    expect(s.log.at(-1)).toMatchObject({ type: 'draw', amount: 10, entrants: ['t_wx', 't_gg', 't_bb'] });
    expect(teamStats(s, d.winnerId).purseLeft).toBeLessThanOrEqual(90);
  });

  it('if nobody else wants him at the limit, the team that reached it gets him', () => {
    const s = lakhAuction();
    for (let i = 0; i < 10; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i);
    markSold(s, NOW + 20);
    expect(s.auction.phase).toBe('sold');
    expect(currentPlayer(s)).toMatchObject({ teamId: 't_gg', price: 10 });
  });

  it('a step that would jump past the limit stops at the limit', () => {
    const s = lakhAuction();
    s.settings.maxPlayerPrice = 9.5;
    for (let i = 0; i < 9; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i); // up to 9 L
    expect(nextBidAmount(s)).toBe(9.5);
    placeBid(s, 't_gg', NOW + 10);
    expect(atUpperLimit(s)).toBe(true);
  });

  it('a category limit overrides the auction limit', () => {
    const s = lakhAuction();
    s.categories[1]!.maxPrice = 5;
    for (let i = 0; i < 5; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i);
    expect(atUpperLimit(s)).toBe(true);
  });

  it('no draw when the lucky draw option is off', () => {
    const s = lakhAuction();
    s.settings.tieDraw = false;
    for (let i = 0; i < 10; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i);
    expect(checkJoinDraw(s, 't_wx').ok).toBe(false);
    markSold(s, NOW + 20);
    expect(s.auction.phase).toBe('sold');
  });

  it('organiser can let any team join the draw', () => {
    const s = lakhAuction();
    s.settings.drawEntry = 'any';
    for (let i = 0; i < 10; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i);
    expect(joinDraw(s, 't_sk', NOW + 20).ok).toBe(true); // never bid, still allowed
  });

  it('undo cancels the draw', () => {
    const s = lakhAuction();
    for (let i = 0; i < 10; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i);
    joinDraw(s, 't_wx', NOW + 20);
    markSold(s, NOW + 30);
    undo(s, NOW + 31);
    expect(s.auction.phase).toBe('bidding');
    expect(s.auction.draw).toBeNull();
    expect(drawEntrants(s)).toEqual(['t_gg', 't_wx']);
  });
});

describe('auction flow', () => {
  it('sells to the leading team and charges its purse', () => {
    const s = freshState();
    const p = catA(s);
    onBlock(s, p.id);
    placeBid(s, 't_wx', NOW);
    placeBid(s, 't_gg', NOW);
    markSold(s, NOW);
    expect(s.auction.phase).toBe('sold');
    expect(p.id).toBe(s.log[0]!.playerId);
    expect(s.players.find((x) => x.id === p.id)).toMatchObject({ status: 'sold', teamId: 't_gg', price: 0.35 });
    expect(teamStats(s, 't_gg').purseLeft).toBe(9.35);
  });

  it('undo reverts a sale and then the last bid', () => {
    const s = freshState();
    const p = catA(s);
    onBlock(s, p.id);
    placeBid(s, 't_wx', NOW);
    placeBid(s, 't_gg', NOW);
    markSold(s, NOW);
    undo(s, NOW);
    expect(s.players.find((x) => x.id === p.id)!.status).toBe('available');
    expect(s.log).toHaveLength(0);
    expect(s.auction.phase).toBe('bidding');
    undo(s, NOW);
    expect(s.auction.bids).toHaveLength(1);
    expect(nextBidAmount(s)).toBe(0.35);
  });

  it('offers Right to Match to the previous team', () => {
    const s = freshState();
    const p = s.players.find((x) => x.previousTeamId && x.status === 'available' && x.categoryId === 'cat_b')!;
    const prev = p.previousTeamId!;
    const other = s.teams.find((t) => t.id !== prev)!.id;
    onBlock(s, p.id);
    placeBid(s, other, NOW);
    markSold(s, NOW);
    expect(s.auction.phase).toBe('rtm');
    resolveRtm(s, true, NOW);
    expect(s.players.find((x) => x.id === p.id)).toMatchObject({ teamId: prev, status: 'sold' });
    expect(s.teams.find((t) => t.id === prev)!.rtmUsed).toBe(1);
  });

  it('runs unsold players again in round 2', () => {
    const s = createDummyState();
    s.players.forEach((p) => { if (p.status === 'available') p.status = 'hold'; });
    const [a, b] = s.players.filter((p) => p.status === 'hold').slice(0, 2);
    a!.status = 'available';
    b!.status = 'available';
    startAuction(s, NOW);
    markUnsold(s, NOW);
    nextPlayer(s, NOW);
    markUnsold(s, NOW);
    nextPlayer(s, NOW);
    expect(s.auction.round).toBe(2);
    expect(s.auction.status).toBe('live');
    expect(s.auction.currentPlayerId).not.toBeNull();
  });

  it('rejects a bid made on an old price', () => {
    const s = freshState();
    onBlock(s, catA(s).id);
    placeBid(s, 't_wx', NOW, null); // 0.30
    placeBid(s, 't_gg', NOW + 50, 0.3); // 0.35
    // Blue Blasters was still looking at 0.30, two seconds later
    const r = placeBid(s, 't_bb', NOW + 2000, 0.3);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain('Too late');
    expect(s.auction.bids).toHaveLength(2);
  });

  it('two owners tapping at the same moment: the second is told it was too late', () => {
    const s = freshState();
    onBlock(s, catA(s).id);
    placeBid(s, 't_wx', NOW, null); // 0.30
    // GG and BB both tap "bid 0.35" having seen 0.30, 100 ms apart
    expect(placeBid(s, 't_gg', NOW + 1000, 0.3)).toEqual({ ok: true, tie: false });
    const r = placeBid(s, 't_bb', NOW + 1100, 0.3);
    expect(r.ok === false && r.reason).toContain('Gully Gladiators');
    expect(leadingBid(s)).toMatchObject({ teamId: 't_gg', amount: 0.35 });
  });

  it('reset clears the lucky draw and bids too', () => {
    const s = lakhAuction();
    for (let i = 0; i < 10; i++) placeBid(s, i % 2 ? 't_gg' : 't_wx', NOW + i);
    joinDraw(s, 't_wx', NOW + 20);
    markSold(s, NOW + 30);
    resetAuction(s);
    expect(s.auction).toMatchObject({ status: 'idle', bids: [], phase: 'bidding' });
    expect(s.auction.draw ?? null).toBeNull();
  });

  it('reset keeps retained players', () => {
    const s = freshState();
    onBlock(s, catA(s).id);
    placeBid(s, 't_wx', NOW);
    markSold(s, NOW);
    resetAuction(s);
    expect(s.players.filter((p) => p.status === 'sold')).toHaveLength(0);
    expect(s.players.filter((p) => p.status === 'retained')).toHaveLength(6);
    expect(s.log).toHaveLength(0);
  });
});

describe('players left behind by a deleted team', () => {
  it('go back to the pool so they can be retained again', () => {
    const s = freshState();
    const p = s.players.find((x) => x.status === 'available')!;
    Object.assign(p, { status: 'retained', teamId: 't_gone', price: 4000 });
    expect(orphanedPlayers(s).map((x) => x.id)).toEqual([p.id]);
    expect(releaseOrphans(s)).toBe(1);
    expect(p).toMatchObject({ status: 'available', teamId: null, price: null });
    expect(orphanedPlayers(s)).toEqual([]);
  });

  it('leave players of existing teams alone', () => {
    const s = freshState();
    const p = s.players.find((x) => x.status === 'available')!;
    Object.assign(p, { status: 'retained', teamId: s.teams[0]!.id, price: 100 });
    expect(releaseOrphans(s)).toBe(0);
    expect(p.status).toBe('retained');
  });
});
