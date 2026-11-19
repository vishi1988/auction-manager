import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EMBED } from './components/ScreenLink';
import { AuctionRoute, RequireRole } from './components/AuctionRoute';
import { AppLayout, AuctionLayout } from './components/Layout';
import './styles/app.css';

// Each page loads on its own, so phones opening the live screen, owner
// bidding or registration link only download what that page needs.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const Home = page(() => import('./pages/Home'), 'Home');
const Account = page(() => import('./pages/Account'), 'Account');
const Admin = page(() => import('./pages/Admin'), 'Admin');
const Overview = page(() => import('./pages/Overview'), 'Overview');
const Settings = page(() => import('./pages/Settings'), 'Settings');
const Teams = page(() => import('./pages/Teams'), 'Teams');
const Players = page(() => import('./pages/Players'), 'Players');
const Team = page(() => import('./pages/Team'), 'Team');
const Console = page(() => import('./pages/Console'), 'Console');
const Results = page(() => import('./pages/Results'), 'Results');
const Live = page(() => import('./pages/Live'), 'Live');
const Overlay = page(() => import('./pages/Overlay'), 'Overlay');
const Owner = page(() => import('./pages/Owner'), 'Owner');
const Register = page(() => import('./pages/Register'), 'Register');

function Loading() {
  return (
    <div className="empty" style={{ minHeight: '50vh', justifyContent: 'center' }}>
      <span className="live-dot" style={{ background: 'var(--primary)' }} />
    </div>
  );
}

// The embed preview lives in a sandboxed frame with no server behind it, so it
// keeps the route in the URL hash. The normal build uses real paths.
function Router({ children }: { children: React.ReactNode }) {
  return EMBED ? <HashRouter>{children}</HashRouter> : <BrowserRouter basename={import.meta.env.BASE_URL}>{children}</BrowserRouter>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="account" element={<Account />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="a/:auctionId" element={<AuctionRoute />}>
            <Route element={<AuctionLayout />}>
              <Route index element={<Overview />} />
              <Route path="settings" element={<RequireRole area="settings"><Settings /></RequireRole>} />
              <Route path="teams" element={<RequireRole area="teams"><Teams /></RequireRole>} />
              <Route path="players" element={<RequireRole area="players"><Players /></RequireRole>} />
              <Route path="console" element={<RequireRole area="console"><Console /></RequireRole>} />
              <Route path="results" element={<RequireRole area="results"><Results /></RequireRole>} />
              <Route path="team" element={<RequireRole area="team"><Team /></RequireRole>} />
            </Route>
            {/* Public screens: no admin menu */}
            <Route path="live" element={<Live />} />
            <Route path="overlay" element={<Overlay />} />
            <Route path="owner" element={<Owner />} />
            <Route path="owner/:teamId" element={<Owner />} />
            <Route path="register" element={<Register />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  </StrictMode>,
);
