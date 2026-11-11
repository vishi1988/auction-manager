<?php
// Player photos and team logos of one auction, kept apart from the auction
// data so a bid doesn't re-send every picture.
//
// GET  photos.php?id=ID                      200 {photosVersion, photos: {key: dataUrl}}
// POST photos.php?id=ID  body {put: {key: dataUrl}, remove: [key]}   (signed in, its account)

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = auction_id();
$method = require_method('GET', 'POST');
$auction = find_auction($id) ?? fail(404, 'not_found');

if ($method === 'GET') {
    $q = db()->prepare('SELECT photo_key, data FROM auction_photos WHERE auction_id = ?');
    $q->execute([$id]);
    $photos = [];
    foreach ($q->fetchAll() as $row) $photos[$row['photo_key']] = $row['data'];
    ok(['photosVersion' => (int)$auction['photos_version'], 'photos' => (object)$photos]);
}

require_owner($auction, require_user());
$body = json_body(MAX_PHOTOS_PER_SAVE * MAX_PHOTO_BYTES);
$put = $body['put'] ?? [];
$remove = $body['remove'] ?? [];
if (!is_array($put) || !is_array($remove) || count($put) + count($remove) > MAX_PHOTOS_PER_SAVE * 4) fail(400, 'bad_photos');

$validKey = fn($k) => is_string($k) && preg_match('/^(player|team)-[A-Za-z0-9_-]{1,56}$/', $k);
foreach ($put as $key => $data) {
    if (!$validKey($key)) fail(400, 'bad_photo_key');
    if (!is_string($data) || strlen($data) > MAX_PHOTO_BYTES || !preg_match('#^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$#', $data)) fail(400, 'bad_photo');
}
foreach ($remove as $key) if (!$validKey($key)) fail(400, 'bad_photo_key');

$pdo = db();
$mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
$upsert = $pdo->prepare($mysql
    ? 'INSERT INTO auction_photos (auction_id, photo_key, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
    : 'INSERT INTO auction_photos (auction_id, photo_key, data) VALUES (?, ?, ?) ON CONFLICT(auction_id, photo_key) DO UPDATE SET data = excluded.data');
$delete = $pdo->prepare('DELETE FROM auction_photos WHERE auction_id = ? AND photo_key = ?');

$pdo->beginTransaction();
foreach ($put as $key => $data) $upsert->execute([$id, $key, $data]);
foreach ($remove as $key) $delete->execute([$id, $key]);
$pdo->prepare('UPDATE auctions SET photos_version = photos_version + 1 WHERE id = ?')->execute([$id]);
$pdo->commit();

ok(['photosVersion' => (int)$auction['photos_version'] + 1]);
