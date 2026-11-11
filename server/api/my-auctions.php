<?php
// The signed-in user's auctions, for "My Auctions" on a device that does not
// have them yet.
//
// GET my-auctions.php   200 {auctions: [{id, name, sport, date, venue, teams, players, status, createdAt, updatedAt}]}

declare(strict_types=1);
require __DIR__ . '/_lib.php';

require_method('GET');
$user = require_user();

$q = db()->prepare('SELECT id, name, data, created_at, updated_at FROM auctions WHERE user_id = ? ORDER BY created_at DESC LIMIT 500');
$q->execute([$user['id']]);

$list = [];
foreach ($q->fetchAll() as $row) {
    $d = json_decode($row['data'], true);
    $s = is_array($d['settings'] ?? null) ? $d['settings'] : [];
    $list[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'sport' => is_string($s['sport'] ?? null) ? $s['sport'] : 'cricket',
        'date' => is_string($s['date'] ?? null) ? $s['date'] : '',
        'venue' => is_string($s['venue'] ?? null) ? $s['venue'] : '',
        'teams' => is_array($d['teams'] ?? null) ? count($d['teams']) : 0,
        'players' => is_array($d['players'] ?? null) ? count($d['players']) : 0,
        'status' => is_string($d['auction']['status'] ?? null) ? $d['auction']['status'] : 'idle',
        'createdAt' => (int)$row['created_at'],
        'updatedAt' => (int)$row['updated_at'],
    ];
}
ok(['auctions' => $list]);
