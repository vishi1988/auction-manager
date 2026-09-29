import { ArrowLeft } from 'lucide-react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { openAuction } from '../store/store';
import { EMBED } from './ScreenLink';

/** Opens the auction named in the URL for everything rendered inside it. */
export function AuctionRoute() {
  const { auctionId = '' } = useParams();
  const { pathname } = useLocation();
  if (!openAuction(auctionId)) {
    return (
      <main className="page">
        <div className="empty">
          <h1 className="display" style={{ fontSize: 36, color: 'var(--ink)' }}>Auction not found</h1>
          <p>It may have been deleted, or the link is from another device.</p>
          <Link className="btn btn-primary" to="/">Go to My Auctions</Link>
        </div>
      </main>
    );
  }
  // In the embed preview, public screens open in place, so give them a way back.
  const publicScreen = /\/(live|owner|register)(\/|$)/.test(pathname);
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

/** Builds links inside the current auction: path('/live') -> /a/<id>/live */
export function useAuctionPath() {
  const { auctionId = '' } = useParams();
  return (p: string) => '/a/' + auctionId + p;
}
