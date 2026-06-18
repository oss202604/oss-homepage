-- ============================================================
-- OSS 회원/등급/권한 시스템 (2단계) - Supabase 추가 스키마
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 내용 전체 복붙 → RUN
-- ⚠️ supabase-schema.sql(1단계 applications)을 먼저 실행한 상태여야 합니다.
-- 이 스크립트는 여러 번 실행해도 안전합니다(IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- ============================================================

-- 0) 사서함 코드용 시퀀스 (OSS10001, OSS10002 ...)
create sequence if not exists oss_mailbox_seq start with 10001;

-- ============================================================
-- 1) 회원 프로필 테이블 (auth.users 와 1:1)
-- ============================================================
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,                       -- 로그인 아이디
  name         text,
  phone        text,
  email        text,                              -- 연락용 이메일(가입 시 입력)
  role         text not null default 'member',    -- 'master' | 'manager' | 'member'
  grade        text not null default 'silver',    -- 회원등급: guest/silver/gold/diamond/red/biz
  permissions  jsonb not null default '{}'::jsonb, -- 매니저 세부권한 (마스터가 부여)
  mailbox_code text unique,                        -- 사서함 코드 (OSS+번호)
  deposit      bigint not null default 0,          -- 예치금 (향후)
  points       bigint not null default 0,          -- 적립금 (향후)
  created_at   timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists idx_profiles_role on profiles (role);

-- ============================================================
-- 2) 가입 시 프로필 자동 생성 트리거
--    회원가입(auth.signUp) 때 넘긴 메타데이터(username/name/phone/email)를 반영
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, phone, email, mailbox_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'email', new.email),
    'OSS' || nextval('oss_mailbox_seq')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3) 헬퍼 함수 (RLS·앱에서 공용) — SECURITY DEFINER 로 RLS 우회
-- ============================================================
-- 내 역할
create or replace function public.oss_my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

-- 운영진(마스터 또는 매니저) 여부
create or replace function public.oss_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('master','manager') from public.profiles where id = auth.uid()), false);
$$;

-- 특정 세부권한 보유 여부 (마스터는 항상 true)
create or replace function public.oss_has_perm(key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'master' or coalesce((permissions->>key)::boolean, false)
    from public.profiles where id = auth.uid()
  ), false);
$$;

-- 아이디 존재 여부 (회원가입 중복확인 / 로그인 아이디·비번 구분용) — 비회원도 호출 가능
create or replace function public.oss_username_exists(u text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where lower(username) = lower(u));
$$;

-- 내 주문내역 (로그인 회원: 가입 이메일/전화와 일치하는 신청건)
create or replace function public.oss_my_orders()
returns setof public.applications language sql stable security definer set search_path = public as $$
  select a.* from public.applications a, public.profiles p
  where p.id = auth.uid()
    and (
      (p.email is not null and a.applicant_email = p.email) or
      (p.phone is not null and a.applicant_phone = p.phone)
    )
  order by a.created_at desc;
$$;

-- 내 기본정보 수정 (등급·역할은 못 바꾸게 — 권한상승 방지)
create or replace function public.oss_update_my_profile(p_name text, p_phone text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set name = coalesce(p_name, name),
         phone = coalesce(p_phone, phone),
         email = coalesce(p_email, email)
   where id = auth.uid();
end;
$$;

-- 마지막 로그인 시각 갱신 (로그인 후 앱에서 호출)
create or replace function public.oss_touch_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_login_at = now() where id = auth.uid();
end;
$$;

-- 함수 실행 권한
grant execute on function public.oss_username_exists(text) to anon, authenticated;
grant execute on function public.oss_my_role() to authenticated;
grant execute on function public.oss_is_staff() to authenticated;
grant execute on function public.oss_has_perm(text) to authenticated;
grant execute on function public.oss_my_orders() to authenticated;
grant execute on function public.oss_update_my_profile(text, text, text) to authenticated;
grant execute on function public.oss_touch_login() to authenticated;

-- ============================================================
-- 4) profiles RLS (보안 정책)
-- ============================================================
alter table profiles enable row level security;

-- 본인 또는 운영진은 조회 가능 (회원관리에서 마스터/매니저가 목록 봄)
drop policy if exists "profiles select self or staff" on profiles;
create policy "profiles select self or staff"
  on profiles for select to authenticated
  using (id = auth.uid() or public.oss_is_staff());

-- 수정은 마스터만 (역할/등급/권한 변경). 본인 기본정보는 oss_update_my_profile() RPC로.
drop policy if exists "profiles update master" on profiles;
create policy "profiles update master"
  on profiles for update to authenticated
  using (public.oss_my_role() = 'master')
  with check (public.oss_my_role() = 'master');

-- (insert/delete 직접 정책 없음 → 트리거(가입)와 cascade(탈퇴)로만 처리)

-- ============================================================
-- 5) applications RLS 재설정 — 운영진(staff)만 조회/수정, 삭제는 권한자
--    ⚠️ 비회원 신청(insert)은 그대로 유지됩니다.
-- ============================================================
-- 기존 광범위 정책 제거 (1단계에서 만든 것) + 재실행 대비 새 정책명도 제거
drop policy if exists "admin can read applications"   on applications;
drop policy if exists "admin can update applications" on applications;
drop policy if exists "admin can delete applications" on applications;
drop policy if exists "perm can read applications"    on applications;
drop policy if exists "perm can update applications"  on applications;
drop policy if exists "perm can delete applications"  on applications;

-- 조회: orders_view 권한자(마스터는 항상 통과)
create policy "perm can read applications"
  on applications for select to authenticated
  using (public.oss_has_perm('orders_view'));

-- 수정: orders_edit 권한자
create policy "perm can update applications"
  on applications for update to authenticated
  using (public.oss_has_perm('orders_edit'))
  with check (public.oss_has_perm('orders_edit'));

-- 삭제: orders_delete 권한자
create policy "perm can delete applications"
  on applications for delete to authenticated
  using (public.oss_has_perm('orders_delete'));

-- (참고) "anyone can submit application" insert 정책은 1단계 그대로 유지 — 비회원 신청 가능

-- ============================================================
-- 5-1) 기존 가입자 백필 — 트리거 없이 미리 만들어진 auth.users(= 기존 관리자)
--      이 회원 시스템을 추가하기 "전부터" 있던 계정은 전부 관리자이므로 role='master'로 생성.
--      (이렇게 안 하면 RLS 강화 직후 기존 관리자가 admin 접근을 잃습니다.)
-- ============================================================
insert into public.profiles (id, username, email, role, mailbox_code)
select u.id,
       split_part(u.email, '@', 1),
       u.email,
       'master',
       'OSS' || nextval('oss_mailbox_seq')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ============================================================
-- 6) 마스터 지정 — ✅ 기존 관리자(이 스크립트 실행 전부터 있던 계정)는
--    위 5-1 백필에서 자동으로 role='master' 가 됩니다. 추가 작업 불필요.
--
--    ▶ 나중에 "새로 회원가입한 아이디"를 마스터로 올리고 싶을 때만 아래 실행:
--      update profiles set role = 'master' where username = '여기에_아이디';
--    ▶ 매니저로 올리고 권한을 주려면 관리자페이지 → 회원관리에서 토글.
-- ============================================================

-- 끝! Table Editor에서 profiles 테이블이 보이면 성공.
