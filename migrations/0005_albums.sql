
CREATE TABLE IF NOT EXISTS studio_albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'BIG SOLIS',
  release_type TEXT NOT NULL DEFAULT 'album'
    CHECK (release_type IN ('album', 'ep')),
  description TEXT NOT NULL DEFAULT '',
  cover_key TEXT,
  price_min_cents INTEGER NOT NULL DEFAULT 500
    CHECK (price_min_cents >= 100),
  published INTEGER NOT NULL DEFAULT 0
    CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS studio_album_tracks (
  album_id INTEGER NOT NULL,
  upload_id INTEGER NOT NULL,
  track_number INTEGER NOT NULL
    CHECK (track_number > 0),
  PRIMARY KEY (album_id, upload_id),
  UNIQUE (album_id, track_number),
  FOREIGN KEY (album_id) REFERENCES studio_albums(id),
  FOREIGN KEY (upload_id) REFERENCES studio_uploads(id)
);

CREATE TABLE IF NOT EXISTS studio_album_purchases (
  stripe_session_id TEXT PRIMARY KEY,
  album_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  track_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES studio_albums(id)
);

CREATE INDEX IF NOT EXISTS idx_studio_album_tracks_album
  ON studio_album_tracks(album_id, track_number);
