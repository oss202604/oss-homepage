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

// ===== 맨 위로 =====
const scrollTopBtn = document.getElementById("scrollTop");
if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );
}

// ===== 상품 추가 (신청서 페이지에만 존재) =====
const productList = document.getElementById("productList");
const addProduct = document.getElementById("addProduct");
if (productList && addProduct) {
  addProduct.addEventListener("click", () => {
    const first = productList.querySelector(".product-item");
    const item = document.createElement("div");
    item.className = "product-item";
    item.innerHTML = first.innerHTML;
    item.querySelectorAll("input").forEach((inp) => {
      if (inp.type === "number") { inp.value = "1"; } else { inp.value = ""; }
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-small remove-product";
    del.textContent = "− 이 상품 삭제";
    del.addEventListener("click", () => item.remove());
    item.appendChild(del);
    productList.appendChild(item);
  });
}

// ===== 신청서 제출 (현재는 미리보기) =====
const form = document.getElementById("orderForm");
const modal = document.getElementById("resultModal");
if (form && modal) {
  const resultContent = document.getElementById("resultContent");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = new FormData(form);
    const lines = [];
    const names = data.getAll("productName[]");
    const urls = data.getAll("productUrl[]");
    const opts = data.getAll("productOption[]");
    const qtys = data.getAll("productQty[]");

    lines.push("■ 신청자 정보");
    lines.push(`이름: ${data.get("name") || "-"}`);
    lines.push(`연락처: ${data.get("phone") || "-"}`);
    lines.push(`이메일: ${data.get("email") || "-"}`);
    lines.push(`카카오톡: ${data.get("kakao") || "-"}`);
    lines.push("");
    lines.push("■ 상품 정보");
    names.forEach((n, i) => {
      lines.push(`${i + 1}) ${n || "-"} / ${opts[i] || "-"} / 수량: ${qtys[i] || "-"}`);
      if (urls[i]) lines.push(`   ${urls[i]}`);
    });
    lines.push("");
    lines.push("■ 배송지 정보");
    lines.push(`받는 분: ${data.get("receiver") || "-"} (${data.get("receiverPhone") || "-"})`);
    lines.push(`주소: [${data.get("zipcode") || "-"}] ${data.get("address") || "-"}`);
    lines.push(`배송 방법: ${data.get("shipMethod") || "-"}`);
    lines.push("");
    lines.push("■ 요청사항");
    lines.push(`예산/통관번호: ${data.get("budget") || "-"}`);
    lines.push(`희망 수령 시기: ${data.get("dueDate") || "-"}`);
    lines.push(`요청사항: ${data.get("memo") || "-"}`);

    resultContent.textContent = lines.join("\n");
    modal.hidden = false;
  });

  document.getElementById("closeModal").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
}
