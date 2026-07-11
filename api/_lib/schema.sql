-- EnvShare / Turso (libSQL) schema.
-- One table replaces the two Upstash Redis key patterns:
--   project:${shareCode}        -> a row keyed by share_code
--   user:${userId}:projects Set -> the indexed owner_id column
-- Run once against the database (also run by scripts/migrate-upstash-to-turso.mjs).

CREATE TABLE IF NOT EXISTS projects (
  share_code             TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  ciphertext             TEXT NOT NULL,
  iv                     TEXT NOT NULL,
  owner_id               TEXT NOT NULL,
  created_at             INTEGER NOT NULL,               -- epoch ms
  updated_at             INTEGER NOT NULL,               -- epoch ms
  environment_count      INTEGER NOT NULL DEFAULT 0,
  environment_filenames  TEXT NOT NULL DEFAULT '[]',     -- JSON array of strings
  source                 TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'folder'
  folder_fingerprint     TEXT,                           -- nullable
  folder_name            TEXT                            -- nullable
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_fp
  ON projects(owner_id, folder_fingerprint);
