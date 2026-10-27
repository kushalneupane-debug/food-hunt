-- Hunt Together: food meetups at listed places. Additive; keeps all existing data.
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
