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
    return Number(center === "sea" ? row.sea : row.air) || 0;
  }
  return 0; // 요율 미설정
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
    flag: row.flag || "",
    deleted: !!row.deleted_at,
    raw: row,
  };
}

// ----- 로그인 가드 + 초기 로드 -----
async function init() {
  const session = await window.OSS.adminGetSession();
  if (!session) { location.href = "admin-login.html"; return; }

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
  });
});

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
      <span class="kc-id">${o.flag ? (FLAG_DOT[o.flag] || "") + " " : ""}${o.no}</span>
      <span class="kc-type ${o.type}">${o.type === "purchase" ? "구매" : "배송"}</span>
    </div>
    <div class="kc-name">${o.name}</div>
    ${o.bundleId ? `<div class="kc-bundle">🔗 ${o.bundleId}</div>` : ""}
    ${o.raw && o.raw.tracking_no ? `<div class="kc-bundle">📦 ${o.raw.tracking_no}</div>` : ""}
    <div class="kc-cust">👤 ${o.customer}</div>
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
        <td>
          <button class="btn btn-small" data-restore="${o.id}">복원</button>
          <button class="btn btn-small remove-product" data-perm="${o.id}">영구삭제</button>
        </td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">휴지통이 비어 있습니다.</td></tr>`;
  tb.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", async () => {
    const o = ORDERS.find((x) => x.id === b.dataset.restore);
    try { await window.OSS.updateApplication(o.id, { deleted_at: null }); o.deleted = false; o.raw.deleted_at = null; renderKanban(); renderDashboard(); }
    catch (e) { alert("복원 실패: " + (e.message || e)); }
  }));
  tb.querySelectorAll("[data-perm]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("정말 영구 삭제할까요? 되돌릴 수 없습니다.")) return;
    const id = b.dataset.perm;
    try { await window.OSS.deleteApplication(id); ORDERS = ORDERS.filter((x) => x.id !== id); renderKanban(); renderDashboard(); }
    catch (e) { alert("영구삭제 실패: " + (e.message || e) + "\n(권한 정책이 없으면 복원만 사용하세요)"); }
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
function bindCardClick() {
  document.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}
function openModal(id) {
  const o = ORDERS.find((x) => x.id === id);
  if (!o) return;
  modalOrderId = id;
  const r = o.raw;
  const products = Array.isArray(r.products) ? r.products : [];
  const prodHtml = products.map((p, i) =>
    `${i + 1}) ${p.name || "-"} ${p.category ? "[" + p.category + "]" : ""} ¥${p.price || 0} × ${p.qty || 0}` +
    (p.orderNo ? ` / 오더:${p.orderNo}` : "") + (p.url ? `<br><a href="${p.url}" target="_blank" style="color:var(--blue);font-size:12px;">상품링크 ↗</a>` : "")
  ).join("<br>");
  document.getElementById("modalName").textContent = o.name;
  document.getElementById("modalId").textContent = `${o.no} · ${o.type === "purchase" ? "구매대행" : "배송대행"} · ${o.created}`;
  document.getElementById("modalDetail").innerHTML = `
    <div class="detail-row"><span class="dk">신청자</span><span class="dv">${r.applicant_name || "-"} (${r.applicant_phone || "-"})</span></div>
    <div class="detail-row"><span class="dk">이메일/카톡</span><span class="dv">${r.applicant_email || "-"} / ${r.applicant_kakao || "-"}</span></div>
    <div class="detail-row"><span class="dk">상품</span><span class="dv">${prodHtml || "-"}</span></div>
    <div class="detail-row"><span class="dk">합계</span><span class="dv">¥${(r.subtotal || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="dk">검수/옵션</span><span class="dv">${r.inspect || "없음"}${(r.addons && r.addons.length) ? " · " + r.addons.join(", ") : ""}</span></div>
    <div class="detail-row"><span class="dk">수취인</span><span class="dv">${r.receiver_name || "-"} (${r.receiver_phone || "-"})</span></div>
    <div class="detail-row"><span class="dk">통관부호</span><span class="dv">${r.customs_code || "-"}</span></div>
    <div class="detail-row"><span class="dk">주소</span><span class="dv">[${r.zipcode || "-"}] ${r.address || "-"}</span></div>
    <div class="detail-row"><span class="dk">배송방법</span><span class="dv">${r.ship_method || "-"}</span></div>
    <div class="detail-row"><span class="dk">요청사항</span><span class="dv">${r.memo || "-"}</span></div>`;
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
  const w = document.getElementById("modalWeight").value;
  const c = document.getElementById("modalCenter").value;
  const fee = calcShippingFee(w, c);
  document.getElementById("modalFee").textContent = fee ? "₩" + fee.toLocaleString() : "-";
});

document.getElementById("modalSave").addEventListener("click", async () => {
  const o = ORDERS.find((x) => x.id === modalOrderId);
  if (o) {
    const prev = { status: o.status, raw: { ...o.raw } };
    const newStatus = document.getElementById("modalStatus").value;
    const weight = document.getElementById("modalWeight").value;
    const center = document.getElementById("modalCenter").value;
    const fee = calcShippingFee(weight, center);
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

  // 문의는 2단계(게시판) 연동 전 안내
  const inqEmpty = `<tr><td colspan="3" class="empty">문의 기능은 2단계에서 연동됩니다.</td></tr>`;
  document.getElementById("recentInquiries").innerHTML = inqEmpty;
  const inqEmpty2 = `<tr><td colspan="4" class="empty">문의 기능은 2단계에서 연동됩니다.</td></tr>`;
  document.getElementById("inquiryRows").innerHTML = inqEmpty2;
}
function badgeClass(s) {
  if (s === "신규접수") return "status-new";
  if (s === "배송완료") return "status-done";
  if (EXCEPTION.some((e) => e.key === s)) return "status-hold";
  return "status-progress";
}

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
  document.getElementById("rcOut").textContent = fee ? "¥" + fee.toLocaleString() : "요율 없음";
});

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

// 시작
init();
loadCenter();
loadRates();
loadPageEditor();
loadFx();
loadReviews();
