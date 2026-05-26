-- briefs 테이블에 external_url 컬럼 추가
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS external_url text;
