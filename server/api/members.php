<?php
// The people an auction is shared with.
//
// GET  members.php?id=ID
//      200 {role, canManage, owner: {name, email, picture}, members: [{email, role, name, picture, joined}], max}
//      (the owner and any member may look)
// POST members.php?id=ID                  body {email, role}   add someone, or change their role
// POST members.php?id=ID&action=remove    body {email}         take someone out
// POST members.php?id=ID&action=leave                          a member leaves the auction
//
// Roles: admin (everything except deleting the auction and managing admins),
// auctioneer (runs the console), data (adds players and teams), scorer (fills
// in match scores only). Only the owner can add, change or remove an admin;
// admins can manage the other roles.
// People are matched by the verified Google email they sign in with.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = auction_id();
$method = require_method('GET', 'POST');
$auction = find_auction($id) ?? fail(404, 'not_found');
$user = require_user();
$role = require_role($auction, $user, 'owner', 'admin', 'auctioneer', 'data');
$pdo = db();
$action = (string)($_GET['action'] ?? '');

if ($method === 'GET') {
    $o = $pdo->prepare('SELECT name, email, picture FROM users WHERE id = ?');
    $o->execute([$auction['user_id'] ?? 0]);
    $owner = $o->fetch() ?: ['name' => '', 'email' => '', 'picture' => ''];
    $q = $pdo->prepare('SELECT email, role FROM auction_members WHERE auction_id = ? ORDER BY created_at, email');
    $q->execute([$id]);
    $members = [];
    foreach ($q->fetchAll() as $m) {
        $u = $pdo->prepare('SELECT name, picture FROM users WHERE lower(email) = ? ORDER BY last_login_at DESC LIMIT 1');
        $u->execute([$m['email']]);
        $known = $u->fetch();
        $members[] = ['email' => $m['email'], 'role' => $m['role'], 'name' => $known['name'] ?? '', 'picture' => $known['picture'] ?? '', 'joined' => (bool)$known];
    }
    ok(['role' => $role, 'canManage' => in_array($role, ['owner', 'admin'], true), 'owner' => $owner, 'members' => $members, 'max' => MAX_MEMBERS]);
}

if ($action === 'leave') {
    if ($role === 'owner') fail(400, 'owner_cannot_leave');
    $pdo->prepare('DELETE FROM auction_members WHERE auction_id = ? AND email = ?')->execute([$id, norm_email((string)$user['email'])]);
    ok(['left' => true]);
}

require_role($auction, $user, 'owner', 'admin');
$body = json_body(2_000);
$email = norm_email(is_string($body['email'] ?? null) ? $body['email'] : '');
if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'bad_email');

$current = $pdo->prepare('SELECT role FROM auction_members WHERE auction_id = ? AND email = ?');
$current->execute([$id, $email]);
$was = $current->fetchColumn();
$was = is_string($was) ? $was : null;

if ($action === 'remove') {
    if ($was === null) ok(['removed' => false]);
    if ($was === 'admin' && $role !== 'owner') fail(403, 'owner_only');
    $pdo->prepare('DELETE FROM auction_members WHERE auction_id = ? AND email = ?')->execute([$id, $email]);
    ok(['removed' => true]);
}
if ($action !== '') fail(400, 'bad_action');

$newRole = $body['role'] ?? '';
if (!is_string($newRole) || !in_array($newRole, MEMBER_ROLES, true)) fail(400, 'bad_role');
if (($newRole === 'admin' || $was === 'admin') && $role !== 'owner') fail(403, 'owner_only');

// The owner is already in; adding their own email would only confuse the list.
$o = $pdo->prepare('SELECT email FROM users WHERE id = ?');
$o->execute([$auction['user_id'] ?? 0]);
if (norm_email((string)$o->fetchColumn()) === $email) fail(400, 'is_owner');

if ($was === null) {
    $n = $pdo->prepare('SELECT COUNT(*) FROM auction_members WHERE auction_id = ?');
    $n->execute([$id]);
    if ((int)$n->fetchColumn() >= MAX_MEMBERS) fail(400, 'too_many_members');
    $pdo->prepare('INSERT INTO auction_members (auction_id, email, role, invited_by, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$id, $email, $newRole, $user['id'], now_ms()]);
} else {
    $pdo->prepare('UPDATE auction_members SET role = ? WHERE auction_id = ? AND email = ?')->execute([$newRole, $id, $email]);
}
ok(['email' => $email, 'role' => $newRole]);
