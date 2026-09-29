import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { initials } from '../lib/format';
import type { Player, Team } from '../types';

export function TeamBadge({ team, size = 40, invert = false }: { team: Team; size?: number; invert?: boolean }) {
  return (
    <span
      className="team-badge"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: invert ? '#fff' : team.color,
        color: invert ? team.color : '#fff',
      }}
    >
      {team.logo ? <img src={team.logo} alt="" /> : team.short}
    </span>
  );
}

export function PlayerAvatar({ player, className = 'avatar' }: { player: Player; className?: string }) {
  return <span className={className}>{player.photo ? <img src={player.photo} alt="" /> : initials(player.name)}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OptionRow({ title, children, control }: { title: string; children: ReactNode; control: ReactNode }) {
  return (
    <div className="option-row">
      <div>
        <strong>{title}</strong>
        <p className="hint">{children}</p>
      </div>
      {control}
    </div>
  );
}

/** Seconds left on the bid timer, updated a few times a second. */
export function useCountdown(endsAt: number | null, pausedLeft: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (pausedLeft != null) return Math.ceil(pausedLeft / 1000);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Countdown ring; pulses red in the last 5 seconds. */
export function TimerRing({ secs, className = 'timer' }: { secs: number | null; className?: string }) {
  const hot = secs != null && secs <= 5;
  return (
    <span className={className + (secs == null ? ' idle' : hot ? ' hot' : '')} key={hot ? secs : 'calm'}>
      <span className={hot ? 'a-tick' : undefined}>{secs == null ? '–' : secs + 's'}</span>
    </span>
  );
}

export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  return [msg, setMsg];
}

export const Toast = ({ msg }: { msg: string | null }) =>
  msg ? (
    <div className="toast" role="status" key={msg}>
      <CheckCircle2 size={18} color="#4ade80" aria-hidden />
      {msg}
    </div>
  ) : null;

/** Side panel for forms, so pages stay uncluttered. Closes on Escape or backdrop click. */
export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: ReactNode }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" className="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 420, margin: 0 }}>{children}</p>}
      {action}
    </div>
  );
}

/** Number that counts up from 0 when it first appears. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toLocaleString('en-IN')}</>;
}

export function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number | string; tone: 'blue' | 'orange' | 'green' | 'red' | 'dark' }) {
  return (
    <div className="card stat-card">
      <span className={'stat-icon tone-' + tone}>{icon}</span>
      <div>
        <div className="value num">{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
}

/** Copies text and reports back through the given toast. */
export function copyText(text: string, showToast: (msg: string) => void, label = 'Link copied') {
  navigator.clipboard?.writeText(text).then(
    () => showToast(label),
    () => showToast(text),
  );
}
