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
| `src/firebase/config.ts` | Firebase project keys — empty means local mode |
| `firestore.rules` | Who may read and write auctions in the cloud |
| `firebase.json` | Hosting and rules settings for `npm run deploy` |

## Where data is saved

**Local mode (default).** Data is saved in the browser on this computer. Use
**Account → Download backup** before clearing browser data or moving to another computer.

**Cloud sync (optional).** When the keys in `src/firebase/config.ts` are filled in, auctions
are also saved in Firebase. There is no login: each browser gets a silent anonymous identity.

- The browser that created an auction is the only one that can change it.
- Any device that has the auction's link can watch it (for example the Live screen).
- The auction keeps running without internet and catches up when it is back.
- Clearing the organiser browser's data loses the right to change its cloud auctions, so
  still download a backup.

### Turning cloud sync on

1. In the [Firebase console](https://console.firebase.google.com) create a project (free Spark plan).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database** (production mode, region `asia-south1`).
4. **Project settings → Your apps → Web (`</>`)**, register an app, and copy the `firebaseConfig`
   values into `src/firebase/config.ts`.
5. In a terminal: `npx firebase-tools login`, then `npx firebase-tools use --add` and pick the project.
6. `npm run deploy` publishes the security rules and puts the app on `https://<project>.web.app`.
7. In the app, **Account → Upload auctions to the cloud** moves existing auctions over.
