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
