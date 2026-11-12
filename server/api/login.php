<?php
// Sign in with Google.
//
// POST login.php   body {credential}   (the ID token from Google's sign-in button)
//      200 {user}  and a sign-in cookie that only this API can read
//
// The token is checked with Google: it must be for our client id, from
// Google, not expired, and for a verified email address.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

require_method('POST');
$body = json_body(8_000);
$credential = $body['credential'] ?? '';
if (!is_string($credential) || !preg_match('/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/', $credential)) fail(400, 'bad_credential');

$clientId = app_settings()['google_client_id'] ?? '';
if ($clientId === '') fail(500, 'google_not_configured');

$claims = google_token_claims($credential);
if (!$claims) fail(401, 'google_rejected');
if (($claims['aud'] ?? '') !== $clientId) fail(401, 'wrong_audience');
if (!in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) fail(401, 'wrong_issuer');
if ((int)($claims['exp'] ?? 0) < time()) fail(401, 'expired');
if (($claims['email_verified'] ?? '') !== 'true' && ($claims['email_verified'] ?? false) !== true) fail(401, 'email_not_verified');
$sub = (string)($claims['sub'] ?? '');
if (!preg_match('/^[0-9]{1,64}$/', $sub)) fail(401, 'bad_subject');

$email = mb_substr((string)($claims['email'] ?? ''), 0, 254);
$name = mb_substr((string)($claims['name'] ?? ''), 0, 200);
$picture = (string)($claims['picture'] ?? '');
if (!preg_match('#^https://[a-z0-9.-]+\.googleusercontent\.com/#', $picture)) $picture = '';
$picture = mb_substr($picture, 0, 500);

$pdo = db();
$now = now_ms();
$find = $pdo->prepare('SELECT id FROM users WHERE google_sub = ?');
$find->execute([$sub]);
$id = $find->fetchColumn();
if ($id === false) {
    $pdo->prepare('INSERT INTO users (google_sub, email, name, picture, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$sub, $email, $name, $picture, $now, $now]);
    $id = (int)$pdo->lastInsertId();
} else {
    $id = (int)$id;
    $pdo->prepare('UPDATE users SET email = ?, name = ?, picture = ?, last_login_at = ? WHERE id = ?')
        ->execute([$email, $name, $picture, $now, $id]);
}

// The super admin is whoever's verified email is listed in settings.php (admin_emails).
$admins = array_map('strtolower', array_filter((array)(app_settings()['admin_emails'] ?? []), 'is_string'));
if ($email !== '' && in_array(strtolower($email), $admins, true)) {
    $pdo->prepare('UPDATE users SET is_admin = 1 WHERE id = ?')->execute([$id]);
}

// Old sessions are cleared now and then, so the table stays small.
if (random_int(1, 50) === 1) $pdo->prepare('DELETE FROM sessions WHERE expires_at < ?')->execute([$now]);

$token = bin2hex(random_bytes(32));
$expires = $now + SESSION_DAYS * 86_400_000;
$pdo->prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    ->execute([hash('sha256', $token), $id, $now, $expires]);
set_session_cookie($token, intdiv($expires, 1000));

$row = $pdo->prepare('SELECT id, email, name, picture, is_admin, plan, payment_done, suspended, pro_requested_at FROM users WHERE id = ?');
$row->execute([$id]);
ok(['user' => public_user($row->fetch())]);

/** Asks Google to check the ID token and returns its claims, or null if Google says no. */
function google_token_claims(string $idToken): ?array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5]);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]));
        $status = 200;
        foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+ (\d{3})#', $h, $m)) $status = (int)$m[1];
    }
    if (!is_string($raw) || $status !== 200) {
        if ($status >= 500 || $status === 0) fail(503, 'google_unreachable');
        return null;
    }
    $claims = json_decode($raw, true);
    return is_array($claims) ? $claims : null;
}
