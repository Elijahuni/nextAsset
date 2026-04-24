-- ============================================================
-- 002_soft_delete.sql
-- Supabase SQL Editor에서 실행 (한 번만)
-- ============================================================

-- assets 테이블에 소프트 삭제 컬럼 추가
ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

-- 삭제되지 않은 자산 조회 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS "assets_deleted_at_idx"
  ON "assets" ("deletedAt")
  WHERE "deletedAt" IS NULL;
