// ============================================================
// OSS Supabase 연결 설정
// 이 두 값은 "공개되어도 안전한" 키입니다 (웹사이트에 넣는 용도).
// service_role 키는 절대 여기 넣지 마세요.
// ============================================================
const SUPABASE_URL = "https://wmgzggeklwzhrlmpuifh.supabase.co";
const SUPABASE_KEY = "sb_publishable_FyDtXrTDGbxtaLhqTS19Qw_VsnIE0xv";

// supabase-js v2 (CDN) 로드 후 클라이언트 생성
// 각 HTML에서 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> 를 먼저 불러옵니다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// 로그인 토큰(기본 1시간)이 작업 중 만료돼 저장이 막히는 것 방지:
// 주기적으로 + 탭 복귀 시 세션을 갱신해 둔다. (관리자 탭을 오래 열어두고 작업해도 안전)
(function keepSessionAlive() {
  if (!(sb && sb.auth)) return;
  async function refresh() {
    try {
      const { data } = await sb.auth.getSession();   // 만료 임박이면 내부적으로 갱신
      if (data && data.session) await sb.auth.refreshSession();
    } catch (e) { /* 비로그인/네트워크 등은 조용히 무시 */ }
  }
  try { setInterval(refresh, 4 * 60 * 1000); } catch (e) {}   // 4분마다 (만료 1시간 전에 충분히 갱신)
  try {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") refresh();   // 다른 탭 갔다 돌아오면 즉시 갱신
      });
    }
  } catch (e) {}
})();

// ---- 신청서 저장 (구매대행/배송대행 공용) ----
async function submitApplication(payload) {
  // 로그인 회원이면 주문을 그 회원과 자동 연결 (예치금/적립금 자동정산·주문이력용)
  try {
    if (payload && payload.user_id == null) {
      const { data } = await sb.auth.getSession();
      const u = data && data.session && data.session.user;
      if (u) payload = Object.assign({}, payload, { user_id: u.id });
    }
  } catch (e) {}
  // .select() 안 함: 비회원(anon)은 조회 권한이 없으므로 insert만 수행
  const { error } = await sb.from("applications").insert([payload]);
  if (error) throw error;
  return true;
}

// ---- 비회원 주문 조회 (주문번호 + 전화번호) ----
async function lookupOrder(orderNo, phone) {
  const { data, error } = await sb.rpc("lookup_order", {
    p_order_no: orderNo.trim(),
    p_phone: phone.trim(),
  });
  if (error) throw error;
  return data || [];
}

// ---- 비회원 합배송 신청 (주문번호 여러 개 + 전화) ----
async function requestBundle(orderNos, phone) {
  const { error } = await sb.rpc("request_bundle", { p_order_nos: orderNos, p_phone: phone.trim() });
  if (error) throw error;
}

// ---- 관리자: 신청 목록 조회 ----
async function fetchApplications() {
  const { data, error } = await sb
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ---- 관리자: 상태 변경 ----
async function updateApplicationStatus(id, status) {
  const { error } = await sb.from("applications").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---- 관리자: 여러 항목 부분 수정 (무게·배송비·상태 등) ----
async function updateApplication(id, fields) {
  const { error } = await sb.from("applications").update(fields).eq("id", id);
  if (error) throw error;
}

// ---- 관리자: 주문 영구 삭제 (휴지통에서) ----
async function deleteApplication(id) {
  const { error } = await sb.from("applications").delete().eq("id", id);
  if (error) throw error;
}

// ---- 상품 사진 업로드 (Storage: product-images 버킷) ----
async function uploadProductImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = "p/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const { error } = await sb.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

// ---- 메인 배너 이미지 업로드 (Storage: product-images 버킷의 banner/ 경로) ----
// ※ banner/ 경로는 직원만 업로드 가능하도록 Storage RLS 정책을 배포 전 1회 적용해야 함
async function uploadBannerImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = "banner/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const { error } = await sb.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

// ---- 활동 로그 (세무·감사용, 누적만) ----
async function logActivity(entry) {
  try { await sb.from("activity_log").insert([entry]); } catch (e) { /* 로그 실패는 본작업 막지 않음 */ }
}
async function fetchActivityLog(limit) {
  const { data, error } = await sb.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit || 100);
  if (error) throw error;
  return data || [];
}
// 한 주문건의 작업 이력 (처음 → 끝, 오래된 순)
async function fetchActivityLogByOrder(orderNo) {
  if (!orderNo) return [];
  const { data, error } = await sb.from("activity_log").select("*").eq("order_no", orderNo).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---- 1:1 문의 ----
async function submitInquiry(payload) {
  const { error } = await sb.from("inquiries").insert([payload]);
  if (error) throw error;
  return true;
}
async function fetchInquiries() {
  const { data, error } = await sb.from("inquiries").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function answerInquiry(id, answer) {
  const { error } = await sb.from("inquiries").update({ answer, status: "답변완료", answered_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
async function deleteInquiry(id) {
  const { error } = await sb.from("inquiries").delete().eq("id", id);
  if (error) throw error;
}

// ---- 공지사항 ----
async function fetchNotices() {
  const { data, error } = await sb.from("notices").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function createNotice(title, body, pinned) {
  const { error } = await sb.from("notices").insert([{ title, body, pinned: !!pinned }]);
  if (error) throw error;
}
async function updateNotice(id, title, body, pinned) {
  const { error } = await sb.from("notices").update({ title, body, pinned: !!pinned }).eq("id", id);
  if (error) throw error;
}
async function deleteNotice(id) {
  const { error } = await sb.from("notices").delete().eq("id", id);
  if (error) throw error;
}

// ---- 설정(키-값): 센터주소·사이트정보·요율표 등 ----
async function getSetting(key) {
  const { data, error } = await sb.from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
// 저장 실패가 '토큰 만료(RLS/JWT)' 때문이면 알아듣기 쉬운 메시지로 바꿔줌
function rlsFriendly(error) {
  const m = (error && error.message) || "";
  if (/row-level security|jwt|not authorized|permission denied|invalid claim|token is expired/i.test(m)) {
    return new Error("로그인이 만료됐어요. 화면을 새로고침(F5)한 뒤 다시 로그인하고 저장해 주세요.");
  }
  return error;
}
async function saveSetting(key, value) {
  const { error } = await sb.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw rlsFriendly(error);
}

// ---- 이용안내 페이지 ----
async function getPage(slug) {
  const { data, error } = await sb.from("pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}
async function fetchPages() {
  const { data, error } = await sb.from("pages").select("*");
  if (error) throw error;
  return data || [];
}
async function savePage(slug, title, body) {
  const { error } = await sb.from("pages").upsert({ slug, title, body, updated_at: new Date().toISOString() });
  if (error) throw rlsFriendly(error);
}

// ---- 관리자 인증 ----
async function adminSignIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function adminGetSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
async function adminSignOut() {
  await sb.auth.signOut();
}

// ============================================================
// 회원(고객) 인증 — 아이디 기반
// 아이디는 내부적으로 "아이디@ossohayo.com" 가짜 이메일로 변환해 Supabase Auth에 저장.
// ⚠️ Supabase → Authentication → Providers → Email → "Confirm email" 을 OFF 해야
//    가입 즉시 로그인됩니다(가짜 이메일이라 인증메일 수신 불가).
// ============================================================
const OSS_LOGIN_DOMAIN = "@ossohayo.com"; // @oss.local은 Supabase가 형식 거부(invalid) → 변경
function usernameToEmail(username) {
  return String(username).trim().toLowerCase() + OSS_LOGIN_DOMAIN;
}

// 회원가입
async function signUpMember(username, password, info) {
  info = info || {};
  const { data, error } = await sb.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: {
      data: {
        username: String(username).trim(),
        name: info.name || "",
        phone: info.phone || "",
        email: info.email || "",
      },
    },
  });
  if (error) throw error;
  return data;
}

// 로그인 (아이디 + 비번)
async function signInMember(username, password) {
  const { data, error } = await sb.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
  return data;
}

async function signOut() {
  await sb.auth.signOut();
}

// 아이디 존재 여부 (가입 중복확인 / 로그인 아이디·비번 구분용)
async function usernameExists(username) {
  const { data, error } = await sb.rpc("oss_username_exists", { u: String(username).trim() });
  if (error) throw error;
  return !!data;
}

// 내 프로필 (역할·등급·권한 포함). 비로그인 시 null
async function getMyProfile() {
  const { data: s } = await sb.auth.getSession();
  if (!s || !s.session) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", s.session.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

// 내 주문내역 (가입 이메일/전화와 일치하는 신청건)
async function myOrders() {
  const { data, error } = await sb.rpc("oss_my_orders");
  if (error) throw error;
  return data || [];
}

// 내 기본정보 수정 (역할/등급은 못 바꿈)
async function updateMyProfile(name, phone, email, addrZip, addrMain, addrDetail) {
  const { error } = await sb.rpc("oss_update_my_profile", { p_name: name, p_phone: phone, p_email: email, p_addr_zip: addrZip == null ? null : addrZip, p_addr_main: addrMain == null ? null : addrMain, p_addr_detail: addrDetail == null ? null : addrDetail });
  if (error) throw error;
}

// 내 환불계좌 저장/수정 (은행·계좌·예금주)
async function updateMyRefund(bank, account, holder) {
  const { error } = await sb.rpc("oss_update_my_refund", { p_bank: bank || null, p_account: account || null, p_holder: holder || null });
  if (error) throw error;
}

// 마지막 로그인 시각 갱신 (실패해도 무시)
async function touchLogin() {
  try { await sb.rpc("oss_touch_login"); } catch (e) {}
}

// 비밀번호 변경 (로그인 상태에서 본인)
async function changePassword(newPassword, currentPassword) {
  // 현재 비밀번호 재확인 (세션이 탈취돼도 비밀번호를 못 바꾸게 — 계정 영구장악 방지)
  if (currentPassword) {
    const { data: s } = await sb.auth.getSession();
    const email = s && s.session && s.session.user && s.session.user.email;
    if (email) {
      const { error: e1 } = await sb.auth.signInWithPassword({ email, password: currentPassword });
      if (e1) throw new Error("현재 비밀번호가 일치하지 않아요.");
    }
  }
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---- 마스터 전용: 회원 관리 ----
async function listMembers() {
  const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function setMemberRole(id, role) {
  const { error } = await sb.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}
async function setMemberGrade(id, grade) {
  const { error } = await sb.from("profiles").update({ grade }).eq("id", id);
  if (error) throw error;
}
async function setMailboxCode(id, code) {
  const { error } = await sb.from("profiles").update({ mailbox_code: (code || "").trim() || null }).eq("id", id);
  if (error) throw error;
}
async function setMemberPermissions(id, permissions) {
  const { error } = await sb.from("profiles").update({ permissions }).eq("id", id);
  if (error) throw error;
}

// ---- 쿠폰 (회원가입 배송비 할인쿠폰) ----
// 내 쿠폰 (마이페이지). RLS로 본인 것만 조회됨
async function fetchMyCoupons() {
  const { data, error } = await sb.from("coupons").select("*").order("status").order("expires_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
// 관리자: 특정 회원의 쿠폰
async function listMemberCoupons(userId) {
  const { data, error } = await sb.from("coupons").select("*").eq("user_id", userId).order("issued_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
// 관리자: 쿠폰 사용 처리(정산 시 배송비에서 차감) / 되돌리기
async function useCoupon(id, orderNo) {
  const { error } = await sb.from("coupons").update({ status: "used", used_at: new Date().toISOString(), used_order_no: orderNo || null }).eq("id", id);
  if (error) throw error;
}
async function unuseCoupon(id) {
  const { error } = await sb.from("coupons").update({ status: "active", used_at: null, used_order_no: null }).eq("id", id);
  if (error) throw error;
}
// 관리자: 쿠폰 발급 (혜택관리). amount/reason/days 비우면 DB 기본값(₩3000·signup·1달)
async function issueCoupon(userId, amount, reason, days) {
  const row = { user_id: userId };
  if (amount !== undefined && amount !== null && amount !== "") row.amount = Number(amount);
  if (reason) row.reason = reason;
  if (days !== undefined && days !== null && days !== "") row.expires_at = new Date(Date.now() + Number(days) * 86400000).toISOString();
  const { error } = await sb.from("coupons").insert([row]);
  if (error) throw error;
}
// 관리자: 쿠폰 삭제 (잘못 발급 시)
async function deleteCoupon(id) {
  const { error } = await sb.from("coupons").delete().eq("id", id);
  if (error) throw error;
}
// 회원: 주문에 쿠폰 예약(1차결제 때 "쿠폰 쓸게요"). 정산 때 사장님이 최종 used 처리.
// 반환값 = 할인액(원). 0이면 예약 실패(이미 사용/만료 등).
async function reserveCoupon(couponId, orderNo) {
  const { data, error } = await sb.rpc("oss_reserve_coupon", { p_coupon_id: couponId, p_order_no: orderNo });
  if (error) throw error;
  return Number(data) || 0;
}
// 관리자: 특정 주문에 쓰인 쿠폰 1장 조회 (2차 배송비칸에서 금액·사용일 확인). 없으면 null.
async function getOrderCoupon(orderNo) {
  if (!orderNo) return null;
  const { data, error } = await sb
    .from("coupons")
    .select("id,amount,status,used_at,used_order_no")
    .eq("used_order_no", orderNo)
    .order("used_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return (data && data[0]) || null;
}

// ---- 예치금/적립금 충전·차감 + 내역(원장) ----
// kind: 'deposit'|'points', delta: +충전 / -차감. 반환 = 처리 후 잔액. 스태프 전용(RPC에서 검증).
async function adjustBalance(userId, kind, delta, reason, orderNo) {
  const { data, error } = await sb.rpc("oss_adjust_balance", {
    p_user_id: userId, p_kind: kind, p_delta: delta, p_reason: reason || null, p_order_no: orderNo || null,
  });
  if (error) throw error;
  return Number(data) || 0;
}
async function fetchLedger(userId, kind) {
  let q = sb.from("member_ledger").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
// 전체 회원 원장 (관리자 결제관리>예치금/적립금 내역) — 회원명 매핑 포함
async function fetchAllLedger(kind, limit) {
  let q = sb.from("member_ledger").select("*").order("created_at", { ascending: false }).limit(limit || 300);
  if (kind) q = q.eq("kind", kind);
  const { data: led, error } = await q;
  if (error) throw error;
  const rows = led || [];
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const names = {};
  if (ids.length) {
    const { data: profs } = await sb.from("profiles").select("id,username,name").in("id", ids);
    (profs || []).forEach((p) => { names[p.id] = p.username || p.name || p.id; });
  }
  return rows.map((r) => Object.assign({}, r, { member: names[r.user_id] || "-" }));
}
// 회원 1명 잔액·이름 조회 (주문창에서 예치금/적립금 잔액 힌트용)
async function getMemberById(userId) {
  if (!userId) return null;
  const { data, error } = await sb.from("profiles").select("id,name,username,phone,email,mailbox_code,grade,deposit,points,created_at").eq("id", userId).maybeSingle();
  if (error) return null;
  return data || null;
}

// ---- 구매후기 (회원만 작성, 사장님 승인 후 게시) ----
async function submitReview(fields) {
  const { data: s } = await sb.auth.getSession();
  if (!s || !s.session) throw new Error("로그인 후 작성할 수 있어요.");
  const u = s.session.user;
  const name = (u.user_metadata && (u.user_metadata.name || u.user_metadata.username)) || "회원";
  const payload = {
    user_id: u.id,
    author_name: name,
    rating: Math.max(1, Math.min(5, Number(fields.rating) || 5)),
    body: String(fields.body || "").trim(),
    order_no: fields.order_no || null,
    image_url: fields.image_url || null,
    status: "pending",
  };
  const { error } = await sb.from("reviews").insert([payload]);
  if (error) throw error;
  return true;
}
// 후기 수정 (본인 것만 · 수정하면 재승인 대기)
async function updateMyReview(id, fields) {
  const { error } = await sb.rpc("oss_update_my_review", {
    p_id: id,
    p_rating: Math.max(1, Math.min(5, Number(fields.rating) || 5)),
    p_body: String(fields.body || "").trim(),
    p_image_url: fields.image_url || null,
  });
  if (error) throw error;
}
// 후기 사진 업로드 (Storage: product-images 버킷의 reviews/ 경로 재사용)
async function uploadReviewImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = "reviews/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const { error } = await sb.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
// 사이트 노출용 (승인된 후기) — 이름은 maskName으로 가려 표시
async function fetchApprovedReviews(limit) {
  const { data, error } = await sb.from("reviews").select("author_name,rating,body,image_url,created_at,approved_at").eq("status", "approved").order("approved_at", { ascending: false }).limit(limit || 12);
  if (error) throw error;
  return data || [];
}
// 이름 마스킹: 첫 글자만 보이고 나머지는 * (송상익 → 송**, 송익 → 송*, 남궁민수 → 남***)
function maskName(name) {
  var s = String(name == null ? "" : name).trim();
  if (!s) return "고객";
  if (s.length === 1) return s + "*";
  return s[0] + "*".repeat(s.length - 1);
}
// 내가 쓴 후기 (마이페이지 — 상태 확인)
async function fetchMyReviews() {
  const { data: s } = await sb.auth.getSession();
  if (!s || !s.session) return [];
  const { data, error } = await sb.from("reviews").select("*").eq("user_id", s.session.user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
// 관리자: 후기 목록/승인/삭제
async function listReviews(status) {
  let q = sb.from("reviews").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
async function setReviewStatus(id, status) {
  const patch = { status };
  if (status === "approved") patch.approved_at = new Date().toISOString();
  const { error } = await sb.from("reviews").update(patch).eq("id", id);
  if (error) throw error;
}
async function deleteReview(id) {
  const { error } = await sb.from("reviews").delete().eq("id", id);
  if (error) throw error;
}

// ---- 저장 배송지 (회원당 최대 3개) ----
async function listMyAddresses() {
  const { data, error } = await sb.from("saved_addresses").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function saveAddress(addr) {
  const { data: s } = await sb.auth.getSession();
  if (!s || !s.session) throw new Error("로그인 후 저장할 수 있어요.");
  const list = await listMyAddresses();
  if (list.length >= 3) throw new Error("배송지는 최대 3개까지 저장할 수 있어요.");
  const makeDefault = !!addr.is_default || list.length === 0;
  const row = {
    user_id: s.session.user.id,
    label: addr.label || "",
    receiver_name: addr.receiver_name || "",
    receiver_phone: addr.receiver_phone || "",
    zipcode: addr.zipcode || "",
    address: addr.address || "",
    customs_code: addr.customs_code || "",
    is_default: makeDefault,
  };
  const { data, error } = await sb.from("saved_addresses").insert([row]).select().maybeSingle();
  if (error) throw error;
  if (makeDefault && data) await setDefaultAddress(data.id);
  return data;
}
async function updateAddress(id, fields) {
  const { error } = await sb.from("saved_addresses").update(fields).eq("id", id);
  if (error) throw error;
}
async function deleteAddress(id) {
  const { error } = await sb.from("saved_addresses").delete().eq("id", id);
  if (error) throw error;
}
async function setDefaultAddress(id) {
  const { data: s } = await sb.auth.getSession();
  if (!s || !s.session) throw new Error("로그인이 필요해요.");
  await sb.from("saved_addresses").update({ is_default: false }).eq("user_id", s.session.user.id);
  const { error } = await sb.from("saved_addresses").update({ is_default: true }).eq("id", id);
  if (error) throw error;
}

// ============================================================
// 💳 PG(카드) 결제 어댑터 — "전부 준비, API키 주면 잠금해제"
// ------------------------------------------------------------
// 사용법: PG사 계약 후 아래 3가지만 채우고 enabled=true 로 바꾸면
//         사이트 전체(예치금 충전·주문 결제)의 카드결제가 즉시 작동합니다.
//   1) OSS_PG.enabled  = true
//   2) OSS_PG.storeId  = "store-..."      (PG사/포트원 상점 ID)
//   3) OSS_PG.channelKey = "channel-..."  (결제 채널 키)
// 기본 연동은 포트원(PortOne) v2 기준 — 토스·나이스·KG이니시스·카카오페이 등
// 어떤 PG를 골라도 포트원 채널설정만 바꾸면 되어 한 번에 준비됨.
// ⚠️ 잠금(enabled=false) 동안엔 카드버튼을 눌러도 "준비중" 안내만 뜨고,
//    무통장입금/예치금 결제는 정상 작동합니다.
// ============================================================
const OSS_PG = {
  enabled: false,            // ← PG 계약 완료 후 true 로
  provider: "portone",       // portone(권장) | toss | nice ...
  storeId: "",               // ← 발급받은 상점 ID
  channelKey: "",            // ← 발급받은 채널 키
  sdkUrl: "https://cdn.portone.io/v2/browser-sdk.js",
};
function isPgEnabled() { return !!(OSS_PG.enabled && OSS_PG.storeId && OSS_PG.channelKey); }

// 포트원 SDK 1회 로드 (enabled일 때만 실제 로드)
let _pgSdkPromise = null;
function _loadPgSdk() {
  if (window.PortOne) return Promise.resolve(window.PortOne);
  if (_pgSdkPromise) return _pgSdkPromise;
  _pgSdkPromise = new Promise(function (resolve, reject) {
    const s = document.createElement("script");
    s.src = OSS_PG.sdkUrl; s.async = true;
    s.onload = function () { resolve(window.PortOne); };
    s.onerror = function () { reject(new Error("결제 모듈을 불러오지 못했어요.")); };
    document.head.appendChild(s);
  });
  return _pgSdkPromise;
}

// 카드결제 실행. opts = { amount, orderName, orderNo, customerName, payMethod }
// 반환: { ok:true, payment } | { ok:false, locked:true } | { ok:false, error }
async function payByCard(opts) {
  opts = opts || {};
  if (!isPgEnabled()) {
    // 🔒 잠금 상태 — 무통장입금/예치금으로 안내
    return { ok: false, locked: true, message: "카드 결제는 준비 중이에요. 지금은 무통장입금 또는 예치금으로 결제해 주세요." };
  }
  try {
    const PortOne = await _loadPgSdk();
    const paymentId = "oss-" + (opts.orderNo || "pay") + "-" + Date.now();
    const res = await PortOne.requestPayment({
      storeId: OSS_PG.storeId,
      channelKey: OSS_PG.channelKey,
      paymentId: paymentId,
      orderName: opts.orderName || "OSS 결제",
      totalAmount: Number(opts.amount) || 0,
      currency: "CURRENCY_KRW",
      payMethod: opts.payMethod || "CARD",
      customer: { fullName: opts.customerName || "" },
      customData: { orderNo: opts.orderNo || "" },
    });
    if (res && res.code != null) return { ok: false, error: res.message || "결제가 취소되었어요." };
    // TODO(서버검증): 운영 시 결제건 위변조 방지를 위해 서버(Edge Function)에서
    //   포트원 결제내역 조회 API로 amount/status 재확인 후 주문확정 처리 권장.
    return { ok: true, payment: res, paymentId: paymentId };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

// ---- 시간 표시: 전 사이트 한국(서울) 시간 기준 ----
// DB는 UTC로 저장되므로 화면에는 항상 KST(+9)로 변환해 뿌린다.
function kstDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).replace("T", " ").slice(0, 16);
  try { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d); }
  catch (e) { return String(iso).replace("T", " ").slice(0, 16); }
}
function kstDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  try { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  catch (e) { return String(iso).slice(0, 10); }
}

window.OSS = {
  sb,
  // ⏰ 시간(KST)
  kstDate,
  kstDateTime,
  // 💳 PG
  OSS_PG,
  isPgEnabled,
  payByCard,
  maskName,
  submitApplication,
  lookupOrder,
  requestBundle,
  fetchApplications,
  updateApplicationStatus,
  updateApplication,
  deleteApplication,
  uploadProductImage,
  uploadBannerImage,
  logActivity,
  fetchActivityLog,
  fetchActivityLogByOrder,
  submitInquiry,
  fetchInquiries,
  answerInquiry,
  deleteInquiry,
  fetchNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  getSetting,
  saveSetting,
  getPage,
  fetchPages,
  savePage,
  adminSignIn,
  adminGetSession,
  adminSignOut,
  // 회원 인증
  signUpMember,
  signInMember,
  signOut,
  usernameExists,
  getMyProfile,
  myOrders,
  updateMyProfile,
  updateMyRefund,
  touchLogin,
  changePassword,
  // 마스터: 회원관리
  listMembers,
  setMemberRole,
  setMemberGrade,
  setMailboxCode,
  setMemberPermissions,
  // 쿠폰
  fetchMyCoupons,
  listMemberCoupons,
  useCoupon,
  unuseCoupon,
  issueCoupon,
  deleteCoupon,
  reserveCoupon,
  getOrderCoupon,
  adjustBalance,
  fetchLedger,
  fetchAllLedger,
  getMemberById,
  // 구매후기
  submitReview,
  updateMyReview,
  uploadReviewImage,
  fetchApprovedReviews,
  fetchMyReviews,
  listReviews,
  setReviewStatus,
  deleteReview,
  // 저장 배송지
  listMyAddresses,
  saveAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  // 커뮤니티 게시판
  fetchBoardPosts,
  fetchMyBoardPosts,
  submitBoardPost,
  updateBoardPost,
  deleteBoardPost,
  replyBoardPost,
  listBoardPosts,
  setBoardPostStatus,
  uploadBoardImage,
};

// ---- 커뮤니티 게시판 (board_posts) ----
// board: 'review' | 'grade' | 'contact'
async function fetchBoardPosts(board, limit) {
  const { data, error } = await sb.from("board_posts")
    .select("id,board,title,content,photos,visibility,status,author_display,order_no,admin_reply,replied_at,created_at")
    .eq("board", board).eq("status", "approved").eq("visibility", "public")
    .order("created_at", { ascending: false }).limit(limit || 30);
  if (error) throw error;
  return data || [];
}
async function fetchMyBoardPosts(board) {
  const { data, error } = await sb.from("board_posts")
    .select("*").eq("board", board).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function submitBoardPost(payload) {
  const { data: sess } = await sb.auth.getSession();
  const uid = sess && sess.session && sess.session.user && sess.session.user.id;
  if (!uid) throw new Error("로그인이 필요합니다.");
  const { error } = await sb.from("board_posts").insert([Object.assign({}, payload, { user_id: uid })]);
  if (error) throw error;
  return true;
}
async function updateBoardPost(id, fields) {
  const { error } = await sb.from("board_posts").update(Object.assign({}, fields, { updated_at: new Date().toISOString() })).eq("id", id);
  if (error) throw error;
}
async function deleteBoardPost(id) {
  const { error } = await sb.from("board_posts").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
// 관리자 전용
async function listBoardPosts(board) {
  let q = sb.from("board_posts").select("*").order("created_at", { ascending: false });
  if (board) q = q.eq("board", board);
  const { data, error } = await q.not("status", "eq", "deleted");
  if (error) throw error;
  return data || [];
}
async function replyBoardPost(id, reply) {
  const { error } = await sb.from("board_posts").update({ admin_reply: reply, replied_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "approved" }).eq("id", id);
  if (error) throw error;
}
async function setBoardPostStatus(id, status) {
  const { error } = await sb.from("board_posts").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
async function uploadBoardImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = "board/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
  const { error } = await sb.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
