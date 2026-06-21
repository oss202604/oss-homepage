# OSS(オッス) 구매대행 사이트

일본 현지인이 직접 운영하는 구매대행 · 배송대행지 서비스 홈페이지.

## 기술 스택

- **프론트엔드**: 순수 HTML + CSS + Vanilla JavaScript (빌드 도구 없음, 정적 파일)
- **백엔드/DB**: Supabase (회원, 주문, 배송, 공지)
- **결제**: 미정 (PG사 추후 연동 — `payment.html`에 자리만 비워둠)
- **호스팅**: 미정 (GitHub Pages / Netlify / Vercel 후보)

## 폴더 구조

```
oss-homepage/
├── index.html          메인 페이지
├── login.html          로그인
├── signup.html         회원가입
├── order.html          구매대행 신청
├── delivery.html       배송대행 신청
├── mypage.html         마이페이지 (내 주문/배송 조회)
├── payment.html        결제 페이지 (PG사 연동 자리)
├── notice.html         공지사항
├── faq.html            자주 묻는 질문
├── contact.html        1:1 문의
├── admin.html          관리자 대시보드
├── admin-users.html    회원 관리
├── admin-orders.html   주문 관리
├── admin-notice.html   공지사항 관리
├── styles.css          전체 스타일
├── script.js           공통 자바스크립트
└── supabase.js         Supabase 클라이언트 (DB 연결)
```

## 디자인 규칙

- **메인 컬러**: 노란색(#ffd400) + 네이비(#1b2330) + 블루(#2f6df6)
- **폰트**: Noto Sans KR (Google Fonts)
- **공통 레이아웃**: 모든 페이지가 동일한 상단 유틸바 + 노란 헤더 + 검은 메뉴바 + 푸터 + 우측 퀵메뉴 구조
- **새 페이지 추가 시**: 기존 페이지의 헤더/푸터를 그대로 복사해서 사용 (변경 시 모든 파일 동시 수정 필요)

## 권한 구분

- **비회원**: 메인/공지/FAQ 열람만
- **회원**: + 구매대행/배송대행 신청, 마이페이지, 결제
- **관리자(admin)**: + `/admin*` 페이지 (회원/주문/공지 관리)
  - 관리자 판별: Supabase `profiles` 테이블의 `role`(`master`/`manager`) + 세부권한 `permissions` jsonb. RLS는 `oss_is_staff()`(master·manager)와 `oss_has_perm(키)`(master는 전권)로 강제. (구식 `role='admin'`은 더 이상 사용 안 함)

## 작업 원칙

- 사용자는 컴맹이므로 코드/명령어 직접 수정 요청은 최소화. 작업은 Claude가 하고 사용자는 결과 확인만.
- Supabase 가입/키 발급 등 사용자가 직접 해야 하는 작업은 단계별 스크린샷 가이드처럼 친절히 설명.
- 디자인은 우선 뼈대만, 기능 동작이 우선.
- PG사 결제 부분은 빈 자리만 두고 진행 (TODO 주석으로 명확히 표시).
