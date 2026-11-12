<?php
// One auction: read it, save it, delete it.
//
// GET  auction.php?id=ID[&since=VERSION]
//      200 {version, updatedAt, photosVersion, mine, data}
//      204 when `since` already equals the current version (nothing new)
//      404 when there is no such auction
// POST auction.php?id=ID                 body {name, updatedAt, data}   (signed in)
//      creates the auction on first save, updates it afterwards; an older
//      auction sent with its owner token moves into the signed-in account
// POST auction.php?id=ID&action=delete   (its account, or its owner token)

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = auction_id();
$method = require_method('GET', 'POST');

if ($method === 'GET') {
    $q = db()->prepare('SELECT owner_hash, user_id, data, version, photos_version, updated_at FROM auctions WHERE id = ?');
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
    $mine = can_edit($row, current_user());
    // `data` was checked to be a JSON object when it was saved, so the owner gets it as is.
    // Everyone else (live screen links shared on WhatsApp) gets it without phone numbers.
    $data = $mine ? $row['data'] : public_view($row['data']);
    send(200, '{"version":' . (int)$row['version']
        . ',"updatedAt":' . (int)$row['updated_at']
        . ',"photosVersion":' . (int)$row['photos_version']
        . ',"mine":' . ($mine ? 'true' : 'false')
        . ',"data":' . $data . '}');
}

// POST
$existing = find_auction($id);

if (($_GET['action'] ?? '') === 'delete') {
    if (!$existing) ok(['deleted' => false]);
    require_owner($existing);
    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM auction_photos WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM registrations WHERE auction_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM bids WHERE auction_id = ?')->execute([$id]);
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

// Free plan: at most FREE_MAX_TEAMS teams. An older auction that already has
// more keeps saving, so nobody loses work when the rule is introduced.
if (!is_pro($user) && is_array($data['teams']) && count($data['teams']) > FREE_MAX_TEAMS) {
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
        db()->prepare('INSERT INTO auctions (id, owner_hash, user_id, name, data, updated_at, version, photos_version, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)')
            ->execute([$id, $hash, $user['id'], $name, $json, $updatedAt, now_ms()]);
        ok(['version' => 1, 'created' => true]);
    } catch (PDOException $e) {
        // Another save created it a moment ago: fall through to an ordinary update.
        $existing = find_auction($id) ?? fail(500, 'save_failed');
    }
}

require_owner($existing, $user);
// COALESCE: an auction saved before sign-in existed now belongs to this account.
db()->prepare('UPDATE auctions SET name = ?, data = ?, updated_at = ?, version = version + 1, user_id = COALESCE(user_id, ?) WHERE id = ?')
    ->execute([$name, $json, $updatedAt, $user['id'], $id]);
ok(['version' => (int)$existing['version'] + 1, 'created' => false]);
