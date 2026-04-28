CREATE TABLE IF NOT EXISTS job_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL,
  job_id        TEXT NOT NULL,
  job_title     TEXT,
  job_url       TEXT,
  best_score    INTEGER,
  skills_gap    TEXT,        -- JSON string: '[{"skill":"Power BI","priority":"required"}]'
  last_analyzed TEXT,        -- ISO-8601 string
  UNIQUE (email, job_id)
);
CREATE INDEX IF NOT EXISTS idx_job_history_email ON job_history(email);
