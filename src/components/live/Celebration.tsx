import { useEffect, useRef } from 'react';

/**
 * Light and particles for the SOLD moment, drawn on one canvas so it stays
 * smooth on an ordinary laptop.
 *
 * sparks:   a burst of glowing gold streaks from behind the player card, then
 *           fine gold dust that keeps drifting down while SOLD is on screen.
 * confetti: metallic foil pieces that catch the light as they turn.
 *
 * Movement is scaled by real time between frames, so a slow machine shows the
 * same effect at a lower frame rate instead of in slow motion.
 */
export function Celebration({
  kind,
  colors,
  delayMs = 0,
  origin = { x: 0.33, y: 0.48 },
}: {
  kind: 'sparks' | 'confetti';
  colors: string[];
  delayMs?: number;
  /** Where the burst starts, as a fraction of the screen. */
  origin?: { x: number; y: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = colors.join('|');

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
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
    const k = () => H / 800;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

    // Soft round glow, made once per colour and stamped for every particle.
    const sprites = new Map<string, HTMLCanvasElement>();
    const glow = (color: string) => {
      let s = sprites.get(color);
      if (!s) {
        s = document.createElement('canvas');
        s.width = s.height = 64;
        const g = s.getContext('2d')!;
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.18, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        sprites.set(color, s);
      }
      return s;
    };

    interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; w: number }
    interface Dust { x: number; y: number; vy: number; size: number; phase: number; color: string; depth: number }
    interface Foil { x: number; y: number; vx: number; vy: number; rot: number; spin: number; flip: number; flipSpeed: number; w: number; h: number; color: string }

    const sparks: Spark[] = [];
    const dust: Dust[] = [];
    const foils: Foil[] = [];
    const gold = ['#fff4cf', '#ffd77a', '#f5b324', '#e09a1b'];

    const burst = (fx: number, fy: number, n: number, power: number) => {
      const x = W * fx;
      const y = H * fy;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(3, 13) * power * k();
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2 * k(), life: 0, max: rand(40, 85), color: Math.random() < 0.7 ? pick(gold) : pick(cols), w: rand(1, 2.4) * k() });
      }
    };
    const addDust = (top: boolean) => {
      const depth = Math.random();
      dust.push({ x: rand(0, W), y: top ? -10 : rand(0, H), vy: (0.25 + depth * 0.9) * k(), size: (0.8 + depth * 2.6) * k(), phase: rand(0, Math.PI * 2), color: Math.random() < 0.8 ? pick(gold) : pick(cols), depth });
    };
    const addFoil = () => {
      foils.push({ x: rand(-0.05, 1.05) * W, y: rand(-0.6, -0.02) * H, vx: rand(-0.5, 0.5), vy: rand(1.1, 2.4) * k(), rot: rand(0, Math.PI * 2), spin: rand(-0.05, 0.05), flip: rand(0, Math.PI * 2), flipSpeed: rand(0.06, 0.14), w: rand(5, 9) * k(), h: rand(10, 18) * k(), color: Math.random() < 0.55 ? pick(gold) : pick(cols) });
    };

    const t0 = performance.now() + delayMs;
    let started = false;
    let second = false;
    let last = t0;
    let raf = 0;

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t < t0) return;
      const dt = Math.min(4, Math.max(0.25, (t - last) / (1000 / 60)));
      last = t;
      const age = t - t0;

      if (!started) {
        started = true;
        if (kind === 'sparks') {
          burst(origin.x, origin.y, 140, 1);
          for (let i = 0; i < 70; i++) addDust(false);
        } else {
          for (let i = 0; i < 130; i++) addFoil();
        }
      }
      if (kind === 'sparks' && !second && age > 380) {
        second = true;
        burst(origin.x + 0.3, origin.y - 0.12, 70, 0.7);
      }

      ctx.clearRect(0, 0, W, H);

      if (kind === 'sparks') {
        ctx.globalCompositeOperation = 'lighter';
        const drag = Math.pow(0.955, dt);
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]!;
          s.life += dt;
          if (s.life > s.max) {
            sparks.splice(i, 1);
            continue;
          }
          s.vx *= drag;
          s.vy = s.vy * drag + 0.14 * k() * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const a = 1 - s.life / s.max;
          // A streak behind the spark along its path: reads as speed, not as a dot.
          ctx.strokeStyle = s.color;
          ctx.globalAlpha = a;
          ctx.lineWidth = s.w;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
          const r = s.w * 5;
          ctx.globalAlpha = a * 0.5;
          ctx.drawImage(glow(s.color), s.x - r, s.y - r, r * 2, r * 2);
        }
        // Gold dust keeps falling gently for as long as the SOLD screen is up.
        if (dust.length < 90 && Math.random() < 0.35 * dt) addDust(true);
        for (let i = dust.length - 1; i >= 0; i--) {
          const d = dust[i]!;
          d.phase += 0.03 * dt;
          d.y += d.vy * dt;
          d.x += Math.sin(d.phase) * 0.25 * dt;
          if (d.y > H + 10) {
            dust.splice(i, 1);
            continue;
          }
          const twinkle = 0.55 + 0.45 * Math.sin(d.phase * 3);
          const fadeIn = Math.min(1, age / 900);
          const r = d.size * 3;
          ctx.globalAlpha = (0.25 + d.depth * 0.55) * twinkle * fadeIn;
          ctx.drawImage(glow(d.color), d.x - r, d.y - r, r * 2, r * 2);
        }
      } else {
        ctx.globalCompositeOperation = 'source-over';
        for (let i = foils.length - 1; i >= 0; i--) {
          const f = foils[i]!;
          f.flip += f.flipSpeed * dt;
          f.rot += f.spin * dt;
          f.x += (f.vx + Math.sin(f.flip * 0.5) * 0.6) * dt;
          f.y += f.vy * dt;
          if (f.y > H + 30) {
            foils.splice(i, 1);
            continue;
          }
          const turn = Math.cos(f.flip);
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          ctx.scale(turn, 1);
          ctx.globalAlpha = 1;
          ctx.fillStyle = f.color;
          ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
          // The face catches the light as it turns towards the viewer.
          ctx.globalAlpha = Math.max(0, 1 - Math.abs(turn)) * 0.6 + Math.max(0, turn) * 0.15;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
          ctx.restore();
        }
        if (age > 6000 && !foils.length) cancelAnimationFrame(raf);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [kind, palette, delayMs, origin.x, origin.y]);

  return <canvas ref={ref} className="celebration" aria-hidden />;
}
