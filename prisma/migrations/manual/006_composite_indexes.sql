-- 복합 인덱스 추가: 소프트삭제 + 자주 사용하는 필터 조합
CREATE INDEX IF NOT EXISTS idx_assets_deleted_dept     ON assets(deleted_at, department);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_status   ON assets(deleted_at, status);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_category ON assets(deleted_at, category);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_acquired ON assets(deleted_at, acquired_date);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_price    ON assets(deleted_at, price);
