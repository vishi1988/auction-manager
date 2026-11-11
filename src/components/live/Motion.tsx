import { useEffect, useState, type CSSProperties } from 'react';
import type { Player } from '../../types';

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Text revealed from behind a mask line, word by word, the way TV graphics
 * bring in names. `delay` is in seconds.
 */
export function MaskText({ text, delay = 0, step = 0.06, className = '' }: { text: string; delay?: number; step?: number; className?: string }) {
  return (
    <span className={'mask-text ' + className} aria-label={text}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="mask" aria-hidden>
          <span className="mask-in" style={{ animationDelay: delay + i * step + 's' }}>{word}</span>
        </span>
      ))}
    </span>
  );
}

/** Player photo, or a clean silhouette with the player's number behind it when there is no photo. */
export function LivePhoto({ player, className }: { player: Player; className: string }) {
  return (
    <span className={className}>
      {player.photo ? (
        <img src={player.photo} alt="" />
      ) : (
        <span className="ph-empty" aria-hidden>
          <span className="ph-no num">{player.no}</span>
          <svg viewBox="0 0 100 120" className="ph-silhouette">
            <circle cx="50" cy="40" r="17" />
            <path d="M12 120 C12 90 28 72 50 72 C72 72 88 90 88 120 Z" />
          </svg>
        </span>
      )}
    </span>
  );
}

const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/** A number that counts up from zero after `delayMs`, formatted by `format`. */
export function CountUpText({ value, format, delayMs = 0, durationMs = 1200 }: { value: number; format: (v: number) => string; delayMs?: number; durationMs?: number }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    let raf = 0;
    const start = performance.now() + delayMs;
    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / durationMs));
      setShown(value * easeOutExpo(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delayMs, durationMs]);
  // Round to the money step so it never shows "₹1.37999".
  return <>{format(Math.round(shown * 100) / 100)}</>;
}

/** Sets CSS custom properties without TypeScript complaining. */
export const cssVars = (v: Record<string, string | number>) => v as CSSProperties;
