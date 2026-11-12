-- Tables for the KhiladiAuction API (MySQL / MariaDB on Hostinger).
-- You do not need to run this: the API creates these tables itself the first
-- time it is used. It is here for reference and for manual setups.

CREATE TABLE IF NOT EXISTS auctions (
  id VARCHAR(48) NOT NULL PRIMARY KEY,
  owner_hash CHAR(64) NOT NULL,          -- sha256 of the owner token; the token itself is never stored
  name VARCHAR(200) NOT NULL DEFAULT '',
  data LONGTEXT NOT NULL,                -- the auction (settings, teams, players, bids) as JSON, without photos
  updated_at BIGINT NOT NULL,            -- ms since 1970, set by the organiser's browser
  version INT NOT NULL DEFAULT 1,        -- +1 on every save; screens poll for changes with ?since=
  photos_version INT NOT NULL DEFAULT 0, -- +1 whenever photos change
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auction_photos (
  auction_id VARCHAR(48) NOT NULL,
  photo_key VARCHAR(64) NOT NULL,        -- player-<id> or team-<id>
  data MEDIUMTEXT NOT NULL,              -- data:image/jpeg;base64,...
  PRIMARY KEY (auction_id, photo_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Forms sent by players from the registration link (register.php). They wait
-- here until the organiser's app collects them and adds the players.
CREATE TABLE IF NOT EXISTS registrations (
  auction_id VARCHAR(48) NOT NULL,
  id VARCHAR(48) NOT NULL,               -- becomes the player's id
  mobile VARCHAR(20) NOT NULL DEFAULT '', -- digits only, to refuse a second form from the same number
  data MEDIUMTEXT NOT NULL,              -- the form as JSON (with the photo, if any)
  created_at BIGINT NOT NULL,
  PRIMARY KEY (auction_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Google sign-in (login.php). Saving online needs a signed-in user; an auction
-- belongs to the user who saved it (auctions.user_id).
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  google_sub VARCHAR(64) NOT NULL UNIQUE, -- Google's id for the account
  email VARCHAR(254) NOT NULL DEFAULT '',
  name VARCHAR(200) NOT NULL DEFAULT '',
  picture VARCHAR(500) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  last_login_at BIGINT NOT NULL,
  -- Added later (the API adds them by itself): roles and plans, see admin.php.
  is_admin TINYINT NOT NULL DEFAULT 0,
  plan VARCHAR(10) NOT NULL DEFAULT 'free',
  payment_done TINYINT NOT NULL DEFAULT 0,
  suspended TINYINT NOT NULL DEFAULT 0,
  pro_requested_at BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY, -- sha256 of the sign-in cookie; the cookie itself is never stored
  user_id INT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE auctions ADD COLUMN user_id INT NULL;  -- added automatically when missing
CREATE INDEX auctions_user ON auctions (user_id);
