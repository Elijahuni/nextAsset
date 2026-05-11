-- 자산 실사 테이블
CREATE TABLE IF NOT EXISTS asset_audits (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date   TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_audit_items (
  id         TEXT PRIMARY KEY,
  audit_id   TEXT NOT NULL REFERENCES asset_audits(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  result     TEXT NOT NULL DEFAULT 'PENDING',
  audited_by TEXT,
  audited_at TIMESTAMPTZ,
  note       TEXT,
  UNIQUE(audit_id, asset_id)
);

CREATE TYPE IF NOT EXISTS "AuditItemResult" AS ENUM ('PENDING', 'CONFIRMED', 'MISSING', 'SURPLUS');

CREATE INDEX IF NOT EXISTS idx_asset_audits_status     ON asset_audits(status);
CREATE INDEX IF NOT EXISTS idx_asset_audits_created    ON asset_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_audit_items_audit ON asset_audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_asset_audit_items_asset ON asset_audit_items(asset_id);
