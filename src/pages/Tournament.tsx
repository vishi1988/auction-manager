// The tournament for everyone: players, owners and fans open this link on
// their phones to see fixtures, results, the points table and the
// leaderboards. It updates by itself as the organiser or scorer fills in scores.
import { BarChart3, CalendarDays, ListOrdered } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '../components/ui';
import { sportOf } from '../data/sports';
import { initials } from '../lib/format';
import { resultOf, tournamentOf } from '../lib/tournament';
import { useAppState } from '../store/store';
import { Fixtures, PointsTable, Stats } from './Matches';

type Tab = 'fixtures' | 'table' | 'stats';

export function Tournament() {
  const state = useAppState();
  const { settings } = state;
  const tour = tournamentOf(state);
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = asked === 'table' || asked === 'stats' ? asked : 'fixtures';
  const played = tour.matches.filter((m) => resultOf(m)).length;
  const hasLeague = tour.matches.some((m) => m.stage === 'league');

  return (
    <main className="page tour-public">
      <header className="tour-head">
        <span className="tour-logo">{initials(settings.name) || 'PA'}</span>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{sportOf(settings.sport).name} tournament</div>
          <h1>{settings.name}</h1>
          <p className="hint">
            {tour.matches.length ? `${tour.matches.length} matches · ${played} played` : 'Fixtures coming soon'}
            {settings.venue ? ' · ' + settings.venue : ''}
          </p>
        </div>
      </header>

      <Tabs
        label="Tournament sections"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'fixtures', label: 'Matches', icon: <CalendarDays size={16} /> },
          ...(hasLeague ? [{ value: 'table' as const, label: 'Table', icon: <ListOrdered size={16} /> }] : []),
          { value: 'stats', label: 'Stats', icon: <BarChart3 size={16} /> },
        ]}
      />

      <div className="tab-panel" key={tab}>
        {tab === 'fixtures' && <Fixtures state={state} pub />}
        {tab === 'table' && <PointsTable state={state} />}
        {tab === 'stats' && <Stats state={state} showToast={() => {}} pub />}
      </div>

      <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>
        Scores update by themselves · <a href="/" style={{ color: 'inherit' }}>KhiladiAuction</a>
      </p>
    </main>
  );
}
