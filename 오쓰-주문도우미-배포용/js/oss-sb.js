/* ============================================================
   oss-sb.js — 손님 사이트(Supabase) 주문을 폰앱 장부로 가져오기 (D 연동)
   로드 순서: util → data → render → main → supabase-js(CDN) → oss-sb
   - 사장님 로그인(1회) 후 홈페이지·SNS 주문을 '사입요청'으로 자동 수신
   - 한 번 가져온 주문은 owner_status='imported'로 표시 → 중복 방지
============================================================ */
(function () {
  if (!window.supabase) { console.warn('[OSS] supabase-js 미로드 — 온라인 주문 연동 비활성'); return; }
  var SB_URL = "https://wmgzggeklwzhrlmpuifh.supabase.co";
  var SB_KEY = "sb_publishable_FyDtXrTDGbxtaLhqTS19Qw_VsnIE0xv";
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.OSS_SB = sb;

  var POLL_MS = 60000, pollTimer = null, loggedIn = false, rtChannel = null;

  function rerender() {
    if (typeof renderOrders === 'function') renderOrders();
    if (typeof renderHome === 'function' && typeof state !== 'undefined' && state.mode === 'home') renderHome();
    if (typeof renderSales === 'function') renderSales();
  }
  /* 컴퓨터(관리자) 등 다른 기기에서 바뀐 주문을 폰 장부에 병합 — 폰 전용 입력값(사입처·판매가 등)은 보존 */
  function applyWebUpdate(row) {
    if (!row || !row.id) return;
    var idx = -1;
    for (var i = 0; i < orders.length; i++) { if (orders[i].dbId === row.id) { idx = i; break; } }
    if (row.deleted_at) { if (idx >= 0) { orders.splice(idx, 1); saveOrders(); rerender(); } return; }
    if (idx < 0) { if (row.owner_status == null && (row.source === 'web' || row.source === 'sns')) syncDown(false); return; }
    var o = orders[idx];
    if (row.status) o.status = WEB2APP[row.status] || o.status;     // 진행상태(서버가 소스)
    if (row.tracking_no != null) o.trackingNo = row.tracking_no;    // 송장
    if (row.memo != null && row.memo !== '') o.memo = row.memo;
    o._webUpdatedAt = row.updated_at || '';
    saveOrders(); rerender();                                       // 로컬·시트만 갱신 (Supabase로 되쏘지 않음 → 루프 방지)
  }
  /* 폰에서 한 작업을 활동 로그에 기록 (세무·감사용, 데스크톱 로그창에 표시) */
  function logActivity(order_no, action, detail) {
    if (!loggedIn) return;
    try { sb.from('activity_log').insert([{ device: 'phone', order_no: order_no || '', action: action || '', detail: detail || '' }]).then(function () { }, function () { }); } catch (e) {}
  }

  function applyWebDelete(old) {
    var id = old && old.id; if (!id) return;
    for (var i = 0; i < orders.length; i++) { if (orders[i].dbId === id) { orders.splice(i, 1); saveOrders(); rerender(); break; } }
  }

  /* 실시간 구독 — 주문 들어옴(INSERT)·변경(UPDATE)·삭제(DELETE) 즉시 양방향 반영. 폴링은 백업 */
  function subscribeRealtime() {
    if (rtChannel || !loggedIn) return;
    try {
      rtChannel = sb.channel('oss-orders-rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, function () { syncDown(false); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications' }, function (p) { applyWebUpdate(p.new); })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'applications' }, function (p) { applyWebDelete(p.old); })
        .subscribe(function (status) { if (status === 'SUBSCRIBED') updateBar(); });
    } catch (e) { console.warn('[OSS] realtime 구독 실패', e); }
  }

  /* 사이트 상태(한국어) → 폰앱 상태 키 */
  var WEB2APP = { '신규접수': 'req', '결제대기': 'reserve', '구매중': 'bought', '입고완료': 'office', '포장/측정': 'office', '배송중': 'shipped', '배송완료': 'tracking', '완료': 'tracking', '취소': 'cancel', '보류': 'reserve', '반품/교환': 'cancel' };
  /* 폰앱 상태 → 사이트 상태(한국어) : 2-way 동기화용 (손님 주문조회에 반영) */
  var APP2WEB = { req: '신규접수', reserve: '결제대기', bought: '구매중', office: '입고완료', shipped: '배송중', tracking: '배송완료', cancel: '취소' };

  /* 폰앱에서 바꾼 진행상태·송장·정산을 손님 사이트(Supabase)에 반영 */
  function pushUp(o) {
    if (!loggedIn || !o || !o.dbId) return Promise.resolve(false);
    var fields = { status: APP2WEB[o.status] || '신규접수' };
    if (o.trackingNo) fields.tracking_no = o.trackingNo;
    if (o.sellKrw) fields.sell_krw = o.sellKrw;
    if (o.settleKrw) fields.settle_krw = o.settleKrw;
    if (o.settled) fields.settled = o.settled;
    return sb.from('applications').update(fields).eq('id', o.dbId)
      .then(function (res) { return !res.error; }, function () { return false; });
  }

  /* 폰에서 휴지통으로 보낼 때: 영구삭제 대신 deleted_at만 찍음 (세무·감사용으로 기록 보존) */
  function softDelete(o) {
    if (!loggedIn || !o || !o.dbId) return Promise.resolve(false);
    return sb.from('applications').update({ deleted_at: new Date().toISOString() }).eq('id', o.dbId)
      .then(function (res) { return !res.error; }, function () { return false; });
  }

  function optText(p) {
    if (p && p.options && p.options.length) return p.options.map(function (o) { return (o.option || '') + (o.qty > 1 ? ' x' + o.qty : ''); }).filter(Boolean).join(', ');
    return (p && (p.memo || p.option)) || '';
  }
  function rowToOrder(r) {
    var prods = Array.isArray(r.products) ? r.products : [];
    var names = prods.map(function (p) { return p.name || ''; }).filter(Boolean);
    var itemName = names.length ? (names[0] + (names.length > 1 ? ' 외 ' + (names.length - 1) + '건' : '')) : '';
    var opt = prods.map(optText).filter(Boolean).join(' / ');
    var qty = prods.reduce(function (s, p) { return s + (Number(p.qty) || 0); }, 0) || 1;
    var first = prods[0] || {};
    return {
      id: 'web_' + r.id, dbId: r.id, _src: 'web', orderNo: r.order_no || '',
      createdAt: r.created_at || nowIso(),
      customer: r.applicant_name || r.receiver_name || '(이름없음)',
      recipient: r.receiver_name || r.applicant_name || '',
      channel: r.channel || '홈페이지',
      itemName: itemName, itemOption: opt, itemUrl: first.url || '', images: prods.map(function (p) { return p && p.image; }).filter(Boolean), qty: qty,
      buyFrom: '', buyYen: Number(first.price) || 0, payCard: '', payDate: '',
      sellKrw: 0, settleKrw: 0, shipExtraKrw: 0,
      bigo: (r.type === 'delivery' ? '배송대행' : '구매대행'), invoice: '',
      customsCode: r.customs_code || '', phone: r.receiver_phone || r.applicant_phone || '',
      zip: r.zipcode || '', address: r.address || '', deliveryMemo: r.courier_memo || '',
      status: WEB2APP[r.status] || 'req', settled: '미정산',
      trackingNo: r.tracking_no || '', memo: r.memo || '', synced: false
    };
  }

  function syncDown(loud) {
    if (!loggedIn) return Promise.resolve(0);
    return sb.from('applications').select('*')
      .in('source', ['web', 'sns']).is('deleted_at', null).is('owner_status', null)
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) { if (loud) toast('온라인 주문 불러오기 실패 🥲'); console.warn('[OSS] syncDown', res.error); return 0; }
        var rows = res.data || [];
        var fresh = rows.filter(function (r) { return !orders.some(function (o) { return o.dbId === r.id; }); });
        if (!fresh.length) { if (loud) toast('새 온라인 주문이 없어요'); updateBar(); return 0; }
        var ids = [];
        fresh.forEach(function (r) { orders.unshift(rowToOrder(r)); ids.push(r.id); });
        saveOrders();
        sb.from('applications').update({ owner_status: 'imported' }).in('id', ids).then(function () { }, function () { });
        fresh.forEach(function (r) { var o = orders.filter(function (x) { return x.dbId === r.id; })[0]; if (o && typeof doSync === 'function') doSync(o, true); });
        if (typeof renderOrders === 'function') renderOrders();
        if (typeof renderHome === 'function' && state.mode === 'home') renderHome();
        if (typeof renderSales === 'function') renderSales();
        toast('🛒 새 온라인 주문 ' + fresh.length + '건 도착!');
        updateBar();
        return fresh.length;
      }, function (e) { if (loud) toast('연결 오류 🥲'); console.warn('[OSS]', e); return 0; });
  }

  /* ── 연동 상태 바 (주문 장부 상단) ── */
  function ensureBar() {
    var ledger = document.querySelector('[data-panel="ledger"]'); if (!ledger) return null;
    var bar = $('web-sync-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'web-sync-bar';
      bar.style.cssText = 'margin:0 0 10px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:8px;';
      ledger.insertBefore(bar, ledger.firstChild);
    }
    return bar;
  }
  function updateBar() {
    var bar = ensureBar(); if (!bar) return;
    if (loggedIn) {
      bar.style.background = '#e8f7ef'; bar.style.color = '#0f7a4d';
      bar.innerHTML = '<span>🟢 온라인 주문 ' + (rtChannel ? '실시간' : '자동') + ' 연결됨</span><button id="web-sync-now" type="button" style="border:none;background:#0f7a4d;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;">🔄 지금 불러오기</button>';
      var b = $('web-sync-now'); if (b) b.onclick = function () { syncDown(true); };
    } else {
      bar.style.background = '#fff4e6'; bar.style.color = '#b5470f';
      bar.innerHTML = '<span>🔌 홈페이지·SNS 주문 받기</span><button id="web-login-btn" type="button" style="border:none;background:#F15E1C;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;">사장님 로그인</button>';
      var lb = $('web-login-btn'); if (lb) lb.onclick = showLogin;
    }
  }

  /* ── 로그인 오버레이 ── */
  function showLogin() {
    var ov = $('web-login-ov');
    if (ov) { ov.style.display = 'flex'; return; }
    ov = document.createElement('div'); ov.id = 'web-login-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(27,35,48,.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:22px;width:100%;max-width:340px;">'
      + '<div style="font-size:17px;font-weight:700;color:#1b2330;margin-bottom:4px;">🔐 사장님 로그인</div>'
      + '<div style="font-size:12px;color:#8a817a;margin-bottom:14px;line-height:1.5;">홈페이지·SNS 주문을 폰앱으로 받아오려면 한 번만 로그인하면 돼요. (사이트 관리자 계정)</div>'
      + '<input id="wl-email" type="email" value="oss202604@gmail.com" autocomplete="username" placeholder="이메일" style="width:100%;height:44px;border:1px solid #e2e5ea;border-radius:10px;padding:0 12px;font-size:16px;margin-bottom:8px;box-sizing:border-box;">'
      + '<input id="wl-pw" type="password" autocomplete="current-password" placeholder="비밀번호" style="width:100%;height:44px;border:1px solid #e2e5ea;border-radius:10px;padding:0 12px;font-size:16px;margin-bottom:6px;box-sizing:border-box;">'
      + '<div id="wl-err" style="color:#e25d5d;font-size:12px;min-height:16px;margin-bottom:8px;"></div>'
      + '<button id="wl-go" type="button" style="width:100%;height:46px;border:none;border-radius:10px;background:#F15E1C;color:#fff;font-size:16px;font-weight:700;">로그인</button>'
      + '<button id="wl-cancel" type="button" style="width:100%;height:40px;border:none;background:none;color:#8a817a;font-size:13px;margin-top:6px;">나중에</button>'
      + '</div>';
    document.body.appendChild(ov);
    $('wl-cancel').onclick = function () { ov.style.display = 'none'; };
    $('wl-go').onclick = function () {
      var email = $('wl-email').value.trim(), pw = $('wl-pw').value, err = $('wl-err'), btn = $('wl-go');
      err.textContent = ''; btn.disabled = true; btn.textContent = '로그인 중...';
      sb.auth.signInWithPassword({ email: email, password: pw }).then(function (res) {
        btn.disabled = false; btn.textContent = '로그인';
        if (res.error) { err.textContent = '로그인 실패 — 이메일/비밀번호를 확인해주세요'; return; }
        ov.style.display = 'none'; loggedIn = true; updateBar(); startPoll(); subscribeRealtime(); syncDown(true);
      });
    };
  }

  function startPoll() { if (pollTimer) clearInterval(pollTimer); pollTimer = setInterval(function () { if (loggedIn && navigator.onLine !== false) syncDown(false); }, POLL_MS); }

  function init() {
    ensureBar(); updateBar();
    sb.auth.getSession().then(function (res) {
      if (res && res.data && res.data.session) { loggedIn = true; updateBar(); startPoll(); subscribeRealtime(); syncDown(false); }
    });
    window.addEventListener('online', function () { if (loggedIn) syncDown(false); });
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.OSSWeb = { syncDown: syncDown, login: showLogin, rowToOrder: rowToOrder, pushUp: pushUp, logActivity: logActivity, softDelete: softDelete };
})();
