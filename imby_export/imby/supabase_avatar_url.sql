-- posts 테이블에 avatar_url 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS avatar_url text;

-- comments 테이블에 avatar_url 컬럼 추가
ALTER TABLE comments ADD COLUMN IF NOT EXISTS avatar_url text;
