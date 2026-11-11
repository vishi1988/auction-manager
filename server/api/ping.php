<?php
// Health check. Open https://<your-domain>/api/ping.php after uploading:
// {"ok":true,"database":"connected"} means the API and database are ready.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

require_method('GET');
db()->query('SELECT 1 FROM auctions LIMIT 1');
ok(['ok' => true, 'database' => 'connected', 'php' => PHP_VERSION]);
