-- 클라이언트 로고: 관리자 화면에서 추가·정렬·숨김. Work 상단 3D 픽셀 로고 줄과 홈 클라이언트 섹션에 쓰인다.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,          -- 흰색 로고(SVG 권장, 배경 투명)
  link text,                       -- 클릭 시 이동할 작업 페이지(/work/slug) 또는 외부 URL
  sort_order int not null default 99,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_order_idx on public.clients (published, sort_order);

alter table public.clients enable row level security;
drop policy if exists "read published clients" on public.clients;
create policy "read published clients" on public.clients for select using (published or public.is_admin());
drop policy if exists "admin manage clients" on public.clients;
create policy "admin manage clients" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

insert into public.clients (name, logo_url, link, sort_order)
select * from (values
  ('흑백개발자 THE 해커톤', '/brand/clients/hackathon-white.svg', '/work/the-hackathon', 1),
  ('Narrative', '/brand/clients/narrative-white.svg', '/work/narrative-seongsu-ooh', 2),
  ('THE ZONE BIO', '/brand/clients/thezonebio-white.svg', '/work/lockin-coffee', 3),
  ('Tiro', '/brand/clients/tiro-white.svg', '/work/tiro-sagwan', 4)
) v(name, logo_url, link, sort_order)
where not exists (select 1 from public.clients);
