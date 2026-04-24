-- Migration 003: assets 테이블에 remarks 컬럼 추가 (TW-AMS 비고 필드)
-- Supabase SQL Editor에서 실행하세요.
-- https://supabase.com/dashboard → SQL Editor

ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "remarks" TEXT;

COMMENT ON COLUMN "assets"."remarks" IS '비고 (TW-AMS remarks 호환 필드)';
