/* ============================================================
   util.js — 공통 함수 (계산·날짜·복사·저장·파싱)
   다른 파일보다 먼저 로드됨. 순수 함수 위주.
============================================================ */
function $(id){return document.getElementById(id);}
function num(s){return parseInt(String(s||'').replace(/[^0-9]/g,''),10)||0;}
function won(n){return (n||0).toLocaleString('ko-KR');}
function load(key){try{return JSON.parse(localStorage.getItem(key)||'[]');}catch(e){return [];}}
function save(key,arr){localStorage.setItem(key,JSON.stringify(arr));}
function genId(p){return p+'_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);}
function nowIso(){return new Date().toISOString();}
function fmtDate(iso){if(!iso)return '';var d=new Date(iso);var mm=String(d.getMonth()+1).padStart(2,'0');var dd=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+mm+'-'+dd;}
function fmtMonth(iso){if(!iso)return '';var d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function thisMonth(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function calcQuote(yen){var goodsKrw=yen*10,feeKrw=Math.round(yen*0.3);return {yen:yen,goodsKrw:goodsKrw,feeKrw:feeKrw,sumKrw:goodsKrw+feeKrw};}
function maskCustoms(c){if(!c)return '';c=c.replace(/[^0-9A-Za-z]/g,'');if(c.length<6)return c;return c.slice(0,1)+'****-****-***'+c.slice(-2);}
function csvCell(v){v=String(v==null?'':v);if(/[",\n]/.test(v))return '"'+v.replace(/"/g,'""')+'"';return v;}
function toCsv(rows){return rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n');}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];});}
function downloadFile(name,text,mime){
  var blob=new Blob(['﻿'+text],{type:(mime||'text/plain')+';charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},0);
}

/* ── 손님 정보 텍스트 자동 파싱 ── */
function parseCustomerText(text){
  if(!text)return {};
  var t=text.replace(/\r/g,'').replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xfee0);});
  function ex(p){var m=t.match(p);return m?m[1].trim():'';}
  var phone=ex(/(?:휴대폰|핸드폰|연락처|전화)[^:：\n]*[:：]\s*([^\n]+)/).replace(/[^\d]/g,'');
  var customsLine=ex(/(?:개인통관|통관부호|통관고유부호)[^:：\n]*[:：]\s*([^\n]+)/);
  var cm=customsLine.match(/[Pp][\dA-Za-z]{12,13}/);
  var customs=cm?cm[0]:'';
  return {
    item: ex(/상품\s*명?[^\n:：]*[:：]\s*([^\n]+)/),
    name: ex(/(?:구매자\s*실명|실명|성함|이름|받는\s*분)[^\n:：]*[:：]\s*([^\d\n][^\n]*)/),
    phone: phone,
    customs: customs.toUpperCase(),
    zip: ex(/(?:우편번호|우편\s*번호)[^\n:：]*[:：]\s*(\d{5,6})/),
    address: ex(/(?:수령인\s*)?(?:상세\s*)?주소[^\n:：]*[:：]\s*([^\n]+)/),
    link: ex(/링크[^\n:：]*[:：]\s*([^\s\n]+)/),
    quantity: ex(/총\s*(\d+)\s*[개건]/)||ex(/(\d+)\s*개\s*주문/)
  };
}
function joinAddress(zip,addr){var p='';if(zip)p='('+zip+') ';return (p+(addr||'')).trim();}
function attachComma(inp){
  if(!inp)return;
  inp.addEventListener('focus',function(){this.value=this.value.replace(/,/g,'');});
  inp.addEventListener('blur',function(){var n=num(this.value);this.value=n?won(n):'';});
}
function todayQuote(){
  if(typeof QUOTES==='undefined'||!QUOTES.length)return '오늘도 화이팅이에요 🤍';
  var n=new Date();var day=Math.floor((n.getTime()-n.getTimezoneOffset()*60000)/86400000);
  return QUOTES[((day%QUOTES.length)+QUOTES.length)%QUOTES.length];
}

/* ── 토스트 / 복사 ── */
function toast(msg){
  var t=$('toast');t.textContent=msg||'✅ 복사됐어요!';t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');t.textContent='✅ 복사됐어요!';},1600);
  if(/복사/.test(msg||'')){var b=$('copy');if(b){b.classList.add('done');b.textContent='✅ 복사됨!';setTimeout(function(){b.classList.remove('done');b.textContent='📋 복사하기';},1600);}}
}
function copyText(text){
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(text).then(function(){toast('✅ 복사됐어요!');},function(){fallbackCopy(text);});
  }else{fallbackCopy(text);}
}
function fallbackCopy(text){
  var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');
  ta.style.position='absolute';ta.style.left='-9999px';document.body.appendChild(ta);
  ta.select();ta.setSelectionRange(0,text.length);
  try{document.execCommand('copy');toast('✅ 복사됐어요!');}catch(e){alert('복사가 안 되면 미리보기 글자를 길게 눌러 직접 복사하세요!');}
  document.body.removeChild(ta);
}

/* ── 시트 전송 / 택배 송장 ── (STATUS_LABEL·WEBHOOK 등은 data.js, 호출 시점엔 로드됨) */
function buildSheetPayload(o){
  var pay=o.payCard?(o.payCard+(o.payDate?'('+o.payDate+')':'')):'';
  return {
    '주문날짜':fmtDate(o.createdAt),'판매처':o.channel||'','주문자':o.customer||'','수취인':o.recipient||o.customer||'',
    '상품명':o.itemName||'','옵션정보':o.itemOption||'','수량':o.qty||'',
    '판매가격':o.sellKrw||'','정산가격':o.settleKrw||'','배송비':o.shipExtraKrw||'',
    '사입처':o.buyFrom||'','사입가엔화':o.buyYen||'','사입방법':pay,
    '진행상태':(STATUS_LABEL[o.status]||o.status||''),'비고란':o.bigo||'구매대행','정산상태':o.settled||'미정산',
    '통관번호':o.customsCode||'','전화번호':o.phone||'','휴대폰번호':o.phone||'',
    '우편번호':o.zip||'','주소':o.address||'','배송메모':o.deliveryMemo||'','인보이스유무':o.invoice||'',
    '_id':o.id||'','action':'upsert'
  };
}
function syncToSheet(o){
  return fetch(WEBHOOK,{method:'POST',mode:'no-cors',body:JSON.stringify(buildSheetPayload(o))});
}
function deleteFromSheet(o){
  return fetch(WEBHOOK,{method:'POST',mode:'no-cors',body:JSON.stringify({_id:o.id||'',action:'delete'})});
}

/* ── 자동 백업 / 복원 (시트 숨김탭에 통짜 JSON) ── */
var __backupTimer=null;
function scheduleBackup(){ if(!WEBHOOK)return; clearTimeout(__backupTimer); __backupTimer=setTimeout(pushBackup,4000); }
function pushBackup(){
  if(!WEBHOOK)return;
  try{ fetch(WEBHOOK,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'backup',data:JSON.stringify({v:2,orders:orders,customers:customers,trash:trash})})}); }catch(e){}
  if(typeof toast==='function')toast(navigator&&navigator.onLine===false?'💾 폰에 저장됨 (인터넷 되면 백업)':'☁️ 자동 저장됐어요');
}
function jsonp(url,cb){
  var name='__oss_cb_'+Math.random().toString(36).slice(2);
  var s=document.createElement('script');
  window[name]=function(res){ try{cb(res);}finally{ delete window[name]; if(s.parentNode)s.parentNode.removeChild(s); } };
  s.onerror=function(){ try{cb(null);}finally{ delete window[name]; if(s.parentNode)s.parentNode.removeChild(s); } };
  s.src=url+(url.indexOf('?')<0?'?':'&')+'callback='+name;
  document.body.appendChild(s);
}
function restoreFromCloud(cb){ jsonp(WEBHOOK+'?action=backup',function(res){ cb(res&&res.ok?res.data:null); }); }
function shippingBlock(o){
  var name=o.recipient||o.customer||o.nickname||'';
  var lines=['수취인: '+name];
  if(o.phone)lines.push(o.phone);
  var addr=o.zip?joinAddress(o.zip,o.address):(o.address||'');
  if(addr)lines.push(addr);
  if(o.customsCode)lines.push('통관: '+o.customsCode);
  if(o.deliveryMemo)lines.push('메모: '+o.deliveryMemo);
  return lines.join('\n');
}
