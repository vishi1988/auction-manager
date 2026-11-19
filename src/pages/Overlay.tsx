import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LivePhoto, MaskText, cssVars } from '../components/live/Motion';
import { Odometer } from '../components/live/Odometer';
import { SponsorChip, shownSponsors } from '../components/SponsorsEditor';
import { TeamBadge, useCountdown } from '../components/ui';
import { initials, money } from '../lib/format';
import { basePriceOf, categoryOf, currentPlayer, leadingBid } from '../lib/rules';
import { useAppState } from '../store/store';
import '../styles/live.css';
import '../styles/overlay.css';

/**
 * Graphics for a YouTube / Facebook live stream. Added in OBS (or any streaming
 * app) as a "browser source" on top of the camera: the page itself is
 * see-through, and shows the player on the block, the bid and the SOLD result
 * as a bar along the bottom.
 *
 * ?bg=green   solid green, for apps that need a chroma key
 * ?bg=preview dark backdrop, to look at it in a normal browser
 */
export function Overlay() {
  const state = useAppState();
  const { auction, settings, teams, log } = state;
  const [params] = useSearchParams();
  const bg = params.get('bg') ?? '';
  const player = currentPlayer(state);
  const cat = player ? categoryOf(state, player) : null;
  const lead = leadingBid(state);
  const leadTeam = teams.find((t) => t.id === lead?.teamId);
  const isSold = auction.phase === 'sold';
  const isUnsold = auction.phase === 'unsold';
  const buyer = isSold ? teams.find((t) => t.id === player?.teamId) : undefined;
  const secs = useCountdown(auction.timerEndsAt, auction.timerPausedLeft);
  const timerOn = settings.timerMode !== 'off' && auction.phase === 'bidding' && secs != null;
  const amount = player ? (isSold && player.price != null ? player.price : lead ? lead.amount : basePriceOf(state, player)) : 0;
  const team = buyer ?? leadTeam;
  const sponsors = shownSponsors(state.sponsors);

  // The page behind the graphics must be see-through for the streaming app.
  useEffect(() => {
    const root = document.documentElement;
    const before = [root.style.background, document.body.style.background];
    const paint = bg === 'green' ? '#00b140' : bg === 'preview' ? '#0b1220' : 'transparent';
    root.style.background = paint;
    document.body.style.background = paint;
    return () => {
      root.style.background = before[0]!;
      document.body.style.background = before[1]!;
    };
  }, [bg]);

  // One sponsor at a time, changing every few seconds.
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (sponsors.length < 2) return;
    const id = setInterval(() => setTurn((n) => n + 1), 6000);
    return () => clearInterval(id);
  }, [sponsors.length]);
  const sponsor = sponsors.length ? sponsors[turn % sponsors.length] : undefined;

  const last = log.at(-1);
  const lastPlayer = last ? state.players.find((p) => p.id === last.playerId) : undefined;
  const lastTeam = last ? teams.find((t) => t.id === last.teamId) : undefined;

  return (
    <div className="ov">
      <div className="ov-tag">
        <span className="ov-tag-logo">{initials(settings.name) || 'PA'}</span>
        <span className="ov-tag-text">
          <strong>{settings.name}</strong>
          <small>
            {auction.status === 'live' && <i className="ov-dot" />}
            {auction.status === 'live' ? 'LIVE AUCTION' : auction.status === 'paused' ? 'AUCTION PAUSED' : auction.status === 'finished' ? 'AUCTION COMPLETE' : 'PLAYER AUCTION'}
          </small>
        </span>
      </div>

      {sponsor && (
        <div className="ov-sponsor">
          <small>SPONSORED BY</small>
          <SponsorChip key={sponsor.id} sponsor={sponsor} className="ov-sponsor-chip" />
        </div>
      )}

      {player && cat ? (
        <div
          className={'ov-bar' + (isSold ? ' sold' : '') + (isUnsold ? ' unsold' : '')}
          key={player.id}
          style={cssVars({ '--cat': cat.color, '--tc': team?.color ?? '#1a2540' })}
        >
          <LivePhoto player={player} className="ov-photo" />
          <div className="ov-who">
            <span className="ov-kicker">
              <b>#{player.no}</b>
              <span className="ov-cat">{cat.name}</span>
              {player.role}
              {player.tag ? ' · ' + player.tag : ''}
            </span>
            <span className="ov-name"><MaskText text={player.name} delay={0.25} step={0.07} /></span>
          </div>

          <div className="ov-bid">
            <small>{isSold ? 'SOLD FOR' : isUnsold ? 'BASE PRICE' : lead ? 'CURRENT BID' : 'BASE PRICE'}</small>
            <span className="ov-amt num"><Odometer text={money(amount, settings.unit)} /></span>
          </div>

          {isUnsold ? (
            <div className="ov-team none" key="unsold"><span className="ov-team-text"><strong>UNSOLD</strong></span></div>
          ) : team ? (
            <div className="ov-team" key={team.id + (isSold ? 's' : 'b')}>
              <TeamBadge team={team} size={56} invert />
              <span className="ov-team-text">
                <small>{isSold ? 'SOLD TO' : 'LEADING'}</small>
                <strong>{team.name}</strong>
              </span>
            </div>
          ) : (
            <div className="ov-team wait" key="wait"><span className="ov-team-text"><small>WAITING FOR</small><strong>Opening bid</strong></span></div>
          )}

          {timerOn && <span className={'ov-timer num' + (secs! <= 5 ? ' hot' : '')}>{secs}</span>}
          {isSold && <span className="ov-stamp" key={'st' + auction.eventN}>SOLD</span>}
        </div>
      ) : (
        <div className="ov-note" key={auction.status + log.length}>
          {auction.status === 'finished'
            ? 'Auction complete · thank you for watching'
            : auction.status === 'idle'
              ? 'The auction will start soon'
              : last && lastPlayer
                ? last.type === 'unsold'
                  ? `${lastPlayer.name} went unsold · next player coming up`
                  : `${lastPlayer.name} sold to ${lastTeam?.name ?? ''} for ${money(last.amount, settings.unit)} · next player coming up`
                : 'Next player coming up'}
        </div>
      )}
    </div>
  );
}
