import { CalendarDays, CheckCircle2, Copy, Gavel, LayoutGrid, MapPin, MonitorPlay, Plus, Radio, Search, Settings2, Sparkles, Trash2, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ScreenLink } from '../components/ScreenLink';
import { Drawer, EmptyState, Segmented, StatCard } from '../components/ui';
import { APP_NAME } from '../brand';
import { createBlankState, createDummyState } from '../data/dummy';
import { SPORTS, sportOf, type SportId } from '../data/sports';
import { createAuction, deleteAuction, duplicateAuction, useIndex } from '../store/store';
import type { AuctionMeta, Unit } from '../types';

type Filter = 'all' | 'setup' | 'live' | 'finished';

/** A colour per sport so auction cards are easy to tell apart. */
const SPORT_COLORS: Record<SportId, string> = {
  cricket: '#12A360', football: '#2E5BFF', kabaddi: '#FF7A1A', volleyball: '#D6409F',
  hockey: '#0EA5B7', basketball: '#E5484D', badminton: '#7C4DDB', other: '#475467',
};

function formatDate(value: string) {
  if (!value) return 'Date not set';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const { organizer, auctions } = useIndex();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const setCreating = (open: boolean) => setParams(open ? { new: '1' } : {}, { replace: true });
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const isLive = (a: AuctionMeta) => a.status === 'live' || a.status === 'paused';
  const matches = (a: AuctionMeta) =>
    (filter === 'all' || (filter === 'setup' && a.status === 'idle') || (filter === 'live' && isLive(a)) || (filter === 'finished' && a.status === 'finished')) &&
    (!q || a.name.toLowerCase().includes(q.toLowerCase()) || a.venue.toLowerCase().includes(q.toLowerCase()));
  const shown = auctions.filter(matches);
  const liveNow = auctions.filter(isLive);

  return (
    <main className="page">
      <section className="hero">
        <div style={{ flexGrow: 1, minWidth: 260 }}>
          <div className="eyebrow" style={{ color: '#ffb27a' }}><Sparkles size={14} />{APP_NAME}</div>
          <h1>{organizer.name ? `${greeting()}, ${organizer.name.split(' ')[0]}` : 'Run your player auction like the pros'}</h1>
          <p>
            {organizer.organisation
              ? organizer.organisation + ' · set up teams and players, then run a live auction with a big-screen display.'
              : 'Set up teams and players, run the bidding from your laptop or phone, and show every SOLD moment on the big screen.'}
          </p>
        </div>
        <div className="row">
          {!organizer.name && <Link className="btn" to="/account" style={{ background: 'transparent', color: '#fff', borderColor: '#34425c' }}>Set up profile</Link>}
          <button className="btn btn-accent btn-lg" onClick={() => setCreating(true)}><Plus size={18} />New auction</button>
        </div>
      </section>

      {liveNow.length > 0 && (
        <div className="banner banner-red">
          <Radio size={18} />
          <span><strong>{liveNow[0]!.name}</strong> is live right now.</span>
          <Link className="btn btn-sm" to={'/a/' + liveNow[0]!.id + '/console'}>Go to console</Link>
        </div>
      )}

      <div className="grid-4 stagger">
        <StatCard tone="blue" icon={<LayoutGrid size={20} />} label="Total auctions" value={auctions.length} />
        <StatCard tone="orange" icon={<Settings2 size={20} />} label="In setup" value={auctions.filter((a) => a.status === 'idle').length} />
        <StatCard tone="red" icon={<Radio size={20} />} label="Live now" value={liveNow.length} />
        <StatCard tone="green" icon={<CheckCircle2 size={20} />} label="Completed" value={auctions.filter((a) => a.status === 'finished').length} />
      </div>

      <div className="row">
        <h2 style={{ fontSize: 18, fontWeight: 800, marginRight: 8 }}>Your auctions</h2>
        <div style={{ width: 380, maxWidth: '100%' }}>
          <Segmented
            label="Filter auctions"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'setup', label: 'Setup' },
              { value: 'live', label: 'Live' },
              { value: 'finished', label: 'Completed' },
            ]}
          />
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} type="search" placeholder="Search name or venue…" aria-label="Search auctions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="grid-4 stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
          {shown.map((a) => <AuctionCard key={a.id} a={a} />)}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Trophy size={30} />}
            title={auctions.length ? 'No auctions match' : 'Create your first auction'}
            action={!auctions.length && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />New auction</button>}
          >
            {auctions.length ? 'Try another filter or search.' : 'It takes a minute: name, sport, budget — then add teams and players.'}
          </EmptyState>
        </div>
      )}

      {creating && (
        <NewAuction
          onClose={() => setCreating(false)}
          onCreate={(id, blank) => navigate('/a/' + id + (blank ? '/teams' : ''))}
        />
      )}
    </main>
  );
}

function AuctionCard({ a }: { a: AuctionMeta }) {
  const navigate = useNavigate();
  const base = '/a/' + a.id;
  const color = SPORT_COLORS[a.sport] ?? '#475467';
  const live = a.status === 'live' || a.status === 'paused';
  const status =
    live ? <span className="pill pill-red"><span className="dot" />{a.status === 'live' ? 'Live' : 'Paused'}</span>
      : a.status === 'finished' ? <span className="pill pill-green">Completed</span>
        : <span className="pill pill-grey">Setup</span>;
  return (
    <article className="team-card">
      <div className="band" style={{ background: color, height: 6 }} />
      <div className="body">
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" style={{ background: color + '1a', color }}>{sportOf(a.sport).name}</span>
          {status}
        </div>
        <Link to={base} style={{ color: 'inherit', textDecoration: 'none' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.01em' }}>{a.name}</h3>
        </Link>
        <div className="muted" style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="row" style={{ gap: 6 }}><CalendarDays size={14} />{formatDate(a.date)}</span>
          {a.venue && <span className="row" style={{ gap: 6 }}><MapPin size={14} />{a.venue}</span>}
        </div>
        <div className="row" style={{ gap: 18 }}>
          <span className="row" style={{ gap: 6, fontSize: 13 }}><Users size={15} color="var(--muted)" /><b>{a.teams}</b> teams</span>
          <span className="row" style={{ gap: 6, fontSize: 13 }}><Gavel size={15} color="var(--muted)" /><b>{a.players}</b> players</span>
        </div>
        <div className="row" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line-2)', gap: 6, flexWrap: 'nowrap' }}>
          <Link className={'btn btn-sm ' + (live ? 'btn-accent' : 'btn-primary')} to={base + (live ? '/console' : a.status === 'finished' ? '/results' : '')}>
            {live ? 'Go to console' : a.status === 'finished' ? 'View results' : 'Open'}
          </Link>
          <ScreenLink className="btn btn-sm btn-icon" to={base + '/live'} aria-label="Open live screen" title="Live screen"><MonitorPlay size={15} /></ScreenLink>
          <span className="spacer" />
          <button
            className="btn btn-ghost btn-sm btn-icon"
            title="Make a copy with the same teams, players and rules"
            aria-label={'Copy ' + a.name}
            onClick={() => {
              const id = duplicateAuction(a.id);
              if (id) navigate('/a/' + id);
            }}
          >
            <Copy size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            title="Delete auction"
            aria-label={'Delete ' + a.name}
            onClick={() => confirm(`Delete "${a.name}" and all its teams, players and results? This cannot be undone.`) && deleteAuction(a.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function NewAuction({ onCreate, onClose }: { onCreate: (id: string, blank: boolean) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState<SportId>('cricket');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [unit, setUnit] = useState<Unit>('Cr');
  const [purse, setPurse] = useState(10);
  const [minSquad, setMinSquad] = useState(10);
  const [maxSquad, setMaxSquad] = useState(12);
  const [start, setStart] = useState<'blank' | 'demo'>('blank');
  const [error, setError] = useState('');

  const create = () => {
    if (!name.trim()) return setError('Give the auction a name.');
    if (minSquad > maxSquad) return setError('Min players cannot be more than max players.');
    const settings = { name: name.trim(), sport, date, venue: venue.trim(), unit, purse, minSquad, maxSquad };
    const state = start === 'demo' ? createDummyState(sport, settings) : createBlankState(settings);
    onCreate(createAuction(state), start === 'blank');
  };

  return (
    <Drawer
      title="New auction"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><span className="spacer" /><button className="btn btn-primary" onClick={create}><Plus size={16} />Create auction</button></>}
    >
      <label className="field">
        Auction / tournament name *
        <input className="input" autoFocus placeholder="e.g. Shivaji Nagar Premier League 2026" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      </label>
      <div className="field">
        Sport
        <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {SPORTS.map((s) => (
            <button key={s.id} type="button" className="choice" aria-pressed={sport === s.id} onClick={() => setSport(s.id)} style={{ fontSize: 12.5, padding: '8px 6px' }}>
              {s.name.replace(' sport', '')}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <label className="field">
          Date &amp; time
          <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          Venue
          <input className="input" placeholder="Ground / hall" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label className="field">
          Money unit
          <select className="select" value={unit} onChange={(e) => { const u = e.target.value as Unit; setUnit(u); setPurse(u === 'pts' ? 10000 : u === 'L' ? 100 : 10); }}>
            <option value="Cr">₹ Crore</option>
            <option value="L">₹ Lakh</option>
            <option value="pts">Points</option>
          </select>
        </label>
        <label className="field">
          Purse per team
          <input className="input" type="number" min={0} step="any" value={purse} onChange={(e) => setPurse(Number(e.target.value))} />
        </label>
        <label className="field">
          Min players / team
          <input className="input" type="number" min={1} value={minSquad} onChange={(e) => setMinSquad(Number(e.target.value))} />
        </label>
        <label className="field">
          Max players / team
          <input className="input" type="number" min={1} value={maxSquad} onChange={(e) => setMaxSquad(Number(e.target.value))} />
        </label>
      </div>
      <div className="field">
        Start with
        <div className="choice-grid">
          <button type="button" className="choice" aria-pressed={start === 'blank'} onClick={() => setStart('blank')} style={{ textAlign: 'left', padding: 12 }}>
            <strong style={{ display: 'block' }}>Empty auction</strong>
            <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Add my own teams &amp; players</span>
          </button>
          <button type="button" className="choice" aria-pressed={start === 'demo'} onClick={() => setStart('demo')} style={{ textAlign: 'left', padding: 12 }}>
            <strong style={{ display: 'block' }}>Demo data</strong>
            <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>8 teams, 96 players to try</span>
          </button>
        </div>
      </div>
      {error && <div className="banner banner-red" role="alert">{error}</div>}
      <p className="hint">Categories, bid increments and other rules can be changed later.</p>
    </Drawer>
  );
}
