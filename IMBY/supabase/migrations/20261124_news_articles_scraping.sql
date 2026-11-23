-- Press: 기사 URL만 넣으면 제목·요약·대표 이미지를 자동으로 채우고, 사람이 고칠 수 있게
alter table public.news_articles
  add column if not exists scraped_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- 같은 기사가 두 번 들어가지 않게
create unique index if not exists news_articles_url_key on public.news_articles (url);

-- http(s) 주소만 허용
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'news_articles_url_http') then
    alter table public.news_articles add constraint news_articles_url_http check (url ~* '^https?://');
  end if;
end $$;

-- 최신 기사 정렬용
create index if not exists news_articles_published_idx on public.news_articles (published, published_at desc, created_at desc);

-- 수정 시각 자동 갱신
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists news_articles_touch on public.news_articles;
create trigger news_articles_touch before update on public.news_articles
  for each row execute function public.touch_updated_at();

-- RLS (기존): 공개된 기사만 누구나 읽기, 관리자만 쓰기
--   "read published news"  select using (published or is_admin())
--   "admin manage news"    all    using (is_admin()) with check (is_admin())
