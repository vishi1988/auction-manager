<?php
// The readable name of an auction's registration link:
//   khiladiauction.com/register/<slug>   (opens reglink.php, which sends players to the form)
//
// GET  slug.php?s=SLUG                    200 {id, name, sport, date, venue}  or 404 (public)
// POST slug.php?id=ID   body {slug}       set or change it (owner or admin)
//      200 {slug}   400 bad_slug   409 slug_taken
//
// A slug is 3-50 lowercase letters, digits and single hyphens. The first auction
// to take a slug keeps it. When the name is changed, the earlier name is kept in
// slug_history: it still works and forwards to the current one, and no other
// auction can take it.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$method = require_method('GET', 'POST');

if ($method === 'GET') {
    $slug = $_GET['s'] ?? '';
    if (!is_string($slug) || !valid_slug($slug)) fail(404, 'not_found');
    $row = find_by_slug($slug) ?? fail(404, 'not_found');
    ok(auction_headline($row));
}

$id = auction_id();
$auction = find_auction($id) ?? fail(404, 'not_found');
require_role($auction, require_user(), 'owner', 'admin');
$slug = json_body(1_000)['slug'] ?? '';
if (!is_string($slug) || !valid_slug($slug)) fail(400, 'bad_slug');

$pdo = db();
$current = $pdo->prepare('SELECT slug FROM auctions WHERE id = ?');
$current->execute([$id]);
$was = $current->fetchColumn();
$was = is_string($was) && $was !== '' ? $was : null;
if ($was === $slug) ok(['slug' => $slug]);

// A name an earlier link of another auction used stays reserved for that auction.
$old = $pdo->prepare('SELECT auction_id FROM slug_history WHERE slug = ?');
$old->execute([$slug]);
$owner = $old->fetchColumn();
if (is_string($owner) && $owner !== $id) fail(409, 'slug_taken');

try {
    $pdo->prepare('UPDATE auctions SET slug = ? WHERE id = ?')->execute([$slug, $id]);
} catch (PDOException $e) {
    // The unique index refused it: another auction already has this name.
    $taken = $pdo->prepare('SELECT COUNT(*) FROM auctions WHERE slug = ? AND id <> ?');
    $taken->execute([$slug, $id]);
    if ((int)$taken->fetchColumn() > 0) fail(409, 'slug_taken');
    throw $e;
}
// Going back to an earlier name takes it out of the history; the name left behind goes in.
$pdo->prepare('DELETE FROM slug_history WHERE slug = ? AND auction_id = ?')->execute([$slug, $id]);
if ($was !== null) {
    $seen = $pdo->prepare('SELECT COUNT(*) FROM slug_history WHERE slug = ?');
    $seen->execute([$was]);
    if ((int)$seen->fetchColumn() === 0) {
        $pdo->prepare('INSERT INTO slug_history (slug, auction_id, created_at) VALUES (?, ?, ?)')->execute([$was, $id, now_ms()]);
    }
}
ok(['slug' => $slug]);
