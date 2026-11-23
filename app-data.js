/* ===================== SETTINGS ===================== */
const LOCK_MS = 5 * 60 * 1000;
const COLORS = ['#f9a8d4','#c4b5fd','#99f6e4','#fde68a','#fdba74','#93c5fd','#bef264','#f0abfc','#a5f3fc','#fca5a5','#d8b4fe','#86efac'];
const ICONS = { 'BCA':'🏦','Bank Jago':'🏦','BRK Syariah':'🏦','BNI':'🏦','Cash':'💵','OVO':'💜','GoPay':'💚','ShopeePay':'🧡','BCA Sekuritas':'💼','BNI Sekuritas':'💼','Stockbit':'📈','Ajaib':'📈','Kas RDN':'💎' };
const GOAL_EMOJI = ['🌸','🏠','🚗','✈️','💍','🎓','💻','👜','🐶','🎁','🛡️','💖'];
const KEY_CFG = 'catatanUang.cfg';
const KEY_QUEUE = 'catatanUang.antrean';
const KEY_CACHE = 'catatanUang.cache';
const KEY_LAST_WALLET = 'catatanUang.dompetTerakhir';
const KEY_BUDGET = 'putriFinance.budget';
const KEY_GOALS = 'putriFinance.goals';
const KEY_BILLS = 'putriFinance.bills';
const CARRY = 'Balance Carried Forward';
const WEEKDAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEKDAY_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEK_ORDER = [1,2,3,4,5,6,0];
const PERIOD_LABEL = { today: 'Today', week: 'This week', month: 'This month', custom: 'Custom range' };
const SHEET_IDS = ['#txSheet','#balSheet','#goalSheet','#fundSheet','#billSheet','#savSheet','#accSheet','#planSheet'];
const SERVER_MSG = {
  'Kunci tidak valid': 'Invalid key',
  'Data sudah berubah. Muat ulang daftar lalu coba lagi.': 'Data changed. Reload and try again.',
  'Sudah tersimpan': 'Already saved',
  'Tersimpan': 'Saved',
  'Perubahan tersimpan': 'Changes saved',
  'Transaksi dihapus': 'Entry deleted',
  'Saldo tersimpan': 'Balance saved',
  'Transaksi trading diatur dari Log Transaksi.': 'Trading entries are managed in the Log sheet.',
  'Aksi tidak dikenal': 'Action not recognized'
};

/* ===================== STATE ===================== */
let cfg = JSON.parse(localStorage.getItem(KEY_CFG) || 'null');
let setup = { income: [], expense: [], dompet: [], akun: [] };
let txs = [];
let wallets = [];
let trades = [];
let tradingDetail = null;
let tradingError = '';
let busyTrading = false;
let period = 'month';
let mode = 'daily';
let moneyTab = 'wallets';
let loggedIn = false;
let pinInput = '';
let lastActive = Date.now();
let editing = null;
let editingGoal = null;
let fundGoalId = null;
let editingBill = null;
let txType = 'EXPENSE';
let charts = {};
let donutList = [];
let syncing = false;
let statusBase = 'Loading…';
let toastTimer = null;

/* ===================== HELPERS ===================== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const compact = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDate = (s) => fromYmd(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtRange = (r) => r.from.getTime() === r.to.getTime() ? fmtShort(r.from) : `${fmtShort(r.from)} – ${fmtShort(r.to)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isCarry = (t) => String(t.kategori || '').includes(CARRY);
const pisahIkon = (kat) => {
  const m = String(kat).match(/^(\p{Extended_Pictographic}\uFE0F?)\s*/u);
  return m ? { ikon: m[1], nama: kat.slice(m[0].length) } : { ikon: '🏷️', nama: kat };
};
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const randomHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const isOffline = (err) => err instanceof TypeError;
const tr = (msg) => SERVER_MSG[msg] || msg;
const errText = (err) => err instanceof SyntaxError
  ? 'The server is not responding. Make sure the Web App is deployed with access set to Anyone.'
  : tr(err.message || 'Something went wrong');
const parseRupiah = (s) => Number(String(s).replace(/\D/g, '')) || 0;
const fmtInput = (v) => { const a = String(v).replace(/\D/g, ''); return a ? Number(a).toLocaleString('id-ID') : ''; };
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const emptyHTML = (title, text) => `<div class="empty"><div class="ico">🫧</div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
const parseTags = (s) => (String(s || '').match(/#[\p{L}\p{N}_]+/gu) || []).map((x) => x.toLowerCase());

function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

function confetti() {
  const emo = ['💖', '✨', '🌷', '🎀', '💜', '🌸'];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = emo[i % emo.length];
    s.style.setProperty('--x', (Math.random() * 240 - 120) + 'px');
    s.style.setProperty('--r', (Math.random() * 120 - 60) + 'deg');
    s.style.animationDelay = (Math.random() * 0.2) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1700);
  }
}

function animateNumber(el, target) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = target;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 700);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = rp(from + (target - from) * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setStatus(base) {
  if (base) statusBase = base;
  const n = queueRead().length;
  $('#status').textContent = statusBase + (n ? ` · ${n} waiting to send` : '');
}

function setProgress(on) {
  const p = $('#progress');
  if (on) {
    p.style.transition = 'none';
    p.style.width = '0';
    requestAnimationFrame(() => { p.style.transition = 'width 3s ease-out'; p.style.width = '80%'; });
  } else {
    p.style.transition = 'width .2s ease';
    p.style.width = '100%';
    setTimeout(() => { p.style.transition = 'none'; p.style.width = '0'; }, 300);
  }
}

function ask(title, text, yesLabel = 'Yes') {
  return new Promise((resolve) => {
    $('#modalTitle').textContent = title;
    $('#modalText').textContent = text;
    $('#modalYes').textContent = yesLabel;
    $('#modal').classList.remove('hidden');
    const close = (ok) => {
      $('#modal').classList.add('hidden');
      $('#modalYes').onclick = null;
      $('#modalNo').onclick = null;
      resolve(ok);
    };
    $('#modalYes').onclick = () => close(true);
    $('#modalNo').onclick = () => close(false);
  });
}

/* ===================== SERVER ===================== */
async function apiWith(c, aksi, isi = {}) {
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ kunci: c.kunci, aksi, ...isi })
  });
  return res.json();
}
const api = (aksi, isi) => apiWith(cfg, aksi, isi);

/* ===================== OFFLINE QUEUE ===================== */
function queueRead() { return readJSON(KEY_QUEUE, []); }
function queueWrite(q) { writeJSON(KEY_QUEUE, q); }
function queueAdd(aksi, isi) {
  const q = queueRead();
  q.push({ aksi, isi, at: Date.now() });
  queueWrite(q);
  setStatus();
}

async function syncQueue() {
  if (!cfg || !navigator.onLine || syncing || !queueRead().length) return;
  syncing = true;
  let sent = 0;
  const rejected = [];
  try {
    while (true) {
      const q = queueRead();
      if (!q.length) break;
      let res;
      try { res = await api(q[0].aksi, q[0].isi); } catch (err) { break; }
      q.shift();
      queueWrite(q);
      sent++;
      if (!res.ok) rejected.push(tr(res.pesan));
    }
  } finally {
    syncing = false;
  }
  if (sent) toast(`${sent} offline entr${sent > 1 ? 'ies' : 'y'} synced ✨`);
  if (rejected.length) toast(rejected[0], 'bad');
  setStatus();
}

async function sendWrite(aksi, isi, success) {
  try {
    const res = await api(aksi, isi);
    if (!res.ok) { toast(tr(res.pesan) || 'Could not save', 'bad'); return false; }
    toast(success);
    if (aksi === 'tambah') confetti();
    return true;
  } catch (err) {
    if (isOffline(err)) {
      queueAdd(aksi, isi);
      toast('No signal. Saved on this phone and will sync automatically 🌙');
      return true;
    }
    toast(errText(err), 'bad');
    return false;
  }
}

/* ===================== DATA ===================== */
function loadCache() {
  const c = readJSON(KEY_CACHE, null);
  if (!c) return;
  setup = c.setup || setup;
  txs = c.txs || [];
  wallets = c.wallets || [];
  trades = c.trades || [];
  tradingDetail = c.tradingDetail || null;
}

function saveCache() {
  writeJSON(KEY_CACHE, { setup, txs, wallets, trades, tradingDetail });
}

async function loadAll() {
  setProgress(true);
  try {
    const [s, t, w, t2] = await Promise.all([
      api('getSetup'), api('listTransaksi'),
      api('getSaldo').catch(() => null), api('listTrading').catch(() => null)
    ]);
    if (!s.ok || !t.ok) throw new Error(s.pesan || t.pesan || 'Could not load data');
    setup = s.data;
    txs = t.data;
    if (w && w.ok) wallets = w.data;
    if (t2 && t2.ok) trades = t2.data;
    await loadSavings();
    saveCache();
    setStatus('Synced ✨');
  } catch (err) {
    loadCache();
    if (isOffline(err)) setStatus('Offline · last saved data');
    else { setStatus('Could not load'); toast(errText(err), 'bad'); }
  } finally {
    setProgress(false);
    renderAll();
  }
}

let tradingFetchedAt = 0;

async function loadTrading() {
  if (busyTrading) return;
  busyTrading = true;
  tradingFetchedAt = Date.now();
  tradingError = '';
  try {
    const res = await api('getTrading');
    if (res.ok) { tradingDetail = res.data; saveCache(); }
    else tradingError = res.pesan || 'Could not load trading data.';
  } catch (err) {
    tradingError = isOffline(err) ? 'Trading needs a connection to load.' : errText(err);
  } finally {
    busyTrading = false;
    renderMoney();
  }
}

function allTx() {
  const pending = queueRead().filter((x) => x.aksi === 'tambah').map((x) => {
    const d = x.isi.data;
    return { id: d.id, tanggal: d.tanggal, jenis: d.jenis, kategori: d.kategori, nominal: d.nominal,
      catatan: d.catatan || '', dompet: d.dompet, pending: true, baris: 1e9 };
  });
  return [...pending, ...txs]
    .filter((t) => t.tanggal && t.kategori && t.nominal > 0)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.baris - a.baris);
}

function rangeFor(p) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (p === 'today') return { from: today, to: today };
  if (p === 'week') return { from: addDays(today, -((today.getDay() + 6) % 7)), to: today };
  if (p === 'custom') {
    const a = $('.kInput[data-k="from"]').value;
    const b = $('.kInput[data-k="to"]').value;
    const from = a ? fromYmd(a) : today;
    const to = b ? fromYmd(b) : today;
    return { from, to: to < from ? from : to };
  }
  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
}

function prevRange(r, p) {
  if (p === 'week') return { from: addDays(r.from, -7), to: addDays(r.to, -7) };
  if (p === 'month') {
    const y = r.from.getFullYear(), m = r.from.getMonth();
    const last = Math.min(r.to.getDate(), new Date(y, m, 0).getDate());
    return { from: new Date(y, m - 1, 1), to: new Date(y, m - 1, last) };
  }
  const n = Math.round((r.to - r.from) / 86400000) + 1;
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

function endOf(r) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return r.to < today ? r.to : today;
}

function inRange(t, r) { return t.tanggal >= ymd(r.from) && t.tanggal <= ymd(r.to); }

function daysSoFar(r) { return Math.max(1, Math.round((endOf(r) - r.from) / 86400000) + 1); }

function calc(list) {
  let inc = 0, exp = 0, expCount = 0, count = 0;
  list.forEach((t) => {
    if (isCarry(t)) return;
    count++;
    if (t.jenis === 'INCOME') inc += t.nominal;
    if (t.jenis === 'EXPENSE') { exp += t.nominal; expCount++; }
  });
  return { inc, exp, net: inc - exp, count, avg: expCount ? exp / expCount : 0, savings: inc > 0 ? (inc - exp) / inc * 100 : null };
}

function perCategory(list) {
  const m = {};
  list.forEach((t) => { m[t.kategori] = (m[t.kategori] || 0) + t.nominal; });
  return Object.entries(m)
    .map(([kategori, total]) => ({ kategori, ...pisahIkon(kategori), total }))
    .sort((a, b) => b.total - a.total);
}

function tagTotals(list) {
  const m = {};
  list.forEach((t) => {
    if (t.jenis !== 'EXPENSE') return;
    new Set(parseTags(t.catatan)).forEach((tag) => { m[tag] = (m[tag] || 0) + t.nominal; });
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function weekdayTotals(list) {
  const out = [0, 0, 0, 0, 0, 0, 0];
  list.forEach((t) => { if (t.jenis === 'EXPENSE') out[fromYmd(t.tanggal).getDay()] += t.nominal; });
  return out;
}

function weekdayCounts(r) {
  const out = [0, 0, 0, 0, 0, 0, 0];
  const end = endOf(r);
  for (let d = new Date(r.from); d <= end; d = addDays(d, 1)) out[d.getDay()]++;
  return out;
}

function noSpendDays(r, list) {
  const end = endOf(r);
  let n = 0;
  for (let d = new Date(r.from); d <= end; d = addDays(d, 1)) {
    const k = ymd(d);
    if (!list.some((t) => t.jenis === 'EXPENSE' && t.tanggal === k)) n++;
  }
  return n;
}

function monthSpendByCategory(cat) {
  const now = new Date();
  const start = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = ymd(now);
  return allTx()
    .filter((t) => t.jenis === 'EXPENSE' && t.kategori === cat && t.tanggal >= start && t.tanggal <= today)
    .reduce((s, t) => s + t.nominal, 0);
}

function balanceOf(a) {
  if (a.saldoAwal === null || a.saldoAwal === undefined) return null;
  const acuan = a.tanggalAcuan || '';
  let total = Number(a.saldoAwal);
  allTx().forEach((t) => {
    if (t.dompet !== a.nama || t.tanggal <= acuan) return;
    if (t.jenis === 'INCOME' && !isCarry(t)) total += t.nominal;
    if (t.jenis === 'EXPENSE') total -= t.nominal;
  });
  trades.forEach((x) => {
    if (x.tanggal <= acuan) return;
    if (a.kelompok === 'Dompet' && x.dompetBank === a.nama) {
      if (x.jenis === 'DEPOSIT') total -= x.total;
      if (x.jenis === 'WITHDRAW') total += x.total;
    }
    if (a.kelompok === 'Sekuritas' && x.dompet === a.nama) {
      if (x.jenis === 'DEPOSIT' || x.jenis === 'JUAL') total += x.total;
      if (x.jenis === 'WITHDRAW' || x.jenis === 'BELI') total -= x.total;
    }
  });
  total += savingsWalletDelta(a, acuan);
  return total;
}

function accountList() {
  if (wallets.length) return wallets;
  return (setup.akun || []).map((a) => ({ ...a, saldoAwal: null, tanggalAcuan: '' }));
}

function getBudgets() { return readJSON(KEY_BUDGET, {}); }
function saveBudgets(b) { writeJSON(KEY_BUDGET, b); }

/* ----- Goals & bills (stored on this phone) ----- */
const goalsRead = () => readJSON(KEY_GOALS, []);
const goalsWrite = (g) => writeJSON(KEY_GOALS, g);
const billsRead = () => readJSON(KEY_BILLS, []);
const billsWrite = (b) => writeJSON(KEY_BILLS, b);

function avgMonthlySave() {
  const now = new Date();
  let sum = 0;
  for (let i = 1; i <= 3; i++) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    sum += calc(allTx().filter((t) => inRange(t, { from, to }))).net;
  }
  return sum / 3;
}

function monthsUntil(dateStr) {
  const today = new Date();
  const d = fromYmd(dateStr);
  return Math.max(0, (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()));
}

function billInfo(b) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const paid = b.paidMonth === ymd(now).slice(0, 7);
  const mo = now.getMonth() + (paid ? 1 : 0);
  const dim = new Date(now.getFullYear(), mo + 1, 0).getDate();
  const due = new Date(now.getFullYear(), mo, Math.min(b.day, dim));
  const days = Math.round((due - today) / 86400000);
  return { due, days, paid, overdue: !paid && days < 0, soon: !paid && days >= 0 && days <= 3 };
}

