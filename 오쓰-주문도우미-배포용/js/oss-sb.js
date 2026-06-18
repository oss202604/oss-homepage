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

  var POLL_MS = 60000, pollTimer = null, loggedIn = false;

  /* 사이트 상태(한국어) → 폰앱 상태 키 */
  var WEB2APP = { '신규접수': 'req', '결제대기': 'reserve', '구매중': 'bought', '입고완료': 'office', '포장/측정': 'office', '배송중': 'shipped', '배송완료': 'tracking', '완료': 'tracking', '취소': 'cancel', '보류': 'reserve', '반품/교환': 'cancel' };

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
      itemName: itemName, itemOption: opt, itemUrl: first.url || '', qty: qty,
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
      bar.innerHTML = '<span>🟢 온라인 주문 연결됨 (자동 수신)</span><button id="web-sync-now" type="button" style="border:none;background:#0f7a4d;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;">🔄 지금 불러오기</button>';
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
        ov.style.display = 'none'; loggedIn = true; updateBar(); startPoll(); syncDown(true);
      });
    };
  }

  function startPoll() { if (pollTimer) clearInterval(pollTimer); pollTimer = setInterval(function () { if (loggedIn && navigator.onLine !== false) syncDown(false); }, POLL_MS); }

  function init() {
    ensureBar(); updateBar();
    sb.auth.getSession().then(function (res) {
      if (res && res.data && res.data.session) { loggedIn = true; updateBar(); startPoll(); syncDown(false); }
    });
    window.addEventListener('online', function () { if (loggedIn) syncDown(false); });
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.OSSWeb = { syncDown: syncDown, login: showLogin, rowToOrder: rowToOrder };
})();
