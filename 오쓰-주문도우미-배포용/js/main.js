/* ============================================================
   main.js — 이벤트 연결 + 시작 (제일 마지막 로드)
============================================================ */

/* 칩 그룹 헬퍼 */
function chipGroup(containerId, single, allowNone){
  document.querySelectorAll('#'+containerId+' .chip').forEach(function(c){
    c.addEventListener('click',function(){
      var wasOn=c.classList.contains('on');
      if(single){document.querySelectorAll('#'+containerId+' .chip').forEach(function(x){x.classList.remove('on');});}
      if(allowNone&&wasOn)c.classList.remove('on'); else c.classList.add('on');
    });
  });
}
function chipValue(containerId,attr){var c=document.querySelector('#'+containerId+' .chip.on');return c?c.getAttribute(attr):'';}

/* 모드·탭 */
document.querySelectorAll('.mode').forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-mode'));});});
document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){setTab(b.getAttribute('data-tab'));});});
$('backbtn').addEventListener('click',goBack);

/* 견적 */
$('q-price').addEventListener('input',function(){if(state.tab==='quote')setOut(quote());});
/* 견적 탭은 계산·복사만 (주문 저장 폼 제거됨) */

/* 배송비 */
document.querySelectorAll('[data-kg]').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('[data-kg]').forEach(function(x){x.classList.remove('on');});
  b.classList.add('on');
  var kg=b.getAttribute('data-kg'),ci=$('ship-custom');
  if(kg==='custom'){ci.style.display='block';ci.focus();setOut(shipMsgCustom(num(ci.value)));}
  else{ci.style.display='none';setOut(shipMsg(num(kg)));}
  out.scrollIntoView({block:'center'});
});});
$('ship-custom').addEventListener('input',function(){setOut(shipMsgCustom(num(this.value)));});

/* 응대 카테고리 토글 */
document.querySelectorAll('#reply-chips .chip').forEach(function(c){c.addEventListener('click',function(){
  document.querySelectorAll('#reply-chips .chip').forEach(function(x){x.classList.remove('on');});
  c.classList.add('on');state.replyCat=c.getAttribute('data-cat');renderReplyButtons();
  setOut('👆 상황을 골라주세요 🤍');
});});

/* 단골 */
/* 단골은 주문 데이터에서 자동 계산 (수동 등록 폼 제거됨) */

/* 주문 장부 — 필터 */
document.querySelectorAll('[data-filter]').forEach(function(c){c.addEventListener('click',function(){
  $('ord-form').classList.remove('on');$('trash-panel').classList.remove('on');
  document.querySelectorAll('[data-filter]').forEach(function(x){x.classList.remove('on');});
  c.classList.add('on');state.ledgerFilter=c.getAttribute('data-filter');renderOrders();
});});

$('ord-search').addEventListener('input',function(){state.search=this.value.trim();renderOrders();});
$('trash-btn').addEventListener('click',function(){var p=$('trash-panel');p.classList.toggle('on');if(p.classList.contains('on')){renderTrash();p.scrollIntoView({block:'center'});}});
$('trash-close').addEventListener('click',function(){$('trash-panel').classList.remove('on');});

/* 주문 등록 폼 제거됨 — 주문은 홈페이지 주문서·SNS에서 자동 수신(oss-sb.js) */

/* 매출 */
$('sales-month').addEventListener('change',function(){state.salesMonth=this.value;renderSales();});
$('st-csv').addEventListener('click',function(){
  var month=state.salesMonth;
  var cols=['주문날짜','판매처','주문자','수취인','상품명','옵션정보','수량','판매가격','정산가격','배송비','사입처','사입가엔화','사입방법','진행상태','비고란','정산상태','통관번호','전화번호','휴대폰번호','우편번호','주소','배송메모'];
  var rows=[cols];
  orders.filter(function(o){return fmtMonth(o.createdAt)===month;}).forEach(function(o){var p=buildSheetPayload(o);rows.push(cols.map(function(k){return p[k];}));});
  if(rows.length<2){alert('이 달엔 주문이 없어요 🥹');return;}
  downloadFile('OSS_SNS주문_'+month+'.csv',toCsv(rows),'text/csv');toast('📥 CSV 다운로드 시작!');
});
$('st-backup').addEventListener('click',function(){
  var data={version:2,exportedAt:nowIso(),orders:orders,customers:customers};
  downloadFile('OSS_백업_'+fmtDate(nowIso())+'.json',JSON.stringify(data,null,2),'application/json');toast('📦 백업 다운로드 시작!');
});
$('st-cloud-restore').addEventListener('click',function(){
  if(!confirm('시트 백업에서 불러올까요? 지금 폰 데이터는 백업 내용으로 덮어써져요.'))return;
  restoreFromCloud(function(data){
    if(!data){alert('백업을 찾지 못했어요 🥲 (아직 자동백업 전이거나, 시트 스크립트 최종본인지 확인해주세요)');return;}
    try{
      var d=JSON.parse(data);
      orders=d.orders||[]; customers=d.customers||[]; trash=d.trash||[];
      save('oss_orders',orders); save('oss_customers',customers); save('oss_trash',trash);
      refreshCustomerDatalist(); renderOrders(); renderCustomers(); renderSales();
      toast('☁️ 복원 완료! ('+orders.length+'건)');
    }catch(e){ alert('백업 데이터를 읽지 못했어요: '+e.message); }
  });
});
$('st-restore').addEventListener('click',function(){$('st-file').click();});
$('st-file').addEventListener('change',function(e){
  var f=e.target.files[0];if(!f)return;
  var rd=new FileReader();rd.onload=function(){
    try{
      var d=JSON.parse(rd.result);
      if(!d||!Array.isArray(d.orders)||!Array.isArray(d.customers))throw new Error('형식 오류');
      if(!confirm('지금 데이터를 백업 파일로 덮어쓸까요? (현재 데이터는 사라져요)'))return;
      orders=d.orders;customers=d.customers;saveOrders();saveCustomers();
      refreshCustomerDatalist();renderOrders();renderCustomers();renderSales();
      toast('♻️ 복원 완료!');
    }catch(err){alert('백업 파일을 읽지 못했어요: '+err.message);}
  };rd.readAsText(f);e.target.value='';
});

/* 미리보기·복사·비우기 */
out.addEventListener('input',fit);
$('copy').addEventListener('click',function(){copyText(out.value);});
$('reset').addEventListener('click',function(){
  if(!confirm('지금 화면을 처음 상태로 되돌릴까요?'))return;
  if(state.tab==='quote')$('q-price').value='';
  setTab(state.tab);
});

/* 시작 */
window.addEventListener('online',retryPendingSync);
['q-price','ship-custom'].forEach(function(id){attachComma($(id));});
refreshCustomerDatalist();
setMode('home');
retryPendingSync();
