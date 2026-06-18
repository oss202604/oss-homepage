-- ============================================================
-- OSS 통합 1단계 — applications 테이블 확장
-- 목적: 주문이 어디서 왔는지(채널/소스) 저장 + 사장님 폰앱(주문도우미) 통합 대비 컬럼
-- 안전: 전부 "컬럼 추가"만 → 기존 데이터/사이트/관리자 그대로 작동 (IF NOT EXISTS 라 여러 번 실행해도 OK)
-- 실행: Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣기 → Run
-- ============================================================

-- 주문 출처 / 채널 (간편주문 링크가 ?c=insta 등으로 채워줌)
alter table public.applications add column if not exists source  text;            -- web | sns | manual
alter table public.applications add column if not exists channel text;            -- 인스타그램 | 카카오톡 | 스레드 | 홈페이지 | 메루카리 ...

-- 사장님(주문도우미) 통합용 — 지금은 비어 있어도 됨 (3~4단계에서 사용)
alter table public.applications add column if not exists buy_from        text;     -- 사입처
alter table public.applications add column if not exists buy_yen         bigint;   -- 사입가(¥)
alter table public.applications add column if not exists sell_krw        bigint;   -- 판매가(₩)
alter table public.applications add column if not exists settle_krw      bigint;   -- 정산가(₩)
alter table public.applications add column if not exists ship_extra_krw  bigint;   -- 배송비 추가금(₩)
alter table public.applications add column if not exists pay_card        text;     -- 사입 결제수단
alter table public.applications add column if not exists pay_date        text;     -- 사입 날짜(MMDD)
alter table public.applications add column if not exists settled         text;     -- 미정산 | 정산
alter table public.applications add column if not exists invoice         text;     -- 인보이스 | 영수증
alter table public.applications add column if not exists owner_status    text;     -- 폰앱 원본 상태(이전용)
alter table public.applications add column if not exists pwa_id          text;     -- 폰앱 기존주문 1회 이전 시 중복방지 키

-- 조회 속도(채널별 통계용)
create index if not exists idx_applications_channel on public.applications (channel);
create index if not exists idx_applications_source  on public.applications (source);

-- 확인용: 잘 들어갔는지 보고 싶으면 아래 한 줄을 따로 실행
-- select column_name from information_schema.columns where table_name='applications' order by ordinal_position;
