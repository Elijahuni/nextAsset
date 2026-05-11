-- 예방적 유지보수 스케줄 테이블
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id            TEXT PRIMARY KEY,
  asset_id      TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  last_done_at  TIMESTAMPTZ,
  next_due_at   TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_asset  ON maintenance_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_due    ON maintenance_schedules(next_due_at);
