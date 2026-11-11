import { useEffect, useId, useState } from 'react';
import { DRAW_MS } from '../../lib/auction';
import { money } from '../../lib/format';
import type { Draw, Team, Unit } from '../../types';
import { TeamBadge } from '../ui';
import { MaskText, cssVars } from './Motion';

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

/**
 * How far the pointer is pushed aside by the peg passing under it, in degrees.
 * Pegs sit on the slice edges; the pointer bends just before a peg reaches the
 * top and snaps back once it has passed, which reads as a real ticking wheel.
 */
function pointerKick(angle: number, n: number, spinning: boolean): number {
  if (!spinning) return 0;
  const seg = 360 / n;
  const atTop = (((-angle % 360) + 360) % 360) % seg;
  const frac = atTop / seg;
  return frac < 0.18 ? (1 - frac / 0.18) * 18 : 0;
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
  const id = useId().replace(/:/g, '');
  const running = Date.now() - draw.startedAt < DRAW_MS + 200;
  const now = useFrameClock(running);
  const revealed = now - draw.startedAt >= DRAW_MS;
  const entrants = draw.teamIds.map((tid) => teams.find((t) => t.id === tid)).filter((t): t is Team => !!t);
  const winner = teams.find((t) => t.id === draw.winnerId);
  const n = Math.max(1, entrants.length);
  const seg = 360 / n;
  const angle = wheelAngle(draw, now);
  const kick = pointerKick(angle, n, !revealed && now > draw.startedAt);

  return (
    <div className="wheel-wrap">
      <span className="eyebrow wheel-eyebrow">TIE AT THE UPPER LIMIT</span>
      <h2 className="wheel-title"><MaskText text="LUCKY DRAW" /></h2>
      <div className="wheel-sub">
        {entrants.length} teams want him at <strong>{money(draw.amount, unit)}</strong>
      </div>

      <div className={'wheel' + (revealed ? ' done' : '')}>
        <svg viewBox="-120 -124 240 244" aria-hidden>
          <defs>
            <linearGradient id={id + 'rim'} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff1c4" />
              <stop offset="0.35" stopColor="#d9a23a" />
              <stop offset="0.6" stopColor="#8a5b12" />
              <stop offset="1" stopColor="#f2c768" />
            </linearGradient>
            <radialGradient id={id + 'shade'}>
              <stop offset="0.55" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.38" />
            </radialGradient>
            <linearGradient id={id + 'gloss'} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <circle r={R + 13} fill={`url(#${id}rim)`} />
          <circle r={R + 6} fill="#0d1322" />

          <g transform={`rotate(${angle})`}>
            {entrants.map((t, i) => {
              const a0 = i * seg;
              const a1 = (i + 1) * seg;
              const d =
                n === 1
                  ? `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`
                  : `M 0 0 L ${point(a0, R)} A ${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${point(a1, R)} Z`;
              const mid = a0 + seg / 2;
              const isWinner = t.id === draw.winnerId;
              return (
                <g key={t.id} className={revealed ? (isWinner ? 'wheel-win' : 'wheel-lost') : undefined}>
                  <path d={d} fill={t.color} stroke="#0d1322" strokeWidth={1.5} />
                  <text transform={`rotate(${mid}) translate(0 ${-R * 0.64})`} className="wheel-label" textAnchor="middle" dominantBaseline="middle">
                    {t.short}
                  </text>
                </g>
              );
            })}
            {/* depth: darker towards the rim */}
            <circle r={R} fill={`url(#${id}shade)`} />
            {entrants.map((t, i) => {
              const [x, y] = xy(i * seg, R - 3);
              return <circle key={'peg' + t.id} cx={x} cy={y} r={3.2} className="wheel-peg" />;
            })}
          </g>

          {/* fixed light from above, so the wheel turns under it */}
          <circle r={R} fill={`url(#${id}gloss)`} pointerEvents="none" />
          <circle r={21} fill={`url(#${id}rim)`} />
          <circle r={14} fill="#0d1322" />
          <circle r={5} fill="#f5c451" />

          <g transform={`translate(0 ${-R - 10}) rotate(${kick})`} className="wheel-pointer">
            <path d="M -12 -10 L 12 -10 L 0 20 Z" fill={`url(#${id}rim)`} stroke="#1a1204" strokeWidth={1.5} strokeLinejoin="round" />
          </g>
        </svg>
      </div>

      <div className="wheel-teams">
        {entrants.map((t) => (
          <span key={t.id} className={'wheel-chip' + (revealed ? (t.id === draw.winnerId ? ' win' : ' lose') : '')} style={cssVars({ '--tc': t.color })}>
            <TeamBadge team={t} size={28} />
            {t.name}
          </span>
        ))}
      </div>

      <div className="wheel-result">
        {revealed && winner ? (
          <span className="wheel-winner" style={cssVars({ '--tc': winner.color })}>
            <MaskText text={winner.name + ' wins'} />
          </span>
        ) : (
          <span className="wheel-sub">Spinning…</span>
        )}
      </div>
    </div>
  );
}
