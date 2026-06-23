---
name: release
description: OSS 사이트 변경을 마무리해 반영한다 — 바뀐 공통자산(script.js·styles.css·supabase.js)의 캐시버전 ?v 를 올리고, 로컬 preview로 콘솔 검증하고, 한국어 메시지로 커밋·main 푸시까지. 사용자가 "반영/커밋/푸시/올려줘/배포준비"라고 하거나 한 묶음의 수정을 끝내 마무리할 때 사용.
---

# OSS 사이트 반영(release) 워크플로우

정적 사이트(빌드 없음) + Supabase + GitHub `main`. 한 묶음의 변경을 끝낸 뒤 이 순서로 마무리한다.

## 1) 무엇이 바뀌었나
`git status --short` 로 변경 파일 확인. 공통자산(`script.js`·`styles.css`·`supabase.js`)이 바뀌었으면 **캐시버전(?v)** 을 올려야 브라우저가 새 파일을 받는다. (HTML 내용·인라인 스크립트 변경은 ?v 불필요 — HTML엔 캐시버전이 없다.)

## 2) 캐시버전 올리기 (바뀐 자산만)
현재 버전 확인:
```bash
grep -ohE '(script\.js|styles\.css|supabase\.js)\?v=[0-9]+' *.html | sort | uniq -c
```
바뀐 자산만 전체 *.html에서 +1 (예: script.js v34→v35):
```bash
sed -i 's/script\.js?v=34/script.js?v=35/g' *.html
```
- `styles.css`·`supabase.js`도 같은 방식으로 해당 버전만 +1.
- order-quick.html·delivery-quick.html은 일부 자산을 안 쓸 수 있으니 위 grep 개수로 확인(보통 script.js 14개·styles.css 16개).

## 3) preview 검증 (⚠️ 스크린샷 금지 — 이 환경에서 타임아웃)
- `preview_eval`로 바뀐 페이지를 열어 의도대로인지 DOM/계산값 확인.
- `preview_console_logs`(level: error)로 **콘솔 에러 0** 확인.
- `preview_screenshot`은 타임아웃 → 반드시 `preview_eval`/`preview_inspect`/`preview_snapshot` 사용.
- serverId는 세션마다 `preview_list`로 확인(없으면 `preview_start`, 보통 포트 5501).

## 4) 커밋 · 푸시
한국어 한 줄 요약(+필요시 본문). 끝에 반드시 trailer:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
```bash
git add -A && git commit -m "한국어 요약" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```
이 프로젝트는 **main 직접 푸시 OK**.

## 5) 설정·콘텐츠 변경이면 (코드와 별개)
Supabase `settings`/`pages`/`notices`는 `execute_sql`(project `wmgzggeklwzhrlmpuifh`)로 반영. 코드 커밋과 별개.

## 끝나면
사용자에게 **"무엇을 반영했는지 + 검증결과(콘솔 0) + 커밋해시"** 한두 줄로 보고.

## 주의
- 프로덕션 DB·실데이터(농협계좌·배대지주소 등)는 **지어내기 금지**, 사장님 확인 후.
- Supabase "Confirm email"은 **OFF 유지**(켜면 회원가입 막힘).
- 큰 작업은 멀티에이전트 루프(아키텍트↔크리틱↔플래너) 후 이 release로 마무리.
