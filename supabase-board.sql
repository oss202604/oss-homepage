-- ============================================================
-- OSS 커뮤니티 게시판 (board_posts)  *재실행해도 안전(idempotent)*
-- 실행: Supabase → SQL Editor → 아래 전체 복사·붙여넣기 → Run
-- ============================================================

-- 1) 테이블
create table if not exists public.board_posts (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete set null,
  board         text not null,
  title         text not null,
  content       text,
  photos        jsonb default '[]'::jsonb,
  visibility    text not null default 'public',
  status        text not null default 'pending',
  author_display text,
  order_no      text,
  phone         text,                 -- 1:1·사업자 연락처
  inquiry_type  text,                 -- 1:1 문의 유형
  admin_reply   text,
  replied_at    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2) 기존 테이블에 누락 컬럼 보강(이미 만들어둔 경우)
alter table public.board_posts add column if not exists phone        text;
alter table public.board_posts add column if not exists inquiry_type text;
alter table public.board_posts add column if not exists order_no     text;

-- 3) CHECK 제약 (board 4종 / visibility 2종 / status 4종)
alter table public.board_posts drop constraint if exists board_posts_board_check;
alter table public.board_posts add constraint board_posts_board_check
  check (board in ('review','grade','biz','contact'));
alter table public.board_posts drop constraint if exists board_posts_visibility_check;
alter table public.board_posts add constraint board_posts_visibility_check
  check (visibility in ('public','private'));
alter table public.board_posts drop constraint if exists board_posts_status_check;
alter table public.board_posts add constraint board_posts_status_check
  check (status in ('pending','approved','rejected','deleted'));

-- 4) RLS
alter table public.board_posts enable row level security;

-- 공개 글(승인+전체공개)은 누구나 읽기
drop policy if exists "board_posts_read_public" on public.board_posts;
create policy "board_posts_read_public" on public.board_posts
  for select using (status = 'approved' and visibility = 'public');

-- 로그인 사용자는 자기 글(비밀글 포함) 읽기
drop policy if exists "board_posts_read_own" on public.board_posts;
create policy "board_posts_read_own" on public.board_posts
  for select using (auth.uid() = user_id);

-- 관리자(master/manager)는 전체 읽기
drop policy if exists "board_posts_read_staff" on public.board_posts;
create policy "board_posts_read_staff" on public.board_posts
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('master','manager'))
  );

-- 로그인 사용자: 자기 글 작성
drop policy if exists "board_posts_insert_auth" on public.board_posts;
create policy "board_posts_insert_auth" on public.board_posts
  for insert with check (auth.uid() is not null and auth.uid() = user_id);

-- 관리자: 답변·상태·삭제 수정
drop policy if exists "board_posts_update_staff" on public.board_posts;
create policy "board_posts_update_staff" on public.board_posts
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('master','manager'))
  );

-- 작성자: 자기 글만 수정(남의 글 수정 불가). 소유권 변경 차단(with check).
drop policy if exists "board_posts_update_own" on public.board_posts;
create policy "board_posts_update_own" on public.board_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) 이미지 Storage 버킷
insert into storage.buckets (id, name, public)
values ('board-images', 'board-images', true)
on conflict (id) do nothing;

drop policy if exists "board_images_upload" on storage.objects;
create policy "board_images_upload" on storage.objects
  for insert with check (bucket_id = 'board-images' and auth.uid() is not null);

drop policy if exists "board_images_read" on storage.objects;
create policy "board_images_read" on storage.objects
  for select using (bucket_id = 'board-images');
