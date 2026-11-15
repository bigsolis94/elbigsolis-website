CREATE TABLE IF NOT EXISTS studio_store (
 upload_id INTEGER PRIMARY KEY,
 published INTEGER NOT NULL DEFAULT 0,
 price_min_cents INTEGER NOT NULL DEFAULT 0,
 description TEXT NOT NULL DEFAULT '',
 FOREIGN KEY(upload_id) REFERENCES studio_uploads(id)
);
