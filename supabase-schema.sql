-- ============================================================
-- OSS 구매대행 사이트 - Supabase 데이터베이스 설계 (1단계 MVP)
-- 사용법: Supabase 대시보드 → 좌측 메뉴 "SQL Editor" → 이 내용 전체 복사 붙여넣기 → RUN
-- ============================================================

-- 1) 신청 테이블 (구매대행 + 배송대행 통합)
create table if not exists applications (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  type         text not null,              -- 'purchase'(구매대행) | 'delivery'(배송대행)
  status       text not null default '신규접수',
                                           -- 신규접수 / 구매중 / 입고완료 / 배송중 / 완료 / 보류
  center_type  text,                       -- 'air'(항공) | 'sea'(해상)

  -- 신청자 정보
  applicant_name   text not null,
  applicant_phone  text not null,
  applicant_email  text,
  applicant_kakao  text,

  -- 수취인(배송지) 정보
  receiver_name    text,
  receiver_phone   text,
  receiver_phone2  text,
  customs_code     text,                   -- 개인통관고유부호
  zipcode          text,
  ship_method      text,
  address          text,
  courier_memo     text,

  -- 상품 / 옵션 (목록 형태로 통째 저장)
  products     jsonb not null default '[]'::jsonb,
  inspect      text,                       -- 검수 옵션
  addons       jsonb default '[]'::jsonb,  -- 부가서비스 체크 목록
  subtotal     bigint default 0,           -- 합계(엔)

  -- 기타
  due_date     text,                       -- 희망 수령 시기
  memo         text,                       -- 기타 요청사항
  admin_memo   text                        -- 관리자 전용 메모
);

-- 최신순 조회 빠르게
create index if not exists idx_applications_created on applications (created_at desc);
create index if not exists idx_applications_status  on applications (status);

-- ============================================================
-- 2) 보안 정책 (RLS) - 누가 무엇을 할 수 있는가
-- ============================================================
alter table applications enable row level security;

-- (A) 누구나(비회원 포함) 신청서 "등록"은 가능
create policy "anyone can submit application"
  on applications for insert
  to anon, authenticated
  with check (true);

-- (B) 로그인한 관리자만 "조회" 가능
create policy "admin can read applications"
  on applications for select
  to authenticated
  using (true);

-- (C) 로그인한 관리자만 "수정"(상태 변경 등) 가능
create policy "admin can update applications"
  on applications for update
  to authenticated
  using (true)
  with check (true);

-- (D) 로그인한 관리자만 "삭제" 가능
create policy "admin can delete applications"
  on applications for delete
  to authenticated
  using (true);

-- ============================================================
-- 3) 관리자 계정 만들기 (SQL 아님 - 대시보드에서)
--    Supabase 대시보드 → Authentication → Users → "Add user"
--    이메일/비번으로 관리자 1명 추가 → 그 계정으로 /admin 로그인
-- ============================================================

-- 끝! 이제 "Table Editor"에서 applications 테이블이 보이면 성공.
