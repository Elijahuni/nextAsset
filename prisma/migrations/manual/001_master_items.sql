-- ============================================================
-- 001_master_items.sql
-- Supabase SQL Editor에서 실행 (한 번만)
-- ============================================================

-- MasterItem 테이블 생성
CREATE TABLE IF NOT EXISTS "master_items" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "type"      TEXT        NOT NULL,
  "value"     TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "master_items_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "master_items_type_value_key" UNIQUE ("type", "value")
);

CREATE INDEX IF NOT EXISTS "master_items_type_idx" ON "master_items" ("type");

-- 기본 마스터 데이터 시드 (중복 무시)
INSERT INTO "master_items" ("type", "value") VALUES
  ('departments', '경영지원부'),
  ('departments', 'IT개발팀'),
  ('departments', '영업팀'),
  ('departments', '마케팅팀'),
  ('departments', '회계팀'),
  ('locations',   '본사 1층'),
  ('locations',   '본사 2층'),
  ('locations',   '본사 3층'),
  ('locations',   '본사 4층'),
  ('locations',   '별관 A동'),
  ('locations',   '창고'),
  ('vendors',     '삼성전자 서비스'),
  ('vendors',     'LG전자 서비스'),
  ('vendors',     'Dell 코리아'),
  ('vendors',     '현대자동차'),
  ('categories',  '노트북'),
  ('categories',  '데스크탑'),
  ('categories',  '모니터'),
  ('categories',  '사무가구'),
  ('categories',  '차량'),
  ('categories',  '기계장치'),
  ('categories',  '소프트웨어')
ON CONFLICT ("type", "value") DO NOTHING;
