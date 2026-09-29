import { Sparkles, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DRAW_MS } from '../lib/auction';
import { money } from '../lib/format';
import type { Draw, Team, Unit } from '../types';
import { TeamBadge } from './ui';

/** Re-renders every `ms` while `active`. */
function useNow(active: boolean, ms = 60) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/**
 * Which team is highlighted at a moment of the draw. Deterministic from the
 * draw's start time and winner, so every screen shows the same spin.
 */
export function drawFrame(draw: Draw, now: number) {
  const n = draw.teamIds.length;
  const winner = draw.teamIds.indexOf(draw.winnerId);
  const p = Math.min(1, Math.max(0, (now - draw.startedAt) / DRAW_MS));
  const steps = n * 5 + winner;
  const step = p >= 1 ? steps : Math.floor((1 - Math.pow(1 - p, 3)) * steps);
  return { index: step % n, revealed: p >= 1 };
}

export function useDrawRevealed(draw: Draw | null | undefined) {
  const now = useNow(!!draw && Date.now() - draw.startedAt < DRAW_MS + 500, 200);
  return !!draw && now - draw.startedAt >= DRAW_MS;
}

export function LuckyDraw({ draw, teams, unit, dark = false }: { draw: Draw; teams: Team[]; unit: Unit; dark?: boolean }) {
  const now = useNow(Date.now() - draw.startedAt < DRAW_MS + 500);
  const { index, revealed } = drawFrame(draw, now);
  const entrants = draw.teamIds.map((id) => teams.find((t) => t.id === id)).filter((t): t is Team => !!t);
  const winner = teams.find((t) => t.id === draw.winnerId);
  const fg = dark ? '#f4f6fb' : 'var(--ink)';
  const sub = dark ? '#93a3bb' : 'var(--muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f5b324', fontWeight: 800, letterSpacing: '0.14em', fontSize: 13 }}>
        <Sparkles size={16} /> LUCKY DRAW <Sparkles size={16} />
      </div>
      <div style={{ color: sub, fontSize: 14 }}>
        {entrants.length} teams tied at <strong style={{ color: fg }}>{money(draw.amount, unit)}</strong>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        {entrants.map((t, i) => {
          const on = i === index;
          const lost = revealed && !on;
          return (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 14,
                background: on ? t.color : dark ? '#1c2842' : 'var(--surface-2)',
                color: on ? '#fff' : fg,
                border: `2px solid ${on ? '#f5b324' : 'transparent'}`,
                transform: on ? 'scale(1.08)' : 'scale(1)',
                opacity: lost ? 0.35 : 1,
                boxShadow: on ? '0 10px 30px -8px rgb(245 179 36 / 0.6)' : 'none',
                transition: 'transform 0.12s, opacity 0.4s',
                fontWeight: 700,
              }}
            >
              <TeamBadge team={t} size={34} invert={on} />
              {t.name}
            </div>
          );
        })}
      </div>
      {revealed && winner ? (
        <div className="a-stamp" key="won" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderRadius: 14, border: '3px solid #f5b324', color: '#f5b324', transform: 'rotate(-3deg)' }}>
          <Trophy size={24} />
          <span className="display" style={{ fontSize: 34, lineHeight: 1, letterSpacing: '0.04em' }}>{winner.name.toUpperCase()} WINS</span>
        </div>
      ) : (
        <div style={{ color: sub, fontSize: 14 }}>Drawing…</div>
      )}
    </div>
  );
}
