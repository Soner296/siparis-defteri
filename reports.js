const shiftPrefix = 'siparis-defteri:hours:';
const hourlyRate = 9;
function localDay(time) {
  const date = new Date(time);
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function readDays() {
  const days = new Map();
  function ensure(date) {
    if (!days.has(date)) days.set(date, {date, orders:[], sales:0, tips:0, wage:0, hours:null});
    return days.get(date);
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) {
      const order = JSON.parse(localStorage.getItem(key));
      const day = ensure(localDay(order.time));
      day.orders.push(order);
      day.sales += order.price;
      day.tips += order.tip;
    } else if (key.startsWith(shiftPrefix)) {
      const shift = JSON.parse(localStorage.getItem(key));
      const day = ensure(key.slice(shiftPrefix.length));
      day.hours = shift.hours == null ? null : String(shift.hours).replace('.', ',');
      day.rate = shift.rate ?? 8; // Older saved shifts used 8 € per hour.
      day.wage = shift.wage;
    }
  }
  ensure(localDay(Date.now()));
  return days;
}
function sumDays(days) {
  const sums = {sales:0, tips:0, wage:0, count:0, workedDays:0, hourHundredths:0};
  for (const day of days) {
    const duration = cents(day.hours);
    if (day.orders.length || duration > 0) sums.workedDays += 1;
    sums.hourHundredths += duration ?? 0;
    sums.sales += day.sales;
    sums.tips += day.tips;
    sums.wage += day.wage;
    sums.count += day.orders.length;
  }
  return sums;
}
let reportPeriod = 'day';
let returnToEntry = false;

let expandedDay = '';

function periodTitle(key) {
  const parts = key.split('-').map(Number);
  if (parts.length === 1) return key;
  const options = {month:'long', year:'numeric'};
  if (parts.length === 3) options.day = 'numeric';
  return new Date(parts[0], parts[1]-1, parts[2] || 1).toLocaleDateString('tr-TR', options);
}
function openReports(date) {
  if (!unlocked) return;
  el('from').value = date;
  el('until').value = date;
  expandedDay = '';
  reportPeriod = 'day';
  returnToEntry = !el('entry').hidden;
  el('entry').hidden = true;
  el('home').hidden = true;
  el('reports').hidden = false;
  home();
  window.scrollTo(0,0);
}
function dayRow(day) {
  const wrap = document.createElement('div');
  const button = document.createElement('button');
  button.className = 'row report-date';
  const title = document.createElement('b');
  title.textContent = periodTitle(day.date);
  const earned = document.createElement('small');
  earned.textContent = 'Toplam kazanç  ' + money(day.wage + day.tips);
  const timeSummary = document.createElement('small');
  timeSummary.textContent = day.hours === null ? 'Çalışma saati girilmedi' : day.hours + ' saat';
  title.append(earned, timeSummary);
  const open = expandedDay === day.date;
  button.setAttribute('aria-expanded', String(open));
  button.append(title, open ? '−' : '+');
  button.onclick = () => {expandedDay = open ? '' : day.date; home();};
  wrap.append(button);
  if (open) {
    const details = document.createElement('div');
    details.className = 'day-details';
    const hoursButton = document.createElement('button');
    hoursButton.className = 'secondary';
    hoursButton.textContent = day.hours === null ? 'Çalışma saati gir' : 'Çalışma saati: ' + day.hours + ' · Düzenle';
    hoursButton.onclick = () => openCalculation(day.date);
    details.append(hoursButton);
    const heading = document.createElement('h3');
    heading.textContent = day.orders.length ? 'Siparişler (' + day.orders.length + ')' : 'Bu gün için sipariş yok.';
    details.append(heading);
    for (const order of [...day.orders].sort((a,b)=>b.time-a.time)) {
      const line = document.createElement('p');
      const time = new Date(order.time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      line.textContent = time + ' · ' + money(order.price) + ' · Bahşiş ' + money(order.tip);
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Düzenle veya sil';
      edit.onclick = () => {
        historyEdit = true;
        if (returnToEntry) suspendedDraft = {editing, active, values:[...values]};
        el('reports').hidden = true;
        openEntry(order);
      };
      line.append(edit);
      details.append(line);
    }
    wrap.append(details);
  }
  return wrap;
}
function dateBounds(period, from, until) {
  if (!from) return null;
  if (period === 'custom') return until && until >= from ? [from,until] : null;
  const [year,month,day] = from.split('-').map(Number);
  if (period === 'year') return [year+'-01-01',year+'-12-31'];
  if (period === 'month') return [from.slice(0,7)+'-01',localDay(new Date(year,month,0))];
  if (period === 'week') {
    const weekday = new Date(year,month-1,day).getDay();
    const monday = day - (weekday+6)%7;
    return [localDay(new Date(year,month-1,monday)),localDay(new Date(year,month-1,monday+6))];
  }
  return [from,from];
}
function renderReport(days) {
  const from = el('from').value;
  const until = el('until').value;
  const custom = reportPeriod === 'custom';
  el('end-label').hidden = !custom;
  el('from-label').textContent = custom ? 'Başlangıç' : 'Tarih';
  for (const button of el('period-tabs').children) button.setAttribute('aria-pressed',String(button.dataset.period === reportPeriod));
  const bounds = dateBounds(reportPeriod, from, until);
  el('range-label').textContent = bounds ? bounds.map(periodTitle).filter((v,i,a)=>i===0 || v!==a[0]).join(' – ') : 'Geçerli bir tarih aralığı seç.';
  const rows = [...days.values()].filter(day=>bounds && day.date >= bounds[0] && day.date <= bounds[1]).sort((a,b)=>b.date.localeCompare(a.date));
  const sums = sumDays(rows);
  el('earned').textContent = money(sums.wage+sums.tips);
  el('report-wage').textContent = money(sums.wage);
  el('report-tips').textContent = money(sums.tips);
  el('report-sales').textContent = money(sums.sales);
  el('report-count').textContent = sums.count;
  el('worked-days').textContent = sums.workedDays;
  el('worked-hours').textContent = (sums.hourHundredths / 100).toLocaleString('tr-TR');
  const incomplete = rows.filter(day => day.orders.length && day.hours === null).length;
  el('missing-hours').hidden = incomplete === 0;
  el('missing-hours').textContent = incomplete + ' günün çalışma saati eksik. Eklemek için tarihe dokun.';
  el('add-day-hours').hidden = reportPeriod !== 'day' || !from || from > localDay(Date.now()) || rows.length > 0;
  el('report-days').replaceChildren(...rows.map(dayRow));
}
