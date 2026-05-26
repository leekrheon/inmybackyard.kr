-- ── MEDIA: 뉴스 기사 테이블 ────────────────────────────────
CREATE TABLE IF NOT EXISTS news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text,
  description text,
  image_url text,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read news_articles" ON news_articles
  FOR SELECT USING (true);

CREATE POLICY "admin insert news_articles" ON news_articles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin delete news_articles" ON news_articles
  FOR DELETE USING (true);

-- ── CONTACT: 문의 메시지 테이블 ───────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public insert contact_messages" ON contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin read contact_messages" ON contact_messages
  FOR SELECT USING (true);

-- ── WORK(BRIEF): pdf_url 컬럼 추가 ────────────────────────
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS pdf_url text;
