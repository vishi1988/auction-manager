import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  /** confetti only */
  rot?: number;
  spin?: number;
  /** rockets explode when they slow down */
  rocket?: boolean;
}

const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Full-screen fireworks or confetti for the SOLD moment, drawn on a canvas
 * so it stays smooth on an old projector laptop. Runs once, about 4 seconds.
 */
export function Celebration({ kind, colors }: { kind: 'fireworks' | 'confetti'; colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = colors.join('|');

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || prefersReducedMotion()) return;
    const cols = palette.split('|');

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Sizes follow the screen height, so a 1080p projector looks like a 768p laptop.
    const k = () => H / 800;
    const parts: Particle[] = [];
    const start = performance.now();
    const RUN_MS = 4200;
    let lastLaunch = -Infinity;
    let last = start;
    let raf = 0;

    const launch = () => {
      parts.push({
        x: W * rand(0.12, 0.88),
        y: H + 10,
        vx: rand(-1, 1) * k(),
        vy: -rand(11, 14.5) * k(),
        life: 0,
        max: 200,
        color: pick(cols),
        size: 3 * k(),
        rocket: true,
      });
    };
    const burst = (x: number, y: number, color: string) => {
      const n = 70;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
        const sp = rand(2, 6.5) * k();
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(55, 85), color: Math.random() < 0.25 ? '#ffffff' : color, size: rand(1.6, 2.8) * k() });
      }
    };

    if (kind === 'confetti') {
      for (let i = 0; i < 220; i++) {
        parts.push({
          x: rand(0, W),
          y: -rand(0, H * 0.9),
          vx: rand(-1.2, 1.2),
          vy: rand(2.5, 5.5) * k(),
          life: 0,
          max: 1e9,
          color: pick(cols),
          size: rand(7, 13) * k(),
          rot: rand(0, Math.PI * 2),
          spin: rand(-0.2, 0.2),
        });
      }
    }

    const frame = (t: number) => {
      const elapsed = t - start;
      // Movement is scaled by the time since the last frame, so a slow laptop
      // shows the same fireworks at a lower frame rate instead of in slow motion.
      const dt = Math.min(4, Math.max(0.25, (t - last) / (1000 / 60)));
      last = t;
      const drag = Math.pow(0.975, dt);
      if (kind === 'fireworks') {
        // Fade the previous frame so sparks leave short trails.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        if (elapsed < RUN_MS - 1200 && t - lastLaunch > 320) {
          launch();
          if (Math.random() < 0.4) launch();
          lastLaunch = t;
        }
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life += dt;
        if (p.rocket) {
          p.vy += 0.16 * k() * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.vy >= -1.5 * k()) {
            parts.splice(i, 1);
            burst(p.x, p.y, p.color);
            continue;
          }
          ctx.fillStyle = '#fff6d8';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (kind === 'fireworks') {
          p.vx *= drag;
          p.vy = p.vy * drag + 0.07 * k() * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const alpha = 1 - p.life / p.max;
          if (alpha <= 0) {
            parts.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          p.x += (p.vx + Math.sin((p.life + i) / 12) * 0.9) * dt;
          p.y += p.vy * dt;
          p.rot! += p.spin! * dt;
          if (p.y > H + 30) {
            parts.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot!);
          // Flipping paper: the width shrinks and grows as it turns.
          ctx.scale(Math.cos(p.life / 9 + i), 1);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
          ctx.restore();
        }
      }

      if (elapsed < RUN_MS || parts.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [kind, palette]);

  return <canvas ref={ref} className="celebration" aria-hidden />;
}
