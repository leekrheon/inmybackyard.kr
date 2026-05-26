-- =====================================================
-- 기존 Supabase DB에 추가 실행할 SQL
-- SQL Editor에서 실행하세요.
-- =====================================================

-- posts 테이블에 dislikes 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS dislikes integer NOT NULL DEFAULT 0;
