-- ============================================================
-- OSS 오픈 전 보안 수정 SQL  (보안감사 2026-06-29 결과)
-- 실행법: Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run ▶
-- 한 번만 실행하면 됩니다. "Success. No rows returned" 뜨면 완료.
-- (Claude는 프로덕션 DB 직접변경이 막혀 있어 사장님이 1회 실행)
-- ============================================================

-- 🔴1 [치명] PII 누수 차단 ----------------------------------------
-- 문제: 회원이 자기 프로필 전화번호를 '피해자 번호'로 바꾸면, 주문조회가
--       전화번호 문자열로 매칭해 피해자의 전 주문(이름·통관부호·주소)을 반환.
-- 수정: 주문↔회원 연결을 전화/이메일 → '계정ID(user_id)' 기준으로 교체.
-- 참고: 기존 비회원 접수분(user_id 없음)은 마이페이지 대신 '주문조회(주문번호+전화)'로 확인.
create or replace function public.oss_my_orders()
returns setof public.applications
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.*
  from public.applications a
  where a.user_id = auth.uid()
  order by a.created_at desc;
$$;

-- 🔴2 [치명] 게시판 위조글 차단 ----------------------------------
-- 문제: 게시판 글쓰기 권한이 'user_id'를 강제하지 않아, 남의 명의/위조 글
--       (저장형 XSS 페이로드 포함) 작성 가능 → 사장님이 검토 시 계정 탈취 위험.
-- 수정: 글 작성 시 본인 계정(user_id=auth.uid())만 허용(후기와 동일 패턴).
drop policy if exists board_posts_insert on public.board_posts;
create policy board_posts_insert on public.board_posts
  for insert to authenticated
  with check (user_id = auth.uid());

-- 🟠 [하드닝] 배너 업로드 직원 전용 잠금 -------------------------
-- 문제: 현재 이미지 업로드가 비로그인(anon)에 열려 있고 경로 제한이 없어
--       누구나 banner/ 경로(홈 배너 영역)에 업로드 가능.
-- 수정: 일반 업로드는 상품사진(p/)만, 배너(banner/)는 직원만.
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'product-images' and name like 'p/%');

drop policy if exists product_images_banner_insert on storage.objects;
create policy product_images_banner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and name like 'banner/%' and public.oss_is_staff());

-- ============================================================
-- ※ 아래는 SQL이 아니라 '대시보드 설정' 또는 '정책 결정'이 필요한 항목 (참고)
--
-- [사장님 대시보드 클릭]
--  · 유출 비밀번호 차단(HIBP): Authentication → Policies → "Leaked password protection" ON
--  · 비밀번호 변경 재인증: Authentication → "Secure password change" ON
--
-- [정책 결정 후 Claude가 처리]
--  · 비회원 주문 INSERT(anon 개방)·주문금액 클라이언트 신뢰 → 서버검증(엣지함수)
--    : 무통장·수기정산이라 즉시 돈유출은 아니나, 위조 금액/스팸주문 주의.
--  · 주문번호 4자 → 9~12자 확대 + 조회 레이트리밋
--  · 모바일 관리자 상태변경 status_dates 기록 / 입금계좌 settings 연동
-- ============================================================
