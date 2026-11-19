import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { ShareCard, type CardTarget } from '../components/ShareCard';
import { PlayerAvatar, Segmented, TeamBadge, Toast, useToast } from '../components/ui';
import { exportResults } from '../lib/excel';
import { money } from '../lib/format';
import { categoryOf, teamStats } from '../lib/rules';
import { useAppState } from '../store/store';

type View = 'squads' | 'sold' | 'unsold' | 'log';

export function Results() {
  const state = useAppState();
  const { teams, settings, log, players } = state;
  const [view, setView] = useState<View>('squads');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [card, setCard] = useState<CardTarget | null>(null);
  const [toast, showToast] = useToast();
  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  const totalSpent = teams.reduce((sum, t) => sum + teamStats(state, t.id).spent, 0);
  const inSquads = players.filter((p) => p.status === 'sold' || p.status === 'retained').length;
  const unsold = players.filter((p) => p.status === 'unsold');
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? '';
  const teamName = (id?: string | null) => teams.find((t) => t.id === id)?.name ?? '';

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Auction Results</h1>
          <p>
            {inSquads} players in squads · {unsold.length} unsold · {money(totalSpent, settings.unit)} spent in total
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => window.print()}>Print / PDF</button>
          <button className="btn btn-primary" onClick={() => exportResults(state)}>Export to Excel</button>
        </div>
      </div>

      <div style={{ maxWidth: 520 }}>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'squads', label: 'Squads' },
            { value: 'sold', label: 'Sold players' },
            { value: 'unsold', label: `Unsold (${unsold.length})` },
            { value: 'log', label: 'Auction log' },
          ]}
        />
      </div>

      {view === 'squads' && team && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 480px)', gap: 24, alignItems: 'start' }} className="results-layout">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Team</th><th>Players</th><th>Spent</th><th>Purse left</th><th>Top buy</th></tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const st = teamStats(state, t.id);
                  const top = [...st.squad].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
                  return (
                    <tr key={t.id} className={t.id === team.id ? 'highlight' : undefined} onClick={() => setTeamId(t.id)} style={{ cursor: 'pointer' }}>
                      <td><span className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><TeamBadge team={t} size={32} /><strong>{t.name}</strong></span></td>
                      <td className="num">{st.count}</td>
                      <td className="num"><strong>{money(st.spent, settings.unit)}</strong></td>
                      <td className="num">{money(st.purseLeft, settings.unit)}</td>
                      <td className="muted">{top ? top.name + ' · ' + money(top.price, settings.unit) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="table-wrap" aria-label={team.name + ' squad'}>
            <div className="row" style={{ padding: '16px 18px', background: team.color, color: '#fff', flexWrap: 'nowrap' }}>
              <TeamBadge team={team} size={40} invert />
              <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="display" style={{ fontSize: 24, lineHeight: 1, textTransform: 'uppercase' }}>{team.name}</span>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Owner: {team.owner || '—'} · {teamStats(state, team.id).count} players</span>
              </span>
              <span style={{ fontSize: 13 }}>{money(teamStats(state, team.id).purseLeft, settings.unit)} left</span>
              <button className="btn btn-sm no-print" onClick={() => setCard({ kind: 'squad', team })}><Share2 size={15} />Share squad</button>
            </div>
            <table className="table">
              <tbody>
                {teamStats(state, team.id).squad
                  .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
                  .map((p, i) => (
                    <tr key={p.id}>
                      <td className="muted num">{i + 1}</td>
                      <td>
                        <strong>{p.name}</strong>
                        {p.status === 'retained' && <span style={{ color: 'var(--cream-ink)', fontSize: 12 }}> · Retained</span>}
                        {log.find((l) => l.playerId === p.id)?.type === 'rtm' && <span style={{ color: 'var(--cream-ink)', fontSize: 12 }}> · RTM</span>}
                        {log.find((l) => l.playerId === p.id)?.type === 'draw' && <span style={{ color: 'var(--cream-ink)', fontSize: 12 }}> · Lucky draw</span>}
                      </td>
                      <td className="muted">{p.role}</td>
                      <td className="num" style={{ textAlign: 'right' }}><strong>{money(p.price, settings.unit)}</strong></td>
                      <td className="no-print" style={{ width: 44 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" aria-label={'Share ' + p.name + ' card'} title="Share player card" onClick={() => setCard({ kind: 'sold', player: p })}><Share2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="row" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)', fontWeight: 600 }}>
              <span>Total spent</span><span className="spacer" /><span>{money(teamStats(state, team.id).spent, settings.unit)}</span>
            </div>
          </section>
        </div>
      )}

      {view === 'sold' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>No.</th><th /><th>Player</th><th>Role</th><th>Category</th><th>Team</th><th>Price</th><th className="no-print" /></tr></thead>
            <tbody>
              {players.filter((p) => p.status === 'sold').sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).map((p) => (
                <tr key={p.id}>
                  <td className="num muted">{p.no}</td>
                  <td><PlayerAvatar player={p} /></td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.role}</td>
                  <td>{categoryOf(state, p).name}</td>
                  <td>{teamName(p.teamId)}</td>
                  <td className="num"><strong>{money(p.price, settings.unit)}</strong></td>
                  <td className="no-print" style={{ width: 44 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label={'Share ' + p.name + ' card'} title="Share SOLD card" onClick={() => setCard({ kind: 'sold', player: p })}><Share2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!players.some((p) => p.status === 'sold') && <div className="empty">No players sold yet.</div>}
        </div>
      )}

      {view === 'unsold' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>No.</th><th>Player</th><th>Role</th><th>Category</th></tr></thead>
            <tbody>
              {unsold.map((p) => (
                <tr key={p.id}><td className="num muted">{p.no}</td><td><strong>{p.name}</strong></td><td>{p.role}</td><td>{categoryOf(state, p).name}</td></tr>
              ))}
            </tbody>
          </table>
          {!unsold.length && <div className="empty">No unsold players.</div>}
        </div>
      )}

      {view === 'log' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Time</th><th>Round</th><th>Result</th><th>Player</th><th>Team</th><th>Price</th></tr></thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i}>
                  <td className="num muted">{i + 1}</td>
                  <td className="num">{new Date(l.at).toLocaleTimeString()}</td>
                  <td>{l.round}</td>
                  <td>
                    <span className={l.type === 'unsold' ? 'pill pill-red' : l.type === 'rtm' ? 'pill pill-cream' : l.type === 'draw' ? 'pill pill-orange' : 'pill pill-green'}>{l.type === 'draw' ? 'LUCKY DRAW' : l.type.toUpperCase()}</span>
                    {l.entrants && <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>between {l.entrants.map((id) => teams.find((t) => t.id === id)?.short).join(', ')}</span>}
                  </td>
                  <td><strong>{name(l.playerId)}</strong></td>
                  <td>{teamName(l.teamId)}</td>
                  <td className="num">{l.amount != null ? money(l.amount, settings.unit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!log.length && <div className="empty">The auction log is empty.</div>}
        </div>
      )}
      {card && <ShareCard state={state} target={card} onClose={() => setCard(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </main>
  );
}
