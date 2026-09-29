import { ArrowRight, CalendarDays, Check, ClipboardList, Copy, Gavel, MapPin, MonitorPlay, Play, Settings2, Trophy, UserPlus, Users, UsersRound, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuctionPath } from '../components/AuctionRoute';
import { ScreenLink, shareUrl } from '../components/ScreenLink';
import { StatCard, Toast, copyText, useToast } from '../components/ui';
import { sportOf } from '../data/sports';
import { money } from '../lib/format';
import { useAppState } from '../store/store';

function formatDate(value: string) {
  if (!value) return 'Date not set';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Auction home: what is ready, what is left, and the big "start" button. */
export function Overview() {
  const state = useAppState();
  const { settings, teams, players, auction, log } = state;
  const path = useAuctionPath();
  const [toast, showToast] = useToast();

  const needPlayers = teams.length * settings.minSquad;
  const steps: { done: boolean; title: string; text: string; to: string; cta: string; icon: ReactNode }[] = [
    {
      done: !!settings.name && !!settings.date,
      title: 'Auction details',
      text: settings.date ? `${formatDate(settings.date)}${settings.venue ? ' · ' + settings.venue : ''}` : 'Add the date and venue.',
      to: '/settings',
      cta: 'Edit details',
      icon: <CalendarDays size={18} />,
    },
    {
      done: true,
      title: 'Budget & rules',
      text: `${money(settings.purse, settings.unit)} purse · ${settings.minSquad}–${settings.maxSquad} players per team · ${state.categories.length} categories`,
      to: '/settings?tab=squad',
      cta: 'Review rules',
      icon: <Wallet size={18} />,
    },
    {
      done: teams.length >= 2,
      title: 'Add teams',
      text: teams.length ? `${teams.length} teams added` : 'Add at least 2 teams with owner names and colours.',
      to: '/teams',
      cta: teams.length ? 'Manage teams' : 'Add teams',
      icon: <Users size={18} />,
    },
    {
      done: teams.length > 0 && players.length >= needPlayers,
      title: 'Add players',
      text: players.length
        ? `${players.length} players${needPlayers > players.length ? ` · need at least ${needPlayers} to fill every team` : ' ready'}`
        : 'Upload an Excel sheet, add players one by one, or share the registration form.',
      to: '/players',
      cta: players.length ? 'Manage players' : 'Add players',
      icon: <UserPlus size={18} />,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const ready = doneCount === steps.length;
  const live = auction.status === 'live' || auction.status === 'paused';
  const sold = log.filter((l) => l.type !== 'unsold').length;

  const links = [
    { label: 'Live screen', hint: 'Open on the projector or TV', path: '/live', icon: <MonitorPlay size={18} />, tone: 'tone-blue' },
    { label: 'Player registration', hint: 'Players fill their own details', path: '/register', icon: <ClipboardList size={18} />, tone: 'tone-green' },
    { label: 'Team owner bidding', hint: 'Owners bid from their phones', path: '/owner', icon: <UsersRound size={18} />, tone: 'tone-orange' },
  ];

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{sportOf(settings.sport).name} auction</div>
          <h1>{settings.name}</h1>
          <p className="row" style={{ gap: 14 }}>
            <span className="row" style={{ gap: 6 }}><CalendarDays size={15} />{formatDate(settings.date)}</span>
            {settings.venue && <span className="row" style={{ gap: 6 }}><MapPin size={15} />{settings.venue}</span>}
          </p>
        </div>
        <div className="row">
          <ScreenLink className="btn" to={path('/live')}><MonitorPlay size={16} />Live screen</ScreenLink>
          {auction.status === 'finished' ? (
            <Link className="btn btn-primary btn-lg" to={path('/results')}><Trophy size={18} />View results</Link>
          ) : (
            <Link className={'btn btn-lg ' + (ready || live ? 'btn-accent' : 'btn-primary')} to={path('/console')}>
              {live ? <Gavel size={18} /> : <Play size={18} />}
              {live ? 'Back to auction' : 'Go to auction day'}
            </Link>
          )}
        </div>
      </div>

      <div className="grid-4 stagger">
        <StatCard tone="blue" icon={<Users size={20} />} label="Teams" value={teams.length} />
        <StatCard tone="green" icon={<UserPlus size={20} />} label="Players" value={players.length} />
        <StatCard tone="orange" icon={<Gavel size={20} />} label="Sold so far" value={sold} />
        <StatCard tone="dark" icon={<Wallet size={20} />} label="Purse per team" value={money(settings.purse, settings.unit)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }} className="results-layout">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{ready ? 'You are ready for auction day' : 'Get ready in 4 steps'}</h2>
              <p className="hint">{doneCount} of {steps.length} done</p>
            </div>
            <div className="progress" style={{ maxWidth: 200 }}><div style={{ width: (100 * doneCount) / steps.length + '%' }} /></div>
          </div>
          <div>
            {steps.map((s, i) => (
              <div key={s.title} className="check-item">
                <span className={'check-mark' + (s.done ? ' done' : '')}>{s.done ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
                <span className={'stat-icon hide-mobile ' + (s.done ? 'tone-green' : 'tone-blue')} style={{ width: 38, height: 38 }}>{s.icon}</span>
                <div className="text">
                  <strong>{s.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{s.text}</span>
                </div>
                <Link className={'btn btn-sm ' + (s.done ? 'btn-ghost' : 'btn-primary')} to={path(s.to)}>
                  {s.cta}
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Share links</h2>
          <p className="hint">Send these on WhatsApp or open them on another screen.</p>
          {links.map((l) => (
            <div key={l.path} className="row" style={{ flexWrap: 'nowrap', gap: 12, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
              <span className={'stat-icon ' + l.tone} style={{ width: 38, height: 38 }}>{l.icon}</span>
              <span style={{ flexGrow: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 14 }}>{l.label}</strong>
                <span className="muted" style={{ fontSize: 12.5 }}>{l.hint}</span>
              </span>
              <button className="btn btn-sm btn-icon" aria-label={'Copy ' + l.label + ' link'} title="Copy link" onClick={() => copyText(shareUrl(path(l.path)), showToast, l.label + ' link copied')}>
                <Copy size={15} />
              </button>
              <ScreenLink className="btn btn-sm" to={path(l.path)}>Open</ScreenLink>
            </div>
          ))}
          <Link className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} to={path('/settings?tab=screen')}>
            <Settings2 size={15} />Live screen settings
          </Link>
        </section>
      </div>
      <Toast msg={toast} />
    </main>
  );
}
