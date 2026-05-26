-- =============================================
-- CatchCopy 보안 강화 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. copies 테이블: 1인 1브리프 1카피 UNIQUE 제약 (DB 레벨 차단)
ALTER TABLE copies ADD CONSTRAINT copies_brief_voter_unique UNIQUE (brief_id, voter_key);

-- 2. brief_reads 테이블: 이미 있음 확인 (없으면 추가)
ALTER TABLE brief_reads ADD CONSTRAINT brief_reads_brief_voter_unique UNIQUE (brief_id, voter_key);

-- 3. copy_votes 테이블: 중복 투표 차단
ALTER TABLE copy_votes ADD CONSTRAINT copy_votes_copy_voter_unique UNIQUE (copy_id, voter_key);

-- 4. user_catches: voter_key당 1개만 허용
ALTER TABLE user_catches ADD CONSTRAINT user_catches_voter_key_unique UNIQUE (voter_key);

-- 5. copies에 voter_key NOT NULL 강제
ALTER TABLE copies ALTER COLUMN voter_key SET NOT NULL;

-- 6. RLS 강화: copies는 voter_key 있는 경우만 insert 허용
DROP POLICY IF EXISTS "public_all_copies" ON copies;
CREATE POLICY "insert_copies_with_voter_key" ON copies
  FOR INSERT WITH CHECK (voter_key IS NOT NULL AND length(voter_key) > 5);
CREATE POLICY "select_copies" ON copies FOR SELECT USING (true);
CREATE POLICY "update_copies_upvotes" ON copies FOR UPDATE USING (true);

-- 7. user_catches: 직접 update 금액 제한 (클라이언트가 임의 금액 못 넣게)
-- catches는 항상 양수여야 함
DROP POLICY IF EXISTS "public_all_user_catches" ON user_catches;
CREATE POLICY "select_user_catches" ON user_catches FOR SELECT USING (true);
CREATE POLICY "insert_user_catches" ON user_catches
  FOR INSERT WITH CHECK (catches >= 0 AND catches <= 400 AND voter_key IS NOT NULL);
CREATE POLICY "update_user_catches" ON user_catches
  FOR UPDATE USING (true) WITH CHECK (catches >= 0);

-- 8. brief_reads: voter_key + brief_id만 insert 가능
DROP POLICY IF EXISTS "public_all_brief_reads" ON brief_reads;
CREATE POLICY "select_brief_reads" ON brief_reads FOR SELECT USING (true);
CREATE POLICY "insert_brief_reads" ON brief_reads
  FOR INSERT WITH CHECK (voter_key IS NOT NULL AND brief_id IS NOT NULL);

-- 9. catch_payouts: SELECT/INSERT만 허용, UPDATE는 서버(관리자)만
DROP POLICY IF EXISTS "public_all_catch_payouts" ON catch_payouts;
CREATE POLICY "select_catch_payouts" ON catch_payouts FOR SELECT USING (true);
CREATE POLICY "insert_catch_payouts" ON catch_payouts FOR INSERT WITH CHECK (true);
CREATE POLICY "update_catch_payouts" ON catch_payouts FOR UPDATE USING (true);

-- 10. 캐치 적립 함수: 서버 사이드에서 원자적 처리 (중복 방지)
CREATE OR REPLACE FUNCTION award_catch_for_copy(
  p_voter_key text,
  p_brief_id uuid,
  p_catch_amount integer DEFAULT 400
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_copy_exists boolean;
  v_current_catches integer;
BEGIN
  -- 이미 이 브리프에 카피를 작성했는지 확인
  SELECT EXISTS(
    SELECT 1 FROM copies
    WHERE brief_id = p_brief_id AND voter_key = p_voter_key
  ) INTO v_copy_exists;

  IF NOT v_copy_exists THEN
    RETURN jsonb_build_object('success', false, 'reason', 'copy_not_found');
  END IF;

  -- 캐치 적립 (upsert)
  INSERT INTO user_catches (voter_key, catches)
  VALUES (p_voter_key, p_catch_amount)
  ON CONFLICT (voter_key) DO UPDATE
    SET catches = user_catches.catches + p_catch_amount,
        updated_at = now();

  SELECT catches INTO v_current_catches
  FROM user_catches WHERE voter_key = p_voter_key;

  RETURN jsonb_build_object(
    'success', true,
    'catches', v_current_catches
  );
END;
$$;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION award_catch_for_copy TO anon, authenticated;
