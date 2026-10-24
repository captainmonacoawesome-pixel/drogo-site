-- Ask Meow Anything. Apply once to the selected D1 database.
CREATE TABLE IF NOT EXISTS ama_questions (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')),
  created_at TEXT NOT NULL,
  answered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ama_public ON ama_questions(status, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ama_pending ON ama_questions(status, created_at ASC);

-- Privacy-preserving keyed hash; never store visitors' original IP addresses.
CREATE TABLE IF NOT EXISTS ama_rate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ama_rate ON ama_rate(ip_hash, created_at);
