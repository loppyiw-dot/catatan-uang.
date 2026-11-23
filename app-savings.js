/* =====================================================
   SAVINGS: accounts, records, analysis, CSV and PDF
   Loaded after app-events.js
   ===================================================== */

const KEY_SAV = 'putriFinance.savings';
const SAV_LABEL = { SAVE: 'Save', WITHDRAW: 'Withdraw', USE: 'Use' };
const SAV_ICON_CHOICES = ['💰', '💍', '🌸', '🛡️', '✈️', '🎓', '🏠', '🎁', '💻', '🏥', '🧾', '🐷', '👛', '🚗'];
const SAV_HINT = {
  SAVE: 'Moves money from your wallet into savings. It is not an expense.',
  WITHDRAW: 'Moves money from savings back to your wallet.',
  USE: 'Spends money from savings. It is recorded as an expense in History.'
};

let savingsData = readJSON(KEY_SAV, { accounts: [], records: [] });
let savType = 'SAVE';
let editingSav = null;

/* ---------- Load from server ---------- */
async function loadSavings() {
  try {
    const [a, r] = await Promise.all([api('getSavingAccounts'), api('getSavings')]);
    if (a.ok && r.ok) {
      savingsData = { accounts: a.data, records: r.data };
      writeJSON(KEY_SAV, savingsData);
    }
  } catch (err) {
    // Offline or older server: keep the last saved data
  }
}

/* ---------- Helpers ---------- */
const savAccounts = () => savingsData.accounts || [];
const savRecords = () => (savingsData.records || []).slice()
  .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.baris - a.baris);
const findAcc = (nama) => savAccounts().find((a) => a.nama === nama);
const savEffect = (r) => (r.tipe === 'SAVE' ? r.nominal : -r.nominal);

function monthRange(i) {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - i, 1),
    to: new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
  };
}

function savSummary(acc) {
  let total = 0, me = 0, partner = 0, last = '';
  savRecords().forEach((r) => {
    if (r.akun !== acc.nama) return;
    const e = savEffect(r);
    total += e;
    if (r.tipe !== 'USE') {
      if (r.kontributor === 'Partner') partner += e;
      else me += e;
    }
    if (!last || r.tanggal > last) last = r.tanggal;
  });
  return { total, me, partner, last };
}

function savTotals() {
  let shared = 0, personal = 0, used = 0;
  savAccounts().forEach((acc) => {
    const s = savSummary(acc);
    if (acc.bersama) shared += s.total;
    else personal += s.total;
  });
  savRecords().forEach((r) => { if (r.tipe === 'USE') used += r.nominal; });
  return { shared, personal, total: shared + personal, used };
}

// Net amount saved (Save minus Withdraw) inside a date range, optionally for one account
function savNetIn(range, acc) {
  const a = ymd(range.from), b = ymd(range.to);
  let net = 0;
  savRecords().forEach((r) => {
    if (r.tanggal < a || r.tanggal > b) return;
    if (acc && r.akun !== acc) return;
    if (r.tipe === 'SAVE') net += r.nominal;
    if (r.tipe === 'WITHDRAW') net -= r.nominal;
  });
  return net;
}

// Called from balanceOf() in app-data.js: Save lowers the wallet, Withdraw returns money to it
function savingsWalletDelta(a, acuan) {
  if (a.kelompok !== 'Dompet') return 0;
  let delta = 0;
  (savingsData.records || []).forEach((r) => {
    if (r.dompet !== a.nama || r.tanggal <= acuan) return;
    if (r.tipe === 'SAVE') delta -= r.nominal;
    if (r.tipe === 'WITHDRAW') delta += r.nominal;
  });
  return delta;
}

function savCatOptions(selected) {
  let html = '';
  setup.expense.forEach((g) => {
    if (!g.anak.length) return;
    html += `<optgroup label="${esc(g.nama)}">` + g.anak.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('') + '</optgroup>';
  });
  if (selected && !html.includes(`value="${esc(selected)}"`)) html += `<option value="${esc(selected)}">${esc(selected)}</option>`;
  return '<option value="">Choose category</option>' + html;
}

/* ---------- Render ---------- */
function renderSavings() {
  const t = savTotals();
  animateNumber($('#savTotal'), t.total);
  $('#savSplit').textContent = `👫 Shared ${rp(t.shared)} · 👤 Personal ${rp(t.personal)} · 🎉 Used ${rp(t.used)}`;

  const accs = savAccounts();
  $('#savAccounts').innerHTML = accs.length
    ? accs.map(accCardHTML).join('')
    : emptyHTML('No savings accounts yet', 'Tap "+ New account" to create one.');

  renderSavAnalysis();
  renderSavPlans();

  const rec = savRecords().slice(0, 10);
  $('#savRecent').innerHTML = rec.length
    ? rec.map(recHTML).join('')
    : emptyHTML('No records yet', 'Tap "+ Save" to add your first savings.');

  requestAnimationFrame(() => $$('#savAccounts .fill').forEach((b) => { b.style.width = b.dataset.w + '%'; }));
}

function accCardHTML(acc) {
  const s = savSummary(acc);
  const pct = acc.target > 0 ? Math.min(100, s.total / acc.target * 100) : 0;
  const split = acc.bersama
    ? `<div class="subline" style="white-space:normal">👫 Me ${rp(s.me)} · 💞 Partner ${rp(s.partner)}</div>`
    : '';
  const bar = acc.target > 0
    ? `<div class="track"><div class="fill" data-w="${pct.toFixed(1)}" style="background:var(--grad)"></div></div>
       <div class="bar-line">${Math.round(pct)}% of ${rp(acc.target)}${acc.deadline ? ' · by ' + fmtShort(fromYmd(acc.deadline)) : ''}</div>`
    : '';
  return `<div class="goal">
    <div class="bar-top"><span>${esc(acc.ikon)} ${esc(acc.nama)}</span><span>${rp(s.total)}</span></div>
    ${split}
    ${bar}
    <div class="subline" style="white-space:normal;margin-top:6px">${acc.bersama ? 'Shared' : 'Personal'} · last update ${s.last ? fmtShort(fromYmd(s.last)) : '–'}</div>
    <div class="row-btns">
      <button class="btn sm" data-sav-quick="SAVE" data-sav-acc="${esc(acc.nama)}">+ Save</button>
      <button class="btn sm ghost" data-sav-quick="WITHDRAW" data-sav-acc="${esc(acc.nama)}">Withdraw</button>
    </div>
  </div>`;
}

function recHTML(r) {
  const inc = r.tipe === 'SAVE';
  const icon = r.tipe === 'SAVE' ? '💰' : r.tipe === 'WITHDRAW' ? '↩️' : '🎉';
  const who = r.kontributor && r.kontributor !== 'Me' ? ' · ' + r.kontributor : '';
  const note = r.catatan ? ' · ' + r.catatan : '';
  return `<div class="acct" data-sav-rec="${esc(r.id)}">
    <div class="ico-circle ${inc ? 'in' : 'out'}">${icon}</div>
    <div class="grow">
      <div class="name">${esc(r.akun)} <span class="badge">${esc(SAV_LABEL[r.tipe])}</span></div>
      <div class="subline">${esc(fmtShort(fromYmd(r.tanggal)))}${esc(who)}${esc(note)}</div>
    </div>
    <div class="amount ${inc ? 'in' : 'out'}">${inc ? '+' : '−'} ${rp(r.nominal)}</div>
  </div>`;
}

function renderSavAnalysis() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const m0 = monthRange(0);
  const income = calc(allTx().filter((t) => inRange(t, { from: m0.from, to: today }))).inc;
  const saved = savNetIn(m0);
  const rate = income > 0 ? Math.round(saved / income * 100) : null;
  const avg = [1, 2, 3].map((i) => savNetIn(monthRange(i))).reduce((a, b) => a + b, 0) / 3;

  const rows = [
    ['📅', 'Saved this month', rp(saved)],
    ['📈', 'Average saved per month (last 3 months)', rp(avg)],
    ['💖', "Share of this month's income saved", rate === null ? 'No income yet this month' : rate + '%']
  ];

  savAccounts().filter((a) => a.target > 0).forEach((a) => {
    const s = savSummary(a);
    const remain = a.target - s.total;
    let eta;
    if (remain <= 0) {
      eta = '🎉 Target reached!';
    } else {
      const per = [1, 2, 3].map((i) => savNetIn(monthRange(i), a.nama)).reduce((x, y) => x + y, 0) / 3;
      if (per > 0) {
        const n = Math.ceil(remain / per);
        eta = `About ${n} month${n > 1 ? 's' : ''} left at ${rp(per)}/month`;
      } else {
        eta = 'No monthly savings yet, so no estimate';
      }
    }
    rows.push([a.ikon, `${a.nama} · ${rp(Math.max(0, remain))} to go`, eta]);
  });

  $('#savAnalysis').innerHTML = rows.map(([ik, k, v]) => `<div class="insight">
    <div class="ico-box" style="background:#f5efff">${esc(ik)}</div>
    <div><small>${esc(k)}</small><b>${esc(v)}</b></div>
  </div>`).join('');

  drawSavChart();
}

function drawSavChart() {
  const labels = [], vals = [];
  for (let i = 11; i >= 0; i--) {
    const r = monthRange(i);
    const end = ymd(r.to);
    let bal = 0;
    savRecords().forEach((x) => { if (x.tanggal <= end) bal += savEffect(x); });
    labels.push(r.from.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
    vals.push(bal);
  }
  drawChart('chartSavings', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total saved', data: vals, borderColor: '#f06fa0',
        backgroundColor: 'rgba(240,111,160,.18)', fill: true, tension: .4,
        pointRadius: 3, pointBackgroundColor: '#f06fa0'
      }]
    },
    options: baseOpts()
  });
}

/* ---------- Savings record sheet ---------- */
function openSavSheet(type, rec, acc) {
  if (!savAccounts().length) return toast('Create a savings account first', 'bad');
  editingSav = rec || null;
  savType = rec ? rec.tipe : (type || 'SAVE');

  $('#savTitle').textContent = rec ? '✏️ Edit record'
    : savType === 'SAVE' ? '💰 Save to savings'
    : savType === 'WITHDRAW' ? '↩️ Withdraw from savings'
    : '🎉 Use savings';

  $('#savAccount').innerHTML = savAccounts()
    .map((a) => `<option value="${esc(a.nama)}">${esc(a.ikon)} ${esc(a.nama)}</option>`).join('');
  $('#savAccount').value = rec ? rec.akun : (acc || savAccounts()[0].nama);
  $('#savAmount').value = rec ? Number(rec.nominal).toLocaleString('id-ID') : '';
  $('#savDate').value = rec ? rec.tanggal : ymd(new Date());
  $('#savNote').value = rec ? (rec.catatan || '') : '';
  fillWallets('#savWallet', rec ? rec.dompet : localStorage.getItem(KEY_LAST_WALLET), 'Choose wallet');
  $('#savCategory').innerHTML = savCatOptions(rec ? rec.kategori : '');
  $('#savCategory').value = rec ? (rec.kategori || '') : '';
  $('#savDelete').classList.toggle('hidden', !rec);

  refreshSavFields(rec ? rec.kontributor : 'Me');
  openSheet('#savSheet');
}

function refreshSavFields(contrib) {
  const acc = findAcc($('#savAccount').value);
  const shared = !!(acc && acc.bersama);
  $('#savContribRow').classList.toggle('hidden', !shared);
  $('#savContrib').value = shared && contrib === 'Partner' ? 'Partner' : 'Me';

  const isUse = savType === 'USE';
  $('#savWalletRow').classList.toggle('hidden', isUse);
  $('#savCategoryRow').classList.toggle('hidden', !isUse);
  if (isUse) {
    const keep = $('#savCategory').value;
    $('#savCategory').innerHTML = savCatOptions(keep);
    $('#savCategory').value = keep;
  }

  $$('#savSeg [data-sav-type]').forEach((b) => b.classList.toggle('active', b.dataset.savType === savType));
  $('#savHint').textContent = SAV_HINT[savType];
}

async function saveSav(e) {
  e.preventDefault();
  const d = {
    tipe: savType,
    tanggal: $('#savDate').value,
    akun: $('#savAccount').value,
    kontributor: $('#savContrib').value,
    nominal: parseRupiah($('#savAmount').value),
    dompet: $('#savWallet').value,
    kategori: $('#savCategory').value,
    catatan: $('#savNote').value.trim()
  };
  if (!d.tanggal) return toast('Pick a date first', 'bad');
  if (!d.akun) return toast('Choose an account first', 'bad');
  if (!(d.nominal > 0)) return toast('Amount must be more than 0', 'bad');
  if (d.tipe === 'USE' && !d.kategori) return toast('Choose a category first', 'bad');
  if (d.tipe !== 'USE' && !d.dompet) return toast('Choose a wallet first', 'bad');

  const btn = $('#savSave');
  btn.disabled = true;
  btn.textContent = 'Saving… 🌷';
  let ok = false;
  try {
    if (editingSav) {
      ok = await sendWrite('ubahSaving', { id: editingSav.id, data: d }, 'Record updated 🎀');
    } else {
      d.id = newId();
      ok = await sendWrite('tambahSaving', { data: d }, 'Saved to savings 💖');
      if (ok && d.dompet) localStorage.setItem(KEY_LAST_WALLET, d.dompet);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save 💖';
  }
  if (ok) { closeSheets(); await loadAll(); }
}

async function deleteSav() {
  if (!editingSav) return;
  const yes = await ask('Delete this record?', `${rp(editingSav.nominal)} · ${editingSav.akun}. This cannot be undone.`, 'Delete');
  if (!yes) return;
  const ok = await sendWrite('hapusSaving', { id: editingSav.id }, 'Record deleted 🫧');
  if (ok) { closeSheets(); await loadAll(); }
}

/* ---------- New account sheet ---------- */
function setAccShared(v) {
  $('#accShared').value = v;
  $$('#accSeg [data-shared]').forEach((b) => b.classList.toggle('active', b.dataset.shared === v));
}

function openAccSheet() {
  $('#accName').value = '';
  $('#accTarget').value = '';
  $('#accDeadline').value = '';
  $('#accIcon').innerHTML = SAV_ICON_CHOICES.map((i) => `<option value="${i}">${i}</option>`).join('');
  $('#accIcon').value = '💰';
  setAccShared('NO');
  openSheet('#accSheet');
}

async function saveAcc(e) {
  e.preventDefault();
  const d = {
    nama: $('#accName').value.trim(),
    ikon: $('#accIcon').value,
    bersama: $('#accShared').value === 'YES',
    target: parseRupiah($('#accTarget').value),
    deadline: $('#accDeadline').value
  };
  if (!d.nama) return toast('Give the account a name', 'bad');
  if (savAccounts().some((a) => a.nama.toLowerCase() === d.nama.toLowerCase())) {
    return toast('That account already exists', 'bad');
  }
  const ok = await sendWrite('tambahSavingAccount', { data: d }, 'Account created ✨');
  if (ok) { closeSheets(); await loadAll(); }
}

/* ---------- CSV and PDF ---------- */
function savCsv() {
  const list = savRecords();
  if (!list.length) return toast('Nothing to export yet', 'bad');
  const head = ['Date', 'Type', 'Account', 'Contributor', 'Amount', 'Wallet', 'Category', 'Note'];
  const rows = list.map((r) => [r.tanggal, SAV_LABEL[r.tipe], r.akun, r.kontributor, r.nominal, r.dompet, r.kategori, r.catatan]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'putri-savings-' + ymd(new Date()) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function savPdf() {
  const list = savRecords();
  if (!list.length) return toast('Nothing to export yet', 'bad');
  const t = savTotals();
  const accRows = savAccounts().map((a) => {
    const s = savSummary(a);
    return `<tr><td>${esc(a.nama)}</td><td>${a.bersama ? 'Shared' : 'Personal'}</td>
      <td style="text-align:right">${rp(s.total)}</td>
      <td style="text-align:right">${a.bersama ? rp(s.me) : '–'}</td>
      <td style="text-align:right">${a.bersama ? rp(s.partner) : '–'}</td></tr>`;
  }).join('');
  const recRows = list.map((r) => `<tr><td>${esc(r.tanggal)}</td><td>${esc(SAV_LABEL[r.tipe])}</td>
    <td>${esc(r.akun)}</td><td>${esc(r.kontributor)}</td><td>${esc(r.dompet || r.kategori)}</td>
    <td>${esc(r.catatan)}</td><td style="text-align:right">${rp(r.nominal)}</td></tr>`).join('');

  $('#printArea').innerHTML = `<h2>Putri Finance · Savings</h2>
    <p>Total saved ${rp(t.total)} · Shared ${rp(t.shared)} · Personal ${rp(t.personal)} · Used ${rp(t.used)}</p>
    <h3>Balances</h3>
    <table><thead><tr><th>Account</th><th>Type</th><th>Balance</th><th>Me</th><th>Partner</th></tr></thead>
    <tbody>${accRows}</tbody></table>
    <h3>Records</h3>
    <table><thead><tr><th>Date</th><th>Type</th><th>Account</th><th>Contributor</th><th>Wallet / Category</th><th>Note</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${recRows}</tbody></table>`;
  window.print();
}

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const quick = e.target.closest('[data-sav-quick]');
  if (quick) { openSavSheet(quick.dataset.savQuick, null, quick.dataset.savAcc); return; }

  const rec = e.target.closest('[data-sav-rec]');
  if (rec) {
    const r = savRecords().find((x) => x.id === rec.dataset.savRec);
    if (r) openSavSheet(r.tipe, r, r.akun);
    return;
  }

  const act = e.target.closest('[data-sav-action]');
  if (act) {
    if (act.dataset.savAction === 'NEWACC') openAccSheet();
    else openSavSheet(act.dataset.savAction, null, '');
    return;
  }

  const seg = e.target.closest('[data-sav-type]');
  if (seg && seg.closest('#savSeg')) {
    savType = seg.dataset.savType;
    refreshSavFields($('#savContrib').value);
    return;
  }

  const shared = e.target.closest('[data-shared]');
  if (shared && shared.closest('#accSeg')) setAccShared(shared.dataset.shared);
});

$('#savSheet').addEventListener('submit', saveSav);
$('#savDelete').addEventListener('click', deleteSav);
$('#savClose').addEventListener('click', closeSheets);
$('#savAccount').addEventListener('change', () => refreshSavFields($('#savContrib').value));
$('#savAmount').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
$('#accSheet').addEventListener('submit', saveAcc);
$('#accClose').addEventListener('click', closeSheets);
$('#btnSavCsv').addEventListener('click', savCsv);
$('#btnSavPdf').addEventListener('click', savPdf);

/* ===================== MONTHLY SAVINGS PLANS =====================
   Stored on this phone (like Bills). "Save now" writes a Save
   record to the Savings tab, so the balance and history update. */
const KEY_SAV_PLANS = 'putriFinance.savPlans';
let savPlans = readJSON(KEY_SAV_PLANS, []);
let editingSavPlan = null;

function savPlansWrite(list) {
  savPlans = list;
  writeJSON(KEY_SAV_PLANS, list);
}

function savPlanStatus(p) {
  const now = new Date();
  const paid = p.paidMonth === ymd(now).slice(0, 7);
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const due = new Date(now.getFullYear(), now.getMonth(), Math.min(p.day, dim));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - today) / 86400000);
  return { paid, due, days, overdue: !paid && days < 0 };
}

function renderSavPlans() {
  const wrap = $('#savPlanList');
  if (!wrap) return;
  if (!savPlans.length) {
    wrap.innerHTML = emptyHTML('No monthly plans yet', 'Add one for each account you save into every month.');
    return;
  }
  wrap.innerHTML = savPlans.map((p) => {
    const s = savPlanStatus(p);
    let st;
    if (s.paid) st = '✅ Saved this month';
    else if (s.overdue) st = `🚨 Overdue by ${-s.days} day${-s.days > 1 ? 's' : ''}`;
    else if (s.days === 0) st = '🔔 Due today';
    else st = `📅 Due ${fmtShort(s.due)}`;
    const acc = findAcc(p.akun);
    const btn = s.paid ? '' : `<button class="btn sm" data-plan-save="${esc(p.id)}">✨ Save now</button>`;
    return `<div class="bill">
      <div class="bar-top"><span>${acc ? esc(acc.ikon) : '💰'} ${esc(p.akun)}</span><span>${rp(p.amount)}</span></div>
      <div class="subline" style="white-space:normal;margin-top:6px">${esc(st)} · ${esc(p.kontributor)} · from ${esc(p.dompet)}</div>
      <div class="row-btns">${btn}<button class="btn sm ghost" data-plan-edit="${esc(p.id)}">Edit</button></div>
    </div>`;
  }).join('');
}

function openPlanSheet(p) {
  if (!savAccounts().length) return toast('Create a savings account first', 'bad');
  editingSavPlan = p || null;
  $('#planTitle').textContent = p ? '✏️ Edit monthly plan' : '🔁 New monthly plan';
  $('#planAccount').innerHTML = savAccounts()
    .map((a) => `<option value="${esc(a.nama)}">${esc(a.ikon)} ${esc(a.nama)}</option>`).join('');
  $('#planAccount').value = p ? p.akun : savAccounts()[0].nama;
  $('#planContrib').value = p && p.kontributor === 'Partner' ? 'Partner' : 'Me';
  $('#planAmount').value = p ? Number(p.amount).toLocaleString('id-ID') : '';
  $('#planDay').innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $('#planDay').value = p ? p.day : new Date().getDate();
  fillWallets('#planWallet', p ? p.dompet : localStorage.getItem(KEY_LAST_WALLET), 'Choose wallet');
  $('#planDelete').classList.toggle('hidden', !p);
  openSheet('#planSheet');
}

function savePlan(e) {
  e.preventDefault();
  const d = {
    akun: $('#planAccount').value,
    kontributor: $('#planContrib').value,
    amount: parseRupiah($('#planAmount').value),
    day: Number($('#planDay').value),
    dompet: $('#planWallet').value
  };
  if (!d.akun) return toast('Choose an account first', 'bad');
  if (!(d.amount > 0)) return toast('Amount must be more than 0', 'bad');
  if (!d.dompet) return toast('Choose a wallet first', 'bad');
  const acc = findAcc(d.akun);
  if (acc && !acc.bersama) d.kontributor = 'Me';

  const list = savPlans.slice();
  if (editingSavPlan) {
    const p = list.find((x) => x.id === editingSavPlan.id);
    if (p) Object.assign(p, d);
  } else {
    list.push({ id: newId(), ...d, paidMonth: '' });
  }
  savPlansWrite(list);
  closeSheets();
  renderSavings();
  toast('Monthly plan saved 🔁');
}

function deleteSavPlan() {
  if (!editingSavPlan) return;
  savPlansWrite(savPlans.filter((x) => x.id !== editingSavPlan.id));
  closeSheets();
  renderSavings();
  toast('Plan deleted 🫧');
}

async function savePlanNow(id) {
  const p = savPlans.find((x) => x.id === id);
  if (!p) return;
  const today = ymd(new Date());
  const data = {
    tipe: 'SAVE', tanggal: today, akun: p.akun, kontributor: p.kontributor,
    nominal: p.amount, dompet: p.dompet, kategori: '', catatan: 'Monthly plan', id: newId()
  };
  const ok = await sendWrite('tambahSaving', { data }, `${p.akun} saved 💖`);
  if (!ok) return;
  p.paidMonth = today.slice(0, 7);
  savPlansWrite(savPlans);
  confetti();
  await loadAll();
}

document.addEventListener('click', (e) => {
  const sv = e.target.closest('[data-plan-save]');
  if (sv) { savePlanNow(sv.dataset.planSave); return; }
  const ed = e.target.closest('[data-plan-edit]');
  if (ed) { openPlanSheet(savPlans.find((x) => x.id === ed.dataset.planEdit)); return; }
  if (e.target.closest('#btnNewPlan')) openPlanSheet(null);
});

$('#planSheet').addEventListener('submit', savePlan);
$('#planDelete').addEventListener('click', deleteSavPlan);
$('#planClose').addEventListener('click', closeSheets);
$('#planAmount').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
