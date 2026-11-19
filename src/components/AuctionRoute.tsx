import { ArrowLeft } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { canOpen, type Area } from '../lib/roles';
import { openAuction, useAuctionStatus, useRole, watchAuction } from '../store/store';
import { EMBED } from './ScreenLink';

/** Opens the auction named in the URL for everything rendered inside it. */
export function AuctionRoute() {
  const { auctionId = '' } = useParams();
  const { pathname } = useLocation();
  openAuction(auctionId);
  const status = useAuctionStatus();
  // With cloud sync, an auction made on another device arrives a moment later.
  useEffect(() => watchAuction(auctionId), [auctionId]);
  if (status === 'loading') {
    return (
      <main className="page">
        <div className="empty" style={{ minHeight: '50vh', justifyContent: 'center' }}>
          <span className="live-dot" style={{ background: 'var(--primary)' }} />
          <p>Opening the auction…</p>
        </div>
      </main>
    );
  }
  if (status === 'missing') {
    return (
      <main className="page">
        <div className="empty">
          <h1 className="display" style={{ fontSize: 36, color: 'var(--ink)' }}>Auction not found</h1>
          <p>It may have been deleted, the link may be from another device, or the internet may be off.</p>
          <Link className="btn btn-primary" to="/">Go to My Auctions</Link>
        </div>
      </main>
    );
  }
  // In the embed preview, public screens open in place, so give them a way back.
  const publicScreen = /\/(live|overlay|owner|register)(\/|$)/.test(pathname);
  return (
    <>
      {/* key: remount pages when switching auctions so local page state resets. */}
      <Outlet key={auctionId} />
      {EMBED && publicScreen && (
        <Link to={'/a/' + auctionId} className="btn btn-sm" style={{ position: 'fixed', left: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 90, boxShadow: 'var(--shadow-lg)' }}>
          <ArrowLeft size={15} />Back to admin
        </Link>
      )}
    </>
  );
}

/** Shows a screen only to the roles allowed to use it; others land on the auction's overview. */
export function RequireRole({ area, children }: { area: Area; children: ReactNode }) {
  const role = useRole();
  const path = useAuctionPath();
  if (!canOpen(role, area)) return <Navigate to={path('')} replace />;
  return <>{children}</>;
}

/** Builds links inside the current auction: path('/live') -> /a/<id>/live */
export function useAuctionPath() {
  const { auctionId = '' } = useParams();
  return (p: string) => '/a/' + auctionId + p;
}
