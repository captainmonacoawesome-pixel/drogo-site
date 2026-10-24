-- Drogo's public photo gallery and one daily featured photo.
-- Run on drogo-ama-preview first. Does not modify the AMA tables.
CREATE TABLE IF NOT EXISTS gallery_photos (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  caption TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_photo_of_day INTEGER NOT NULL DEFAULT 0 CHECK (is_photo_of_day IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_gallery_recent ON gallery_photos(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_one_featured
  ON gallery_photos(is_photo_of_day) WHERE is_photo_of_day = 1;
