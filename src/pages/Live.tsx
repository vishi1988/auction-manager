import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LuckyDraw } from '../components/LuckyDraw';
import { PlayerAvatar, TeamBadge, TimerRing, useCountdown } from '../components/ui';
import { money, r2 } from '../lib/format';
import { sounds } from '../lib/media';
import { atUpperLimit, basePriceOf, categoryOf, currentPlayer, leadingBid, teamStats, tiedTeams } from '../lib/rules';
import { useAppState } from '../store/store';

const RAY_COLORS = ['#F5B324', '#FFFFFF', '#6D93FF'];

export function Live() {
  const state = useAppState();
  const { auction, settings, teams, log } = state;
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  const leadTeam = teams.find((t) => t.id === lead?.teamId);
  const tied = tiedTeams(state);
  const atLimit = atUpperLimit(state);
  const secs = useCountdown(auction.timerEndsAt, auction.timerPausedLeft);
  const [soundOn, setSoundOn] = useState(false);
  const total = state.players.filter((p) => p.status !== 'retained' && p.status !== 'hold').length;
  const e = auction.eventN;
  const isSold = auction.phase === 'sold';
  const isUnsold = auction.phase === 'unsold';
  const buyer = teams.find((t) => t.id === player?.teamId);

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

  let chip = '';
  if (auction.lastEvent === 'bid' && lead && player) {
    const prev = auction.bids.at(-2);
    chip = prev ? '+ ' + money(r2(lead.amount - prev.amount), settings.unit) : 'Opening bid';
  }
  const topBuy = log.filter((l) => l.amount != null).sort((a, b) => b.amount! - a.amount!)[0];

  return (
    <div className="live" data-theme={settings.theme}>
      <header className="live-head">
        <span className="logo" style={{ width: 44, height: 44, fontSize: 20 }}>{settings.name.slice(0, 2).toUpperCase()}</span>
        <span className="live-title">{settings.name} · Player Auction</span>
        {player && (
          <span style={{ fontSize: 16, color: 'var(--fg-3)' }}>
            Round {auction.round} · {categoryOf(state, player).name} · Player {auction.shown} / {total}
          </span>
        )}
        {settings.sound && !soundOn && (
          <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--fg-2)', borderColor: 'var(--line-d)' }} onClick={() => setSoundOn(true)}>
            Turn on sound
          </button>
        )}
        {auction.status === 'live' && <span className="live-badge"><span className="live-dot" />LIVE</span>}
        {auction.status === 'paused' && <span className="live-badge" style={{ background: 'var(--fg-3)' }}>PAUSED</span>}
      </header>

      <div className="live-main">
        <section aria-label="On the block" className={'block' + (isSold && settings.soldEffect !== 'none' ? ' a-shake' : '')} key={'b' + (isSold ? e : 0)}>
          {!player ? (
            <div className="block-inner" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <span className="cap">{auction.status === 'finished' ? 'AUCTION COMPLETE' : auction.status === 'idle' ? 'STARTING SOON' : 'NEXT PLAYER COMING UP'}</span>
              <span className="block-name">{settings.name}</span>
              {auction.status === 'finished' && topBuy && (
                <span style={{ fontSize: 20, color: 'var(--fg-2)' }}>
                  Top buy: {state.players.find((p) => p.id === topBuy.playerId)?.name} · {money(topBuy.amount, settings.unit)}
                </span>
              )}
            </div>
          ) : (
            <div className="block-inner a-cardIn" key={player.id}>
              <div className={isUnsold ? 'a-dim' : undefined} style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
                <PlayerAvatar player={player} className="block-photo a-photoIn" />
                <div className="a-riseIn" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <span className="cap">ON THE BLOCK · #{player.no}</span>
                  <span className="block-name">{player.name}</span>
                  <span style={{ fontSize: 18, color: 'var(--fg-2)' }}>
                    {player.role}
                    {player.batting ? ' · ' + (player.batting === 'Left hand' ? 'LHB' : 'RHB') : ''}
                    {player.bowling && player.bowling !== '—' ? ' · ' + player.bowling : ''}
                  </span>
                  <span style={{ fontSize: 16, color: 'var(--fg-3)' }}>
                    {categoryOf(state, player).name} · Base {money(basePriceOf(state, player), settings.unit)}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--line-d)', paddingTop: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="cap">{lead ? 'CURRENT BID' : 'BASE PRICE'}</span>
                  <span key={e} className={'block-bid num' + (auction.lastEvent === 'bid' ? ' a-bump' : '')}>
                    {money(lead ? lead.amount : basePriceOf(state, player), settings.unit)}
                  </span>
                  {chip && auction.phase === 'bidding' && <span key={'c' + e} className="chip-float a-chip">{chip}</span>}
                </div>
                {settings.timerMode !== 'off' && auction.phase === 'bidding' && <TimerRing secs={secs} />}
              </div>

              {leadTeam ? (
                <div key={'l' + leadTeam.id + e} className="lead-banner a-slideIn" style={{ background: leadTeam.color }}>
                  <TeamBadge team={leadTeam} size={48} invert />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, letterSpacing: '0.12em', opacity: 0.85 }}>{isSold ? 'BOUGHT BY' : 'LEADING'}</span>
                    <span className="display" style={{ fontSize: 30, lineHeight: 1, textTransform: 'uppercase' }}>{(isSold ? buyer : leadTeam)?.name}</span>
                  </span>
                </div>
              ) : (
                <div className="lead-banner lead-wait">{isUnsold ? 'No bids' : 'Waiting for the opening bid…'}</div>
              )}
              {atLimit && auction.phase === 'bidding' && (
                <div key={'t' + e} className="a-slideIn" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: 'rgb(245 179 36 / 0.14)', color: 'var(--hi)', fontWeight: 700, fontSize: 17 }}>
                  <Sparkles size={20} />
                  UPPER LIMIT REACHED
                  {settings.tieDraw && tied.length > 0 && <> · Lucky draw: {[leadTeam?.short, ...tied.map((id) => teams.find((t) => t.id === id)?.short)].join(', ')}</>}
                </div>
              )}
            </div>
          )}

          {auction.phase === 'draw' && auction.draw && (
            <div key={'d' + e} className="overlay dim a-fadeIn" style={{ padding: 24 }}>
              <LuckyDraw draw={auction.draw} teams={teams} unit={settings.unit} dark />
            </div>
          )}

          {isSold && player && settings.soldEffect !== 'none' && (
            <div key={'s' + e} className="overlay dim a-fadeIn">
              {settings.soldEffect === 'burst' && (
                <div className="rays">
                  {Array.from({ length: 14 }, (_, i) => (
                    <span key={i} style={{ transform: `rotate(${(i * 360) / 14}deg)` }}>
                      <i className="a-ray" style={{ background: RAY_COLORS[i % 3] }} />
                    </span>
                  ))}
                </div>
              )}
              <div className="stamp a-stamp">
                <span className="word">SOLD</span>
                <span style={{ fontSize: 22, color: 'var(--fg)' }}>
                  to <strong>{buyer?.name}</strong> · {money(player.price, settings.unit)}
                </span>
              </div>
            </div>
          )}
          {isUnsold && settings.soldEffect !== 'none' && (
            <div key={'u' + e} className="overlay a-fadeIn">
              <div className="stamp grey a-stamp">
                <span className="word">UNSOLD</span>
                <span style={{ fontSize: 20, color: 'var(--fg-3)' }}>{settings.reauction ? 'Back in the next round' : 'Not sold'}</span>
              </div>
            </div>
          )}
        </section>

        <section aria-label="Teams" className="live-teams">
          {teams.map((t) => {
            const st = teamStats(state, t.id);
            const leading = auction.phase === 'bidding' && lead?.teamId === t.id;
            const won = isSold && player?.teamId === t.id;
            return (
              <div
                key={t.id + (leading || won ? e : '')}
                className={'live-team' + (leading || won ? ' hot' : '') + (leading ? ' a-paddle' : won ? ' a-won' : '')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TeamBadge team={t} size={38} />
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, flexGrow: 1 }}>{t.name}</span>
                  {leading && <span className="pill" style={{ background: 'var(--hi)', color: 'var(--bg)', fontSize: 11 }}>BID</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', letterSpacing: '0.08em' }}>PURSE LEFT</span>
                  <span className={'purse num' + (won ? ' a-purse' : '')}>{money(st.purseLeft, settings.unit)}</span>
                </div>
                <div className="bar">
                  <div style={{ width: Math.max(0, Math.round((100 * st.purseLeft) / settings.purse)) + '%', background: st.purseLeft < settings.purse * 0.2 ? '#D26A4A' : 'var(--good)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--fg-2)' }}>
                  <span>{st.count} / {settings.maxSquad} players</span>
                  <span>{Math.max(0, settings.maxSquad - st.count)} slots</span>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <footer className="ticker">
        <span style={{ fontWeight: 700, letterSpacing: '0.12em', color: 'var(--hi)', fontSize: 13 }}>RECENT</span>
        {log.slice(-4).reverse().map((l, i) => (
          <span key={l.at + l.playerId} className={i === 0 ? 'a-ticker' : undefined}>
            <strong>{state.players.find((p) => p.id === l.playerId)?.name}</strong>{' '}
            <span style={{ color: 'var(--fg-3)' }}>→ {l.type === 'unsold' ? 'Unsold' : teams.find((t) => t.id === l.teamId)?.short}{l.type === 'draw' ? ' (draw)' : ''}</span>{' '}
            {l.amount != null ? money(l.amount, settings.unit) : ''}
          </span>
        ))}
        {!log.length && <span style={{ color: 'var(--fg-3)' }}>No sales yet</span>}
        <span style={{ flexGrow: 1 }} />
        {topBuy && (
          <span style={{ color: 'var(--fg-3)' }}>
            Top buy: <strong style={{ color: 'var(--fg)' }}>
              {state.players.find((p) => p.id === topBuy.playerId)?.name} {money(topBuy.amount, settings.unit)} ({teams.find((t) => t.id === topBuy.teamId)?.short})
            </strong>
          </span>
        )}
      </footer>
    </div>
  );
}
