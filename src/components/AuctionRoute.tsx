import { Link, Outlet, useParams } from 'react-router-dom';
import { openAuction } from '../store/store';

/** Opens the auction named in the URL for everything rendered inside it. */
export function AuctionRoute() {
  const { auctionId = '' } = useParams();
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
  // key: remount pages when switching auctions so local page state resets.
  return <Outlet key={auctionId} />;
}

/** Builds links inside the current auction: path('/live') -> /a/<id>/live */
export function useAuctionPath() {
  const { auctionId = '' } = useParams();
  return (p: string) => '/a/' + auctionId + p;
}
