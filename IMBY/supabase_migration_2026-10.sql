-- ═══════════════════════════════════════════════════════════════════════════
-- IMBY 리뉴얼 추가 SQL (2026-10)
-- Supabase → SQL Editor → 새 쿼리 → 전체 붙여넣고 한 번 실행하세요.
-- 여러 번 실행해도 안전해요(if not exists).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Work 상세/목록용 새 칸
alter table public.projects add column if not exists hover_logo text;                         -- 호버 시 뜨는 PNG
alter table public.projects add column if not exists client     text not null default '';    -- 클라이언트
alter table public.projects add column if not exists brand      text not null default '';    -- 브랜드
alter table public.projects add column if not exists credit     text not null default '';    -- 크레딧

-- (이미 실행하셨다면 건너뛰어도 되는 줄)
alter table public.projects add column if not exists hero_focal text not null default 'center';

-- 2) 목록 정렬 속도용 인덱스
create index if not exists projects_order_idx on public.projects (order_index);
create index if not exists articles_sort_order_idx on public.articles (sort_order);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
