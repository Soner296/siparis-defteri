const lockKey = 'siparis-defteri:report-lock';
let unlocked = false;
let requestedDay;
function requestReports(date) {
  if (unlocked) return openReports(date);
  requestedDay = date;
  const record = JSON.parse(localStorage.getItem(lockKey));
  const migrate = record !== null && record.kind !== 'pin4';
  const setup = !record || migrate;
  el('old-label').hidden = !migrate;
  el('old-password').required = migrate;
  el('lock-form').reset();
  el('lock-title').textContent = migrate ? 'Mevcut şifrenle PIN’e geç' : setup ? '4 haneli PIN oluştur' : 'Kazanç geçmişine giriş';
  el('password').autocomplete = setup ? 'new-password' : 'current-password';
  el('repeat-label').hidden = !setup;
  el('lock-error').textContent = '';
  el('lock').showModal();
}
async function verifier(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:new Uint8Array(salt), iterations:600000, hash:'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bits)).join('.');
}
el('lock-cancel').onclick = () => el('lock').close();
el('lock').onclose = () => el('lock-form').reset();
el('lock-form').onsubmit = async event => {
  event.preventDefault();
  const password = el('password').value;
  const submit = el('unlock');
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    const existing = localStorage.getItem(lockKey);
    const record = JSON.parse(existing);
    const setup = record?.kind !== 'pin4';
    if (!/^[0-9]{4}$/.test(password) || (setup && password !== el('repeat-password').value)) {
      el('lock-error').textContent = setup ? 'Aynı 4 rakamı iki alana da gir.' : '4 rakam gir.';
      return;
    }
    if (record) {
      const secret = setup ? el('old-password').value : password;
      if (await verifier(secret, record.salt) !== record.hash) {
        el('lock-error').textContent = setup ? 'Mevcut şifre hatalı.' : 'PIN hatalı.';
        return;
      }
    }
    let replacement;
    if (setup) {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      replacement = {kind:'pin4', salt, hash:await verifier(password, salt)};
    }
    if (!el('lock').open || document.hidden) return;
    if (localStorage.getItem(lockKey) !== existing) {
      el('lock-error').textContent = 'Giriş bilgileri değişti. Pencereyi kapatıp yeniden aç.';
      return;
    }
    if (setup) localStorage.setItem(lockKey, JSON.stringify(replacement));
    unlocked = true;
    el('lock').close();
    openReports(requestedDay);
    if (selectedBackup) previewBackup();
  } catch {
    el('lock-error').textContent = 'Şifre doğrulanamadı. Tekrar dene.';
  } finally {submit.disabled = false;}
};
function lockReports() {
  if (!unlocked) return;
  if (historyEdit) closeEntry();
  unlocked = false;
  el('backup-status').textContent='';
  if (el('calculation').open) el('calculation').close();
  el('reports').hidden = true;
  el('report-days').replaceChildren();
  if (returnToEntry) {
    el('entry').hidden = false;
    returnToEntry = false;
  } else {
    closeEntry();
  }
}
document.addEventListener('visibilitychange',()=>{if(document.hidden) lockReports();});
window.addEventListener('pagehide',lockReports);
el('report-back').onclick = lockReports;
