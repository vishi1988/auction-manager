import { ArrowRight, Gavel, Info, Keyboard, MonitorPlay, Pause, Play, SkipForward, Sparkles, Timer, Trophy, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuctionPath } from '../components/AuctionRoute';
import { EmptyState, PlayerAvatar, TeamBadge, TimerRing, Toast, useCountdown, useToast } from '../components/ui';
import * as A from '../lib/auction';
import { amountShort, money } from '../lib/format';
import { atUpperLimit, basePriceOf, categoryOf, checkBid, checkJoinDraw, currentPlayer, leadingBid, nextBidAmount, rtmCandidate, teamStats, tiedTeams } from '../lib/rules';
import { LuckyDraw, useDrawRevealed } from '../components/LuckyDraw';
import { getState, update, useAppState } from '../store/store';
import type { AppState } from '../types';

const now = () => Date.now();

/** 18:42:10.3 — tenths of a second show who was first. */
const bidTime = (at: number) => {
  const d = new Date(at);
  return d.toLocaleTimeString('en-IN', { hour12: false }) + '.' + Math.floor(d.getMilliseconds() / 100);
};


export function Console() {
  const state = useAppState();
  const { auction, settings, teams } = state;
  const [toast, showToast] = useToast();
  const path = useAuctionPath();
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  const tied_ = tiedTeams(state);
  const secs = useCountdown(auction.timerEndsAt, auction.timerPausedLeft);
  const total = state.players.filter((p) => p.status !== 'retained' && p.status !== 'hold').length;
  const done = state.players.filter((p) => p.status === 'sold' && state.log.some((l) => l.playerId === p.id)).length;
  const unsold = state.players.filter((p) => p.status === 'unsold').length;

  const drawRevealed = useDrawRevealed(auction.draw);

  /** A team bids; at the category max price the same tap enters it in the lucky draw. */
  const bid = (teamId: string) => {
    const name = getState().teams.find((t) => t.id === teamId)?.name ?? '';
    let result = null as A.BidResult | null;
    update((s) => {
      result = checkJoinDraw(s, teamId).ok ? A.joinDraw(s, teamId, now()) : A.placeBid(s, teamId, now());
    });
    const r = result as A.BidResult | null;
    if (r && !r.ok) showToast(name + ': ' + r.reason);
    else if (r?.tie) showToast(name + ' joined the lucky draw');
  };

  // Keyboard shortcuts: team key = bid, S = sold, U = unsold, Z = undo, N = next.
  useEffect(() => {
    if (!settings.keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, select, textarea')) return;
      const key = e.key.toUpperCase();
      const s = getState();
      const phase = s.auction.phase;
      if (key === 'Z') update((d) => A.undo(d, now()));
      else if (key === 'S' && phase === 'bidding') update((d) => A.markSold(d, now()));
      else if (key === 'U' && phase === 'bidding') update((d) => A.markUnsold(d, now()));
      else if ((key === 'N' || key === 'S') && (phase === 'sold' || phase === 'unsold')) update((d) => A.nextPlayer(d, now()));
      else if (key === 'S' && phase === 'draw' && s.auction.draw && Date.now() - s.auction.draw.startedAt >= A.DRAW_MS) update((d) => A.confirmDraw(d, now()));
      else {
        const team = s.teams.find((t) => t.key === key);
        if (team) bid(team.id);
        else return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.keyboard]);

  if (auction.status === 'idle') return <StartScreen state={state} />;

  return (
    <main className="page" style={{ gap: 18 }}>
      <div className="card" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: '12px 18px', gap: 16 }}>
        {auction.status === 'live' ? <span className="pill pill-red"><span className="live-dot" style={{ background: 'currentColor' }} />LIVE</span>
          : auction.status === 'paused' ? <span className="pill pill-cream">PAUSED</span> : <span className="pill pill-green">DONE</span>}
        <span style={{ fontSize: 14 }}>
          <strong>Round {auction.round}</strong>
          {player && <span className="muted"> · {categoryOf(state, player).name}</span>}
          <span className="muted"> · Player {auction.shown} of {total}</span>
        </span>
        <div className="progress"><div style={{ width: (total ? (100 * (done + unsold)) / total : 0) + '%' }} /></div>
        <span className="muted hide-mobile" style={{ fontSize: 13 }}><strong style={{ color: 'var(--success)' }}>{done}</strong> sold · <strong style={{ color: 'var(--danger)' }}>{unsold}</strong> unsold</span>
        {settings.keyboard && (
          <details className="menu hide-mobile">
            <summary className="btn btn-sm btn-ghost"><Keyboard size={15} />Shortcuts</summary>
            <div className="menu-list" style={{ padding: 12, gap: 8, fontSize: 13, minWidth: 260 }}>
              {teams.filter((t) => t.key).map((t) => (
                <span key={t.id} className="row" style={{ flexWrap: 'nowrap' }}><span className="kbd">{t.key}</span>Bid for {t.name}</span>
              ))}
              <span className="row"><span className="kbd">S</span>Sold (or next player)</span>
              <span className="row"><span className="kbd">U</span>Unsold</span>
              <span className="row"><span className="kbd">Z</span>Undo</span>
              <span className="row"><span className="kbd">N</span>Next player</span>
            </div>
          </details>
        )}
        {auction.status === 'live' && <button className="btn btn-sm" onClick={() => update((s) => A.pauseAuction(s, now()))}><Pause size={15} />Pause</button>}
        {auction.status === 'paused' && <button className="btn btn-sm btn-primary" onClick={() => update((s) => A.resumeAuction(s, now()))}><Play size={15} />Resume</button>}
        <a className="btn btn-sm" href={path('/live')} target="_blank" rel="noreferrer"><MonitorPlay size={15} /><span className="hide-mobile">Live screen</span></a>
      </div>

      {auction.status === 'paused' && <div className="banner banner-cream"><Pause size={18} /><span><strong>Paused.</strong> Bids are blocked and the timer is stopped until you resume.</span></div>}

      {auction.status === 'finished' && (
        <div className="card">
          <EmptyState
            icon={<Trophy size={30} />}
            title="Auction complete!"
            action={<Link className="btn btn-primary" to={path('/results')}><Trophy size={16} />See results</Link>}
          >
            {unsold ? `${unsold} players are unsold${settings.reauction ? '' : ' (re-auction is off in Settings)'}.` : 'Every player has been auctioned.'}
          </EmptyState>
        </div>
      )}

      {!player && auction.status !== 'finished' && <ManualPicker state={state} />}

      {player && (
        <div className="console">
          <section className="card player-card" aria-label="Current player">
            <PlayerAvatar player={player} className="player-photo" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="pill" style={{ alignSelf: 'flex-start', background: categoryOf(state, player).color, color: '#fff' }}>
                {categoryOf(state, player).name}
              </span>
              <span className="display" style={{ fontSize: 36, lineHeight: 1 }}>{player.name}</span>
              <span className="muted">#{player.no} · {player.role}{player.tag ? ' · ' + player.tag : ''}</span>
            </div>
            <div className="grid-2 player-extra" style={{ gap: 12 }}>
              {player.batting && <div className="stat">Batting<b style={{ fontSize: 15 }}>{player.batting}</b></div>}
              {player.bowling && <div className="stat">Bowling<b style={{ fontSize: 15 }}>{player.bowling}</b></div>}
              <div className="stat">Base price<b style={{ fontSize: 15 }}>{money(basePriceOf(state, player), settings.unit)}</b></div>
              <div className="stat">Age<b style={{ fontSize: 15 }}>{player.age ?? '—'}</b></div>
            </div>
            {settings.rtm && player.previousTeamId && (
              <div className="banner banner-cream player-extra">
                RTM: {teams.find((t) => t.id === player.previousTeamId)?.name} can match the final price.
              </div>
            )}
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }} aria-label="Bidding">
            <BidBox state={state} secs={secs} />

            {auction.phase === 'bidding' && (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14.5 }}>Tap the team that raised its paddle</strong>
                  <span className="hint">Dashed = can’t bid (budget or squad limit)</span>
                </div>
                <div className="team-grid">
                  {teams.map((t) => {
                    const join = checkJoinDraw(state, t.id);
                    const check = join.ok ? join : checkBid(state, t.id);
                    const st = teamStats(state, t.id);
                    const leading = lead?.teamId === t.id;
                    const tied = tied_.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        className={'team-btn' + (leading || tied ? ' leading' : join.ok ? ' join' : !check.ok ? ' blocked' : '')}
                        style={leading || tied ? { background: t.color, borderColor: t.color } : undefined}
                        disabled={!check.ok}
                        onClick={() => bid(t.id)}
                      >
                        <span className="top">
                          <TeamBadge team={t} size={32} invert={leading} />
                          <span className="name">{t.name}</span>
                          {settings.keyboard && t.key && <span className="kbd">{t.key}</span>}
                        </span>
                        <span className="meta num">
                          <span>{amountShort(st.purseLeft, settings.unit)} left</span>
                          <span>{st.count}/{settings.maxSquad}</span>
                        </span>
                        <span className="note">{tied ? '✦ In the lucky draw' : join.ok ? '✦ Wants him? Add to draw' : check.reason}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="actions">
              {auction.phase === 'bidding' ? (
                <>
                  <button className="btn btn-sold" disabled={!lead || auction.status !== 'live'} onClick={() => update((s) => A.markSold(s, now()))}>
                    {tied_.length ? 'SOLD · DRAW' : 'SOLD'}
                  </button>
                  <button className="btn btn-unsold" disabled={!!lead || auction.status !== 'live'} title={lead ? 'Undo the bids to mark unsold' : undefined} onClick={() => update((s) => A.markUnsold(s, now()))}>UNSOLD</button>
                </>
              ) : auction.phase === 'draw' ? (
                <button className="btn btn-sold" style={{ gridColumn: 'span 2' }} disabled={!drawRevealed} onClick={() => update((s) => A.confirmDraw(s, now()))}>
                  {drawRevealed ? 'CONFIRM WINNER' : 'DRAWING…'}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ gridColumn: 'span 2' }} disabled={auction.phase === 'rtm'} onClick={() => update((s) => A.nextPlayer(s, now()))}>
                  Next player <ArrowRight size={18} />
                </button>
              )}
              <button className="btn" onClick={() => update((s) => A.undo(s, now()))}><Undo2 size={17} />Undo</button>
              {auction.phase === 'bidding' && settings.timerMode === 'manual' ? (
                <button className="btn skip" onClick={() => update((s) => A.startTimer(s, now()))}><Timer size={17} />Start timer</button>
              ) : (
                <button className="btn skip" disabled={auction.phase !== 'bidding' || !!lead} onClick={() => update((s) => A.skipPlayer(s, now()))}><SkipForward size={17} />Skip</button>
              )}
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="card" style={{ gap: 0, padding: 18 }}>
              <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bid history</h2>
              {auction.bids.slice().reverse().slice(0, 8).map((b, i) => {
                const t = teams.find((x) => x.id === b.teamId);
                return (
                  <div key={b.at + b.teamId} className="list-row" style={{ alignItems: 'center' }}>
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <span className="muted num" style={{ width: 22 }}>#{auction.bids.length - i}</span>
                      <span className="swatch" style={{ background: t?.color }} />
                      <strong>{t?.short}</strong>
                      {b.tie && <span className="pill pill-orange" style={{ fontSize: 10.5, padding: '1px 7px' }}>TIE</span>}
                    </span>
                    <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                      <span className="muted num" style={{ fontSize: 11.5 }}>{bidTime(b.at)}</span>
                      <strong className="num">{amountShort(b.amount, settings.unit)}</strong>
                    </span>
                  </div>
                );
              })}
              {!auction.bids.length && <p className="hint">No bids on this player yet.</p>}
            </section>
            <section className="card" style={{ gap: 0, padding: 18 }}>
              <h2 style={{ fontSize: 15, marginBottom: 8 }}>Up next</h2>
              {auction.queue.slice(0, 5).map((id) => {
                const p = state.players.find((x) => x.id === id);
                return p ? (
                  <div key={id} className="list-row">
                    <span><strong>{p.name}</strong><br /><span className="muted">{p.role} · {categoryOf(state, p).name}</span></span>
                    <span className="num">{amountShort(basePriceOf(state, p), settings.unit)}</span>
                  </div>
                ) : null;
              })}
              {!auction.queue.length && <p className="hint">{settings.order === 'manual' ? 'Manual order: pick after this player.' : 'Last player of this round.'}</p>}
            </section>
            <section className="card" style={{ gap: 0, padding: 18 }}>
              <h2 style={{ fontSize: 15, marginBottom: 8 }}>Recent results</h2>
              {state.log.slice(-6).reverse().map((l, i) => {
                const p = state.players.find((x) => x.id === l.playerId);
                return (
                  <div key={i} className="list-row">
                    <span><strong>{p?.name}</strong><br /><span className="muted">{l.type === 'unsold' ? 'Unsold' : teams.find((t) => t.id === l.teamId)?.name + (l.type === 'rtm' ? ' (RTM)' : l.type === 'draw' ? ' (draw)' : '')}</span></span>
                    <span className="num">{l.amount != null ? amountShort(l.amount, settings.unit) : '—'}</span>
                  </div>
                );
              })}
              {!state.log.length && <p className="hint">Nothing sold yet.</p>}
            </section>
          </aside>
        </div>
      )}
      <Toast msg={toast} />
    </main>
  );
}

function BidBox({ state, secs }: { state: AppState; secs: number | null }) {
  const { auction, settings, teams } = state;
  const lead = leadingBid(state);
  const leadTeam = teams.find((t) => t.id === lead?.teamId);
  const player = currentPlayer(state)!;
  const rtmTeam = teams.find((t) => t.id === rtmCandidate(state));
  const amount = lead ? lead.amount : basePriceOf(state, player);
  const tied = tiedTeams(state);
  const atLimit = atUpperLimit(state);

  if (auction.phase === 'sold') {
    const buyer = teams.find((t) => t.id === player.teamId);
    return (
      <div className="bidbox sold">
        <div style={{ flexGrow: 1 }}>
          <div className="display" style={{ fontSize: 64, lineHeight: 0.95 }}>SOLD!</div>
          <div style={{ fontSize: 18 }}>
            {player.name} → <strong>{buyer?.name}</strong> for <strong>{money(player.price, settings.unit)}</strong>
            {state.log.at(-1)?.type === 'rtm' && ' (Right to Match)'}
            {state.log.at(-1)?.type === 'draw' && ' (lucky draw)'}
          </div>
        </div>
      </div>
    );
  }
  if (auction.phase === 'unsold') {
    return (
      <div className="bidbox unsold">
        <div style={{ flexGrow: 1 }}>
          <div className="display" style={{ fontSize: 64, lineHeight: 0.95 }}>UNSOLD</div>
          <div>{player.name} {settings.reauction ? 'comes back in the next round.' : 'goes to the unsold list.'}</div>
        </div>
      </div>
    );
  }
  if (auction.phase === 'draw' && auction.draw) {
    return (
      <div className="bidbox" style={{ justifyContent: 'center', padding: '24px 18px' }}>
        <LuckyDraw draw={auction.draw} teams={teams} unit={settings.unit} dark />
      </div>
    );
  }
  if (auction.phase === 'rtm' && rtmTeam && lead) {
    return (
      <div className="bidbox rtm">
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="bid-label" style={{ color: '#f6ecd9' }}>RIGHT TO MATCH</div>
          <div style={{ fontSize: 18 }}>
            {leadTeam?.name} won at <strong>{money(lead.amount, settings.unit)}</strong>. Does <strong>{rtmTeam.name}</strong> want to match?
          </div>
          <div className="row">
            <button className="btn" onClick={() => update((s) => A.resolveRtm(s, true, now()))}>Yes, {rtmTeam.short} uses RTM</button>
            <button className="btn" style={{ background: 'transparent', color: '#fff' }} onClick={() => update((s) => A.resolveRtm(s, false, now()))}>No, sell to {leadTeam?.short}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bidbox">
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="bid-label">{lead ? 'CURRENT BID' : 'BASE PRICE'}</span>
        <span className="bid-amount num" key={auction.eventN}>
          <span className={auction.lastEvent === 'bid' ? 'a-bump' : undefined} style={{ display: 'inline-block', transformOrigin: 'left bottom' }}>
            {money(amount, settings.unit)}
          </span>
        </span>
        <span className="row" style={{ gap: 10, fontSize: 16 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: leadTeam?.color ?? '#5e6861' }} />
          {leadTeam ? 'Leading: ' + leadTeam.name : 'Waiting for the opening bid'}
        </span>
        {atLimit && (
          <span key={'t' + auction.eventN} className="a-slideIn" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '5px 12px', borderRadius: 999, background: 'rgb(245 179 36 / 0.15)', color: '#f5b324', fontSize: 13, fontWeight: 700 }}>
            <Sparkles size={14} />
            UPPER LIMIT REACHED
            {!settings.tieDraw
              ? ' · SOLD goes to ' + leadTeam?.short
              : tied.length
                ? ' · Lucky draw: ' + [leadTeam?.short, ...tied.map((id) => teams.find((t) => t.id === id)?.short)].join(', ')
                : ' · Other teams can join the lucky draw'}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {settings.timerMode !== 'off' && <TimerRing secs={secs} />}
        {secs === 0 && settings.timerMode !== 'off' ? (
          <span className="a-slideIn" style={{ fontSize: 13, fontWeight: 700, color: '#ff8f84' }}>{lead ? 'Time up · press SOLD' : 'Time up · UNSOLD?'}</span>
        ) : (
          <span style={{ fontSize: 13, color: '#93a3bb' }}>{atLimit ? 'No higher bids' : 'Next bid ' + money(nextBidAmount(state), settings.unit)}</span>
        )}
      </div>
    </div>
  );
}

function StartScreen({ state }: { state: AppState }) {
  const path = useAuctionPath();
  const pool = state.players.filter((p) => p.status === 'available').length;
  const order = { category: 'by category', random: 'in random order', manual: 'picked by you' }[state.settings.order];
  const tips = [
    { icon: <MonitorPlay size={18} />, text: 'Open the Live screen in a second window, drag it to the projector and press F11.' },
    { icon: <Keyboard size={18} />, text: 'Bid with team keys on the keyboard, or tap the team buttons.' },
    { icon: <Undo2 size={18} />, text: 'Made a mistake? Undo works on bids and on SOLD / UNSOLD.' },
  ];
  const blocked = !pool ? 'Add players first.' : state.teams.length < 2 ? 'Add at least 2 teams first.' : '';
  return (
    <main className="page">
      <section className="hero">
        <div style={{ flexGrow: 1, minWidth: 260 }}>
          <div className="eyebrow" style={{ color: '#ffb27a' }}><Gavel size={14} />Auction day</div>
          <h1>Ready when you are</h1>
          <p>
            {pool} players will go under the hammer {order}, across {state.teams.length} teams with{' '}
            {money(state.settings.purse, state.settings.unit)} each.
          </p>
        </div>
        <div className="row">
          <a className="btn" style={{ background: 'transparent', color: '#fff', borderColor: '#34425c' }} href={path('/live')} target="_blank" rel="noreferrer"><MonitorPlay size={16} />Open live screen</a>
          <button className="btn btn-accent btn-lg" disabled={!!blocked} title={blocked} onClick={() => update((s) => A.startAuction(s, now()))}>
            <Play size={18} />Start auction
          </button>
        </div>
      </section>
      {blocked && <div className="banner banner-cream"><Info size={18} />{blocked}</div>}
      <div className="grid-3 stagger">
        {tips.map((t) => (
          <div key={t.text} className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span className="stat-icon tone-blue">{t.icon}</span>
            <span style={{ fontSize: 13.5 }}>{t.text}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

function ManualPicker({ state }: { state: AppState }) {
  const [q, setQ] = useState('');
  const pool = state.players
    .filter((p) => p.status === 'available')
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || String(p.no).includes(q));
  return (
    <section className="card">
      <div className="card-head">
        <h2>Pick the next player</h2>
        <input className="input" style={{ width: 260 }} type="search" placeholder="Search name or number…" aria-label="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {pool.slice(0, 40).map((p) => (
              <tr key={p.id}>
                <td className="num muted">{p.no}</td>
                <td><strong>{p.name}</strong></td>
                <td>{p.role}</td>
                <td>{categoryOf(state, p).name}</td>
                <td className="num">{money(basePriceOf(state, p), state.settings.unit)}</td>
                <td><button className="btn btn-sm btn-primary" onClick={() => update((s) => A.pickPlayer(s, p.id, now()))}>Put on the block</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
