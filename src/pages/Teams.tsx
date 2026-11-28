import { Link2, MessageCircle, Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuctionPath } from '../components/AuctionRoute';
import { ProPrompt } from '../components/ProPrompt';
import { shareUrl } from '../components/ScreenLink';
import { Drawer, EmptyState, TeamBadge, Toast, copyText, useToast } from '../components/ui';
import { teamLimitReached, useAuth } from '../store/auth';
import { money, uid } from '../lib/format';
import { resizeImage } from '../lib/media';
import { orphanedPlayers, releaseOrphans, teamStats } from '../lib/rules';
import { ensureOwnerKeys, isViewOnly, update, useAppState, useCloudInfo, useRole } from '../store/store';
import type { Team } from '../types';

const SWATCHES = ['#E5484D', '#2E5BFF', '#FF7A1A', '#7C4DDB', '#12A360', '#D6409F', '#0EA5B7', '#475467', '#B7791F', '#1E3A8A'];
/** Keys the console uses for actions, so teams cannot take them. */
const RESERVED_KEYS = ['S', 'U', 'Z', 'N'];

const blankTeam = (color: string): Team => ({ id: '', name: '', short: '', owner: '', ownerMobile: '', color, key: '', rtmUsed: 0 });

export function Teams() {
  const state = useAppState();
  const { teams, settings } = state;
  const [draft, setDraft] = useState<Team | null>(null);
  const [toast, showToast] = useToast();
  const nextColor = SWATCHES[teams.length % SWATCHES.length]!;
  const [proOpen, setProOpen] = useState(false);
  const path = useAuctionPath();
  const { auctionId = '' } = useParams();
  const cloud = useCloudInfo();
  useAuth(); // re-render when the plan changes
  // Every team gets a secret key for its private bidding link.
  useEffect(() => ensureOwnerKeys(), [teams.length]);
  // A player retained by a team that was later deleted would otherwise stay
  // hidden for good: put them back in the pool so they can be retained again.
  const stuck = orphanedPlayers(state).length;
  useEffect(() => {
    if (stuck && !isViewOnly()) update((s) => void releaseOrphans(s));
  }, [stuck]);
  /** The team's private bidding link, for WhatsApp. Only works once the auction is online. */
  const ownerLink = (t: Team) => (t.ownerKey ? shareUrl(path('/owner/' + t.id) + '?k=' + t.ownerKey) : '');
  const copyOwnerLink = (t: Team) => {
    if (cloud.enabled && !cloud.synced.includes(auctionId)) return showToast('Make the auction online first (Overview page), then share the link');
    copyText(ownerLink(t), showToast, t.name + ' owner link copied');
  };
  const whatsappOwner = (t: Team) => {
    if (cloud.enabled && !cloud.synced.includes(auctionId)) return showToast('Make the auction online first (Overview page), then share the link');
    const phone = t.ownerMobile.replace(/\D/g, '');
    const text = `${settings.name}: your private bidding link for ${t.name}. Open it on your phone on auction day. Do not share it.\n${ownerLink(t)}`;
    window.open((phone.length === 10 ? 'https://wa.me/91' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };
  /** Free accounts can add up to 2 teams; the third shows the Pro prompt. */
  // Invited helpers are not limited by their own plan: the server applies the owner's.
  const role = useRole();
  const limited = (role === null || role === 'owner') && teamLimitReached(teams.length);
  const addTeam = () => (limited ? setProOpen(true) : setDraft(blankTeam(nextColor)));

  const remove = (team: Team) => {
    const squad = teamStats(state, team.id).squad;
    if (squad.some((p) => p.status === 'sold')) return showToast('This team has bought players. Undo those sales first.');
    const kept = squad.filter((p) => p.status === 'retained');
    if (!confirm('Delete ' + team.name + '?' + (kept.length ? `
${kept.map((p) => p.name).join(', ')} will go back to the player pool.` : ''))) return;
    update((s) => {
      s.teams = s.teams.filter((t) => t.id !== team.id);
      releaseOrphans(s);
    });
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 2</div>
          <h1>Teams</h1>
          <p>{teams.length} teams · {money(settings.purse, settings.unit)} purse each · {settings.minSquad}–{settings.maxSquad} players per team</p>
        </div>
        <button className="btn btn-primary" onClick={addTeam}><Plus size={16} />Add team{limited ? ' · Pro' : ''}</button>
      </div>

      {teams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={30} />}
            title="No teams yet"
            action={<button className="btn btn-primary" onClick={() => setDraft(blankTeam(nextColor))}><Plus size={16} />Add your first team</button>}
          >
            Add each team with its owner, a short code and a colour. You need at least 2 teams to start the auction.
          </EmptyState>
        </div>
      ) : (
        <div className="grid-4 stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {teams.map((t) => {
            const st = teamStats(state, t.id);
            const kept = st.squad.filter((p) => p.status === 'retained');
            const used = settings.purse ? Math.min(100, (100 * st.spent) / settings.purse) : 0;
            return (
              <article key={t.id} className="team-card">
                <div className="band" style={{ background: t.color }} />
                <div className="body">
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <TeamBadge team={t} size={46} />
                    <div style={{ minWidth: 0, flexGrow: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{t.name}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>{t.owner ? 'Owner: ' + t.owner : 'No owner added'}</div>
                    </div>
                    {settings.keyboard && t.key && <span className="kbd" title="Bid shortcut key">{t.key}</span>}
                  </div>
                  <div className="grid-2" style={{ gap: 10 }}>
                    <div className="stat">Purse left<b className="num">{money(st.purseLeft, settings.unit)}</b></div>
                    <div className="stat">Squad<b className="num">{st.count} / {settings.maxSquad}</b></div>
                  </div>
                  <div className="mini-bar" title={Math.round(used) + '% of purse used'}><div style={{ width: used + '%', background: t.color }} /></div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 18 }}>
                    {kept.length ? <><Shield size={12} style={{ verticalAlign: -1 }} /> Retained: {kept.map((p) => p.name).join(', ')}</> : 'No retained players'}
                  </div>
                  <div className="row" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line-2)', gap: 6 }}>
                    {settings.rtm && <span className="pill pill-orange">RTM {settings.rtmCards - t.rtmUsed}</span>}
                    <span className="spacer" />
                    {settings.ownerBidding && (
                      <>
                        <button className="btn btn-ghost btn-sm btn-icon" aria-label={'Copy ' + t.name + ' owner bidding link'} title="Copy owner's private bidding link" onClick={() => copyOwnerLink(t)}><Link2 size={15} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" aria-label={'Send ' + t.name + ' owner link on WhatsApp'} title="Send owner's link on WhatsApp" onClick={() => whatsappOwner(t)}><MessageCircle size={15} /></button>
                      </>
                    )}
                    <button className="btn btn-sm" onClick={() => setDraft(structuredClone(t))}><Pencil size={14} />Edit</button>
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label={'Delete ' + t.name} title="Delete team" onClick={() => remove(t)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {proOpen && <ProPrompt onClose={() => setProOpen(false)} />}
      {draft && <TeamDrawer draft={draft} onClose={() => setDraft(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </main>
  );
}

function TeamDrawer({ draft: initial, onClose, showToast }: { draft: Team; onClose: () => void; showToast: (m: string) => void }) {
  const state = useAppState();
  const { teams, settings } = state;
  const [draft, setDraft] = useState(initial);
  const [retainPick, setRetainPick] = useState('');
  const [retainPrice, setRetainPrice] = useState('');
  const editing = draft.id !== '';
  const retained = editing ? state.players.filter((p) => p.status === 'retained' && p.teamId === draft.id) : [];
  const pool = state.players.filter((p) => p.status === 'available').sort((a, b) => a.name.localeCompare(b.name));
  const change = <K extends keyof Team>(k: K, v: Team[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    const key = draft.key.toUpperCase();
    if (!draft.name.trim()) return showToast('Enter the team name');
    const short = (draft.short.trim() || draft.name.trim().split(/\s+/).map((w) => w[0]).join('')).toUpperCase().slice(0, 4);
    if (key && RESERVED_KEYS.includes(key)) return showToast(key + ' is reserved for ' + ({ S: 'Sold', U: 'Unsold', Z: 'Undo', N: 'Next' } as Record<string, string>)[key]);
    if (key && teams.some((t) => t.key === key && t.id !== draft.id)) return showToast('Key ' + key + ' is already used by another team');
    const team = { ...draft, key, short };
    update((s) => {
      if (editing) Object.assign(s.teams.find((t) => t.id === draft.id)!, team);
      else s.teams.push({ ...team, id: uid('t') });
    });
    showToast(editing ? 'Team updated' : 'Team added');
    onClose();
  };

  const addRetention = () => {
    const price = Number(retainPrice);
    if (!retainPick || !(price >= 0)) return;
    if (retained.length >= settings.maxRetained) return showToast('Max ' + settings.maxRetained + ' retained players per team');
    update((s) => Object.assign(s.players.find((p) => p.id === retainPick)!, { status: 'retained', teamId: draft.id, price }));
    setRetainPick('');
    setRetainPrice('');
  };

  return (
    <Drawer
      title={editing ? 'Edit team' : 'Add team'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><span className="spacer" /><button className="btn btn-primary" onClick={save}>{editing ? 'Save changes' : 'Add team'}</button></>}
    >
      <div className="row" style={{ gap: 14, padding: 14, borderRadius: 12, background: 'var(--surface-2)' }}>
        <TeamBadge team={{ ...draft, short: draft.short || draft.name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase() || '?' }} size={54} />
        <div>
          <div style={{ fontWeight: 700 }}>{draft.name || 'Team name'}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>Preview</div>
        </div>
      </div>
      <label className="field">
        Team name *
        <input className="input" autoFocus placeholder="e.g. Royal Strikers" value={draft.name} onChange={(e) => change('name', e.target.value)} />
      </label>
      <div className="grid-2">
        <label className="field">
          Short code
          <input className="input" placeholder="RS" maxLength={4} value={draft.short} onChange={(e) => change('short', e.target.value.toUpperCase())} />
        </label>
        <label className="field">
          Bid key {settings.keyboard ? '' : '(off)'}
          <input className="input" placeholder="R" maxLength={1} value={draft.key} onChange={(e) => change('key', e.target.value.toUpperCase().replace(/[^A-Z0-9]/, ''))} />
        </label>
        <label className="field">
          Owner name
          <input className="input" value={draft.owner} onChange={(e) => change('owner', e.target.value)} />
        </label>
        <label className="field">
          Owner mobile
          <input className="input" type="tel" value={draft.ownerMobile} onChange={(e) => change('ownerMobile', e.target.value)} />
        </label>
      </div>
      <div className="field">
        Team colour
        <div className="swatches">
          {SWATCHES.map((c) => (
            <button key={c} type="button" aria-label={'Colour ' + c} aria-pressed={draft.color.toLowerCase() === c.toLowerCase()} style={{ background: c }} onClick={() => change('color', c)} />
          ))}
          <input type="color" aria-label="Custom colour" value={draft.color} onChange={(e) => change('color', e.target.value)} style={{ width: 34, height: 34, border: 'none', background: 'none', padding: 0 }} />
        </div>
      </div>
      <div className="field">
        Logo (optional)
        <div className="row">
          <label className="btn btn-sm">
            {draft.logo ? 'Change logo' : 'Upload logo'}
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) change('logo', await resizeImage(f, 400)); }} />
          </label>
          {draft.logo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => change('logo', undefined)}>Remove</button>}
        </div>
      </div>

      {editing && settings.retention && (
        <div className="field" style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          Retained players (max {settings.maxRetained})
          {retained.map((p) => (
            <div key={p.id} className="row" style={{ fontWeight: 500 }}>
              <Shield size={14} />
              <span style={{ flexGrow: 1 }}>{p.name} · {money(p.price, settings.unit)}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => update((s) => Object.assign(s.players.find((x) => x.id === p.id)!, { status: 'available', teamId: null, price: null }))}
              >
                Release
              </button>
            </div>
          ))}
          {retained.length < settings.maxRetained && (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <select className="select" aria-label="Player to retain" value={retainPick} onChange={(e) => setRetainPick(e.target.value)}>
                <option value="">Pick a player…</option>
                {pool.map((p) => <option key={p.id} value={p.id}>{p.no} · {p.name}</option>)}
              </select>
              <input className="input" style={{ width: 96 }} type="number" step="any" min={0} placeholder="Price" aria-label="Retention price" value={retainPrice} onChange={(e) => setRetainPrice(e.target.value)} />
              <button type="button" className="btn" onClick={addRetention}>Add</button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
