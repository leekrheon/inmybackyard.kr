# IMBY — inmybackyard.kr (2026 renewal)

Vite + React + TypeScript · Lenis(쫀득한 스크롤) · GSAP ScrollTrigger · Supabase(`imbykorea`)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

`.env.local` (Git에 올리지 않음)

```
VITE_SUPABASE_URL=https://hvscpwbzarweufskeupt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Vercel 배포 시 같은 두 값을 Project Settings → Environment Variables 에 등록.

## 페이지

| 경로 | 내용 |
|---|---|
| `/` | IN MY BACKYARD → IMBY 접힘 히어로, 단어 점등 스테이트먼트, 손전등 암묵지, Selected Work, 역량, 숫자, 클라이언트, CTA |
| `/about` | 렐러번스 레터, 광고대행사 5세대(가로 스크롤), Bottleneck, 더블 다이아몬드, 2nd Viral, AX 핸드오버, 기록 |
| `/work`, `/work/:slug` | 카테고리 필터 · Grid/Index 전환 · Problem/Insight/Idea/Result 케이스 |
| `/team` | 뒤집히는 명함 카드 |
| `/press` | `news_articles` |
| `/contact` | 프로젝트 문의 (`contact_messages`) |
| `/contact/coffee-chat` | 메뉴 = 대화 주제, 시간표 선택, 영수증 (`coffee_chats`) |
| `/contact/careers` | `openings` |
| `/admin` | 관리자: 문의/커피챗 인박스, Work·Team·Press·Careers CRUD, 이미지 업로드(`site-media` 버킷) |

## 관리자 계정 만들기

1. Supabase 대시보드 → Authentication → Users → **Add user** (이메일 + 비밀번호)
2. SQL Editor 에서 그 이메일을 관리자로 등록

```sql
insert into public.admins (email) values ('you@inmybackyard.kr');
```

3. `/admin` 에서 로그인

## 디자인 규칙 (요약)

- 색: `--ink #0b0b0b` 바탕, `--paper` 글자, `--lawn #c6f23d` 는 한 화면에 한 번만
- 자간 토큰 4개만 사용: display −0.04em / title −0.028em / body −0.012em / label +0.06em
- 서체: Archivo Variable(wdth 축 인터랙션) · Pretendard · Newsreader Italic(포인트)
- 모션: `prefers-reduced-motion` 이면 모든 스크롤 연출 비활성
