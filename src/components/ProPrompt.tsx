import { Crown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FREE_MAX_TEAMS, requestPro, useAuth } from '../store/auth';
import { Drawer } from './ui';

/** Shown when a free account tries to go past 2 teams. */
export function ProPrompt({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const ask = async () => {
    setBusy(true);
    setFailed(!(await requestPro()));
    setBusy(false);
  };

  return (
    <Drawer title="Pro: more than 2 teams" onClose={onClose} footer={<><span className="spacer" /><button className="btn" onClick={onClose}>Close</button></>}>
      <div className="row" style={{ gap: 14, padding: 14, borderRadius: 12, background: 'var(--surface-2)' }}>
        <Crown size={30} />
        <div>
          <strong>The free plan runs an auction with {FREE_MAX_TEAMS} teams.</strong>
          <div className="muted" style={{ fontSize: 13 }}>Add players for both teams and try the whole auction, free. Pro removes the team limit.</div>
        </div>
      </div>
      {!user ? (
        <p style={{ fontSize: 14 }}>
          <Link to="/account" onClick={onClose}>Sign in with Google</Link> first, then ask for Pro.
        </p>
      ) : user.proRequested ? (
        <div className="banner banner-cream">Your Pro request is with the KhiladiAuction team. You will get access as soon as it is approved. Reload this page after that.</div>
      ) : (
        <>
          <p style={{ fontSize: 14 }}>Send a request and the KhiladiAuction team will switch your account to Pro.</p>
          <div className="row">
            <button className="btn btn-primary" disabled={busy} onClick={() => void ask()}>{busy ? 'Sending…' : 'Request Pro'}</button>
          </div>
          {failed && <p className="hint" style={{ color: 'var(--danger-ink)' }}>Could not send the request. Check the internet and try again.</p>}
        </>
      )}
    </Drawer>
  );
}
