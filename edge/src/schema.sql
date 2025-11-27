CREATE TABLE redirects (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  admin_secret TEXT NOT NULL UNIQUE,
  created_at INTEGER DEFAULT (unixepoch()),
  clicks INTEGER DEFAULT 0
);
