-- 다단계 결재 스텝 테이블
CREATE TABLE IF NOT EXISTS approval_steps (
  id          TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  "order"     INTEGER NOT NULL,
  approver_id TEXT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'WAITING',
  acted_at    TIMESTAMPTZ,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(approval_id, "order")
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_approval ON approval_steps(approval_id);
