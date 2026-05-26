-- =============================================
-- user_profiles 테이블 (관리자 + 나중에 일반 사용자 OAuth 연동용)
-- =============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 읽기/수정 가능
CREATE POLICY "profile_select" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "profile_insert" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profile_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- 관리자 초기 프로필 생성
-- (Supabase Authentication > Users에서 관리자 user id 확인 후 실행)
-- =============================================
-- SELECT id FROM auth.users WHERE email = 'admin@catchcopy.kr';
-- INSERT INTO user_profiles (id, name) VALUES ('여기에_user_id_붙여넣기', '관리자')
-- ON CONFLICT (id) DO UPDATE SET name = '관리자';

-- =============================================
-- 불필요한 임시 테이블 정리 (선택사항)
-- 아래 주석 해제 후 실행
-- =============================================
-- DROP TABLE IF EXISTS admin_sessions;
-- DROP TABLE IF EXISTS admin_accounts;
