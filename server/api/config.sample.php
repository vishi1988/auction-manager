<?php
// Database settings for the KhiladiAuction API.
//
// On Hostinger: hPanel -> Databases -> MySQL Databases shows the database
// name and user (both start with your account prefix, e.g. u123456789_).
// Type the password you chose there into 'pass' below, directly in
// Hostinger's File Manager. Never share this file.
return [
    'db' => [
        'dsn'  => 'mysql:host=localhost;dbname=DATABASE_NAME;charset=utf8mb4',
        'user' => 'DATABASE_USER',
        'pass' => 'DATABASE_PASSWORD',
    ],
];
