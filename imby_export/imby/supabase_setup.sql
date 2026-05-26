-- =====================================================
-- CatchCopy Supabase 설정 SQL
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.
-- =====================================================

-- 1. 테이블 생성
-- ─────────────────────────────────────────────────────

CREATE TABLE briefs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  title        text NOT NULL,
  problem      text NOT NULL,
  target       text NOT NULL,
  campaign_info text NOT NULL,
  reward       text NOT NULL,
  deadline     text NOT NULL,
  participants integer NOT NULL DEFAULT 0,
  status       text NOT NULL CHECK (status IN ('진행중', '종료')),
  category     text NOT NULL,
  bg_color     text NOT NULL DEFAULT 'bg-gray-50',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE copies (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id  uuid NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  author    text NOT NULL DEFAULT '익명',
  content   text NOT NULL,
  upvotes   integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text NOT NULL,
  title      text NOT NULL,
  content    text NOT NULL,
  author     text NOT NULL DEFAULT '익명',
  avatar     text NOT NULL DEFAULT 'AN',
  views      integer NOT NULL DEFAULT 0,
  likes      integer NOT NULL DEFAULT 0,
  is_pinned  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author     text NOT NULL DEFAULT '익명',
  avatar     text NOT NULL DEFAULT 'AN',
  content    text NOT NULL,
  likes      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  author     text NOT NULL DEFAULT '익명',
  avatar     text NOT NULL DEFAULT 'AN',
  content    text NOT NULL,
  likes      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- 2. Realtime 활성화
-- ─────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE briefs;
ALTER PUBLICATION supabase_realtime ADD TABLE copies;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE replies;


-- 3. RLS (Row Level Security) — 읽기는 누구나, 쓰기는 누구나 (로그인 없는 MVP)
-- ─────────────────────────────────────────────────────
ALTER TABLE briefs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE copies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies  ENABLE ROW LEVEL SECURITY;

-- 모든 테이블에 anon(비로그인) 전체 허용 정책
CREATE POLICY "public_read_briefs"   ON briefs   FOR SELECT USING (true);
CREATE POLICY "public_insert_briefs" ON briefs   FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_briefs" ON briefs   FOR UPDATE USING (true);

CREATE POLICY "public_read_copies"   ON copies   FOR SELECT USING (true);
CREATE POLICY "public_insert_copies" ON copies   FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_copies" ON copies   FOR UPDATE USING (true);

CREATE POLICY "public_read_posts"    ON posts    FOR SELECT USING (true);
CREATE POLICY "public_insert_posts"  ON posts    FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_posts"  ON posts    FOR UPDATE USING (true);

CREATE POLICY "public_read_comments" ON comments FOR SELECT USING (true);
CREATE POLICY "public_insert_comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_comments" ON comments FOR UPDATE USING (true);

CREATE POLICY "public_read_replies"  ON replies  FOR SELECT USING (true);
CREATE POLICY "public_insert_replies" ON replies FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_replies" ON replies FOR UPDATE USING (true);




-- =====================================================
-- 완료! 테이블이 빈 상태로 준비되었습니다.
-- 브리프는 Supabase 대시보드 > Table Editor에서
-- 직접 추가하거나, 나중에 관리자 페이지를 만들어 추가할 수 있습니다.
-- =====================================================
