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

// 번호 다시 매기기 + 삭제버튼 정리
function renumberProducts() {
  if (!productList) return;
  const items = productList.querySelectorAll(".product-item");
  items.forEach((item, i) => {
    const noEl = item.querySelector(".product-item-no");
    if (noEl) noEl.textContent = i + 1;
    // 삭제 버튼: 첫 상품엔 없음, 2번째부터 표시
    let del = item.querySelector(".remove-product");
    const head = item.querySelector(".product-item-head");
    if (i === 0) {
      if (del) del.remove();
    } else if (!del && head) {
      del = document.createElement("button");
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
    if (typeof recalcSubtotal === "function") recalcSubtotal();
  });

  document.getElementById("closeModal").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
}
