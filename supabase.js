// ============================================================
// OSS Supabase 연결 설정
// 이 두 값은 "공개되어도 안전한" 키입니다 (웹사이트에 넣는 용도).
// service_role 키는 절대 여기 넣지 마세요.
// ============================================================
const SUPABASE_URL = "https://wmgzggeklwzhrlmpuifh.supabase.co";
const SUPABASE_KEY = "sb_publishable_FyDtXrTDGbxtaLhqTS19Qw_VsnIE0xv";

// supabase-js v2 (CDN) 로드 후 클라이언트 생성
// 각 HTML에서 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> 를 먼저 불러옵니다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- 신청서 저장 (구매대행/배송대행 공용) ----
async function submitApplication(payload) {
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
async function saveSetting(key, value) {
  const { error } = await sb.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
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
  if (error) throw error;
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
async function updateMyProfile(name, phone, email) {
  const { error } = await sb.rpc("oss_update_my_profile", { p_name: name, p_phone: phone, p_email: email });
  if (error) throw error;
}

// 마지막 로그인 시각 갱신 (실패해도 무시)
async function touchLogin() {
  try { await sb.rpc("oss_touch_login"); } catch (e) {}
}

// 비밀번호 변경 (로그인 상태에서 본인)
async function changePassword(newPassword) {
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
    status: "pending",
  };
  const { error } = await sb.from("reviews").insert([payload]);
  if (error) throw error;
  return true;
}
// 사이트 노출용 (승인된 후기)
async function fetchApprovedReviews(limit) {
  const { data, error } = await sb.from("reviews").select("author_name,rating,body,created_at,approved_at").eq("status", "approved").order("approved_at", { ascending: false }).limit(limit || 12);
  if (error) throw error;
  return data || [];
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

window.OSS = {
  sb,
  submitApplication,
  lookupOrder,
  requestBundle,
  fetchApplications,
  updateApplicationStatus,
  updateApplication,
  deleteApplication,
  uploadProductImage,
  logActivity,
  fetchActivityLog,
  fetchActivityLogByOrder,
  submitInquiry,
  fetchInquiries,
  answerInquiry,
  deleteInquiry,
  fetchNotices,
  createNotice,
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
  touchLogin,
  changePassword,
  // 마스터: 회원관리
  listMembers,
  setMemberRole,
  setMemberGrade,
  setMemberPermissions,
  // 쿠폰
  fetchMyCoupons,
  listMemberCoupons,
  useCoupon,
  unuseCoupon,
  issueCoupon,
  deleteCoupon,
  // 구매후기
  submitReview,
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
};
