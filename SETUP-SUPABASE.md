# 🌐 Supabase 가입 & 연결 가이드 (컴맹용 ─ 천천히 따라하기)

> Supabase = 무료 데이터베이스 + 로그인 서버.
> 이거 연결하면 신청서가 진짜로 저장되고, 관리자 페이지에서 볼 수 있어요.
> **돌아오셔서 이 문서 보면서 같이 하면 돼요. 5~10분이면 끝.**

---

## STEP 1. 가입하기

1. 브라우저에서 **https://supabase.com** 접속
2. 우측 상단 **Start your project** (초록 버튼) 클릭
3. **Sign in with GitHub** 또는 이메일로 가입
   - GitHub 계정 있으면 그게 제일 빠름 (이미 oss202604 깃허브 있으시죠)

## STEP 2. 새 프로젝트 만들기

1. **New project** 클릭
2. 입력:
   - **Name**: `oss-homepage` (아무거나 OK)
   - **Database Password**: 아무 비번 입력 → ⚠️ **메모장에 적어두세요** (나중에 필요할 수 있음)
   - **Region**: `Northeast Asia (Seoul)` 선택 (한국이라 제일 빠름)
3. **Create new project** 클릭
4. 1~2분 기다리면 프로젝트 준비 완료 ⏳

## STEP 3. 데이터베이스 표(테이블) 만들기

1. 왼쪽 메뉴에서 **SQL Editor** (</> 아이콘) 클릭
2. **New query** 클릭
3. 같은 폴더에 있는 **`supabase-schema.sql`** 파일 내용을 전부 복사
4. SQL Editor 칸에 붙여넣기
5. 우측 아래 **RUN** (또는 Ctrl+Enter) 클릭
6. "Success" 뜨면 성공 ✅

## STEP 4. 관리자 계정 만들기

1. 왼쪽 메뉴 **Authentication** → **Users**
2. **Add user** → **Create new user**
3. 입력:
   - **Email**: 관리자용 이메일 (예: oss202604@gmail.com)
   - **Password**: 관리자 로그인 비번 → ⚠️ **메모해두세요**
   - **Auto Confirm User**: ✅ 체크 (메일 인증 건너뛰기)
4. **Create user** 클릭

## STEP 5. 연결 키 2개 복사해서 Claude에게 주기 ⭐ 제일 중요

1. 왼쪽 메뉴 맨 아래 **Project Settings** (⚙️) → **API** (또는 **Data API**)
2. 여기서 **2가지**를 복사해서 저(Claude)에게 채팅으로 붙여넣어 주세요:

   | 항목 | 어디에 있나 | 예시 모양 |
   |---|---|---|
   | **Project URL** | "Project URL" 칸 | `https://abcdxyz.supabase.co` |
   | **anon public key** | "Project API keys" → `anon` `public` | `eyJhbGc...` (엄청 긴 글자) |

> ✅ 이 두 개는 **공개되어도 안전한 키**예요 (웹사이트에 넣는 용도).
> ❌ `service_role` 키는 **절대 주지 마세요** (관리자 전체 권한 ─ 위험).

---

## ✅ 다 하면 저한테 이렇게 주세요

```
URL: https://여기붙여넣기.supabase.co
KEY: eyJ여기긴키붙여넣기...
관리자 이메일: oss202604@gmail.com
```

그러면 제가 `supabase.js` 만들어서:
1. 신청서 → DB 자동 저장
2. 관리자 로그인 → /admin 접속
3. 관리자가 신청 목록 보고 상태 변경

이걸 다 연결해 드릴게요. 🚀
