import { ClipboardList, Copy, ExternalLink, Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { copyText } from './ui';
import { useAuctionPath } from './AuctionRoute';
import { ScreenLink, shareUrl } from './ScreenLink';
import { setRegisterSlug, useAppState, useCloudInfo, useRegisterSlug, useRole } from '../store/store';

/** The readable address players can use: khiladiauction.com/register/<name>. */
export const registerLinkUrl = (slug: string) => location.origin + '/register/' + slug;

/** Letters, digits and single hyphens only, 3 to 50 long. Matches the server. */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A first suggestion made from the auction's name, e.g. "FPL 2026" -> "fpl-2026-register". */
export function suggestSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/g, '');
  return (base || 'player') + '-register';
}

function problem(err: unknown): string {
  switch (err instanceof Error ? err.message : '') {
    case 'bad_slug': return 'Use 3 to 50 small letters, numbers and single hyphens, for example fpl2026-register.';
    case 'slug_taken': return 'Another auction already uses this name (or used it before). Try a different one.';
    case 'not_allowed':
    case 'not_owner': return 'Only the owner or an admin can change this link.';
    case 'login_required': return 'Sign in with Google first.';
    case 'offline': return 'No internet right now. Try again in a moment.';
    default: return 'Could not save the link name.';
  }
}

/** The "Player registration" line of the share links: copy it, send it on WhatsApp, and choose its readable name. */
export function RegistrationLinkRow({ showToast }: { showToast: (m: string) => void }) {
  const { settings } = useAppState();
  const path = useAuctionPath();
  const { auctionId = '' } = useParams();
  const cloud = useCloudInfo();
  const role = useRole();
  const slug = useRegisterSlug();
  const online = cloud.enabled && cloud.synced.includes(auctionId);
  const canEdit = online && (role === null ? false : role === 'owner' || role === 'admin');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const readable = online && !!slug;
  const link = readable ? registerLinkUrl(slug) : shareUrl(path('/register'));
  const showEditor = canEdit && (editing || !slug);
  const value = editing || draft ? draft : suggestSlug(settings.name);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = value.trim().toLowerCase();
    if (next.length < 3 || next.length > 50 || !SLUG_RE.test(next)) return setError(problem(new Error('bad_slug')));
    setBusy(true);
    setError('');
    try {
      await setRegisterSlug(next);
      setEditing(false);
      setDraft('');
      showToast('Registration link is ready');
    } catch (err) {
      setError(problem(err));
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = () => {
    const text = `Register as a player for ${settings.name}:\n${link}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };

  return (
    <div style={{ paddingTop: 12, borderTop: '1px solid var(--line-2)', display: 'grid', gap: 10 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <span className="stat-icon tone-green" style={{ width: 38, height: 38 }}><ClipboardList size={18} /></span>
        <span style={{ flexGrow: 1, minWidth: 140 }}>
          <strong style={{ display: 'block', fontSize: 14 }}>Player registration</strong>
          <span className="muted" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>
            {readable ? link.replace(/^https?:\/\//, '') : 'Players fill their own details'}
          </span>
        </span>
        <button className="btn btn-sm btn-icon" aria-label="Copy Player registration link" title="Copy link" onClick={() => copyText(link, showToast, 'Registration link copied')}>
          <Copy size={15} />
        </button>
        <button className="btn btn-sm btn-icon" aria-label="Send registration link on WhatsApp" title="Send on WhatsApp" onClick={whatsapp}>
          <Send size={15} />
        </button>
        {readable ? (
          <a className="btn btn-sm btn-icon" href={link} target="_blank" rel="noreferrer" aria-label="Open registration link" title="Open"><ExternalLink size={15} /></a>
        ) : (
          <ScreenLink className="btn btn-sm" to={path('/register')}>Open</ScreenLink>
        )}
      </div>

      {showEditor ? (
        <form onSubmit={save} style={{ display: 'grid', gap: 8 }}>
          <label className="field">
            {slug ? 'Change the link name' : 'Give the link a readable name'}
            <input
              className="input input-sm"
              style={{ width: '100%' }}
              aria-label="Registration link name"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={50}
              value={value}
              onChange={(e) => {
                setEditing(true);
                setDraft(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
            />
            <span className="hint" style={{ fontWeight: 400, overflowWrap: 'anywhere' }}>
              Players will see: <strong>{location.host}/register/{value || '…'}</strong>
            </span>
          </label>
          {error && <span className="hint" style={{ color: 'var(--danger-ink)' }}>{error}</span>}
          <span className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>{slug ? 'Save new name' : 'Create link'}</button>
            {slug && <button className="btn btn-sm btn-ghost" type="button" onClick={() => { setEditing(false); setDraft(''); setError(''); }}>Cancel</button>}
          </span>
          {slug && <span className="hint">Links you already sent keep working: the earlier names forward players to the new one.</span>}
        </form>
      ) : (
        canEdit && (
          <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => { setEditing(true); setDraft(slug); }}>
            <Pencil size={14} />Change link name
          </button>
        )
      )}
    </div>
  );
}
