<?php
// Test helper for scripts/test-api.mjs (never uploaded).
// Signs in a pretend Google user straight in the database and prints the
// session cookie value, so the API can be tested without a real Google login.
//
//   php scripts/make-test-session.php user <google-sub> <name>     -> prints a session token
//   php scripts/make-test-session.php legacy <auction-id> <token>  -> adds an auction saved before sign-in existed
declare(strict_types=1);

require __DIR__ . '/../server/api/_lib.php';

[$_, $mode, $a, $b] = $argv + [null, null, null, null];
$pdo = db();
$now = now_ms();

if ($mode === 'user') {
    $pdo->prepare('INSERT INTO users (google_sub, email, name, picture, created_at, last_login_at, is_admin) VALUES (?, ?, ?, \'\', ?, ?, ?)')
        ->execute([$a, $a . '@example.com', $b, $now, $now, ($argv[4] ?? '') === 'admin' ? 1 : 0]);
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        ->execute([hash('sha256', $token), (int)$pdo->lastInsertId(), $now, $now + 3_600_000]);
    echo $token;
} elseif ($mode === 'legacy') {
    $data = json_encode(['settings' => ['name' => 'Old League'], 'teams' => [], 'players' => [], 'auction' => [], 'log' => []]);
    $pdo->prepare('INSERT INTO auctions (id, owner_hash, user_id, name, data, updated_at, version, photos_version, created_at) VALUES (?, ?, NULL, ?, ?, ?, 1, 0, ?)')
        ->execute([$a, hash('sha256', $b), 'Old League', $data, $now, $now]);
    echo 'ok';
} else {
    fwrite(STDERR, "usage: user <sub> <name> | legacy <id> <token>\n");
    exit(1);
}
