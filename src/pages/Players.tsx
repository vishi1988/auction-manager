import { AlertTriangle, Camera, ClipboardList, FileSpreadsheet, Info, Link2, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAuctionPath } from '../components/AuctionRoute';
import { ScreenLink, shareUrl } from '../components/ScreenLink';
import { Drawer, EmptyState, PlayerAvatar, Toast, copyText, useToast } from '../components/ui';
import { sportOf } from '../data/sports';
import { downloadTemplate, readPlayersFile, templateColumns } from '../lib/excel';
import { money, uid } from '../lib/format';
import { resizeImage } from '../lib/media';
import { basePriceOf } from '../lib/rules';
import { update, useAppState } from '../store/store';
import type { Player, PlayerStatus, Role, Tag } from '../types';

const TAGS: Tag[] = ['', 'Owner', 'Captain', 'Vice Captain', 'Icon'];
const PAGE = 25;

const statusPill: Record<PlayerStatus, string> = {
  available: 'pill pill-green',
  retained: 'pill pill-cream',
  sold: 'pill pill-dark',
  unsold: 'pill pill-red',
  hold: 'pill pill-grey',
};

export function Players() {
  const state = useAppState();
  const { players, categories, teams, settings } = state;
  const sport = sportOf(settings.sport);
  const ROLES = sport.roles;
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Player | null>(null);
  const [toast, showToast] = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const path = useAuctionPath();

  const teamShort = (id?: string | null) => teams.find((t) => t.id === id)?.short ?? '';
  const catOf = (id: string) => categories.find((c) => c.id === id);

  const duplicates = useMemo(() => {
    const seen = new Map<number, number>();
    for (const p of players) seen.set(p.no, (seen.get(p.no) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([no]) => no);
  }, [players]);

  const filtered = players
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || String(p.no).includes(q))
    .filter((p) => !role || p.role === role)
    .filter((p) => !cat || p.categoryId === cat)
    .filter((p) => !status || p.status === status)
    .filter((p) => !tag || p.tag === tag)
    .sort((a, b) => a.no - b.no);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const count = (r: Role) => players.filter((p) => p.role === r).length;

  const onUpload = async (file: File) => {
    try {
      const { players: added, skipped } = await readPlayersFile(file, state);
      update((s) => void s.players.push(...added));
      showToast(`Added ${added.length} players` + (skipped ? `, skipped ${skipped} rows without a name` : ''));
    } catch (err) {
      console.error(err);
      showToast('Could not read that file. Use .xlsx or .csv');
    }
  };

  const newPlayer = (): Player => ({
    id: '',
    no: Math.max(100, ...players.map((p) => p.no)) + 1,
    name: '',
    role: ROLES[0]!,
    batting: sport.hasBatBowl ? 'Right hand' : '',
    bowling: sport.hasBatBowl ? '—' : '',
    categoryId: categories[categories.length - 1]!.id,
    tag: '',
    status: 'available',
    teamId: null,
    price: null,
    previousTeamId: null,
  });

  const save = (p: Player) => {
    if (!p.name.trim()) return showToast('Player name is needed');
    update((s) => {
      if (p.id) Object.assign(s.players.find((x) => x.id === p.id)!, p);
      else s.players.push({ ...p, id: uid('p') });
    });
    setEditing(null);
  };

  const remove = (p: Player) => {
    if (p.status === 'sold') return showToast('Undo the sale before deleting this player');
    if (!confirm('Delete ' + p.name + '?')) return;
    update((s) => void (s.players = s.players.filter((x) => x.id !== p.id)));
    setEditing(null);
  };

  const copyRegistration = () => copyText(shareUrl(path('/register')), showToast, 'Registration link copied');
  const closeMenu = (e: React.MouseEvent) => (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
  const onHold = players.filter((p) => p.status === 'hold').length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 3</div>
          <h1>Players</h1>
          <p>
            {players.length} players · {players.filter((p) => p.status === 'retained').length} retained ·{' '}
            {players.filter((p) => p.status === 'available').length} ready for auction
          </p>
        </div>
        <div className="row">
          <details className="menu">
            <summary className="btn"><MoreHorizontal size={16} />More</summary>
            <div className="menu-list">
              <button onClick={(e) => { closeMenu(e); downloadTemplate(sport); }}><FileSpreadsheet size={16} />Download Excel template</button>
              <button onClick={(e) => { closeMenu(e); copyRegistration(); }}><Link2 size={16} />Copy registration form link</button>
              <ScreenLink to={path('/register')}><ClipboardList size={16} />Open registration form ↗</ScreenLink>
            </div>
          </details>
          <button className="btn" onClick={() => fileRef.current?.click()} title={'Columns: ' + templateColumns(sport).join(', ')}><Upload size={16} />Import Excel</button>
          <button className="btn btn-primary" onClick={() => setEditing(newPlayer())}><Plus size={16} />Add player</button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {players.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<UserPlus size={30} />}
            title="Add your players"
            action={
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => downloadTemplate(sport)}><FileSpreadsheet size={16} />Get Excel template</button>
                <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} />Import Excel</button>
                <button className="btn btn-primary" onClick={() => setEditing(newPlayer())}><Plus size={16} />Add one by one</button>
              </div>
            }
          >
            Fill the Excel template and import it, add players one by one, or share the registration link so players sign up themselves.
          </EmptyState>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="banner banner-red">
          <AlertTriangle size={18} />
          <span><strong>Duplicate player numbers:</strong> {duplicates.join(', ')}</span>
          <button className="btn btn-sm" onClick={() => setQ(String(duplicates[0]))}>Review</button>
        </div>
      )}
      {onHold > 0 && (
        <div className="banner banner-blue">
          <Info size={18} />
          <span><strong>{onHold} player{onHold === 1 ? '' : 's'} on hold</strong> (self-registered or held back). Open them, set the category and untick “on hold” to include them.</span>
          <button className="btn btn-sm" onClick={() => { setStatus('hold'); setPage(0); }}>Show</button>
        </div>
      )}

      {players.length > 0 && <>
      <div className="row">
        {ROLES.map((r) => (
          <button key={r} className={'pill ' + (role === r ? 'pill-blue' : 'pill-grey')} style={{ border: 'none', padding: '6px 12px', fontSize: 12.5 }} onClick={() => { setRole(role === r ? '' : r); setPage(0); }}>
            {r === 'Wicket-keeper' ? 'Keepers' : r.endsWith('s') ? r : r + 's'} <span className="num">{count(r)}</span>
          </button>
        ))}
      </div>

      <div className="row">
        <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} type="search" placeholder="Search name or number…" aria-label="Search players" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <select className="select" style={{ width: 'auto' }} aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All status</option>
          <option value="available">Available</option>
          <option value="retained">Retained</option>
          <option value="sold">Sold</option>
          <option value="unsold">Unsold</option>
          <option value="hold">On hold</option>
        </select>
        <select className="select" style={{ width: 'auto' }} aria-label="Tag" value={tag} onChange={(e) => { setTag(e.target.value); setPage(0); }}>
          <option value="">All tags</option>
          {TAGS.filter(Boolean).map((t) => <option key={t}>{t}</option>)}
        </select>
        {(q || role || cat || status || tag) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setRole(''); setCat(''); setStatus(''); setTag(''); setPage(0); }}>Clear filters</button>
        )}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>No.</th><th /><th>Name</th><th>Role</th>{sport.hasBatBowl && <><th>Bat</th><th>Bowling</th></>}<th>Category</th><th>Base</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const c = catOf(p.categoryId);
              return (
                <tr key={p.id}>
                  <td className="num muted" style={duplicates.includes(p.no) ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{p.no}</td>
                  <td><PlayerAvatar player={p} /></td>
                  <td>
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <strong>{p.name}</strong>
                      {p.tag && <span className="pill pill-dark" style={{ fontSize: 11, padding: '2px 8px' }}>{p.tag}</span>}
                      {p.selfRegistered && <span className="pill pill-cream" style={{ fontSize: 11, padding: '2px 8px' }}>Registered</span>}
                    </span>
                  </td>
                  <td>{p.role}</td>
                  {sport.hasBatBowl && (
                    <>
                      <td className="muted">{p.batting === 'Left hand' ? 'LHB' : 'RHB'}</td>
                      <td className="muted">{p.bowling}</td>
                    </>
                  )}
                  <td><span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className="swatch" style={{ background: c?.color }} />{c?.name}</span></td>
                  <td className="num"><strong>{money(basePriceOf(state, p), settings.unit)}</strong></td>
                  <td>
                    <span className={statusPill[p.status]}>
                      {p.status === 'sold' ? 'Sold · ' + teamShort(p.teamId) + ' ' + money(p.price, settings.unit)
                        : p.status === 'retained' ? 'Retained · ' + teamShort(p.teamId)
                          : p.status === 'hold' ? 'On hold' : p.status[0]!.toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                  <td><button className="btn btn-ghost btn-sm btn-icon" aria-label={'Edit ' + p.name} title="Edit" onClick={() => setEditing(structuredClone(p))}><Pencil size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <div className="empty">No players match these filters.</div>}
        <div className="row" style={{ padding: '10px 14px', borderTop: '1px solid var(--line-2)', fontSize: 13 }}>
          <span className="muted">
            Showing {filtered.length ? page * PAGE + 1 : 0}–{Math.min(filtered.length, page * PAGE + PAGE)} of {filtered.length}
          </span>
          <span className="spacer" />
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page + 1} / {pages}</span>
          <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
      </>}

      {editing && <PlayerEditor player={editing} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
      <Toast msg={toast} />
    </main>
  );
}

function PlayerEditor({ player, onSave, onDelete, onClose }: { player: Player; onSave: (p: Player) => void; onDelete: (p: Player) => void; onClose: () => void }) {
  const { categories, teams, settings } = useAppState();
  const sport = sportOf(settings.sport);
  const [p, setP] = useState(player);
  const set = <K extends keyof Player>(k: K, v: Player[K]) => setP((x) => ({ ...x, [k]: v }));
  const locked = p.status === 'sold' || p.status === 'retained';

  return (
    <Drawer
      title={p.id ? 'Edit player' : 'Add player'}
      onClose={onClose}
      footer={
        <>
          {p.id && <button className="btn btn-danger" onClick={() => onDelete(p)}><Trash2 size={15} />Delete</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(p)}>Save player</button>
        </>
      }
    >
        <div className="row" style={{ gap: 14, padding: 14, borderRadius: 12, background: 'var(--surface-2)' }}>
          <PlayerAvatar player={p} className="avatar" />
          <label className="btn btn-sm">
            <Camera size={15} />{p.photo ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('photo', await resizeImage(f)); }} />
          </label>
          {p.photo && <button className="btn btn-ghost btn-sm" onClick={() => set('photo', undefined)}>Remove</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
          <label className="field">Player no.<input className="input" type="number" value={p.no} onChange={(e) => set('no', Number(e.target.value))} /></label>
          <label className="field">Name *<input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} /></label>
        </div>
        <div className="grid-2">
          <label className="field">Age<input className="input" type="number" value={p.age ?? ''} onChange={(e) => set('age', e.target.value ? Number(e.target.value) : undefined)} /></label>
          <label className="field">Mobile<input className="input" type="tel" value={p.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} /></label>
          <label className="field">Role
            <select className="select" value={p.role} onChange={(e) => set('role', e.target.value as Role)}>
              {[...new Set([...sport.roles, p.role])].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="field">Category
            <select className="select" value={p.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          {sport.hasBatBowl && (
            <>
              <label className="field">Batting
                <select className="select" value={p.batting} onChange={(e) => set('batting', e.target.value)}><option>Right hand</option><option>Left hand</option></select>
              </label>
              <label className="field">Bowling<input className="input" value={p.bowling} onChange={(e) => set('bowling', e.target.value)} /></label>
            </>
          )}
          <label className="field">Tag
            <select className="select" value={p.tag} onChange={(e) => set('tag', e.target.value as Tag)}>{TAGS.map((t) => <option key={t} value={t}>{t || 'None'}</option>)}</select>
          </label>
          <label className="field">Own base price<input className="input" type="number" step={0.05} placeholder="Category base" value={p.basePrice ?? ''} onChange={(e) => set('basePrice', e.target.value ? Number(e.target.value) : null)} /></label>
          <label className="field">Jersey name<input className="input" value={p.jerseyName ?? ''} onChange={(e) => set('jerseyName', e.target.value)} /></label>
          <label className="field">Jersey no.<input className="input" value={p.jerseyNo ?? ''} onChange={(e) => set('jerseyNo', e.target.value)} /></label>
          <label className="field">T-shirt
            <select className="select" value={p.tshirt ?? ''} onChange={(e) => set('tshirt', e.target.value)}>{['', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => <option key={s} value={s}>{s || '—'}</option>)}</select>
          </label>
          <label className="field">Last season team (RTM)
            <select className="select" value={p.previousTeamId ?? ''} onChange={(e) => set('previousTeamId', e.target.value || null)}>
              <option value="">None</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        {!locked && (
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={p.status === 'hold'} onChange={(e) => set('status', e.target.checked ? 'hold' : 'available')} />
            Keep on hold (not in the auction)
          </label>
        )}
        {locked && <p className="hint">This player is {p.status}. Undo the sale in the console, or release the retention on the Teams page, to change status.</p>}
    </Drawer>
  );
}
