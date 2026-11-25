import { BarChart3, CalendarDays, Copy, Globe, ListOrdered, Pencil, Plus, Settings2, Share2, Trash2, Trophy } from 'lucide-react';
import { ShareCard } from '../components/ShareCard';
import { useAuctionPath } from '../components/AuctionRoute';
import { ScreenLink, shareUrl } from '../components/ScreenLink';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { copyText, Drawer, EmptyState, OptionRow, PlayerAvatar, Segmented, Switch, Tabs, TeamBadge, Toast, useToast } from '../components/ui';
import { scoringOf } from '../data/sportStats';
import {
  blankMatch,
  formatProblem,
  GROUP_LETTERS,
  generateFixtures,
  leaderboard,
  matchName,
  oversText,
  parseOvers,
  potmOf,
  potsOf,
  resultOf,
  resultText,
  seriesRace,
  slotLabel,
  slotTeam,
  STAGE_LABEL,
  standings,
  tournamentOf,
} from '../lib/tournament';
import { canSetUpTournament } from '../lib/roles';
import { isViewOnly, update, useAppState, useRole } from '../store/store';
import { MatchSummary } from './MatchSummary';
import { Scorecard } from './Scorecard';
import type { AppState, Match, MatchStage, SideScore, Tournament, TournamentSettings } from '../types';

type Tab = 'fixtures' | 'table' | 'stats' | 'setup';

/** Change the tournament (made with default settings the first time). */
function updateTour(recipe: (t: Tournament, s: AppState) => void) {
  update((s) => {
    s.tournament ??= tournamentOf(s);
    recipe(s.tournament, s);
  });
}

function Section({ title, text, children }: { title: string; text: ReactNode; children: ReactNode }) {
  return (
    <section className="set-section">
      <header>
        <h3>{title}</h3>
        <p>{text}</p>
      </header>
      <div className="set-body">{children}</div>
    </section>
  );
}

function Num({ value, onChange, label, min = 0, step = 1 }: { value: number; onChange: (v: number) => void; label: string; min?: number; step?: number }) {
  return (
    <input
      className="input input-sm num"
      type="number"
      inputMode="numeric"
      min={min}
      step={step}
      aria-label={label}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  );
}

export function Matches() {
  const state = useAppState();
  const tour = tournamentOf(state);
  const [params, setParams] = useSearchParams();
  const setup = canSetUpTournament(useRole());
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = asked && (asked !== 'setup' || setup) ? asked : tour.matches.length || !setup ? 'fixtures' : 'setup';
  const [toast, showToast] = useToast();
  const path = useAuctionPath();
  const played = tour.matches.filter((m) => resultOf(m)).length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">After the auction</div>
          <h1>Matches</h1>
          <p>
            {tour.matches.length ? `${tour.matches.length} matches · ${played} played` : 'Make the fixtures, then fill in scores after every match.'}
          </p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => copyText(shareUrl(path('/tournament')), showToast, 'Tournament page link copied')}><Copy size={15} />Copy public link</button>
          <ScreenLink className="btn btn-sm" to={path('/tournament')}><Globe size={15} />Public page</ScreenLink>
        </div>
      </div>

      <Tabs
        label="Tournament sections"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'fixtures', label: 'Fixtures', icon: <CalendarDays size={16} /> },
          { value: 'table', label: 'Points table', icon: <ListOrdered size={16} /> },
          { value: 'stats', label: 'Stats & awards', icon: <BarChart3 size={16} /> },
          ...(setup ? [{ value: 'setup' as const, label: 'Format & rules', icon: <Settings2 size={16} /> }] : []),
        ]}
      />

      <div className="tab-panel" key={tab}>
        {tab === 'fixtures' && <Fixtures state={state} onSetup={setup ? () => setParams({ tab: 'setup' }, { replace: true }) : undefined} />}
        {tab === 'table' && <PointsTable state={state} />}
        {tab === 'stats' && <Stats state={state} showToast={showToast} />}
        {tab === 'setup' && <Setup state={state} showToast={showToast} onMade={() => setParams({ tab: 'fixtures' }, { replace: true })} />}
      </div>
      <Toast msg={toast} />
    </main>
  );
}

// ---------- format & rules ----------

function Setup({ state, showToast, onMade }: { state: AppState; showToast: (m: string) => void; onMade: () => void }) {
  const tour = tournamentOf(state);
  const t = tour.settings;
  const sc = scoringOf(state.settings.sport);
  const cricket = sc.tiebreak === 'nrr';
  const set = <K extends keyof TournamentSettings>(k: K, v: TournamentSettings[K]) => updateTour((x) => void (x.settings[k] = v));
  const problem = formatProblem(t, state.teams.length);
  const preview = problem ? [] : generateFixtures(state.teams, t);
  const leagueCount = preview.filter((m) => m.stage === 'league').length;

  const make = () => {
    if (problem) return;
    const hasScores = tour.matches.some((m) => m.status !== 'upcoming');
    if (tour.matches.length && !window.confirm(hasScores ? 'Some matches already have results. Making new fixtures deletes all matches and their scores. Continue?' : 'Replace the current fixtures with new ones?')) return;
    updateTour((x, s) => {
      x.matches = generateFixtures(s.teams, x.settings);
      x.pots = null;
    });
    showToast(`${preview.length} matches made`);
    onMade();
  };

  return (
    <div className="card" style={{ padding: '8px 28px' }}>
      <Section title="Format" text="Choose how teams play. Nothing is fixed: any mix of league, groups and knockouts.">
        <div className="field">
          League rounds
          <Segmented label="League rounds" value={String(t.leagueRounds)} onChange={(v) => set('leagueRounds', Number(v))} options={[{ value: '0', label: 'No league' }, { value: '1', label: 'Once' }, { value: '2', label: 'Twice' }, { value: '3', label: '3 times' }]} />
          <span className="hint">How many times each team plays every other team in its group.</span>
        </div>
        {t.leagueRounds > 0 && (
          <label className="field">
            Groups
            <select className="select" value={t.groups} onChange={(e) => set('groups', Number(e.target.value))}>
              {Array.from({ length: GROUP_LETTERS.length }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? '1 group (all teams together)' : `${n} groups (${GROUP_LETTERS.slice(0, n).split('').join(', ')})`}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Knockouts
          <select className="select" value={t.knockout} onChange={(e) => set('knockout', e.target.value as TournamentSettings['knockout'])}>
            <option value="none">No knockouts (league winner is champion)</option>
            <option value="final">Final only (top 2)</option>
            <option value="semis">Semi-finals + final (top 4)</option>
            <option value="quarters">Quarter-finals + semis + final (top 8)</option>
            <option value="playoffs">IPL style: Qualifier 1, Eliminator, Qualifier 2, final (top 4)</option>
          </select>
        </label>
        {(t.knockout === 'semis' || t.knockout === 'quarters') && (
          <OptionRow title="3rd place match" control={<Switch label="3rd place match" checked={t.thirdPlace} onChange={(v) => set('thirdPlace', v)} />}>
            The two semi-final losers play for 3rd place.
          </OptionRow>
        )}
        {problem ? (
          <p className="hint" role="alert" style={{ color: 'var(--danger-ink)', fontWeight: 600 }}>{problem}</p>
        ) : (
          <p className="hint">
            {state.teams.length} teams → {leagueCount ? `${leagueCount} league matches` : 'no league'}
            {preview.length > leagueCount ? ` + ${preview.length - leagueCount} knockout matches` : ''} = <strong>{preview.length} matches</strong>.
          </p>
        )}
        <div className="row">
          <button className="btn btn-primary" disabled={!!problem || isViewOnly()} onClick={make}>
            <CalendarDays size={16} />
            {tour.matches.length ? 'Make fixtures again' : 'Make fixtures'}
          </button>
        </div>
      </Section>

      {cricket && (
        <Section title="Match length" text="Can be changed for a single match too (rain, short final).">
          <div className="grid-2">
            <label className="field">Overs per innings<Num label="Overs per innings" min={1} value={t.overs} onChange={(v) => set('overs', Math.max(1, v))} /></label>
            <label className="field">Balls per over<Num label="Balls per over" min={1} value={t.ballsPerOver} onChange={(v) => set('ballsPerOver', Math.max(1, v))} /></label>
            <label className="field">Players per side<Num label="Players per side" min={2} value={t.playersPerSide} onChange={(v) => set('playersPerSide', Math.max(2, v))} /></label>
          </div>
        </Section>
      )}

      <Section title="Points table" text={`Points for each result. Ties on points are split by ${cricket ? 'net run rate (NRR)' : 'score difference'}.`}>
        <div className="grid-2">
          {(['win', 'draw', 'noResult', 'loss'] as const).map((k) => (
            <label className="field" key={k}>
              {{ win: 'Win', draw: sc.drawLabel, noResult: 'No result / abandoned', loss: 'Loss' }[k]}
              <Num label={k} min={-10} value={t.points[k]} onChange={(v) => updateTour((x) => void (x.settings.points[k] = v))} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Awards" text="Automatic picks the player with the most award points. Manual lets you choose (the app still shows its top suggestions).">
        <OptionRow title="Player of the Match" control={<Segmented label="Player of the Match" value={t.potm} onChange={(v) => set('potm', v)} options={[{ value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'I choose' }]} />}>
          Even in automatic mode you can change it for any match.
        </OptionRow>
        <OptionRow title="Player of the Series" control={<Segmented label="Player of the Series" value={t.pots} onChange={(v) => set('pots', v)} options={[{ value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'I choose' }]} />}>
          Automatic gives it to the player with most award points across the tournament.
        </OptionRow>
      </Section>

      <Section title="Award points" text="Points a player earns for each stat in a match. Used for Player of the Match and Player of the Series.">
        <div className="grid-2">
          {sc.stats.filter((d) => !d.overs && d.key !== 'balls' && d.key !== 'runsGiven' && d.key !== 'out').map((d) => (
            <label className="field" key={d.key}>
              {d.label}
              <Num label={d.label} min={-100} value={t.weights[d.key] ?? 0} onChange={(v) => updateTour((x) => void (x.settings.weights[d.key] = v))} />
            </label>
          ))}
        </div>
        <strong style={{ fontSize: 13 }}>Milestone bonus (only the highest one reached counts)</strong>
        {t.bonuses.map((b, i) => (
          <div className="bonus-row" key={i}>
            <select className="select input-sm" aria-label="Stat" value={b.stat} onChange={(e) => updateTour((x) => void (x.settings.bonuses[i]!.stat = e.target.value))}>
              {sc.stats.filter((d) => !d.flag && !d.overs).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <span className="muted" title="at least">≥</span>
            <Num label="At least" value={b.atLeast} onChange={(v) => updateTour((x) => void (x.settings.bonuses[i]!.atLeast = v))} />
            <span className="muted">+</span>
            <Num label="Bonus points" value={b.points} onChange={(v) => updateTour((x) => void (x.settings.bonuses[i]!.points = v))} />
            <button className="btn btn-ghost btn-icon" aria-label="Remove bonus" onClick={() => updateTour((x) => void x.settings.bonuses.splice(i, 1))}><Trash2 size={16} /></button>
          </div>
        ))}
        <div className="row">
          <button className="btn btn-sm" onClick={() => updateTour((x) => void x.settings.bonuses.push({ stat: sc.stats[0]!.key, atLeast: 10, points: 5 }))}><Plus size={15} />Add bonus</button>
        </div>
      </Section>
    </div>
  );
}

// ---------- fixtures ----------

const STAGE_ORDER: MatchStage[] = ['league', 'qf', 'q1', 'elim', 'q2', 'sf', 'third', 'final'];

/**
 * The fixtures, grouped by stage. `pub` is the read-only public page: played
 * matches open a scorecard summary and nothing can be changed.
 */
export function Fixtures({ state, onSetup, pub = false }: { state: AppState; onSetup?: () => void; pub?: boolean }) {
  const tour = tournamentOf(state);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [params, setParams] = useSearchParams();
  const openId = params.get('match');
  const openCard = (id: string | null) => {
    setParams(id ? { tab: 'fixtures', match: id } : { tab: 'fixtures' });
    window.scrollTo({ top: 0 });
  };
  const open = openId ? tour.matches.find((m) => m.id === openId) : undefined;
  const drawerFor = editing && editing !== 'new' ? tour.matches.find((m) => m.id === editing) : undefined;
  const drawer = editing && (editing === 'new' || drawerFor) && (
    <MatchDrawer state={state} match={drawerFor} onClose={() => setEditing(null)} onScorecard={(id) => { setEditing(null); openCard(id); }} />
  );
  if (open && pub) return <MatchSummary state={state} match={open} onBack={() => openCard(null)} />;
  if (open) {
    return (
      <>
        <Scorecard state={state} match={open} onBack={() => openCard(null)} onEditDetails={() => setEditing(open.id)} />
        {drawer}
      </>
    );
  }
  if (!tour.matches.length) {
    return (
      <EmptyState icon={<CalendarDays size={28} />} title="No fixtures yet" action={onSetup && <button className="btn btn-primary" onClick={onSetup}>Choose format</button>}>
        {pub ? 'The organiser has not made the fixtures yet. Check back soon.' : onSetup ? 'Choose the format (league, groups, knockouts) and the app makes every match for you.' : 'The organiser has not made the fixtures yet.'}
      </EmptyState>
    );
  }
  const sorted = [...tour.matches].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.no - b.no);
  const stages = STAGE_ORDER.filter((st) => sorted.some((m) => m.stage === st));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {onSetup && !pub && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" disabled={isViewOnly()} onClick={() => setEditing('new')}><Plus size={15} />Add match</button>
        </div>
      )}
      {stages.map((st) => (
        <section key={st} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 16 }}>{st === 'league' ? 'League' : STAGE_LABEL[st] + (sorted.filter((m) => m.stage === st).length > 1 ? 's' : '')}</h2>
          <div className="match-grid">
            {sorted.filter((m) => m.stage === st).map((m) => <MatchCard key={m.id} state={state} m={m} pub={pub} onEdit={() => (m.status === 'done' ? openCard(m.id) : setEditing(m.id))} />)}
          </div>
        </section>
      ))}
      {!pub && drawer}
    </div>
  );
}

function scoreText(score: SideScore | null | undefined, cricket: boolean, perOver: number): string {
  if (!score) return '';
  if (!cricket) return String(score.score);
  return `${score.score}/${score.allOut ? 'all out' : score.wickets ?? 0}` + (score.balls != null ? ` (${oversText(score.balls, perOver)})` : '');
}

function MatchCard({ state, m, onEdit, pub }: { state: AppState; m: Match; onEdit: () => void; pub: boolean }) {
  const t = tournamentOf(state).settings;
  const cricket = scoringOf(state.settings.sport).tiebreak === 'nrr';
  const r = resultOf(m);
  const potm = potmOf(state, m);
  const potmPlayer = potm ? state.players.find((p) => p.id === potm) : undefined;
  const side = (k: 'a' | 'b') => {
    const team = slotTeam(state, m[k]);
    const score = k === 'a' ? m.scoreA : m.scoreB;
    const won = r === k;
    return (
      <div className="match-side" style={{ fontWeight: won ? 700 : 500, opacity: r && r !== 'nr' && r !== 'draw' && !won ? 0.65 : 1 }}>
        {team ? <TeamBadge team={team} size={28} /> : <span className="team-badge" style={{ width: 28, height: 28, background: 'var(--line-2)', color: 'var(--muted)', fontSize: 12 }}>?</span>}
        <span className="match-team">{slotLabel(state, m[k])}</span>
        <span className="num">{scoreText(score, cricket, t.ballsPerOver)}</span>
      </div>
    );
  };
  const when = [m.date && new Date(m.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), m.time, m.ground].filter(Boolean).join(' · ');
  return (
    <button type="button" className={'card match-card' + (pub ? ' match-card-pub' : '')} onClick={onEdit} disabled={pub ? m.status !== 'done' : isViewOnly()}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>
          Match {m.no}{m.group ? ` · Group ${m.group}` : ''}
        </span>
        {m.status === 'done' ? <span className="pill pill-green">Result</span> : m.status === 'abandoned' ? <span className="pill pill-grey">Abandoned</span> : <span className="pill pill-blue">Upcoming</span>}
      </div>
      {side('a')}
      {side('b')}
      {r ? <p className="hint" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{resultText(state, m)}</p> : <p className="hint">{when || (pub ? 'Date to be announced' : 'Tap to set date, time and ground')}</p>}
      {r && pub && when && <p className="hint">{when}</p>}
      {potmPlayer && <p className="hint">⭐ Player of the Match: <strong>{potmPlayer.name}</strong></p>}
      {!pub && <span className="match-edit"><Pencil size={14} /></span>}
      {pub && m.status === 'done' && <span className="hint" style={{ color: 'var(--primary)', fontWeight: 600 }}>Scorecard →</span>}
    </button>
  );
}

/** Edit one match: when and where, who plays, and the result. Player scorecards come in the next step. */
function MatchDrawer({ state, match, onClose, onScorecard }: { state: AppState; match?: Match; onClose: () => void; onScorecard: (id: string) => void }) {
  const role = useRole();
  const tour = tournamentOf(state);
  const t = tour.settings;
  const sc = scoringOf(state.settings.sport);
  const cricket = sc.tiebreak === 'nrr';
  const [draft, setDraft] = useState<Match>(() => structuredClone(match ?? blankMatch(Math.max(0, ...tour.matches.map((m) => m.no)) + 1, 'league', { teamId: state.teams[0]?.id }, { teamId: state.teams[1]?.id })));
  const oversOf = (s?: SideScore | null) => (s?.balls == null ? '' : oversText(s.balls, t.ballsPerOver));
  const [oversA, setOversA] = useState(oversOf(draft.scoreA));
  const [oversB, setOversB] = useState(oversOf(draft.scoreB));
  const edit = (recipe: (d: Match) => void) =>
    setDraft((d) => {
      const next = structuredClone(d);
      recipe(next);
      return next;
    });
  const setScore = (k: 'scoreA' | 'scoreB', patch: Partial<SideScore>) => edit((d) => void (d[k] = { score: 0, ...d[k], ...patch }));
  const nameA = slotLabel(state, draft.a);
  const nameB = slotLabel(state, draft.b);

  const save = (toScorecard = false) => {
    const out = structuredClone(draft);
    for (const [k, text] of [['scoreA', oversA], ['scoreB', oversB]] as const) {
      const sc0 = out[k];
      if (sc0 && cricket) {
        const balls = text.trim() ? parseOvers(text, t.ballsPerOver) : null;
        if (balls == null) delete sc0.balls;
        else sc0.balls = balls;
      }
    }
    // Scores typed: the match is played.
    if (out.status === 'upcoming' && out.scoreA && out.scoreB) out.status = 'done';
    updateTour((x) => {
      const i = x.matches.findIndex((m) => m.id === out.id);
      // The scorecard (player numbers, Player of the Match) is changed elsewhere: keep the saved one.
      const old = x.matches[i];
      if (old) x.matches[i] = { ...out, stats: old.stats, subs: old.subs, potm: old.potm };
      else x.matches.push(out);
      // Extras are typed on the scorecard, not here.
      for (const k of ['scoreA', 'scoreB'] as const) {
        const now = x.matches[i]?.[k];
        if (old && now) now.extras = old[k]?.extras;
      }
    });
    if (toScorecard) onScorecard(out.id);
    else onClose();
  };
  const remove = () => {
    if (!match || !window.confirm(`Delete ${matchName(match)}?`)) return;
    updateTour((x) => void (x.matches = x.matches.filter((m) => m.id !== match.id)));
    onClose();
  };
  const badOvers = cricket && [oversA, oversB].some((o) => o.trim() && parseOvers(o, t.ballsPerOver) == null);
  const canSave = !badOvers && (!!draft.a.teamId || !!draft.a.from) && (!!draft.b.teamId || !!draft.b.from);

  const teamPick = (k: 'a' | 'b') => (
    <label className="field">
      {k === 'a' ? 'Team 1' : 'Team 2'}
      <select className="select" value={draft[k].teamId ?? ''} onChange={(e) => edit((d) => void (d[k] = { ...d[k], teamId: e.target.value || null }))}>
        {draft[k].from && <option value="">Automatic: {slotLabel(state, { from: draft[k].from })}</option>}
        {!draft[k].from && <option value="">Choose team</option>}
        {state.teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  );

  const scoreBlock = (k: 'scoreA' | 'scoreB', name: string, overs: string, setOvers: (v: string) => void) => {
    const s = draft[k];
    return (
      <fieldset className="score-box">
        <legend>{name}</legend>
        <div className={cricket ? 'grid-2' : undefined}>
          <label className="field">{sc.scoreLabel}<Num label={name + ' ' + sc.scoreLabel} value={s?.score ?? NaN} onChange={(v) => setScore(k, { score: v })} /></label>
          {cricket && <label className="field">Wickets<Num label={name + ' wickets'} value={s?.wickets ?? NaN} onChange={(v) => setScore(k, { wickets: v })} /></label>}
          {cricket && (
            <label className="field">
              Overs
              <input className="input input-sm num" inputMode="decimal" placeholder={`e.g. ${t.overs}.0 or 5.3`} value={overs} onChange={(e) => setOvers(e.target.value)} aria-label={name + ' overs'} />
            </label>
          )}
          {cricket && (
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={!!s?.allOut} onChange={(e) => setScore(k, { allOut: e.target.checked })} />All out
            </label>
          )}
        </div>
      </fieldset>
    );
  };

  return (
    <Drawer
      title={match ? matchName(match) : 'New match'}
      onClose={onClose}
      footer={
        <>
          {match && canSetUpTournament(role) && <button className="btn btn-danger" onClick={remove}><Trash2 size={15} />Delete</button>}
          <button className={'btn' + (draft.status === 'done' ? '' : ' btn-primary')} style={{ marginLeft: 'auto' }} disabled={!canSave} onClick={() => save()}>Save</button>
          {draft.status === 'done' && <button className="btn btn-primary" disabled={!canSave} onClick={() => save(true)}>Save &amp; scorecard</button>}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grid-2">
          {teamPick('a')}
          {teamPick('b')}
        </div>
        {!match && (
          <label className="field">
            Stage
            <select className="select" value={draft.stage} onChange={(e) => edit((d) => void (d.stage = e.target.value as MatchStage))}>
              {STAGE_ORDER.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
            </select>
          </label>
        )}
        <div className="grid-2">
          <label className="field">Date<input className="input" type="date" value={draft.date} onChange={(e) => edit((d) => void (d.date = e.target.value))} /></label>
          <label className="field">Time<input className="input" type="time" value={draft.time} onChange={(e) => edit((d) => void (d.time = e.target.value))} /></label>
        </div>
        <label className="field">Ground<input className="input" value={draft.ground} placeholder={state.settings.venue || 'Ground name'} onChange={(e) => edit((d) => void (d.ground = e.target.value))} /></label>
        {cricket && (
          <label className="field">
            Overs for this match
            <Num label="Overs for this match" min={1} value={draft.overs ?? t.overs} onChange={(v) => edit((d) => void (d.overs = v === t.overs ? null : Math.max(1, v)))} />
          </label>
        )}

        <Segmented
          label="Match status"
          value={draft.status}
          onChange={(v) => edit((d) => void (d.status = v))}
          options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'done', label: 'Played' }, { value: 'abandoned', label: 'Abandoned' }]}
        />

        {draft.status === 'done' && (
          <>
            {cricket && (
              <label className="field">
                Batted first
                <select className="select" value={draft.battedFirst ?? ''} onChange={(e) => edit((d) => void (d.battedFirst = (e.target.value || null) as Match['battedFirst']))}>
                  <option value="">Not set</option>
                  <option value="a">{nameA}</option>
                  <option value="b">{nameB}</option>
                </select>
              </label>
            )}
            {scoreBlock('scoreA', nameA, oversA, setOversA)}
            {scoreBlock('scoreB', nameB, oversB, setOversB)}
            {badOvers && <p className="hint" style={{ color: 'var(--danger-ink)' }}>Overs look wrong. Write them like 5.3 (5 overs and 3 balls).</p>}
            <label className="field">
              Result
              <select className="select" value={draft.result ?? ''} onChange={(e) => edit((d) => void (d.result = (e.target.value || null) as Match['result']))}>
                <option value="">From the score</option>
                <option value="a">{nameA} won</option>
                <option value="b">{nameB} won</option>
                <option value="draw">{sc.drawLabel}</option>
                <option value="nr">No result</option>
              </select>
              <span className="hint">Change only for a super over, walkover or a rule decision.</span>
            </label>
            <label className="field">Note (optional)<input className="input" value={draft.note ?? ''} placeholder="e.g. Won the super over" onChange={(e) => edit((d) => void (d.note = e.target.value))} /></label>
          </>
        )}
      </div>
    </Drawer>
  );
}

// ---------- points table ----------

export function PointsTable({ state }: { state: AppState }) {
  const tables = standings(state);
  const cricket = scoringOf(state.settings.sport).tiebreak === 'nrr';
  const groups = Object.keys(tables).sort();
  if (!groups.length) {
    return <EmptyState icon={<ListOrdered size={28} />} title="No league yet">The points table appears once there are league matches.</EmptyState>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {groups.map((g) => (
        <section key={g} className="table-wrap" aria-label={groups.length > 1 ? 'Group ' + g : 'Points table'}>
          {groups.length > 1 && <h2 style={{ fontSize: 15, padding: '14px 14px 4px' }}>Group {g}</h2>}
          <table className="table points-table">
            <thead>
              <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>{cricket ? 'T' : 'D'}</th><th>NR</th><th>{cricket ? 'NRR' : 'Diff'}</th><th>Pts</th><th className="pt-form">Form</th></tr>
            </thead>
            <tbody>
              {tables[g]!.map((r, i) => {
                const team = state.teams.find((x) => x.id === r.teamId);
                return (
                  <tr key={r.teamId}>
                    <td className="num">{i + 1}</td>
                    <td>{team && <span className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><TeamBadge team={team} size={28} /><strong>{team.name}</strong></span>}</td>
                    <td className="num">{r.played}</td>
                    <td className="num">{r.won}</td>
                    <td className="num">{r.lost}</td>
                    <td className="num">{r.drawn}</td>
                    <td className="num">{r.noResult}</td>
                    <td className="num">{cricket ? (r.nrr > 0 ? '+' : '') + r.nrr.toFixed(3) : (r.for - r.against > 0 ? '+' : '') + (r.for - r.against)}</td>
                    <td className="num"><strong>{r.points}</strong></td>
                    <td className="pt-form"><span className="row" style={{ gap: 3, flexWrap: 'nowrap' }}>{r.form.map((f, j) => <span key={j} className={'form-dot form-' + f}>{f}</span>)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

// ---------- stats & awards ----------

export function Stats({ state, showToast, pub = false }: { state: AppState; showToast: (m: string) => void; pub?: boolean }) {
  const [sharing, setSharing] = useState(false);
  const sc = scoringOf(state.settings.sport);
  const race = seriesRace(state).slice(0, 10);
  const pots = potsOf(state);
  const player = (id: string) => state.players.find((p) => p.id === id);
  const teamOf = (id: string) => state.teams.find((t) => t.id === player(id)?.teamId);
  const potsPlayer = pots ? player(pots) : undefined;
  const t = tournamentOf(state).settings;

  if (!race.length) {
    return (
      <EmptyState icon={<Trophy size={28} />} title="No player stats yet">
        Leaderboards ({sc.leaderboards.map((b) => b.title).join(', ')}) and Player of the Series fill up as player scorecards are entered after matches.
      </EmptyState>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {!pub && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setSharing(true)}><Share2 size={15} />Share awards picture</button>
        </div>
      )}
      {sharing && <ShareCard state={state} target={{ kind: 'awards' }} onClose={() => setSharing(false)} showToast={showToast} />}
      <div className="card" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 34 }}>🏆</span>
        <div style={{ flex: '1 1 160px' }}>
          <div className="eyebrow">Player of the Series {t.pots === 'auto' && !tournamentOf(state).pots ? '(leading now)' : ''}</div>
          <strong style={{ fontSize: 18 }}>{potsPlayer?.name ?? 'Not chosen yet'}</strong>
        </div>
        {!pub && <select
          className="select input-sm"
          style={{ flex: '1 1 220px', maxWidth: 320 }}
          aria-label="Choose Player of the Series"
          value={tournamentOf(state).pots ?? ''}
          disabled={isViewOnly()}
          onChange={(e) => updateTour((x) => void (x.pots = e.target.value || null))}
        >
          <option value="">{t.pots === 'auto' ? 'Automatic (most points)' : 'Choose…'}</option>
          {race.map((r) => <option key={r.playerId} value={r.playerId}>{player(r.playerId)?.name} · {r.points} pts</option>)}
        </select>}
      </div>

      <div className="match-grid">
        <Board title="Series points race" icon="⭐" rows={race.map((r) => ({ id: r.playerId, shown: r.points + ' pts' }))} state={state} teamOf={teamOf} />
        {sc.leaderboards.map((b) => (
          <Board key={b.id} title={`${b.title} · ${b.label}`} icon={b.icon} rows={leaderboard(state, b).slice(0, 5).map((r) => ({ id: r.playerId, shown: r.shown }))} state={state} teamOf={teamOf} />
        ))}
      </div>
    </div>
  );
}

function Board({ title, icon, rows, state, teamOf }: { title: string; icon: string; rows: { id: string; shown: string }[]; state: AppState; teamOf: (id: string) => AppState['teams'][number] | undefined }) {
  return (
    <section className="card" aria-label={title} style={{ gap: 10 }}>
      <h3 style={{ fontSize: 15 }}>{icon} {title}</h3>
      {rows.length === 0 && <p className="hint">Nobody yet.</p>}
      {rows.map((r, i) => {
        const p = state.players.find((x) => x.id === r.id);
        const team = teamOf(r.id);
        if (!p) return null;
        return (
          <div key={r.id} className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
            <span className="num muted" style={{ width: 16 }}>{i + 1}</span>
            <PlayerAvatar player={p} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</strong>
              <span className="hint">{team?.name ?? ''}</span>
            </span>
            <strong className="num">{r.shown}</strong>
          </div>
        );
      })}
    </section>
  );
}
