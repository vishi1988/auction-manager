// Checks the PHP API end to end against a running server.
// Usage: node scripts/test-api.mjs http://127.0.0.1:8099/api
// Needs PHP on the PATH (or PHP_BIN=path\to\php.exe): it signs in two pretend
// Google users straight in the database with scripts/make-test-session.php.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const base = (process.argv[2] ?? 'http://127.0.0.1:8099/api').replace(/\/$/, '');
const php = process.env.PHP_BIN ?? 'php';
const helper = (...args) => execFileSync(php, ['scripts/make-test-session.php', ...args], { encoding: 'utf8' }).trim();

const rnd = () => randomBytes(8).toString('hex');
const token = randomBytes(32).toString('hex');
const id = 'a_' + rnd().slice(0, 14);
const legacyId = 'a_' + rnd().slice(0, 14);
const legacyToken = randomBytes(32).toString('hex');

/** Session cookies of two signed-in users. */
const A = helper('user', '1' + Date.now(), 'Asha');
const B = helper('user', '2' + Date.now(), 'Bhavesh');

const call = (path, { method = 'GET', body, tok, user } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { 'X-Owner-Token': tok } : {}),
      ...(user ? { Cookie: 'ka_session=' + user } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
const json = async (r) => (r.status === 204 ? null : r.json());
const data = (name) => ({ settings: { name, sport: 'kabaddi' }, teams: [{ id: 't0', name: 'A' }], players: [{ id: 'p1', name: 'Ravi' }], auction: { status: 'live' }, log: [] });
const save = (name, at, opts) => call(`/auction.php?id=${id}`, { method: 'POST', body: { name, updatedAt: at, data: data(name) }, ...opts });

let r;
let passed = 0;
const check = async (label, fn) => {
  await fn();
  passed++;
  console.log('ok  ' + label);
};

await check('health check reports the database', async () => {
  const r = await call('/ping.php');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).database, 'connected');
});
await check('unknown auction is 404', async () => {
  assert.equal((await call(`/auction.php?id=${id}`)).status, 404);
});
await check('bad id is refused', async () => {
  assert.equal((await call(`/auction.php?id=../etc`)).status, 400);
});
await check('session: signed out, and a signed-in user is recognised', async () => {
  const out = await json(await call('/session.php'));
  assert.equal(out.user, null);
  assert.equal(typeof out.clientId, 'string');
  const a = await json(await call('/session.php', { user: A }));
  assert.equal(a.user.name, 'Asha');
  assert.equal((await json(await call('/session.php', { user: 'f'.repeat(64) }))).user, null);
});
await check('saving online needs sign-in, even with an owner token', async () => {
  r = await save('x', 1, { tok: token });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'login_required');
});
await check('first signed-in save creates it', async () => {
  r = await save('Test League', 1000, { user: A, tok: token });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { version: 1, created: true });
});
await check('anyone can read it; only its account sees mine=true', async () => {
  const pub = await json(await call(`/auction.php?id=${id}`));
  assert.equal(pub.mine, false);
  assert.equal(pub.version, 1);
  assert.equal(pub.data.settings.name, 'Test League');
  assert.equal((await json(await call(`/auction.php?id=${id}`, { user: A }))).mine, true);
  assert.equal((await json(await call(`/auction.php?id=${id}`, { user: B }))).mine, false);
});
await check('polling with the current version returns 204', async () => {
  assert.equal((await call(`/auction.php?id=${id}&since=1`)).status, 204);
});
await check('another account cannot change it, even with the token', async () => {
  assert.equal((await save('Hacked', 2000, { user: B })).status, 403);
  assert.equal((await save('Hacked', 2000, { user: B, tok: token })).status, 403);
});
await check('its account updates it from another device (no token)', async () => {
  r = await save('Renamed', 3000, { user: A });
  assert.deepEqual(await r.json(), { version: 2, created: false });
  assert.equal((await json(await call(`/auction.php?id=${id}&since=1`))).data.settings.name, 'Renamed');
});
await check('Hindi and Marathi text survive the round trip', async () => {
  await call(`/auction.php?id=${id}`, { method: 'POST', user: A, body: { name: 'खिलाड़ी लीग', updatedAt: 3500, data: data('खिलाड़ी लीग · मराठी') } });
  assert.equal((await json(await call(`/auction.php?id=${id}`))).data.settings.name, 'खिलाड़ी लीग · मराठी');
});
await check('viewers never see phone numbers; the owner does', async () => {
  const d = data('Phones');
  d.players[0].mobile = '9876543210';
  d.teams = [{ id: 't1', name: 'Kings', ownerMobile: '9123456780' }];
  await call(`/auction.php?id=${id}`, { method: 'POST', user: A, body: { name: 'Phones', updatedAt: 3600, data: d } });
  const pub = await json(await call(`/auction.php?id=${id}`));
  assert.equal(pub.data.players[0].mobile, undefined);
  assert.equal(pub.data.teams[0].ownerMobile, undefined);
  const own = await json(await call(`/auction.php?id=${id}`, { user: A }));
  assert.equal(own.data.players[0].mobile, '9876543210');
  assert.equal(own.data.teams[0].ownerMobile, '9123456780');
});
await check('data that is not an auction is refused', async () => {
  r = await call(`/auction.php?id=${id}`, { method: 'POST', user: A, body: { name: 'x', data: [1, 2, 3] } });
  assert.equal(r.status, 400);
});
await check('photos: owner adds, anyone reads, version goes up', async () => {
  const img = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
  r = await call(`/photos.php?id=${id}`, { method: 'POST', user: A, body: { put: { 'player-p1': img, 'team-t1': img }, remove: [] } });
  assert.equal(r.status, 200);
  const got = await json(await call(`/photos.php?id=${id}`));
  assert.equal(got.photos['player-p1'], img);
  assert.equal((await json(await call(`/auction.php?id=${id}`))).photosVersion, 1);
});
await check('photos: others and signed-out browsers cannot change them; bad data refused', async () => {
  assert.equal((await call(`/photos.php?id=${id}`, { method: 'POST', user: B, body: { put: {}, remove: ['player-p1'] } })).status, 403);
  assert.equal((await call(`/photos.php?id=${id}`, { method: 'POST', tok: token, body: { put: {}, remove: ['player-p1'] } })).status, 401);
  r = await call(`/photos.php?id=${id}`, { method: 'POST', user: A, body: { put: { 'player-p2': 'javascript:alert(1)' }, remove: [] } });
  assert.equal(r.status, 400);
});
await check('photos: remove works', async () => {
  await call(`/photos.php?id=${id}`, { method: 'POST', user: A, body: { put: {}, remove: ['team-t1'] } });
  assert.deepEqual(Object.keys((await json(await call(`/photos.php?id=${id}`))).photos), ['player-p1']);
});
await check('my-auctions lists only your own, with summary details', async () => {
  const a = await json(await call('/my-auctions.php', { user: A }));
  const mine = a.auctions.find((x) => x.id === id);
  assert.ok(mine);
  assert.equal(mine.sport, 'kabaddi');
  assert.equal(mine.teams, 1);
  assert.equal(mine.players, 1);
  assert.equal(mine.status, 'live');
  assert.ok(!(await json(await call('/my-auctions.php', { user: B }))).auctions.some((x) => x.id === id));
  assert.equal((await call('/my-auctions.php')).status, 401);
});
await check('an auction saved before sign-in moves into the account that saves it with its token', async () => {
  helper('legacy', legacyId, legacyToken);
  const body = { name: 'Old League', updatedAt: 9000, data: data('Old League') };
  assert.equal((await call(`/auction.php?id=${legacyId}`, { method: 'POST', tok: legacyToken, body })).status, 401);
  assert.equal((await call(`/auction.php?id=${legacyId}`, { method: 'POST', user: A, body })).status, 403);
  assert.equal((await call(`/auction.php?id=${legacyId}`, { method: 'POST', user: B, tok: legacyToken, body })).status, 200);
  assert.ok((await json(await call('/my-auctions.php', { user: B }))).auctions.some((x) => x.id === legacyId));
  // From now on the account decides; the old token alone no longer can.
  assert.equal((await call(`/auction.php?id=${legacyId}&action=delete`, { method: 'POST', tok: legacyToken })).status, 403);
  assert.equal((await json(await call(`/auction.php?id=${legacyId}`, { user: B }))).mine, true);
});
await check('registration: a player sends the form; only the account collects it', async () => {
  const reg = (player) => call(`/register.php?id=${id}`, { method: 'POST', body: { player } });
  const form = {
    name: '  Sagar   Patil ', age: 24, mobile: '98765 00001', role: 'Fielder', batting: 'Right hand', bowling: '—',
    jerseyName: 'SAGAR', jerseyNo: '7', tshirt: '3XL (44 inch)',
    extraTshirts: [{ who: 'player', size: 'L' }, { who: 'other', name: 'Asha Patil', size: 'Kids 28', jerseyName: 'ASHA' }, { who: 'other', name: 'No size' }],
  };
  assert.equal((await reg(form)).status, 200);
  assert.equal((await call(`/register.php?id=${id}`)).status, 401);
  assert.equal((await call(`/register.php?id=${id}`, { user: B })).status, 403);
  const { items } = await json(await call(`/register.php?id=${id}`, { user: A }));
  assert.equal(items.length, 1);
  assert.match(items[0].id, /^p_[a-f0-9]{12}$/);
  assert.equal(items[0].name, 'Sagar Patil');
  assert.equal(items[0].mobile, '9876500001');
  assert.equal(items[0].tshirt, '3XL (44 inch)');
  assert.deepEqual(items[0].extraTshirts.map((x) => [x.who, x.name, x.size]), [['player', '', 'L'], ['other', 'Asha Patil', 'Kids 28']]);
  // The auction itself is untouched, so nothing the organiser saves can clash with it.
  assert.equal((await json(await call(`/auction.php?id=${id}`, { user: A }))).data.players.length, 1);
});
await check('registration: same mobile twice, incomplete forms and bad photos are refused', async () => {
  const reg = (player) => call(`/register.php?id=${id}`, { method: 'POST', body: { player } });
  r = await reg({ name: 'Again', mobile: '9876500001', role: 'Bowler' });
  assert.equal(r.status, 409);
  assert.equal((await reg({ name: 'Existing player', mobile: '9876543210', role: 'Bowler' })).status, 409);
  assert.equal((await reg({ name: '', mobile: '9876500002', role: 'Bowler' })).status, 400);
  assert.equal((await reg({ name: 'Short', mobile: '12345', role: 'Bowler' })).status, 400);
  assert.equal((await reg({ name: 'Pic', mobile: '9876500003', role: 'Bowler', photo: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call(`/register.php?id=a_doesnotexist1`, { method: 'POST', body: { player: { name: 'X', mobile: '9876500004', role: 'Y' } } })).status, 404);
});
await check('registration: collected forms are cleared by the account only; closed forms are refused', async () => {
  const { items } = await json(await call(`/register.php?id=${id}`, { user: A }));
  const done = (opts) => call(`/register.php?id=${id}&action=done`, { method: 'POST', body: { ids: items.map((x) => x.id) }, ...opts });
  assert.equal((await done({ user: B })).status, 403);
  assert.equal((await done({ user: A })).status, 200);
  assert.equal((await json(await call(`/register.php?id=${id}`, { user: A }))).items.length, 0);
  const d = data('Closed');
  d.settings.selfRegistration = false;
  await call(`/auction.php?id=${id}`, { method: 'POST', user: A, body: { name: 'Closed', updatedAt: 3700, data: d } });
  r = await call(`/register.php?id=${id}`, { method: 'POST', body: { player: { name: 'Late', mobile: '9876500009', role: 'Bowler' } } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'closed');
});
await check('only its account can delete; then it is gone', async () => {
  assert.equal((await call(`/auction.php?id=${id}&action=delete`, { method: 'POST', user: B })).status, 403);
  r = await call(`/auction.php?id=${id}&action=delete`, { method: 'POST', user: A });
  assert.deepEqual(await r.json(), { deleted: true });
  assert.equal((await call(`/auction.php?id=${id}`)).status, 404);
  assert.equal((await call(`/photos.php?id=${id}`)).status, 404);
  await call(`/auction.php?id=${legacyId}&action=delete`, { method: 'POST', user: B });
});
await check('login refuses a missing or fake Google credential', async () => {
  assert.equal((await call('/login.php', { method: 'POST', body: { credential: 'nope' } })).status, 400);
  r = await call('/login.php', { method: 'POST', body: { credential: 'aaa.bbb.ccc' } });
  // Without a client id the server says so; with one, Google rejects the fake token.
  assert.ok([401, 500, 503].includes(r.status), 'status ' + r.status);
});
await check('sign out ends the session', async () => {
  r = await call('/session.php?action=logout', { method: 'POST', user: B });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie') ?? '', /ka_session=/);
  assert.equal((await json(await call('/session.php', { user: B }))).user, null);
  assert.equal((await save('After logout', 9999, { user: B })).status, 401);
});
await check('PUT and other methods are refused', async () => {
  assert.equal((await call(`/auction.php?id=${id}`, { method: 'PUT', user: A, body: {} })).status, 405);
});

console.log(`\n${passed} API checks passed`);
