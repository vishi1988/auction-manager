import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { initials } from '../lib/format';
import { loadGoogleSignIn, signOut, useAuth, type User } from '../store/auth';

/** Google's own "Continue with Google" button, plus what happens while signing in. */
export function GoogleButton({ text = 'continue_with', width = 280 }: { text?: 'continue_with' | 'signin_with'; width?: number }) {
  const { clientId, busy, error, checked } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleSignIn(clientId).then(
      (id) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = '';
        id.renderButton(ref.current, { theme: 'outline', size: 'large', text, shape: 'pill', logo_alignment: 'left', width });
        setFailed(false);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [clientId, text, width]);

  if (!checked) return <p className="hint">Checking sign-in…</p>;
  if (!clientId) return <p className="hint">Google sign-in is not switched on for this site yet.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {failed ? <p className="hint">Could not load Google sign-in. Check the internet connection and reload.</p> : <div ref={ref} style={{ minHeight: 44 }} />}
      {busy && <p className="hint">Signing in…</p>}
      {error && <p className="hint" style={{ color: 'var(--danger-ink)' }}>{error}</p>}
    </div>
  );
}

/** Round photo of the signed-in user, or their initials. */
export function UserAvatar({ user, size = 32 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false);
  return user.picture && !broken ? (
    <img src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ borderRadius: '50%', flexShrink: 0 }} />
  ) : (
    <span className="team-badge" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: 'var(--primary)' }}>{initials(user.name || user.email)}</span>
  );
}

/** Signed-in user with a sign-out button, for the side menu. */
export function UserChip() {
  const { user, busy } = useAuth();
  if (!user) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <UserAvatar user={user} size={30} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
        <strong style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.email}</strong>
        <span style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
      </span>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Sign out" title="Sign out" disabled={busy} onClick={() => void signOut()} style={{ color: '#c3cddc' }}>
        <LogOut size={16} />
      </button>
    </div>
  );
}
