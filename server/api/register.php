<?php
// The player registration form.
//
// POST register.php?id=ID                 body {player: {...}}   (anyone with the link, while registration is open)
//      200 {ok: true}      409 already_registered      403 closed
// GET  register.php?id=ID                 (its account) 200 {items: [form, ...]}  forms waiting to be added
// POST register.php?id=ID&action=done     body {ids: [...]}      (its account) the app has added these players
//
// A form is not written into the auction here: the organiser's browser holds
// the working copy and would overwrite it. It waits in its own table until
// that browser collects it.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = auction_id();
$method = require_method('GET', 'POST');
$auction = find_auction($id) ?? fail(404, 'not_found');
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
    require_owner($auction, require_user());
    $q = db()->prepare('SELECT id, data FROM registrations WHERE auction_id = ? ORDER BY created_at LIMIT 50');
    $q->execute([$id]);
    $items = [];
    foreach ($q->fetchAll() as $row) {
        $form = json_decode($row['data'], true);
        if (is_array($form)) $items[] = ['id' => $row['id']] + $form;
    }
    ok(['items' => $items]);
}

if ($action === 'done') {
    require_owner($auction, require_user());
    $ids = json_body(20_000)['ids'] ?? null;
    if (!is_array($ids) || count($ids) > 200) fail(400, 'bad_ids');
    $del = db()->prepare('DELETE FROM registrations WHERE auction_id = ? AND id = ?');
    foreach ($ids as $rid) if (is_string($rid)) $del->execute([$id, $rid]);
    ok(['ok' => true]);
}

// ---------- a player sends the form ----------

/** Trimmed single-line text of at most $max characters. */
function text(mixed $v, int $max): string
{
    if (!is_string($v) && !is_int($v)) return '';
    return mb_substr(trim(preg_replace('/\s+/u', ' ', (string)$v) ?? ''), 0, $max);
}

$in = json_body(MAX_PHOTO_BYTES + 50_000)['player'] ?? null;
if (!is_array($in)) fail(400, 'bad_form');

$name = text($in['name'] ?? '', 80);
$mobile = preg_replace('/\D/', '', text($in['mobile'] ?? '', 20)) ?? '';
$role = text($in['role'] ?? '', 40);
if ($name === '' || $role === '' || strlen($mobile) !== 10) fail(400, 'bad_form');

$form = [
    'name' => $name,
    'mobile' => $mobile,
    'role' => $role,
    'batting' => text($in['batting'] ?? '', 40),
    'bowling' => text($in['bowling'] ?? '', 40),
    'jerseyName' => text($in['jerseyName'] ?? '', 24),
    'jerseyNo' => preg_replace('/\D/', '', text($in['jerseyNo'] ?? '', 4)) ?? '',
    'tshirt' => text($in['tshirt'] ?? '', 20),
];
$age = $in['age'] ?? null;
if (is_int($age) && $age >= 5 && $age <= 99) $form['age'] = $age;

$extras = [];
foreach (is_array($in['extraTshirts'] ?? null) ? $in['extraTshirts'] : [] as $x) {
    if (!is_array($x) || count($extras) >= 20) continue;
    $size = text($x['size'] ?? '', 20);
    if ($size === '') continue;
    $extras[] = [
        'who' => ($x['who'] ?? '') === 'other' ? 'other' : 'player',
        'name' => text($x['name'] ?? '', 80),
        'size' => $size,
        'jerseyName' => text($x['jerseyName'] ?? '', 24),
        'jerseyNo' => preg_replace('/\D/', '', text($x['jerseyNo'] ?? '', 4)) ?? '',
    ];
}
if ($extras) $form['extraTshirts'] = $extras;

$photo = $in['photo'] ?? null;
if (is_string($photo) && $photo !== '') {
    if (strlen($photo) > MAX_PHOTO_BYTES || !preg_match('#^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$#', $photo)) fail(400, 'bad_photo');
    $form['photo'] = $photo;
}

$pdo = db();
$q = $pdo->prepare('SELECT data FROM auctions WHERE id = ?');
$q->execute([$id]);
$data = json_decode((string)$q->fetchColumn(), true);
if (!is_array($data)) fail(404, 'not_found');
if (($data['settings']['selfRegistration'] ?? true) === false) fail(403, 'closed');

// One form per mobile number: neither among the players nor among the waiting forms.
foreach (is_array($data['players'] ?? null) ? $data['players'] : [] as $p) {
    if (is_array($p) && preg_replace('/\D/', '', (string)($p['mobile'] ?? '')) === $mobile) fail(409, 'already_registered');
}
$q = $pdo->prepare('SELECT COUNT(*) FROM registrations WHERE auction_id = ? AND mobile = ?');
$q->execute([$id, $mobile]);
if ((int)$q->fetchColumn() > 0) fail(409, 'already_registered');

$q = $pdo->prepare('SELECT COUNT(*) FROM registrations WHERE auction_id = ?');
$q->execute([$id]);
if ((int)$q->fetchColumn() >= MAX_PENDING_REGISTRATIONS) fail(429, 'too_many');

$json = json_encode($form, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) fail(400, 'bad_form');
$pdo->prepare('INSERT INTO registrations (auction_id, id, mobile, data, created_at) VALUES (?, ?, ?, ?, ?)')
    ->execute([$id, 'p_' . bin2hex(random_bytes(6)), $mobile, $json, now_ms()]);
ok(['ok' => true]);
