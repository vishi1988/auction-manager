<?php
// One auction: read it, save it, delete it.
//
// GET  auction.php?id=ID[&since=VERSION]
//      200 {version, updatedAt, photosVersion, mine, role, shared, by, slug, data}
//      (`role`: owner, admin, auctioneer, data, scorer, or null; `by`: device that saved last)
//      204 when `since` already equals the current version (nothing new)
//      404 when there is no such auction
// POST auction.php?id=ID                 body {name, updatedAt, data, base?, client?}   (signed in)
//      creates the auction on first save, updates it afterwards; an older
//      auction sent with its owner token moves into the signed-in account.
//      `base` is the version this device last saw and `client` its id: when
//      another device saved in between, the save is refused with 409 conflict
//      instead of silently overwriting that device's work.
// POST auction.php?id=ID&action=delete   (its owner only)

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = auction_id();
$method = require_method('GET', 'POST');

if ($method === 'GET') {
    $q = db()->prepare('SELECT id, owner_hash, user_id, data, version, photos_version, updated_at, last_client, slug FROM auctions WHERE id = ?');
    $since = isset($_GET['since']) && ctype_digit((string)$_GET['since']) ? (int)$_GET['since'] : null;
    if ($since !== null) {
        // Cheap check first, so a projector asking every second doesn't re-download the auction.
        $v = db()->prepare('SELECT version FROM auctions WHERE id = ?');
        $v->execute([$id]);
        $version = $v->fetchColumn();
        if ($version === false) fail(404, 'not_found');
        if ((int)$version === $since) send(204);
    }
    $q->execute([$id]);
    $row = $q->fetch();
    if (!$row) fail(404, 'not_found');
    $role = role_of($row, current_user());
    $mine = $role !== null;
    $members = db()->prepare('SELECT COUNT(*) FROM auction_members WHERE auction_id = ?');
    $members->execute([$id]);
    // `data` was checked to be a JSON object when it was saved, so the owner and invited members get it as is.
    // Everyone else (live screen links shared on WhatsApp) gets it without phone numbers.
    $data = $mine ? $row['data'] : public_view($row['data']);
    send(200, '{"version":' . (int)$row['version']
        . ',"updatedAt":' . (int)$row['updated_at']
        . ',"photosVersion":' . (int)$row['photos_version']
        . ',"mine":' . ($mine ? 'true' : 'false')
        . ',"role":' . json_encode($role)
        . ',"shared":' . ((int)$members->fetchColumn() > 0 ? 'true' : 'false')
        . ',"by":' . json_encode($mine ? (string)$row['last_client'] : '')
        . ',"slug":' . json_encode((string)($row['slug'] ?? ''))
        . ',"data":' . $data . '}');
}

// POST
$existing = find_auction($id);

if (($_GET['action'] ?? '') === 'delete') {
    if (!$existing) ok(['deleted' => false]);
    require_role($existing, null, 'owner');
    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM auction_photos WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM registrations WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM bids WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM auction_members WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM slug_history WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM auctions WHERE id = ?')->execute([$id]);
    $pdo->commit();
    ok(['deleted' => true]);
}

$user = require_user();
if (!empty($user['suspended'])) fail(403, 'suspended');
$hash = owner_hash() ?? hash('sha256', bin2hex(random_bytes(32)));
$body = json_body(MAX_AUCTION_BYTES + 10_000);
$data = $body['data'] ?? null;
if (!is_array($data) || array_is_list($data) || !isset($data['settings'], $data['teams'], $data['players'])) fail(400, 'bad_data');
$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false || strlen($json) > MAX_AUCTION_BYTES) fail(413, 'too_large');
$name = mb_substr(is_string($body['name'] ?? null) ? $body['name'] : '', 0, 200);
$updatedAt = is_int($body['updatedAt'] ?? null) ? $body['updatedAt'] : now_ms();
$client = is_string($body['client'] ?? null) && preg_match('/^[a-f0-9]{16}$/', $body['client']) ? $body['client'] : '';
$base = is_int($body['base'] ?? null) ? $body['base'] : null;

// Free plan: at most FREE_MAX_TEAMS teams. An older auction that already has
// more keeps saving, so nobody loses work when the rule is introduced. The plan
// that counts is the owner's, so invited friends on free accounts can save it.
$planUser = $user;
if ($existing && $existing['user_id'] !== null && (int)$existing['user_id'] !== (int)$user['id']) {
    $o = db()->prepare('SELECT id, is_admin, plan FROM users WHERE id = ?');
    $o->execute([$existing['user_id']]);
    $planUser = $o->fetch() ?: $user;
}
if (!is_pro($planUser) && is_array($data['teams']) && count($data['teams']) > FREE_MAX_TEAMS) {
    $before = 0;
    if ($existing) {
        $old = db()->prepare('SELECT data FROM auctions WHERE id = ?');
        $old->execute([$id]);
        $oldData = json_decode((string)$old->fetchColumn(), true);
        $before = is_array($oldData['teams'] ?? null) ? count($oldData['teams']) : 0;
    }
    if (count($data['teams']) > max($before, FREE_MAX_TEAMS)) fail(402, 'pro_required');
}

if (!$existing) {
    try {
        db()->prepare('INSERT INTO auctions (id, owner_hash, user_id, name, data, updated_at, version, photos_version, created_at, last_client) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)')
            ->execute([$id, $hash, $user['id'], $name, $json, $updatedAt, now_ms(), $client]);
        ok(['version' => 1, 'created' => true]);
    } catch (PDOException $e) {
        // Another save created it a moment ago: fall through to an ordinary update.
        $existing = find_auction($id) ?? fail(500, 'save_failed');
    }
}

require_owner($existing, $user);
// A scorer may only fill in matches and scores: everything else is kept as it
// was on the server, whatever their device sent.
if (role_of($existing, $user) === 'scorer') {
    $old = db()->prepare('SELECT name, data FROM auctions WHERE id = ?');
    $old->execute([$id]);
    $oldRow = $old->fetch();
    $kept = json_decode((string)($oldRow['data'] ?? ''), true);
    if (!is_array($kept)) fail(500, 'save_failed');
    if (array_key_exists('tournament', $data)) $kept['tournament'] = $data['tournament'];
    $json = json_encode($kept, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > MAX_AUCTION_BYTES) fail(413, 'too_large');
    $name = (string)$oldRow['name'];
}
// COALESCE: an auction saved before sign-in existed now belongs to this account.
// With `base` and `client`, the save only goes through when nobody else saved
// since this device last looked (checked inside the UPDATE, so two saves at
// the same moment cannot both win).
$sql = 'UPDATE auctions SET name = ?, data = ?, updated_at = ?, version = version + 1, user_id = COALESCE(user_id, ?), last_client = ? WHERE id = ?';
$args = [$name, $json, $updatedAt, $user['id'], $client, $id];
if ($base !== null && $client !== '') {
    $sql .= ' AND (version = ? OR last_client = ?)';
    array_push($args, $base, $client);
}
$up = db()->prepare($sql);
$up->execute($args);
$v = db()->prepare('SELECT version FROM auctions WHERE id = ?');
$v->execute([$id]);
$version = (int)$v->fetchColumn();
if ($up->rowCount() === 0) send(409, json_encode(['error' => 'conflict', 'version' => $version]));
ok(['version' => $version, 'created' => false]);
