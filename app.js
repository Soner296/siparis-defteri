'use strict';
const el=id=>document.getElementById(id);
const labels=['Sipariş tutarı','Ödenen','Para üstü'];
const currency=new Intl.NumberFormat('tr-TR',{style:'currency',currency:'EUR',currencyDisplay:'code'});
const money=cents=>currency.format(cents/100).replace('EUR','').trim()+' €';
const prefix='siparis-defteri:1:';
let values=[],active=0,editing=null;
function cents(value){
  if(!/^\d{1,8}(,\d{0,2})?$/.test(value))return null;
  const [whole,fraction='']=value.split(',');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
let dailySales = null;
let hours = '';
let shiftDate = '';
let shiftSales = null;
let shiftRate = hourlyRate;
function renderCalculation() {
  const hundredths = cents(hours);
  const deduction = hundredths === null ? null : hundredths * shiftRate;
  el('hours').textContent = (hours || '—') + ' saat';
  el('sales').textContent = shiftSales === null ? '—' : money(shiftSales);
  el('save-shift').disabled = hundredths === null || hundredths > 2400 || shiftSales === null;
  el('shift-error').textContent = hundredths > 2400 ? 'Bir gün için en fazla 24 saat girebilirsin.' : '';
  el('wage').textContent = deduction === null ? '—' : money(deduction);
  el('balance').textContent = deduction === null || shiftSales === null ? '—' : money(shiftSales - deduction);
}
function home(){
  const today=new Date();
  el('date').textContent=today.toLocaleDateString('tr-TR',{dateStyle:'full'});
  try{
    const days = readDays();
    const day = days.get(localDay(today));
    const orders = day.orders.sort((a,b)=>b.time-a.time);
    dailySales = day.sales;
    if (!el('reports').hidden) renderReport(days);
    if (el('calculation').open) shiftSales = days.get(shiftDate)?.sales ?? 0;
    el('total').textContent=money(dailySales);
    el('count').textContent=orders.length;
    el('list').replaceChildren();
    for(const o of orders.slice(0, 3)){
      const row=document.createElement('button');
      row.className='row';
      const amount=document.createElement('b'),time=document.createElement('small'),tip=document.createElement('span');
      amount.textContent=money(o.price);
      time.textContent=new Date(o.time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      amount.append(time);tip.textContent=money(o.tip)+' bahşiş';
      row.append(amount,tip);row.onclick=()=>openEntry(o);el('list').append(row);
    }
    if(!orders.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Bugün henüz sipariş yok.';el('list').append(empty);}
  }catch{dailySales=null;shiftSales=null;el('message').textContent='Kayıtlar okunamadı. Tarayıcı depolama ayarlarını kontrol et.';}
  if(el('calculation').open) renderCalculation();
}
let historyEdit = false;
let suspendedDraft = null;
function openEntry(order=null){
  editing=order;active=0;
  el('delete-order').hidden = !order;
  el('back').textContent = historyEdit ? '‹ Kazanç geçmişi' : '‹ Günün özeti';
  values=order?[order.price,order.paid,order.change].map(n=>(n/100).toFixed(2).replace('.',',')):['','',''];
  el('home').hidden=true;el('entry').hidden=false;el('message').textContent='';
  el('title').textContent=order?'Siparişi düzenle':'Yeni sipariş';render();window.scrollTo(0,0);
}
function closeEntry(){
  el('entry').hidden=true;
  el('message').textContent='';
  if (historyEdit) {
    historyEdit=false;
    if (suspendedDraft) {
      openEntry(suspendedDraft.editing);
      active=suspendedDraft.active;
      values=suspendedDraft.values;
      render();
      suspendedDraft=null;
      el('entry').hidden=true;
    }
    el('reports').hidden=!unlocked;
  }
  el('home').hidden=!el('reports').hidden;
  home();
}
el('delete-order').onclick = () => {
  if (!editing || (historyEdit && !unlocked)) return;
  const stamp=new Date(editing.time).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});
  if (!confirm(stamp+' tarihli '+money(editing.price)+' tutarındaki sipariş silinsin mi?')) return;
  try { localStorage.removeItem(prefix+editing.id); }
  catch { el('message').textContent='Sipariş silinemedi.'; return; }
  closeEntry();
};
function issue(i){
  const [price,paid,change]=values.map(cents);
  if(cents(values[i])===null)return labels[i]+' alanına bir tutar gir.';
  if(i===0&&price===0)return 'Sipariş tutarı sıfırdan büyük olmalı.';
  if(i===1&&paid<price)return 'Ödenen para sipariş tutarından az.';
  if(i===2&&change>paid-price)return 'Para üstü, ödenen para ile sipariş tutarı arasındaki farkı aşıyor.';
  return '';
}
function render(){
  [...el('fields').children].forEach((button,i)=>{
    button.classList.toggle('active',i===active);button.setAttribute('aria-pressed',String(i===active));
    button.lastChild.textContent=i===active?(values[i]||'—')+' €':(values[i]?money(cents(values[i])):'—');
  });
  const [p,a,c]=values.map(cents);
  el('tip').textContent=labels.some((_,i)=>issue(i))?'—':money(a-p-c);
  el('next').textContent=active===2?'Kaydet':'İleri ↵';
}
function keypadValue(value, k) {
  if (k === '⌫') return value.slice(0, -1);
  if (k === ',') return value.includes(',') ? value : (value || '0') + ',';
  const updated = (value === '0' ? '' : value) + k;
  return cents(updated) === null ? value : updated;
}
function key(k) {
  if (el('calculation').open) {
    hours = keypadValue(hours, k);
    renderCalculation();
    return;
  }
  el('message').textContent = '';
  values[active] = keypadValue(values[active], k);
  render();
}
function next(){
  for(let i=0;i<=active;i++){const error=issue(i);if(error){active=i;render();el('message').textContent=error;return;}}
  el('message').textContent='';
  if(active<2){active++;render();return;}
  if (editing && !localStorage.getItem(prefix+editing.id)) {
    el('message').textContent='Bu sipariş silinmiş. Geri dönüp listeyi kontrol et.';
    return;
  }
  const [price,paid,change]=values.map(cents);
  const order={id:editing?.id??crypto.randomUUID(),time:editing?.time??Date.now(),price,paid,change,tip:paid-price-change};
  try{localStorage.setItem(prefix+order.id,JSON.stringify(order));}catch{el('message').textContent='Kaydedilemedi. Cihazdaki boş alanı kontrol edip tekrar dene.';return;}
  closeEntry();
}
labels.forEach((label,i)=>{const b=document.createElement('button');b.className='field';b.append(label,document.createElement('b'));b.onclick=()=>{active=i;render();};el('fields').append(b);});
for(const k of ['1','2','3','4','5','6','7','8','9',',','0','⌫']){const b=document.createElement('button');b.textContent=k;b.setAttribute('aria-label',k==='⌫'?'Son rakamı sil':k);b.onclick=()=>key(k);const h=b.cloneNode(true);h.onclick=()=>key(k);el('hours-pad').append(h);el('pad').append(b);}
function openCalculation(date) {
  try {
    shiftDate = date;
    const day = readDays().get(date);
    hours = day?.hours ?? '';
    shiftRate = day?.rate ?? hourlyRate;
    shiftSales = day?.sales ?? 0;
    renderCalculation();
    el('calculation').showModal();
  } catch { el('message').textContent = 'Günlük kayıt okunamadı.'; }
}
el('add-day-hours').onclick = () => openCalculation(el('from').value);
el('account').onclick = () => openCalculation(localDay(Date.now()));
let noticeTimer;
el('save-shift').onclick = () => {
  const duration = cents(hours);
  if (duration === null || duration > 2400 || shiftSales === null) return;
  try {
    localStorage.setItem(shiftPrefix + shiftDate, JSON.stringify({hours, rate:shiftRate, wage:duration * shiftRate}));
  } catch { el('shift-error').textContent = 'Çalışma saati kaydedilemedi. Tekrar dene.'; return; }
  el('calculation').close();
  home();
  el('saved-notice').textContent = 'Hesap kaydedildi.';
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { el('saved-notice').textContent = ''; }, 3000);
};
el('history').onclick = () => {
  if (!historyEdit && el('reports').hidden) requestReports(localDay(Date.now()));
};
for (const id of ['from','until']) {
  el(id).onchange = () => {expandedDay='';home();};
}
for (const button of el('period-tabs').children) {
  button.onclick = () => {
    reportPeriod = button.dataset.period;
    expandedDay = '';
    home();
  };
}
el('create').onclick=()=>openEntry();el('back').onclick=closeEntry;el('next').onclick=next;
document.addEventListener('keydown',e=>{
  if(el('lock').open) return;
  if((el('entry').hidden&&!el('calculation').open)||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Enter'&&!el('calculation').open){e.preventDefault();if(!e.repeat)next();}
  else if(/^\d$/.test(e.key)||[',','.','Backspace'].includes(e.key)){e.preventDefault();key(e.key==='Backspace'?'⌫':e.key==='.'?',':e.key);}
});
home();window.addEventListener('storage',home);window.addEventListener('focus',home);setInterval(home,30000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
