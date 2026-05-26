-- =============================================
-- CatchCopy 새 기능 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 사용자 캐치(포인트) 테이블
CREATE TABLE IF NOT EXISTS user_catches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_key text NOT NULL UNIQUE,
  catches integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_catches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_user_catches" ON user_catches FOR ALL USING (true) WITH CHECK (true);

-- 2. 브리프 읽음 기록 테이블
CREATE TABLE IF NOT EXISTS brief_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  voter_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brief_id, voter_key)
);
ALTER TABLE brief_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_brief_reads" ON brief_reads FOR ALL USING (true) WITH CHECK (true);

-- 3. 캐치 지급 대기 테이블 (TOP4 보상)
CREATE TABLE IF NOT EXISTS catch_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  copy_id uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  voter_key text NOT NULL,
  author text NOT NULL,
  rank integer NOT NULL,
  catch_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending / paid
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE catch_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_catch_payouts" ON catch_payouts FOR ALL USING (true) WITH CHECK (true);

-- 4. briefs 테이블에 reward_amount 컬럼 추가 (숫자형 상금)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS reward_amount integer DEFAULT 0;

-- 5. copies 테이블에 voter_key 컬럼 추가 (작성자 식별)
ALTER TABLE copies ADD COLUMN IF NOT EXISTS voter_key text;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_catches;
ALTER PUBLICATION supabase_realtime ADD TABLE catch_payouts;
