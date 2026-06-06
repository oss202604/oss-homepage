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
  fetchApplications,
  updateApplicationStatus,
  adminSignIn,
  adminGetSession,
  adminSignOut,
};
