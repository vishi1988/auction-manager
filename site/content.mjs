// Every public page of the website: words, SEO titles and structured data.
// Only describe what the app really does today.
import { SITE } from './config.mjs';
import { extraPages } from './content-extra.mjs';
import { abs, contactLines, esc } from './layout.mjs';

// ---------- building blocks ----------

const screenMock = (lang = 'en') => {
  const t = {
    en: ['ON THE BLOCK', 'CURRENT BID', 'LEADING', 'Batsman · Right-hand bat', 'PURSE LEFT'],
    hi: ['ऑक्शन में', 'मौजूदा बोली', 'आगे', 'बल्लेबाज़ · राइट-हैंड', 'बचा पर्स'],
    mr: ['ऑक्शनमध्ये', 'सध्याची बोली', 'आघाडीवर', 'फलंदाज · राइट-हँड', 'उरलेले पर्स'],
  }[lang];
  return `
        <figure class="screen" aria-label="${lang === 'en' ? 'Example of the live projector screen' : 'Live screen'}">
          <div class="screen-bar"><span class="screen-logo">DP</span><b>DEMO PREMIER LEAGUE</b><span class="screen-live"><i></i>LIVE</span></div>
          <div class="screen-body">
            <div class="screen-stage">
              <div class="screen-photo"><span>101</span></div>
              <div class="screen-info">
                <small>${t[0]}</small>
                <strong class="screen-name">ROHIT PAWAR</strong>
                <span class="screen-facts">${t[3]}</span>
                <small>${t[1]}</small>
                <strong class="screen-bid">₹2.20<em>Cr</em></strong>
                <div class="screen-lead"><span>SK</span><div><small>${t[2]}</small><b>SUPER KINGS</b></div></div>
              </div>
            </div>
            <div class="screen-teams">
              ${[
                ['RS', 'Royal Strikers', '9.50', '#e5484d'],
                ['TT', 'Thunder Titans', '8.70', '#2e5bff'],
                ['SK', 'Super Kings', '7.30', '#7c4ddb'],
                ['GG', 'Gully Gladiators', '9.70', '#12a360'],
              ]
                .map(([s, n, p, c]) => `<div class="screen-team${s === 'SK' ? ' hot' : ''}" style="--tc:${c}"><span>${s}</span><b>${n}</b><em>₹${p}</em></div>`)
                .join('')}
            </div>
          </div>
        </figure>`;
};

const features = (items) =>
  `<div class="features">${items
    .map(([title, text]) => `<article class="feature"><h3>${esc(title)}</h3><p>${text}</p></article>`)
    .join('')}</div>`;

const steps = (items) =>
  `<ol class="steps">${items.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${text}</p></li>`).join('')}</ol>`;

const faqHtml = (items) =>
  `<div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</div>`;

const faqSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
});

const crumbs = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
});

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE.brand,
  url: abs('/'),
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web browser (Chrome, Edge, Safari, Firefox)',
  description: 'Live player auction software for local cricket, kabaddi, football and volleyball leagues: teams, purse, categories, live bidding, projector screen and lucky draw.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', description: 'Free during launch' },
  inLanguage: ['en', 'hi', 'mr'],
};

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.brand,
  url: abs('/'),
  logo: abs('/assets/apple-touch-icon.png'),
  ...(SITE.email ? { email: SITE.email } : {}),
  ...(SITE.whatsapp ? { telephone: SITE.whatsapp } : {}),
};

const websiteSchema = { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.brand, url: abs('/'), inLanguage: 'en-IN' };

const ctaBand = (title, text, button = 'Start a free auction') => `
      <section class="band">
        <div class="wrap band-in">
          <div><h2>${esc(title)}</h2><p>${text}</p></div>
          <span class="band-btns"><a class="btn btn-gold" href="/app/">${esc(button)}</a>${SITE.whatsapp ? ` <a class="btn btn-ghost" href="https://wa.me/${SITE.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I want a demo of KhiladiAuction')}">Request a demo on WhatsApp</a>` : ''}</span>
        </div>
      </section>`;

const pageHead = (eyebrow, h1, lead) => `
      <section class="page-hero">
        <div class="wrap">
          <p class="eyebrow">${esc(eyebrow)}</p>
          <h1>${esc(h1)}</h1>
          <p class="lead">${lead}</p>
        </div>
      </section>`;

// ---------- shared English content ----------

const FEATURES_EN = [
  ['Live projector screen', 'Rolling bid amount, leading team, countdown ring and a full-screen SOLD moment with gold sparks. Open it on a second window and press F11.'],
  ['Purse and squad rules', 'Set the purse per team and the minimum and maximum squad. The app works out each team’s maximum bid, so no team can overspend and still fall short of players.'],
  ['Categories and base prices', 'Marquee, A, B or your own groups, each with a base price, raise step, players-per-team limits and an upper price limit.'],
  ['Lucky draw at the upper limit', 'When the bidding reaches the limit, every team that still wants the player goes into a fortune-wheel draw. All screens show the same spin and winner.'],
  ['Fast bidding', 'Tap the team that raised its paddle or press its keyboard key. Undo works on bids, SOLD and UNSOLD, so a mistake never stops the show.'],
  ['Player registration link', 'Send one link on WhatsApp. Players fill name, role, photo, jersey and T-shirt size (or type their own size) on their phones, and can order extra T-shirts for themselves or for non-players. You check each form before it enters the auction.'],
  ['Excel in, Excel out', 'Download the players template, fill it (or paste your Google Form responses) and import. Export the full results and the T-shirt order list to Excel.'],
  ['Share the live link', 'Send the live screen link on WhatsApp. Team owners and supporters watch every bid on their phones; phone numbers stay private.'],
  ['Works without internet', 'The auction runs in the laptop’s browser, so a weak network at the ground doesn’t stop it. The online copy catches up when the connection is back.'],
];

const STEPS_EN = [
  ['Create the auction', 'Pick the sport, name and date. Choose money in ₹ Crore or ₹ Lakh, or use points.'],
  ['Add teams and players', 'Type them in or import from Excel. Add photos and logos, set categories and base prices.'],
  ['Open the live screen', 'Put the live screen on the projector or TV and keep the auction console on your laptop.'],
  ['Run the bidding', 'Tap the team that bids, press SOLD, move to the next player. Results and Excel export are ready the moment you finish.'],
];

const FAQ_EN = [
  ['Is KhiladiAuction free?', 'Yes. It is free during our launch, with every feature and no limit on auctions, teams or players.'],
  ['Do I need internet at the ground?', 'No. The auction runs in your laptop’s browser. Internet is only needed to share the live link with phones, and the online copy catches up when the connection returns.'],
  ['Can players register themselves, and can they order T-shirts?', 'Yes. Share the registration link; players enter their details, photo, jersey name and number and T-shirt size, and can add extra T-shirts for themselves or for people who are not playing. You download the T-shirt list in Excel with a count for each size.'],
  ['Which sports does it support?', 'Cricket, kabaddi, football, volleyball, hockey, basketball and badminton, plus any other sport with simple player roles.'],
  ['Can team owners bid from their own phones?', 'Yes. Each team gets a private bidding link that you send on WhatsApp. The owner sees the player, the current bid and the team purse, and taps BID. The organiser can still enter bids on the laptop, and stays in control of SOLD and UNSOLD.'],
  ['Can I use points instead of money?', 'Yes. Choose ₹ Crore, ₹ Lakh or points when you create the auction.'],
  ['How does the lucky draw work?', 'Set an upper limit for players (for the whole auction or per category). When the bidding reaches it, the teams that still want the player join a draw, and a fortune wheel picks the winner, who pays the limit.'],
  ['Can I import players from Excel or Google Forms?', 'Yes. Download the Excel template from the Players page, fill it or paste your Google Form responses into it, and import it.'],
  ['Is my auction data safe?', 'Your auction is saved in your browser and, for online auctions, on our server. Only the browser that created an auction can change it, and you can download a full backup at any time.'],
  ['What do I need on auction day?', 'A laptop with Chrome or Edge, a projector or TV connected by HDMI, and speakers if you want the gavel sound.'],
  ['Is the app available in Hindi and Marathi?', 'The website has Hindi and Marathi pages. The auction app itself is in English for now.'],
];

// ---------- sport pages ----------

const SPORTS = [
  {
    slug: 'cricket',
    name: 'Cricket',
    title: 'Cricket Player Auction App & Software for Local Leagues | KhiladiAuction',
    description: 'Run an IPL-style cricket player auction for your box cricket, tennis-ball or corporate league. Purse, categories, live bidding, SOLD screen. Free to start.',
    h1: 'Cricket player auction app for local leagues',
    lead: 'Box cricket, tennis-ball tournaments, gully premier leagues and corporate cups: run the player auction with a live projector screen, just like the IPL.',
    roles: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Fielder'],
    extra: 'Cricket players also carry batting hand and bowling style, shown on the live screen as each player comes up.',
    setup: [['Teams', '8'], ['Purse', '₹10 Cr per team'], ['Squad', '11 to 14 players'], ['Categories', 'Marquee ₹50 L · A ₹30 L · B ₹20 L · C ₹10 L']],
    faq: [
      ['How do I run a cricket player auction for my tournament?', 'Create an auction, choose cricket, add teams with their purse and players with their category and base price, then open the live screen on a projector and run the bidding from the console.'],
      ['Can I keep captains or icon players before the auction?', 'Yes. Turn on retained players in Settings and mark them; they are kept out of the bidding and their price comes out of the team’s purse.'],
      ['Does it support Right to Match like the IPL?', 'Yes. Turn on RTM and set each player’s previous team; that team gets the option to match the final price.'],
    ],
  },
  {
    slug: 'kabaddi',
    name: 'Kabaddi',
    title: 'Kabaddi Player Auction App for Local Tournaments | KhiladiAuction',
    description: 'Run a Pro Kabaddi-style player auction for your local kabaddi league. Raiders, defenders and all-rounders, team purse, live bidding screen. Free to start.',
    h1: 'Kabaddi player auction app',
    lead: 'Bring the Pro Kabaddi auction feel to your village, taluka or district kabaddi league, with raiders, defenders and all-rounders bid for live on the big screen.',
    roles: ['Raider', 'Defender', 'All-rounder'],
    extra: 'Use categories to make sure every team gets a balance of raiders and defenders: set a minimum and maximum per team for each category.',
    setup: [['Teams', '6 to 8'], ['Purse', '50,000 points per team'], ['Squad', '10 to 12 players'], ['Categories', 'A · B · C with points base prices']],
    faq: [
      ['Can I make sure every kabaddi team gets enough raiders?', 'Yes. Put raiders in their own category and set the minimum and maximum players per team for it; teams that are full are blocked from bidding.'],
      ['Can we use points instead of rupees?', 'Yes. Points work well for kabaddi leagues; choose points when you create the auction.'],
      ['What if two teams want the same player at the limit?', 'Set an upper limit and turn on the lucky draw: teams that still want the player join a fortune-wheel draw.'],
    ],
  },
  {
    slug: 'football',
    name: 'Football',
    title: 'Football Player Auction App for Local Leagues | KhiladiAuction',
    description: 'Football player auction software for local 5-a-side, 7-a-side and 11-a-side leagues. Goalkeepers, defenders, midfielders, forwards; live bidding screen. Free.',
    h1: 'Football player auction app',
    lead: 'From 5-a-side turf leagues to 11-a-side club tournaments: auction goalkeepers, defenders, midfielders and forwards with a live screen everyone can follow.',
    roles: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    extra: 'Make a goalkeeper category with “minimum 1 per team” so no team ends the auction without a keeper.',
    setup: [['Teams', '6 to 10'], ['Purse', '₹1 Cr or 10,000 points'], ['Squad', '8 to 16 players'], ['Categories', 'Icon · Goalkeepers · Players']],
    faq: [
      ['How do I make sure every team gets a goalkeeper?', 'Create a goalkeeper category and set its minimum per team to 1. The app reserves purse for it so teams can’t spend everything first.'],
      ['Can I run several rounds for unsold players?', 'Yes. Turn on re-auction and unsold players come back in the next round.'],
      ['Can the players register themselves?', 'Yes. Send the registration link on WhatsApp; players fill it on their phones and you review each form before it enters the auction. You can also import players from Excel.'],
    ],
  },
  {
    slug: 'volleyball',
    name: 'Volleyball',
    title: 'Volleyball Player Auction App for Local Tournaments | KhiladiAuction',
    description: 'Volleyball player auction software: setters, attackers, blockers and liberos, team purse and live bidding screen for your local volleyball league. Free to start.',
    h1: 'Volleyball player auction app',
    lead: 'Auction setters, attackers, blockers and liberos for your local volleyball league, with a live projector screen and every rule you need.',
    roles: ['Setter', 'Attacker', 'Blocker', 'Libero', 'All-rounder'],
    extra: 'Small squads make every purchase count: the live team list shows each team’s purse and filled slots, so the audience always knows who can still bid.',
    setup: [['Teams', '6 to 8'], ['Purse', '20,000 points per team'], ['Squad', '8 to 10 players'], ['Categories', 'A · B · C']],
    faq: [
      ['Can I set different base prices for setters and attackers?', 'Yes. Each category has its own base price and raise step; a player can also have their own base price.'],
      ['Can I pause the auction for a break?', 'Yes. Pause stops the timer and blocks bids until you resume.'],
      ['Does it show the auction to people who are not at the venue?', 'Yes. Share the live screen link; anyone can watch the bidding on a phone.'],
    ],
  },
];

function sportPage(s) {
  const others = SPORTS.filter((o) => o !== s);
  const body = `${pageHead(s.name + ' auction software', s.h1, s.lead)}
      <section class="sec">
        <div class="wrap split">
          <div class="prose">
            <h2>Player roles built in</h2>
            <p>When you choose ${s.name.toLowerCase()}, players get these roles:</p>
            <ul class="chips">${s.roles.map((r) => `<li>${r}</li>`).join('')}</ul>
            <p>${s.extra}</p>
            <h2>Example ${s.name.toLowerCase()} auction setup</h2>
            <table class="table">
              <tbody>${s.setup.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody>
            </table>
            <p class="note">Every number is your choice in Settings: purse, squad size, categories, raise steps and limits.</p>
          </div>
          ${screenMock()}
        </div>
      </section>
      <section class="sec sec-tint">
        <div class="wrap">
          <h2 class="sec-title">How a ${s.name.toLowerCase()} auction runs</h2>
          ${steps(STEPS_EN)}
        </div>
      </section>
      <section class="sec">
        <div class="wrap narrow">
          <h2 class="sec-title">${s.name} auction questions</h2>
          ${faqHtml(s.faq)}
          <p class="more">Also see auctions for ${others.map((o) => `<a href="/${o.slug}-player-auction/">${o.name.toLowerCase()}</a>`).join(', ')}.</p>
        </div>
      </section>
${ctaBand(`Ready for your ${s.name.toLowerCase()} auction?`, 'Set it up in an evening. Free during launch.')}`;
  return {
    path: `/${s.slug}-player-auction/`,
    lang: 'en',
    title: s.title,
    description: s.description,
    body,
    priority: '0.9',
    schema: [faqSchema(s.faq), crumbs([['Home', '/'], [s.name + ' player auction', `/${s.slug}-player-auction/`]])],
  };
}

const sportCards = (lang = 'en') => {
  const names = { en: ['Cricket', 'Kabaddi', 'Football', 'Volleyball'], hi: ['क्रिकेट', 'कबड्डी', 'फुटबॉल', 'वॉलीबॉल'], mr: ['क्रिकेट', 'कबड्डी', 'फुटबॉल', 'व्हॉलीबॉल'] }[lang];
  const sub = { en: 'player auction', hi: 'प्लेयर ऑक्शन', mr: 'प्लेयर ऑक्शन' }[lang];
  return `<div class="sports">${SPORTS.map((s, i) => `<a class="sport" href="/${s.slug}-player-auction/"><b>${names[i]}</b><span>${sub}</span><small>${s.roles.slice(0, 3).join(' · ')}</small></a>`).join('')}</div>`;
};

// ---------- home pages ----------

function home(lang) {
  const T = {
    en: {
      title: 'KhiladiAuction – Live Player Auction App for Cricket, Kabaddi & Football',
      description: 'Run your local league’s player auction like a TV broadcast: teams, purse, categories, live bidding, SOLD screen and lucky draw. Free to start, works on one laptop.',
      eyebrow: 'Player auction software for local tournaments',
      h1: 'Run your league’s player auction like a TV broadcast',
      lead: 'Add teams and players, set the purse and rules, then run the bidding from one laptop while the live screen shows every bid and every SOLD on the projector.',
      cta: 'Start a free auction',
      cta2: 'See how it works',
      strip: 'Cricket · Kabaddi · Football · Volleyball · Hockey · Basketball · Badminton',
      featTitle: 'Everything auction day needs',
      featLead: 'Built with organisers of local leagues: real rules, quick bidding and a screen the crowd enjoys.',
      stepsTitle: 'From player list to SOLD in four steps',
      sportsTitle: 'Pick your sport',
      faqTitle: 'Questions organisers ask',
      band: ['Your next auction, on the big screen', 'Free during launch. No download, no card. Works on any laptop with Chrome or Edge.'],
    },
    hi: {
      title: 'KhiladiAuction – क्रिकेट, कबड्डी, फुटबॉल के लिए लाइव प्लेयर ऑक्शन ऐप',
      description: 'अपनी लोकल लीग का प्लेयर ऑक्शन TV ब्रॉडकास्ट जैसा चलाइए: टीम, पर्स, कैटेगरी, लाइव बोली, SOLD स्क्रीन और लकी ड्रॉ। फ्री, सिर्फ एक लैपटॉप पर।',
      eyebrow: 'लोकल टूर्नामेंट के लिए प्लेयर ऑक्शन सॉफ्टवेयर',
      h1: 'अपनी लीग का प्लेयर ऑक्शन चलाइए, बिल्कुल TV ब्रॉडकास्ट जैसा',
      lead: 'टीम और खिलाड़ी जोड़िए, पर्स और नियम तय कीजिए, फिर एक लैपटॉप से बोली चलाइए। प्रोजेक्टर पर लाइव स्क्रीन हर बोली और हर SOLD दिखाती है।',
      cta: 'फ्री ऑक्शन शुरू करें',
      cta2: 'कैसे काम करता है',
      strip: 'क्रिकेट · कबड्डी · फुटबॉल · वॉलीबॉल · हॉकी · बास्केटबॉल · बैडमिंटन',
      featTitle: 'ऑक्शन के दिन जो चाहिए, सब कुछ',
      featLead: 'लोकल लीग के आयोजकों के लिए बना: असली नियम, तेज़ बोली और ऐसी स्क्रीन जो सबको पसंद आए।',
      stepsTitle: 'खिलाड़ियों की लिस्ट से SOLD तक, चार स्टेप में',
      sportsTitle: 'अपना खेल चुनें',
      faqTitle: 'आयोजकों के सवाल',
      band: ['अगला ऑक्शन, बड़ी स्क्रीन पर', 'लॉन्च के दौरान फ्री। कोई डाउनलोड नहीं, कोई कार्ड नहीं। Chrome या Edge वाले किसी भी लैपटॉप पर चलता है।'],
    },
    mr: {
      title: 'KhiladiAuction – क्रिकेट, कबड्डी, फुटबॉलसाठी लाइव्ह प्लेयर ऑक्शन ॲप',
      description: 'तुमच्या लोकल लीगचा प्लेयर ऑक्शन TV ब्रॉडकास्टसारखा चालवा: टीम, पर्स, कॅटेगरी, लाइव्ह बोली, SOLD स्क्रीन आणि लकी ड्रॉ. फ्री, फक्त एका लॅपटॉपवर.',
      eyebrow: 'लोकल टूर्नामेंटसाठी प्लेयर ऑक्शन सॉफ्टवेअर',
      h1: 'तुमच्या लीगचा प्लेयर ऑक्शन चालवा, अगदी TV ब्रॉडकास्टसारखा',
      lead: 'टीम आणि खेळाडू जोडा, पर्स आणि नियम ठरवा, मग एका लॅपटॉपवरून बोली चालवा. प्रोजेक्टरवरची लाइव्ह स्क्रीन प्रत्येक बोली आणि प्रत्येक SOLD दाखवते.',
      cta: 'फ्री ऑक्शन सुरू करा',
      cta2: 'कसे चालते ते पाहा',
      strip: 'क्रिकेट · कबड्डी · फुटबॉल · व्हॉलीबॉल · हॉकी · बास्केटबॉल · बॅडमिंटन',
      featTitle: 'ऑक्शनच्या दिवशी लागणारे सगळे',
      featLead: 'लोकल लीगच्या आयोजकांसाठी बनवलेले: खरे नियम, जलद बोली आणि सगळ्यांना आवडेल अशी स्क्रीन.',
      stepsTitle: 'खेळाडूंच्या यादीपासून SOLD पर्यंत, चार टप्प्यांत',
      sportsTitle: 'तुमचा खेळ निवडा',
      faqTitle: 'आयोजकांचे प्रश्न',
      band: ['पुढचा ऑक्शन, मोठ्या स्क्रीनवर', 'लॉन्चदरम्यान फ्री. डाउनलोड नाही, कार्ड नाही. Chrome किंवा Edge असलेल्या कोणत्याही लॅपटॉपवर चालते.'],
    },
  }[lang];

  const FEAT = {
    en: FEATURES_EN,
    hi: [
      ['लाइव प्रोजेक्टर स्क्रीन', 'घूमती हुई बोली की रकम, आगे चल रही टीम, टाइमर और पूरी स्क्रीन पर SOLD का शानदार पल।'],
      ['पर्स और स्क्वॉड के नियम', 'हर टीम का पर्स और कम-से-कम/ज़्यादा-से-ज़्यादा खिलाड़ी तय करें। ऐप हर टीम की अधिकतम बोली खुद निकालता है, ताकि कोई टीम ज़्यादा खर्च न कर पाए।'],
      ['कैटेगरी और बेस प्राइस', 'Marquee, A, B या अपनी कैटेगरी: हर एक की बेस प्राइस, बढ़ोतरी, प्रति टीम लिमिट और ऊपरी सीमा।'],
      ['ऊपरी सीमा पर लकी ड्रॉ', 'बोली लिमिट तक पहुँचे तो खिलाड़ी चाहने वाली सभी टीमें फॉर्च्यून व्हील ड्रॉ में आती हैं।'],
      ['तेज़ बोली', 'टीम पर टैप करें या उसकी कीबोर्ड-की दबाएँ। हर बोली, SOLD और UNSOLD को Undo कर सकते हैं।'],
      ['Excel से इम्पोर्ट-एक्सपोर्ट', 'Excel टेम्पलेट में खिलाड़ी भरें (या Google Form के जवाब पेस्ट करें) और इम्पोर्ट करें। आख़िर में पूरे नतीजे Excel में।'],
      ['लाइव लिंक शेयर करें', 'लाइव स्क्रीन का लिंक WhatsApp पर भेजें, सब अपने फ़ोन पर हर बोली देख सकते हैं। फ़ोन नंबर प्राइवेट रहते हैं।'],
      ['बिना इंटरनेट भी चलता है', 'ऑक्शन लैपटॉप के ब्राउज़र में चलता है, कमज़ोर नेटवर्क से रुकता नहीं।'],
    ],
    mr: [
      ['लाइव्ह प्रोजेक्टर स्क्रीन', 'फिरणारी बोलीची रक्कम, आघाडीची टीम, टायमर आणि पूर्ण स्क्रीनवर SOLD चा भारी क्षण.'],
      ['पर्स आणि स्क्वॉडचे नियम', 'प्रत्येक टीमचे पर्स आणि किमान/कमाल खेळाडू ठरवा. ॲप प्रत्येक टीमची कमाल बोली स्वतः काढते, त्यामुळे कोणतीही टीम जास्त खर्च करू शकत नाही.'],
      ['कॅटेगरी आणि बेस प्राइस', 'Marquee, A, B किंवा तुमच्या कॅटेगरी: प्रत्येकीची बेस प्राइस, वाढ, प्रति टीम मर्यादा आणि वरची मर्यादा.'],
      ['वरच्या मर्यादेवर लकी ड्रॉ', 'बोली मर्यादेपर्यंत पोहोचली की खेळाडू हवा असलेल्या सर्व टीम फॉर्च्यून व्हील ड्रॉमध्ये येतात.'],
      ['जलद बोली', 'टीमवर टॅप करा किंवा कीबोर्डची की दाबा. प्रत्येक बोली, SOLD आणि UNSOLD Undo करता येते.'],
      ['Excel मधून इम्पोर्ट-एक्सपोर्ट', 'Excel टेम्पलेटमध्ये खेळाडू भरा (किंवा Google Form ची उत्तरे पेस्ट करा) आणि इम्पोर्ट करा. शेवटी संपूर्ण निकाल Excel मध्ये.'],
      ['लाइव्ह लिंक शेअर करा', 'लाइव्ह स्क्रीनची लिंक WhatsApp वर पाठवा, सगळे आपल्या फोनवर प्रत्येक बोली पाहू शकतात. फोन नंबर प्रायव्हेट राहतात.'],
      ['इंटरनेटशिवायही चालते', 'ऑक्शन लॅपटॉपच्या ब्राउझरमध्ये चालतो, कमकुवत नेटवर्कमुळे थांबत नाही.'],
    ],
  }[lang];

  const STEPS = {
    en: STEPS_EN,
    hi: [
      ['ऑक्शन बनाइए', 'खेल, नाम और तारीख चुनें। ₹ करोड़, ₹ लाख या पॉइंट्स में पर्स रखें।'],
      ['टीम और खिलाड़ी जोड़िए', 'टाइप करें या Excel से इम्पोर्ट करें। फोटो, लोगो, कैटेगरी और बेस प्राइस सेट करें।'],
      ['लाइव स्क्रीन खोलिए', 'लाइव स्क्रीन प्रोजेक्टर या TV पर, और ऑक्शन कंसोल अपने लैपटॉप पर।'],
      ['बोली चलाइए', 'बोली लगाने वाली टीम पर टैप करें, SOLD दबाएँ, अगला खिलाड़ी। ख़त्म होते ही नतीजे और Excel तैयार।'],
    ],
    mr: [
      ['ऑक्शन तयार करा', 'खेळ, नाव आणि तारीख निवडा. ₹ कोटी, ₹ लाख किंवा पॉइंट्समध्ये पर्स ठेवा.'],
      ['टीम आणि खेळाडू जोडा', 'टाइप करा किंवा Excel मधून इम्पोर्ट करा. फोटो, लोगो, कॅटेगरी आणि बेस प्राइस सेट करा.'],
      ['लाइव्ह स्क्रीन उघडा', 'लाइव्ह स्क्रीन प्रोजेक्टर किंवा TV वर, आणि ऑक्शन कन्सोल तुमच्या लॅपटॉपवर.'],
      ['बोली चालवा', 'बोली लावणाऱ्या टीमवर टॅप करा, SOLD दाबा, पुढचा खेळाडू. संपताच निकाल आणि Excel तयार.'],
    ],
  }[lang];

  const FAQ = {
    en: FAQ_EN.slice(0, 5),
    hi: [
      ['क्या KhiladiAuction फ्री है?', 'हाँ, लॉन्च के दौरान पूरी तरह फ्री है: सभी फ़ीचर, कितने भी ऑक्शन, टीम और खिलाड़ी।'],
      ['क्या मैदान पर इंटरनेट चाहिए?', 'नहीं। ऑक्शन लैपटॉप के ब्राउज़र में चलता है। इंटरनेट सिर्फ़ फ़ोन पर लाइव लिंक दिखाने के लिए चाहिए।'],
      ['क्या टीम मालिक अपने फ़ोन से बोली लगा सकते हैं?', 'अभी नहीं। आयोजक लैपटॉप पर बोली दर्ज करता है, जैसे ज़्यादातर लोकल ऑक्शन में होता है। मालिक और फ़ैन्स लिंक से फ़ोन पर लाइव स्क्रीन देख सकते हैं।'],
      ['क्या ऐप हिंदी में है?', 'वेबसाइट हिंदी और मराठी में है। ऑक्शन ऐप अभी अंग्रेज़ी में है।'],
    ],
    mr: [
      ['KhiladiAuction फ्री आहे का?', 'हो, लॉन्चदरम्यान पूर्ण फ्री: सगळे फीचर्स, कितीही ऑक्शन, टीम आणि खेळाडू.'],
      ['मैदानावर इंटरनेट लागते का?', 'नाही. ऑक्शन लॅपटॉपच्या ब्राउझरमध्ये चालतो. इंटरनेट फक्त फोनवर लाइव्ह लिंक दाखवण्यासाठी लागते.'],
      ['टीम मालक आपल्या फोनवरून बोली लावू शकतात का?', 'अजून नाही. आयोजक लॅपटॉपवर बोली नोंदवतो, जसे बहुतेक लोकल ऑक्शनमध्ये होते. मालक आणि फॅन्स लिंकवरून फोनवर लाइव्ह स्क्रीन पाहू शकतात.'],
      ['ॲप मराठीत आहे का?', 'वेबसाइट मराठी आणि हिंदीत आहे. ऑक्शन ॲप सध्या इंग्रजीत आहे.'],
    ],
  }[lang];

  const body = `
      <section class="hero">
        <div class="hero-beams" aria-hidden="true"></div>
        <div class="wrap hero-in">
          <div class="hero-text">
            <p class="eyebrow">${T.eyebrow}</p>
            <h1>${T.h1}</h1>
            <p class="lead">${T.lead}</p>
            <div class="hero-cta">
              <a class="btn btn-gold" href="/app/">${T.cta}</a>
              <a class="btn btn-ghost" href="#how">${T.cta2}</a>
            </div>
            <p class="strip">${T.strip}</p>
          </div>
          ${screenMock(lang)}
        </div>
      </section>
      <section class="sec" id="features">
        <div class="wrap">
          <h2 class="sec-title">${T.featTitle}</h2>
          <p class="sec-lead">${T.featLead}</p>
          ${features(FEAT)}
        </div>
      </section>
      <section class="sec sec-tint" id="how">
        <div class="wrap">
          <h2 class="sec-title">${T.stepsTitle}</h2>
          ${steps(STEPS)}
        </div>
      </section>
      <section class="sec" id="sports">
        <div class="wrap">
          <h2 class="sec-title">${T.sportsTitle}</h2>
          ${sportCards(lang)}
        </div>
      </section>
${lang === 'en' ? `      <section class="sec sec-tint">
        <div class="wrap">
          <h2 class="sec-title">Made for Indian local leagues</h2>
          <p class="sec-lead">Money in ₹ Crore or ₹ Lakh, or plain points. A website in Hindi and Marathi. Works on one laptop with a weak network. Built around how box cricket, kabaddi and football leagues really run their auctions.</p>
          <div class="sports">
            <a class="sport" href="/corporate-cricket-auction/"><b>Corporate leagues</b><span>office cricket auction</span></a>
            <a class="sport" href="/school-college-sports-auction/"><b>Schools and colleges</b><span>sports festival auction</span></a>
            <a class="sport" href="/society-and-village-league-auction/"><b>Society and village leagues</b><span>gully and local tournaments</span></a>
            <a class="sport" href="/excel-vs-player-auction-software/"><b>Excel vs software</b><span>why organisers switch</span></a>
          </div>
        </div>
      </section>
` : ''}      <section class="sec sec-tint">
        <div class="wrap narrow">
          <h2 class="sec-title">${T.faqTitle}</h2>
          ${faqHtml(FAQ)}
          ${lang === 'en' ? '<p class="more"><a href="/faq/">All questions and answers</a></p>' : ''}
        </div>
      </section>
${ctaBand(T.band[0], T.band[1], T.cta)}`;

  return {
    path: lang === 'en' ? '/' : `/${lang}/`,
    lang,
    title: T.title,
    description: T.description,
    body,
    priority: lang === 'en' ? '1.0' : '0.8',
    alternates: { en: '/', hi: '/hi/', mr: '/mr/' },
    schema: lang === 'en' ? [orgSchema, websiteSchema, softwareSchema, faqSchema(FAQ)] : [softwareSchema, faqSchema(FAQ)],
  };
}

// ---------- other pages ----------

const featuresPage = {
  path: '/features/',
  lang: 'en',
  title: 'Features – Player Auction Software with Live Screen | KhiladiAuction',
  description: 'All KhiladiAuction features: live projector screen, purse and squad rules, categories, lucky draw, RTM, retained players, timer, Excel import and export, live link.',
  priority: '0.8',
  schema: [softwareSchema, crumbs([['Home', '/'], ['Features', '/features/']])],
  body: `${pageHead('Features', 'Every rule a local auction needs', 'Organisers set everything in Settings; nothing is fixed. Here is what KhiladiAuction does today.')}
      <section class="sec">
        <div class="wrap">
          ${features(FEATURES_EN)}
        </div>
      </section>
      <section class="sec sec-tint">
        <div class="wrap">
          <h2 class="sec-title">More options</h2>
          ${features([
            ['Right to Match (RTM)', 'A player’s previous team can match the final price, with a limit on RTM cards per team.'],
            ['Retained players', 'Keep captains or icon players before the auction; their price comes out of the purse.'],
            ['Timer modes', 'No timer, an automatic countdown, or one you start yourself. The live screen calls “going once, going twice”.'],
            ['Rounds and re-auction', 'Unsold players come back in the next round if you want them to.'],
            ['Player order', 'Go category by category, in random order, or pick each player yourself.'],
            ['Many auctions, one place', 'Keep every tournament’s auction, copy last year’s setup, and download a backup any time.'],
          ])}
        </div>
      </section>
${ctaBand('See it on your own league', 'Create an auction with demo teams and players in one click.')}`,
};

const howPage = {
  path: '/how-it-works/',
  lang: 'en',
  title: 'How to Conduct a Player Auction for Your Tournament | KhiladiAuction',
  description: 'Step-by-step guide to running a player auction for a local cricket, kabaddi or football tournament: setup, rules, equipment and auction-day checklist.',
  priority: '0.8',
  schema: [crumbs([['Home', '/'], ['How it works', '/how-it-works/']])],
  body: `${pageHead('Guide', 'How to conduct a player auction for your tournament', 'A simple plan that works for 6 to 16 teams, from the first player list to the final squads.')}
      <section class="sec">
        <div class="wrap narrow prose">
          <h2>Before the auction</h2>
          ${steps([
            ['Decide the rules', 'Purse per team, squad size, categories with base prices, raise steps and any upper limit. Share them with team owners in advance.'],
            ['Collect players', 'Use a Google Form for names, roles and photos, then import with our Excel template.'],
            ['Set up the auction', 'Enter teams with owners and colours, check every player’s category and base price, and give each team a keyboard key.'],
            ['Do a practice run', 'Sell a few players to a test copy of the auction so everyone knows the flow. Then start the real one.'],
          ])}
          <h2>Auction-day checklist</h2>
          <ul class="ticks">
            <li>Laptop with Chrome or Edge, charger plugged in</li>
            <li>Projector or TV with an HDMI cable; open the live screen and press F11</li>
            <li>Speakers if you want the gavel and bid sounds</li>
            <li>Paddles or cards with team names for owners to raise</li>
            <li>One person on the laptop, one auctioneer calling the bids</li>
            <li>The live link shared on WhatsApp for people who can’t come</li>
          </ul>
          <h2>After the auction</h2>
          <p>Open Results to see every squad and the money left, export it to Excel and share it with the teams. Download a backup of the auction for your records.</p>
        </div>
      </section>
${ctaBand('Plan your auction tonight', 'Free during launch.')}`,
};

const pricingPage = {
  path: '/pricing/',
  lang: 'en',
  title: 'Pricing – Free Player Auction Software | KhiladiAuction',
  description: 'KhiladiAuction is free during launch: unlimited auctions, teams and players, live projector screen, lucky draw, Excel import and export.',
  priority: '0.7',
  schema: [softwareSchema, crumbs([['Home', '/'], ['Pricing', '/pricing/']])],
  body: `${pageHead('Pricing', 'Free while we launch', 'Every feature, for every league. Use it for your next auction and tell us what you need.')}
      <section class="sec">
        <div class="wrap narrow">
          <div class="price-card">
            <div class="price-top"><span class="price">₹0</span><span class="price-sub">during launch</span></div>
            <ul class="ticks">
              <li>Unlimited auctions, teams and players</li>
              <li>Live projector screen with SOLD animation and lucky-draw wheel</li>
              <li>Purse, squad and category rules, RTM and retained players</li>
              <li>Excel import and export, results and backups</li>
              <li>Live link for phones</li>
            </ul>
            <a class="btn btn-gold" href="/app/">Start a free auction</a>
          </div>
          <p class="note center">Want help on auction day or a custom setup? <a href="/contact/">Contact us</a>.</p>
        </div>
      </section>`,
};

const faqPage = {
  path: '/faq/',
  lang: 'en',
  title: 'Player Auction FAQ – Rules, Setup and Live Screen | KhiladiAuction',
  description: 'Answers to common questions about running a player auction with KhiladiAuction: price, internet, sports, lucky draw, Excel import and data safety.',
  priority: '0.7',
  schema: [faqSchema(FAQ_EN), crumbs([['Home', '/'], ['FAQ', '/faq/']])],
  body: `${pageHead('FAQ', 'Questions and answers', 'Can’t find your answer? <a href="/contact/">Ask us</a>.')}
      <section class="sec">
        <div class="wrap narrow">${faqHtml(FAQ_EN)}</div>
      </section>`,
};

const contactPage = () => ({
  path: '/contact/',
  lang: 'en',
  title: 'Contact KhiladiAuction',
  description: 'Contact the KhiladiAuction team for help with your player auction setup or auction day.',
  priority: '0.5',
  schema: [orgSchema, crumbs([['Home', '/'], ['Contact', '/contact/']])],
  body: `${pageHead('Contact', 'Talk to us', 'Questions about your auction, a feature you need, or help on auction day: we reply on WhatsApp and email.')}
      <section class="sec">
        <div class="wrap narrow">
          <div class="contact-card">
            ${contactLines() || '<p>Our contact details will be added here shortly.</p>'}
          </div>
        </div>
      </section>`,
});

const legal = (path, h1, title, paras) => ({
  path,
  lang: 'en',
  title: `${title} | KhiladiAuction`,
  description: `${title} for the KhiladiAuction website and auction app.`,
  priority: '0.3',
  schema: [],
  body: `${pageHead('Legal', h1, 'Last updated ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + '.')}
      <section class="sec"><div class="wrap narrow prose">${paras.map(([h, p]) => `<h2>${h}</h2><p>${p}</p>`).join('')}</div></section>`,
});

const privacyPage = legal('/privacy/', 'Privacy policy', 'Privacy policy', [
  ['What we store', 'The auctions you create: settings, team names and owners, player names, roles, optional photos and phone numbers, and the bidding results. They are saved in your browser, and auctions you put online are also saved on our server.'],
  ['Signing in with Google', 'To save auctions online you sign in with your Google account. Google then shares your name, email address and profile photo with us, and we keep them so your auctions can be linked to you on any device. We don’t receive your Google password and we don’t access your Gmail, contacts or files. A sign-in cookie keeps you signed in for up to 60 days; signing out removes it.'],
  ['Who can see it', 'Only the Google account an auction belongs to can change it. Anyone you give the auction’s live link to can watch it; phone numbers of players and owners are never shown through that link.'],
  ['What we don’t do', 'We don’t sell your data, show ads, or use tracking cookies. The only cookie is the sign-in cookie above. The app uses your browser’s local storage to keep your auctions on your device.'],
  ['Deleting your data', 'Deleting an auction in the app also deletes its online copy. To have your account and all its auctions removed, contact us.'],
]);

const termsPage = legal('/terms/', 'Terms of use', 'Terms of use', [
  ['Using KhiladiAuction', 'You may use KhiladiAuction to run player auctions for your tournaments. You are responsible for the names, photos and details you add and for having permission to use them.'],
  ['Free service', 'The service is free during launch and provided as it is. Keep a backup of your auctions; we aren’t liable for losses caused by outages or lost devices.'],
  ['Fair use', 'Don’t use the service to store unrelated content, to overload it, or to break into other people’s auctions.'],
  ['Changes', 'We may update these terms and the service. Important changes will be shown on this page.'],
]);

const notFound = {
  path: '/404.html',
  file: '404.html',
  lang: 'en',
  title: 'Page not found | KhiladiAuction',
  description: 'This page does not exist.',
  noindex: true,
  inSitemap: false,
  schema: [],
  body: `${pageHead('404', 'This page is not here', 'It may have moved. Try the <a href="/">home page</a> or <a href="/app/">open the auction app</a>.')}`,
};

export function allPages() {
  return [
    home('en'),
    home('hi'),
    home('mr'),
    ...SPORTS.map(sportPage),
    featuresPage,
    howPage,
    pricingPage,
    faqPage,
    contactPage(),
    ...extraPages({ pageHead, ctaBand, faqSchema, crumbs, features, faqHtml, screenMock }),
    privacyPage,
    termsPage,
    notFound,
  ];
}
