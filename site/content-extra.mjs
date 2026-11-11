// Blog articles, the Excel comparison and the use-case pages.
// Only describe what the app really does today (see content.mjs).
// Receives the page helpers from content.mjs so the two files don't import each other.
import { SITE } from './config.mjs';
import { abs, esc } from './layout.mjs';

const PUBLISHED = '2026-11-12';

// ---------- blog articles ----------
// sections: [heading, [paragraph | { list: [...] }]]

export const ARTICLES = [
  {
    slug: 'how-to-conduct-cricket-player-auction',
    title: 'How to Conduct a Cricket Player Auction for Your Tournament',
    description: 'A simple step-by-step plan to run an IPL-style player auction for a box cricket, tennis-ball or corporate league: rules, player list, teams, auction day and results.',
    h1: 'How to conduct a cricket player auction for your tournament',
    lead: 'A player auction makes a local league feel like the IPL. This plan works for 6 to 16 teams and needs one laptop and one screen.',
    sections: [
      ['1. Fix the rules first', [
        'Decide the purse for every team, the smallest and biggest squad, the groups (categories) of players, their base prices and how much each bid goes up. Write them down and share them with team owners a few days before.',
        'Local leagues usually keep the rules simple: the same purse for every team, a minimum squad that lets the team play, and a maximum so nobody hoards players.',
      ]],
      ['2. Collect the players', [
        'Ask players to register on a form: name, mobile number, playing role, photo and T-shirt size. The KhiladiAuction registration link does this and puts every new player on hold until you check the details.',
        'Then give each player a category and base price. Captains or icon players can be kept (retained) before the auction starts.',
      ]],
      ['3. Set up teams and the screen', [
        'Enter each team with its owner, colour and logo. Open the live screen on a projector or TV and keep the auction console on your laptop.',
        'Do a practice run with a few players so everyone knows how a bid, SOLD and UNSOLD look.',
      ]],
      ['4. Run the auction', [
        'The auctioneer calls the player and the base price. Owners raise paddles. The person at the laptop taps the team that bid. When nobody bids higher, press SOLD and move to the next player.',
        { list: ['Mistakes are fixed with Undo, so the show never stops.', 'Unsold players can return in a second round.', 'At an upper price limit, a lucky draw can pick the winner fairly.'] },
      ]],
      ['5. After the auction', [
        'Open Results to see every squad and the money left. Export the squads to Excel and share them with the teams. If you collected T-shirt sizes, download the T-shirt list and send it to your printer.',
      ]],
    ],
    faq: [
      ['How many teams can a local player auction have?', 'Most local leagues run 6 to 16 teams. The app has no fixed limit on teams or players.'],
      ['Do I need a special screen?', 'No. Any laptop with Chrome or Edge and a projector or TV with an HDMI cable is enough.'],
    ],
  },
  {
    slug: 'player-auction-rules-for-local-tournaments',
    title: 'Player Auction Rules for Local Tournaments: Purse, Squad, Base Price and RTM',
    description: 'The rules most local tournaments use for a player auction: purse, squad size, categories, base price, bid steps, retention, Right to Match and unsold players.',
    h1: 'Player auction rules for local tournaments',
    lead: 'Clear rules stop arguments on auction day. Here are the rules local leagues use most, and how to choose them.',
    sections: [
      ['Purse and squad size', [
        'Every team gets the same purse, in ₹ Crore, ₹ Lakh or points. Points work well when real rupees would confuse people.',
        'Set a minimum squad (so a team can field a side) and a maximum. The app works out each team’s maximum bid so a team cannot spend so much that it can no longer fill its minimum squad.',
      ]],
      ['Categories and base prices', [
        'Group players into Marquee, A, B and C, or your own groups. Each group has its own base price and bid step. A star player can also have his own base price.',
        'You can limit how many players of one group a team may take, for example at most 2 marquee players, or at least 1 goalkeeper in football.',
      ]],
      ['Bid steps', [
        'A small raise at low prices and a bigger raise at high prices keeps the auction quick. For example, ₹5 Lakh steps below ₹1 Crore and ₹10 Lakh steps above it.',
      ]],
      ['Retained players and Right to Match', [
        'Retention lets a team keep a captain or icon player before the auction; his price comes out of the purse. Right to Match (RTM) gives a player’s previous team the chance to match the final bid. Limit the number of RTM cards per team.',
      ]],
      ['Upper price limit and lucky draw', [
        'An upper limit stops one player from taking the whole purse. When bidding reaches the limit, teams that still want the player can go into a lucky draw instead of the fastest hand winning.',
      ]],
      ['Unsold players', [
        'Decide in advance: do unsold players come back in a second round, or are they out? Both are easy to run; just agree before the auction.',
      ]],
    ],
    faq: [
      ['Should I use rupees or points?', 'Points are simpler for village and school leagues. Rupees feel closer to the IPL. The app supports ₹ Crore, ₹ Lakh and points.'],
    ],
  },
  {
    slug: 'purse-base-price-categories-setup',
    title: 'How to Set Purse, Base Price and Categories for a Player Auction',
    description: 'Worked examples of purse, base price and categories for cricket, kabaddi and football player auctions, and a quick way to check your numbers.',
    h1: 'How to set the purse, base price and categories',
    lead: 'The purse and base prices decide how the auction feels. Use these examples as a starting point and change the numbers for your league.',
    sections: [
      ['A simple check for your numbers', [
        'Take the purse, divide it by the squad size, and compare it with your base prices. If the average player price is far above your base prices, bidding will stop early; if it is far below, teams will end with lots of money left.',
      ]],
      ['Example: cricket, 8 teams', [
        { list: ['Purse: ₹10 Crore per team', 'Squad: 11 to 14 players', 'Categories: Marquee ₹50 L · A ₹30 L · B ₹20 L · C ₹10 L'] },
        'With 8 teams and 14 players each you need 112 players. Make about 8 marquee players, 24 in A, 40 in B and the rest in C.',
      ]],
      ['Example: kabaddi, 6 teams', [
        { list: ['Purse: 50,000 points', 'Squad: 10 to 12 players', 'Categories: Raiders, Defenders, All-rounders with a minimum per team for each'] },
      ]],
      ['Example: football, 8 teams', [
        { list: ['Purse: ₹1 Crore or 10,000 points', 'Squad: 8 to 16 players', 'Categories: Icon, Goalkeepers (minimum 1 per team), Players'] },
      ]],
      ['Practice with the demo', [
        'Create an auction with demo teams and players, try your numbers and run a few players. Settings can be changed any time before the auction starts.',
      ]],
    ],
    faq: [],
  },
  {
    slug: 'player-auction-day-checklist',
    title: 'Player Auction Day Checklist: Laptop, Projector and Live Screen Setup',
    description: 'A checklist for auction day: laptop, projector, HDMI, sound, paddles, the live screen on full screen and sharing the live link on WhatsApp.',
    h1: 'Player auction day checklist',
    lead: 'Most auction-day problems are small things. Tick these off the evening before and the show runs smoothly.',
    sections: [
      ['The evening before', [
        { list: ['Charge the laptop and carry the charger', 'Test the projector or TV with the HDMI cable', 'Open the auction and check every team and player once', 'Download a backup of the auction'] },
      ]],
      ['At the venue', [
        { list: ['Put the live screen on the projector and press F11 for full screen', 'Keep the auction console on the laptop screen', 'Test the sound if you use the gavel and bid sounds', 'Keep paddles or cards with team names for the owners', 'One person on the laptop, one auctioneer calling the bids'] },
      ]],
      ['Sharing with people who can’t come', [
        'Send the live screen link on WhatsApp. Owners and fans can watch every bid on their phones. Phone numbers of players and owners are never shown on it.',
      ]],
      ['If the internet is weak', [
        'The auction runs in the laptop’s browser, so a weak network does not stop it. The online copy catches up when the connection returns.',
      ]],
    ],
    faq: [],
  },
  {
    slug: 'stream-player-auction-on-youtube-obs',
    title: 'How to Stream Your Player Auction on YouTube with OBS',
    description: 'Show your local player auction live on YouTube: open the live screen, capture its window in OBS and go live. Simple steps and tips for sound and layout.',
    h1: 'How to stream your player auction on YouTube',
    lead: 'The live screen is a normal web page, so you can capture it in free streaming software like OBS and broadcast the auction on YouTube or Facebook.',
    sections: [
      ['What you need', [
        { list: ['A laptop that can run OBS Studio (free) and a good internet connection', 'A YouTube channel with live streaming enabled', 'The auction’s live screen open in its own browser window'] },
      ]],
      ['Steps', [
        { list: ['Open the live screen in a separate Chrome window.', 'In OBS, add a “Window Capture” source and choose that window.', 'Add your microphone and, if you like, a camera showing the auctioneer.', 'In YouTube Studio create a live stream and copy the stream key into OBS.', 'Press Start Streaming in OBS, then Go Live on YouTube.'] },
        'Run the auction console in a different window or on a second screen so viewers only see the live screen.',
      ]],
      ['Tips', [
        { list: ['Test with a private stream first.', 'Use a wired internet connection if you can.', 'Share the YouTube link with team owners before the auction.'] },
      ]],
    ],
    faq: [],
  },
  {
    slug: 'player-registration-form-for-auction',
    title: 'Player Registration Form for an Auction: What to Ask (with T-shirt Sizes)',
    description: 'What to ask players on a registration form for your auction: name, mobile, role, photo, jersey name and number, T-shirt size and extra T-shirts. Free link included.',
    h1: 'The player registration form: what to ask',
    lead: 'A good form saves you hours of typing and chasing. Here is what to ask, and how KhiladiAuction collects it from players’ phones.',
    sections: [
      ['Ask only what you need', [
        { list: ['Full name, as it should appear on the screen', 'Mobile number (also stops duplicate forms)', 'Playing role, such as batsman, bowler, all-rounder, wicket-keeper or fielder', 'Photo for the live screen', 'Jersey name and number', 'T-shirt size'] },
      ]],
      ['T-shirts: custom sizes and extras', [
        'Players choose S to XXL or type their own size such as 3XL or Kids 30. They can also order extra T-shirts: another one for themselves, or ones for family and friends who are not playing. You download the full T-shirt list in Excel with a count for every size.',
      ]],
      ['How it works', [
        'Copy the registration link from the Players page and send it on WhatsApp. Players fill the form on their phones with no login. Each form appears in your Players list as “on hold” so you can check it, set the category and base price, and bring the player into the auction.',
      ]],
    ],
    faq: [
      ['Do players need to log in?', 'No. They only need the link.'],
      ['Can the same player register twice?', 'No. A second form with the same mobile number is refused.'],
    ],
  },
  {
    slug: 'lucky-draw-when-two-teams-want-the-same-player',
    title: 'What to Do When Two Teams Want the Same Player: Upper Limit and Lucky Draw',
    description: 'How an upper price limit and a lucky draw settle a player auction fairly when several teams want the same player at the top price.',
    h1: 'When two teams want the same player: upper limit and lucky draw',
    lead: 'At the top price, the fastest hand should not decide who gets the star player. A lucky draw is a fair way to settle it.',
    sections: [
      ['The problem', [
        'Without a limit, one team can push the price up until it takes most of its purse, and arguments start about who raised first.',
      ]],
      ['The fix', [
        'Set an upper price limit for all players, or a different one for a category. When bidding reaches it, every team that still wants the player says yes, and a fortune-wheel draw picks the winner. The winner pays the limit.',
        'All screens show the same spin and the same winner, so there is nothing to argue about.',
      ]],
      ['Who can join the draw', [
        'You choose: only the teams that bid for the player, or any team that can still afford him.',
      ]],
    ],
    faq: [],
  },
];

// ---------- use-case pages ----------

export const USE_CASES = [
  {
    slug: 'corporate-cricket-auction',
    title: 'Corporate Cricket Auction Software for Office Leagues | KhiladiAuction',
    description: 'Run an IPL-style player auction for your company’s cricket league: department teams, points or rupees, live screen for the office and results in Excel. Free to start.',
    h1: 'Corporate cricket auction software',
    lead: 'Turn your office cricket league into an event: managers bid for employees with points or rupees while the live screen shows every SOLD.',
    points: [
      ['Teams for departments', 'Make a team for each department or building, with its manager as owner.'],
      ['Points or rupees', 'Use points so nobody worries about real money, or ₹ Crore and Lakh for the IPL feel.'],
      ['Fair for every skill level', 'Categories and squad rules make sure each team gets a mix of players, not only the stars.'],
      ['A screen for the whole office', 'Put the live screen on the conference room TV and share the link with colleagues who work from home.'],
    ],
  },
  {
    slug: 'school-college-sports-auction',
    title: 'School and College Sports Player Auction App | KhiladiAuction',
    description: 'A player auction for school and college sports festivals: house or class teams, points, live screen on the big screen. Cricket, kabaddi, football and more. Free.',
    h1: 'Player auction for school and college sports',
    lead: 'Make your annual sports festival exciting: student captains bid for players with points and the whole ground watches the screen.',
    points: [
      ['Points, not money', 'Give every house or class team the same points purse.'],
      ['Many sports in one place', 'Cricket, kabaddi, football, volleyball, hockey, basketball and badminton are supported.'],
      ['Easy sign-up', 'Students register with a link on their phones; teachers check the entries.'],
      ['Results to share', 'Download the squads in Excel and print team sheets.'],
    ],
  },
  {
    slug: 'society-and-village-league-auction',
    title: 'Society, Village and Gully League Player Auction App | KhiladiAuction',
    description: 'Player auction software for housing society, village and gully leagues. Add teams and players, bid live, show SOLD on the projector. Works from one laptop. Free to start.',
    h1: 'Player auction for society, village and gully leagues',
    lead: 'Your league does not need a big budget to feel like the IPL. One laptop, one projector and the live screen are enough.',
    points: [
      ['Works from one laptop', 'No app to install for owners. The auction runs in the laptop’s browser.'],
      ['Weak network is fine', 'The auction keeps running even if the internet drops.'],
      ['Share on WhatsApp', 'Send the live link so families and fans can watch from home.'],
      ['Hindi and Marathi website', 'The website is available in Hindi and Marathi for your team owners.'],
    ],
  },
];

// ---------- page builders ----------

export function extraPages(h) {
  const { pageHead, ctaBand, faqSchema, crumbs, features, faqHtml, screenMock } = h;

  const renderSection = ([heading, parts]) =>
    `<h2>${esc(heading)}</h2>${parts
      .map((p) => (typeof p === 'string' ? `<p>${esc(p)}</p>` : `<ul class="ticks">${p.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`))
      .join('')}`;

  const articleSchema = (a) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.h1,
    description: a.description,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    inLanguage: 'en-IN',
    mainEntityOfPage: abs(`/blog/${a.slug}/`),
    author: { '@type': 'Organization', name: SITE.brand },
    publisher: { '@type': 'Organization', name: SITE.brand, logo: { '@type': 'ImageObject', url: abs('/assets/apple-touch-icon.png') } },
    image: abs('/assets/og-image.png'),
  });

  const articlePage = (a) => {
    const others = ARTICLES.filter((o) => o !== a).slice(0, 3);
    return {
      path: `/blog/${a.slug}/`,
      lang: 'en',
      title: `${a.title} | KhiladiAuction`,
      description: a.description,
      ogType: 'article',
      priority: '0.7',
      schema: [
        articleSchema(a),
        ...(a.faq.length ? [faqSchema(a.faq)] : []),
        crumbs([['Home', '/'], ['Blog', '/blog/'], [a.h1, `/blog/${a.slug}/`]]),
      ],
      body: `${pageHead('Guide', a.h1, esc(a.lead))}
      <section class="sec">
        <div class="wrap narrow prose">
          <p class="meta">Updated ${new Date(PUBLISHED).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          ${a.sections.map(renderSection).join('')}
          ${a.faq.length ? `<h2>Quick answers</h2>${faqHtml(a.faq)}` : ''}
          <h2>Related guides</h2>
          <ul class="ticks">${others.map((o) => `<li><a href="/blog/${o.slug}/">${esc(o.h1)}</a></li>`).join('')}</ul>
        </div>
      </section>
${ctaBand('Run your own player auction', 'Set it up in an evening. Free during launch.')}`,
    };
  };

  const blogIndex = {
    path: '/blog/',
    lang: 'en',
    title: 'Player Auction Guides and Tips for Tournament Organisers | KhiladiAuction',
    description: 'Guides for running a player auction: rules, purse and base price, auction-day checklist, registration forms, YouTube streaming and lucky draw.',
    priority: '0.8',
    schema: [crumbs([['Home', '/'], ['Blog', '/blog/']])],
    body: `${pageHead('Blog', 'Player auction guides for organisers', 'Plain, practical advice for running a local cricket, kabaddi or football player auction.')}
      <section class="sec">
        <div class="wrap">
          <div class="features">${ARTICLES.map((a) => `<article class="feature"><h3><a href="/blog/${a.slug}/">${esc(a.h1)}</a></h3><p>${esc(a.lead)}</p></article>`).join('')}</div>
        </div>
      </section>
${ctaBand('Ready to run yours?', 'Free during launch. Works on any laptop with Chrome or Edge.')}`,
  };

  const compareRows = [
    ['Purse and squad rules', 'You check every bid by hand', 'Checked automatically; each team’s maximum bid is worked out'],
    ['Showing bids to the crowd', 'Whiteboard or shared sheet', 'Full-screen live screen with a SOLD moment'],
    ['Mistakes', 'Cross out and recalculate', 'Undo for bids, SOLD and UNSOLD'],
    ['Same price, several teams', 'Argument', 'Lucky draw on a fortune wheel'],
    ['Collecting players', 'Typing from forms and chats', 'Registration link; players fill it on their phones'],
    ['People who can’t attend', 'Phone calls', 'Live link on WhatsApp'],
    ['Results', 'Rebuild in a new sheet', 'Squads and money left in one click, export to Excel'],
  ];
  const faqCompare = [
    ['Can I still use Excel with KhiladiAuction?', 'Yes. Import your players from Excel and export the squads and results back to Excel.'],
    ['Is KhiladiAuction harder than a spreadsheet?', 'No. You create an auction, add teams and players and start bidding. Most organisers are ready in an evening.'],
  ];
  const comparePage = {
    path: '/excel-vs-player-auction-software/',
    lang: 'en',
    title: 'Excel vs Player Auction Software: Which Is Better for Your League? | KhiladiAuction',
    description: 'Compare running a player auction on Excel or a whiteboard with auction software: purse checks, live screen, undo, lucky draw, registration and results.',
    priority: '0.8',
    schema: [faqSchema(faqCompare), crumbs([['Home', '/'], ['Excel vs auction software', '/excel-vs-player-auction-software/']])],
    body: `${pageHead('Compare', 'Excel vs player auction software', 'A spreadsheet works for 4 teams and a quiet room. Here is where auction software saves you.')}
      <section class="sec">
        <div class="wrap">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>On auction day</th><th>Excel or whiteboard</th><th>KhiladiAuction</th></tr></thead>
            <tbody>${compareRows.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody>
          </table></div>
          <p class="note">You can keep using Excel for your player list: import it, and export the results.</p>
        </div>
      </section>
      <section class="sec sec-tint">
        <div class="wrap narrow">
          <h2 class="sec-title">Questions</h2>
          ${faqHtml(faqCompare)}
        </div>
      </section>
${ctaBand('Try it on your next auction', 'Free during launch.')}`,
  };

  const useCasePage = (u) => ({
    path: `/${u.slug}/`,
    lang: 'en',
    title: u.title,
    description: u.description,
    priority: '0.8',
    schema: [crumbs([['Home', '/'], [u.h1, `/${u.slug}/`]])],
    body: `${pageHead('Player auction software', u.h1, esc(u.lead))}
      <section class="sec">
        <div class="wrap split">
          <div class="prose">${u.points.map(([t, p]) => `<h2>${esc(t)}</h2><p>${esc(p)}</p>`).join('')}</div>
          ${screenMock()}
        </div>
      </section>
      <section class="sec sec-tint">
        <div class="wrap">
          <h2 class="sec-title">More guides</h2>
          ${features(ARTICLES.slice(0, 3).map((a) => [a.h1, esc(a.lead)]))}
        </div>
      </section>
${ctaBand('Start your auction', 'Free during launch. No download, no card.')}`,
  });

  return [blogIndex, ...ARTICLES.map(articlePage), comparePage, ...USE_CASES.map(useCasePage)];
}
