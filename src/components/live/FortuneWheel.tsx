import { Sparkles, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DRAW_MS } from '../../lib/auction';
import { money } from '../../lib/format';
import type { Draw, Team, Unit } from '../../types';
import { TeamBadge } from '../ui';

const SPINS = 6;
const R = 100;

const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);

/**
 * Wheel angle at a moment of the draw. It depends only on the draw's start
 * time and winner, so every screen spins the same way and stops on the
 * same team that the console shows.
 */
export function wheelAngle(draw: Draw, now: number): number {
  const n = draw.teamIds.length;
  const seg = 360 / n;
  const winner = Math.max(0, draw.teamIds.indexOf(draw.winnerId));
  // Turning the wheel by `final` puts the middle of the winner's slice under the pointer at the top.
  const final = SPINS * 360 - (winner + 0.5) * seg;
  const p = Math.min(1, Math.max(0, (now - draw.startedAt) / DRAW_MS));
  return final * easeOut(p);
}

/** x, y of an angle measured clockwise from the top. */
const xy = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
const point = (deg: number, r: number) => xy(deg, r).map((v) => v.toFixed(2)).join(' ');

function useFrameClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

export function FortuneWheel({ draw, teams, unit }: { draw: Draw; teams: Team[]; unit: Unit }) {
  const running = Date.now() - draw.startedAt < DRAW_MS + 200;
  const now = useFrameClock(running);
  const revealed = now - draw.startedAt >= DRAW_MS;
  const entrants = draw.teamIds.map((id) => teams.find((t) => t.id === id)).filter((t): t is Team => !!t);
  const winner = teams.find((t) => t.id === draw.winnerId);
  const n = Math.max(1, entrants.length);
  const seg = 360 / n;
  const angle = wheelAngle(draw, now);

  return (
    <div className="wheel-wrap">
      <div className="wheel-title">
        <Sparkles size={22} /> LUCKY DRAW <Sparkles size={22} />
      </div>
      <div className="wheel-sub">
        {entrants.length} teams want him at <strong>{money(draw.amount, unit)}</strong>
      </div>

      <div className={'wheel' + (revealed ? ' done' : '')}>
        <svg viewBox="-118 -118 236 236" aria-hidden>
          <circle r={R + 12} className="wheel-rim" />
          {Array.from({ length: 24 }, (_, i) => (
            <circle key={i} className={'wheel-bulb' + (i % 2 ? ' alt' : '')} cx={xy(i * 15, R + 6)[0]} cy={xy(i * 15, R + 6)[1]} r={2.6} />
          ))}
          <g transform={`rotate(${angle})`}>
            {entrants.map((t, i) => {
              const a0 = i * seg;
              const a1 = (i + 1) * seg;
              const d =
                n === 1
                  ? `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`
                  : `M 0 0 L ${point(a0, R)} A ${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${point(a1, R)} Z`;
              const mid = a0 + seg / 2;
              const lost = revealed && t.id !== draw.winnerId;
              return (
                <g key={t.id} className={lost ? 'wheel-lost' : undefined}>
                  <path d={d} fill={t.color} stroke="#ffffff" strokeWidth={2} />
                  <text transform={`rotate(${mid}) translate(0 ${-R * 0.62})`} className="wheel-label" textAnchor="middle" dominantBaseline="middle">
                    {t.short}
                  </text>
                </g>
              );
            })}
          </g>
          <circle r={20} className="wheel-hub" />
          <circle r={9} className="wheel-hub-dot" />
          <path d={`M -11 ${-R - 16} L 11 ${-R - 16} L 0 ${-R + 8} Z`} className="wheel-pointer" />
        </svg>
      </div>

      <div className="wheel-teams">
        {entrants.map((t) => (
          <span key={t.id} className={'wheel-chip' + (revealed ? (t.id === draw.winnerId ? ' win' : ' lose') : '')} style={{ '--tc': t.color } as React.CSSProperties}>
            <TeamBadge team={t} size={30} />
            {t.name}
          </span>
        ))}
      </div>

      {revealed && winner ? (
        <div className="wheel-winner a-stamp" style={{ '--tc': winner.color } as React.CSSProperties}>
          <Trophy size={30} />
          {winner.name} wins
        </div>
      ) : (
        <div className="wheel-sub">Spinning…</div>
      )}
    </div>
  );
}
