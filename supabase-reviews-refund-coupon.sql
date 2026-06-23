-- ============================================================
-- OSS 추가 기능 마이그레이션 (2026-06)
--  ① 후기 사진/수정  ② 환불계좌  ③ 쿠폰 1차→2차 자동할인
-- Supabase SQL Editor에 그대로 붙여넣고 Run 하면 됩니다.
-- (이미 MCP로 적용 완료 — 이 파일은 기록·재현용)
-- ============================================================

-- ── ① 후기: 사진 + 수정시각 ──
alter table public.reviews add column if not exists image_url text;
alter table public.reviews add column if not exists updated_at timestamptz;

-- 회원 본인 후기 수정 RPC (수정하면 다시 승인대기로)
create or replace function public.oss_update_my_review(p_id bigint, p_rating int, p_body text, p_image_url text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.reviews set
    rating = greatest(1, least(5, coalesce(p_rating, rating))),
    body = coalesce(p_body, body),
    image_url = p_image_url,           -- null이면 사진 삭제
    status = 'pending',                -- 수정하면 재승인 대기
    approved_at = null,
    updated_at = now()
  where id = p_id and user_id = auth.uid();
end;
$$;
grant execute on function public.oss_update_my_review(bigint, int, text, text) to authenticated;

-- ── ② 환불계좌: profiles 컬럼 + 본인수정 RPC ──
alter table public.profiles add column if not exists refund_bank text;
alter table public.profiles add column if not exists refund_account text;
alter table public.profiles add column if not exists refund_holder text;

create or replace function public.oss_update_my_refund(p_bank text, p_account text, p_holder text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.profiles set
    refund_bank = p_bank,
    refund_account = p_account,
    refund_holder = p_holder
  where id = auth.uid();
end;
$$;
grant execute on function public.oss_update_my_refund(text, text, text) to authenticated;

-- ── ③ 쿠폰 1차→2차: applications에 쿠폰 연결 + 예약 RPC ──
alter table public.applications add column if not exists coupon_id bigint;
alter table public.applications add column if not exists coupon_amount integer;

-- 회원이 주문 시 본인 활성쿠폰을 그 주문에 예약(reserved). 정산 때 사장님이 최종 used 처리.
-- (2026-06-23 갱신) used_at = now() 도 기록 → 사장님이 관리자 2차 배송비칸에서 "사용신청일" 확인 가능
create or replace function public.oss_reserve_coupon(p_coupon_id bigint, p_order_no text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_amount integer;
begin
  update public.coupons set
    status = 'reserved',
    used_order_no = p_order_no,
    used_at = now()
  where id = p_coupon_id
    and user_id = auth.uid()
    and status = 'active'
    and (expires_at is null or expires_at > now())
  returning amount into v_amount;
  return coalesce(v_amount, 0);
end;
$$;
grant execute on function public.oss_reserve_coupon(bigint, text) to authenticated;

-- 2차 결제(배송비) 자동 쿠폰할인 표시를 위해 조회 RPC에 배송비·무게·쿠폰 추가
drop function if exists public.lookup_order(text, text);
create function public.lookup_order(p_order_no text, p_phone text)
returns table(order_no text, status text, type text, created_at timestamptz, subtotal bigint, shipping_fee bigint, weight_kg numeric, coupon_amount integer)
language sql
security definer
set search_path to 'public'
as $$
  select a.order_no, a.status, a.type, a.created_at, a.subtotal, a.shipping_fee, a.weight_kg, a.coupon_amount
  from applications a
  where a.order_no = p_order_no and a.applicant_phone = p_phone
$$;
grant execute on function public.lookup_order(text, text) to anon, authenticated;
