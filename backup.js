'use strict';
const backupFormat = 'siparis-defteri';
let selectedBackup = null;
function collectBackup() {
  const orders = [], shifts = [];
  for (const day of readDays().values()) {
    orders.push(...day.orders);
    if (day.hours !== null) shifts.push({date:day.date, hours:day.hours, rate:day.rate, wage:day.wage});
  }
  return {format:backupFormat, version:1, created:new Date().toISOString(), orders, shifts};
}
function validateBackup(data) {
  const invalid = () => {throw new Error('Dosya geçerli bir Sipariş Defteri yedeği değil.');};
  if (data?.format !== backupFormat || data.version !== 1 || !Array.isArray(data.orders) || !Array.isArray(data.shifts)) invalid();
  const entries = new Map();
  function add(key, record) {
    if (entries.has(key)) invalid();
    entries.set(key, JSON.stringify(record));
  }
  for (const o of data.orders) {
    if (!o || typeof o.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(o.id) ||
        !Number.isSafeInteger(o.time) || !Number.isFinite(new Date(o.time).getTime()) ||
        ![o.price,o.paid,o.change,o.tip].every(n=>Number.isSafeInteger(n) && n>=0 && n<=9999999999) ||
        o.price===0 || o.tip !== o.paid-o.price-o.change) invalid();
    const {id,time,price,paid,change,tip} = o;
    add(prefix+id,{id,time,price,paid,change,tip});
  }
  for (const s of data.shifts) {
    if (!s || typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) ||
        localDay(new Date(s.date+'T12:00:00')) !== s.date || typeof s.hours !== 'string') invalid();
    const duration = cents(s.hours);
    if (duration === null || duration>2400 || !Number.isSafeInteger(s.rate) || s.rate<=0 ||
        !Number.isSafeInteger(s.wage) || s.wage!==duration*s.rate) invalid();
    add(shiftPrefix+s.date,{hours:s.hours,rate:s.rate,wage:s.wage});
  }
  return entries;
}
function mergeBackup(entries) {
  const inserted = [];
  try {
    for (const [key,value] of entries) {
      if (localStorage.getItem(key)!==null) continue;
      localStorage.setItem(key,value);
      inserted.push([key,value]);
    }
  } catch (error) {
    for (const [key,value] of inserted) if(localStorage.getItem(key)===value) localStorage.removeItem(key);
    throw error;
  }
  return inserted.length;
}
el('export-backup').onclick = () => {
  if (!unlocked) return;
  try {
    const data=collectBackup();
    const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
    const link=document.createElement('a');
    link.href=url; link.download='siparis-defteri-'+localDay(Date.now())+'.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch {el('backup-status').textContent='Yedek hazırlanamadı.';}
};
el('import-backup').onclick = () => {if(unlocked) el('backup-file').click();};
async function previewBackup() {
  if (!unlocked || !selectedBackup) return;
  const file=selectedBackup;
  selectedBackup=null;
  try {
    const data=JSON.parse(await file.text());
    const entries=validateBackup(data);
    if (!unlocked) {selectedBackup=file;return;}
    const missing=[...entries.keys()].filter(key=>localStorage.getItem(key)===null).length;
    const status=el('backup-status');
    if (!missing) {status.textContent='Bu yedekte eklenecek yeni kayıt yok.';return;}
    if (!confirm(data.orders.length+' sipariş ve '+data.shifts.length+' günlük çalışma kaydı içeren yedekten '+missing+' eksik kayıt eklensin mi? Cihazdaki mevcut kayıtlar korunacak.')) return;
    if (!unlocked) return;
    const added=mergeBackup(entries);
    home();status.textContent=added+' kayıt geri yüklendi.';
  } catch {el('backup-status').textContent='Geri yükleme tamamlanamadı. Yedek dosyasını ve cihazdaki boş alanı kontrol et.';}
}
el('backup-file').onchange = () => {
  selectedBackup=el('backup-file').files[0];
  el('backup-file').value='';
  if (!selectedBackup) return;
  if (unlocked) previewBackup();
  else requestReports(localDay(Date.now()));
};
