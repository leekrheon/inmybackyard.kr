-- ads 테이블에 position 컬럼 추가
ALTER TABLE ads ADD COLUMN IF NOT EXISTS position_x text DEFAULT 'center'; -- left / center / right
ALTER TABLE ads ADD COLUMN IF NOT EXISTS position_y text DEFAULT 'center'; -- top / center / bottom
