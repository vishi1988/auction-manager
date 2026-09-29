# Auction Manager

Player auctions for local tournaments — cricket, football, kabaddi, volleyball and more.
Set up teams and players, run the bidding from a laptop or phone, and show every SOLD
moment on a projector.

## Run it

Double-click `start.cmd`, or in a terminal:

```
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm test` | Run the auction-rule tests |
| `npm run typecheck` | Check types |
| `npm run build` | Production build into `dist/` |

## Where things are

| Path | Contents |
|---|---|
| `src/lib/rules.ts` | Money rules: increments, max bid, reserve purse check, upper limit, RTM, lucky draw entry |
| `src/lib/auction.ts` | Auction flow: next player, bid, sold/unsold, lucky draw, undo, rounds |
| `src/lib/rules.test.ts` | Tests for the two files above |
| `src/store/` | Saving data and syncing screens (browser storage now; cloud later) |
| `src/pages/` | One file per screen |
| `src/data/` | Demo data and the list of sports |
| `src/brand.ts` | Product name — change it here |

Data is currently saved in the browser on this computer. Use **Account → Download backup**
before clearing browser data or moving to another computer.
