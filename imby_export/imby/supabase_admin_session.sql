-- =============================================
-- 관리자 세션 테이블 생성
-- =============================================

-- 관리자 계정 테이블
CREATE TABLE IF NOT EXISTS admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no_direct_access" ON admin_accounts;
CREATE POLICY "no_direct_access" ON admin_accounts FOR ALL USING (false);

-- 관리자 세션 테이블 (무기한)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '100 years'),
  is_active boolean DEFAULT true
);
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "token_verify" ON admin_sessions;
DROP POLICY IF EXISTS "no_client_insert" ON admin_sessions;
DROP POLICY IF EXISTS "no_client_update" ON admin_sessions;
CREATE POLICY "token_verify" ON admin_sessions FOR SELECT USING (true);
CREATE POLICY "no_client_insert" ON admin_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "no_client_update" ON admin_sessions FOR UPDATE USING (false);

-- =============================================
-- 관리자 비밀번호 등록 (catchthecopy1!)
-- =============================================
DELETE FROM admin_accounts;
INSERT INTO admin_accounts (password_hash)
VALUES ('6ebe87ef03ae04e18eeae1906904f2f16c1b1fce20f0974d70a778ce7dca3658');
