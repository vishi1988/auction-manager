import { Gavel, Trophy, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Celebration } from '../components/live/Celebration';
import { FortuneWheel } from '../components/live/FortuneWheel';
import { CountUpText, LivePhoto, MaskText, cssVars } from '../components/live/Motion';
import { Odometer } from '../components/live/Odometer';
import { SponsorChip, shownSponsors } from '../components/SponsorsEditor';
import { TeamBadge, useCountdown } from '../components/ui';
import { initials, money, r2 } from '../lib/format';
import { sounds } from '../lib/media';
import { atUpperLimit, basePriceOf, categoryOf, currentPlayer, leadingBid, rtmCandidate, teamStats, tiedTeams } from '../lib/rules';
import { useAppState } from '../store/store';
import type { AppState, Player, Team } from '../types';
import '../styles/live.css';

export function Live() {
  const state = useAppState();
  const { auction, settings, teams } = state;
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  const leadTeam = teams.find((t) => t.id === lead?.teamId);
  const secs = useCountdown(auction.timerEndsAt, auction.timerPausedLeft);
  const [soundOn, setSoundOn] = useState(false);
  const e = auction.eventN;
  const isSold = auction.phase === 'sold';
  const buyer = isSold ? teams.find((t) => t.id === player?.teamId) : undefined;
  const pool = state.players.filter((p) => p.status !== 'retained' && p.status !== 'hold').length;
  const cat = player ? categoryOf(state, player) : null;
  const sponsors = shownSponsors(state.sponsors);

  // Sounds follow the console's actions.
  const lastEvent = useRef(e);
  useEffect(() => {
    if (!soundOn || !settings.sound || lastEvent.current === e) return;
    lastEvent.current = e;
    if (auction.lastEvent === 'bid') sounds.bid();
    if (auction.lastEvent === 'sold') sounds.gavel();
    if (auction.lastEvent === 'unsold') sounds.unsold();
  }, [e, auction.lastEvent, soundOn, settings.sound]);
  useEffect(() => {
    if (soundOn && settings.sound && secs != null && secs > 0 && secs <= 5 && auction.phase === 'bidding') sounds.tick();
  }, [secs, soundOn, settings.sound, auction.phase]);

  // The stage is lit in the colour of whoever is winning right now.
  const glow = (buyer ?? leadTeam)?.color ?? cat?.color ?? '#2e5bff';
  const cols = teams.length > 8 ? 2 : 1;

  return (
    <div className="live" data-theme={settings.theme} style={cssVars({ '--glow': glow })}>
      <div className="live-bg" aria-hidden>
        <div className="live-glow" style={{ background: glow }} />
        <div className="live-beam one" />
        <div className="live-beam two" />
        <div className="live-dust" />
      </div>

      <header className="live-head">
        <span className="live-logo">{initials(settings.name) || 'PA'}</span>
        <span className="live-titles">
          <span className="live-title">{settings.name}</span>
          <span className="live-subtitle">
            Player Auction{settings.venue ? ' · ' + settings.venue : ''}
          </span>
        </span>
        {player && cat && (
          <span className="live-progress">
            <span className="live-chip">Round {auction.round}</span>
            <span className="live-chip" style={cssVars({ '--chip': cat.color })} data-cat>{cat.name}</span>
            <span className="live-count num">
              <span>Player <strong>{auction.shown}</strong> / {pool}</span>
              <span className="live-count-bar"><span style={{ width: (pool ? (100 * auction.shown) / pool : 0) + '%' }} /></span>
            </span>
          </span>
        )}
        {settings.sound && !soundOn && (
          <button type="button" className="live-sound" onClick={() => setSoundOn(true)}>
            <Volume2 size={16} />Turn on sound
          </button>
        )}
        {auction.status === 'live' && <span className="live-badge"><span className="live-dot" />LIVE</span>}
        {auction.status === 'paused' && <span className="live-badge paused">PAUSED</span>}
      </header>

      <main className="live-main" style={cssVars({ '--team-cols': cols })}>
        <section className="stage" aria-label="On the block">
          {player && cat ? <PlayerStage state={state} player={player} secs={secs} /> : <Intermission state={state} />}
        </section>

        <aside className="live-teams" aria-label="Teams">
          {teams.map((t) => (
            <TeamRow key={t.id} state={state} team={t} />
          ))}
        </aside>
      </main>

      {sponsors.length > 0 && (
        <div className="sponsor-bar" aria-label="Sponsors">
          <span className="sponsor-bar-label">{sponsors.length === 1 ? 'SPONSOR' : 'SPONSORS'}</span>
          <span className="sponsor-bar-list">
            {sponsors.map((s) => <SponsorChip key={s.id} sponsor={s} />)}
          </span>
        </div>
      )}

      <Ticker state={state} />

      {auction.phase === 'draw' && auction.draw && (
        <div className="live-overlay draw-screen" key={'d' + auction.draw.startedAt}>
          <FortuneWheel draw={auction.draw} teams={teams} unit={settings.unit} />
        </div>
      )}

      {isSold && player && buyer && settings.soldEffect !== 'none' && <SoldScreen key={'s' + e} state={state} player={player} buyer={buyer} />}
    </div>
  );
}

/**
 * The SOLD moment, built like a TV "stinger" (about 3.5 seconds):
 * team-colour panels wipe across, the gavel strikes with a flash and a
 * shockwave, the player card swings in, gold SOLD lettering is revealed,
 * the price counts up and the team slides in. Sparks or foil confetti on top.
 */
function SoldScreen({ state, player, buyer }: { state: AppState; player: Player; buyer: Team }) {
  const { settings, log } = state;
  const cat = categoryOf(state, player);
  const how = log.at(-1)?.type;
  const effect = settings.soldEffect;
  return (
    <>
      <div className="live-overlay sold-screen" style={cssVars({ '--tc': buyer.color, '--cat': cat.color })}>
        <div className="sold-bg" aria-hidden />
        <div className="sold-beam" aria-hidden />

        <div className="sold-scene">
          <div className="sold-card">
            <LivePhoto player={player} className="sold-photo" />
            <span className="sold-card-shine" aria-hidden />
            <span className="sold-card-cat">{cat.name}</span>
          </div>

          <div className="sold-text">
            <span className="sold-kicker">
              <span className="sold-gavel" aria-hidden><Gavel strokeWidth={2} /></span>
              LOT #{player.no}
              {how === 'rtm' ? ' · RIGHT TO MATCH' : how === 'draw' ? ' · LUCKY DRAW' : ''}
            </span>
            <span className="sold-word" aria-label="Sold">
              <span className="sold-word-in">SOLD</span>
            </span>
            <span className="sold-name"><MaskText text={player.name} delay={0.95} step={0.07} /></span>
            <span className="sold-rule" aria-hidden />
            <span className="sold-to">
              <TeamBadge team={buyer} size={58} invert />
              <span className="sold-to-text">
                <small>GOES TO</small>
                <strong>{buyer.name}</strong>
              </span>
            </span>
            <span className="sold-price num">
              <CountUpText value={player.price ?? 0} format={(v) => money(v, settings.unit)} delayMs={1150} durationMs={1300} />
            </span>
          </div>
        </div>

        <div className="sold-flash" aria-hidden />
        <div className="sold-ring" aria-hidden />
        <div className="stinger" aria-hidden>
          <i />
          <i />
          <i />
        </div>
      </div>
      {(effect === 'fireworks' || effect === 'confetti') && (
        <Celebration kind={effect === 'fireworks' ? 'sparks' : 'confetti'} colors={[buyer.color, '#ffffff']} delayMs={560} />
      )}
    </>
  );
}

/** The player on the block: photo, name, stats, rolling bid and the leading team. */
function PlayerStage({ state, player, secs }: { state: AppState; player: Player; secs: number | null }) {
  const { auction, settings, teams } = state;
  const e = auction.eventN;
  const cat = categoryOf(state, player);
  const lead = leadingBid(state);
  const leadTeam = teams.find((t) => t.id === lead?.teamId);
  const isSold = auction.phase === 'sold';
  const isUnsold = auction.phase === 'unsold';
  const buyer = isSold ? teams.find((t) => t.id === player.teamId) : undefined;
  const tied = tiedTeams(state);
  const atLimit = atUpperLimit(state);
  const rtmTeam = auction.phase === 'rtm' ? teams.find((t) => t.id === rtmCandidate(state)) : undefined;
  const bidCount = auction.bids.filter((b) => !b.tie).length;
  const amount = isSold && player.price != null ? player.price : lead ? lead.amount : basePriceOf(state, player);
  const justBid = auction.lastEvent === 'bid' && auction.phase === 'bidding';

  let raise = '';
  if (justBid && lead) {
    const prev = auction.bids.filter((b) => !b.tie).at(-2);
    raise = prev ? '+' + money(r2(lead.amount - prev.amount), settings.unit) : 'Opening bid';
  }

  // The last seconds of the clock, called out like an auctioneer would.
  const timerOn = settings.timerMode !== 'off' && auction.phase === 'bidding' && secs != null;
  const call = timerOn && lead && auction.status === 'live' ? ({ 3: 'Going once', 2: 'Going twice', 1: 'Last call' } as Record<number, string>)[secs!] : undefined;

  const facts = [
    player.role,
    player.batting ? (player.batting === 'Left hand' ? 'Left-hand bat' : 'Right-hand bat') : '',
    player.bowling && player.bowling !== '—' ? player.bowling : '',
    player.age ? player.age + ' yrs' : '',
  ].filter(Boolean);

  return (
    <div className={'stage-player' + (isUnsold ? ' unsold' : '') + (auction.phase === 'bidding' ? ' on-block' : '')} key={player.id} style={cssVars({ '--cat': cat.color })}>
      <span className="stage-wipe" aria-hidden>
        <i />
        <i />
      </span>

      <div className="photo-card">
        <LivePhoto player={player} className="photo" />
        <span className="photo-shine" aria-hidden />
        <span className="photo-no num">#{player.no}</span>
        <span className="photo-cat">{cat.name}</span>
        {player.tag && <span className="photo-tag">{player.tag}</span>}
      </div>

      <div className="stage-info">
        <span className="eyebrow eyebrow-line">ON THE BLOCK</span>
        <h1 className="p-name">
          <MaskText text={player.name} delay={0.4} step={0.08} />
        </h1>
        <div className="facts">
          {facts.map((f, i) => (
            <span key={f} className="fact" style={{ animationDelay: 0.7 + i * 0.06 + 's' }}>{f}</span>
          ))}
          <span className="fact base" style={{ animationDelay: 0.7 + facts.length * 0.06 + 's' }}>
            Base {money(basePriceOf(state, player), settings.unit)}
          </span>
        </div>

        <div className="bid-row">
          <div className="bid-col">
            <span className="eyebrow">
              {isSold ? 'SOLD FOR' : lead ? 'CURRENT BID' : 'BASE PRICE'}
              {lead && !isSold && <span className="bid-no num">BID {bidCount}</span>}
            </span>
            <span className="bid-amt">
              <AmountText text={money(amount, settings.unit)} />
              {justBid && <span key={'st' + e} className="bid-streak" aria-hidden />}
            </span>
            {raise && <span key={'r' + e} className="raise">{raise}</span>}
          </div>
          {timerOn && <BigTimer secs={secs!} total={lead ? settings.timerAfterBid : settings.timerStart} />}
        </div>

        <div className="call-slot" aria-live="polite">
          {call && <MaskText key={call} text={call} className="call" step={0.05} />}
        </div>

        {isUnsold ? (
          <div className="lead lead-none">No bids · {settings.reauction ? 'back in the next round' : 'goes to the unsold list'}</div>
        ) : buyer || leadTeam ? (
          <LeadBanner team={(buyer ?? leadTeam)!} label={isSold ? 'BOUGHT BY' : 'LEADING'} pulseKey={e} />
        ) : (
          <div className="lead lead-wait">
            <span className="live-dot" />Waiting for the opening bid
          </div>
        )}

        {rtmTeam && lead && (
          <div className="flag flag-rtm" key={'rtm' + e}>
            RIGHT TO MATCH · Will {rtmTeam.name} match {money(lead.amount, settings.unit)}?
          </div>
        )}
        {atLimit && auction.phase === 'bidding' && (
          <div className="flag flag-limit" key={'lim' + e}>
            UPPER LIMIT REACHED
            {settings.tieDraw &&
              (tied.length > 0
                ? ' · Lucky draw: ' + [leadTeam?.short, ...tied.map((id) => teams.find((t) => t.id === id)?.short)].join(', ')
                : ' · Other teams can join the lucky draw')}
          </div>
        )}
      </div>

      {isUnsold && settings.soldEffect !== 'none' && (
        <div className="unsold-band" key={'u' + e}>
          <span className="unsold-band-bar" aria-hidden />
          <MaskText text="UNSOLD" delay={0.2} className="unsold-word" />
        </div>
      )}
    </div>
  );
}

/** "₹0.80 Cr" as rolling digits with a smaller unit, the way TV graphics show prices. */
function AmountText({ text }: { text: string }) {
  const cut = text.lastIndexOf(' ');
  if (cut < 0) return <Odometer text={text} />;
  return (
    <>
      <Odometer text={text.slice(0, cut)} />
      <span className="bid-unit">{text.slice(cut + 1)}</span>
    </>
  );
}

/** Team that holds the bid. Wipes in when a new team takes the lead; a light passes over it on every bid. */
function LeadBanner({ team, label, pulseKey }: { team: Team; label: string; pulseKey: number }) {
  return (
    <div className="lead lead-team" key={team.id + label} style={cssVars({ '--tc': team.color })}>
      <span className="lead-sweep" key={pulseKey} aria-hidden />
      <span className="lead-badge">
        <TeamBadge team={team} size={60} invert />
      </span>
      <span className="lead-text">
        <small>{label}</small>
        <strong>{team.name}</strong>
      </span>
      {team.owner && <span className="lead-owner">Owner<br /><strong>{team.owner}</strong></span>}
    </div>
  );
}

function BigTimer({ secs, total }: { secs: number; total: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, secs / Math.max(1, total)));
  const hot = secs <= 5;
  return (
    <div className={'big-timer' + (hot ? ' hot' : '')} role="timer" aria-label={secs + ' seconds left'}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="track" />
        <circle cx="50" cy="50" r={r} className="arc" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <span className="secs-wrap">
        <span key={secs} className="secs num">{secs}</span>
        <small>SEC</small>
      </span>
    </div>
  );
}

/** One team in the side column: purse rolls down after a buy, squad slots fill up. */
function TeamRow({ state, team }: { state: AppState; team: Team }) {
  const { auction, settings } = state;
  const e = auction.eventN;
  const st = teamStats(state, team.id);
  const lead = leadingBid(state);
  const player = currentPlayer(state);
  const leading = auction.phase === 'bidding' && lead?.teamId === team.id;
  const tied = auction.phase === 'bidding' && tiedTeams(state).includes(team.id);
  const won = auction.phase === 'sold' && player?.teamId === team.id;
  const pct = Math.max(0, Math.min(100, (100 * st.purseLeft) / Math.max(1, settings.purse)));
  const slots = Math.min(settings.maxSquad, 24);
  return (
    <div className={'team-row' + (leading || tied ? ' leading' : '') + (won ? ' won' : '')} style={cssVars({ '--tc': team.color })}>
      {(leading || won) && <span className="team-sweep" key={e} aria-hidden />}
      <TeamBadge team={team} size={40} />
      <span className="team-main">
        <span className="team-top">
          <span className="team-name">{team.name}</span>
          {leading && <span className="team-pill">BID</span>}
          {tied && !leading && <span className="team-pill draw">DRAW</span>}
          {won && <span className="team-pill won">BOUGHT</span>}
        </span>
        <span className="team-bar"><span style={{ width: pct + '%' }} className={pct < 20 ? 'low' : undefined} /></span>
        <span className="team-slots" aria-label={`${st.count} of ${settings.maxSquad} players`}>
          {Array.from({ length: slots }, (_, i) => (
            <i key={i} className={i < st.count ? 'on' : undefined} />
          ))}
        </span>
      </span>
      <span className="team-purse">
        <Odometer text={money(st.purseLeft, settings.unit)} />
        <small className="num">{st.count}/{settings.maxSquad} players</small>
      </span>
    </div>
  );
}

/** Between players, before the start and at the end: the story so far. */
function Intermission({ state }: { state: AppState }) {
  const { auction, settings, teams, log, players } = state;
  const sales = log.filter((l) => l.type !== 'unsold' && l.amount != null);
  const spent = r2(sales.reduce((s, l) => s + l.amount!, 0));
  const unsold = players.filter((p) => p.status === 'unsold').length;
  const top = [...sales].sort((a, b) => b.amount! - a.amount!).slice(0, 3);
  const richest = [...teams].sort((a, b) => teamStats(state, b.id).purseLeft - teamStats(state, a.id).purseLeft)[0];
  const pool = players.filter((p) => p.status === 'available').length;

  const heading = auction.status === 'finished' ? 'AUCTION COMPLETE' : auction.status === 'idle' ? 'STARTING SOON' : 'NEXT PLAYER COMING UP';
  return (
    <div className="intermission">
      <span className="eyebrow eyebrow-line">{heading}</span>
      <h1 className="int-title"><MaskText text={settings.name} delay={0.2} step={0.08} /></h1>
      {auction.status === 'idle' ? (
        <p className="int-sub">
          {teams.length} teams · {pool} players · {money(settings.purse, settings.unit)} purse each
          {settings.date ? ' · ' + new Date(settings.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : ''}
        </p>
      ) : (
        <div className="int-stats">
          <span className="int-stat"><b className="num">{sales.length}</b>sold</span>
          <span className="int-stat"><b className="num">{unsold}</b>unsold</span>
          <span className="int-stat"><b className="num">{money(spent, settings.unit)}</b>spent</span>
          {richest && auction.status !== 'finished' && (
            <span className="int-stat"><b>{richest.short}</b>most purse left</span>
          )}
        </div>
      )}
      {top.length > 0 && (
        <div className="int-top">
          <span className="eyebrow"><Trophy size={14} /> TOP BUYS</span>
          {top.map((l, i) => {
            const p = players.find((x) => x.id === l.playerId);
            const t = teams.find((x) => x.id === l.teamId);
            return p && t ? (
              <div key={l.playerId} className="int-buy" style={cssVars({ '--tc': t.color, animationDelay: 0.5 + i * 0.1 + 's' })}>
                <span className="int-rank num">{i + 1}</span>
                <LivePhoto player={p} className="int-photo" />
                <span className="int-who"><strong>{p.name}</strong><small>{t.name}</small></span>
                <span className="int-price num">{money(l.amount, settings.unit)}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

/** Bottom strip: running totals on the left, recent sales scrolling past. */
function Ticker({ state }: { state: AppState }) {
  const { log, players, teams, settings } = state;
  const recent = log.slice(-12).reverse();
  const sales = log.filter((l) => l.type !== 'unsold' && l.amount != null);
  const spent = r2(sales.reduce((s, l) => s + l.amount!, 0));
  const items = recent.map((l) => {
    const p = players.find((x) => x.id === l.playerId);
    const t = teams.find((x) => x.id === l.teamId);
    return (
      <span key={l.at + l.playerId} className="tick-item" style={cssVars({ '--tc': t?.color ?? '#64748b' })}>
        <i />
        <strong>{p?.name}</strong>
        {l.type === 'unsold' ? <em>Unsold</em> : <>{t?.short}{l.type === 'draw' ? ' (draw)' : l.type === 'rtm' ? ' (RTM)' : ''} · <b className="num">{money(l.amount, settings.unit)}</b></>}
      </span>
    );
  });
  return (
    <footer className="ticker">
      <span className="tick-label">LIVE FEED</span>
      <span className="tick-total num">
        <b>{sales.length}</b> sold · <b>{money(spent, settings.unit)}</b> spent
      </span>
      <div className="tick-track">
        {items.length ? (
          <div className="tick-move" key={log.length} style={{ animationDuration: Math.max(24, items.length * 7) + 's' }}>
            {items}
            <span aria-hidden className="tick-dup">{items}</span>
          </div>
        ) : (
          <span className="tick-empty">No sales yet. The first player is coming up.</span>
        )}
      </div>
    </footer>
  );
}
