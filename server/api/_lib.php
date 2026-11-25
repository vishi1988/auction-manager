<?php
// Shared helpers for the API: database connection, tables, JSON replies,
// and the owner check that decides who may change an auction.
//
// Who may change what:
// - Saving online needs a Google sign-in (login.php). An auction belongs to
//   the account that saved it; that account can change it from any device.
// - Auctions saved before sign-in existed carry an "owner token" instead: a
//   long random secret from the browser that created them (only its hash is
//   stored). The first signed-in save with that token moves the auction into
//   the account.
// - Anyone who has an auction's link may read it, which is how the live
//   screen works on a projector or a phone.
// - The owner can invite others by Google email (members.php). A member has a
//   role: admin (everything but deleting), auctioneer (runs the console),
//   data (adds players and teams) or scorer (fills in match scores). The
//   server lets all of them save the auction, but a scorer's save only changes
//   the tournament (auction.php); which screens each role gets is decided in the app.

declare(strict_types=1);

const MAX_AUCTION_BYTES = 2_000_000;   // auction data without photos
const MAX_PHOTO_BYTES = 400_000;       // one photo or logo, as a data: URL
const MAX_PHOTOS_PER_SAVE = 60;
const MAX_PENDING_REGISTRATIONS = 500; // forms waiting for the organiser's app to collect them

const FREE_MAX_TEAMS = 2; // accounts on the free plan can run auctions with this many teams

const SESSION_COOKIE = 'ka_session';
const SESSION_DAYS = 60;

/** Settings that are safe to publish (uploaded with the site): the Google client id. */
function app_settings(): array
{
    static $s = null;
    if ($s === null) {
        $file = __DIR__ . '/settings.php';
        $s = is_file($file) ? (require $file) : [];
        // config.php (private, made on the server) may override them.
        $s = array_merge($s, array_intersect_key(config_or_empty(), ['google_client_id' => 1, 'admin_emails' => 1]));
    }
    return $s;
}

function config_or_empty(): array
{
    $file = __DIR__ . '/config.php';
    return is_file($file) ? config() : [];
}

function now_ms(): int
{
    return (int)round(microtime(true) * 1000);
}

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) fail(500, 'not_configured');
        $cfg = require $file;
    }
    return $cfg;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config()['db'];
        try {
            $pdo = new PDO($c['dsn'], $c['user'] ?? null, $c['pass'] ?? null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            error_log('KhiladiAuction DB connect: ' . $e->getMessage());
            fail(500, 'db_unavailable');
        }
        ensure_tables($pdo);
    }
    return $pdo;
}

/** Creates the tables the first time the API runs. Safe to call every time. */
function ensure_tables(PDO $pdo): void
{
    $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $tail = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $pdo->exec('CREATE TABLE IF NOT EXISTS auctions (
        id VARCHAR(48) NOT NULL PRIMARY KEY,
        owner_hash CHAR(64) NOT NULL,
        name VARCHAR(200) NOT NULL DEFAULT \'\',
        data LONGTEXT NOT NULL,
        updated_at BIGINT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        photos_version INT NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
    )' . $tail);
    $pdo->exec('CREATE TABLE IF NOT EXISTS auction_photos (
        auction_id VARCHAR(48) NOT NULL,
        photo_key VARCHAR(64) NOT NULL,
        data MEDIUMTEXT NOT NULL,
        PRIMARY KEY (auction_id, photo_key)
    )' . $tail);
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id ' . ($mysql ? 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT') . ',
        google_sub VARCHAR(64) NOT NULL UNIQUE,
        email VARCHAR(254) NOT NULL DEFAULT \'\',
        name VARCHAR(200) NOT NULL DEFAULT \'\',
        picture VARCHAR(500) NOT NULL DEFAULT \'\',
        created_at BIGINT NOT NULL,
        last_login_at BIGINT NOT NULL
    )' . $tail);
    $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
    )' . $tail);
    // Forms sent by players (register.php). They wait here until the organiser's
    // app collects them, so a form can never be lost to a save from that app.
    $pdo->exec('CREATE TABLE IF NOT EXISTS registrations (
        auction_id VARCHAR(48) NOT NULL,
        id VARCHAR(48) NOT NULL,
        mobile VARCHAR(20) NOT NULL DEFAULT \'\',
        data MEDIUMTEXT NOT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (auction_id, id)
    )' . $tail);
    // Bids tapped on team owners' phones (bid.php). Like registrations they wait
    // here until the organiser's app applies them to the auction.
    $pdo->exec('CREATE TABLE IF NOT EXISTS bids (
        auction_id VARCHAR(48) NOT NULL,
        id VARCHAR(48) NOT NULL,
        team_id VARCHAR(48) NOT NULL,
        kind VARCHAR(8) NOT NULL DEFAULT \'bid\',
        seen VARCHAR(32) NOT NULL DEFAULT \'\',
        status TINYINT NOT NULL DEFAULT 0,
        claim VARCHAR(24) NOT NULL DEFAULT \'\',
        claimed_at BIGINT NOT NULL DEFAULT 0,
        ok TINYINT NOT NULL DEFAULT 0,
        tie TINYINT NOT NULL DEFAULT 0,
        reason VARCHAR(200) NOT NULL DEFAULT \'\',
        created_at BIGINT NOT NULL,
        PRIMARY KEY (auction_id, id)
    )' . $tail);
    // Roles and plans: the super admin approves accounts (see admin.php).
    foreach ([
        'is_admin' => 'TINYINT NOT NULL DEFAULT 0',
        'plan' => "VARCHAR(10) NOT NULL DEFAULT 'free'",
        'payment_done' => 'TINYINT NOT NULL DEFAULT 0',
        'suspended' => 'TINYINT NOT NULL DEFAULT 0',
        'pro_requested_at' => 'BIGINT NOT NULL DEFAULT 0',
    ] as $col => $def) {
        if (!column_exists($pdo, 'users', $col)) $pdo->exec('ALTER TABLE users ADD COLUMN ' . $col . ' ' . $def);
    }
    if (!column_exists($pdo, 'auctions', 'user_id')) {
        $pdo->exec('ALTER TABLE auctions ADD COLUMN user_id INT NULL');
        $pdo->exec('CREATE INDEX auctions_user ON auctions (user_id)');
    }
    // Which device saved last: two admins saving at once is told apart from one admin's two tabs.
    if (!column_exists($pdo, 'auctions', 'last_client')) {
        $pdo->exec("ALTER TABLE auctions ADD COLUMN last_client VARCHAR(24) NOT NULL DEFAULT ''");
    }
    // Readable name of the registration link: khiladiauction.com/register/<slug> (slug.php).
    if (!column_exists($pdo, 'auctions', 'slug')) {
        $pdo->exec('ALTER TABLE auctions ADD COLUMN slug VARCHAR(60) NULL');
        $pdo->exec('CREATE UNIQUE INDEX auctions_slug ON auctions (slug)');
    }
    // Earlier names of a registration link: they keep working and forward to the current one.
    $pdo->exec('CREATE TABLE IF NOT EXISTS slug_history (
        slug VARCHAR(60) NOT NULL PRIMARY KEY,
        auction_id VARCHAR(48) NOT NULL,
        created_at BIGINT NOT NULL
    )' . $tail);
    // People the owner invited, by Google email (checked when they sign in).
    $pdo->exec('CREATE TABLE IF NOT EXISTS auction_members (
        auction_id VARCHAR(48) NOT NULL,
        email VARCHAR(254) NOT NULL,
        role VARCHAR(12) NOT NULL,
        invited_by INT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (auction_id, email)
    )' . $tail);
}

function column_exists(PDO $pdo, string $table, string $column): bool
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
        $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
        $q->execute([$table, $column]);
        return (int)$q->fetchColumn() > 0;
    }
    foreach ($pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll() as $col) {
        if ($col['name'] === $column) return true;
    }
    return false;
}

function send(int $status, ?string $json = null): never
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    if ($json !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo $json;
    }
    exit;
}

function fail(int $status, string $error): never
{
    send($status, json_encode(['error' => $error]));
}

function ok(array $body): never
{
    send(200, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

/** The auction id from the query string, checked so it can't be anything odd. */
function auction_id(): string
{
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-z]_[a-z0-9]{5,44}$/', $id)) fail(400, 'bad_id');
    return $id;
}

/** sha256 of the owner token sent in the X-Owner-Token header, or null if none/invalid. */
function owner_hash(): ?string
{
    $token = $_SERVER['HTTP_X_OWNER_TOKEN'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    return hash('sha256', $token);
}

function require_owner_hash(): string
{
    return owner_hash() ?? fail(401, 'no_token');
}

/** Reads a JSON request body no larger than $max bytes. */
function json_body(int $max): array
{
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $max) fail(413, 'too_large');
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) fail(413, 'too_large');
    $body = json_decode($raw, true);
    if (!is_array($body)) fail(400, 'bad_json');
    return $body;
}

function find_auction(string $id): ?array
{
    $q = db()->prepare('SELECT id, owner_hash, user_id, version, photos_version, updated_at, last_client FROM auctions WHERE id = ?');
    $q->execute([$id]);
    $row = $q->fetch();
    return $row ?: null;
}

/** 3-50 lowercase letters, digits and single hyphens: the readable name of a registration link. */
function valid_slug(string $s): bool
{
    return strlen($s) >= 3 && strlen($s) <= 50 && preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $s) === 1;
}

/**
 * The auction (id, name, data, slug) behind a registration link name. An
 * earlier name of a link that was renamed finds the auction too; its `slug` is
 * always the current name, so the caller can tell and forward.
 */
function find_by_slug(string $slug): ?array
{
    $q = db()->prepare('SELECT id, name, data, slug FROM auctions WHERE slug = ?');
    $q->execute([$slug]);
    $row = $q->fetch();
    if ($row) return $row;
    $q = db()->prepare('SELECT a.id, a.name, a.data, a.slug FROM slug_history h JOIN auctions a ON a.id = h.auction_id WHERE h.slug = ?');
    $q->execute([$slug]);
    return $q->fetch() ?: null;
}

/** What may be shown about an auction on its registration page: name, sport, date and place. */
function auction_headline(array $row): array
{
    $d = json_decode((string)$row['data'], true);
    $s = is_array($d['settings'] ?? null) ? $d['settings'] : [];
    return [
        'id' => $row['id'],
        'name' => (string)$row['name'],
        'slug' => (string)($row['slug'] ?? ''),
        'sport' => is_string($s['sport'] ?? null) ? $s['sport'] : 'cricket',
        'date' => is_string($s['date'] ?? null) ? $s['date'] : '',
        'venue' => is_string($s['venue'] ?? null) ? $s['venue'] : '',
    ];
}

const MEMBER_ROLES = ['admin', 'auctioneer', 'data', 'scorer'];
const MAX_MEMBERS = 12;

function norm_email(string $email): string
{
    return strtolower(trim($email));
}

/**
 * What this request is to the auction: 'owner' (its account, or the browser
 * holding the token of an auction not yet in any account), an invited
 * 'admin' / 'auctioneer' / 'data' / 'scorer', or null for everyone else.
 */
function role_of(array $auction, ?array $user): ?string
{
    if ($auction['user_id'] !== null) {
        if ($user === null) return null;
        if ((int)$auction['user_id'] === (int)$user['id']) return 'owner';
        $email = norm_email((string)($user['email'] ?? ''));
        if ($email === '') return null;
        $q = db()->prepare('SELECT role FROM auction_members WHERE auction_id = ? AND email = ?');
        $q->execute([$auction['id'], $email]);
        $role = $q->fetchColumn();
        return is_string($role) && in_array($role, MEMBER_ROLES, true) ? $role : null;
    }
    $h = owner_hash();
    return $h !== null && hash_equals($auction['owner_hash'], $h) ? 'owner' : null;
}

/** True when this request may change the auction: its owner, or any invited member. */
function can_edit(array $auction, ?array $user): bool
{
    return role_of($auction, $user) !== null;
}

/** Stops unless the request may change this auction. */
function require_owner(array $auction, ?array $user = null): void
{
    if (!can_edit($auction, $user ?? current_user())) fail(403, 'not_owner');
}

/** Stops unless the request's role on this auction is one of $roles (e.g. only owner and admin invite people). */
function require_role(array $auction, ?array $user, string ...$roles): string
{
    $role = role_of($auction, $user ?? current_user());
    if ($role === null || !in_array($role, $roles, true)) fail(403, 'not_allowed');
    return $role;
}

// ---------- signed-in users ----------

/** The signed-in user (id, email, name, picture), or null. */
function current_user(): ?array
{
    static $done = false, $user = null;
    if ($done) return $user;
    $done = true;
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    $q = db()->prepare('SELECT u.id, u.email, u.name, u.picture, u.is_admin, u.plan, u.payment_done, u.suspended, u.pro_requested_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?');
    $q->execute([hash('sha256', $token), now_ms()]);
    $user = $q->fetch() ?: null;
    if ($user) $user['id'] = (int)$user['id'];
    return $user;
}

function require_user(): array
{
    return current_user() ?? fail(401, 'login_required');
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

/** Sets (or, with an empty token, clears) the sign-in cookie. Only the API can read it. */
function set_session_cookie(string $token, int $expiresSec): void
{
    setcookie(SESSION_COOKIE, $token, [
        'expires' => $expiresSec,
        'path' => '/api/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** What the app is told about a user. */
function public_user(array $u): array
{
    return [
        'id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name'], 'picture' => $u['picture'],
        'isAdmin' => !empty($u['is_admin']),
        'plan' => is_pro($u) ? 'pro' : 'free',
        'paymentDone' => !empty($u['payment_done']),
        'suspended' => !empty($u['suspended']),
        'proRequested' => (int)($u['pro_requested_at'] ?? 0) > 0,
        'maxTeams' => is_pro($u) ? null : FREE_MAX_TEAMS,
    ];
}

/** Pro accounts (and the super admin) can use any number of teams. */
function is_pro(array $u): bool
{
    return !empty($u['is_admin']) || ($u['plan'] ?? 'free') === 'pro';
}

/** Stops unless the signed-in user is the super admin. */
function require_admin(): array
{
    $u = require_user();
    if (empty($u['is_admin'])) fail(403, 'admin_only');
    return $u;
}

/** The auction as viewers may see it: players' and owners' phone numbers removed. */
function public_view(string $json): string
{
    $d = json_decode($json, true);
    if (!is_array($d)) return $json;
    foreach (['players' => ['mobile'], 'teams' => ['ownerMobile', 'ownerKey']] as $list => $fields) {
        if (!isset($d[$list]) || !is_array($d[$list])) continue;
        foreach ($d[$list] as $i => $item) {
            if (is_array($item)) foreach ($fields as $f) unset($d[$list][$i][$f]);
        }
    }
    return json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
}

function require_method(string ...$methods): string
{
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        fail(405, 'method_not_allowed');
    }
    return $m;
}
