<?php
// Who is signed in.
//
// GET  session.php                 200 {clientId, user}   user is null when signed out
// POST session.php?action=logout   200 {user: null}       signs this browser out

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$method = require_method('GET', 'POST');

if ($method === 'POST') {
    if (($_GET['action'] ?? '') !== 'logout') fail(400, 'bad_action');
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if (is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)) {
        db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
    set_session_cookie('', 1);
    ok(['user' => null]);
}

$user = current_user();
ok([
    'clientId' => app_settings()['google_client_id'] ?? '',
    'user' => $user ? public_user($user) : null,
]);
