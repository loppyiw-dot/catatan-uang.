/* ===================== TRANSACTION FORM ===================== */
function fillCategories(type, selected) {
  let html = '';
  if (type === 'EXPENSE') {
    setup.expense.forEach((g) => {
      if (!g.anak.length) return;
      html += `<optgroup label="${esc(g.nama)}">` + g.anak.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('') + '</optgroup>';
    });
  } else {
    html = setup.income.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  }
  if (selected && !html.includes(`value="${esc(selected)}"`)) html += `<option value="${esc(selected)}">${esc(selected)}</option>`;
  $('#txCategory').innerHTML = '<option value="">Choose category</option>' + html;
  $('#txCategory').value = selected || '';
}

function fillWallets(sel, selected, placeholder = 'Choose wallet') {
  const list = setup.dompet || [];
  let html = list.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  if (selected && !list.includes(selected)) html += `<option value="${esc(selected)}">${esc(selected)}</option>`;
  $(sel).innerHTML = `<option value="">${placeholder}</option>` + html;
  $(sel).value = selected || '';
}

function setSegment(type) {
  txType = type;
  $$('#txSeg button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
}

function openTxForm(t) {
  editing = t || null;
  setSegment(t ? t.jenis : 'EXPENSE');
  $('#txTitle').textContent = t ? '🎀 Edit entry' : '✨ Add entry';
  $('#txAmount').value = t ? Number(t.nominal).toLocaleString('id-ID') : '';
  $('#txDate').value = t ? t.tanggal : ymd(new Date());
  $('#txNote').value = t ? (t.catatan || '') : '';
  $('#txDelete').classList.toggle('hidden', !t);
  fillCategories(txType, t ? t.kategori : '');
  fillWallets('#txWallet', t ? t.dompet : localStorage.getItem(KEY_LAST_WALLET));
  openSheet('#txSheet');
}

async function saveTx(e) {
  e.preventDefault();
  const data = {
    jenis: txType,
    tanggal: $('#txDate').value,
    kategori: $('#txCategory').value,
    nominal: parseRupiah($('#txAmount').value),
    catatan: $('#txNote').value.trim(),
    dompet: $('#txWallet').value
  };
  if (!data.tanggal) return toast('Pick a date first', 'bad');
  if (!(data.nominal > 0)) return toast('Amount must be more than 0', 'bad');
  if (!data.kategori) return toast('Choose a category first', 'bad');
  if (!data.dompet) return toast('Choose a wallet first', 'bad');

  const btn = $('#txSave');
  btn.disabled = true;
  btn.textContent = 'Saving… 🌷';
  let ok = false;
  try {
    if (editing) {
      const lama = {
        tanggal: editing.tanggal, jenis: editing.jenis, kategori: editing.kategori,
        nominal: editing.nominal, catatan: editing.catatan || '', dompet: editing.dompet || ''
      };
      ok = await sendWrite('ubah', { baris: editing.baris, lama, data }, 'Changes saved 🎀');
    } else {
      data.id = newId();
      ok = await sendWrite('tambah', { data }, 'Entry saved 💖');
      if (ok) localStorage.setItem(KEY_LAST_WALLET, data.dompet);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save 💖';
  }
  if (ok) { closeSheets(); await loadAll(); }
}

async function deleteTx() {
  const t = editing;
  if (!t) return;
  const yes = await ask('Delete this entry?', `${rp(t.nominal)} · ${t.kategori}. This cannot be undone.`, 'Delete');
  if (!yes) return;
  const lama = {
    tanggal: t.tanggal, jenis: t.jenis, kategori: t.kategori,
    nominal: t.nominal, catatan: t.catatan || '', dompet: t.dompet || ''
  };
  const ok = await sendWrite('hapus', { baris: t.baris, lama }, 'Entry deleted 🫧');
  if (ok) { closeSheets(); await loadAll(); }
}

function openByKey(key) {
  const t = allTx().find((x) => keyOf(x) === key);
  if (!t) return;
  if (t.pending) return toast('Still waiting to send. It will sync when you are online.');
  openTxForm(t);
}

/* ===================== BALANCE FORM ===================== */
function prefillBalance(name) {
  const acc = accountList().find((a) => a.nama === name);
  const v = acc ? balanceOf(acc) : null;
  $('#balAmount').value = v === null ? '' : fmtInput(Math.round(v));
}

function openBalanceForm(name) {
  $('#balAccount').innerHTML = accountList().map((a) => `<option value="${esc(a.nama)}">${esc(a.nama)}</option>`).join('');
  $('#balAccount').value = name || '';
  prefillBalance(name || '');
  $('#balDate').value = ymd(new Date());
  openSheet('#balSheet');
}

async function saveBalance(e) {
  e.preventDefault();
  const nama = $('#balAccount').value;
  const raw = $('#balAmount').value.replace(/\D/g, '');
  const tanggal = $('#balDate').value;
  if (!nama) return toast('Choose an account first', 'bad');
  if (raw === '') return toast('Enter a balance, 0 is fine 🌷', 'bad');
  if (!tanggal) return toast('Pick a date first', 'bad');
  const btn = $('#balSave');
  btn.disabled = true;
  btn.textContent = 'Saving… 🌷';
  try {
    const res = await api('setSaldo', { data: { nama, saldo: Number(raw), tanggal } });
    if (!res.ok) return toast(tr(res.pesan) || 'Could not save balance', 'bad');
    toast('Balance saved 💖');
    confetti();
    closeSheets();
    await loadAll();
  } catch (err) {
    toast(isOffline(err) ? 'You need a connection to set balances' : errText(err), 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save balance ✨';
  }
}

/* ===================== GOALS ===================== */
function openGoalForm(g) {
  editingGoal = g || null;
  $('#goalTitle').textContent = g ? '🎯 Edit goal' : '🎯 New goal';
  $('#goalEmoji').innerHTML = GOAL_EMOJI.map((e) => `<option value="${e}">${e}</option>`).join('');
  $('#goalEmoji').value = g ? g.emoji : '🌸';
  $('#goalName').value = g ? g.name : '';
  $('#goalTarget').value = g ? fmtInput(g.target) : '';
  $('#goalDeadline').value = g ? (g.deadline || '') : '';
  $('#goalDelete').classList.toggle('hidden', !g);
  openSheet('#goalSheet');
}

function saveGoal(e) {
  e.preventDefault();
  const name = $('#goalName').value.trim();
  const target = parseRupiah($('#goalTarget').value);
  const deadline = $('#goalDeadline').value;
  const emoji = $('#goalEmoji').value;
  if (!name) return toast('Give your goal a name', 'bad');
  if (!(target > 0)) return toast('Target must be more than 0', 'bad');
  const list = goalsRead();
  if (editingGoal) {
    const g = list.find((x) => x.id === editingGoal.id);
    if (g) Object.assign(g, { name, target, deadline, emoji });
  } else {
    list.push({ id: newId(), name, target, saved: 0, deadline, emoji });
  }
  goalsWrite(list);
  closeSheets();
  renderMoney();
  toast('Goal saved 🎯');
}

async function deleteGoal() {
  if (!editingGoal) return;
  const yes = await ask('Delete this goal?', `${editingGoal.name} and its progress will be removed.`, 'Delete');
  if (!yes) return;
  goalsWrite(goalsRead().filter((x) => x.id !== editingGoal.id));
  closeSheets();
  renderMoney();
  toast('Goal deleted 🫧');
}

function openFund(id) {
  const g = goalsRead().find((x) => x.id === id);
  if (!g) return;
  fundGoalId = id;
  $('#fundTitle').textContent = `+ Savings for ${g.emoji} ${g.name}`;
  $('#fundAmount').value = '';
  openSheet('#fundSheet');
}

function saveFund(e) {
  e.preventDefault();
  const amount = parseRupiah($('#fundAmount').value);
  if (!(amount > 0)) return toast('Enter an amount above 0', 'bad');
  const list = goalsRead();
  const g = list.find((x) => x.id === fundGoalId);
  if (!g) return closeSheets();
  g.saved += amount;
  goalsWrite(list);
  closeSheets();
  renderMoney();
  if (g.saved >= g.target) toast('🎉 Goal reached! Congrats, Princess 👑!');
  else toast('Savings added 💖');
  confetti();
}

/* ===================== BILLS ===================== */
function openBillForm(b) {
  editingBill = b || null;
  $('#billTitle').textContent = b ? '🧾 Edit bill' : '🧾 New bill';
  $('#billDay').innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $('#billDay').value = b ? b.day : new Date().getDate();
  $('#billName').value = b ? b.name : '';
  $('#billAmount').value = b ? fmtInput(b.amount) : '';
  fillWallets('#billWallet', b ? b.wallet : '', 'Choose wallet');
  const cats = setup.expense.flatMap((g) => g.anak);
  $('#billCategory').innerHTML = '<option value="">Choose category</option>' + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('#billCategory').value = b ? b.category : '';
  $('#billDelete').classList.toggle('hidden', !b);
  openSheet('#billSheet');
}

function saveBill(e) {
  e.preventDefault();
  const name = $('#billName').value.trim();
  const amount = parseRupiah($('#billAmount').value);
  const day = Number($('#billDay').value);
  const wallet = $('#billWallet').value;
  const category = $('#billCategory').value;
  if (!name) return toast('Give the bill a name', 'bad');
  if (!(amount > 0)) return toast('Amount must be more than 0', 'bad');
  if (!wallet) return toast('Choose a wallet first', 'bad');
  if (!category) return toast('Choose a category first', 'bad');
  const list = billsRead();
  if (editingBill) {
    const b = list.find((x) => x.id === editingBill.id);
    if (b) Object.assign(b, { name, amount, day, wallet, category });
  } else {
    list.push({ id: newId(), name, amount, day, wallet, category, paidMonth: '' });
  }
  billsWrite(list);
  closeSheets();
  renderMoney();
  renderHome();
  toast('Bill saved 🧾');
}

async function deleteBill() {
  if (!editingBill) return;
  const yes = await ask('Delete this bill?', `${editingBill.name} will no longer have reminders.`, 'Delete');
  if (!yes) return;
  billsWrite(billsRead().filter((x) => x.id !== editingBill.id));
  closeSheets();
  renderMoney();
  renderHome();
  toast('Bill deleted 🫧');
}

async function payBill(id) {
  const list = billsRead();
  const b = list.find((x) => x.id === id);
  if (!b) return;
  const today = ymd(new Date());
  const data = { jenis: 'EXPENSE', tanggal: today, kategori: b.category, nominal: b.amount, catatan: 'Bill: ' + b.name, dompet: b.wallet, id: newId() };
  const ok = await sendWrite('tambah', { data }, `${b.name} paid 💖`);
  if (!ok) return;
  b.paidMonth = today.slice(0, 7);
  billsWrite(list);
  renderMoney();
  renderHome();
  await loadAll();
}

function undoBill(id) {
  const list = billsRead();
  const b = list.find((x) => x.id === id);
  if (!b) return;
  b.paidMonth = '';
  billsWrite(list);
  renderMoney();
  renderHome();
  toast('Marked as unpaid. The expense entry stays in History.');
}

/* ===================== REPORT, CSV, PDF ===================== */
function reportText() {
  const r = rangeFor('month');
  const list = allTx().filter((t) => inRange(t, r));
  const m = calc(list);
  const name = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const top = perCategory(list.filter((t) => t.jenis === 'EXPENSE')).slice(0, 3);
  const bills = billsRead();
  const paid = bills.filter((b) => billInfo(b).paid).length;
  const goals = goalsRead();
  const L = [
    `🌸 Putri Finance · ${name}`, '',
    `💰 Income: ${rp(m.inc)}`,
    `🛍️ Expenses: ${rp(m.exp)}`,
    `💖 Net: ${rp(m.net)}`,
    `🌷 Savings rate: ${m.savings === null ? '–' : Math.round(m.savings) + '%'}`
  ];
  if (top.length) {
    L.push('', '🏆 Top spending:');
    top.forEach((c, i) => L.push(`${i + 1}. ${c.ikon} ${c.nama}: ${rp(c.total)}`));
  }
  if (bills.length) L.push('', `🧾 Bills paid: ${paid}/${bills.length}`);
  if (goals.length) {
    L.push('', '🎯 Goals:');
    goals.forEach((g) => L.push(`${g.emoji} ${g.name}: ${Math.min(100, Math.round(g.saved / g.target * 100))}%`));
  }
  return L.join('\n');
}

async function shareReport() {
  const text = reportText();
  if (navigator.share) {
    try { await navigator.share({ title: 'Putri Finance report', text }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

function exportCsv() {
  const list = filterHistory();
  if (!list.length) return toast('Nothing to export yet', 'bad');
  const head = ['Date', 'Type', 'Category', 'Amount', 'Wallet', 'Note'];
  const rows = list.map((t) => [t.tanggal, t.jenis === 'INCOME' ? 'Income' : 'Expense', t.kategori, t.nominal, t.dompet, t.catatan]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'putri-finance-' + ymd(new Date()) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPdf() {
  const list = filterHistory();
  if (!list.length) return toast('Nothing to export yet', 'bad');
  const m = calc(list);
  $('#printArea').innerHTML = `<h2>Putri Finance · Transactions</h2>
    <p>${list.length} entries · Income ${rp(m.inc)} · Expenses ${rp(m.exp)} · Net ${rp(m.net)}</p>
    <table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Wallet</th><th>Note</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${list.map((t) => `<tr><td>${esc(t.tanggal)}</td><td>${t.jenis === 'INCOME' ? 'Income' : 'Expense'}</td><td>${esc(t.kategori)}</td><td>${esc(t.dompet)}</td><td>${esc(t.catatan)}</td><td style="text-align:right">${t.jenis === 'INCOME' ? '+' : '−'} ${rp(t.nominal)}</td></tr>`).join('')}</tbody></table>`;
  window.print();
}

/* ===================== BUDGETS ===================== */
function addBudget() {
  const cat = $('#budCat').value;
  const amt = parseRupiah($('#budAmt').value);
  if (!cat) return toast('Choose a category first', 'bad');
  if (!(amt > 0)) return toast('Enter a limit above 0', 'bad');
  const b = getBudgets();
  b[cat] = amt;
  saveBudgets(b);
  $('#budAmt').value = '';
  toast('Budget saved 🎯');
  renderAnalytics();
}

async function removeBudget(cat) {
  const yes = await ask('Remove this budget?', `${pisahIkon(cat).nama} will no longer have a limit.`, 'Remove');
  if (!yes) return;
  const b = getBudgets();
  delete b[cat];
  saveBudgets(b);
  renderAnalytics();
}

/* ===================== PIN, SETUP, LOCK ===================== */
async function hashPin(pin, salt) {
  if (!crypto.subtle) throw new Error('Open the app using an https address.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function drawDots() {
  $$('#dots .dot').forEach((d, i) => d.classList.toggle('on', i < pinInput.length));
}

function pressKey(k) {
  if (k === 'del') pinInput = pinInput.slice(0, -1);
  else if (pinInput.length < 6) pinInput += k;
  drawDots();
  if (pinInput.length === 6) checkPin();
}

async function checkPin() {
  let hash;
  try {
    hash = await hashPin(pinInput, cfg.salt);
  } catch (err) {
    pinInput = '';
    drawDots();
    toast(err.message, 'bad');
    return;
  }
  if (hash === cfg.pinHash) {
    pinInput = '';
    drawDots();
    openApp();
    return;
  }
  pinInput = '';
  drawDots();
  const screen = $('#lockScreen');
  screen.classList.remove('shake');
  void screen.offsetWidth;
  screen.classList.add('shake');
  toast('Wrong PIN, try again 🎀', 'bad');
}

function lockNow() {
  loggedIn = false;
  closeSheets();
  pinInput = '';
  drawDots();
  setScreen('lockScreen');
}

function autoLockCheck() {
  if (loggedIn && Date.now() - lastActive > LOCK_MS) lockNow();
}

async function resetApp() {
  const yes = await ask('Reset the app?', 'The URL, key, PIN, goals, and bills on this phone will be removed. Unsent entries will be lost. Your spreadsheet data is not affected.', 'Reset');
  if (!yes) return;
  ['catatanUang.cfg', 'catatanUang.cache', 'catatanUang.antrean', 'catatanUang.dompetTerakhir', 'putriFinance.budget', 'putriFinance.goals', 'putriFinance.bills'].forEach((k) => localStorage.removeItem(k));
  location.reload();
}

async function openApp() {
  loggedIn = true;
  lastActive = Date.now();
  setScreen('app');
  showTab('tabHome');
  loadCache();
  renderAll();
  await syncQueue();
  await loadAll();
}

async function setupSubmit(e) {
  e.preventDefault();
  const url = $('#setupUrl').value.trim();
  const key = $('#setupKey').value.trim();
  const pin = $('#setupPin').value;
  const pin2 = $('#setupPin2').value;
  if (!url.includes('script.google.com')) return toast('The Web App URL must start with script.google.com', 'bad');
  if (!/^\d{6}$/.test(pin)) return toast('PIN must be 6 digits', 'bad');
  if (pin !== pin2) return toast("The PINs don't match", 'bad');
  const btn = $('#btnSetup');
  btn.disabled = true;
  btn.textContent = 'Connecting… 🌷';
  try {
    const res = await apiWith({ url, kunci: key }, 'ping');
    if (!res.ok) throw new Error(res.pesan || 'Invalid key');
    const salt = randomHex(16);
    cfg = { url, kunci: key, salt, pinHash: await hashPin(pin, salt) };
    localStorage.setItem(KEY_CFG, JSON.stringify(cfg));
    openApp();
  } catch (err) {
    toast(isOffline(err) ? 'No signal. Try again later.' : errText(err), 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect 💖';
  }
}

