# KhiladiAuction

Player auctions for local tournaments — cricket, football, kabaddi, volleyball and more.
Set up teams and players, run the bidding from a laptop, and show every SOLD moment on a
projector. Live at khiladiauction.com: a public website for Google, the app at `/app/`,
and a small PHP + MySQL API at `/api/` for cloud sync (Hostinger).

## Run it

Double-click `start.cmd`, or in a terminal:

```
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development (local mode, no cloud) |
| `npm test` | Run the auction-rule and app tests |
| `npm run typecheck` | Check types |
| `npm run build:hostinger` | Build website + app + API into `dist-hostinger/` and `dist-hostinger.zip` |
| `npm run test:api` | Check the PHP API against a running server (see below) |
| `npm run build:embed` | Single-file preview for claude.ai |

To put it on Hostinger, follow [HOSTINGER-SETUP.md](HOSTINGER-SETUP.md).

## Where things are

| Path | Contents |
|---|---|
| `src/lib/rules.ts` | Money rules: increments, max bid, reserve purse check, upper limit, RTM, lucky draw entry |
| `src/lib/auction.ts` | Auction flow: next player, bid, sold/unsold, lucky draw, undo, rounds |
| `src/store/` | Saving data: browser storage, plus cloud sync through the PHP API (`cloud.ts`) |
| `src/pages/` | One file per app screen |
| `src/brand.ts` | Product name |
| `server/api/` | PHP API: `auction.php`, `photos.php`, `ping.php`; `config.sample.php` for the database |
| `site/` | Website pages (`content.mjs`), layout and SEO tags (`layout.mjs`), styles, settings (`config.mjs`) |
| `scripts/build-hostinger.mjs` | Builds everything, plus `sitemap.xml`, `robots.txt` and `.htaccess` |

## Where data is saved

**Local build (`npm run dev`).** Everything stays in the browser on this computer.

**Website build (`/app/` on Hostinger).** The browser is still the working copy, so the auction
keeps running without internet. Online auctions are also saved in MySQL through the API.

- No login: the browser that creates an auction holds its secret owner token; only it can change the auction.
- Anyone with an auction's link can watch it (the Live screen on a projector or phone). Phone numbers are removed for viewers.
- **Account → Download backup** includes the owner tokens: restoring it on another computer moves the right to run those auctions there.

## Testing the API locally

With PHP 8.2+ installed:

```
php -S 127.0.0.1:8099 -t server
```

Create `server/api/config.php` from `config.sample.php` (an SQLite DSN like
`sqlite:C:/temp/test.db` works for testing), then run `npm run test:api`.
For the app against that API: `npx vite --mode cloud` (it proxies `/api` to port 8099).
