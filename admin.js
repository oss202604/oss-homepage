/* ============================================================
   OSS 관리자 로직 (Supabase 연동판)
   - 로그인된 관리자만 접근
   - applications 테이블 실시간 조회 / 칸반 상태변경
   ============================================================ */

// 상태 정의 (key = DB에 저장되는 값, label = 화면 표시)
const NORMAL = [
  { key: "신규접수", label: "신규접수" },
  { key: "결제대기", label: "결제대기" },
  { key: "구매중",   label: "구매중" },
  { key: "입고완료", label: "입고완료" },
  { key: "포장/측정", label: "포장/측정" },
  { key: "배송중",   label: "배송중" },
  { key: "배송완료", label: "배송완료" },
];
const EXCEPTION = [
  { key: "보류",     label: "보류" },
  { key: "취소",     label: "취소" },
  { key: "반품/교환", label: "반품/교환" },
  { key: "사고/폐기", label: "사고/폐기" },
  { key: "일부입고", label: "일부입고" },
];
const ALL_STATUS = [...NORMAL, ...EXCEPTION];
const labelOf = (k) => (ALL_STATUS.find((s) => s.key === k) || {}).label || k;

// 배송비 요율표 (관리자 설정에서 로드, 단위 엔). 행: {kg: 무게이하, air, sea}
let RATES = [];
let FX_APPLIED = 1000; // 적용환율(100엔당 원). exchange_rate.applied. ¥→₩ 변환(perJpy = applied/100). 계산기와 동일

// HTML 이스케이프(저장형 XSS 방지) + 안전 URL 가드 — 고객 입력을 관리자 화면에 렌더할 때 사용
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function safeUrl(u) { u = String(u == null ? "" : u).trim(); if (!/^https?:\/\//i.test(u)) return ""; return u.replace(/["'<>]/g, encodeURIComponent); }

// CSV 한 칸 (한글/콤마/줄바꿈/따옴표 안전 + CSV Injection 가드: =,+,-,@ 로 시작하면 ' 프리픽스)
function csvCell(v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
function downloadCsv(filename, rows) {
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" }); // BOM: 엑셀 한글 안 깨짐
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
// UTC ISO → 사장님 PC(한국시간) 기준 날짜 YYYY-MM-DD (월말 새벽/막차 주문 오집계 방지)
function toLocalYmd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

// 정산·대시보드·표뷰·배너 공용 전역
const perJpy = () => FX_APPLIED / 100;   // ¥1 → ₩ (계산기·요율과 동일 환율)
let COMMISSION_PCT = 3;                   // 구매대행 수수료% (loadFx에서 설정값으로 덮어씀)
let DELAY_DAYS = 7;                       // 지연 경보 기준일 (fee_policy.delayDays로 조정)
const TYPE_LABEL = { all: "전체", purchase: "구매대행", delivery: "배송대행" };
let VIEW = "kanban";                      // 주문관리 보기 (kanban|table)
let SORT = { key: "created", dir: -1 };   // 표뷰 정렬 (기본 등록일 최신순)
let SETTLE_ROWS = null;                   // 정산 첫 진입 자동집계 판단 + CSV 대상
let SETTLE_META = null;                   // 마지막 정산 조건 (CSV 파일명·합계)
let BANNERS = [];                         // 메인 배너 목록
// 사토리 기본요율(항공 실측값, 해상은 동일값으로 두고 관리자가 조정) — "기본요율 불러오기"용
const DEFAULT_RATES = [
  [0.5,1000,1000],[1,1150,1150],[1.5,1300,1300],[2,1450,1450],[2.5,1600,1600],
  [3,1750,1750],[3.5,1900,1900],[4,2050,2050],[4.5,2200,2200],[5,2350,2350],
  [6,2650,2650],[7,2950,2950],[8,3250,3250],[9,3550,3550],[10,3850,3850],
  [12,4850,4850],[15,6350,6350],[17,7550,7550],[20,9350,9350],
  [25,11850,11850],[30,14350,14350],[35,16850,16850],[40,19350,19350],
].map(([kg, air, sea]) => ({ kg, air, sea }));

function calcShippingFee(weightKg, center) {
  const w = Number(weightKg);
  if (!w || w <= 0) return 0;
  if (RATES && RATES.length) {
    const sorted = [...RATES].sort((a, b) => a.kg - b.kg);
    const row = sorted.find((r) => w <= Number(r.kg)) || sorted[sorted.length - 1];
    const yen = Number(center === "sea" ? row.sea : row.air) || 0;
    return Math.round(yen * (FX_APPLIED / 100)); // ¥ → ₩ (계산기와 동일 환율)
  }
  return 0; // 요율 미설정
}

// 회원등급 → 배송비 할인 (주문 자동 할인). profile.grade(silver…) → member_grades 매핑
function gradeInfo(gradeKey) {
  if (!gradeKey || gradeKey === "guest") return null;
  const map = { silver: "실버", gold: "골드", diamond: "다이아", red: "레드" };
  const name = map[gradeKey] || gradeKey;
  const g = (typeof MGRADES !== "undefined" && Array.isArray(MGRADES) ? MGRADES : []).find((x) => x.name === name);
  return g ? { name: g.name, pct: Number(g.discountPct) || 0 } : null;
}
function gradeLabel(gradeKey) {
  if (!gradeKey) return "비회원 / 일반";
  if (gradeKey === "guest") return "일반 회원 (할인 없음)";
  const gi = gradeInfo(gradeKey);
  return gi ? (gi.pct ? `${gi.name} · 배송비 ${gi.pct}% 할인` : gi.name) : gradeKey;
}

let ORDERS = [];

// ----- DB 행 → 카드 형태로 변환 -----
function mapRow(row) {
  const products = Array.isArray(row.products) ? row.products : [];
  const first = products[0] || {};
  const name = products.length > 1
    ? `${first.name || "상품"} 외 ${products.length - 1}건`
    : (first.name || "(상품 정보 없음)");
  return {
    id: String(row.id),
    no: row.order_no || ("#" + row.id),
    bundleId: row.bundle_id || null,
    bundleRequested: !!row.bundle_requested,
    type: row.type,
    name: name,
    customer: row.applicant_name || "-",
    amount: row.subtotal || 0,
    status: row.status || "신규접수",
    created: (row.created_at || "").slice(0, 10),
    created_local: toLocalYmd(row.created_at),
    flag: row.flag || "",
    deleted: !!row.deleted_at,
    raw: row,
  };
}

// ----- 로그인 가드 + 권한 + 초기 로드 -----
let MY = null;
function can(key) {
  return !!(MY && (MY.role === "master" || (MY.permissions && MY.permissions[key])));
}
function hideNav(page) {
  const btn = document.querySelector('.admin-nav button[data-page="' + page + '"]');
  if (btn && btn.parentElement) btn.parentElement.style.display = "none";
}
function applyPermGate() {
  // 마스터는 전부 보임. 매니저는 부여된 권한만.
  if (MY.role === "master") return;
  if (!can("orders_view")) hideNav("orders");
  if (!can("board_manage")) hideNav("board");
  if (!can("settings_manage")) hideNav("settings");
  if (!can("settings_manage")) hideNav("settle");
  hideNav("members"); // 회원관리(등급·권한)는 마스터 전용
  if (!can("orders_delete")) {
    const md = document.getElementById("modalDelete");
    if (md) md.style.display = "none";
  }
}

async function init() {
  const session = await window.OSS.adminGetSession();
  if (!session) { location.href = "admin-login.html"; return; }

  // 역할 확인 — 운영진(master/manager)만 접근
  try { MY = await window.OSS.getMyProfile(); } catch (e) { MY = null; }
  if (!MY || (MY.role !== "master" && MY.role !== "manager")) {
    alert("관리자 권한이 없는 계정이에요. 마이페이지로 이동합니다.");
    location.href = "mypage.html";
    return;
  }
  window.MY = MY;
  applyPermGate();

  try {
    const rows = await window.OSS.fetchApplications();
    ORDERS = rows.map(mapRow);
  } catch (err) {
    console.error(err);
    alert("주문 데이터를 불러오지 못했어요: " + (err.message || err));
    ORDERS = [];
  }
  renderKanban();
  renderDashboard();
  loadNotices();
  loadMembers();
  loadReviews();
  initCoupons();
  subscribeAdminRealtime();
}

// 실시간 동기화 — 폰/다른 기기에서 바뀐 주문을 자동 반영 (충돌·누락 방지)
let _adminReloadTimer = null;
async function reloadOrders() {
  if (modal && !modal.hidden) return; // 주문 상세 편집 중엔 보류(깜빡임·덮어쓰기 방지)
  try {
    const rows = await window.OSS.fetchApplications();
    ORDERS = rows.map(mapRow);
    renderKanban(); renderDashboard();
    const sp = document.getElementById("page-settle");
    if (sp && sp.classList.contains("active")) { const b = document.getElementById("settleStale"); if (b) b.textContent = "데이터가 바뀌었어요 — [집계]를 다시 눌러주세요."; }
  } catch (e) { console.warn("[admin] reload", e); }
}
function scheduleReload() { clearTimeout(_adminReloadTimer); _adminReloadTimer = setTimeout(reloadOrders, 400); }
function subscribeAdminRealtime() {
  try {
    window.OSS.sb.channel("admin-apps-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, scheduleReload)
      // 새 작업 기록이 들어오면, 지금 열어 둔 주문건이면 그 주문 로그를 새로고침(폰↔컴퓨터 실시간)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, function (p) {
        if (modal && !modal.hidden && p && p.new && p.new.order_no && p.new.order_no === modalOrderNo) renderOrderLog(modalOrderNo);
      })
      .subscribe();
  } catch (e) { console.warn("[admin] realtime", e); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) scheduleReload(); });
  window.addEventListener("focus", scheduleReload);
}

// 활동 로그 (세무·감사용) — 기록 + 맨 아래 로그창 렌더
function logAction(o, action, detail) {
  try {
    window.OSS.logActivity({
      device: "desktop",
      actor: (MY && (MY.username || MY.email)) || "",
      order_no: (o && (o.no || o.order_no)) || "",
      action: action, detail: detail || "",
    });
  } catch (e) {}
}
// 주문 상세창에 그 주문건의 전체 작업 이력(처음→끝) 표시
async function renderOrderLog(orderNo) {
  const box = document.getElementById("modalOrderLog");
  if (!box) return;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  box.innerHTML = '<div class="empty">불러오는 중...</div>';
  try {
    const list = await window.OSS.fetchActivityLogByOrder(orderNo);
    box.innerHTML = list.length ? list.map(function (e) {
      const dev = e.device === "phone" ? "📱 휴대폰" : "💻 데스크톱";
      const t = (e.created_at || "").replace("T", " ").slice(0, 16);
      return '<div class="log-row"><span class="log-time">' + t + '</span><span class="log-dev">' + dev + '</span><span class="log-act">' + esc(e.action || "") + (e.detail ? " · " + esc(e.detail) : "") + "</span></div>";
    }).join("") : '<div class="empty">아직 작업 기록이 없어요. (이 주문부터 기록됩니다)</div>';
  } catch (e) { box.innerHTML = '<div class="empty">기록 불러오기 실패: ' + esc(e.message || e) + "</div>"; }
}

// ===== 구매후기 관리 (승인하면 홈페이지 후기 섹션에 노출) =====
async function loadReviews() {
  const tb = document.getElementById("reviewRows");
  if (!tb) return;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  try {
    const list = await window.OSS.listReviews();
    if (!list.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">등록된 후기가 없어요.</td></tr>'; return; }
    tb.innerHTML = list.map(function (r) {
      const st = r.status === "approved" ? '<span style="color:#1F9D6B;font-weight:700;">게시중</span>' : (r.status === "rejected" ? '<span style="color:#C0392B;">숨김</span>' : '<span style="color:#C77A12;font-weight:700;">대기</span>');
      const btn = (r.status === "approved")
        ? '<button class="btn btn-small" data-rv-hide="' + r.id + '">숨김</button>'
        : '<button class="btn btn-small btn-primary" data-rv-ok="' + r.id + '">승인</button>';
      return '<tr><td>' + esc(r.author_name || "회원") + '</td><td style="white-space:nowrap;color:#F1A23A;">' + "★".repeat(r.rating || 5) + '</td><td style="max-width:280px;white-space:normal;word-break:break-word;">' + esc(r.body || "") + '</td><td>' + esc(r.order_no || "-") + '</td><td>' + (r.created_at || "").slice(0, 10) + '</td><td>' + st + '</td><td style="white-space:nowrap;">' + btn + ' <button class="btn btn-small" data-rv-del="' + r.id + '" style="color:var(--red);">삭제</button></td></tr>';
    }).join("");
  } catch (e) { tb.innerHTML = '<tr><td colspan="7" class="empty">불러오기 실패: ' + esc(e.message || e) + '</td></tr>'; }
}
document.addEventListener("click", async function (e) {
  const t = e.target; if (!t || !t.getAttribute) return;
  const ok = t.getAttribute("data-rv-ok"), hide = t.getAttribute("data-rv-hide"), del = t.getAttribute("data-rv-del");
  if (!ok && !hide && !del) return;
  try {
    if (ok) { await window.OSS.setReviewStatus(ok, "approved"); loadReviews(); }
    else if (hide) { await window.OSS.setReviewStatus(hide, "rejected"); loadReviews(); }
    else if (del) { if (confirm("이 후기를 삭제할까요?")) { await window.OSS.deleteReview(del); loadReviews(); } }
  } catch (err) { alert("처리 실패: " + (err.message || err)); }
});

// ===== 쿠폰 관리 (회원 검색 → 정산 시 사용 처리) =====
function initCoupons() {
  const btn = document.getElementById("couponSearchBtn");
  const inp = document.getElementById("couponSearch");
  const tb = document.getElementById("couponRows");
  if (!btn || !tb) return;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  async function search() {
    const q = (inp.value || "").trim().toLowerCase();
    if (!q) { tb.innerHTML = '<tr><td colspan="6" class="empty">회원 아이디/이름으로 검색하세요.</td></tr>'; return; }
    tb.innerHTML = '<tr><td colspan="6" class="empty">검색 중…</td></tr>';
    try {
      const members = await window.OSS.listMembers();
      const hit = members.filter(function (m) { return (m.username || "").toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q); });
      if (!hit.length) { tb.innerHTML = '<tr><td colspan="6" class="empty">일치하는 회원이 없어요.</td></tr>'; return; }
      const now = Date.now();
      let rows = "";
      for (const m of hit) {
        const coupons = await window.OSS.listMemberCoupons(m.id);
        if (!coupons.length) { rows += '<tr><td>' + esc(m.name || m.username) + '</td><td colspan="5" class="empty">쿠폰 없음</td></tr>'; continue; }
        rows += coupons.map(function (c) {
          const expired = c.expires_at && new Date(c.expires_at).getTime() < now;
          const used = c.status === "used";
          const state = used ? '<span style="color:#999;">사용완료</span>' : (expired ? '<span style="color:#C0392B;">만료</span>' : '<span style="color:#1F9D6B;font-weight:700;">사용가능</span>');
          const act = used
            ? '<button class="btn btn-small" data-cp-undo="' + c.id + '">되돌리기</button>'
            : (expired
              ? '<button class="btn btn-small" data-cp-del="' + c.id + '">삭제</button>'
              : '<button class="btn btn-small btn-primary" data-cp-use="' + c.id + '">사용처리</button> <button class="btn btn-small" data-cp-del="' + c.id + '">삭제</button>');
          return '<tr><td>' + esc(m.name || m.username) + '</td><td>₩' + Number(c.amount || 0).toLocaleString() + '</td><td>' + state + '</td><td>' + (c.expires_at || "").slice(0, 10) + '</td><td>' + esc(c.used_order_no || "-") + '</td><td>' + act + '</td></tr>';
        }).join("");
      }
      tb.innerHTML = rows;
    } catch (e) { tb.innerHTML = '<tr><td colspan="6" class="empty">검색 실패: ' + esc(e.message || e) + '</td></tr>'; }
  }
  btn.addEventListener("click", search);
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); search(); } });
  tb.addEventListener("click", async function (e) {
    const t = e.target; if (!t || !t.getAttribute) return;
    const use = t.getAttribute("data-cp-use"), undo = t.getAttribute("data-cp-undo"), del = t.getAttribute("data-cp-del");
    try {
      if (use) { const ord = prompt("이 쿠폰을 사용한 주문번호 (선택):", ""); await window.OSS.useCoupon(use, ord || null); search(); }
      else if (undo) { await window.OSS.unuseCoupon(undo); search(); }
      else if (del) { if (confirm("이 쿠폰을 삭제할까요?")) { await window.OSS.deleteCoupon(del); search(); } }
    } catch (err) { alert("처리 실패: " + (err.message || err)); }
  });

  const issueBtn = document.getElementById("cpIssueBtn");
  if (issueBtn) issueBtn.addEventListener("click", async function () {
    const msg = document.getElementById("cpIssueMsg");
    const uname = (document.getElementById("cpIssueUser").value || "").trim();
    const amt = document.getElementById("cpIssueAmt").value;
    const days = document.getElementById("cpIssueDays").value;
    const reason = (document.getElementById("cpIssueReason").value || "").trim();
    if (!uname) { if (msg) msg.textContent = "회원 아이디를 입력하세요."; return; }
    if (msg) msg.textContent = "발급 중…";
    try {
      const members = await window.OSS.listMembers();
      const m = members.find(function (x) { return (x.username || "").toLowerCase() === uname.toLowerCase(); });
      if (!m) { if (msg) msg.textContent = "그 아이디 회원이 없어요."; return; }
      await window.OSS.issueCoupon(m.id, amt, reason || "이벤트", days);
      if (msg) msg.textContent = "✓ " + (m.name || m.username) + "님께 발급 완료";
      if ((inp.value || "").trim()) search();
      setTimeout(function () { if (msg) msg.textContent = ""; }, 3000);
    } catch (e) { if (msg) msg.textContent = "발급 실패: " + (e.message || e); }
  });
}

// ----- 회원관리 (마스터: 등급·역할·권한 편집 / 매니저: 마스터 전용이라 진입 불가) -----
async function loadMembers() {
  const tb = document.getElementById("memberRows");
  if (!tb) return;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const GRADES = ["guest", "silver", "gold", "diamond", "red", "biz"];
  const ROLES = [["member", "일반회원"], ["manager", "매니저관리자"], ["master", "마스터관리자"]];
  const PERMS = [["orders_view", "주문조회"], ["orders_edit", "주문수정"], ["orders_delete", "주문삭제"], ["board_manage", "공지·문의"], ["settings_manage", "설정"]];
  const isMaster = MY.role === "master";

  let members = [];
  try { members = await window.OSS.listMembers(); }
  catch (e) { tb.innerHTML = '<tr><td colspan="10" class="empty">회원을 불러오지 못했어요: ' + (e.message || e) + "</td></tr>"; return; }

  const cnt = document.getElementById("memberCount");
  if (cnt) cnt.textContent = "(" + members.length + "명)";
  if (!members.length) { tb.innerHTML = '<tr><td colspan="10" class="empty">회원이 없습니다.</td></tr>'; return; }

  tb.innerHTML = members.map((m) => {
    const perm = m.permissions || {};
    const gradeCell = isMaster
      ? `<select class="m-grade" data-id="${m.id}">${GRADES.map((g) => `<option ${m.grade === g ? "selected" : ""}>${g}</option>`).join("")}</select>`
      : esc(m.grade);
    const mailboxCell = isMaster
      ? `<input class="m-mailbox" data-id="${m.id}" value="${esc(m.mailbox_code || "")}" placeholder="고객번호" style="width:88px;" />`
      : esc(m.mailbox_code || "-");
    const roleCell = isMaster
      ? `<select class="m-role" data-id="${m.id}">${ROLES.map(([v, l]) => `<option value="${v}" ${m.role === v ? "selected" : ""}>${l}</option>`).join("")}</select>`
      : esc((ROLES.find((r) => r[0] === m.role) || [])[1] || m.role);
    let permCell;
    if (m.role === "master") permCell = '<span class="m-allperm">전체 권한</span>';
    else if (isMaster && m.role === "manager")
      permCell = `<div class="m-perms" data-id="${m.id}">${PERMS.map(([k, l]) => `<label><input type="checkbox" class="m-perm" data-id="${m.id}" data-key="${k}" ${perm[k] ? "checked" : ""}/>${l}</label>`).join("")}</div>`;
    else if (m.role === "manager") permCell = esc(PERMS.filter(([k]) => perm[k]).map(([, l]) => l).join(", ") || "-");
    else permCell = "-";
    return `<tr>
      <td>${esc(m.username || "-")}</td>
      <td>${esc(m.name || "-")}</td>
      <td>${esc(m.phone || "-")}</td>
      <td>${esc(m.email || "-")}</td>
      <td>${mailboxCell}</td>
      <td>${gradeCell}</td>
      <td>${roleCell}</td>
      <td>${permCell}</td>
      <td>${(m.created_at || "").slice(0, 10)}</td>
      <td>${(m.last_login_at || "").slice(0, 10) || "-"}</td>
    </tr>`;
  }).join("");

  if (!isMaster) return; // 매니저는 편집 불가
  tb.querySelectorAll(".m-role").forEach((sel) => sel.addEventListener("change", async () => {
    try { await window.OSS.setMemberRole(sel.dataset.id, sel.value); loadMembers(); }
    catch (e) { alert("역할 변경 실패: " + (e.message || e)); }
  }));
  tb.querySelectorAll(".m-grade").forEach((sel) => sel.addEventListener("change", async () => {
    try { await window.OSS.setMemberGrade(sel.dataset.id, sel.value); }
    catch (e) { alert("등급 변경 실패: " + (e.message || e)); }
  }));
  tb.querySelectorAll(".m-mailbox").forEach((inp) => inp.addEventListener("change", async () => {
    try { await window.OSS.setMailboxCode(inp.dataset.id, inp.value); inp.style.borderColor = "#1F9D6B"; }
    catch (e) { alert("고객번호 저장 실패: " + (e.message || e)); }
  }));
  tb.querySelectorAll(".m-perm").forEach((cb) => cb.addEventListener("change", async () => {
    const id = cb.dataset.id;
    const perms = {};
    tb.querySelectorAll('.m-perm[data-id="' + id + '"]').forEach((c) => { perms[c.dataset.key] = c.checked; });
    try { await window.OSS.setMemberPermissions(id, perms); }
    catch (e) { alert("권한 변경 실패: " + (e.message || e)); }
  }));
}

document.getElementById("adminLogout").addEventListener("click", async (e) => {
  e.preventDefault();
  await window.OSS.adminSignOut();
  location.href = "admin-login.html";
});

// ----- 메뉴 전환 -----
document.querySelectorAll(".admin-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".admin-page").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("page-" + btn.dataset.page).classList.add("active");
    if (btn.dataset.page === "settle" && SETTLE_ROWS === null) renderSettle(); // 첫 진입 시 이번달 자동집계
  });
});

// 설정 하위 탭 — 한 번에 한 그룹만 보이게 (배송센터·환율·수수료=기본 / 요율·등급 / 띠배너·메인배너=홈 / 안내·후기·FAQ=콘텐츠)
(function setSubtabs() {
  const tabs = document.querySelectorAll(".set-subtab");
  if (!tabs.length) return;
  function show(group) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.setgroup === group));
    document.querySelectorAll("#page-settings .dash-panel[data-setgroup]").forEach((p) => { p.hidden = (p.dataset.setgroup !== group); });
  }
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.setgroup)));
  show("basic");
})();

// ----- 검색 -----
let SEARCH = "";
function matchSearch(o) {
  if (!SEARCH) return true;
  const q = SEARCH.toLowerCase();
  const r = o.raw || {};
  return [o.no, o.customer, o.name, r.applicant_phone, r.receiver_name, r.receiver_phone, r.tracking_no]
    .some((v) => (v || "").toString().toLowerCase().includes(q));
}
const FLAG_DOT = { red: "🔴", orange: "🟠", green: "🟢", blue: "🔵" };

// ----- 칸반 렌더 -----
function cardHtml(o) {
  return `<div class="kanban-card" draggable="true" data-id="${o.id}">
    <div class="kc-top">
      <span class="kc-id">${o.flag ? (FLAG_DOT[o.flag] || "") + " " : ""}${esc(o.no)}</span>
      <span class="kc-type ${o.type}">${o.type === "purchase" ? "구매" : "배송"}</span>
    </div>
    <div class="kc-name">${esc(o.name)}</div>
    ${o.bundleId ? `<div class="kc-bundle">🔗 ${esc(o.bundleId)}</div>` : ""}
    ${o.raw && o.raw.tracking_no ? `<div class="kc-bundle">📦 ${esc(o.raw.tracking_no)}</div>` : ""}
    <div class="kc-cust">👤 ${esc(o.customer)}</div>
    <div class="kc-amount">¥${(o.amount || 0).toLocaleString()}</div>
  </div>`;
}
function colHtml(s, isExc) {
  const items = ORDERS.filter((o) => o.status === s.key && !o.deleted && matchSearch(o));
  return `<div class="kanban-col ${isExc ? "exception" : ""}" data-status="${s.key}">
    <div class="kanban-col-head"><span>${s.label}</span><span class="kanban-col-count">${items.length}</span></div>
    ${items.map(cardHtml).join("")}
  </div>`;
}
function renderKanban() {
  document.getElementById("kanbanNormal").innerHTML = NORMAL.map((s) => colHtml(s, false)).join("");
  document.getElementById("kanbanException").innerHTML = EXCEPTION.map((s) => colHtml(s, true)).join("");
  bindDnd();
  bindCardClick();
  renderBundlePanel();
  renderTrash();
  if (VIEW === "table") renderOrderTable();
}

// ----- 휴지통 (삭제된 주문) -----
function renderTrash() {
  const tb = document.getElementById("trashRows");
  if (!tb) return;
  const items = ORDERS.filter((o) => o.deleted);
  const cnt = document.getElementById("trashCount");
  if (cnt) cnt.textContent = items.length;
  tb.innerHTML = items.length
    ? items.map((o) => `<tr>
        <td>${o.no}</td><td>${o.customer}</td><td>${o.name}</td>
        <td><button class="btn btn-small" data-restore="${o.id}">복원</button></td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">휴지통이 비어 있습니다.</td></tr>`;
  // ※ 세무·감사를 위해 주문 기록은 영구삭제하지 않고 보관만 합니다(복원 가능).
  tb.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", async () => {
    const o = ORDERS.find((x) => x.id === b.dataset.restore);
    try {
      await window.OSS.updateApplication(o.id, { deleted_at: null });
      o.deleted = false; o.raw.deleted_at = null; renderKanban(); renderDashboard();
      logAction(o, "주문 복원");
    } catch (e) { alert("복원 실패: " + (e.message || e)); }
  }));
}

// 검색 / 휴지통 토글
(function setupOrderToolbar() {
  const s = document.getElementById("orderSearch");
  if (s) s.addEventListener("input", () => { SEARCH = s.value.trim(); renderKanban(); });
  const t = document.getElementById("trashToggle");
  const panel = document.getElementById("trashPanel");
  if (t && panel) t.addEventListener("click", () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderTrash(); });
})();

// ----- 합배송 묶기 패널 -----
function renderBundlePanel() {
  const tb = document.getElementById("bundleRows");
  if (!tb) return;
  const items = ORDERS.filter((o) => o.status === "입고완료" && !o.deleted);
  if (!items.length) {
    tb.innerHTML = `<tr><td colspan="6" class="empty">합배송 가능한(입고완료) 주문이 없습니다.</td></tr>`;
    return;
  }
  // 합배송 요청한 것 먼저
  items.sort((a, b) => (b.bundleRequested ? 1 : 0) - (a.bundleRequested ? 1 : 0));
  tb.innerHTML = items.map((o) => `<tr>
    <td><input type="checkbox" class="bundle-chk" data-id="${o.id}" data-cust="${o.customer}" style="width:16px;height:16px;"></td>
    <td>${o.no}</td>
    <td>${o.customer}</td>
    <td>${o.name}</td>
    <td>${o.bundleRequested ? '<span class="status-badge status-new">고객요청</span>' : "-"}</td>
    <td>${o.bundleId ? "🔗 " + o.bundleId : "-"}</td>
  </tr>`).join("");
}
function genBundleId() {
  const d = new Date();
  const s = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return "BDL-" + s + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
}
document.getElementById("doBundle").addEventListener("click", async () => {
  const checked = [...document.querySelectorAll(".bundle-chk:checked")];
  const msg = document.getElementById("bundleMsg");
  if (checked.length < 2) { alert("합배송할 주문을 2개 이상 선택해 주세요."); return; }
  const custs = new Set(checked.map((c) => c.dataset.cust));
  if (custs.size > 1) { alert("같은 고객의 주문끼리만 묶을 수 있어요."); return; }
  const bundleId = genBundleId();
  const ids = checked.map((c) => c.dataset.id);
  try {
    for (const id of ids) {
      await window.OSS.updateApplication(id, { bundle_id: bundleId, status: "포장/측정", bundle_requested: false });
      const o = ORDERS.find((x) => x.id === id);
      if (o) { o.bundleId = bundleId; o.status = "포장/측정"; o.bundleRequested = false; o.raw.bundle_id = bundleId; }
    }
    renderKanban(); renderDashboard();
    msg.textContent = `✓ ${ids.length}건 → ${bundleId} 합배송 묶음 완료`;
    setTimeout(() => (msg.textContent = ""), 4000);
  } catch (e) { alert("묶기 실패: " + (e.message || e)); }
});

// ----- 드래그앤드롭 -----
let dragId = null;
function bindDnd() {
  document.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("dragstart", () => { dragId = card.dataset.id; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  document.querySelectorAll(".kanban-col").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const newStatus = col.dataset.status;
      const order = ORDERS.find((o) => o.id === dragId);
      if (order && order.status !== newStatus) {
        const prev = order.status;
        order.status = newStatus;
        renderKanban();
        renderDashboard();
        try {
          await window.OSS.updateApplicationStatus(order.id, newStatus);
          logAction(order, newStatus + "(으)로 변경");
        } catch (err) {
          alert("상태 저장 실패: " + (err.message || err));
          order.status = prev; renderKanban(); renderDashboard();
        }
      }
    });
  });
}

// ----- 카드 클릭 → 상세 모달 -----
const modal = document.getElementById("orderModal");
let modalOrderId = null;
let modalOrderNo = null;
function bindCardClick() {
  document.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}
function openModal(id) {
  const o = ORDERS.find((x) => x.id === id);
  if (!o) return;
  modalOrderId = id;
  modalOrderNo = o.no;
  const r = o.raw;
  const products = Array.isArray(r.products) ? r.products : [];
  const prodHtml = products.map((p, i) => {
    const u = safeUrl(p.url), img = safeUrl(p.image);
    // 고객이 고른 옵션/수량 (order-quick은 options 배열, 그 외엔 memo 문자열)
    const opt = Array.isArray(p.options) && p.options.length
      ? " / " + p.options.map((x) => esc(x.option) + (x.qty > 1 ? " x" + x.qty : "")).join(", ")
      : (p.memo ? " / " + esc(p.memo) : "");
    return `${i + 1}) ${esc(p.name) || "-"} ${p.category ? "[" + esc(p.category) + "]" : ""} ¥${p.price || 0} × ${p.qty || 0}${opt}` +
      (p.orderNo ? ` / 오더:${esc(p.orderNo)}` : "") +
      (u ? `<br><a href="${u}" target="_blank" style="color:var(--blue);font-size:12px;">상품링크 ↗</a>` : "") +
      (img ? `<br><a href="${img}" target="_blank"><img src="${img}" alt="상품사진" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid var(--line);margin-top:6px;" /></a>` : "");
  }).join("<br>");
  document.getElementById("modalName").textContent = o.name;
  document.getElementById("modalId").textContent = `${o.no} · ${o.type === "purchase" ? "구매대행" : "배송대행"} · ${o.created}`;
  document.getElementById("modalDetail").innerHTML = `
    <div class="detail-row"><span class="dk">신청자</span><span class="dv">${esc(r.applicant_name) || "-"} (${esc(r.applicant_phone) || "-"})</span></div>
    <div class="detail-row"><span class="dk">이메일/카톡</span><span class="dv">${esc(r.applicant_email) || "-"} / ${esc(r.applicant_kakao) || "-"}</span></div>
    <div class="detail-row"><span class="dk">상품</span><span class="dv">${prodHtml || "-"}</span></div>
    <div class="detail-row"><span class="dk">합계</span><span class="dv">¥${(r.subtotal || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="dk">회원등급</span><span class="dv">${esc(gradeLabel(r.member_grade))}</span></div>
    <div class="detail-row"><span class="dk">검수/옵션</span><span class="dv">${esc(r.inspect) || "없음"}${(r.addons && r.addons.length) ? " · " + esc(r.addons.join(", ")) : ""}</span></div>
    <div class="detail-row"><span class="dk">수취인</span><span class="dv">${esc(r.receiver_name) || "-"} (${esc(r.receiver_phone) || "-"})</span></div>
    <div class="detail-row"><span class="dk">통관부호</span><span class="dv">${esc(r.customs_code) || "-"}</span></div>
    <div class="detail-row"><span class="dk">주소</span><span class="dv">[${esc(r.zipcode) || "-"}] ${esc(r.address) || "-"}</span></div>
    <div class="detail-row"><span class="dk">배송방법</span><span class="dv">${esc(r.ship_method) || "-"}</span></div>
    <div class="detail-row"><span class="dk">요청사항</span><span class="dv">${esc(r.memo) || "-"}</span></div>`;
  const sel = document.getElementById("modalStatus");
  sel.innerHTML = ALL_STATUS.map((s) => `<option value="${s.key}" ${s.key === o.status ? "selected" : ""}>${s.label}</option>`).join("");
  // 입고·무게·배송비
  document.getElementById("modalWeight").value = r.weight_kg != null ? r.weight_kg : "";
  document.getElementById("modalCenter").value = r.center_type === "sea" ? "sea" : "air";
  document.getElementById("modalFee").textContent = r.shipping_fee ? "₩" + Number(r.shipping_fee).toLocaleString() : "-";
  // 플래그·송장·메모
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ""; };
  setVal("modalFlag", o.flag);
  setVal("modalCourier", r.courier);
  setVal("modalTracking", r.tracking_no);
  setVal("modalMemo", r.admin_memo);
  const mp = document.getElementById("modalMemoPublic"); if (mp) mp.checked = !!r.memo_visible;
  // 단계별 날짜 타임라인
  const tl = document.getElementById("modalTimeline");
  if (tl) {
    const sd = r.status_dates && typeof r.status_dates === "object" ? r.status_dates : {};
    const keys = Object.keys(sd);
    tl.innerHTML = keys.length
      ? keys.map((k) => `<span class="tl-item">${labelOf(k)} <b>${(sd[k] || "").slice(0, 16).replace("T", " ")}</b></span>`).join("")
      : '<span class="tl-empty">상태 변경 기록이 아직 없어요.</span>';
  }
  renderOrderLog(o.no);
  modal.hidden = false;
}
document.getElementById("modalClose").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

// 삭제(휴지통으로)
const modalDeleteBtn = document.getElementById("modalDelete");
if (modalDeleteBtn) modalDeleteBtn.addEventListener("click", async () => {
  const o = ORDERS.find((x) => x.id === modalOrderId);
  if (!o) return;
  if (!confirm(`${o.no} 주문을 휴지통으로 보낼까요?\n(휴지통에서 복원할 수 있어요)`)) return;
  try {
    await window.OSS.updateApplication(o.id, { deleted_at: new Date().toISOString() });
    o.deleted = true; o.raw.deleted_at = new Date().toISOString();
    modal.hidden = true; renderKanban(); renderDashboard();
    logAction(o, "휴지통으로 이동(보관)");
  } catch (e) { alert("삭제 실패: " + (e.message || e)); }
});

// 배송조회 (택배사 추적 — 새 창)
const modalTrackBtn = document.getElementById("modalTrack");
if (modalTrackBtn) modalTrackBtn.addEventListener("click", () => {
  const no = (document.getElementById("modalTracking").value || "").trim();
  if (!no) { alert("송장번호를 먼저 입력하세요."); return; }
  // 통합 택배조회(스마트택배) — 송장번호로 검색
  window.open("https://search.naver.com/search.naver?query=" + encodeURIComponent("택배조회 " + no), "_blank");
});

// 배송비 계산 버튼 (미리보기)
document.getElementById("modalCalcFee").addEventListener("click", () => {
  const o = ORDERS.find((x) => x.id === modalOrderId);
  const w = document.getElementById("modalWeight").value;
  const c = document.getElementById("modalCenter").value;
  const base = calcShippingFee(w, c);
  const gi = gradeInfo(o && o.raw && o.raw.member_grade);
  const fee = gi && gi.pct ? Math.round(base * (1 - gi.pct / 100)) : base;
  document.getElementById("modalFee").textContent = fee ? ("₩" + fee.toLocaleString() + (gi && gi.pct ? ` (${gi.name} ${gi.pct}% 할인)` : "")) : "-";
});

document.getElementById("modalSave").addEventListener("click", async () => {
  const o = ORDERS.find((x) => x.id === modalOrderId);
  if (o) {
    const prev = { status: o.status, raw: { ...o.raw } };
    const newStatus = document.getElementById("modalStatus").value;
    const weight = document.getElementById("modalWeight").value;
    const center = document.getElementById("modalCenter").value;
    const _baseFee = calcShippingFee(weight, center);
    const _gi = gradeInfo(o.raw.member_grade);
    const fee = _gi && _gi.pct ? Math.round(_baseFee * (1 - _gi.pct / 100)) : _baseFee;
    const gv = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
    // 상태가 바뀌면 날짜 자동기록
    const sd = (o.raw.status_dates && typeof o.raw.status_dates === "object") ? { ...o.raw.status_dates } : {};
    if (newStatus !== prev.status && !sd[newStatus]) sd[newStatus] = new Date().toISOString();
    const fields = {
      status: newStatus,
      center_type: center,
      weight_kg: weight ? Number(weight) : null,
      shipping_fee: fee || null,
      flag: gv("modalFlag"),
      courier: gv("modalCourier"),
      tracking_no: gv("modalTracking"),
      admin_memo: gv("modalMemo"),
      memo_visible: !!document.getElementById("modalMemoPublic")?.checked,
      status_dates: sd,
    };
    o.status = newStatus;
    o.flag = fields.flag;
    Object.assign(o.raw, fields);
    renderKanban(); renderDashboard();
    try {
      await window.OSS.updateApplication(o.id, fields);
      var _acts = [];
      if (newStatus !== prev.status) _acts.push(newStatus + "(으)로 변경");
      if (fields.tracking_no && fields.tracking_no !== (prev.raw.tracking_no || "")) _acts.push("송장 " + fields.tracking_no);
      if (!_acts.length) _acts.push("주문 정보 수정");
      logAction(o, _acts.join(", "));
    } catch (err) {
      // 새 컬럼(flag/메모/송장 등)이 아직 DB에 없으면 핵심 항목만 다시 저장
      try {
        await window.OSS.updateApplication(o.id, {
          status: newStatus, center_type: center,
          weight_kg: fields.weight_kg, shipping_fee: fields.shipping_fee,
        });
        alert("상태·무게는 저장됐어요.\n메모·송장·중요표시는 DB 설정(SQL 1회)을 마치면 저장됩니다.");
      } catch (err2) {
        alert("저장 실패: " + (err2.message || err2));
        o.status = prev.status; o.raw = prev.raw; renderKanban(); renderDashboard();
      }
    }
  }
  modal.hidden = true;
});

// ----- 대시보드 -----
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function renderDashboard() {
  const today = todayStr();
  const waitKeys = ["결제대기", "구매중", "입고완료", "포장/측정", "배송중"];
  const isExc = (s) => EXCEPTION.some((e) => e.key === s);
  document.getElementById("statNew").innerHTML = ORDERS.filter((o) => o.status === "신규접수").length + "<small>건</small>";
  document.getElementById("statWait").innerHTML = ORDERS.filter((o) => waitKeys.includes(o.status)).length + "<small>건</small>";
  document.getElementById("statAlert").innerHTML = ORDERS.filter((o) => isExc(o.status)).length + "<small>건</small>";
  document.getElementById("statDone").innerHTML = ORDERS.filter((o) => o.status === "배송완료" && o.created === today).length + "<small>건</small>";

  const recent = ORDERS.slice(0, 8);
  document.getElementById("recentOrders").innerHTML = recent.length
    ? recent.map((o) => `<tr><td>${o.no}</td><td>${o.type === "purchase" ? "구매" : "배송"}</td><td>${o.customer}</td><td><span class="status-badge ${badgeClass(o.status)}">${labelOf(o.status)}</span></td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">아직 신청이 없습니다.</td></tr>`;

  // 이번달 KPI(한국시간 기준) + 지연 경보
  const ymLocal = toLocalYmd(new Date().toISOString()).slice(0, 7);
  const live = ORDERS.filter((o) => !o.deleted);
  const monthOrders = live.filter((o) => (o.created_local || "").startsWith(ymLocal));
  const elKc = document.getElementById("kpiMonthCnt");
  if (elKc) elKc.innerHTML = monthOrders.length + "<small>건</small>";
  const gmv = monthOrders.reduce((s, o) => s + Math.round((o.amount || 0) * perJpy()) + (Number(o.raw.shipping_fee) || 0), 0);
  const elKg = document.getElementById("kpiMonthGmv");
  if (elKg) elKg.textContent = "₩" + gmv.toLocaleString();
  renderDelayAlert(live);

  // 문의 목록은 loadInquiries()가 채웁니다.
}
function badgeClass(s) {
  if (s === "신규접수") return "status-new";
  if (s === "배송완료") return "status-done";
  if (EXCEPTION.some((e) => e.key === s)) return "status-hold";
  return "status-progress";
}

// ===== 지연 경보 — 진행중인데 현재 상태에 DELAY_DAYS일 이상 머문 주문 =====
function renderDelayAlert(live) {
  const tb = document.getElementById("delayRows");
  if (!tb) return;
  const skip = ["배송완료", "취소", "반품/교환", "사고/폐기"];
  const now = Date.now();
  const list = live.filter((o) => !skip.includes(o.status)).map((o) => {
    const sd = (o.raw.status_dates && typeof o.raw.status_dates === "object") ? o.raw.status_dates : {};
    const baseIso = sd[o.status] || o.raw.created_at || o.created;
    const days = Math.floor((now - new Date(baseIso).getTime()) / 86400000);
    return { o: o, days: days, estimated: !sd[o.status] };
  }).filter((x) => isFinite(x.days) && x.days >= DELAY_DAYS).sort((a, b) => b.days - a.days);
  if (!list.length) { tb.innerHTML = '<tr><td colspan="3" class="empty">오래 멈춘 주문이 없어요 👍</td></tr>'; return; }
  tb.innerHTML = list.map((x) =>
    `<tr data-id="${x.o.id}" style="cursor:pointer;"><td>${esc(x.o.no)}</td><td>${esc(x.o.customer)} <span style="color:var(--muted);font-size:12px;">· ${labelOf(x.o.status)}</span></td><td style="color:var(--red);font-weight:700;white-space:nowrap;">${x.days}일째${x.estimated ? " (추정)" : ""}</td></tr>`
  ).join("");
  tb.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openModal(tr.dataset.id)));
}

// ===== 정산·통계 =====
function settleRange() {
  const period = (document.querySelector('input[name="settlePeriod"]:checked') || {}).value || "thisMonth";
  const today = toLocalYmd(new Date().toISOString());
  if (period === "thisMonth") return [today.slice(0, 7) + "-01", today];
  if (period === "lastMonth") {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const lm = toLocalYmd(d.toISOString()).slice(0, 7);
    const lastDay = new Date(Number(lm.slice(0, 4)), Number(lm.slice(5, 7)), 0).getDate();
    return [lm + "-01", lm + "-" + String(lastDay).padStart(2, "0")];
  }
  if (period === "thisYear") return [today.slice(0, 4) + "-01-01", today.slice(0, 4) + "-12-31"];
  return [(document.getElementById("settleFrom").value || "1900-01-01"), (document.getElementById("settleTo").value || "2999-12-31")];
}
function renderSettle() {
  const range = settleRange(); const from = range[0], to = range[1];
  if (from > to) { alert("시작일이 종료일보다 늦어요. 날짜를 확인해 주세요."); return; }
  const typeSel = document.getElementById("settleType").value || "all";
  const inRange = (o) => (o.created_local || "") >= from && (o.created_local || "") <= to;
  const base = ORDERS.filter((o) => !o.deleted && inRange(o));
  const rows = base.filter((o) => o.status !== "취소" && o.status !== "반품/교환" && (typeSel === "all" || o.type === typeSel));
  const S = (o) => Number(o.raw.subtotal) || 0;
  const SH = (o) => Number(o.raw.shipping_fee) || 0;
  const goodsYen = rows.reduce((s, o) => s + S(o), 0);
  const goodsWon = Math.round(rows.reduce((s, o) => s + S(o) * perJpy(), 0));
  const ship = rows.reduce((s, o) => s + SH(o), 0);
  const commission = Math.round(rows.reduce((s, o) => s + S(o) * perJpy() * COMMISSION_PCT / 100, 0));
  const gross = goodsWon + ship;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const elc = document.getElementById("stCnt"); if (elc) elc.innerHTML = rows.length + "<small>건</small>";
  set("stGoodsYen", "¥" + goodsYen.toLocaleString());
  set("stGoodsWon", "₩" + goodsWon.toLocaleString());
  set("stShip", "₩" + ship.toLocaleString());
  set("stCommission", "₩" + commission.toLocaleString());
  set("stGross", "₩" + gross.toLocaleString());
  const cancelCnt = base.filter((o) => o.status === "취소" || o.status === "반품/교환").length;
  set("stCancelNote", cancelCnt ? `※ 같은 기간 취소·반품/교환 ${cancelCnt}건은 위 집계에서 제외했어요.` : "");
  const settleSum = rows.reduce((s, o) => s + (Number(o.raw.settle_krw) || 0), 0);
  set("stSettleManual", settleSum > 0 ? `· 수동 입력된 실정산 합계: ₩${settleSum.toLocaleString()} (추정과 별개)` : "");
  const tb = document.getElementById("settleRows");
  if (tb) {
    tb.innerHTML = rows.length
      ? rows.map((o) => `<tr data-id="${o.id}" style="cursor:pointer;"><td>${esc(o.no)}</td><td>${o.created_local || o.created}</td><td>${o.type === "purchase" ? "구매" : "배송"}</td><td>${labelOf(o.status)}</td><td>${esc(o.customer)}</td><td style="max-width:200px;white-space:normal;">${esc(o.name)}</td><td>¥${S(o).toLocaleString()}</td><td>₩${Math.round(S(o) * perJpy()).toLocaleString()}</td><td>₩${SH(o).toLocaleString()}</td><td>₩${Math.round(S(o) * perJpy() * COMMISSION_PCT / 100).toLocaleString()}</td></tr>`).join("")
      : '<tr><td colspan="10" class="empty">해당 기간 주문이 없어요.</td></tr>';
    tb.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openModal(tr.dataset.id)));
  }
  SETTLE_ROWS = rows; SETTLE_META = { from: from, to: to, typeSel: typeSel, settleSum: settleSum };
  const stale = document.getElementById("settleStale"); if (stale) stale.textContent = "";
}
function settleCsv() {
  renderSettle(); // 최신 데이터로 재집계 후 추출 (낡은 값 추출 방지)
  if (!SETTLE_ROWS || !SETTLE_META) return;
  const S = (o) => Number(o.raw.subtotal) || 0, SH = (o) => Number(o.raw.shipping_fee) || 0;
  const C = (o) => Math.round(S(o) * perJpy() * COMMISSION_PCT / 100);
  const hasSettle = SETTLE_META.settleSum > 0;
  const head = ["주문번호", "접수일(KST)", "유형", "상태", "고객", "상품요약", "상품합계(엔)", "환산(원)", "배송비(원)", "추정수수료(원)"];
  if (hasSettle) head.push("실정산(원)");
  const body = SETTLE_ROWS.map((o) => {
    const r = [o.no, o.created_local || o.created, TYPE_LABEL[o.type] || o.type, labelOf(o.status), o.customer, o.name, S(o), Math.round(S(o) * perJpy()), SH(o), C(o)];
    if (hasSettle) r.push(Number(o.raw.settle_krw) || 0);
    return r;
  });
  const sum = (f) => SETTLE_ROWS.reduce((s, o) => s + f(o), 0);
  const total = ["합계", "", "", "", "", SETTLE_ROWS.length + "건", sum(S), Math.round(sum((o) => S(o) * perJpy())), sum(SH), sum(C)];
  if (hasSettle) total.push(sum((o) => Number(o.raw.settle_krw) || 0));
  downloadCsv("정산_" + SETTLE_META.from + "_" + (TYPE_LABEL[SETTLE_META.typeSel] || "전체") + ".csv", [head].concat(body, [total]));
}
(function bindSettle() {
  const run = document.getElementById("settleRun"); if (run) run.addEventListener("click", renderSettle);
  document.querySelectorAll('input[name="settlePeriod"]').forEach((r) => r.addEventListener("change", renderSettle));
  const csv = document.getElementById("settleCsvBtn"); if (csv) csv.addEventListener("click", settleCsv);
})();

// ===== 주문 표 보기 (칸반 대안) =====
function renderOrderTable() {
  const tb = document.getElementById("orderTableRows");
  if (!tb) return;
  const list = ORDERS.filter((o) => !o.deleted && matchSearch(o)).slice().sort((a, b) => {
    let av, bv;
    if (SORT.key === "amount") { av = Number(a.amount) || 0; bv = Number(b.amount) || 0; }
    else { av = a.created || ""; bv = b.created || ""; }
    if (av < bv) return -1 * SORT.dir;
    if (av > bv) return 1 * SORT.dir;
    return 0;
  });
  tb.innerHTML = list.length
    ? list.map((o) => `<tr data-id="${o.id}" style="cursor:pointer;"><td>${esc(o.no)}</td><td>${o.type === "purchase" ? "구매" : "배송"}</td><td>${esc(o.customer)}</td><td>${esc(o.name)}</td><td><span class="status-badge ${badgeClass(o.status)}">${labelOf(o.status)}</span></td><td>¥${(o.amount || 0).toLocaleString()}</td><td>${o.created}</td><td>${esc(o.raw.tracking_no || "-")}</td></tr>`).join("")
    : '<tr><td colspan="8" class="empty">주문이 없습니다.</td></tr>';
  tb.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openModal(tr.dataset.id)));
  document.querySelectorAll("#orderTable th[data-sort]").forEach((th) => {
    const ind = th.querySelector(".sort-ind");
    if (ind) ind.textContent = (th.dataset.sort === SORT.key) ? (SORT.dir === -1 ? "▼" : "▲") : "";
  });
}
(function bindOrderView() {
  document.querySelectorAll(".view-toggle").forEach((b) => b.addEventListener("click", () => {
    VIEW = b.dataset.view;
    document.querySelectorAll(".view-toggle").forEach((x) => x.classList.toggle("active", x.dataset.view === VIEW));
    const kw = document.getElementById("kanbanWrap"), tw = document.getElementById("orderTableWrap");
    if (kw) kw.hidden = (VIEW !== "kanban");
    if (tw) tw.hidden = (VIEW !== "table");
    if (VIEW === "table") renderOrderTable();
  }));
  document.querySelectorAll("#orderTable th[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    if (SORT.key === k) SORT.dir *= -1; else { SORT.key = k; SORT.dir = -1; }
    renderOrderTable();
  }));
  const csv = document.getElementById("orderCsvBtn");
  if (csv) csv.addEventListener("click", () => {
    const list = ORDERS.filter((o) => !o.deleted && matchSearch(o));
    const head = ["주문번호", "유형", "고객", "상품", "상태", "합계(엔)", "등록일", "송장"];
    const body = list.map((o) => [o.no, TYPE_LABEL[o.type] || o.type, o.customer, o.name, labelOf(o.status), Number(o.amount) || 0, o.created, o.raw.tracking_no || ""]);
    downloadCsv("주문목록.csv", [head].concat(body));
  });
})();

// ===== 메인 배너 관리 (설정) =====
function renderBanners() {
  const box = document.getElementById("bannerList");
  if (!box) return;
  box.innerHTML = BANNERS.length
    ? BANNERS.map((b, i) => `<div class="bn-item"><img src="${safeUrl(b.url)}" alt="" onerror="this.style.display='none'"><div class="bn-meta">${esc(b.alt || "(설명 없음)")}<br><span style="color:var(--muted);font-size:12px;">${esc(b.link || "(링크 없음)")}</span></div><button class="btn btn-small" data-bn-del="${i}" style="color:var(--red);">삭제</button></div>`).join("")
    : '<p class="form-note" style="text-align:left;">등록된 배너가 없어요. 비우면 홈에 기본 자리표시가 보여요.</p>';
  box.querySelectorAll("[data-bn-del]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("이 배너를 목록에서 뺄까요? (홈에서 사라져요)")) return;
    BANNERS.splice(Number(btn.dataset.bnDel), 1);
    await saveBanners();
  }));
}
async function saveBanners() {
  try { await window.OSS.saveSetting("banners", BANNERS); renderBanners(); }
  catch (e) { alert("저장 실패: " + (e.message || e)); }
}
async function loadBanners() {
  try { const b = await window.OSS.getSetting("banners"); BANNERS = Array.isArray(b) ? b : []; }
  catch (e) { BANNERS = []; }
  renderBanners();
}
(function bindBanner() {
  const add = document.getElementById("bnAdd"); if (!add) return;
  add.addEventListener("click", async () => {
    const msg = document.getElementById("bnMsg");
    const fileEl = document.getElementById("bnFile");
    const file = fileEl && fileEl.files && fileEl.files[0];
    if (!file) { if (msg) msg.textContent = "이미지 파일을 먼저 선택하세요."; return; }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { if (msg) msg.textContent = "png·jpeg·webp 이미지만 올릴 수 있어요."; return; }
    if (file.size > 5 * 1024 * 1024) { if (msg) msg.textContent = "5MB 이하 이미지만 올릴 수 있어요."; return; }
    if (msg) msg.textContent = "업로드 중…";
    try {
      const url = await window.OSS.uploadBannerImage(file);
      BANNERS.push({ url: url, link: (document.getElementById("bnLink").value || "").trim(), alt: (document.getElementById("bnAlt").value || "").trim() });
      await window.OSS.saveSetting("banners", BANNERS);
      if (msg) msg.textContent = "✓ 추가됐어요";
      renderBanners();
      fileEl.value = ""; document.getElementById("bnLink").value = ""; document.getElementById("bnAlt").value = "";
      setTimeout(() => { if (msg) msg.textContent = ""; }, 3000);
    } catch (e) { if (msg) msg.textContent = "업로드/저장 실패: " + (e.message || e); }
  });
})();

// ----- 공지사항 (작성/목록/삭제) -----
async function loadNotices() {
  const tbody = document.getElementById("noticeRows");
  try {
    const list = await window.OSS.fetchNotices();
    tbody.innerHTML = list.length
      ? list.map((n) => `<tr>
          <td>${n.title}</td>
          <td>${n.pinned ? "📌" : "-"}</td>
          <td>${(n.created_at || "").slice(0, 10)}</td>
          <td><button class="btn btn-small remove-product" data-del="${n.id}">삭제</button></td>
        </tr>`).join("")
      : `<tr><td colspan="4" class="empty">등록된 공지가 없습니다.</td></tr>`;
    tbody.querySelectorAll("[data-del]").forEach((b) => {
      b.addEventListener("click", async () => {
        if (!confirm("이 공지를 삭제할까요?")) return;
        try { await window.OSS.deleteNotice(b.dataset.del); loadNotices(); }
        catch (e) { alert("삭제 실패: " + (e.message || e)); }
      });
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">불러오기 실패: ${e.message || e}</td></tr>`;
  }
}
document.getElementById("addNotice").addEventListener("click", async () => {
  const title = document.getElementById("noticeTitle").value.trim();
  const body = document.getElementById("noticeBody").value.trim();
  const pinned = document.getElementById("noticePinned").checked;
  if (!title) { alert("공지 제목을 입력해 주세요."); return; }
  try {
    await window.OSS.createNotice(title, body, pinned);
    document.getElementById("noticeTitle").value = "";
    document.getElementById("noticeBody").value = "";
    document.getElementById("noticePinned").checked = false;
    loadNotices();
    alert("공지가 등록되었습니다.");
  } catch (e) { alert("등록 실패: " + (e.message || e)); }
});

// ----- 설정: 센터주소 -----
async function loadCenter() {
  try {
    const c = (await window.OSS.getSetting("center_address")) || {};
    const v = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ""; };
    v("setZip", c.zip); v("setTel", c.tel); v("setReceiver", c.receiver);
    v("setAddr1", c.addr1); v("setAddr2", c.addr2);
  } catch (e) { console.error(e); }
}
document.getElementById("saveCenter").addEventListener("click", async () => {
  const val = (id) => document.getElementById(id).value.trim();
  const ok = document.getElementById("centerSaved");
  try {
    await window.OSS.saveSetting("center_address", {
      zip: val("setZip"), tel: val("setTel"), receiver: val("setReceiver"),
      addr1: val("setAddr1"), addr2: val("setAddr2"),
    });
    ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500);
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});

// ----- 설정: 요율표 -----
function renderRateRows() {
  const tb = document.getElementById("rateRows");
  tb.innerHTML = RATES.map((r, i) => `<tr>
    <td><input type="number" step="0.1" value="${r.kg}" data-i="${i}" data-f="kg" /></td>
    <td><input type="number" value="${r.air}" data-i="${i}" data-f="air" /></td>
    <td><input type="number" value="${r.sea}" data-i="${i}" data-f="sea" /></td>
    <td><button class="btn btn-small remove-product" data-del="${i}">삭제</button></td>
  </tr>`).join("");
  tb.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
    RATES[inp.dataset.i][inp.dataset.f] = Number(inp.value);
  }));
  tb.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    RATES.splice(Number(b.dataset.del), 1); renderRateRows();
  }));
}
async function loadRates() {
  try {
    const r = await window.OSS.getSetting("shipping_rates");
    RATES = Array.isArray(r) && r.length ? r : [];
  } catch (e) { RATES = []; }
  renderRateRows();
}
document.getElementById("addRate").addEventListener("click", () => { RATES.push({ kg: 0, air: 0, sea: 0 }); renderRateRows(); });
document.getElementById("loadDefaultRate").addEventListener("click", () => {
  if (!confirm("사토리 기본요율로 채울까요? 현재 입력값은 대체됩니다.")) return;
  RATES = DEFAULT_RATES.map((r) => ({ ...r })); renderRateRows();
});
document.getElementById("saveRate").addEventListener("click", async () => {
  const ok = document.getElementById("rateSaved");
  try {
    await window.OSS.saveSetting("shipping_rates", RATES);
    ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500);
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});
document.getElementById("rcCalc").addEventListener("click", () => {
  const fee = calcShippingFee(document.getElementById("rcWeight").value, document.getElementById("rcCenter").value);
  document.getElementById("rcOut").textContent = fee ? "₩" + fee.toLocaleString() : "요율 없음";
});

// ----- 설정: 회원등급 (등업 조건 · 배송비 할인율) -----
let MGRADES = [];
function renderGradeRows() {
  const tb = document.getElementById("gradeRows");
  if (!tb) return;
  tb.innerHTML = MGRADES.map((g, i) => `<tr>
    <td><input value="${String(g.name || "").replace(/"/g, "&quot;")}" data-i="${i}" data-f="name" /></td>
    <td><input type="number" value="${g.minOrders || 0}" data-i="${i}" data-f="minOrders" /></td>
    <td><input type="number" value="${g.discountPct || 0}" data-i="${i}" data-f="discountPct" /></td>
    <td><button class="btn btn-small remove-product" data-del="${i}">삭제</button></td>
  </tr>`).join("");
  tb.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
    const f = inp.dataset.f;
    MGRADES[inp.dataset.i][f] = f === "name" ? inp.value : Number(inp.value);
  }));
  tb.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    MGRADES.splice(Number(b.dataset.del), 1); renderGradeRows();
  }));
}
async function loadGrades() {
  try {
    const g = await window.OSS.getSetting("member_grades");
    MGRADES = Array.isArray(g) && g.length ? g : [];
  } catch (e) { MGRADES = []; }
  renderGradeRows();
}
const addGradeBtn = document.getElementById("addGrade");
if (addGradeBtn) addGradeBtn.addEventListener("click", () => { MGRADES.push({ name: "", minOrders: 0, discountPct: 0 }); renderGradeRows(); });
const saveGradeBtn = document.getElementById("saveGrade");
if (saveGradeBtn) saveGradeBtn.addEventListener("click", async () => {
  const ok = document.getElementById("gradeSaved");
  try {
    await window.OSS.saveSetting("member_grades", MGRADES);
    if (ok) { ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500); }
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});
loadGrades();

// ----- 설정: 이용안내 페이지 편집 -----
const PAGE_TITLES = {
  "guide-how": "이용방법",
  "guide-purchase": "구매대행 이용안내",
  "guide-delivery": "배송대행 이용안내",
  "guide-customs": "통관·관세 안내",
  "guide-refund": "취소·환불·반품 안내",
};
async function loadPageEditor() {
  const slug = document.getElementById("pageSlug").value;
  try {
    const p = await window.OSS.getPage(slug);
    document.getElementById("pageTitle").value = (p && p.title) || PAGE_TITLES[slug] || "";
    document.getElementById("pageBody").value = (p && p.body) || "";
  } catch (e) { console.error(e); }
}
document.getElementById("pageSlug").addEventListener("change", loadPageEditor);
document.getElementById("savePage").addEventListener("click", async () => {
  const slug = document.getElementById("pageSlug").value;
  const title = document.getElementById("pageTitle").value.trim() || PAGE_TITLES[slug];
  const body = document.getElementById("pageBody").value;
  const ok = document.getElementById("pageSaved");
  try {
    await window.OSS.savePage(slug, title, body);
    ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500);
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});

// ----- 설정: 환율 -----
async function loadFx() {
  try {
    const fx = (await window.OSS.getSetting("exchange_rate")) || {};
    const v = (id, val) => { const e = document.getElementById(id); if (e && val != null) e.value = val; };
    v("setFxApplied", fx.applied); v("setFxGosi", fx.gosi); v("setFxDuty", fx.dutyFreeLimit);
    const fee = (await window.OSS.getSetting("fee_policy")) || {};
    v("setCommission", fee.commissionPct != null ? fee.commissionPct : 3);
    v("setFreeDays", fee.freeStorageDays != null ? fee.freeStorageDays : 30);
    v("setStorageDay", fee.storagePerDayKrw != null ? fee.storagePerDayKrw : 0);
    COMMISSION_PCT = Number(fee.commissionPct) || 3;   // 정산 추정 수수료에 사용
    DELAY_DAYS = Number(fee.delayDays) || 7;            // 대시보드 지연 경보 기준일
    if (fx.applied) FX_APPLIED = Number(fx.applied) || FX_APPLIED;
  } catch (e) { console.error(e); }
}
document.getElementById("saveFx").addEventListener("click", async () => {
  const num = (id) => { const x = Number(document.getElementById(id).value); return isFinite(x) ? x : 0; };
  const ok = document.getElementById("fxSaved");
  try {
    await window.OSS.saveSetting("exchange_rate", {
      applied: num("setFxApplied"), gosi: num("setFxGosi"), dutyFreeLimit: num("setFxDuty"),
      updatedAt: new Date().toISOString(),
    });
    FX_APPLIED = num("setFxApplied") || FX_APPLIED;
    ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500);
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});

document.getElementById("saveFee").addEventListener("click", async () => {
  const num = (id) => { const x = Number(document.getElementById(id).value); return isFinite(x) ? x : 0; };
  const ok = document.getElementById("feeSaved");
  try {
    await window.OSS.saveSetting("fee_policy", {
      commissionPct: num("setCommission"), freeStorageDays: num("setFreeDays"), storagePerDayKrw: num("setStorageDay"),
      updatedAt: new Date().toISOString(),
    });
    ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500);
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});

// ----- 설정: 이용후기 -----
let REVIEWS = [];
function renderReviewRows() {
  const box = document.getElementById("reviewRows");
  box.innerHTML = REVIEWS.map((r, i) => `<div class="review-edit-row">
    <input placeholder="작성자 (예: 양*향)" value="${(r.author||"").replace(/"/g,'&quot;')}" data-i="${i}" data-f="author" style="width:130px;" />
    <select data-i="${i}" data-f="rating">${[5,4,3,2,1].map(n=>`<option value="${n}" ${Number(r.rating)===n?"selected":""}>${"★".repeat(n)}</option>`).join("")}</select>
    <input placeholder="후기 내용" value="${(r.text||"").replace(/"/g,'&quot;')}" data-i="${i}" data-f="text" style="flex:1;min-width:200px;" />
    <button class="btn btn-small remove-product" data-del="${i}">삭제</button>
  </div>`).join("") || '<p class="form-note" style="text-align:left;">등록된 후기가 없습니다. "+ 후기 추가"를 누르세요.</p>';
  box.querySelectorAll("input,select").forEach((inp) => inp.addEventListener("input", () => {
    REVIEWS[inp.dataset.i][inp.dataset.f] = inp.dataset.f === "rating" ? Number(inp.value) : inp.value;
  }));
  box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    REVIEWS.splice(Number(b.dataset.del), 1); renderReviewRows();
  }));
}
async function loadReviews() {
  try {
    const r = await window.OSS.getSetting("reviews");
    REVIEWS = Array.isArray(r) ? r : [];
  } catch (e) { REVIEWS = []; }
  renderReviewRows();
}
document.getElementById("addReview").addEventListener("click", () => { REVIEWS.push({ author: "", rating: 5, text: "" }); renderReviewRows(); });
document.getElementById("saveReviews").addEventListener("click", async () => {
  const ok = document.getElementById("reviewSaved");
  try {
    await window.OSS.saveSetting("reviews", REVIEWS.filter((r) => (r.text || "").trim()));
    ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500);
  } catch (e) { alert("저장 실패: " + (e.message || e)); }
});

// ----- 설정: 상단 띠배너 문구 -----
async function loadTopbar() {
  try { const v = await window.OSS.getSetting("topbar"); const el = document.getElementById("setTopbar"); if (el) el.value = (typeof v === "string" ? v : (v && v.text)) || ""; } catch (e) {}
}
document.getElementById("saveTopbar")?.addEventListener("click", async () => {
  const ok = document.getElementById("topbarSaved");
  try { await window.OSS.saveSetting("topbar", document.getElementById("setTopbar").value.trim()); ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500); }
  catch (e) { alert("저장 실패: " + (e.message || e)); }
});

// ----- 설정: FAQ -----
let FAQS = [];
const FAQ_CATS = ["배송/통관", "결제", "취소/환불", "회원관리", "기타"];
function renderFaqRows() {
  const box = document.getElementById("faqRows");
  if (!box) return;
  box.innerHTML = FAQS.map((f, i) => `<div class="review-edit-row" style="align-items:flex-start;">
    <select data-i="${i}" data-f="category" style="width:120px;">${FAQ_CATS.map((c) => `<option ${f.category === c ? "selected" : ""}>${c}</option>`).join("")}</select>
    <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:6px;">
      <input placeholder="질문" value="${(f.q || "").replace(/"/g, "&quot;")}" data-i="${i}" data-f="q" />
      <textarea placeholder="답변" data-i="${i}" data-f="a" rows="2" style="padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:13px;background:#fbfcfe;">${(f.a || "").replace(/</g, "&lt;")}</textarea>
    </div>
    <button class="btn btn-small remove-product" data-del="${i}">삭제</button>
  </div>`).join("") || '<p class="form-note" style="text-align:left;">등록된 FAQ가 없습니다.</p>';
  box.querySelectorAll("input,select,textarea").forEach((el) => el.addEventListener("input", () => { FAQS[el.dataset.i][el.dataset.f] = el.value; }));
  box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { FAQS.splice(Number(b.dataset.del), 1); renderFaqRows(); }));
}
async function loadFaq() {
  try { const f = await window.OSS.getSetting("faq"); FAQS = Array.isArray(f) ? f : []; } catch (e) { FAQS = []; }
  renderFaqRows();
}
document.getElementById("addFaq")?.addEventListener("click", () => { FAQS.push({ category: "배송/통관", q: "", a: "" }); renderFaqRows(); });
document.getElementById("saveFaq")?.addEventListener("click", async () => {
  const ok = document.getElementById("faqSaved");
  try { await window.OSS.saveSetting("faq", FAQS.filter((f) => (f.q || "").trim())); ok.textContent = "✓ 저장됨"; setTimeout(() => (ok.textContent = ""), 2500); }
  catch (e) { alert("저장 실패: " + (e.message || e)); }
});

// ----- 1:1 문의 관리 -----
let INQUIRIES = [];
function inqBadge(s) { return s === "답변완료" ? "status-done" : (s === "확인중" ? "status-progress" : "status-new"); }
async function loadInquiries() {
  const tbody = document.getElementById("inquiryRows");
  const recent = document.getElementById("recentInquiries");
  try {
    INQUIRIES = await window.OSS.fetchInquiries();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty">불러오기 실패(문의 테이블 미생성?): ${e.message || e}</td></tr>`;
    return;
  }
  const esc = (s) => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (tbody) {
    tbody.innerHTML = INQUIRIES.length ? INQUIRIES.map((q) => `
      <tr class="inq-head-row" data-id="${q.id}" style="cursor:pointer;">
        <td>${esc(q.category)}</td><td>${esc(q.title)}</td><td>${esc(q.name)}</td>
        <td>${(q.created_at || "").slice(0, 10)}</td>
        <td><span class="status-badge ${inqBadge(q.status)}">${esc(q.status || "답변대기")}</span></td>
      </tr>
      <tr class="inq-detail-row" data-detail="${q.id}" hidden><td colspan="5" style="background:#fbfaf8;">
        <p style="margin:0 0 8px;"><b>연락처</b> ${esc(q.phone)} ${q.order_no ? " · <b>주문</b> " + esc(q.order_no) : ""}</p>
        <p style="white-space:pre-wrap;margin:0 0 12px;">${esc(q.body)}</p>
        <textarea id="ans-${q.id}" rows="3" placeholder="답변 내용" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-family:inherit;">${esc(q.answer)}</textarea>
        <div class="set-actions" style="margin-top:8px;">
          <button class="btn btn-primary btn-small" data-ans="${q.id}">답변 저장</button>
          <button class="btn btn-small remove-product" data-delinq="${q.id}">삭제</button>
        </div>
      </td></tr>`).join("") : `<tr><td colspan="5" class="empty">접수된 문의가 없습니다.</td></tr>`;
    tbody.querySelectorAll(".inq-head-row").forEach((r) => r.addEventListener("click", () => {
      const d = tbody.querySelector(`[data-detail="${r.dataset.id}"]`); if (d) d.hidden = !d.hidden;
    }));
    tbody.querySelectorAll("[data-ans]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.ans; const ans = document.getElementById("ans-" + id).value.trim();
      if (!ans) { alert("답변 내용을 입력하세요."); return; }
      try { await window.OSS.answerInquiry(id, ans); alert("답변이 저장되었습니다. (고객에게는 연락처로 안내해 주세요)"); loadInquiries(); }
      catch (e) { alert("저장 실패: " + (e.message || e)); }
    }));
    tbody.querySelectorAll("[data-delinq]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 문의를 삭제할까요?")) return;
      try { await window.OSS.deleteInquiry(b.dataset.delinq); loadInquiries(); } catch (e) { alert("삭제 실패: " + (e.message || e)); }
    }));
  }
  if (recent) {
    const top = INQUIRIES.slice(0, 5);
    recent.innerHTML = top.length ? top.map((q) => `<tr><td>${esc(q.title)}</td><td>${esc(q.name)}</td><td><span class="status-badge ${inqBadge(q.status)}">${esc(q.status || "답변대기")}</span></td></tr>`).join("") : `<tr><td colspan="3" class="empty">접수된 문의가 없습니다.</td></tr>`;
  }
}

// 시작
init();
loadCenter();
loadRates();
if (window.OSS && window.OSS.getSetting) window.OSS.getSetting("exchange_rate").then((fx) => { if (fx && fx.applied) FX_APPLIED = Number(fx.applied) || FX_APPLIED; }).catch(() => {});
loadPageEditor();
loadFx();
loadReviews();
loadFaq();
loadInquiries();
loadTopbar();
loadBanners();
