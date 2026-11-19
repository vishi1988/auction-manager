<?php
// Bidding from a team owner's own phone.
//
// Each team has a secret key (team.ownerKey inside the auction). The organiser
// sends every owner a private link that carries it. Viewers of the auction
// never see the keys (public_view removes them).
//
// POST bid.php?id=ID   body {teamId, key, kind: 'bid'|'join', seen}     (the team's key)
//      200 {id}        403 bad_key   403 closed   429 too_many
// GET  bid.php?id=ID&team=T&key=K               200 {valid: true}       is this link good?
// GET  bid.php?id=ID&team=T&key=K&bid=BID       200 {status:'pending'|'done', ok, tie, reason}
// GET  bid.php?id=ID                            (its account) 200 {items:[{id, teamId, kind, seen, at}]}
//      Hands out the waiting bids once: a bid is claimed by the first caller.
// POST bid.php?id=ID&action=done  body {results:[{id, ok, tie?, reason?}]}  (its account)
//
// A bid is not written into the auction here: the organiser's browser holds the
// working copy. It applies the bids with the same rules as its own console and
// reports back what happened.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

const CLAIM_TIMEOUT_MS = 8000;      // a claimed bid nobody confirmed goes back to the queue
const BID_KEEP_MS = 120_000;        // finished bids are forgotten after this
const MAX_PENDING_PER_TEAM = 3;
const MAX_PENDING_BIDS = 300;

$id = auction_id();
$method = require_method('GET', 'POST');
$auction = find_auction($id) ?? fail(404, 'not_found');
$pdo = db();
$now = now_ms();
$action = $_GET['action'] ?? '';

/** The auction's data, to read the team keys and settings. */
function auction_data(PDO $pdo, string $id): array
{
    $q = $pdo->prepare('SELECT data FROM auctions WHERE id = ?');
    $q->execute([$id]);
    $d = json_decode((string)$q->fetchColumn(), true);
    return is_array($d) ? $d : [];
}

/** True when `$key` is this team's secret key. */
function team_key_ok(array $data, string $teamId, string $key): bool
{
    if (!preg_match('/^[a-f0-9]{16,64}$/', $key)) return false;
    foreach (is_array($data['teams'] ?? null) ? $data['teams'] : [] as $t) {
        if (is_array($t) && ($t['id'] ?? null) === $teamId) {
            return is_string($t['ownerKey'] ?? null) && hash_equals($t['ownerKey'], $key);
        }
    }
    return false;
}

function id_param(string $v): string
{
    return preg_match('/^[A-Za-z0-9_-]{1,48}$/', $v) ? $v : '';
}

if ($method === 'GET' && isset($_GET['team'])) {
    $team = id_param((string)$_GET['team']);
    if ($team === '' || !team_key_ok(auction_data($pdo, $id), $team, (string)($_GET['key'] ?? ''))) fail(403, 'bad_key');
    $bid = id_param((string)($_GET['bid'] ?? ''));
    if ($bid === '') ok(['valid' => true]);
    $q = $pdo->prepare('SELECT status, ok, tie, reason FROM bids WHERE auction_id = ? AND id = ? AND team_id = ?');
    $q->execute([$id, $bid, $team]);
    $row = $q->fetch();
    if (!$row) ok(['status' => 'gone']);
    if ((int)$row['status'] !== 1) ok(['status' => 'pending']);
    ok(['status' => 'done', 'ok' => (bool)$row['ok'], 'tie' => (bool)$row['tie'], 'reason' => $row['reason']]);
}

if ($method === 'GET') {
    require_role($auction, require_user(), 'owner', 'admin', 'auctioneer');
    // Claims nobody confirmed (the app was closed in between) go back in the queue.
    $pdo->prepare('UPDATE bids SET status = 0, claim = \'\' WHERE auction_id = ? AND status = 2 AND claimed_at < ?')->execute([$id, $now - CLAIM_TIMEOUT_MS]);
    $claim = bin2hex(random_bytes(8));
    $pdo->prepare('UPDATE bids SET status = 2, claim = ?, claimed_at = ? WHERE auction_id = ? AND status = 0')->execute([$claim, $now, $id]);
    $q = $pdo->prepare('SELECT id, team_id, kind, seen, created_at FROM bids WHERE auction_id = ? AND claim = ? AND status = 2 ORDER BY created_at, id');
    $q->execute([$id, $claim]);
    $items = array_map(fn($r) => [
        'id' => $r['id'], 'teamId' => $r['team_id'], 'kind' => $r['kind'],
        'seen' => $r['seen'] === '' ? null : (float)$r['seen'], 'at' => (int)$r['created_at'],
    ], $q->fetchAll());
    ok(['items' => $items]);
}

if ($action === 'done') {
    require_role($auction, require_user(), 'owner', 'admin', 'auctioneer');
    $results = json_body(40_000)['results'] ?? null;
    if (!is_array($results) || count($results) > 100) fail(400, 'bad_results');
    $up = $pdo->prepare('UPDATE bids SET status = 1, ok = ?, tie = ?, reason = ? WHERE auction_id = ? AND id = ?');
    foreach ($results as $r) {
        if (!is_array($r) || !is_string($r['id'] ?? null)) continue;
        $up->execute([!empty($r['ok']) ? 1 : 0, !empty($r['tie']) ? 1 : 0, mb_substr(is_string($r['reason'] ?? null) ? $r['reason'] : '', 0, 200), $id, $r['id']]);
    }
    $pdo->prepare('DELETE FROM bids WHERE auction_id = ? AND status = 1 AND created_at < ?')->execute([$id, $now - BID_KEEP_MS]);
    ok(['ok' => true]);
}

// ---------- a team owner taps BID ----------

$in = json_body(2_000);
$team = id_param((string)($in['teamId'] ?? ''));
$data = auction_data($pdo, $id);
if ($team === '' || !team_key_ok($data, $team, (string)($in['key'] ?? ''))) fail(403, 'bad_key');
if (($data['settings']['ownerBidding'] ?? true) === false) fail(403, 'closed');
$kind = ($in['kind'] ?? '') === 'join' ? 'join' : 'bid';
$seen = $in['seen'] ?? null;
if ($seen !== null && !(is_int($seen) || is_float($seen))) fail(400, 'bad_seen');

$q = $pdo->prepare('SELECT COUNT(*) FROM bids WHERE auction_id = ? AND team_id = ? AND status IN (0, 2)');
$q->execute([$id, $team]);
if ((int)$q->fetchColumn() >= MAX_PENDING_PER_TEAM) fail(429, 'too_many');
$q = $pdo->prepare('SELECT COUNT(*) FROM bids WHERE auction_id = ? AND status IN (0, 2)');
$q->execute([$id]);
if ((int)$q->fetchColumn() >= MAX_PENDING_BIDS) fail(429, 'too_many');

$bidId = 'b_' . bin2hex(random_bytes(6));
$pdo->prepare('INSERT INTO bids (auction_id, id, team_id, kind, seen, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([$id, $bidId, $team, $kind, $seen === null ? '' : (string)$seen, $now]);
ok(['id' => $bidId]);
