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

window.OSS = {
  sb,
  submitApplication,
  lookupOrder,
  fetchApplications,
  updateApplicationStatus,
  updateApplication,
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
};
