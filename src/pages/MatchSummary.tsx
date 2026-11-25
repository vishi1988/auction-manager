// A played match as the public sees it: the result, Player of the Match and
// each side's scorecard (batting and bowling for cricket, a stats table for
// other sports). Nothing here can be changed.
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { PlayerAvatar, Segmented, TeamBadge } from '../components/ui';
import { scoringOf } from '../data/sportStats';
import { matchName, matchPoints, oversText, potmOf, resultText, sidePlayers, slotLabel, slotTeam, tournamentOf } from '../lib/tournament';
import { statLine } from '../lib/tournamentCards';
import type { AppState, Match, Player } from '../types';

const sr = (runs: number, balls: number) => (balls ? ((100 * runs) / balls).toFixed(1) : '–');
const econ = (runs: number, balls: number, per: number) => (balls ? ((runs * per) / balls).toFixed(2) : '–');

export function MatchSummary({ state, match: m, onBack }: { state: AppState; match: Match; onBack: () => void }) {
  const sc = scoringOf(state.settings.sport);
  const t = tournamentOf(state).settings;
  const cricket = sc.tiebreak === 'nrr';
  const [side, setSide] = useState<'a' | 'b'>(m.battedFirst ?? 'a');
  const other = side === 'a' ? 'b' : 'a';
  const potmId = potmOf(state, m);
  const potm = potmId ? state.players.find((p) => p.id === potmId) : undefined;
  const played = (k: 'a' | 'b') => sidePlayers(state, m, k).filter((p) => m.stats[p.id]);
  const mine = played(side);
  const theirs = played(other);
  const line = (p: Player) => m.stats[p.id] ?? {};
  const score = side === 'a' ? m.scoreA : m.scoreB;
  const when = [m.date && new Date(m.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), m.time, m.ground].filter(Boolean).join(' · ');

  const name = (p: Player) => (
    <span className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
      <PlayerAvatar player={p} />
      <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</strong>
      {p.id === potmId && <span title="Player of the Match">⭐</span>}
    </span>
  );

  const batters = mine.filter((p) => line(p).runs || line(p).balls || line(p).out);
  const bowlers = theirs.filter((p) => line(p).ballsBowled || line(p).wickets);
  const statCols = sc.stats.filter((d) => !d.flag && [...mine].some((p) => line(p)[d.key]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div><button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={15} />All matches</button></div>

      <div className="card" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{matchName(m)}{m.group ? ` · Group ${m.group}` : ''}{when ? ' · ' + when : ''}</span>
        {(['a', 'b'] as const).map((k) => {
          const team = slotTeam(state, m[k]);
          const s = k === 'a' ? m.scoreA : m.scoreB;
          return (
            <div key={k} className="match-side" style={{ fontSize: 16 }}>
              {team && <TeamBadge team={team} size={30} />}
              <span className="match-team">{slotLabel(state, m[k])}</span>
              <strong className="num">
                {s ? (cricket ? `${s.score}/${s.allOut ? 'all out' : s.wickets ?? 0}` : s.score) : '–'}
                {cricket && s?.balls != null && <span className="muted" style={{ fontWeight: 500 }}> ({oversText(s.balls, t.ballsPerOver)})</span>}
              </strong>
            </div>
          );
        })}
        <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{resultText(state, m)}</span>
      </div>

      {potm && (
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 30 }}>⭐</span>
          <PlayerAvatar player={potm} className="avatar avatar-lg" />
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Player of the Match</div>
            <strong style={{ fontSize: 17 }}>{potm.name}</strong>
            <div className="hint">{statLine(state, m.stats[potm.id])}</div>
          </div>
        </div>
      )}

      <Segmented
        label="Which team"
        value={side}
        onChange={setSide}
        options={(['a', 'b'] as const).map((k) => ({ value: k, label: slotLabel(state, m[k]) }))}
      />

      {mine.length + theirs.length === 0 && <p className="hint">The player scorecard for this match has not been filled in.</p>}

      {cricket ? (
        <>
          {batters.length > 0 && (
            <section className="table-wrap" aria-label="Batting">
              <h3 style={{ fontSize: 15, padding: '14px 14px 4px' }}>Batting · {slotLabel(state, m[side])}</h3>
              <table className="table score-table">
                <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
                <tbody>
                  {batters.map((p) => {
                    const l = line(p);
                    return (
                      <tr key={p.id}>
                        <td>{name(p)}<span className="hint">{l.out ? 'out' : 'not out'}</span></td>
                        <td className="num"><strong>{l.runs ?? 0}</strong></td>
                        <td className="num">{l.balls ?? 0}</td>
                        <td className="num">{l.fours ?? 0}</td>
                        <td className="num">{l.sixes ?? 0}</td>
                        <td className="num">{sr(l.runs ?? 0, l.balls ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {score?.extras != null && score.extras > 0 && <p className="hint" style={{ padding: '6px 14px 12px' }}>Extras: {score.extras}</p>}
            </section>
          )}
          {bowlers.length > 0 && (
            <section className="table-wrap" aria-label="Bowling">
              <h3 style={{ fontSize: 15, padding: '14px 14px 4px' }}>Bowling · {slotLabel(state, m[other])}</h3>
              <table className="table score-table">
                <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
                <tbody>
                  {bowlers.map((p) => {
                    const l = line(p);
                    return (
                      <tr key={p.id}>
                        <td>{name(p)}</td>
                        <td className="num">{oversText(l.ballsBowled ?? 0, t.ballsPerOver)}</td>
                        <td className="num">{l.maidens ?? 0}</td>
                        <td className="num">{l.runsGiven ?? 0}</td>
                        <td className="num"><strong>{l.wickets ?? 0}</strong></td>
                        <td className="num">{econ(l.runsGiven ?? 0, l.ballsBowled ?? 0, t.ballsPerOver)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
          {mine.length > 0 && (
            <section className="table-wrap" aria-label="Every player">
              <h3 style={{ fontSize: 15, padding: '14px 14px 4px' }}>Played for {slotLabel(state, m[side])}</h3>
              <table className="table score-table">
                <thead><tr><th>Player</th><th>Match</th><th>Pts</th></tr></thead>
                <tbody>
                  {mine.map((p) => (
                    <tr key={p.id}>
                      <td>{name(p)}</td>
                      <td>{statLine(state, line(p)) || <span className="muted">Did not bat or bowl</span>}</td>
                      <td className="num"><strong>{matchPoints(line(p), t)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      ) : (
        mine.length > 0 && (
          <section className="table-wrap" aria-label="Players">
            <table className="table score-table">
              <thead><tr><th>Player</th>{statCols.map((d) => <th key={d.key} title={d.label}>{d.short}</th>)}<th>Pts</th></tr></thead>
              <tbody>
                {mine.map((p) => (
                  <tr key={p.id}>
                    <td>{name(p)}</td>
                    {statCols.map((d) => <td key={d.key} className="num">{line(p)[d.key] ?? 0}</td>)}
                    <td className="num"><strong>{matchPoints(line(p), t)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      )}
    </div>
  );
}
