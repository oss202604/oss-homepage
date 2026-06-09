// ===== 히어로 슬라이더 (메인에만 존재) =====
const slider = document.getElementById("slider");
if (slider) {
  const slides = slider.querySelectorAll(".slide");
  const dotsWrap = document.getElementById("sliderDots");
  let current = 0;
  let timer = null;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => { goToSlide(i); resetTimer(); });
    dotsWrap.appendChild(dot);
  });
  const dots = dotsWrap.querySelectorAll("button");

  function goToSlide(i) {
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");
    current = (i + slides.length) % slides.length;
    slides[current].classList.add("active");
    dots[current].classList.add("active");
  }
  function nextSlide() { goToSlide(current + 1); }
  function prevSlide() { goToSlide(current - 1); }
  function resetTimer() { clearInterval(timer); timer = setInterval(nextSlide, 5000); }

  document.getElementById("nextSlide").addEventListener("click", () => { nextSlide(); resetTimer(); });
  document.getElementById("prevSlide").addEventListener("click", () => { prevSlide(); resetTimer(); });
  resetTimer();
}

// ===== 모바일 메뉴 =====
const menuToggle = document.getElementById("menuToggle");
const mainMenu = document.getElementById("mainMenu");
if (menuToggle && mainMenu) {
  menuToggle.addEventListener("click", () => mainMenu.classList.toggle("open"));
  mainMenu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => mainMenu.classList.remove("open"))
  );
}

// ===== 공통 푸터 렌더 (전 페이지 통일) =====
(function renderFooter() {
  const f = document.querySelector(".site-footer");
  if (!f) return;
  // 기본값 (관리자 설정이 있으면 아래에서 덮어씀)
  const biz = {
    company: "OSS (オッス)",
    desc: "일본 현지인이 직접 운영하는 구매대행 · 배송대행지",
    email: "oss202604@gmail.com",
    kakao: "@OSS (등록 예정)",
    hours: "평일 10:00 ~ 18:00 (일본시간)",
    bizline: "사업자 정보 등록 준비중",
  };
  function paint() {
    f.innerHTML =
      '<div class="container footer-cols">' +
        '<div class="footer-col">' +
          '<p class="footer-logo">OSS <small>オッス</small></p>' +
          '<p class="footer-desc">' + biz.desc + '</p>' +
          '<p class="footer-biz">' + biz.bizline + '</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<p class="footer-col-tit">고객센터</p>' +
          '<p><i data-lucide="mail" class="ico-inline"></i> ' + biz.email + '</p>' +
          '<p><i data-lucide="message-circle" class="ico-inline"></i> 카카오톡 ' + biz.kakao + '</p>' +
          '<p><i data-lucide="clock" class="ico-inline"></i> ' + biz.hours + '</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<p class="footer-col-tit">바로가기</p>' +
          '<a href="order.html">구매대행 신청</a>' +
          '<a href="delivery.html">배송대행 신청</a>' +
          '<a href="order-lookup.html">주문조회</a>' +
          '<a href="faq.html">자주 묻는 질문(FAQ)</a>' +
          '<a href="contact.html">1:1 문의</a>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom"><div class="container footer-bottom-inner">' +
        '<nav class="footer-links">' +
          '<a href="index.html#about">회사소개</a>' +
          '<a href="terms.html">이용약관</a>' +
          '<a href="privacy.html">개인정보처리방침</a>' +
          '<a href="refund.html">취소·환불정책</a>' +
          '<a href="notice.html">공지사항</a>' +
          '<a href="faq.html">FAQ</a>' +
          '<a href="contact.html">1:1 문의</a>' +
        '</nav>' +
        '<span class="footer-copy">© 2026 OSS. All rights reserved.</span>' +
      '</div></div>';
    if (window.lucide) lucide.createIcons();
  }
  paint();
  // 관리자 설정(settings.footer_biz)이 있으면 덮어쓰기
  if (window.OSS && window.OSS.getSetting) {
    window.OSS.getSetting("footer_biz").then((v) => {
      if (v && typeof v === "object") { Object.assign(biz, v); paint(); }
    }).catch(() => {});
  }
})();

// ===== 공통 상담 버튼 (전 페이지 통일) =====
(function renderChatFab() {
  if (document.querySelector(".chat-fab")) return;
  const a = document.createElement("a");
  a.href = "order.html";
  a.className = "chat-fab";
  a.title = "문의하기";
  a.innerHTML = '<i data-lucide="message-circle"></i>';
  document.body.appendChild(a);
  if (window.lucide) lucide.createIcons();
})();

// ===== 우측 고정 퀵메뉴 (전 페이지 공통) =====
(function renderQuickMenu() {
  if (document.querySelector(".quick-menu")) return; // 메인 등 이미 있으면 건너뜀
  const items = [
    ["notice.html", "headphones", "고객센터"],
    ["order.html", "shopping-bag", "구매대행"],
    ["delivery.html", "package", "배송대행"],
    ["index.html#fee", "calculator", "예상비용"],
    ["guide.html", "book-open", "이용가이드"],
  ];
  const aside = document.createElement("aside");
  aside.className = "quick-menu";
  aside.innerHTML =
    items.map(([h, ic, l]) => `<a href="${h}" class="qm-item"><span class="qm-ico"><i data-lucide="${ic}"></i></span>${l}</a>`).join("") +
    '<button class="qm-top" type="button" title="맨 위로"><i data-lucide="chevron-up" class="ico-inline"></i><br /><small>TOP</small></button>';
  document.body.appendChild(aside);
  aside.querySelector(".qm-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  if (window.lucide) lucide.createIcons();
})();

// ===== 고객센터 사이드바 (공지·문의·FAQ·후기 허브) =====
(function renderCsSidebar() {
  const el = document.querySelector(".cs-sidebar");
  if (!el) return;
  const active = el.dataset.cs || "";
  const items = [
    ["notice", "notice.html", "📢 공지사항"],
    ["contact", "contact.html", "💬 1:1 문의"],
    ["faq", "faq.html", "❓ 자주 묻는 질문"],
    ["review", "index.html#reviews", "⭐ 이용후기"],
  ];
  el.innerHTML = '<p class="cs-sidebar-title">고객센터</p>' +
    items.map(([k, h, l]) => `<a href="${h}" class="${k === active ? "active" : ""}">${l}</a>`).join("");
})();

// ===== "전체 서비스" 드롭다운 (모든 페이지 공통) =====
const catBtn = document.querySelector(".cat-btn");
const navInner = document.querySelector(".main-nav-inner");
if (catBtn && navInner) {
  const panel = document.createElement("div");
  panel.className = "cat-panel";
  panel.hidden = true;
  panel.innerHTML = [
    ["order.html", "🛍️", "구매대행 신청"],
    ["delivery.html", "📦", "배송대행 신청"],
    ["guide.html", "📘", "이용가이드"],
    ["index.html#fee", "🧮", "예상비용 안내"],
    ["notice.html", "📢", "공지사항"],
    ["order-lookup.html", "🔎", "주문조회"],
  ].map(([href, emo, label]) => `<a href="${href}"><span>${emo}</span>${label}</a>`).join("");
  navInner.appendChild(panel);

  const toggledPanel = (show) => {
    panel.hidden = typeof show === "boolean" ? !show : !panel.hidden;
    catBtn.classList.toggle("open", !panel.hidden);
  };
  catBtn.addEventListener("click", (e) => { e.stopPropagation(); toggledPanel(); });
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => toggledPanel(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggledPanel(false); });
}

// ===== 상단 검색 → 구매대행 신청으로 연결 (입력값 전달) =====
document.querySelectorAll(".search-box").forEach((box) => {
  box.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (box.querySelector("input")?.value || "").trim();
    if (q) {
      try { sessionStorage.setItem("oss_search", q); } catch (_) {}
    }
    location.href = "order.html";
  });
});

// ===== 배대지 주소 (설정에서 로드, 배송대행 페이지) =====
const centerAddrBox = document.getElementById("centerAddrBox");
if (centerAddrBox && window.OSS && window.OSS.getSetting) {
  window.OSS.getSetting("center_address").then((c) => {
    if (c && (c.addr1 || c.zip)) {
      centerAddrBox.innerHTML =
        `받는사람: ${c.receiver || "OSS / 고객번호"}<br>` +
        `${c.zip || ""} ${c.addr1 || ""} ${c.addr2 || ""}<br>` +
        `Tel: ${c.tel || ""}`;
    }
  }).catch(() => {});
}

// ===== 맨 위로 =====
const scrollTopBtn = document.getElementById("scrollTop");
if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );
}

// ===== 신청서 단계 전환 (구매대행/배송대행) =====
const stepPanel1 = document.getElementById("stepPanel1");
const stepPanel2 = document.getElementById("stepPanel2");
const stepPanel2Form = document.getElementById("stepPanel2Form"); // 배송대행에만 존재
const goStep2Btn = document.getElementById("goStep2");
const backToStep1Btn = document.getElementById("backToStep1");
const agreeCheck = document.getElementById("agreeCheck");
const stepBar = document.getElementById("stepBar");

function setStep(n) {
  if (!stepPanel1 || !stepPanel2) return;
  if (n === 1) {
    stepPanel1.hidden = false;
    stepPanel2.hidden = true;
    if (stepPanel2Form) stepPanel2Form.hidden = true;
  } else if (n === 2) {
    stepPanel1.hidden = true;
    stepPanel2.hidden = false;
    if (stepPanel2Form) stepPanel2Form.hidden = false;
  }
  if (stepBar) {
    stepBar.querySelectorAll(".step-bar-item").forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle("active", s === n);
      el.classList.toggle("done", s < n);
    });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (goStep2Btn) {
  goStep2Btn.addEventListener("click", () => {
    if (!agreeCheck || !agreeCheck.checked) {
      alert("주의사항 확인 후 동의에 체크해 주세요.");
      return;
    }
    setStep(2);
  });
}
if (backToStep1Btn) {
  backToStep1Btn.addEventListener("click", () => setStep(1));
}

// ===== 상품 추가/삭제 + 합계 계산 (신청서 페이지) =====
const productList = document.getElementById("productList");
const addProduct = document.getElementById("addProduct");
const subtotalEl = document.getElementById("subtotal");

// 번호 다시 매기기 + 복사/삭제 버튼 정리
function renumberProducts() {
  if (!productList) return;
  const items = productList.querySelectorAll(".product-item");
  items.forEach((item, i) => {
    const noEl = item.querySelector(".product-item-no");
    if (noEl) noEl.textContent = i + 1;
    const head = item.querySelector(".product-item-head");
    if (!head) return;
    // 기존 복사/삭제 버튼 제거 후 재생성 (클론 중복 방지)
    head.querySelectorAll(".copy-product, .remove-product").forEach((b) => b.remove());
    // 복사 버튼 (모든 행) — 현재 입력값까지 복제
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn btn-small copy-product";
    copy.textContent = "⧉ 복사";
    copy.addEventListener("click", () => {
      const clone = item.cloneNode(true);
      clone.querySelectorAll(".copy-product, .remove-product").forEach((b) => b.remove());
      const src = item.querySelectorAll("input, select, textarea");
      const dst = clone.querySelectorAll("input, select, textarea");
      src.forEach((s, idx) => {
        const d = dst[idx]; if (!d) return;
        if (s.type === "checkbox" || s.type === "radio") d.checked = s.checked;
        else d.value = s.value;
      });
      item.after(clone);
      renumberProducts(); recalcSubtotal();
    });
    head.appendChild(copy);
    // 삭제 버튼 (2번째 행부터)
    if (i > 0) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-small remove-product";
      del.textContent = "− 삭제";
      del.addEventListener("click", () => { item.remove(); renumberProducts(); recalcSubtotal(); });
      head.appendChild(del);
    }
  });
}

// 합계 계산: 단가 × 수량 합 (배송대행은 세금/배송비/할인 반영)
function recalcSubtotal() {
  if (!productList || !subtotalEl) return;
  let sum = 0;
  productList.querySelectorAll(".product-item").forEach((item) => {
    const price = Number(item.querySelector('[name="productPrice[]"]')?.value) || 0;
    const qty = Number(item.querySelector('[name="productQty[]"]')?.value) || 0;
    sum += price * qty;
  });
  // 배송대행 금액줄 (있을 때만)
  const tax = Number(document.querySelector('[name="salesTax"]')?.value) || 0;
  const localShip = Number(document.querySelector('[name="localShip"]')?.value) || 0;
  const discount = Number(document.querySelector('[name="discount"]')?.value) || 0;
  sum = sum + tax + localShip - discount;
  if (sum < 0) sum = 0;
  subtotalEl.textContent = "¥" + sum.toLocaleString();
}

if (productList && addProduct) {
  const template = productList.querySelector(".product-item").cloneNode(true);

  addProduct.addEventListener("click", () => {
    const item = template.cloneNode(true);
    item.querySelectorAll("input").forEach((inp) => {
      if (inp.type === "number" && inp.name === "productQty[]") { inp.value = "1"; }
      else if (inp.type === "number") { inp.value = ""; }
      else { inp.value = ""; }
    });
    item.querySelectorAll("select").forEach((sel) => { sel.selectedIndex = 0; });
    productList.appendChild(item);
    renumberProducts();
    recalcSubtotal();
  });

  // 입력 변할 때마다 합계 갱신
  productList.addEventListener("input", recalcSubtotal);
  document.querySelectorAll('[name="salesTax"],[name="localShip"],[name="discount"]')
    .forEach((el) => el.addEventListener("input", recalcSubtotal));
  const applyAmount = document.getElementById("applyAmount");
  if (applyAmount) applyAmount.addEventListener("click", recalcSubtotal);

  // 메인 검색에서 넘어온 값 자동 채우기
  try {
    const q = sessionStorage.getItem("oss_search");
    if (q) {
      sessionStorage.removeItem("oss_search");
      const first = productList.querySelector(".product-item");
      const isUrl = /^https?:\/\//i.test(q);
      const sel = isUrl ? '[name="productUrl[]"]' : '[name="productName[]"]';
      const field = first && first.querySelector(sel);
      if (field) field.value = q;
    }
  } catch (_) {}

  renumberProducts();
  recalcSubtotal();
}

// ===== 신청서 제출 (현재는 미리보기) =====
const form = document.getElementById("orderForm");
const modal = document.getElementById("resultModal");
const formLoadAt = Date.now(); // 봇 초고속 제출 차단용
if (form && modal) {
  const resultContent = document.getElementById("resultContent");
  const g = (n) => new FormData(form).get(n) || "-";

  // 주문번호 발급: OSS-YYMMDD-XXXXX (사람이 읽기 쉽고 고유)
  function genOrderNo() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `OSS-${yy}${mm}${dd}-${rnd}`;
  }

  // 폼 → DB 저장용 payload 만들기
  function buildPayload(orderNo) {
    const data = new FormData(form);
    const isDelivery = !!document.querySelector('[name="productOrderNo[]"]');
    const names = data.getAll("productName[]");
    const products = names.map((n, i) => ({
      name: n,
      brand: data.getAll("productBrand[]")[i] || "",
      code: data.getAll("productCode[]")[i] || "",
      price: Number(data.getAll("productPrice[]")[i]) || 0,
      qty: Number(data.getAll("productQty[]")[i]) || 0,
      category: data.getAll("productCategory[]")[i] || "",
      color: data.getAll("productColor[]")[i] || "",
      size: data.getAll("productSize[]")[i] || "",
      url: data.getAll("productUrl[]")[i] || "",
      orderNo: data.getAll("productOrderNo[]")[i] || "",
      shipName: data.getAll("productShipName[]")[i] || "",
      memo: data.getAll("productMemo[]")[i] || "",
    }));
    const center = document.querySelector('input[name="centerType"]:checked');
    const subNum = Number((subtotalEl?.textContent || "0").replace(/[^0-9]/g, "")) || 0;
    return {
      order_no: orderNo,
      type: isDelivery ? "delivery" : "purchase",
      center_type: center ? center.value : null,
      applicant_name: data.get("name") || "",
      applicant_phone: data.get("phone") || "",
      applicant_email: data.get("email") || "",
      applicant_kakao: data.get("kakao") || "",
      receiver_name: data.get("receiver") || "",
      receiver_phone: data.get("receiverPhone") || "",
      receiver_phone2: data.get("receiverPhone2") || "",
      customs_code: data.get("ccode") || "",
      zipcode: data.get("zipcode") || "",
      ship_method: data.get("shipMethod") || "",
      address: data.get("address") || "",
      courier_memo: data.get("courierMemo") || "",
      products: products,
      inspect: data.get("inspect") || "없음",
      addons: data.getAll("addon[]"),
      subtotal: subNum,
      due_date: data.get("dueDate") || "",
      memo: data.get("memo") || "",
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    // 봇 방지 1: 함정 필드(사람 눈엔 안 보임)가 채워졌으면 봇 → 조용히 차단
    const hp = form.querySelector('[name="_hp"]');
    if (hp && hp.value.trim() !== "") { return; }
    // 봇 방지 2: 페이지 열고 2.5초 안에 제출하면 사람이 아님 → 차단
    if (Date.now() - formLoadAt < 2500) {
      alert("잠시 후 다시 시도해 주세요.");
      return;
    }

    const orderNo = genOrderNo();

    // Supabase 연결돼 있으면 DB 저장
    if (window.OSS && window.OSS.submitApplication) {
      const submitBtn = form.querySelector('button[type="submit"]');
      const orig = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "접수 중..."; }
      try {
        await window.OSS.submitApplication(buildPayload(orderNo));
      } catch (err) {
        console.error(err);
        alert("접수 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.\n(" + (err.message || err) + ")");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = orig; }
        return;
      }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = orig; }
    }

    const data = new FormData(form);
    const lines = [];
    const names = data.getAll("productName[]");
    const prices = data.getAll("productPrice[]");
    const qtys = data.getAll("productQty[]");
    const cats = data.getAll("productCategory[]");
    const urls = data.getAll("productUrl[]");
    const orderNos = data.getAll("productOrderNo[]"); // 배송대행만

    lines.push(`■ 주문번호: ${orderNo}`);
    lines.push("(주문조회 시 전화번호와 함께 사용하세요)");
    lines.push("");
    lines.push("■ 신청자 정보");
    lines.push(`이름: ${data.get("name") || "-"}`);
    lines.push(`연락처: ${data.get("phone") || "-"}`);
    lines.push(`이메일: ${data.get("email") || "-"}`);
    lines.push(`카카오톡: ${data.get("kakao") || "-"}`);
    lines.push("");
    lines.push("■ 상품 정보");
    names.forEach((n, i) => {
      lines.push(`${i + 1}) ${n || "-"} [${cats[i] || "-"}] / 단가 ¥${prices[i] || 0} × ${qtys[i] || 0}개`);
      if (orderNos[i]) lines.push(`   오더번호: ${orderNos[i]}`);
      if (urls[i]) lines.push(`   ${urls[i]}`);
    });
    if (subtotalEl) lines.push(`합계: ${subtotalEl.textContent}`);
    lines.push("");
    lines.push("■ 부가서비스");
    lines.push(`검수: ${data.get("inspect") || "없음"}`);
    const addons = data.getAll("addon[]");
    lines.push(`추가옵션: ${addons.length ? addons.join(", ") : "-"}`);
    lines.push("");
    lines.push("■ 배송지 정보");
    lines.push(`수취인: ${data.get("receiver") || "-"} (${data.get("receiverPhone") || "-"})`);
    lines.push(`통관부호: ${data.get("ccode") || "-"}`);
    lines.push(`주소: [${data.get("zipcode") || "-"}] ${data.get("address") || "-"}`);
    lines.push(`배송 방법: ${data.get("shipMethod") || "-"}`);
    lines.push("");
    lines.push("■ 요청사항");
    lines.push(`희망 수령 시기: ${data.get("dueDate") || "-"}`);
    lines.push(`요청사항: ${data.get("memo") || "-"}`);

    resultContent.textContent = lines.join("\n");
    if (window.OSS) {
      const h = modal.querySelector("h3"); if (h) h.textContent = "접수 완료 🎉";
      const s = modal.querySelector(".modal-sub"); if (s) s.textContent = "신청이 정상 접수되었습니다. 빠르게 견적을 안내드릴게요.";
    }
    modal.hidden = false;
    form.reset();
    try { localStorage.removeItem("oss_draft_" + (document.querySelector('[name="productOrderNo[]"]') ? "delivery" : "order")); } catch (e2) {}
    if (typeof recalcSubtotal === "function") recalcSubtotal();
  });

  document.getElementById("closeModal").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
}

// ===== 예상비용 계산기 (메인 #fee) =====
(function calculator() {
  const btn = document.getElementById("calcBtn");
  if (!btn) return;
  // 기본 품목분류 (관리자 settings.customs_categories 로 덮어쓸 수 있음)
  // type: list(목록통관·면세한도 이하 면세) / general(일반통관) · duty=관세율(%)
  let CATS = [
    { name: "의류 / 패션잡화", type: "list", duty: 13 },
    { name: "신발", type: "list", duty: 13 },
    { name: "가방 / 지갑", type: "general", duty: 8 },
    { name: "시계 / 주얼리", type: "general", duty: 8 },
    { name: "전자제품 / 디지털", type: "list", duty: 8 },
    { name: "화장품 / 향수", type: "general", duty: 6.5 },
    { name: "건강식품 / 식품", type: "general", duty: 8 },
    { name: "완구 / 취미 / 피규어", type: "list", duty: 8 },
    { name: "기타", type: "general", duty: 8 },
  ];
  let RATES = [];
  let FX = { applied: 0, gosi: 0, dutyFreeLimit: 23961 };

  const won = (n) => "₩" + Math.round(n).toLocaleString();
  const yen = (n) => "¥" + Math.round(n).toLocaleString();

  function shipFeeYen(weightKg, center) {
    const w = Number(weightKg);
    if (!w || w <= 0 || !RATES.length) return 0;
    const sorted = [...RATES].sort((a, b) => a.kg - b.kg);
    const row = sorted.find((r) => w <= Number(r.kg)) || sorted[sorted.length - 1];
    return Number(center === "sea" ? row.sea : row.air) || 0;
  }

  function fillCats() {
    const sel = document.getElementById("calcCat");
    sel.innerHTML = CATS.map((c, i) => `<option value="${i}">${c.name}</option>`).join("");
  }
  function showFx() {
    const el = document.getElementById("calcFx");
    if (FX.applied > 0) el.innerHTML = `적용환율 <b>100엔 = ₩${Number(FX.applied).toLocaleString()}</b>` + (FX.gosi ? ` <span style="opacity:.6">(고시 ₩${Number(FX.gosi).toLocaleString()})</span>` : "");
    else el.innerHTML = '환율이 아직 설정되지 않았어요. (관리자 → 설정 → 환율)';
  }

  function calc() {
    const perJpy = Number(FX.applied) / 100; // 1엔당 원
    const jpy = Number(document.getElementById("calcJpy").value) || 0;
    const kg = Number(document.getElementById("calcKg").value) || 0;
    const center = document.getElementById("calcCenter").value;
    const cat = CATS[Number(document.getElementById("calcCat").value)] || CATS[CATS.length - 1];
    const set = (id, v) => (document.getElementById(id).textContent = v);

    if (perJpy <= 0) { set("rJpy", "환율 미설정"); set("rShip", "-"); set("rTax", "-"); set("rTotal", "-"); return; }

    const productKrw = jpy * perJpy;
    const shipKrw = shipFeeYen(kg, center) * perJpy;
    const base = productKrw + shipKrw; // 간이 과세표준
    const dutyFreeKrw = Number(FX.dutyFreeLimit || 0) * perJpy;

    let tax = 0;
    const exempt = cat.type === "list" && productKrw <= dutyFreeKrw;
    if (!exempt) {
      const duty = base * (Number(cat.duty) || 0) / 100;
      const vat = (base + duty) * 0.1;
      tax = duty + vat;
    }
    set("rJpy", `${won(productKrw)}  (${yen(jpy)})`);
    set("rShip", shipKrw > 0 ? won(shipKrw) : (RATES.length ? "무게 입력" : "요율 미설정"));
    set("rTax", exempt ? "면세 (목록통관)" : won(tax));
    set("rTotal", won(productKrw + shipKrw + tax));
  }

  btn.addEventListener("click", calc);
  fillCats(); showFx();

  if (window.OSS && window.OSS.getSetting) {
    Promise.all([
      window.OSS.getSetting("exchange_rate").catch(() => null),
      window.OSS.getSetting("shipping_rates").catch(() => null),
      window.OSS.getSetting("customs_categories").catch(() => null),
    ]).then(([fx, rates, cats]) => {
      if (fx && typeof fx === "object") FX = Object.assign(FX, fx);
      if (Array.isArray(rates) && rates.length) RATES = rates;
      if (Array.isArray(cats) && cats.length) { CATS = cats; fillCats(); }
      showFx();
    });
  }
})();

// ===== 이용후기 (메인 #reviews) =====
(function reviews() {
  const grid = document.getElementById("reviewGrid");
  if (!grid) return;
  const SAMPLE = [
    { author: "김*은", rating: 5, text: "다른 대행사보다 수수료가 저렴하고 문의 답변도 정말 빨라요. 계속 이용할게요!" },
    { author: "이*리", rating: 5, text: "검수 사진 보내주셔서 안심하고 받았어요. 포장도 꼼꼼합니다." },
    { author: "박*호", rating: 5, text: "일본어 하나도 몰라도 링크만 보내면 다 해주셔서 너무 편했어요." },
  ];
  const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function render(list) {
    grid.innerHTML = list.map((r) => `<div class="review-card">
      <div class="review-stars">${"★".repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
      <p class="review-text">${esc(r.text)}</p>
      <p class="review-author">${esc(r.author || "고객님")}</p>
    </div>`).join("");
  }
  render(SAMPLE);
  if (window.OSS && window.OSS.getSetting) {
    window.OSS.getSetting("reviews").then((r) => {
      if (Array.isArray(r) && r.length) render(r);
    }).catch(() => {});
  }
})();

// ===== 신청서 자동 임시저장 (구매/배송) =====
(function draftAutosave() {
  const form = document.getElementById("orderForm");
  const productList = document.getElementById("productList");
  const addBtn = document.getElementById("addProduct");
  if (!form || !productList) return;
  const KEY = "oss_draft_" + (document.querySelector('[name="productOrderNo[]"]') ? "delivery" : "order");

  // 복구
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.products && saved.products.length) {
      let guard = 0;
      while (productList.querySelectorAll(".product-item").length < saved.products.length && guard < 50) { if (addBtn) addBtn.click(); guard++; }
      const rows = productList.querySelectorAll(".product-item");
      saved.products.forEach((p, i) => {
        const r = rows[i]; if (!r) return;
        Object.entries(p).forEach(([n, v]) => { const el = r.querySelector('[name="' + n + '"]'); if (el && el.type !== "file") el.value = v; });
      });
      Object.entries(saved.fields || {}).forEach(([n, v]) => { const el = form.querySelector('[name="' + n + '"]'); if (el && el.type !== "checkbox" && el.type !== "radio" && el.type !== "file") el.value = v; });
      if (typeof recalcSubtotal === "function") recalcSubtotal();
      const note = document.createElement("div");
      note.className = "draft-note";
      note.innerHTML = '💾 이전에 작성하던 내용을 불러왔어요. <button type="button" class="draft-clear">새로 작성</button>';
      form.parentNode.insertBefore(note, form);
      note.querySelector(".draft-clear").addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); });
    }
  } catch (e) {}

  // 저장 (입력 후 0.8초 디바운스)
  let t;
  function save() {
    try {
      const products = [...productList.querySelectorAll(".product-item")].map((r) => {
        const o = {}; r.querySelectorAll("input, select, textarea").forEach((el) => { if (el.name && el.name.endsWith("[]") && el.type !== "file") o[el.name] = el.value; }); return o;
      });
      const fields = {};
      form.querySelectorAll("input, select, textarea").forEach((el) => { if (el.name && !el.name.endsWith("[]") && el.type !== "checkbox" && el.type !== "radio" && el.type !== "file" && el.name !== "_hp") fields[el.name] = el.value; });
      localStorage.setItem(KEY, JSON.stringify({ products, fields }));
    } catch (e) {}
  }
  form.addEventListener("input", () => { clearTimeout(t); t = setTimeout(save, 800); });
  form.addEventListener("submit", () => clearTimeout(t));
})();

// ===== 상단 공지 띠배너 (전 페이지) =====
(function renderTopBar() {
  try { if (sessionStorage.getItem("oss_topbar_closed") === "1") return; } catch (e) {}
  const bar = document.createElement("div");
  bar.className = "top-noti";
  bar.innerHTML = '<div class="container top-noti-in"><span class="top-noti-msg" id="topNotiMsg">📢 일본 직구, OSS와 함께 안전하게 — 구매대행 · 배송대행</span><button class="top-noti-x" type="button" aria-label="닫기">×</button></div>';
  document.body.insertBefore(bar, document.body.firstChild);
  bar.querySelector(".top-noti-x").addEventListener("click", () => { bar.remove(); try { sessionStorage.setItem("oss_topbar_closed", "1"); } catch (e) {} });
  if (window.OSS && window.OSS.getSetting) {
    window.OSS.getSetting("topbar").then((v) => {
      const msg = document.getElementById("topNotiMsg");
      const txt = typeof v === "string" ? v : (v && v.text);
      if (msg && txt && txt.trim()) { msg.textContent = "📢 " + txt; return null; }
      if (window.OSS.fetchNotices) return window.OSS.fetchNotices();
      return null;
    }).then((list) => {
      const msg = document.getElementById("topNotiMsg");
      if (list && list[0] && msg) msg.innerHTML = '📢 <a href="notice.html">' + (list[0].title || "") + "</a>";
    }).catch(() => {});
  }
})();
