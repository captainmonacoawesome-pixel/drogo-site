-- Run in each gallery-enabled Cloudflare D1 database (production and preview).
-- Requires db/002_gallery.sql (gallery_photos) to already exist.
CREATE TABLE IF NOT EXISTS gallery_likes (
  photo_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (photo_id,visitor_id),
  FOREIGN KEY (photo_id) REFERENCES gallery_photos(id) ON DELETE CASCADE
);
-- Composite primary key supports counts by photo_id without a separate index.
-- Deleting a gallery_photos row automatically removes its hearts.
