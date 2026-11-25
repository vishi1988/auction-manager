import { Download, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shareCanvas, soldCard, squadCard } from '../lib/cards';
import { matchName, resultText } from '../lib/tournament';
import { awardsCard, potmCard, resultCard } from '../lib/tournamentCards';
import { money } from '../lib/format';
import { teamStats } from '../lib/rules';
import type { AppState, Match, Player, Team } from '../types';
import { Drawer } from './ui';

export type CardTarget =
  | { kind: 'sold'; player: Player }
  | { kind: 'squad'; team: Team }
  | { kind: 'result'; match: Match }
  | { kind: 'potm'; match: Match; playerId: string }
  | { kind: 'awards' };

/** Title of the share panel and the words sent along with the picture. */
function describe(state: AppState, target: CardTarget): { title: string; text: string } {
  const unit = state.settings.unit;
  const event = state.settings.name;
  switch (target.kind) {
    case 'sold': {
      const team = state.teams.find((t) => t.id === target.player.teamId);
      return { title: target.player.name, text: `${target.player.name} ${target.player.status === 'retained' ? 'retained by' : 'SOLD to'} ${team?.name ?? ''} for ${money(target.player.price, unit)} · ${event}` };
    }
    case 'squad':
      return { title: target.team.name + ' squad', text: `${target.team.name} squad (${teamStats(state, target.team.id).count} players) · ${event}` };
    case 'result':
      return { title: matchName(target.match) + ' result', text: `${resultText(state, target.match)} · ${matchName(target.match)} · ${event}` };
    case 'potm': {
      const p = state.players.find((x) => x.id === target.playerId);
      return { title: 'Player of the Match', text: `⭐ Player of the Match: ${p?.name ?? ''} · ${matchName(target.match)} · ${event}` };
    }
    case 'awards':
      return { title: 'Tournament awards', text: `🏆 Tournament awards · ${event}` };
  }
}

function draw(state: AppState, target: CardTarget): Promise<HTMLCanvasElement> {
  switch (target.kind) {
    case 'sold': return soldCard(state, target.player);
    case 'squad': return squadCard(state, target.team);
    case 'result': return resultCard(state, target.match);
    case 'potm': return potmCard(state, target.match, target.playerId);
    case 'awards': return awardsCard(state);
  }
}

/** Preview of a share picture with Share and Download buttons. */
export function ShareCard({ state, target, onClose, showToast }: { state: AppState; target: CardTarget; onClose: () => void; showToast: (m: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { title, text } = describe(state, target);
  const fileName = (state.settings.name + ' - ' + title).replace(/[^\w -]+/g, '').trim() + '.png';

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    draw(state, target).then(
      (c) => {
        if (cancelled) return;
        canvasRef.current = c;
        setUrl(c.toDataURL('image/png'));
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
    // The card is a snapshot of the moment it was opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const send = async (download: boolean) => {
    if (!canvasRef.current) return;
    try {
      const out = await shareCanvas(canvasRef.current, fileName, text, download);
      if (out === 'downloaded') showToast('Picture saved. Attach it in WhatsApp');
    } catch {
      showToast('Could not make the picture');
    }
  };

  return (
    <Drawer
      title={'Share: ' + title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-primary" disabled={!url} onClick={() => void send(false)}><Share2 size={16} />Share on WhatsApp</button>
          <button className="btn" disabled={!url} onClick={() => void send(true)}><Download size={16} />Download</button>
        </>
      }
    >
      {failed ? (
        <p className="hint" style={{ color: 'var(--danger-ink)' }}>Could not make the picture on this device.</p>
      ) : url ? (
        <img className="card-preview" src={url} alt={text} />
      ) : (
        <div className="empty" style={{ minHeight: 240, justifyContent: 'center' }}>Making the picture…</div>
      )}
      <p className="hint">On a phone, Share opens WhatsApp, Instagram and other apps. On a computer the picture is downloaded.</p>
    </Drawer>
  );
}
