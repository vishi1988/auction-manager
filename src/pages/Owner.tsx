import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuctionPath } from '../components/AuctionRoute';
import { PlayerAvatar, TeamBadge, Toast, useCountdown, useToast } from '../components/ui';
import { LuckyDraw } from '../components/LuckyDraw';
import { joinDraw, placeBid, type BidResult } from '../lib/auction';
import { money } from '../lib/format';
import { atUpperLimit, basePriceOf, categoryOf, checkBid, checkJoinDraw, currentPlayer, leadingBid, teamStats, tiedTeams } from '../lib/rules';
import { checkOwnerKey, sendOwnerBid, update, useAppState, useAuctionStatus } from '../store/store';

/** Phone screen for a team owner: see the player on the block and tap BID. */
export function Owner() {
  const { teamId } = useParams();
  const state = useAppState();
  const { teams, settings, auction } = state;
  const team = teams.find((t) => t.id === teamId);
  const secs = useCountdown(auction.timerEndsAt, auction.timerPausedLeft);
  const [toast, showToast] = useToast();
  const path = useAuctionPath();
  // On the organiser's own device bids go straight in. On an owner's phone the
  // auction is view-only, so the private link's key is checked and bids are sent
  // to the organiser's app.
  const remote = useAuctionStatus() === 'view-only';
  const key = useSearchParams()[0].get('k') ?? '';
  const [keyState, setKeyState] = useState<'checking' | 'ok' | 'bad'>('checking');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!remote || !teamId) return;
    let live = true;
    setKeyState('checking');
    void checkOwnerKey(teamId, key).then((ok) => live && setKeyState(ok ? 'ok' : 'bad'));
    return () => {
      live = false;
    };
  }, [remote, teamId, key]);

  if (!settings.ownerBidding) {
    return <div className="phone phone-dark"><div className="empty" style={{ color: '#93a3bb' }}>Owner bidding is turned off by the organiser.</div></div>;
  }

  if (remote && (!team || keyState !== 'ok')) {
    return (
      <div className="phone phone-dark" style={{ padding: 20, gap: 12 }}>
        <h1 className="display" style={{ fontSize: 30 }}>{settings.name}</h1>
        <div className="empty" style={{ color: '#93a3bb' }}>
          {team && keyState === 'checking'
            ? 'Checking your link…'
            : 'This is not a valid team link. Ask the organiser for your team’s private bidding link.'}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="phone" style={{ padding: 20, gap: 12 }}>
        <h1 className="display" style={{ fontSize: 32 }}>Which team are you?</h1>
        <p className="muted" style={{ margin: 0 }}>{settings.name}</p>
        {teams.map((t) => (
          <Link key={t.id} to={path('/owner/' + t.id)} className="btn" style={{ justifyContent: 'flex-start', minHeight: 60, gap: 12 }}>
            <TeamBadge team={t} size={36} />
            <span style={{ fontWeight: 600 }}>{t.name}</span>
          </Link>
        ))}
        <p className="hint">Owners get their own private link from the Teams page, so they can bid from their phones.</p>
      </div>
    );
  }

  const st = teamStats(state, team.id);
  const player = currentPlayer(state);
  const lead = leadingBid(state);
  const leadTeam = teams.find((t) => t.id === lead?.teamId);
  const join = checkJoinDraw(state, team.id);
  const check = join.ok ? join : checkBid(state, team.id);
  const youLead = lead?.teamId === team.id;
  const youTied = tiedTeams(state).includes(team.id);
  const phase = auction.phase;
  // The price this owner is looking at when they tap: if someone else got in
  // first, the bid is turned into a tie (same moment) or rejected (too late).
  const seen = lead?.amount ?? null;

  const bid = () => {
    if (remote) {
      if (sending) return;
      setSending(true);
      void sendOwnerBid(team.id, key, join.ok ? 'join' : 'bid', join.ok ? null : seen).then((r) => {
        setSending(false);
        if (!r.ok) showToast(r.reason ?? 'Bid not accepted');
        else if (r.tie) showToast('Tied! You are in the lucky draw');
        else showToast('Bid placed');
      });
      return;
    }
    let result = null as BidResult | null;
    update((s) => {
      result = join.ok ? joinDraw(s, team.id, Date.now()) : placeBid(s, team.id, Date.now(), seen);
    });
    const r = result as BidResult | null;
    if (r && !r.ok) showToast(r.reason);
    else if (r?.tie) showToast('Tied! You are in the lucky draw');
  };

  const status =
    phase === 'sold'
      ? player?.teamId === team.id ? 'You bought this player!' : 'Sold to ' + teams.find((t) => t.id === player?.teamId)?.name
      : phase === 'unsold' ? 'Unsold'
        : phase === 'draw' ? (auction.draw?.teamIds.includes(team.id) ? 'Lucky draw — fingers crossed!' : 'Lucky draw in progress')
          : youTied ? 'You are in the lucky draw'
            : youLead && atUpperLimit(state) ? 'Upper limit reached — you lead'
            : youLead ? 'You are leading' : leadTeam ? leadTeam.name + ' is leading' : 'No bids yet';
  const statusBg = youLead || (phase === 'sold' && player?.teamId === team.id) ? '#12a360' : youTied || phase === 'draw' ? '#b7791f' : leadTeam ? '#e5484d' : '#1c2842';

  return (
    <div className="phone phone-dark" style={{ padding: '16px 18px 22px', gap: 16 }}>
      <header className="row" style={{ flexWrap: 'nowrap', padding: '12px 14px', borderRadius: 12, background: team.color }}>
        <TeamBadge team={team} size={42} invert />
        <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <span className="display" style={{ fontSize: 20, lineHeight: 1, textTransform: 'uppercase' }}>{team.name}</span>
          <span style={{ fontSize: 12, opacity: 0.9 }}>Owner: {team.owner || '—'}</span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span className="display num" style={{ fontSize: 22, lineHeight: 1 }}>{money(st.purseLeft, settings.unit)}</span>
          <span style={{ fontSize: 12, opacity: 0.9 }}>{st.count}/{settings.maxSquad} players</span>
        </span>
      </header>

      {!player ? (
        <div className="empty" style={{ color: '#93a3bb' }}>
          {auction.status === 'finished' ? 'The auction is complete.' : 'Waiting for the next player…'}
        </div>
      ) : (
        <>
          <section key={player.id} className="a-cardIn" style={{ padding: 16, borderRadius: 14, background: '#131c2e', display: 'flex', gap: 14, alignItems: 'center' }}>
            <PlayerAvatar player={player} className="block-photo" />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="cap" style={{ fontSize: 11, color: '#93a3bb' }}>ON THE BLOCK</span>
              <span className="display" style={{ fontSize: 30, lineHeight: 1 }}>{player.name}</span>
              <span style={{ fontSize: 13, color: '#d3dbe8' }}>{player.role} · {categoryOf(state, player).name}</span>
            </span>
          </section>

          <section style={{ padding: 18, borderRadius: 14, background: '#131c2e', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="cap" style={{ fontSize: 12, color: '#93a3bb' }}>{lead ? 'CURRENT BID' : 'BASE PRICE'}</span>
              {secs != null && <span className="display" style={{ fontSize: 22, color: secs <= 5 ? '#ff8f84' : '#f4f6fb' }}>{secs}s</span>}
            </div>
            <span key={auction.eventN} className={'display num' + (auction.lastEvent === 'bid' ? ' a-bump' : '')} style={{ fontSize: 64, lineHeight: 0.9, color: '#f5b324', transformOrigin: 'left center' }}>
              {money(lead ? lead.amount : basePriceOf(state, player), settings.unit)}
            </span>
            <span key={status} className="pill a-slideIn" style={{ alignSelf: 'flex-start', fontSize: 14, background: statusBg, color: '#fff' }}>
              {status}
            </span>
          </section>

          {phase === 'draw' && auction.draw && (
            <section style={{ padding: 18, borderRadius: 14, background: '#131c2e' }}>
              <LuckyDraw draw={auction.draw} teams={teams} unit={settings.unit} dark />
            </section>
          )}

          <span className="spacer" />
          <button className="bid-big" disabled={!check.ok || phase !== 'bidding' || sending} onClick={bid}>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', opacity: 0.8 }}>
              {phase !== 'bidding' ? 'WAIT FOR NEXT PLAYER' : sending ? 'SENDING YOUR BID…' : join.ok ? '✦ YES, I WANT HIM · LUCKY DRAW AT' : check.ok ? 'TAP TO BID' : check.reason.toUpperCase()}
            </span>
            <span className="display num" style={{ fontSize: 44, lineHeight: 1 }}>{money(check.amount, settings.unit)}</span>
          </button>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: '#93a3bb' }}>
            <span>Max you can bid: <strong style={{ color: '#f4f6fb' }}>{money(check.max, settings.unit)}</strong></span>
            <span>Squad: {st.count}</span>
          </div>
        </>
      )}
      <Toast msg={toast} />
    </div>
  );
}
