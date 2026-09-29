import { ArrowLeft, Check, Gavel, LayoutDashboard, LayoutGrid, Menu, MonitorPlay, Plus, Settings2, Trophy, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../brand';
import { sportOf } from '../data/sports';
import { useAppState } from '../store/store';
import { useAuctionPath } from './AuctionRoute';

function Shell({ sidebar, title }: { sidebar: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className={'shell' + (open ? ' nav-open' : '')}>
      <aside className="sidebar" aria-label="Navigation">
        <Link to="/" className="brand">
          <span className="logo">{APP_NAME.slice(0, 2).toUpperCase()}</span>
          <span className="brand-name">
            {APP_NAME}
            <small>{APP_TAGLINE}</small>
          </span>
        </Link>
        {sidebar}
        <div className="sidebar-foot">Free plan · all features</div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="mobile-bar">
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="title">{title}</span>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

/** Layout for pages outside a single auction (My Auctions, Account). */
export function AppLayout() {
  return (
    <Shell
      title={APP_NAME}
      sidebar={
        <>
          <div className="nav-label">Workspace</div>
          <NavLink to="/" end className="nav-item"><LayoutGrid size={18} />My Auctions</NavLink>
          <NavLink to="/account" className="nav-item"><UserRound size={18} />Account</NavLink>
          <div className="nav-label">Quick start</div>
          <Link to="/?new=1" className="nav-item"><Plus size={18} />New auction</Link>
        </>
      }
    />
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return <span className={'step' + (done ? ' done' : '')}>{done ? <Check size={13} strokeWidth={3} /> : n}</span>;
}

/** Layout for the admin pages of one auction: steps down the side. */
export function AuctionLayout() {
  const { settings, auction, teams, players } = useAppState();
  const path = useAuctionPath();
  const detailsDone = !!settings.name && !!settings.date;
  const teamsDone = teams.length >= 2;
  const playersDone = teams.length > 0 && players.length >= teams.length * settings.minSquad;
  const live = auction.status === 'live' || auction.status === 'paused';
  const statusPill =
    live ? <span className="pill pill-red"><span className="dot" />{auction.status === 'live' ? 'Live' : 'Paused'}</span>
      : auction.status === 'finished' ? <span className="pill pill-green">Completed</span>
        : <span className="pill pill-grey">Setup</span>;

  return (
    <Shell
      title={settings.name}
      sidebar={
        <>
          <div className="auction-switch">
            <Link to="/"><ArrowLeft size={13} />All auctions</Link>
            <span className="name">{settings.name}</span>
            <span className="row" style={{ gap: 6 }}>
              <span className="pill pill-blue">{sportOf(settings.sport).name}</span>
              {statusPill}
            </span>
          </div>
          <NavLink to={path('')} end className="nav-item"><LayoutDashboard size={18} />Overview</NavLink>

          <div className="nav-label">Setup</div>
          <NavLink to={path('/settings')} className="nav-item"><Step n={1} done={detailsDone} />Details &amp; rules<Settings2 size={15} style={{ marginLeft: 'auto', opacity: 0.5 }} /></NavLink>
          <NavLink to={path('/teams')} className="nav-item"><Step n={2} done={teamsDone} />Teams<span className="count">{teams.length}</span></NavLink>
          <NavLink to={path('/players')} className="nav-item"><Step n={3} done={playersDone} />Players<span className="count">{players.length}</span></NavLink>

          <div className="nav-label">Auction day</div>
          <NavLink to={path('/console')} className="nav-item">
            <Gavel size={18} />Auction console
            {live && <span className="count" style={{ background: '#ef4444', color: '#fff' }}>LIVE</span>}
          </NavLink>
          <a href={path('/live')} target="_blank" rel="noreferrer" className="nav-item"><MonitorPlay size={18} />Live screen ↗</a>
          <a href={path('/owner')} target="_blank" rel="noreferrer" className="nav-item"><UsersRound size={18} />Owner bidding ↗</a>

          <div className="nav-label">After</div>
          <NavLink to={path('/results')} className="nav-item"><Trophy size={18} />Results</NavLink>
        </>
      }
    />
  );
}
