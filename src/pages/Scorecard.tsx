// One match's player scorecard: every player's numbers, the checks that they
// add up, and Player of the Match. Built for a phone held at the ground: one
// player per card, big inputs, and every change saved as it is typed.
import { AlertTriangle, ArrowLeft, Plus, Share2, Star, UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { ShareCard, type CardTarget } from '../components/ShareCard';
import { PlayerAvatar, Segmented, Toast, useToast } from '../components/ui';
import { scoringOf, type StatDef } from '../data/sportStats';
import { matchName, matchPoints, oversText, parseOvers, potmOf, resultText, scorecardWarnings, sidePlayers, slotLabel, slotTeam, topScorers, tournamentOf } from '../lib/tournament';
import { isViewOnly, update } from '../store/store';
import type { AppState, Match, Player } from '../types';

/** Change this match (inside the tournament) and save. */
function updateMatch(id: string, recipe: (m: Match) => void) {
  update((s) => {
    const m = s.tournament?.matches.find((x) => x.id === id);
    if (m) recipe(m);
  });
}

function StatInput({ def, value, perOver, onChange, disabled }: { def: StatDef; value: number | undefined; perOver: number; onChange: (v: number | undefined) => void; disabled: boolean }) {
  // Overs are typed as "2.3", so keep the text while it is being typed.
  const [text, setText] = useState(value == null ? '' : oversText(value, perOver));
  if (def.flag) {
    return (
      <label className="stat-cell stat-flag">
        <span>{def.short}</span>
        <input type="checkbox" aria-label={def.label} checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
      </label>
    );
  }
  if (def.overs) {
    const bad = text.trim() !== '' && parseOvers(text, perOver) == null;
    return (
      <label className="stat-cell">
        <span>{def.short}</span>
        <input
          className={'input input-sm num' + (bad ? ' input-bad' : '')}
          inputMode="decimal"
          aria-label={def.label}
          placeholder="0.0"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            const balls = e.target.value.trim() === '' ? undefined : parseOvers(e.target.value, perOver);
            if (balls !== null) onChange(balls);
          }}
        />
      </label>
    );
  }
  return (
    <label className="stat-cell">
      <span>{def.short}</span>
      <input
        className="input input-sm num"
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={def.label}
        placeholder="0"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value))))}
      />
    </label>
  );
}

export function Scorecard({ state, match: m, onBack, onEditDetails }: { state: AppState; match: Match; onBack: () => void; onEditDetails: () => void }) {
  const sc = scoringOf(state.settings.sport);
  const t = tournamentOf(state).settings;
  const cricket = sc.tiebreak === 'nrr';
  const groups = [...new Set(sc.stats.map((d) => d.group))];
  const [side, setSide] = useState<'a' | 'b'>('a');
  const [group, setGroup] = useState(groups[0]!);
  const [adding, setAdding] = useState(false);
  const [card, setCard] = useState<CardTarget | null>(null);
  const [toast, showToast] = useToast();
  const ro = isViewOnly();
  const players = sidePlayers(state, m, side);
  const team = slotTeam(state, m[side]);
  const score = side === 'a' ? m.scoreA : m.scoreB;
  const warnings = scorecardWarnings(state, m);
  const defs = sc.stats.filter((d) => d.group === group);
  const inMatch = new Set([...sidePlayers(state, m, 'a'), ...sidePlayers(state, m, 'b')].map((p) => p.id));

  const setStat = (pid: string, key: string, v: number | undefined) =>
    updateMatch(m.id, (x) => {
      const line = (x.stats[pid] ??= {});
      if (v == null || v === 0) delete line[key];
      else line[key] = v;
    });
  const setPlayed = (pid: string, played: boolean) =>
    updateMatch(m.id, (x) => {
      if (played) x.stats[pid] ??= {};
      else delete x.stats[pid];
    });
  const allPlayed = () => updateMatch(m.id, (x) => void players.forEach((p) => (x.stats[p.id] ??= {})));
  const addSub = (pid: string) => {
    updateMatch(m.id, (x) => {
      x.subs ??= {};
      x.subs[side] = [...(x.subs[side] ?? []), pid];
      x.stats[pid] ??= {};
    });
    setAdding(false);
  };
  const removeSub = (pid: string) =>
    updateMatch(m.id, (x) => {
      x.subs = { ...x.subs, [side]: (x.subs?.[side] ?? []).filter((id) => id !== pid) };
      delete x.stats[pid];
    });
  const isSub = (pid: string) => (m.subs?.[side] ?? []).includes(pid);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={15} />All matches</button>
        <button className="btn btn-sm" onClick={onEditDetails} disabled={ro}>Edit score &amp; details</button>
      </div>

      <div className="card" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{matchName(m)}{m.group ? ` · Group ${m.group}` : ''}</span>
        <strong style={{ fontSize: 17 }}>{slotLabel(state, m.a)} vs {slotLabel(state, m.b)}</strong>
        <span className="hint" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{resultText(state, m) || 'Result not entered yet. Use "Edit score & details".'}</span>
        {m.status === 'done' && (
          <div><button className="btn btn-sm" onClick={() => setCard({ kind: 'result', match: m })}><Share2 size={15} />Share result</button></div>
        )}
      </div>

      <PotmPicker state={state} match={m} onShare={(playerId) => setCard({ kind: 'potm', match: m, playerId })} />

      {warnings.length > 0 && (
        <div className="banner banner-cream" role="alert" style={{ alignItems: 'flex-start' }}>
          <AlertTriangle size={18} />
          <span>
            <strong>Check the numbers:</strong>
            {warnings.map((w) => <span key={w} style={{ display: 'block' }}>{w}</span>)}
          </span>
        </div>
      )}

      <Segmented label="Team" value={side} onChange={setSide} options={[{ value: 'a', label: slotLabel(state, m.a) }, { value: 'b', label: slotLabel(state, m.b) }]} />
      {groups.length > 1 && <Segmented label="Section" value={group} onChange={setGroup} options={groups.map((g) => ({ value: g, label: g }))} />}

      {cricket && score && group === 'Batting' && (
        <label className="field" style={{ maxWidth: 220 }}>
          Extras (wides, no-balls, byes)
          <input
            className="input input-sm num"
            type="number"
            inputMode="numeric"
            min={0}
            value={score.extras ?? ''}
            placeholder="0"
            disabled={ro}
            onChange={(e) => updateMatch(m.id, (x) => {
              const s = side === 'a' ? x.scoreA : x.scoreB;
              if (s) s.extras = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
            })}
          />
        </label>
      )}

      {players.length === 0 ? (
        <div className="empty" style={{ padding: 24 }}>
          <UsersRound size={26} />
          <p style={{ margin: 0 }}>{team ? `${team.name} has no players in its squad yet (players join a squad when they are sold in the auction).` : 'This team is not decided yet.'}</p>
        </div>
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="hint">Tick who played. Typing a number ticks the player too.</span>
            <button className="btn btn-sm" disabled={ro} onClick={allPlayed}>Everyone played</button>
          </div>
          <div className="score-list">
            {players.map((p) => (
              <PlayerLine
                key={p.id + group}
                player={p}
                line={m.stats[p.id]}
                defs={defs}
                perOver={t.ballsPerOver}
                points={matchPoints(m.stats[p.id], t)}
                sub={isSub(p.id)}
                disabled={ro}
                onPlayed={(v) => setPlayed(p.id, v)}
                onStat={(k, v) => setStat(p.id, k, v)}
                onRemove={() => removeSub(p.id)}
              />
            ))}
          </div>
        </>
      )}

      {team && !ro && (
        adding ? (
          <label className="field">
            Add a player for this match (guest or substitute)
            <select className="select" defaultValue="" onChange={(e) => e.target.value && addSub(e.target.value)}>
              <option value="">Choose player…</option>
              {state.players.filter((p) => !inMatch.has(p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.teamId ? ` (${state.teams.find((x) => x.id === p.teamId)?.short ?? ''})` : ''}</option>
              ))}
            </select>
          </label>
        ) : (
          <div><button className="btn btn-sm" onClick={() => setAdding(true)}><Plus size={15} />Add player</button></div>
        )
      )}
      {card && <ShareCard state={state} target={card} onClose={() => setCard(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </div>
  );
}

function PlayerLine({ player, line, defs, perOver, points, sub, disabled, onPlayed, onStat, onRemove }: {
  player: Player;
  line: Record<string, number> | undefined;
  defs: StatDef[];
  perOver: number;
  points: number;
  sub: boolean;
  disabled: boolean;
  onPlayed: (v: boolean) => void;
  onStat: (key: string, v: number | undefined) => void;
  onRemove: () => void;
}) {
  const played = !!line;
  return (
    <div className={'card score-line' + (played ? '' : ' not-played')}>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
        <input type="checkbox" aria-label={`${player.name} played`} checked={played} disabled={disabled} onChange={(e) => onPlayed(e.target.checked)} style={{ width: 20, height: 20 }} />
        <PlayerAvatar player={player} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</strong>
          <span className="hint">{player.role}{sub ? ' · added for this match' : ''}</span>
        </span>
        {played && points !== 0 && <span className="pill pill-blue num">{points} pts</span>}
        {sub && !disabled && <button className="btn btn-ghost btn-icon" aria-label={`Remove ${player.name}`} onClick={onRemove}><UserMinus size={16} /></button>}
      </div>
      <div className="stat-grid">
        {defs.map((d) => (
          <StatInput key={d.key} def={d} value={line?.[d.key]} perOver={perOver} disabled={disabled} onChange={(v) => onStat(d.key, v)} />
        ))}
      </div>
    </div>
  );
}

/** Player of the Match: the app's top suggestions by award points, and the organiser's choice. */
function PotmPicker({ state, match: m, onShare }: { state: AppState; match: Match; onShare: (playerId: string) => void }) {
  const t = tournamentOf(state).settings;
  const top = topScorers(m, t).slice(0, 3);
  const current = potmOf(state, m);
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? '';
  const choose = (id: string | null) => updateMatch(m.id, (x) => void (x.potm = id));
  const played = Object.keys(m.stats);
  if (m.status !== 'done') return null;
  return (
    <div className="card" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong><Star size={16} style={{ verticalAlign: -2, color: 'var(--accent)' }} /> Player of the Match</strong>
        <span className="hint">{t.potm === 'auto' ? (m.potm ? 'Chosen by you' : 'Automatic: most award points') : 'You choose'}</span>
      </div>
      {current ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 17 }}>{name(current)}</strong>
          <button className="btn btn-sm" onClick={() => onShare(current)}><Share2 size={15} />Share</button>
        </div>
      ) : <span className="hint">{top.length ? 'Not chosen yet. Suggestions below.' : 'Fill in the scorecard to see suggestions.'}</span>}
      {top.length > 0 && (
        <div className="row">
          {top.map((x) => (
            <button key={x.playerId} type="button" className={'btn btn-sm' + (current === x.playerId ? ' btn-primary' : '')} disabled={isViewOnly()} onClick={() => choose(x.playerId)}>
              {name(x.playerId)} · {x.points} pts
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <select className="select input-sm" style={{ maxWidth: 260 }} aria-label="Choose Player of the Match" value={m.potm ?? ''} disabled={isViewOnly()} onChange={(e) => choose(e.target.value || null)}>
          <option value="">{t.potm === 'auto' ? 'Automatic' : 'Choose…'}</option>
          {played.map((id) => <option key={id} value={id}>{name(id)}</option>)}
        </select>
      </div>
    </div>
  );
}
