-- Food Hunt schema (MySQL 8.0.12+ required for SRID columns and ST_Latitude/ST_Longitude)
-- Locations are stored as SRID 4326 (WGS 84 lat/long).

DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS dishes;
DROP TABLE IF EXISTS businesses;

CREATE TABLE businesses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  description   VARCHAR(1000) NULL,
  story         VARCHAR(2000) NULL,            -- "our story": family / region the food comes from
  cuisine       VARCHAR(40)   NOT NULL,
  vendor_type   ENUM('restaurant','food-truck','pop-up','market-stall') NOT NULL,
  price_level   TINYINT UNSIGNED NOT NULL CHECK (price_level BETWEEN 1 AND 4),
  address       VARCHAR(255)  NOT NULL,
  is_licensed   BOOLEAN       NOT NULL DEFAULT FALSE,
  location      POINT NOT NULL SRID 4326,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_business_location (location),
  INDEX idx_business_cuisine (cuisine),
  INDEX idx_business_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dishes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id   INT UNSIGNED NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(500) NULL,
  price_cents   INT UNSIGNED NULL,
  is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_dish_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  INDEX idx_dish_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reviews (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id   INT UNSIGNED NOT NULL,
  author_name   VARCHAR(60)  NOT NULL,       -- replaced by user_id once auth lands (sprint 2)
  authenticity  TINYINT UNSIGNED NOT NULL CHECK (authenticity BETWEEN 1 AND 5),
  taste         TINYINT UNSIGNED NOT NULL CHECK (taste BETWEEN 1 AND 5),
  value         TINYINT UNSIGNED NOT NULL CHECK (value BETWEEN 1 AND 5),
  comment       VARCHAR(1000) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User accounts for authentication.
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(254) NULL UNIQUE,
  phone         VARCHAR(16) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('explorer', 'owner', 'admin')
                NOT NULL DEFAULT 'explorer',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Additive migration: preserves all accounts, restaurants, dishes, and reviews.
CREATE TABLE IF NOT EXISTS signup_verifications (
  email VARCHAR(254) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code_hash CHAR(64) NULL,
  expires_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  send_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  token_hash CHAR(64) NULL,
  verified_until BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
