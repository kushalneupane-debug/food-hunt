-- Food Hunt schema (MySQL 8.0.12+ required for SRID columns and ST_Latitude/ST_Longitude)
-- Locations are stored as SRID 4326 (WGS 84 lat/long).

-- Meetup tables reference businesses, so they are dropped first.
DROP TABLE IF EXISTS meetup_reports;
DROP TABLE IF EXISTS meetup_members;
DROP TABLE IF EXISTS meetups;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS dishes;
DROP TABLE IF EXISTS businesses;

CREATE TABLE businesses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  description   VARCHAR(1000) NULL,
  story         VARCHAR(2000) NULL,            -- "our story": family / region the food comes from
  cuisine       VARCHAR(40)   NOT NULL,
  category      ENUM('eat','drink','sweets','shop') NOT NULL DEFAULT 'eat',
  subcategory   VARCHAR(40)   NULL,            -- e.g. coffee, boba-tea, bakery, grocery
  vendor_type   ENUM('restaurant','food-truck','pop-up','market-stall','cafe','bakery','store') NOT NULL,
  price_level   TINYINT UNSIGNED NOT NULL CHECK (price_level BETWEEN 1 AND 4),
  address       VARCHAR(255)  NOT NULL,
  is_licensed   BOOLEAN       NOT NULL DEFAULT FALSE,
  source        VARCHAR(20)   NOT NULL DEFAULT 'owner',  -- owner, osm (OpenStreetMap import) or sample
  osm_id        VARCHAR(30)   NULL UNIQUE,              -- e.g. node/123, so re-imports update in place
  location      POINT NOT NULL SRID 4326,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_business_location (location),
  INDEX idx_business_cuisine (cuisine),
  INDEX idx_business_category (category),
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

-- Hunt Together: food meetups at listed places (also in migrations/003-meetups.sql).
CREATE TABLE IF NOT EXISTS meetups (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  host_id     INT UNSIGNED NOT NULL,
  craving     VARCHAR(40)  NOT NULL,
  note        VARCHAR(280) NULL,
  starts_at   DATETIME     NOT NULL,
  max_people  TINYINT UNSIGNED NOT NULL,
  status      ENUM('open','cancelled') NOT NULL DEFAULT 'open',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meetup_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_meetup_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_meetup_starts (status, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meetup_members (
  meetup_id INT UNSIGNED NOT NULL,
  user_id   INT UNSIGNED NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meetup_id, user_id),
  CONSTRAINT fk_member_meetup FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meetup_reports (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meetup_id   INT UNSIGNED NOT NULL,
  reporter_id INT UNSIGNED NOT NULL,
  reason      VARCHAR(500) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report_once (meetup_id, reporter_id),
  CONSTRAINT fk_report_meetup FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_user FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
