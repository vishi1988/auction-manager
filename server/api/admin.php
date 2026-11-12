<?php
// Super admin: see accounts, give the Pro plan, mark payment, suspend.
//
// GET  admin.php                 200 {users:[{id,email,name,picture,plan,paymentDone,suspended,isAdmin,proRequested,auctions,createdAt,lastLoginAt}]}
// POST admin.php  body {userId, plan?, paymentDone?, suspended?}   200 {user}
//
// Plain accounts are never allowed here: require_admin() answers 403.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$method = require_method('GET', 'POST');
$me = require_admin();
$pdo = db();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT u.id, u.email, u.name, u.picture, u.is_admin, u.plan, u.payment_done, u.suspended, u.pro_requested_at, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM auctions a WHERE a.user_id = u.id) AS auctions
        FROM users u ORDER BY u.pro_requested_at DESC, u.created_at DESC LIMIT 500')->fetchAll();
    $users = array_map(fn($r) => public_user($r) + [
        'auctions' => (int)$r['auctions'],
        'createdAt' => (int)$r['created_at'],
        'lastLoginAt' => (int)$r['last_login_at'],
    ], $rows);
    ok(['users' => $users]);
}

$body = json_body(2_000);
$uid = $body['userId'] ?? null;
if (!is_int($uid)) fail(400, 'bad_user');
$q = $pdo->prepare('SELECT id, email, name, picture, is_admin, plan, payment_done, suspended, pro_requested_at FROM users WHERE id = ?');
$q->execute([$uid]);
$u = $q->fetch() ?: fail(404, 'no_such_user');

if (array_key_exists('plan', $body)) {
    if (!in_array($body['plan'], ['free', 'pro'], true)) fail(400, 'bad_plan');
    $u['plan'] = $body['plan'];
    // Once Pro is given the request is answered.
    if ($body['plan'] === 'pro') $u['pro_requested_at'] = 0;
}
if (array_key_exists('paymentDone', $body)) {
    if (!is_bool($body['paymentDone'])) fail(400, 'bad_payment');
    $u['payment_done'] = $body['paymentDone'] ? 1 : 0;
}
if (array_key_exists('suspended', $body)) {
    if (!is_bool($body['suspended'])) fail(400, 'bad_suspended');
    if ($body['suspended'] && (int)$u['id'] === (int)$me['id']) fail(400, 'cannot_suspend_self');
    $u['suspended'] = $body['suspended'] ? 1 : 0;
}
$pdo->prepare('UPDATE users SET plan = ?, payment_done = ?, suspended = ?, pro_requested_at = ? WHERE id = ?')
    ->execute([$u['plan'], $u['payment_done'], $u['suspended'], $u['pro_requested_at'], $u['id']]);
ok(['user' => public_user($u)]);
