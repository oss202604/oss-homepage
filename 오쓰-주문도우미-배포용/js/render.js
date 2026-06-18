/* ============================================================
   render.js — 화면 그리기 (탭/카드/리스트)
   util.js, data.js 다음 로드. 함수 선언만 — 호출은 main.js 부팅 때.
============================================================ */
function fit(){out.style.height='auto';out.style.height=(out.scrollHeight+4)+'px';}
function setOut(t){out.value=t;fit();}
function showActions(hasOut){
  $('pvwrap').style.display=hasOut?'block':'none';
  var cb=$('copy');if(cb)cb.style.display=hasOut?'block':'none';
  $('actions').style.display=(state.mode!=='home')?'block':'none';
}

/* 💰 견적 */
function quote(){
  var yen=num($('q-price').value);
  if(!yen)return '상품가(¥)를 입력하면 견적이 자동으로 나와요 🧾🤍';
  var q=calcQuote(yen);
  var lines=[
    '[오쓰 견적 안내 🧾🤍]','',
    '· 상품가  ¥'+won(q.yen)+' → '+won(q.goodsKrw)+'원',
    '· 수수료 3% → '+won(q.feeKrw)+'원',
    '───────────────',
    '💰 상품 합계 '+won(q.sumKrw)+'원',
    '📦 항공배송비는 출고 때 무게 보고 따로 안내드려요','',
    '입금 확인되면 조금만 기다려주세요, 재고 확보되는 대로 바로 알려드릴게요 🛍️🤍'
  ];
  if(q.goodsKrw>=200000)lines.push('','※ 상품가 $150(약 20만원) 초과분은 관·부가세가 붙을 수 있어요 🙏');
  return lines.join('\n');
}

/* 📦 배송비 */
function shipMsg(kg){
  var yen=SHIP[kg];
  return [
    '📦 출고 준비 다 됐어요! 🤍','',
    '무게 '+kg+'kg 이하 → 배송비 '+won(yen)+'엔 ('+won(yen*10)+'원)',
    '배송비 입금 확인되면 바로 안전하게 보내드릴게요 🚚🤍'
  ].join('\n');
}
function shipMsgCustom(yen){
  if(!yen)return '👆 6kg 이상이면 배송비(¥)를 직접 입력해주세요 🤍';
  return [
    '📦 출고 준비 다 됐어요! 🤍','',
    '배송비 '+won(yen)+'엔 ('+won(yen*10)+'원)',
    '배송비 입금 확인되면 바로 안전하게 보내드릴게요 🚚🤍'
  ].join('\n');
}

/* 💬 응대 / FAQ 버튼 */
function renderReplyButtons(){
  var box=$('reply-frames');box.innerHTML='';
  var list=state.replyCat==='msg'?MSG_BTNS:FAQ_BTNS;
  list.forEach(function(p){
    var b=document.createElement('button');b.className='framebtn';b.textContent=p[1];b.setAttribute('data-key',p[0]);
    b.addEventListener('click',function(){
      var fr=document.querySelectorAll('#reply-frames .framebtn');for(var i=0;i<fr.length;i++)fr[i].classList.remove('on');
      b.classList.add('on');
      var src=state.replyCat==='msg'?MSG:FAQ;
      setOut(src[p[0]]||'');
      out.scrollIntoView({block:'center'});
    });
    box.appendChild(b);
  });
}

/* 👤 단골 */
function refreshCustomerDatalist(){
  var dl=$('customer-list');dl.innerHTML='';
  customers.forEach(function(c){var o=document.createElement('option');o.value=c.nickname;dl.appendChild(o);});
}
function findCustomerByNick(n){n=(n||'').trim();return customers.filter(function(c){return c.nickname===n;})[0];}
/* 주문 데이터에서 단골 자동 계산: 이름·통관·휴대폰·주소 같은 묶음 중 출고완료 3건 이상 */
function computeRegulars(){
  var groups={};
  orders.forEach(function(o){
    var name=(o.customer||o.recipient||'').trim();
    if(!name)return;
    var customs=(o.customsCode||'').replace(/[^0-9A-Za-z]/g,'').toUpperCase();
    var phone=(o.phone||'').replace(/[^0-9]/g,'');
    var addr=(o.address||'').replace(/\s+/g,' ').trim();
    var key=name+'|'+customs+'|'+phone+'|'+addr;
    var g=groups[key];
    if(!g){g=groups[key]={key:key,name:name,channel:o.channel||'',customsCode:o.customsCode||'',phone:o.phone||'',zip:o.zip||'',address:o.address||'',orders:[],shipped:0,lastOrderAt:null};}
    g.orders.push(o);
    if(o.status==='shipped'||o.status==='tracking')g.shipped++;
    if(!g.lastOrderAt||(o.createdAt||'')>g.lastOrderAt)g.lastOrderAt=o.createdAt;
  });
  return Object.keys(groups).map(function(k){return groups[k];}).filter(function(g){return g.shipped>=3;});
}
function renderCustomers(){
  var box=$('cus-list');box.innerHTML='';
  var regs=computeRegulars().sort(function(a,b){return (b.lastOrderAt||'').localeCompare(a.lastOrderAt||'');});
  if(!regs.length){box.innerHTML='<div class="empty"><b>👤</b>아직 단골이 없어요.<br>같은 손님의 <b>출고완료 주문이 3건</b> 이상 쌓이면<br>자동으로 여기 단골로 등록돼요!</div>';return;}
  regs.forEach(function(g){
    var ship=function(){return shippingBlock({recipient:g.name,phone:g.phone,zip:g.zip,address:g.address,customsCode:g.customsCode});};
    var card=document.createElement('div');card.className='card'+(state.expandedCus===g.key?' expanded':'');
    var head=document.createElement('div');head.className='card-head';
    head.innerHTML='<div><div class="card-name">'+esc(g.name)+' <span class="badge" style="background:#ffd400;color:#1b2330;">단골</span></div><div class="card-meta">'+esc(g.channel||'')+' · 출고완료 '+g.shipped+'건 · 총 '+g.orders.length+'건'+(g.lastOrderAt?' · 최근 '+fmtDate(g.lastOrderAt):'')+'</div></div><div class="card-meta">▾</div>';
    card.appendChild(head);
    var det=document.createElement('div');det.className='card-detail';
    var masked=g.customsCode?maskCustoms(g.customsCode):'(미입력)';
    var hist=g.orders.slice().sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
    var histHtml='<div class="secttl">🧾 주문 이력 ('+hist.length+'건)</div>'+hist.slice(0,30).map(function(o){return '<div class="card-meta">· '+fmtDate(o.createdAt)+' '+esc(o.itemName||'(상품)')+' <span class="badge badge-'+o.status+'">'+(STATUS_LABEL[o.status]||'')+'</span></div>';}).join('');
    det.innerHTML='<div class="card-meta" style="margin-bottom:6px;"><b>통관부호</b> '+esc(masked)+' '+(g.customsCode?'<button class="chip" data-act="reveal" style="margin-left:6px;padding:3px 8px;font-size:11px;">전체 보기</button> <button class="chip" data-act="copy-c" style="margin-left:4px;padding:3px 8px;font-size:11px;">복사</button>':'')+'</div>'
      +'<div class="card-meta" style="margin-bottom:4px;"><b>휴대폰</b> '+esc(g.phone||'(미입력)')+'</div>'
      +'<div class="card-meta" style="margin-bottom:8px;"><b>주소</b> '+esc(joinAddress(g.zip,g.address)||'(미입력)')+'</div>'
      +histHtml
      +'<div class="secttl">📦 택배 송장</div>'
      +'<div class="shipbox">'+esc(ship())+'</div>'
      +'<button class="actbtn" data-act="copy-ship">📋 택배 송장 복사</button>';
    card.appendChild(det);
    card.addEventListener('click',function(e){
      var act=e.target.getAttribute('data-act');
      if(act==='reveal'){alert(g.customsCode);return;}
      if(act==='copy-c'){copyText(g.customsCode||'');return;}
      if(act==='copy-ship'){copyText(ship());return;}
      state.expandedCus=state.expandedCus===g.key?null:g.key;renderCustomers();
    });
    box.appendChild(card);
  });
}

/* 📒 주문 장부 */
function bumpCustomer(nick,channel){
  if(!nick)return null;
  var c=findCustomerByNick(nick);
  if(!c){c={id:genId('cus'),nickname:nick,channel:channel||'기타',customsCode:'',address:'',phone:'',memo:'',orderCount:0,lastOrderAt:null};customers.push(c);}
  c.orderCount=(c.orderCount||0)+1;c.lastOrderAt=nowIso();
  saveCustomers();refreshCustomerDatalist();
  return c;
}
function addOrder(o){
  o.id=genId('ord');o.createdAt=nowIso();o.status=o.status||'req';o.synced=false;
  if(o.settled==null)o.settled='미정산';if(o.bigo==null)o.bigo='구매대행';if(o.qty==null)o.qty=1;
  var cus=bumpCustomer(o.customer,o.channel);if(cus)o.customerId=cus.id;
  orders.unshift(o);saveOrders();renderOrders();renderSales();
  doSync(o,true);
}
function doSync(o,silent){
  /* 홈페이지/ SNS에서 온 주문이면 진행상태·송장을 손님 사이트(Supabase)에도 반영 (2-way) */
  if(window.OSSWeb&&window.OSSWeb.pushUp&&o&&o.dbId)window.OSSWeb.pushUp(o);
  if(!WEBHOOK){if(!silent)toast('시트 주소가 없어요 🥲');return;}
  if(navigator&&navigator.onLine===false){o.synced=false;saveOrders();if(!silent){renderOrders();toast('📴 오프라인 — 인터넷 되면 자동 전송돼요');}return;}
  syncToSheet(o).then(function(){o.synced=true;saveOrders();if(!silent){renderOrders();toast('🔄 시트 갱신했어요!');}},
                      function(){o.synced=false;saveOrders();if(!silent){renderOrders();toast('📴 전송 실패 — 인터넷 확인 후 다시 시도');}});
}
function retryPendingSync(){
  if(!WEBHOOK||(navigator&&navigator.onLine===false))return;
  var pend=orders.filter(function(o){return !o.synced;});
  if(!pend.length)return;
  pend.forEach(function(o){syncToSheet(o).then(function(){o.synced=true;saveOrders();},function(){});});
  setTimeout(function(){if(state.tab==='ledger')renderOrders();},1500);
}
function shipNotice(o){
  return '오늘 발송 완료했어요! 📦💌\n🚚 송장번호 : '+(o.trackingNo||'[송장번호]')+(o.itemName?'\n('+o.itemName+')':'')+'\n출고 후 3~5일이면 도착해요. 잘 받으시면 후기 살짝 남겨주시면 정말 감사해요 🥹🤍';
}
function updateFilterCounts(){
  var counts={all:orders.length}; orders.forEach(function(o){counts[o.status]=(counts[o.status]||0)+1;});
  var labels={all:'전체',req:'사입요청',reserve:'예약',bought:'사입완료',office:'사무실도착',shipped:'출고완료',tracking:'운송장',cancel:'취소'};
  document.querySelectorAll('[data-filter]').forEach(function(c){
    var f=c.getAttribute('data-filter'), n=counts[f]||0;
    c.textContent=(labels[f]||f)+(n?' '+n:'');
  });
}
function renderTodo(){
  var box=$('todo-summary'); if(!box)return;
  var c={};orders.forEach(function(o){c[o.status]=(c[o.status]||0)+1;});
  var items=[{f:'req',e:'🛒',l:'사입할 거',n:c.req||0},{f:'office',e:'📦',l:'출고할 거',n:c.office||0},{f:'reserve',e:'📌',l:'예약',n:c.reserve||0}].filter(function(x){return x.n>0;});
  if(!items.length){box.innerHTML='<div class="todo-empty">✨ 지금 급한 할 일은 없어요!</div>';return;}
  box.innerHTML='<div class="todo-title">📋 오늘 할 일 (눌러서 보기)</div><div class="todo-row">'+items.map(function(x){return '<button class="todo-chip" data-todo="'+x.f+'">'+x.e+' '+x.l+' <b>'+x.n+'</b></button>';}).join('')+'</div>';
  box.querySelectorAll('[data-todo]').forEach(function(b){b.addEventListener('click',function(){
    var f=b.getAttribute('data-todo');
    $('ord-form').classList.remove('on');$('trash-panel').classList.remove('on');
    document.querySelectorAll('[data-filter]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-filter')===f);});
    state.ledgerFilter=f;renderOrders();
  });});
}
function renderOrders(){
  var box=$('ord-list');box.innerHTML='';
  updateFilterCounts();
  renderTodo();
  var q=(state.search||'').toLowerCase();
  var list=orders.filter(function(o){
    if(state.ledgerFilter!=='all'&&o.status!==state.ledgerFilter)return false;
    if(q){var hay=((o.customer||'')+' '+(o.recipient||'')+' '+(o.itemName||'')+' '+(o.customsCode||'')+' '+(o.phone||'')+' '+(o.trackingNo||'')).toLowerCase();if(hay.indexOf(q)<0)return false;}
    return true;
  });
  if(!list.length){box.innerHTML='<div class="empty"><b>📒</b>'+(state.ledgerFilter==='all'?'아직 주문이 없어요.<br>홈페이지·SNS 주문이 들어오면 여기 자동으로 떠요!<br><small>(위 🟢 연결 바에서 “지금 불러오기”)</small>':'이 상태에 해당하는 주문이 없어요.')+'</div>';return;}
  list.forEach(function(o){
    var card=document.createElement('div');card.className='card'+(state.expandedOrd===o.id?' expanded':'');
    card.style.borderLeft='5px solid '+(STATUS_COLOR[o.status]||'#cbd1da');
    var amt=o.sellKrw?won(o.sellKrw)+'원':(o.buyYen?'¥'+won(o.buyYen):'');
    var settledHtml='<div style="font-size:11px;font-weight:700;margin-top:2px;color:'+(o.settled==='정산'?'#9097a1':'#e25d5d')+';">'+(o.settled==='정산'?'정산✓':'미정산')+'</div>';
    var head=document.createElement('div');head.className='card-head';
    head.innerHTML='<div><div class="card-name">'+esc(o.customer||'(이름없음)')+' <span class="badge badge-'+o.status+'">'+(STATUS_LABEL[o.status]||o.status)+'</span>'+(o.synced?' <span class="card-meta" style="color:#1f8a4c;">✓시트</span>':'')+'</div>'
      +'<div class="card-meta">'+fmtDate(o.createdAt)+' · '+esc(o.channel||'')+(o.itemName?' · '+esc(o.itemName):'')+'</div></div>'
      +'<div class="card-amount" style="text-align:right;">'+amt+settledHtml+'</div>';
    card.appendChild(head);
    var det=document.createElement('div');det.className='card-detail';
    var sr='<div class="secttl">📊 진행 상태</div><div class="status-row">';
    STATUS_ORDER.forEach(function(s){sr+='<button class="status-btn'+(o.status===s?' on':'')+'" data-st="'+s+'">'+STATUS_LABEL[s]+'</button>';});
    sr+='</div><div class="toggle-row"><button class="chip'+(o.settled==='미정산'?' on':'')+'" data-settled="미정산">미정산</button><button class="chip'+(o.settled==='정산'?' on':'')+'" data-settled="정산">정산</button></div>';
    var pay=o.payCard?(o.payCard+(o.payDate?'('+o.payDate+')':'')):'(미입력)';
    var info='<div class="secttl">🛍️ 상품·사입 (수정 가능)</div>'
      +'<div class="field" style="margin-bottom:8px;"><label>상품명</label><input data-fld="itemName" value="'+esc(o.itemName||'')+'"></div>'
      +'<div class="row"><div class="field" style="margin-bottom:8px;"><label>옵션</label><input data-fld="itemOption" value="'+esc(o.itemOption||'')+'"></div>'
      +'<div class="field" style="margin-bottom:8px;"><label>수량</label><input data-fld="qty" inputmode="numeric" value="'+esc(o.qty||1)+'"></div></div>'
      +'<div class="row"><div class="field" style="margin-bottom:8px;"><label>사입처</label><input data-fld="buyFrom" value="'+esc(o.buyFrom||'')+'"></div>'
      +'<div class="field" style="margin-bottom:8px;"><label>사입가(¥)</label><input data-fld="buyYen" inputmode="numeric" value="'+esc(o.buyYen||'')+'"></div></div>'
      +'<div class="card-meta" style="margin-bottom:2px;"><b>결제</b> '+esc(pay)+' · '+esc(o.bigo||'구매대행')+(o.invoice?' · '+esc(o.invoice):'')+'</div>';
    var money='<div class="secttl">💰 금액</div>'
      +'<div class="row"><div class="field" style="margin-bottom:8px;"><label>판매가(원)</label><input data-fld="sellKrw" inputmode="numeric" value="'+esc(o.sellKrw||'')+'"></div>'
      +'<div class="field" style="margin-bottom:8px;"><label>정산가(원)</label><input data-fld="settleKrw" inputmode="numeric" value="'+esc(o.settleKrw||'')+'"></div></div>'
      +'<div class="field"><label>배송비 추가금(원)</label><input data-fld="shipExtraKrw" inputmode="numeric" value="'+esc(o.shipExtraKrw||'')+'"></div>'
      +'<div class="field"><label>송장번호</label><input data-fld="trackingNo" value="'+esc(o.trackingNo||'')+'" placeholder="예: 123456789"></div>'
      +'<div class="field"><label>메모</label><textarea data-fld="memo">'+esc(o.memo||'')+'</textarea></div>';
    var ship='<div class="secttl">📦 택배 정보 (수정 가능)</div>'
      +'<div class="field" style="margin-bottom:8px;"><label>통관부호</label><input data-fld="customsCode" value="'+esc(o.customsCode||'')+'" placeholder="P로 시작 13자리"></div>'
      +'<div class="row"><div class="field" style="margin-bottom:8px;"><label>전화</label><input data-fld="phone" inputmode="numeric" value="'+esc(o.phone||'')+'"></div>'
      +'<div class="field" style="margin-bottom:8px;"><label>우편번호</label><input data-fld="zip" inputmode="numeric" value="'+esc(o.zip||'')+'"></div></div>'
      +'<div class="field" style="margin-bottom:8px;"><label>주소</label><textarea data-fld="address">'+esc(o.address||'')+'</textarea></div>'
      +'<div class="field"><label>배송메모</label><input data-fld="deliveryMemo" value="'+esc(o.deliveryMemo||'')+'" placeholder="문 앞 등"></div>'
      +'<div class="copyrow"><button class="actbtn" data-act="copy-ship" style="margin-top:8px;">📋 송장 복사</button><button class="actbtn" data-act="ship-notice" style="margin-top:8px;">📤 발송안내 복사</button></div>'
      +'<button class="syncbtn'+(o.synced?' synced':'')+'" data-act="sync">'+(o.synced?'🔄 시트 갱신 (변경사항 반영)':'📤 시트에 올리기')+'</button>'
      +'<div class="card-meta" style="text-align:center;margin-top:4px;">정보·진행상태·금액 바꾸면 시트도 자동으로 갱신돼요</div>';
    var _qa='<div class="copyrow" style="margin-bottom:8px;">'+(o.phone?'<a class="actbtn" style="margin-top:0;text-decoration:none;text-align:center;" href="tel:'+esc((o.phone||"").replace(/[^0-9+]/g,""))+'">📞 전화</a>':'')+'<button class="actbtn" data-act="copy-customs" style="margin-top:0;">📋 통관부호</button><button class="actbtn" data-act="copy-addr" style="margin-top:0;">📋 주소</button></div>';
    var _ph=(o.images&&o.images.length)?('<div class="secttl">🖼️ 상품 사진</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">'+o.images.map(function(u){return '<a href="'+esc(u)+'" target="_blank"><img src="'+esc(u)+'" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #eee;"></a>';}).join('')+'</div>'):'';
    det.innerHTML=_qa+_ph+sr+info+money+ship+'<button class="delbtn" data-act="del">🗑️ 주문 삭제</button>';
    card.appendChild(det);
    card.addEventListener('click',function(e){
      var st=e.target.getAttribute('data-st');
      if(st){o.status=st;saveOrders();renderOrders();renderSales();doSync(o,true);return;}
      var sv=e.target.getAttribute('data-settled');
      if(sv){o.settled=sv;saveOrders();renderOrders();doSync(o,true);return;}
      var act=e.target.getAttribute('data-act');
      if(act==='copy-ship'){copyText(shippingBlock(o));return;}
      if(act==='ship-notice'){copyText(shipNotice(o));return;}
      if(act==='copy-customs'){copyText(o.customsCode||'');toast('📋 통관부호 복사!');return;}
      if(act==='copy-addr'){copyText(joinAddress(o.zip,o.address)||o.address||'');toast('📋 주소 복사!');return;}
      if(act==='sync'){doSync(o,false);return;}
      if(act==='del'){if(confirm('이 주문을 휴지통으로 보낼까요? (나중에 되돌릴 수 있어요)')){if(o.synced)deleteFromSheet(o);o.deletedAt=nowIso();trash.unshift(o);saveTrash();orders=orders.filter(function(x){return x.id!==o.id;});saveOrders();renderOrders();renderSales();toast('🗑 휴지통으로 옮겼어요 (되돌릴 수 있어요)');}return;}
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
      state.expandedOrd=state.expandedOrd===o.id?null:o.id;renderOrders();
    });
    det.querySelectorAll('[data-fld]').forEach(function(inp){
      inp.addEventListener('input',function(){
        var f=inp.getAttribute('data-fld');
        if(f==='sellKrw'||f==='settleKrw'||f==='shipExtraKrw'||f==='buyYen'||f==='qty')o[f]=num(inp.value);
        else o[f]=inp.value;
        saveOrders();
      });
      inp.addEventListener('change',function(){doSync(o,true);});
      inp.addEventListener('click',function(e){e.stopPropagation();});
    });
    box.appendChild(card);
  });
}

/* 🗑 휴지통 */
function renderTrash(){
  var box=$('trash-list');box.innerHTML='';
  if(!trash.length){box.innerHTML='<div class="empty"><b>🗑</b>휴지통이 비어 있어요.</div>';return;}
  trash.forEach(function(o){
    var card=document.createElement('div');card.className='card';
    card.innerHTML='<div class="card-head"><div><div class="card-name">'+esc(o.customer||'(이름없음)')+'</div><div class="card-meta">'+fmtDate(o.createdAt)+(o.itemName?' · '+esc(o.itemName):'')+(o.deletedAt?' · 삭제 '+fmtDate(o.deletedAt):'')+'</div></div></div>'
      +'<div class="copyrow"><button class="actbtn solid" data-act="restore" style="margin-top:0;">↩️ 되돌리기</button><button class="delbtn" data-act="purge" style="margin-top:0;">완전 삭제</button></div>';
    card.querySelector('[data-act="restore"]').addEventListener('click',function(){
      trash=trash.filter(function(x){return x.id!==o.id;});saveTrash();
      delete o.deletedAt;o.synced=false;orders.unshift(o);saveOrders();
      doSync(o,true);
      renderTrash();renderOrders();renderSales();toast('↩️ 되돌렸어요! (시트에도 다시 올라가요)');
    });
    card.querySelector('[data-act="purge"]').addEventListener('click',function(){
      if(!confirm('완전히 삭제할까요? 이건 되돌릴 수 없어요.'))return;
      trash=trash.filter(function(x){return x.id!==o.id;});saveTrash();renderTrash();
    });
    box.appendChild(card);
  });
}

/* 💴 매출 정리 */
function buildMonthOptions(){
  var sel=$('sales-month');sel.innerHTML='';
  var months={};orders.forEach(function(o){months[fmtMonth(o.createdAt)]=true;});months[thisMonth()]=true;
  var arr=Object.keys(months).sort().reverse();
  arr.forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;if(m===state.salesMonth)o.selected=true;sel.appendChild(o);});
}
function renderSales(){
  buildMonthOptions();
  var month=state.salesMonth;
  var inMonth=orders.filter(function(o){return fmtMonth(o.createdAt)===month&&(o.status==='shipped'||o.status==='tracking');});
  var sell=0,settle=0,buy=0;
  inMonth.forEach(function(o){sell+=num(o.sellKrw);settle+=num(o.settleKrw);buy+=num(o.buyYen);});
  $('st-total').textContent=won(sell)+'원';
  $('st-count').textContent=inMonth.length+'건';
  $('st-goods').textContent=won(settle)+'원';
  $('st-fee').textContent='¥'+won(buy);
  var byCh={};inMonth.forEach(function(o){var k=o.channel||'기타';byCh[k]=(byCh[k]||0)+1;});
  var keys=Object.keys(byCh);
  if(!keys.length){$('st-bars').textContent='데이터 없음';}
  else{var max=Math.max.apply(null,keys.map(function(k){return byCh[k];}));
    var lines=keys.sort(function(a,b){return byCh[b]-byCh[a];}).map(function(k){var n=byCh[k];var bar=Array(Math.round(n/max*8)).fill('▓').join('')+Array(8-Math.round(n/max*8)).fill('░').join('');return k.padEnd(4,'　')+' '+bar+' '+n+'건';});
    $('st-bars').textContent=lines.join('\n');}
}

/* 🏠 홈 대시보드 */
function renderHome(){
  var box=$('home-body'); if(!box)return;
  var c={};orders.forEach(function(o){c[o.status]=(c[o.status]||0)+1;});
  var todo=[{f:'req',e:'🛒',l:'사입할 거',n:c.req||0},{f:'office',e:'📦',l:'출고할 거',n:c.office||0},{f:'reserve',e:'📌',l:'예약',n:c.reserve||0}].filter(function(x){return x.n>0;});
  var todoHtml=todo.length?('<div class="todo-row">'+todo.map(function(x){return '<button class="todo-chip" data-home-todo="'+x.f+'">'+x.e+' '+x.l+' <b>'+x.n+'</b></button>';}).join('')+'</div>'):'<div class="todo-empty">✨ 지금 급한 할 일은 없어요!</div>';
  var month=thisMonth();
  var inMonth=orders.filter(function(o){return fmtMonth(o.createdAt)===month&&(o.status==='shipped'||o.status==='tracking');});
  var sell=0;inMonth.forEach(function(o){sell+=num(o.sellKrw);});
  var unsettled=0;orders.forEach(function(o){if(o.settled!=='정산'&&o.status!=='cancel')unsettled+=num(o.sellKrw);});
  box.innerHTML='<div class="home-greet">'+esc(todayQuote())+'</div>'
    +'<div class="secttl">📋 오늘 할 일</div>'+todoHtml
    +'<div class="secttl">💴 이번 달 ('+month+')</div>'
    +'<div class="statgrid"><div class="stat"><div class="lab">매출</div><div class="val">'+won(sell)+'원</div></div><div class="stat"><div class="lab">출고 주문</div><div class="val">'+inMonth.length+'건</div></div><div class="stat"><div class="lab">미정산</div><div class="val" style="color:#e25d5d;">'+won(unsettled)+'원</div></div></div>'
    +'<div class="secttl">⚡ 빠른 시작</div>'
    +'<div class="home-quick"><button class="actbtn solid" data-home-go="orders">📒 주문 관리</button><button class="actbtn" data-home-go="quote">💰 견적 내기</button><button class="actbtn" data-home-go="reply">💬 응대 문구</button></div>';
  box.querySelectorAll('[data-home-todo]').forEach(function(b){b.addEventListener('click',function(){
    var f=b.getAttribute('data-home-todo');setMode('manage');setTab('ledger');
    document.querySelectorAll('[data-filter]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-filter')===f);});
    state.ledgerFilter=f;renderOrders();
  });});
  box.querySelectorAll('[data-home-go]').forEach(function(b){b.addEventListener('click',function(){
    var g=b.getAttribute('data-home-go');
    if(g==='orders'){setMode('manage');setTab('ledger');}
    else if(g==='quote'){setMode('reply');setTab('quote');}
    else if(g==='reply'){setMode('reply');setTab('reply');}
  });});
}

/* 모드 / 탭 전환 */
function setMode(mode){
  state.mode=mode;
  document.querySelectorAll('.mode').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-mode')===mode);});
  document.querySelectorAll('[data-tabs]').forEach(function(t){t.style.display=t.getAttribute('data-tabs')===mode?'flex':'none';});
  if(mode==='home'){setTab('home');return;}
  var first=document.querySelector('[data-tabs="'+mode+'"] .tab');if(first){setTab(first.getAttribute('data-tab'));}
}
function setTab(tab){
  state.tab=tab;
  document.querySelectorAll('.tab').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-tab')===tab);});
  document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('on',p.getAttribute('data-panel')===tab);});
  var hasOut=(tab==='quote'||tab==='ship'||tab==='reply');
  showActions(hasOut);
  closeSaveForm();
  if(tab==='home'){renderHome();}
  else if(tab==='quote'){setOut(quote());}
  else if(tab==='ship'){setOut('👆 무게를 골라주세요 🤍');document.querySelectorAll('[data-kg].on').forEach(function(b){b.classList.remove('on');});}
  else if(tab==='reply'){renderReplyButtons();setOut('👆 상황을 골라주세요 🤍');}
  else if(tab==='customer'){renderCustomers();refreshCustomerDatalist();}
  else if(tab==='ledger'){renderOrders();refreshCustomerDatalist();}
  else if(tab==='sales'){renderSales();}
}
function closeSaveForm(){['ord-form','trash-panel'].forEach(function(id){var e=$(id);if(e)e.classList.remove('on');});}
function goBack(){
  if($('ord-form')&&$('ord-form').classList.contains('on')){$('ord-form').classList.remove('on');return;}
  if($('trash-panel')&&$('trash-panel').classList.contains('on')){$('trash-panel').classList.remove('on');return;}
  if(state.expandedOrd){state.expandedOrd=null;renderOrders();return;}
  if(state.expandedCus){state.expandedCus=null;renderCustomers();return;}
  if(state.mode!=='home'){setMode('home');}
}
