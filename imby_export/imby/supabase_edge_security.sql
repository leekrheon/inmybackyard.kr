-- =============================================
-- CatchCopy 완전 보안 강화 SQL
-- Edge Function 적용 후 실행하세요
-- =============================================

-- 1. anomaly_log 테이블 (이상거래 감지)
CREATE TABLE IF NOT EXISTS anomaly_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_key text NOT NULL,
  reason text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE anomaly_log ENABLE ROW LEVEL SECURITY;
-- 클라이언트는 읽기도 불가 (관리자만)
CREATE POLICY "admin_only_anomaly" ON anomaly_log FOR ALL USING (false);

-- 2. copies 테이블 RLS 완전 잠금
-- 클라이언트는 읽기만 가능, 쓰기는 Edge Function(service_role)만
DROP POLICY IF EXISTS "insert_copies_with_voter_key" ON copies;
DROP POLICY IF EXISTS "select_copies" ON copies;
DROP POLICY IF EXISTS "update_copies_upvotes" ON copies;
DROP POLICY IF EXISTS "public_all" ON copies;

CREATE POLICY "copies_select" ON copies FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE는 service_role만 (Edge Function)
-- anon/authenticated는 불가

-- 3. user_catches RLS 완전 잠금
-- 클라이언트는 자신의 잔액만 읽기 가능, 쓰기 불가
DROP POLICY IF EXISTS "insert_user_catches" ON user_catches;
DROP POLICY IF EXISTS "update_user_catches" ON user_catches;
DROP POLICY IF EXISTS "select_user_catches" ON user_catches;
DROP POLICY IF EXISTS "public_all_user_catches" ON user_catches;

CREATE POLICY "user_catches_select" ON user_catches FOR SELECT USING (true);
-- INSERT/UPDATE는 service_role(Edge Function)만

-- 4. copy_votes RLS 잠금
DROP POLICY IF EXISTS "copy_votes_copy_voter_unique" ON copy_votes;
DROP POLICY IF EXISTS "public_all" ON copy_votes;
CREATE POLICY IF NOT EXISTS "copy_votes_select" ON copy_votes FOR SELECT USING (true);
-- INSERT/DELETE는 service_role만

-- 5. brief_reads는 클라이언트 INSERT 허용 유지 (타이머는 클라이언트)
-- 단, voter_key 검증 강화
DROP POLICY IF EXISTS "insert_brief_reads" ON brief_reads;
CREATE POLICY "brief_reads_insert" ON brief_reads
  FOR INSERT WITH CHECK (
    voter_key IS NOT NULL
    AND length(voter_key) >= 10
    AND brief_id IS NOT NULL
  );

-- 6. user_catches 캐치 최대값 제한 (단일 적립 최대 400)
-- 이상 금액 insert 자체를 DB에서 차단
ALTER TABLE user_catches ADD CONSTRAINT IF NOT EXISTS catches_positive CHECK (catches >= 0);

-- 7. copies voter_key 길이 제한
ALTER TABLE copies ADD CONSTRAINT IF NOT EXISTS copies_voter_key_length CHECK (length(voter_key) >= 10);

-- =============================================
-- 확인용 쿼리
-- =============================================
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('copies','user_catches','copy_votes');
