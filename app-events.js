/* ===================== EVENTS ===================== */
$('#setupForm').addEventListener('submit', setupSubmit);
$('#keypad').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-k]');
  if (b) pressKey(b.dataset.k);
});
document.addEventListener('keydown', (e) => {
  if ($('#lockScreen').classList.contains('hidden')) return;
  if (/^\d$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('del');
});
$('#forgotPin').addEventListener('click', resetApp);

document.addEventListener('click', (e) => {
  const per = e.target.closest('[data-period]');
  if (per) {
    period = per.dataset.period;
    $$('[data-period]').forEach((c) => c.classList.toggle('active', c.dataset.period === period));
    $$('[data-custom]').forEach((el) => el.classList.toggle('hidden', period !== 'custom'));
    renderAll();
    return;
  }
  const md = e.target.closest('[data-mode]');
  if (md) {
    mode = md.dataset.mode;
    $$('[data-mode]').forEach((c) => c.classList.toggle('active', c.dataset.mode === mode));
    renderAnalytics();
    return;
  }
  const mt = e.target.closest('[data-money]');
  if (mt) { moneyTab = mt.dataset.money; renderMoney(); return; }
  const cat = e.target.closest('[data-cat]');
  if (cat) { openHistory(donutList[Number(cat.dataset.cat)].kategori); return; }
  const tag = e.target.closest('[data-tag]');
  if (tag) { openHistorySearch(tag.dataset.tag); return; }
  const acct = e.target.closest('[data-acct]');
  if (acct) { openBalanceForm(acct.dataset.acct); return; }
  const bud = e.target.closest('[data-budget]');
  if (bud) { removeBudget(bud.dataset.budget); return; }
  const ga = e.target.closest('[data-goal-add]');
  if (ga) { openFund(ga.dataset.goalAdd); return; }
  const ge = e.target.closest('[data-goal-edit]');
  if (ge) { openGoalForm(goalsRead().find((g) => g.id === ge.dataset.goalEdit)); return; }
  const bp = e.target.closest('[data-bill-pay]');
  if (bp) { payBill(bp.dataset.billPay); return; }
  const bu = e.target.closest('[data-bill-undo]');
  if (bu) { undoBill(bu.dataset.billUndo); return; }
  const be = e.target.closest('[data-bill-edit]');
  if (be) { openBillForm(billsRead().find((b) => b.id === be.dataset.billEdit)); return; }
  const item = e.target.closest('.item');
  if (item) openByKey(item.dataset.key);
});

document.addEventListener('change', (e) => {
  if (!e.target.classList.contains('kInput')) return;
  const k = e.target.dataset.k;
  $$('.kInput[data-k="' + k + '"]').forEach((i) => { i.value = e.target.value; });
  renderAll();
});

$$('.bottom-nav [data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#btnLock').addEventListener('click', lockNow);
$('#btnReset').addEventListener('click', resetApp);
$('#btnAdd').addEventListener('click', () => { if (loggedIn) openTxForm(null); });

$('#search').addEventListener('input', renderHistory);
['filterType', 'filterCategory', 'filterFrom', 'filterTo'].forEach((id) => $('#' + id).addEventListener('change', renderHistory));
$('#resetFilter').addEventListener('click', () => {
  $('#search').value = '';
  $('#filterType').value = '';
  $('#filterCategory').value = '';
  $('#filterFrom').value = '';
  $('#filterTo').value = '';
  renderHistory();
});
$('#btnCsv').addEventListener('click', exportCsv);
$('#btnPdf').addEventListener('click', exportPdf);
$('#btnShare').addEventListener('click', shareReport);

$('#txAmount').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
$('#balAmount').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
$('#goalTarget').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
$('#fundAmount').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
$('#billAmount').addEventListener('input', (e) => { e.target.value = fmtInput(e.target.value); });
$$('#txSeg button').forEach((b) => b.addEventListener('click', () => {
  setSegment(b.dataset.type);
  fillCategories(txType, '');
}));
$('#txClose').addEventListener('click', closeSheets);
$('#balClose').addEventListener('click', closeSheets);
$('#goalClose').addEventListener('click', closeSheets);
$('#fundClose').addEventListener('click', closeSheets);
$('#billClose').addEventListener('click', closeSheets);
$('#overlay').addEventListener('click', closeSheets);
$('#txSheet').addEventListener('submit', saveTx);
$('#txDelete').addEventListener('click', deleteTx);
$('#balSheet').addEventListener('submit', saveBalance);
$('#balAccount').addEventListener('change', (e) => prefillBalance(e.target.value));
$('#goalSheet').addEventListener('submit', saveGoal);
$('#goalDelete').addEventListener('click', deleteGoal);
$('#fundSheet').addEventListener('submit', saveFund);
$('#billSheet').addEventListener('submit', saveBill);
$('#billDelete').addEventListener('click', deleteBill);
$('#btnNewGoal').addEventListener('click', () => openGoalForm(null));
$('#btnNewBill').addEventListener('click', () => openBillForm(null));
$('#budAdd').addEventListener('click', addBudget);

window.addEventListener('online', () => { syncQueue().then(loadAll); });
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
setInterval(autoLockCheck, 10000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) autoLockCheck(); });

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Quicksand', system-ui, sans-serif";
  Chart.defaults.color = '#8a7b99';
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

if (!cfg) setScreen('setupScreen');
else { setScreen('lockScreen'); drawDots(); }
