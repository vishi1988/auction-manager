import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '../components/GoogleSignIn';
import { Toast, useToast } from '../components/ui';
import { adminApi, useAuth, type AdminUser } from '../store/auth';

/** Super admin: every account, with the Pro plan, payment and suspend switches. */
export function Admin() {
  const { user, checked } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'requests' | 'pro'>('all');
  const [toast, showToast] = useToast();

  useEffect(() => {
    if (!user?.isAdmin) return;
    adminApi.list().then(setUsers, () => setError('Could not load the accounts.'));
  }, [user?.isAdmin]);

  if (!checked) return <main className="page"><p className="hint">Checking sign-in…</p></main>;
  if (!user?.isAdmin) {
    return (
      <main className="page">
        <div className="empty">
          <h1 className="display" style={{ fontSize: 32, color: 'var(--ink)' }}>Super admin only</h1>
          <p>This page is for the KhiladiAuction owner.</p>
          <Link className="btn btn-primary" to="/">Go to My Auctions</Link>
        </div>
      </main>
    );
  }

  const change = async (u: AdminUser, patch: Parameters<typeof adminApi.update>[1], done: string) => {
    setBusyId(u.id);
    try {
      const next = await adminApi.update(u.id, patch);
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, ...next } : x)) ?? list);
      showToast(done);
    } catch {
      showToast('Could not save that change');
    } finally {
      setBusyId(null);
    }
  };

  const shown = (users ?? []).filter((u) => (filter === 'requests' ? u.proRequested : filter === 'pro' ? u.plan === 'pro' : true));
  const requests = (users ?? []).filter((u) => u.proRequested).length;
  const date = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Super admin</div>
          <h1>Accounts</h1>
          <p>Free accounts can run an auction with 2 teams. Give Pro to remove that limit. Tick “Payment received” when they have paid; during testing you can give Pro without it.</p>
        </div>
      </div>

      <div className="row">
        {([['all', 'All'], ['requests', `Pro requests (${requests})`], ['pro', 'Pro']] as const).map(([k, label]) => (
          <button key={k} className={'btn btn-sm' + (filter === k ? ' btn-primary' : '')} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {error && <div className="banner banner-cream">{error}</div>}
      {!users && !error && <p className="hint">Loading accounts…</p>}

      <section className="card" style={{ padding: 0 }}>
        {shown.map((u) => (
          <div key={u.id} className="row" style={{ gap: 12, padding: '14px 16px', borderTop: '1px solid var(--line-2)', alignItems: 'center' }}>
            <UserAvatar user={u} size={38} />
            <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.name || u.email}
                {u.isAdmin && <span className="pill pill-orange" style={{ marginLeft: 8 }}>Super admin</span>}
                {u.proRequested && <span className="pill pill-red" style={{ marginLeft: 8 }}>Asked for Pro</span>}
                {u.suspended && <span className="pill pill-grey" style={{ marginLeft: 8 }}>Suspended</span>}
              </strong>
              <span className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.email} · {u.auctions} auction{u.auctions === 1 ? '' : 's'} · joined {date(u.createdAt)}
              </span>
            </span>
            {u.isAdmin ? (
              <span className="muted" style={{ fontSize: 13 }}>Full access</span>
            ) : (
              <>
                <span className={'pill ' + (u.plan === 'pro' ? 'pill-green' : 'pill-grey')}>{u.plan === 'pro' ? 'Pro' : 'Free · 2 teams'}</span>
                <label className="row" style={{ gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={!!u.paymentDone} disabled={busyId === u.id} onChange={(e) => void change(u, { paymentDone: e.target.checked }, e.target.checked ? 'Payment marked received' : 'Payment marked not received')} />
                  Payment received
                </label>
                <button className={'btn btn-sm' + (u.plan === 'pro' ? '' : ' btn-primary')} disabled={busyId === u.id} onClick={() => void change(u, { plan: u.plan === 'pro' ? 'free' : 'pro' }, u.plan === 'pro' ? 'Back to Free' : 'Pro given')}>
                  {u.plan === 'pro' ? 'Make Free' : 'Give Pro'}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => void change(u, { suspended: !u.suspended }, u.suspended ? 'Account restored' : 'Account suspended')}>
                  {u.suspended ? 'Restore' : 'Suspend'}
                </button>
              </>
            )}
          </div>
        ))}
        {users && shown.length === 0 && <p className="hint" style={{ padding: 16 }}>No accounts here yet.</p>}
      </section>
      <Toast msg={toast} />
    </main>
  );
}
