import { Download, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shareCanvas, soldCard, squadCard } from '../lib/cards';
import { money } from '../lib/format';
import { teamStats } from '../lib/rules';
import type { AppState, Player, Team } from '../types';
import { Drawer } from './ui';

export type CardTarget = { kind: 'sold'; player: Player } | { kind: 'squad'; team: Team };

/** Preview of a share picture with Share and Download buttons. */
export function ShareCard({ state, target, onClose, showToast }: { state: AppState; target: CardTarget; onClose: () => void; showToast: (m: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const team = target.kind === 'sold' ? state.teams.find((t) => t.id === target.player.teamId) : target.team;
  const title = target.kind === 'sold' ? target.player.name : target.team.name + ' squad';
  const text =
    target.kind === 'sold'
      ? `${target.player.name} ${target.player.status === 'retained' ? 'retained by' : 'SOLD to'} ${team?.name ?? ''} for ${money(target.player.price, state.settings.unit)} · ${state.settings.name}`
      : `${target.team.name} squad (${teamStats(state, target.team.id).count} players) · ${state.settings.name}`;
  const fileName = (state.settings.name + ' - ' + title).replace(/[^\w -]+/g, '').trim() + '.png';

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    (target.kind === 'sold' ? soldCard(state, target.player) : squadCard(state, target.team)).then(
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
