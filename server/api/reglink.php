<?php
// The pages behind the readable registration links.
//
//   /register/<slug>            reglink.php?s=<slug>
//       WhatsApp, Instagram and Google read the tags in this page to draw the
//       link preview, so it carries the auction's name, date and place. A
//       browser is sent on to the registration form of the app straight away.
//       A name the link had earlier forwards to the current name.
//
//   /app/a/<id>/register        reglink.php?id=<id>      (only when the address has no ?via=)
//       The old long link. Once the auction has a readable name it forwards
//       there; until then the app opens as usual.
//
// Apache rewrites both (see the .htaccess made by scripts/build-hostinger.mjs).

declare(strict_types=1);
require __DIR__ . '/_lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-cache');
$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

// ---------- the old long link ----------
if (isset($_GET['id'])) {
    $id = $_GET['id'];
    if (!is_string($id) || !preg_match('/^[a-z]_[a-z0-9]{5,44}$/', $id)) fail(400, 'bad_id');
    $q = db()->prepare('SELECT slug FROM auctions WHERE id = ?');
    $q->execute([$id]);
    $slug = $q->fetchColumn();
    if (is_string($slug) && $slug !== '') {
        header('Location: /register/' . $slug, true, 302);
        exit;
    }
    // No readable name yet: hand over the app (it works out the route itself).
    $app = __DIR__ . '/../app/index.html';
    if (is_file($app)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($app);
        exit;
    }
    http_response_code(404);
    exit;
}

// ---------- /register/<slug> ----------
$slug = $_GET['s'] ?? '';
$row = is_string($slug) && valid_slug($slug) ? find_by_slug($slug) : null;

header('Content-Type: text/html; charset=utf-8');

if (!$row) {
    http_response_code(404);
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registration link not found</title></head>'
        . '<body style="font-family:system-ui,sans-serif;text-align:center;padding:15vh 24px;color:#0b1220">'
        . '<h1>This registration link is not active</h1><p>It may have been changed. Please ask the organiser for the new link.</p></body></html>';
    exit;
}

// An earlier name of the link: forward to the current one.
if ($row['slug'] !== $slug) {
    header('Location: /register/' . $row['slug'], true, 302);
    exit;
}

$d = json_decode((string)$row['data'], true);
$s = is_array($d['settings'] ?? null) ? $d['settings'] : [];
$name = (string)$row['name'] !== '' ? (string)$row['name'] : 'Player auction';
$venue = is_string($s['venue'] ?? null) ? trim($s['venue']) : '';
$when = '';
if (is_string($s['date'] ?? null) && $s['date'] !== '' && ($t = strtotime($s['date'])) !== false) $when = date('D j M Y', $t);
$details = trim(implode(' · ', array_filter([$when, $venue])));
$desc = 'Fill in your details on your phone to register as a player.' . ($details !== '' ? ' ' . $details : '');

$origin = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'khiladiauction.com');
$page = $origin . '/register/' . $slug;
// ?via=link keeps the old-link forwarding above from sending the player round in a circle.
$form = '/app/a/' . $row['id'] . '/register?via=link';
$title = 'Player registration · ' . $name;

echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<title>' . $h($title) . '</title>'
    . '<meta name="description" content="' . $h($desc) . '">'
    . '<meta name="robots" content="noindex,nofollow">'
    . '<meta property="og:type" content="website"><meta property="og:site_name" content="KhiladiAuction">'
    . '<meta property="og:title" content="' . $h($title) . '"><meta property="og:description" content="' . $h($desc) . '">'
    . '<meta property="og:url" content="' . $h($page) . '">'
    . '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="' . $h($title) . '"><meta name="twitter:description" content="' . $h($desc) . '">'
    . '<meta http-equiv="refresh" content="0;url=' . $h($form) . '">'
    . '<script>location.replace(' . json_encode($form, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . ');</script>'
    . '</head><body style="font-family:system-ui,sans-serif;text-align:center;padding:15vh 24px;color:#0b1220">'
    . '<h1>' . $h($name) . '</h1><p>' . $h($details) . '</p>'
    . '<p><a href="' . $h($form) . '" style="display:inline-block;padding:14px 26px;border-radius:12px;background:#ff7a1a;color:#fff;font-weight:700;text-decoration:none">Open the registration form</a></p>'
    . '</body></html>';
