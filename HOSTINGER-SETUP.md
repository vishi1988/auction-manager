# Putting KhiladiAuction live on Hostinger

One-time setup, about 20 minutes. You need your hPanel login and the file
`dist-hostinger.zip` (made by `npm run build:hostinger`).

## 1. Check the settings before building

Open `site/config.mjs` and fill in:

- `url` — your main address, e.g. `https://khiladiauction.com`
- `altDomains` — your other domain(s), e.g. `khiladiauction.in`; they will redirect to the main one
- `whatsapp`, `email`, `city` — shown on the website (left out while empty)

Then run `npm run build:hostinger`. It creates `dist-hostinger.zip`.

## 2. PHP version

hPanel → **Websites → your domain → Advanced → PHP Configuration** → choose **PHP 8.2 or newer**.

## 3. Create the database

hPanel → **Databases → Management (MySQL Databases)**:

1. Database name: e.g. `khiladi` (Hostinger adds a prefix, like `u123456789_khiladi`)
2. Username: e.g. `khiladi` (becomes `u123456789_khiladi`)
3. Choose a strong password and keep it safe. **Don't send it to anyone.**

You don't need phpMyAdmin: the app creates its tables by itself.

## 4. Upload the website

hPanel → **Files → File Manager** → open `public_html`:

1. Delete Hostinger's default `default.php` / `index.php` placeholder if there is one.
2. Upload `dist-hostinger.zip`, right-click it → **Extract** → into `public_html` itself (not a sub-folder).
3. Delete the zip after extracting.
4. Turn on **Show hidden files** (settings icon) and check that `.htaccess` is there.

## 5. Connect the database

In File Manager, open `public_html/api/`:

1. Right-click `config.sample.php` → **Copy** → name it `config.php`.
2. Edit `config.php` and replace:
   - `DATABASE_NAME` → your full database name (e.g. `u123456789_khiladi`)
   - `DATABASE_USER` → your full username (e.g. `u123456789_khiladi`)
   - `DATABASE_PASSWORD` → your password
3. Save.

Check it: open `https://khiladiauction.com/api/ping.php`.
You should see `{"ok":true,"database":"connected",...}`.

Later uploads never touch `config.php`, so you only do this once.

## 6. SSL (https)

hPanel → **Security → SSL** → install the free SSL for the domain (and `www`).
Wait until it shows **Active**. The site redirects every visitor to `https://`.

## 7. Test

- `https://khiladiauction.com` — website
- `https://khiladiauction.com/app/` — the app. Go to **Account**: it should say **Cloud sync on**.
- Create an auction, open its **Live screen** and send that link to your phone. It updates within a second of each bid.

## 8. Google

1. Go to <https://search.google.com/search-console> → **Add property** → **Domain** → `khiladiauction.com`.
2. Google shows a TXT record. In hPanel → **Domains → DNS / Nameservers**, add that TXT record, then click **Verify** in Search Console (it can take up to an hour).
3. Search Console → **Sitemaps** → enter `sitemap.xml` → **Submit**.
4. **URL Inspection** → paste the home page address → **Request indexing**. Do the same for the cricket, kabaddi and football pages.
5. Optional: <https://www.bing.com/webmasters> → **Import from Google Search Console**.
6. Create a **Google Business Profile** for the business, with the website link.

New sites usually appear in Google within a few days to a few weeks.

## Updating the site later

Run `npm run build:hostinger` again and upload/extract the new zip over the old files.
Your auctions (in the database) and `config.php` are not affected.
