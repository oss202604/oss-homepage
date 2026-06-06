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

// 임시 국제배송비 요율표 (0.5kg 단위) — 실제 요율로 교체 예정
const RATE = {
  air: { base: 8000, step: 4000 },  // 항공: 0.5kg 8,000원, 이후 0.5kg마다 +4,000
  sea: { base: 5000, step: 2500 },  // 해상: 0.5kg 5,000원, 이후 0.5kg마다 +2,500
};
function calcShippingFee(weightKg, center) {
  const w = Number(weightKg);
  if (!w || w <= 0) return 0;
  const r = RATE[center] || RATE.air;
  const units = Math.ceil(w / 0.5);
  return r.base + (units - 1) * r.step;
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
    type: row.type,
    name: name,
    customer: row.applicant_name || "-",
    amount: row.subtotal || 0,
    status: row.status || "신규접수",
    created: (row.created_at || "").slice(0, 10),
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

// ----- 칸반 렌더 -----
function cardHtml(o) {
  return `<div class="kanban-card" draggable="true" data-id="${o.id}">
    <div class="kc-top">
      <span class="kc-id">${o.no}</span>
      <span class="kc-type ${o.type}">${o.type === "purchase" ? "구매" : "배송"}</span>
    </div>
    <div class="kc-name">${o.name}</div>
    <div class="kc-cust">👤 ${o.customer}</div>
    <div class="kc-amount">¥${(o.amount || 0).toLocaleString()}</div>
  </div>`;
}
function colHtml(s, isExc) {
  const items = ORDERS.filter((o) => o.status === s.key);
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
}

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
  modal.hidden = false;
}
document.getElementById("modalClose").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

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
    const fields = {
      status: newStatus,
      center_type: center,
      weight_kg: weight ? Number(weight) : null,
      shipping_fee: fee || null,
    };
    o.status = newStatus;
    o.raw.weight_kg = fields.weight_kg;
    o.raw.shipping_fee = fields.shipping_fee;
    o.raw.center_type = center;
    renderKanban(); renderDashboard();
    try {
      await window.OSS.updateApplication(o.id, fields);
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
      o.status = prev.status; o.raw = prev.raw; renderKanban(); renderDashboard();
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

// ----- 공지 등록 (2단계 게시판 연동 전 안내) -----
document.getElementById("addNotice").addEventListener("click", () => {
  alert("공지 게시판은 2단계에서 연동됩니다. (현재는 주문관리까지 동작)");
});

// 시작
init();
