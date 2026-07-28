-- Tracks progress of bulk WA/EA refresh jobs so the UI can show live progress
-- and know when the refresh has actually finished.

CREATE TABLE IF NOT EXISTS wa_refresh_job (
  id TEXT PRIMARY KEY,
  total_count INTEGER NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
