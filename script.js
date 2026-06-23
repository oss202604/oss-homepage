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
// 공통 헤더(OSSohayo · 본리식) — 모든 페이지의 옛 헤더를 새 헤더로 교체
(function renderHeader() {
  // 헤더가 HTML에 하드코딩돼 있으면 주입 생략(깜빡임 방지). 없는 페이지에만 주입.
  if (!document.body.classList.contains("admin-body") && !document.querySelector(".osshead")) {
    [".utility-bar", ".site-header", ".main-nav"].forEach(function (s) { var e = document.querySelector(s); if (e) e.remove(); });
    var path = (location.pathname.split("/").pop() || "index.html"); if (path === "") path = "index.html";
    var nav = [["index.html", "홈"], ["order.html", "구매대행 신청"], ["delivery.html", "배송대행 신청"], ["notice.html", "공지사항"], ["guide.html", "이용가이드"], ["order-lookup.html", "주문조회"]];
    var navHtml = nav.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === path ? ' class="on"' : "") + ">" + n[1] + "</a>"; }).join("");
    var sIco = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg>';
    var uIco = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M5 20c0-3.6 3.4-5.6 7-5.6s7 2 7 5.6"></path></svg>';
    var h = document.createElement("header"); h.className = "osshead"; h.id = "top";
    h.innerHTML = '<div class="osshead-in"><a class="osshead-logo" href="index.html">OSSohayo</a><nav class="osshead-nav">' + navHtml + '</nav><div class="osshead-icons"><a class="osshead-ic" href="notice.html" aria-label="검색">' + sIco + '</a><div class="osshead-acct"><button class="osshead-ic" type="button" aria-label="계정">' + uIco + '</button><div class="osshead-menu"><a href="login.html">로그인</a><a href="signup.html">회원가입</a><a href="order-lookup.html">주문조회</a><a href="mypage.html">마이페이지</a></div></div></div></div>';
    document.body.insertBefore(h, document.body.firstChild);
  }
  // 계정 드롭다운 (하드코딩/주입 공통)
  var acct = document.querySelector(".osshead-acct");
  if (acct && !acct.getAttribute("data-wired")) {
    acct.setAttribute("data-wired", "1");
    var btn = acct.querySelector("button");
    if (btn) btn.addEventListener("click", function (e) { e.stopPropagation(); acct.classList.toggle("open"); });
    document.addEventListener("click", function () { acct.classList.remove("open"); });
  }
  // 네비 드롭다운 주입 (마우스 올리면 하위메뉴) — 전 페이지 공통
  var navEl = document.querySelector(".osshead-nav");
  if (navEl && !navEl.getAttribute("data-sub")) {
    navEl.setAttribute("data-sub", "1");
    var SUBS = {
      "order.html": [["order.html", "구매대행 신청"], ["guide.html#guide-purchase", "구매대행 신청방법"], ["order-lookup.html", "주문조회"]],
      "delivery.html": [["delivery.html", "배송대행 신청"], ["guide.html#guide-delivery", "배송대행 신청방법"], ["guide.html#guide-center", "배송센터(배대지) 주소"]],
      "guide.html": [["guide.html", "이용안내"], ["faq.html", "자주 묻는 질문"], ["guide.html#guide-customs", "통관·관세 안내"], ["guide.html#guide-money", "예치금(머니충전)"]],
      "notice.html": [["notice.html", "공지사항"], ["faq.html", "자주 묻는 질문"], ["contact.html", "1:1 문의"]]
    };
    [].slice.call(navEl.querySelectorAll("a")).forEach(function (a) {
      var key = (a.getAttribute("href") || "").split("#")[0];
      var items = SUBS[key];
      if (!items) return;
      var item = document.createElement("span");
      item.className = "osshead-navitem";
      a.parentNode.insertBefore(item, a);
      item.appendChild(a);
      var sub = document.createElement("div");
      sub.className = "osshead-sub";
      sub.innerHTML = items.map(function (it) { return '<a href="' + it[0] + '">' + it[1] + "</a>"; }).join("");
      item.appendChild(sub);
    });
  }
})();

(function renderFooter() {
  const f = document.querySelector(".site-footer");
  if (!f) return;
  // 기본값 (관리자 설정이 있으면 아래에서 덮어씀)
  const biz = {
    company: "OSS (オッス)",
    desc: "일본 현지인이 직접 운영하는 구매대행 · 배송대행지",
    email: "ossohayo@gmail.com",
    kakao: "@ossohayo",
    hours: "평일 10:00 ~ 22:00 (일본시간)",
    bizline: "상호 안승스토어 · 대표 송상익 · 사업자등록번호 898-44-01017 · 통신판매업 신고 2026-울산중구-0039",
    bizlineJp: "상호 オッス · 대표 糸矢 来央 · 〒577-0841 大阪府 東大阪市 足代 3-1-25 ハイムリップルパート3 102号",
    legal: "OSS(オッス)에서 운영하는 구매대행·배송대행은 관세법 등 관련 규정을 준수하며, 「개인정보 보호법」을 준수합니다. 불법 물품은 취급하지 않으며, 분할배송·가격 허위신고 등 고객의 불법 요청에는 협조하지 않습니다. 고객님의 허위신고로 인한 불이익에 대해서는 책임지지 않습니다. 사이트 운영·환불·문의에 대한 책임은 안승스토어(OSS)에 귀속됩니다.",
  };
  function paint() {
    f.innerHTML =
      '<div class="container footer-cols">' +
        '<div class="footer-col">' +
          '<p class="footer-logo">OSS <small>オッス</small></p>' +
          '<p class="footer-desc">' + biz.desc + '</p>' +
          '<p class="footer-biz"><b>[한국]</b> ' + biz.bizline + '</p>' +
          (biz.bizlineJp ? '<p class="footer-biz"><b>[일본]</b> ' + biz.bizlineJp + '</p>' : '') +
        '</div>' +
        '<div class="footer-col">' +
          '<p class="footer-col-tit">고객센터</p>' +
          (biz.email ? '<p><i data-lucide="mail" class="ico-inline"></i> ' + biz.email + '</p>' : '') +
          '<p><i data-lucide="message-circle" class="ico-inline"></i> <a href="http://pf.kakao.com/_srxlxfX/chat" target="_blank" rel="noopener" style="color:inherit;">카카오톡 ' + biz.kakao + '</a></p>' +
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
      '<div class="footer-bottom"><div class="container">' +
        (biz.legal ? '<p class="footer-legal">' + biz.legal + '</p>' : '') +
        '<p class="footer-fx">오쓰 적용환율 : 100엔 = ₩1,000 <small>(1엔 = 10원)</small></p>' +
        '<div class="footer-bottom-inner">' +
        '<span class="footer-copy">© 2026 OSS. All rights reserved.</span>' +
        '</div>' +
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
  a.href = "http://pf.kakao.com/_srxlxfX/chat";
  a.target = "_blank"; a.rel = "noopener";
  a.className = "chat-fab";
  a.title = "카카오톡 문의";
  a.innerHTML = '<i data-lucide="message-circle"></i>';
  document.body.appendChild(a);
  if (window.lucide) lucide.createIcons();
})();

// ===== 푸터 위 사이트맵 가로 한 줄 (회사소개·약관·공지 등) =====
(function renderFooterSitemap() {
  if (document.querySelector(".footer-sitemap")) return;
  const links = [
    ["index.html#about", "회사소개"],
    ["terms.html", "이용약관"],
    ["privacy.html", "개인정보처리방침"],
    ["refund.html", "취소·환불정책"],
    ["notice.html", "공지사항"],
    ["faq.html", "FAQ"],
    ["contact.html", "1:1 문의"],
  ];
  const bar = document.createElement("nav");
  bar.className = "footer-sitemap";
  bar.setAttribute("aria-label", "사이트맵");
  bar.innerHTML = '<div class="footer-sitemap-in">' +
    links.map(function(x) { return '<a href="' + x[0] + '">' + x[1] + '</a>'; }).join("") +
    '<span class="sitemap-fx">오쓰 적용환율 : 100엔 = ₩1,000 <small>(1엔 = 10원)</small></span>' +
    '</div>';
  var footer = document.querySelector(".site-footer");
  if (footer && footer.parentNode) footer.parentNode.insertBefore(bar, footer);
  else document.body.appendChild(bar);
})();

// ===== 우측 고정 퀵메뉴 (전 페이지 공통, inline SVG) =====
(function renderQuickMenu() {
  if (document.querySelector(".quick-menu")) return;
  var ICO = {
    cs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-7a9 9 0 0 1 18 0v7a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="8" x2="16" y1="10" y2="10"/><line x1="8" x2="8" y1="14" y2="14"/><line x1="12" x2="12" y1="14" y2="14"/><line x1="16" x2="16" y1="14" y2="14"/><line x1="8" x2="8" y1="18" y2="18"/><line x1="12" x2="12" y1="18" y2="18"/><line x1="16" x2="16" y1="18" y2="18"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>'
  };
  var items = [
    ["notice.html", ICO.cs, "고객센터"],
    ["order.html", ICO.bag, "구매대행"],
    ["delivery.html", ICO.box, "배송대행"],
    ["index.html#fee", ICO.calc, "예상비용"],
    ["guide.html", ICO.book, "이용가이드"],
  ];
  var aside = document.createElement("aside");
  aside.className = "quick-menu";
  aside.innerHTML =
    items.map(function(x) { return '<a href="' + x[0] + '" class="qm-item"><span class="qm-ico">' + x[1] + '</span>' + x[2] + '</a>'; }).join("") +
    '<button class="qm-top" type="button" title="맨 위로" aria-label="맨 위로">' + ICO.up + '<br><small>TOP</small></button>';
  document.body.appendChild(aside);
  aside.querySelector(".qm-top").addEventListener("click", function() { window.scrollTo({ top: 0, behavior: "smooth" }); });
})();

// ===== 고객센터 사이드바 (공지·문의·FAQ·후기 허브) =====
(function renderCsSidebar() {
  const el = document.querySelector(".cs-sidebar");
  if (!el) return;
  const active = el.dataset.cs || "";
  const items = [
    ["notice", "notice.html", "공지사항"],
    ["contact", "contact.html", "1:1 문의"],
    ["faq", "faq.html", "자주 묻는 질문"],
    ["review", "index.html#reviews", "이용후기"],
  ];
  el.innerHTML = '<p class="cs-sidebar-title">고객센터</p>' +
    items.map(([k, h, l]) => `<a href="${h}" class="${k === active ? "active" : ""}">${l}</a>`).join("") +
    '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted);line-height:1.6;">' +
    '<p style="margin:0 0 9px;"><b style="color:var(--text);">상담시간</b><br>평일 10:00 ~ 22:00 <small>(일본시간)</small></p>' +
    '<p style="margin:0;"><b style="color:var(--text);">카카오톡</b><br>@OSS <small>(등록 예정)</small></p></div>';
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

  // 로그인 회원 등급(주문에 기록 → 관리자 배송비 자동 할인). 비회원은 null.
  let MY_GRADE = null;
  if (window.OSS && window.OSS.getMyProfile) window.OSS.getMyProfile().then((p) => { if (p && p.grade) MY_GRADE = p.grade; }).catch(() => {});

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
      image: data.getAll("productImage[]")[i] || "",
    }));
    const center = document.querySelector('input[name="centerType"]:checked');
    const subNum = Number((subtotalEl?.textContent || "0").replace(/[^0-9]/g, "")) || 0;
    return {
      order_no: orderNo,
      type: isDelivery ? "delivery" : "purchase",
      source: "web",
      channel: "홈페이지",
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
      member_grade: MY_GRADE,
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
  let GRADES_CFG = [];

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
  function fillGrades() {
    const sel = document.getElementById("calcGrade");
    if (!sel) return;
    sel.innerHTML = '<option value="-1">비회원 / 일반</option>' + GRADES_CFG.map((g, i) => `<option value="${i}">${g.name}${Number(g.discountPct) > 0 ? " (배송비 " + g.discountPct + "% 할인)" : ""}</option>`).join("");
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

    if (perJpy <= 0) { set("rJpy", "잠시 후 다시 시도"); set("rShip", "-"); set("rTax", "-"); set("rTotal", "-"); return; }

    const productKrw = jpy * perJpy;
    const shipKrwBase = shipFeeYen(kg, center) * perJpy;
    const grade = GRADES_CFG[Number((document.getElementById("calcGrade") || {}).value)] || null;
    const gPct = grade ? (Number(grade.discountPct) || 0) : 0;
    const shipKrw = shipKrwBase * (1 - gPct / 100);
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
    set("rShip", shipKrwBase > 0 ? (won(shipKrw) + (gPct > 0 ? `  (${grade.name} ${gPct}% 할인)` : "")) : (RATES.length ? "무게 입력" : "잠시 후 다시 시도"));
    set("rTax", exempt ? "면세 (목록통관)" : won(tax));
    set("rTotal", won(productKrw + shipKrw + tax));
  }

  btn.addEventListener("click", calc);
  fillCats(); fillGrades(); showFx();

  if (window.OSS && window.OSS.getSetting) {
    Promise.all([
      window.OSS.getSetting("exchange_rate").catch(() => null),
      window.OSS.getSetting("shipping_rates").catch(() => null),
      window.OSS.getSetting("customs_categories").catch(() => null),
      window.OSS.getSetting("member_grades").catch(() => null),
    ]).then(([fx, rates, cats, grades]) => {
      if (fx && typeof fx === "object") FX = Object.assign(FX, fx);
      if (Array.isArray(rates) && rates.length) RATES = rates;
      if (Array.isArray(cats) && cats.length) { CATS = cats; fillCats(); }
      if (Array.isArray(grades) && grades.length) { GRADES_CFG = grades; fillGrades(); }
      showFx();
      // 로그인 회원이면 본인 등급 자동 선택 (비회원은 그대로 0%)
      if (window.OSS.getMyProfile) window.OSS.getMyProfile().then((p) => {
        if (!p || !p.grade) return;
        const map = { silver: "실버", gold: "골드", diamond: "다이아", red: "레드" };
        const gn = map[p.grade] || p.grade;
        const idx = GRADES_CFG.findIndex((g) => g.name === gn);
        const sel = document.getElementById("calcGrade");
        if (idx >= 0 && sel) { sel.value = String(idx); sel.title = "로그인 회원 등급이 자동 적용됐어요"; }
      }).catch(() => {});
    });
  }
})();

// ===== 이용후기 (메인 #reviews) =====
(function reviews() {
  const grid = document.getElementById("reviewGrid");
  if (!grid) return;
  const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function render(list) {
    grid.innerHTML = list.map((r) => `<div class="review-card">
      <div class="review-stars">${"★".repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
      <p class="review-text">${esc(r.text)}</p>
      <p class="review-author">${esc(r.author || "고객님")}</p>
    </div>`).join("");
  }
  function empty() { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#A99B91;padding:18px 0;">아직 등록된 후기가 없어요. 첫 후기를 남겨주세요! 😊</p>'; }
  grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#A99B91;">후기를 불러오는 중...</p>';
  // 승인된 실제 후기 → 없으면 관리자 설정(reviews) → 없으면 빈 상태 (가짜 후기 표시 안 함)
  function loadFromSetting() {
    if (window.OSS && window.OSS.getSetting) window.OSS.getSetting("reviews").then((r) => { if (Array.isArray(r) && r.length) render(r); else empty(); }).catch(empty);
    else empty();
  }
  if (window.OSS && window.OSS.fetchApprovedReviews) {
    window.OSS.fetchApprovedReviews(12).then((rows) => {
      if (Array.isArray(rows) && rows.length) render(rows.map((r) => ({ author: r.author_name, rating: r.rating, text: r.body })));
      else loadFromSetting();
    }).catch(loadFromSetting);
  } else { loadFromSetting(); }
  // 후기 작성 CTA (회원만 — 마이페이지에서 작성, 비로그인 시 로그인으로 안내)
  if (grid.parentNode && !document.getElementById("reviewWriteCta")) {
    const cta = document.createElement("div");
    cta.id = "reviewWriteCta";
    cta.style.cssText = "text-align:center;margin-top:20px;";
    cta.innerHTML = '<a href="mypage.html#reviews" class="btn btn-primary">✍️ 구매후기 작성하기</a>';
    grid.parentNode.appendChild(cta);
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

// ===== 상품 사진 업로드 (신청서, 동적 행 포함) =====
document.addEventListener("change", async (e) => {
  const inp = e.target;
  if (!inp.classList || !inp.classList.contains("product-img-file")) return;
  const file = inp.files && inp.files[0];
  const item = inp.closest(".product-item");
  if (!file || !item) return;
  const hidden = item.querySelector('[name="productImage[]"]');
  const thumb = item.querySelector(".product-img-thumb");
  if (file.size > 8 * 1024 * 1024) { if (thumb) thumb.textContent = "사진은 8MB 이하만 가능해요."; inp.value = ""; return; }
  if (!(window.OSS && window.OSS.uploadProductImage)) { if (thumb) thumb.textContent = "(사진 업로드 준비 중)"; return; }
  if (thumb) thumb.textContent = "업로드 중...";
  try {
    const url = await window.OSS.uploadProductImage(file);
    if (hidden) hidden.value = url;
    if (thumb) {
      thumb.innerHTML = `<img src="${url}" alt="상품사진" /><button type="button" class="img-remove">✕ 삭제</button>`;
      const rm = thumb.querySelector(".img-remove");
      if (rm) rm.addEventListener("click", () => { if (hidden) hidden.value = ""; inp.value = ""; thumb.innerHTML = ""; });
    }
  } catch (err) {
    if (thumb) thumb.textContent = "업로드 실패: " + (err.message || err) + " (저장공간 설정을 확인하세요)";
  }
});

// ===== 상단 공지 띠배너 (전 페이지) =====
(function renderTopBar() {
  var bar = document.querySelector(".top-noti");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "top-noti";
    bar.innerHTML = '<div class="container top-noti-in"><span class="top-noti-msg" id="topNotiMsg"></span></div>';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  var el = document.getElementById("topNotiMsg") || bar.querySelector(".top-noti-msg");
  var i = 0;
  // 공지띠는 항상 표시(닫기 없음). 글마다 색상 순환(본리식 밝은 파스텔): 분홍 · 노랑 · 복숭아 · 민트
  var pal = [{ b: "#F79AC1", f: "#412233" }, { b: "#FFE04A", f: "#5A4A10" }, { b: "#FFB58A", f: "#5A3018" }, { b: "#8FD9C8", f: "#184038" }];
  var msgs = ["신규 가입하면 배송비 쿠폰 3장 드려요 🎁", "일본 직구, 링크만 보내면 OSS가 다 해드려요 ✨", "검수사진 제공 · 실시간 배송추적 · 카톡 상담 💬"];
  bar.style.transition = "background .4s ease, color .4s ease";
  function show() { var c = pal[i % pal.length]; bar.style.background = c.b; bar.style.color = c.f; if (el) { el.style.color = c.f; el.textContent = msgs[i % msgs.length]; } }
  show();
  setInterval(function () { i++; show(); }, 5500);
  // 관리자 설정(설정 → 띠배너 문구) 우선 적용. 여러 줄 입력 시 줄마다 순환.
  if (window.OSS && window.OSS.getSetting) window.OSS.getSetting("topbar").then(function (v) {
    var t = (typeof v === "string" ? v : (v && v.text)) || "";
    var lines = t.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (lines.length) { msgs = lines; i = 0; show(); }
  }).catch(function () {});
})();

// ===== 예상비용 계산기 팝업 열기/닫기 (메인) =====
(function feePopup() {
  const modal = document.getElementById("feeModal");
  if (!modal) return; // 모달이 있는 페이지(메인)에서만 동작
  const open = () => { modal.hidden = false; document.body.style.overflow = "hidden"; };
  const close = () => { modal.hidden = true; document.body.style.overflow = ""; };

  // 페이지 안의 '예상비용' 링크(#fee / index.html#fee) 클릭 → 팝업
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href="#fee"], a[href="index.html#fee"]');
    if (!a) return;
    e.preventDefault();
    open();
  });

  document.getElementById("feeModalClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  // 다른 페이지에서 index.html#fee 로 들어온 경우 자동으로 열기
  if (location.hash === "#fee") open();
})();

// ===== 상단바 로그인 상태 표시 (전 페이지 공통) =====
// 로그인하면 "로그인 | 회원가입" → "○○○님 | 마이페이지 | 로그아웃"
(function renderAuthState() {
  if (!(window.OSS && window.OSS.getMyProfile)) return;
  const nav = document.querySelector(".osshead-menu");
  if (!nav) return;
  window.OSS.getMyProfile().then((p) => {
    if (!p) return;
    // 로그인 상태: 로그인·회원가입 링크 제거 → 인사·(관리자)·로그아웃 추가
    nav.querySelectorAll('a[href="login.html"], a[href="signup.html"]').forEach((a) => a.remove());
    const name = (p.name || p.username || "회원").replace(/[<>&]/g, "");
    const staff = p.role === "master" || p.role === "manager";
    nav.insertAdjacentHTML("afterbegin", `<a href="mypage.html" class="oss-greet">${name}님</a>`);
    nav.insertAdjacentHTML("beforeend", `<a href="#" class="oss-logout">로그아웃</a>`);
    // 관리자(staff)만: 검색 아이콘 옆에 '관리자' 버튼 표시 (손님·비로그인엔 안 보임)
    if (staff) {
      const icons = document.querySelector(".osshead-icons");
      if (icons && !icons.querySelector(".osshead-admin")) {
        const adm = document.createElement("a");
        adm.className = "osshead-admin";
        adm.href = "admin.html";
        adm.textContent = "관리자";
        icons.insertBefore(adm, icons.firstChild);
      }
    }
  }).catch(() => {});
})();
document.addEventListener("click", async (e) => {
  const lo = e.target.closest(".oss-logout");
  if (!lo) return;
  e.preventDefault();
  if (!confirm("로그아웃 하시겠어요?")) return;
  try { if (window.OSS && window.OSS.signOut) await window.OSS.signOut(); } catch (err) {}
  location.href = "index.html";
});

// ===== SNS 링크 적용 (상단바 아이콘 + 하단 배너 공통) =====
// 관리자 설정(social_links = {instagram, kakao, threads})이 있으면 그 주소로 연결됩니다.
(function socialLinks() {
  const links = document.querySelectorAll("[data-sns]");
  if (!links.length) return;
  if (window.OSS && window.OSS.getSetting) {
    window.OSS.getSetting("social_links").then((v) => {
      if (!v || typeof v !== "object") return;
      links.forEach((a) => { if (v[a.dataset.sns]) a.href = v[a.dataset.sns]; });
    }).catch(() => {});
  }
})();

// ===== 휴대폰번호 자동 하이픈 (전 폼 공통) =====
// 숫자만 입력해도 010-1234-5678 형태로 자동 변환. input[type=tel] 전부에 적용.
(function bindPhoneFormat() {
  function fmt(el) {
    var d = (el.value || "").replace(/[^0-9]/g, "").slice(0, 11);
    var o = d;
    if (d.length >= 8) o = d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
    else if (d.length >= 4) o = d.slice(0, 3) + "-" + d.slice(3);
    el.value = o;
  }
  function wire() {
    document.querySelectorAll('input[type="tel"]').forEach(function (el) {
      if (el.getAttribute("data-phonefmt")) return;
      el.setAttribute("data-phonefmt", "1");
      el.addEventListener("input", function () { fmt(el); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
