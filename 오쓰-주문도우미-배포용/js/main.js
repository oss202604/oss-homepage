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

/* 주문 등록 폼 */
$('ord-add').addEventListener('click',function(){$('ord-form').classList.toggle('on');if($('ord-form').classList.contains('on'))$('ord-form').scrollIntoView({block:'center'});});
$('ord-close').addEventListener('click',function(){$('ord-form').classList.remove('on');});
/* 판매처: '기타' 선택 시 직접입력 칸 표시 */
function orderChannel(){var ch=$('of-channel').value;if(ch==='기타'){ch=$('of-channel-custom').value.trim()||'기타';}return ch;}
$('of-channel').addEventListener('change',function(){var cu=$('of-channel-custom');if(this.value==='기타'){cu.style.display='block';cu.focus();}else{cu.style.display='none';cu.value='';}});
chipGroup('of-paychips',true,true);
chipGroup('of-bigochips',true,false);
chipGroup('of-invchips',true,true);
$('of-parse').addEventListener('click',function(){
  var d=parseCustomerText($('of-paste').value);
  if(!d.name){alert('구매자 실명을 찾지 못했어요 🥹 형식 확인해주세요!');return;}
  $('of-customer').value=d.name;
  $('of-recipient').value=d.name;
  if(d.item)$('of-item').value=d.item;
  if(d.quantity)$('of-qty').value=d.quantity;
  if(d.customs)$('of-customs').value=d.customs;
  if(d.phone)$('of-phone').value=d.phone;
  if(d.zip)$('of-zip').value=d.zip;
  if(d.address)$('of-addr').value=d.address;
  if(d.link)$('of-url').value=d.link;
  var existing=findCustomerByNick(d.name);
  var cusData={nickname:d.name,channel:orderChannel()};
  if(d.customs)cusData.customsCode=d.customs;
  if(d.phone)cusData.phone=d.phone;
  if(d.zip||d.address)cusData.address=joinAddress(d.zip,d.address);
  if(existing){Object.assign(existing,cusData);}
  else{customers.push(Object.assign({id:genId('cus'),customsCode:'',phone:'',address:'',memo:'',orderCount:0,lastOrderAt:null},cusData));}
  saveCustomers();refreshCustomerDatalist();
  toast('🔮 자동 채움 + 단골 갱신!');
});
$('ord-save').addEventListener('click',function(){
  var nick=$('of-customer').value.trim();if(!nick){alert('주문자(닉네임)를 적어주세요!');return;}
  var _item=$('of-item').value.trim();
  var _dup=orders.filter(function(o){return o.customer===nick&&(o.itemName||'')===_item&&o.status!=='cancel';});
  if(_dup.length&&!confirm('"'+nick+'" 님의 '+(_item?'"'+_item+'" ':'')+'주문이 이미 '+_dup.length+'건 있어요.\n그래도 새로 등록할까요?'))return;
  addOrder({
    customer:nick, recipient:($('of-recipient').value.trim()||nick), channel:orderChannel(),
    itemName:$('of-item').value.trim(), itemOption:$('of-option').value.trim(), itemUrl:$('of-url').value.trim(), qty:num($('of-qty').value)||1,
    buyFrom:$('of-buyfrom').value.trim(), buyYen:num($('of-buyyen').value),
    payCard:chipValue('of-paychips','data-pay'), payDate:$('of-paydate').value.trim(),
    sellKrw:num($('of-sell').value), settleKrw:num($('of-settle').value), shipExtraKrw:0,
    bigo:chipValue('of-bigochips','data-bigo')||'구매대행', invoice:chipValue('of-invchips','data-inv'),
    customsCode:$('of-customs').value.trim(), phone:$('of-phone').value.trim(), zip:$('of-zip').value.trim(),
    address:$('of-addr').value.trim(), deliveryMemo:$('of-dmemo').value.trim(), trackingNo:'', memo:''
  });
  ['of-customer','of-recipient','of-item','of-option','of-url','of-buyfrom','of-buyyen','of-paydate','of-sell','of-settle','of-customs','of-phone','of-zip','of-addr','of-dmemo','of-paste','of-channel-custom'].forEach(function(id){$(id).value='';});
  $('of-qty').value='1';$('of-channel').selectedIndex=0;$('of-channel-custom').style.display='none';
  document.querySelectorAll('#of-paychips .chip,#of-invchips .chip').forEach(function(x){x.classList.remove('on');});
  document.querySelectorAll('#of-bigochips .chip').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-bigo')==='구매대행');});
  $('ord-form').classList.remove('on');toast('📒 장부에 저장됐어요!');
});

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
['q-price','ship-custom','of-sell','of-settle','of-buyyen'].forEach(function(id){attachComma($(id));});
refreshCustomerDatalist();
setMode('home');
retryPendingSync();
