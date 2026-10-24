-- Additive migration: preserves all accounts, restaurants, dishes, and reviews.
CREATE TABLE IF NOT EXISTS phone_signup_verifications (
  phone VARCHAR(16) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code_hash CHAR(64) NULL,
  provider_sid VARCHAR(34) NULL,
  expires_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  send_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  token_hash CHAR(64) NULL,
  verified_until BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
