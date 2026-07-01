# IMBY Website Setup Guide

## 1. Supabase 관리자 계정 등록

Supabase 대시보드 → Authentication → Users → **Add user** 클릭  
- Email: `support@inmybackyard.kr`  
- Password: (원하는 비밀번호 설정)  
- ✅ "Auto Confirm User" 체크

또는 Supabase SQL Editor에서:
```sql
-- 아래 명령은 Supabase Dashboard > SQL Editor에서 실행
select * from auth.users where email = 'support@inmybackyard.kr';
```

## 2. 환경변수 설정

### 로컬 개발
`.env` 파일이 이미 포함되어 있습니다.

### Vercel 배포
Vercel 대시보드 → Project Settings → Environment Variables에 추가:
- `VITE_SUPABASE_URL` = `https://caozfgfbnxsdzuuioulm.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (anon key)

## 3. GitHub 업로드 시 주의사항

`.gitignore`에 `.env`가 포함되어 있으므로 실제 키는 업로드되지 않습니다.  
Vercel 환경변수에 별도 등록 필요.

## 4. 관리자 로그인 방법

인트로 화면에서 **IMBY 로고를 3번 클릭** → 로그인 모달 출현  
Supabase에 등록한 이메일/비밀번호로 로그인

## 5. 배포 명령
```bash
npm install
npm run build
# 또는 Vercel에 연결하면 자동 빌드
```
