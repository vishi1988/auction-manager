// Shared page frame: <head> with all SEO tags, header, footer.
import { SITE } from './config.mjs';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const abs = (path) => SITE.url + path;

const UI = {
  en: {
    nav: [['/features/', 'Features'], ['/#sports', 'Sports'], ['/blog/', 'Blog'], ['/pricing/', 'Pricing'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']],
    cta: 'Start free auction',
    skip: 'Skip to content',
    footSports: 'Auctions by sport',
    footProduct: 'Product',
    footLang: 'Language',
    footLegal: 'Legal',
    tagline: 'Live player auction software for local cricket, kabaddi, football and volleyball leagues.',
    privacy: 'Privacy',
    terms: 'Terms',
    howTo: 'How it works',
  },
  hi: {
    nav: [['/hi/#features', 'फ़ीचर्स'], ['/hi/#sports', 'खेल'], ['/pricing/', 'कीमत'], ['/faq/', 'FAQ'], ['/contact/', 'संपर्क']],
    cta: 'फ्री ऑक्शन शुरू करें',
    skip: 'मुख्य भाग पर जाएँ',
    footSports: 'खेल के अनुसार ऑक्शन',
    footProduct: 'प्रोडक्ट',
    footLang: 'भाषा',
    footLegal: 'नियम',
    tagline: 'लोकल क्रिकेट, कबड्डी, फुटबॉल और वॉलीबॉल लीग के लिए लाइव प्लेयर ऑक्शन सॉफ्टवेयर।',
    privacy: 'प्राइवेसी',
    terms: 'शर्तें',
    howTo: 'कैसे काम करता है',
  },
  mr: {
    nav: [['/mr/#features', 'फीचर्स'], ['/mr/#sports', 'खेळ'], ['/pricing/', 'किंमत'], ['/faq/', 'FAQ'], ['/contact/', 'संपर्क']],
    cta: 'फ्री ऑक्शन सुरू करा',
    skip: 'मुख्य भागावर जा',
    footSports: 'खेळानुसार ऑक्शन',
    footProduct: 'प्रोडक्ट',
    footLang: 'भाषा',
    footLegal: 'नियम',
    tagline: 'लोकल क्रिकेट, कबड्डी, फुटबॉल आणि व्हॉलीबॉल लीगसाठी लाइव्ह प्लेयर ऑक्शन सॉफ्टवेअर.',
    privacy: 'प्रायव्हसी',
    terms: 'अटी',
    howTo: 'कसे चालते',
  },
};

const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Mukta:wght@400;600;700&display=swap';

/**
 * page: { path, lang, title, description, body, schema?: object[], alternates?: {lang: path},
 *         noindex?: boolean, ogType?: string }
 */
export function renderPage(page) {
  const ui = UI[page.lang] ?? UI.en;
  const url = abs(page.path);
  const alternates = page.alternates
    ? Object.entries(page.alternates)
        .map(([lang, p]) => `<link rel="alternate" hreflang="${lang}" href="${abs(p)}">`)
        .join('\n    ') + `\n    <link rel="alternate" hreflang="x-default" href="${abs(page.alternates.en ?? '/')}">`
    : '';
  const schema = (page.schema ?? []).map((s) => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, '\\u003c')}</script>`).join('\n    ');
  const navLinks = ui.nav.map(([href, label]) => `<a href="${href}"${page.path === href ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const langLinks = [
    ['/', 'English', 'en'],
    ['/hi/', 'हिंदी', 'hi'],
    ['/mr/', 'मराठी', 'mr'],
  ]
    .map(([href, label, l]) => `<a href="${href}" lang="${l}" hreflang="${l}"${page.lang === l ? ' aria-current="true"' : ''}>${label}</a>`)
    .join('');

  return `<!doctype html>
<html lang="${page.lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}">
    <meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
    <link rel="canonical" href="${url}">
    ${alternates}
    <meta property="og:type" content="${page.ogType ?? 'website'}">
    <meta property="og:site_name" content="${SITE.brand}">
    <meta property="og:title" content="${esc(page.title)}">
    <meta property="og:description" content="${esc(page.description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${abs('/assets/og-image.png')}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="${{ en: 'en_IN', hi: 'hi_IN', mr: 'mr_IN' }[page.lang]}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#0b1220">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${FONTS}">
    <link rel="stylesheet" href="/assets/site.css?v=${page.cssVersion}">
    ${schema}
  </head>
  <body>
    <a class="skip" href="#main">${esc(ui.skip)}</a>
    <header class="top">
      <div class="wrap top-in">
        <a class="logo" href="${page.lang === 'en' ? '/' : '/' + page.lang + '/'}" aria-label="${SITE.brand} home">
          <span class="logo-mark" aria-hidden="true">KA</span><span class="logo-word">Khiladi<b>Auction</b></span>
        </a>
        <nav class="nav" aria-label="Main">${navLinks}</nav>
        <a class="btn btn-gold btn-sm top-cta" href="/app/">${esc(ui.cta)}</a>
      </div>
    </header>
    <main id="main">
${page.body}
    </main>
    <footer class="foot">
      <div class="wrap foot-grid">
        <div class="foot-brand">
          <a class="logo" href="/"><span class="logo-mark" aria-hidden="true">KA</span><span class="logo-word">Khiladi<b>Auction</b></span></a>
          <p>${esc(ui.tagline)}</p>
          ${contactLines()}
        </div>
        <div>
          <h2>${esc(ui.footSports)}</h2>
          <a href="/cricket-player-auction/">Cricket player auction</a>
          <a href="/kabaddi-player-auction/">Kabaddi player auction</a>
          <a href="/football-player-auction/">Football player auction</a>
          <a href="/volleyball-player-auction/">Volleyball player auction</a>
        </div>
        <div>
          <h2>${esc(ui.footProduct)}</h2>
          <a href="/features/">Features</a>
          <a href="/how-it-works/">${esc(ui.howTo)}</a>
          <a href="/pricing/">Pricing</a>
          <a href="/faq/">FAQ</a>
          <a href="/blog/">Blog and guides</a>
          <a href="/excel-vs-player-auction-software/">Excel vs software</a>
          <a href="/corporate-cricket-auction/">Corporate cricket auction</a>
          <a href="/school-college-sports-auction/">School and college auction</a>
          <a href="/society-and-village-league-auction/">Society and village leagues</a>
          <a href="/app/">Open the app</a>
        </div>
        <div>
          <h2>${esc(ui.footLang)}</h2>
          <div class="langs">${langLinks}</div>
          <h2>${esc(ui.footLegal)}</h2>
          <a href="/privacy/">${esc(ui.privacy)}</a>
          <a href="/terms/">${esc(ui.terms)}</a>
        </div>
      </div>
      <div class="wrap foot-base">© ${new Date().getFullYear()} ${SITE.brand}</div>
    </footer>
  </body>
</html>
`;
}

export function contactLines() {
  const lines = [];
  if (SITE.whatsapp) lines.push(`<a href="https://wa.me/${SITE.whatsapp.replace(/\D/g, '')}">WhatsApp: ${esc(SITE.whatsapp)}</a>`);
  if (SITE.email) lines.push(`<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>`);
  if (SITE.city) lines.push(`<span>${esc(SITE.city)}</span>`);
  return lines.length ? `<p class="foot-contact">${lines.join('<br>')}</p>` : '';
}
