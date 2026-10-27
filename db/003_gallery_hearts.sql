-- One reaction per anonymous browser per photo. No names, email or raw IP stored.
-- Cloudflare Pages initialises these tables on first use; this file is also
-- provided for explicit D1 migrations and disaster recovery.
CREATE TABLE IF NOT EXISTS gallery_hearts (
  photo_id TEXT NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (photo_id, visitor_hash)
) WITHOUT ROWID;

-- Throttle excessive voting from the same source without storing raw IPs.
CREATE TABLE IF NOT EXISTS gallery_heart_rate (
  ip_hash TEXT NOT NULL,
  hour_bucket INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, hour_bucket)
) WITHOUT ROWID;
