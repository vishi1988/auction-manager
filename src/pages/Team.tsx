import { LogOut, Send, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuctionPath } from '../components/AuctionRoute';
import { shareUrl } from '../components/ScreenLink';
import { Toast, useToast } from '../components/ui';
import { initials } from '../lib/format';
import { MEMBER_ROLES, ROLE_HELP, ROLE_LABEL, type MemberRole } from '../lib/roles';
import { useAuth } from '../store/auth';
import type { Member, MemberList } from '../store/cloud';
import { deleteAuction, goOnline, inviteMember, listMembers, removeMember, useAppState, useCloudInfo, useRole } from '../store/store';

/** Plain-language reason for a refused request (the API's error code is the message). */
function why(err: unknown, max = 12): string {
  const code = err instanceof Error ? err.message : '';
  switch (code) {
    case 'bad_email': return 'Enter a valid email address: the Google email your friend signs in with.';
    case 'is_owner': return 'That email belongs to the owner of this auction.';
    case 'too_many_members': return `An auction can be shared with up to ${max} people.`;
    case 'owner_only': return 'Only the owner can choose or change admins.';
    case 'not_allowed': return 'Your role does not allow that.';
    case 'login_required': return 'Sign in with Google first.';
    case 'not_found': return 'This auction is not online yet. Make it online first.';
    case 'offline': return 'No internet right now. Try again in a moment.';
    default: return 'Could not do that (' + (code || 'unknown error') + ').';
  }
}

function Person({ name, email, picture }: { name: string; email: string; picture: string }) {
  return (
    <span className="avatar" aria-hidden>
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : initials(name || email) || '?'}
    </span>
  );
}

/** Who can work on this auction, and what each person may do. */
export function Team() {
  const { settings } = useAppState();
  const role = useRole();
  const path = useAuctionPath();
  const navigate = useNavigate();
  const { auctionId = '' } = useParams();
  const cloud = useCloudInfo();
  const auth = useAuth();
  const online = cloud.synced.includes(auctionId);
  const [toast, showToast] = useToast();
  const [list, setList] = useState<MemberList | null>(null);
  const [problem, setProblem] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('auctioneer');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await listMembers());
      setProblem('');
    } catch (err) {
      setProblem(why(err));
    }
  }, []);
  useEffect(() => {
    if (cloud.enabled && online && auth.user) void load();
  }, [cloud.enabled, online, auth.user, auctionId, load]);

  const isOwner = list?.role === 'owner';
  const canManage = !!list?.canManage;
  const inviteText = (to: string, as: MemberRole) =>
    `You are invited to help run "${settings.name}" on KhiladiAuction as ${ROLE_LABEL[as]}.\n1. Open ${shareUrl(path(as === 'scorer' ? '/matches' : ''))}\n2. Sign in with Google using ${to}\nThe auction then shows in My Auctions.`;
  const whatsapp = (to: string, as: MemberRole) => 'https://wa.me/?text=' + encodeURIComponent(inviteText(to, as));

  const act = async (job: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await job();
      showToast(done);
      await load();
    } catch (err) {
      showToast(why(err, list?.max));
    } finally {
      setBusy(false);
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim().toLowerCase();
    if (!to) return;
    void act(async () => {
      await inviteMember(to, newRole);
      setEmail('');
    }, to + ' can now open this auction');
  };

  const canChange = (m: Member) => canManage && (isOwner || m.role !== 'admin');

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Setup</div>
          <h1>Auction team</h1>
          <p>Share this auction with friends and helpers. Each person signs in with their own Google account and gets a role.</p>
        </div>
      </div>

      {!cloud.enabled ? (
        <section className="card"><p className="hint">Sharing needs the online version of the app (khiladiauction.com).</p></section>
      ) : !auth.user ? (
        <section className="card">
          <p>Sign in with Google to share this auction.</p>
          <Link className="btn btn-primary" style={{ alignSelf: 'flex-start' }} to="/account">Sign in</Link>
        </section>
      ) : !online ? (
        <section className="card">
          <p><strong>This auction is not online yet.</strong> Put it online first, so the people you invite can open it from their own phones and laptops.</p>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => showToast(goOnline(auctionId) ? 'Going online… give it a few seconds' : 'Could not go online')}>Make this auction online</button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>People with access</h2>
                <p className="hint">{list ? `${list.members.length + 1} of up to ${list.max + 1} people` : 'Loading…'}</p>
              </div>
            </div>
            {problem && <p className="hint" style={{ color: 'var(--danger-ink)' }}>{problem}</p>}
            {list && (
              <div style={{ display: 'grid' }}>
                <div className="row" style={{ flexWrap: 'nowrap', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line-2)' }}>
                  <Person {...list.owner} />
                  <span style={{ flexGrow: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 14 }}>{list.owner.name || list.owner.email}</strong>
                    <span className="muted" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{list.owner.email}</span>
                  </span>
                  <span className="pill pill-dark"><ShieldCheck size={13} />Owner</span>
                </div>
                {list.members.map((m) => (
                  <div key={m.email} className="row" style={{ flexWrap: 'wrap', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line-2)' }}>
                    <Person {...m} />
                    <span style={{ flexGrow: 1, minWidth: 160 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{m.name || m.email}</strong>
                      <span className="muted" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>
                        {m.name ? m.email + ' · ' : ''}
                        {m.joined ? 'signed in' : 'invited, has not signed in yet'}
                      </span>
                    </span>
                    {canChange(m) ? (
                      <select
                        className="select input-sm"
                        aria-label={'Role of ' + (m.name || m.email)}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => void act(() => inviteMember(m.email, e.target.value as MemberRole), 'Role changed')}
                      >
                        {MEMBER_ROLES.filter((r) => isOwner || r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : (
                      <span className="pill pill-blue">{ROLE_LABEL[m.role]}</span>
                    )}
                    {canManage && (
                      <a className="btn btn-sm btn-icon" href={whatsapp(m.email, m.role)} target="_blank" rel="noreferrer" title="Send the invitation on WhatsApp" aria-label={'Send invitation to ' + (m.name || m.email) + ' on WhatsApp'}>
                        <Send size={15} />
                      </a>
                    )}
                    {canChange(m) && (
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Remove access"
                        aria-label={'Remove ' + (m.name || m.email)}
                        disabled={busy}
                        onClick={() => confirm(`Remove ${m.name || m.email} from this auction?`) && void act(() => removeMember(m.email), 'Removed')}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {!list.members.length && <p className="hint" style={{ padding: '12px 0', borderTop: '1px solid var(--line-2)' }}>Nobody else yet. Invite a friend below.</p>}
              </div>
            )}
          </section>

          {canManage && (
            <section className="card">
              <h2>Invite someone</h2>
              <form onSubmit={invite} className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
                <label className="field" style={{ flexGrow: 1, minWidth: 220 }}>
                  Google email
                  <input className="input" type="email" inputMode="email" autoComplete="off" placeholder="friend@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="field">
                  Role
                  <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}>
                    {MEMBER_ROLES.filter((r) => isOwner || r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </label>
                <button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}><UserPlus size={16} />Invite</button>
              </form>
              <p className="hint">
                Use the email of the Google account they sign in with. After you invite them, send the message on WhatsApp (the send button next to their name): they open the link, sign in with that Google account, and the auction appears in their My Auctions.
              </p>
            </section>
          )}

          <section className="card">
            <h2>What each role can do</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {(['owner', ...MEMBER_ROLES] as const).map((r) => (
                <div key={r} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
                  <span className={'pill ' + (r === 'owner' ? 'pill-dark' : 'pill-blue')} style={{ minWidth: 92, justifyContent: 'center' }}>{ROLE_LABEL[r]}</span>
                  <span className="muted" style={{ fontSize: 13.5 }}>{ROLE_HELP[r]}</span>
                </div>
              ))}
            </div>
            <p className="hint">
              On auction day let one person run the Auction console. If two people change the auction at the same moment, the later change is not saved and a message tells them to repeat it. Everyone here can see players' phone numbers, so invite people you trust.
            </p>
          </section>

          {role && role !== 'owner' && (
            <button
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                if (!confirm(`Leave "${settings.name}"? You will lose access until the owner invites you again.`)) return;
                deleteAuction(auctionId);
                navigate('/');
              }}
            >
              <LogOut size={16} />Leave this auction
            </button>
          )}
        </>
      )}
      <Toast msg={toast} />
    </main>
  );
}
