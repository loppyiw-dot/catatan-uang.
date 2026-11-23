/* ===================== RENDER ===================== */
function renderAll() {
  if (!loggedIn) return;
  renderFilterOptions();
  renderHome();
  renderHistory();
  if (!$('#tabAnalytics').classList.contains('hidden')) renderAnalytics();
  if (!$('#tabMoney').classList.contains('hidden')) renderMoney();
}

const keyOf = (t) => t.pending ? 'p' + t.id : 'b' + t.baris;

function itemHTML(t) {
  const { ikon, nama } = pisahIkon(t.kategori);
  const inc = t.jenis === 'INCOME';
  const tag = t.pending ? '<span class="badge">waiting to send</span>'
    : isCarry(t) ? '<span class="badge">carry-over</span>' : '';
  const sub = [t.catatan, t.dompet].filter(Boolean).join(' · ') || '—';
  return `<div class="item ${t.pending ? 'pending' : ''}" data-key="${esc(keyOf(t))}">
    <div class="ico-circle ${inc ? 'in' : 'out'}">${esc(ikon)}</div>
    <div class="grow"><div class="name">${esc(nama)}${tag}</div><div class="subline">${esc(sub)}</div></div>
    <div class="amount ${inc ? 'in' : 'out'}">${inc ? '+' : '−'} ${rp(t.nominal)}</div>
  </div>`;
}

function renderFilterOptions() {
  const sel = $('#filterCategory');
  const keep = sel.value;
  const all = [...setup.income, ...setup.expense.flatMap((g) => g.anak), CARRY];
  sel.innerHTML = '<option value="">All categories</option>' + all.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
  sel.value = keep;
  const bud = $('#budCat');
  const keepB = bud.value;
  bud.innerHTML = '<option value="">Choose category</option>' + setup.expense.flatMap((g) => g.anak)
    .map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
  bud.value = keepB;
}

function renderBillAlert() {
  const el = $('#billAlert');
  const alerts = billsRead().filter((b) => { const i = billInfo(b); return i.overdue || i.soon; });
  if (!alerts.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="card-title">🔔 Bills to check</div>` + alerts.map((b) => {
    const i = billInfo(b);
    const when = i.overdue ? 'overdue' : i.days === 0 ? 'due today' : `in ${i.days} day${i.days > 1 ? 's' : ''}`;
    return `<div class="alert-row"><span>${esc(b.name)}</span><span>${rp(b.amount)} · ${when}</span></div>`;
  }).join('');
}

function renderHome() {
  renderBillAlert();
  const h = new Date().getHours();
  $('#greet').textContent = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌷' : h < 20 ? 'Good evening 🌙' : 'Good night ✨';
  $('#todayLabel').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const r = rangeFor(period);
  const list = allTx().filter((t) => inRange(t, r));
  const prevList = allTx().filter((t) => inRange(t, prevRange(r, period)));
  const m = calc(list), pm = calc(prevList);

  $('#labelPeriod').textContent = `Left ${PERIOD_LABEL[period].toLowerCase()} · ${fmtRange(r)}`;
  const net = $('#netAmount');
  animateNumber(net, m.net);
  net.classList.toggle('neg', m.net < 0);
  animateNumber($('#sumIncome'), m.inc);
  animateNumber($('#sumExpense'), m.exp);
  $('#statSavings').textContent = m.savings === null ? '–' : Math.round(m.savings) + '%';
  $('#statAvg').textContent = rp(m.avg);
  $('#statCount').textContent = m.count;

  const badge = $('#compareBadge');
  if (pm.exp > 0) {
    const pct = (m.exp - pm.exp) / pm.exp * 100;
    badge.textContent = `${pct >= 0 ? '📈 Up' : '📉 Down'} ${Math.abs(pct).toFixed(0)}% spending vs ${period === 'month' ? 'same days last month' : 'previous period'}`;
  } else {
    badge.textContent = '🌷 Not enough data to compare yet';
  }

  const cats = perCategory(list.filter((t) => t.jenis === 'EXPENSE'));
  donutList = cats;
  $('#donutTotal').textContent = rp(m.exp);
  if (!cats.length) {
    dropChart('chartDonut');
    $('#catList').innerHTML = emptyHTML('No spending yet', 'Expenses for this period will show up here ✨');
  } else {
    $('#catList').innerHTML = cats.map((c, i) => {
      const pct = m.exp ? c.total / m.exp * 100 : 0;
      return `<div class="cat-row" data-cat="${i}">
        <div class="bar-top"><span>${esc(c.ikon)} ${esc(c.nama)}</span><span>${rp(c.total)}</span></div>
        <div class="track"><div class="fill" data-w="${pct.toFixed(1)}" style="background:${COLORS[i % COLORS.length]}"></div></div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => $$('#catList .fill').forEach((b) => { b.style.width = b.dataset.w + '%'; }));
    drawChart('chartDonut', {
      type: 'doughnut',
      data: {
        labels: cats.map((c) => c.nama),
        datasets: [{ data: cats.map((c) => c.total), backgroundColor: cats.map((_, i) => COLORS[i % COLORS.length]), borderColor: '#fff', borderWidth: 4 }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { animateRotate: true, duration: 900 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + rp(c.raw) } } },
        onClick: (e, els) => { if (els.length) openHistory(donutList[els[0].index].kategori); }
      }
    });
  }

  const items = [];
  const days = daysSoFar(r);
  items.push({ ico: '🏆', bg: '#ffe3f0', k: 'Top spending category',
    v: cats[0] ? `${cats[0].ikon} ${cats[0].nama} · ${Math.round(cats[0].total / m.exp * 100)}% of spending` : 'No spending yet' });
  items.push({ ico: '🌼', bg: '#e6fff5', k: 'Average spending per day', v: rp(m.exp / days) });
  if (period === 'month' && m.exp > 0) {
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const proj = m.exp / now.getDate() * dim;
    items.push({ ico: '🔮', bg: '#eee6ff', k: 'Projected spending by month end',
      v: rp(proj) + (m.inc > 0 ? (proj <= m.inc ? ' · within income ✅' : ' · above income ⚠️') : '') });
  } else {
    items.push({ ico: '🔮', bg: '#eee6ff', k: 'Month-end projection',
      v: period === 'month' ? 'Log some spending first' : 'Choose "This month" to see it' });
  }
  const big = list.filter((t) => t.jenis === 'EXPENSE').sort((a, b) => b.nominal - a.nominal)[0];
  items.push({ ico: '💎', bg: '#e0f2ff', k: 'Biggest single expense', v: big ? `${rp(big.nominal)} · ${pisahIkon(big.kategori).nama}` : '–' });
  const wd = weekdayTotals(list);
  const maxWd = Math.max(...wd);
  items.push({ ico: '🗓️', bg: '#fff3d6', k: 'Busiest spending day', v: maxWd > 0 ? `${WEEKDAY_LONG[wd.indexOf(maxWd)]} · ${rp(maxWd)}` : '–' });
  items.push({ ico: '🌙', bg: '#f0eaff', k: 'No-spend days', v: `${noSpendDays(r, list)} of ${days} days` });
  items.push({ ico: '💖', bg: '#ffe8f1', k: 'Savings rate',
    v: m.savings === null ? 'No income recorded yet'
      : `${Math.round(m.savings)}% · ${m.savings >= 20 ? 'Great job, Princess 👑!' : m.savings >= 0 ? 'Okay, keep going' : 'Spending more than income'}` });
  $('#insights').innerHTML = items.map((x) => `<div class="insight">
    <div class="ico-box" style="background:${x.bg}">${x.ico}</div>
    <div><small>${esc(x.k)}</small><b>${esc(x.v)}</b></div>
  </div>`).join('');

  const latest = allTx().slice(0, 5);
  $('#latest').innerHTML = latest.length ? latest.map(itemHTML).join('')
    : emptyHTML('No entries yet', 'Tap + to add your first entry 💖');
}

function filterHistory() {
  const q = $('#search').value.trim().toLowerCase();
  const type = $('#filterType').value;
  const cat = $('#filterCategory').value;
  const from = $('#filterFrom').value;
  const to = $('#filterTo').value;
  return allTx().filter((t) =>
    (!type || t.jenis === type) &&
    (!cat || t.kategori === cat) &&
    (!from || t.tanggal >= from) &&
    (!to || t.tanggal <= to) &&
    (!q || [t.kategori, t.catatan, t.dompet, String(t.nominal)].join(' ').toLowerCase().includes(q)));
}

function renderHistory() {
  const wrap = $('#historyList');
  if (!allTx().length) { wrap.innerHTML = emptyHTML('No entries yet', 'Tap + to add your first entry 💖'); return; }
  const list = filterHistory();
  if (!list.length) { wrap.innerHTML = emptyHTML('Nothing matches', 'Try a different search or filter.'); return; }
  let html = '', last = null;
  list.forEach((t) => {
    if (t.tanggal !== last) { last = t.tanggal; html += `<div class="date-head">🎀 ${esc(fmtDate(last))}</div>`; }
    html += itemHTML(t);
  });
  wrap.innerHTML = html;
}

function renderAnalytics() {
  const r = rangeFor(period);
  const list = allTx().filter((t) => inRange(t, r));
  const prev = allTx().filter((t) => inRange(t, prevRange(r, period)));

  if (mode === 'daily') {
    $('#chartTitle').textContent = 'Daily trend';
    $('#statALabel').textContent = 'Average per day';
    $('#statBLabel').textContent = 'Peak spending day';
    const end = endOf(r);
    const labels = [], exp = [], inc = [];
    for (let d = new Date(r.from); d <= end; d = addDays(d, 1)) {
      const k = ymd(d);
      labels.push(d.getDate());
      exp.push(list.filter((t) => t.jenis === 'EXPENSE' && t.tanggal === k).reduce((a, t) => a + t.nominal, 0));
      inc.push(list.filter((t) => t.jenis === 'INCOME' && !isCarry(t) && t.tanggal === k).reduce((a, t) => a + t.nominal, 0));
    }
    const total = exp.reduce((a, b) => a + b, 0);
    const peak = Math.max(...exp, 0);
    $('#statA').textContent = rp(total / exp.length);
    $('#statB').textContent = peak > 0 ? `${fmtShort(addDays(r.from, exp.indexOf(peak)))} · ${rp(peak)}` : '–';
    drawChart('chartMain', lineChart(labels, [
      { label: 'Expenses', data: exp, color: '#f06fa0', fill: true },
      { label: 'Income', data: inc, color: '#5fcaa0', fill: false }
    ]));
  } else if (mode === 'weekday') {
    $('#chartTitle').textContent = 'Average spending by weekday';
    $('#statALabel').textContent = 'Highest average';
    $('#statBLabel').textContent = 'Lowest average';
    const sums = weekdayTotals(list);
    const counts = weekdayCounts(r);
    const avgs = WEEK_ORDER.map((i) => counts[i] ? sums[i] / counts[i] : 0);
    const maxA = Math.max(...avgs), minA = Math.min(...avgs);
    const maxI = WEEK_ORDER[avgs.indexOf(maxA)], minI = WEEK_ORDER[avgs.indexOf(minA)];
    $('#statA').textContent = maxA > 0 ? `${WEEKDAY_SHORT[maxI]} · ${rp(maxA)}` : '–';
    $('#statB').textContent = maxA > 0 ? `${WEEKDAY_SHORT[minI]} · ${rp(minA)}` : '–';
    drawChart('chartMain', {
      type: 'bar',
      data: {
        labels: WEEK_ORDER.map((i) => WEEKDAY_SHORT[i]),
        datasets: [{ label: 'Average expense', data: avgs, backgroundColor: WEEK_ORDER.map((_, idx) => COLORS[idx % COLORS.length]), borderRadius: 10 }]
      },
      options: barOpts()
    });
  } else {
    $('#chartTitle').textContent = 'Last 6 months';
    $('#statALabel').textContent = 'Average spending per month';
    $('#statBLabel').textContent = 'Highest month';
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const c = calc(allTx().filter((t) => inRange(t, { from, to })));
      months.push({ label: from.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), inc: c.inc, exp: c.exp });
    }
    const total = months.reduce((a, b) => a + b.exp, 0);
    const maxM = Math.max(...months.map((x) => x.exp), 0);
    $('#statA').textContent = rp(total / 6);
    $('#statB').textContent = maxM > 0 ? `${months[months.findIndex((x) => x.exp === maxM)].label} · ${rp(maxM)}` : '–';
    drawChart('chartMain', {
      type: 'bar',
      data: {
        labels: months.map((x) => x.label),
        datasets: [
          { label: 'Income', data: months.map((x) => x.inc), backgroundColor: '#8fe3c5', borderRadius: 10 },
          { label: 'Expenses', data: months.map((x) => x.exp), backgroundColor: '#ffa3c7', borderRadius: 10 }
        ]
      },
      options: barOpts()
    });
  }

  const top = list.filter((t) => t.jenis === 'EXPENSE').sort((a, b) => b.nominal - a.nominal).slice(0, 5);
  $('#topList').innerHTML = top.length ? top.map(itemHTML).join('') : emptyHTML('No expenses yet', 'Nothing to rank for this period.');

  const cats = perCategory(list.filter((t) => t.jenis === 'EXPENSE'));
  const prevMap = {};
  perCategory(prev.filter((t) => t.jenis === 'EXPENSE')).forEach((c) => { prevMap[c.kategori] = c.total; });
  const totalExp = cats.reduce((a, c) => a + c.total, 0);
  $('#catTable').innerHTML = cats.length ? cats.map((c) => {
    const share = totalExp ? Math.round(c.total / totalExp * 100) : 0;
    const p = prevMap[c.kategori];
    let chg = '<span class="muted">new</span>';
    if (p > 0) {
      const pct = (c.total - p) / p * 100;
      chg = `<span class="${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%</span>`;
    } else if (p === undefined) {
      chg = '<span class="muted">–</span>';
    }
    return `<div class="tbl-row"><span class="grow">${esc(c.ikon)} ${esc(c.nama)}</span><span class="num">${rp(c.total)}</span><span class="num muted">${share}%</span><span class="num">${chg}</span></div>`;
  }).join('') : emptyHTML('No categories yet', 'Expense categories appear here.');

  renderTags(list);
  renderBudgets();
}

function renderTags(list) {
  const tags = tagTotals(list);
  $('#tagList').innerHTML = tags.length
    ? tags.map(([tag, total]) => `<div class="cat-row" data-tag="${esc(tag)}"><div class="bar-top"><span>${esc(tag)}</span><span>${rp(total)}</span></div></div>`).join('')
      + `<p class="note">Tap a tag to see its entries.</p>`
    : emptyHTML('No tags yet', 'Write #tags in the note of an entry, like #holiday.');
}

function renderBudgets() {
  const budgets = getBudgets();
  const keys = Object.keys(budgets);
  $('#budList').innerHTML = keys.length ? keys.map((cat) => {
    const limit = budgets[cat];
    const spent = monthSpendByCategory(cat);
    const pct = limit ? spent / limit * 100 : 0;
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
    const status = pct >= 100 ? 'Over budget 🚨' : pct >= 80 ? 'Almost at the limit ⚠️' : 'On track 💚';
    const { ikon, nama } = pisahIkon(cat);
    return `<div class="budget-item" data-budget="${esc(cat)}">
      <div class="bar-top"><span>${esc(ikon)} ${esc(nama)}</span><span>${rp(spent)} / ${rp(limit)}</span></div>
      <div class="track"><div class="fill ${cls}" data-w="${Math.min(100, pct).toFixed(1)}" style="background:${cls ? '' : '#c4b5fd'}"></div></div>
      <div class="status-line">${status} · ${Math.round(pct)}% used · tap to remove</div>
    </div>`;
  }).join('') : emptyHTML('No budgets yet', 'Pick a category above and set a monthly limit.');
  requestAnimationFrame(() => $$('#budList .fill').forEach((b) => { b.style.width = b.dataset.w + '%'; }));
}

function renderMoney() {
  const tabs = ['wallets', 'trading', 'savings', 'plan', 'wealth'];
  tabs.forEach((k) => $('#money-' + k).classList.toggle('hidden', moneyTab !== k));
  $$('[data-money]').forEach((c) => c.classList.toggle('active', c.dataset.money === moneyTab));
  if (moneyTab === 'wallets') renderWallets();
  else if (moneyTab === 'trading') renderTrading();
  else if (moneyTab === 'savings') renderSavings();
  else if (moneyTab === 'plan') renderPlan();
  else renderWealth();
}

function acctHTML(a) {
  const sub = a.tanggalAcuan ? 'as of ' + fmtShort(fromYmd(a.tanggalAcuan)) : 'not set yet';
  return `<div class="acct" data-acct="${esc(a.nama)}">
    <div class="ico-circle ${a.kelompok === 'Sekuritas' ? 'sek' : 'dom'}">${ICONS[a.nama] || '👛'}</div>
    <div class="grow"><div class="name">${esc(a.nama)}</div><div class="subline">${esc(sub)}</div></div>
    <div class="amount">${a.saldo === null ? '<span class="badge">Set</span>' : rp(a.saldo)}</div>
  </div>`;
}

function renderWallets() {
  const list = accountList().map((a) => ({ ...a, saldo: balanceOf(a) }));
  const dom = list.filter((a) => a.kelompok === 'Dompet');
  const sek = list.filter((a) => a.kelompok === 'Sekuritas');
  const sum = (xs) => xs.reduce((s, a) => s + (a.saldo ?? 0), 0);
  const td = sum(dom), ts = sum(sek);
  animateNumber($('#totalWallets'), td + ts);
  $('#walletSplit').textContent = `👛 Wallets ${rp(td)} · 💼 Securities ${rp(ts)}`;
  const missing = list.filter((a) => a.saldo === null).length;
  $('#walletNote').textContent = missing
    ? `✨ ${missing} account${missing > 1 ? 's' : ''} need a balance. Tap one to set it.`
    : 'All balances are set. 💖';
  $('#listWallets').innerHTML = dom.map(acctHTML).join('') || emptyHTML('No wallets yet', 'Wallets are set in Code.gs.');
  $('#listSecurities').innerHTML = sek.map(acctHTML).join('') || emptyHTML('No securities yet', 'Securities are set in Code.gs.');
}

function renderTrading() {
  const box = $('#tradingBox');
  if (!tradingDetail && !tradingError) {
    box.innerHTML = emptyHTML('Loading trading…', 'Reading your Log Transaksi sheet 📈');
    loadTrading();
    return;
  }
  if (!tradingDetail) {
    box.innerHTML = `<div class="card">${emptyHTML('Trading view unavailable', tradingError)}
      <div class="row-btns"><button class="btn sm ghost" id="retryTrading">Try again</button></div></div>`;
    $('#retryTrading').onclick = () => { tradingError = ''; renderTrading(); };
    return;
  }
  const s = tradingDetail.ringkasan;
  const games = s.jumlahUntung + s.jumlahRugi;
  const rate = games ? Math.round(s.jumlahUntung / games * 100) : null;
  const warnings = (tradingDetail.peringatan || []).map((p) => `<div class="warn-line">⚠️ ${esc(p)}</div>`).join('');
  const stocks = (tradingDetail.saham || []).filter((x) => x.lotSisa > 0).map((x) => {
    const holding = x.lotSisa > 0 ? `${x.lotSisa} lot holding · ${rp(x.modalSisa)} in stock` : 'Closed position';
    return `<div class="stock">
      <div class="grow"><div class="name">${esc(x.kode)}</div><div class="subline">${esc(holding)}</div></div>
      <div class="amount ${x.realisasi >= 0 ? 'in' : 'out'}">${x.realisasi >= 0 ? '+' : '−'} ${rp(Math.abs(x.realisasi))}</div>
    </div>`;
  }).join('');
  box.innerHTML = `
    <div class="mini-row">
      <div class="mini"><small>Realized P/L</small><b class="${s.realisasi >= 0 ? 'down' : 'up'}">${s.realisasi >= 0 ? '' : '−'}${rp(Math.abs(s.realisasi))}</b></div>
      <div class="mini"><small>In stocks</small><b>${rp(s.modalTerbuka)}</b></div>
      <div class="mini"><small>Win rate</small><b>${rate === null ? '–' : rate + '%'}</b></div>
    </div>
    <div class="mini-row two" style="margin-bottom:16px">
      <div class="mini"><small>Winning sells</small><b class="down">${s.jumlahUntung}</b></div>
      <div class="mini"><small>Losing sells</small><b class="up">${s.jumlahRugi}</b></div>
    </div>
    ${warnings ? `<div class="card">${warnings}</div>` : ''}
    <div class="card">
      <div class="card-title">📈 Stocks</div>
      ${stocks || emptyHTML('No open positions', 'Stocks you still hold will show here.')}
      <p class="note">Profit and loss shown is realized, from sells. Unrealized value needs live prices, which this app does not fetch.</p>
    </div>`;
}

function goalHTML(g, avg) {
  const pct = Math.min(100, g.target ? g.saved / g.target * 100 : 0);
  const remain = g.target - g.saved;
  let eta;
  if (remain <= 0) {
    eta = '🎉 Goal reached! Congrats, Princess 👑!';
  } else if (avg > 0) {
    const months = Math.ceil(remain / avg);
    eta = `About ${months} month${months > 1 ? 's' : ''} at ${rp(avg)}/month`;
    if (g.deadline) eta += months > monthsUntil(g.deadline) ? ' · ⚠️ behind schedule' : ' · ✅ on track';
  } else {
    eta = 'Your average monthly savings is low right now, so this may take a while.';
  }
  return `<div class="goal">
    <div class="bar-top"><span>${esc(g.emoji)} ${esc(g.name)}</span><span>${rp(g.saved)} / ${rp(g.target)}</span></div>
    <div class="track"><div class="fill" data-w="${pct.toFixed(1)}" style="background:var(--grad)"></div></div>
    <div class="bar-line">${Math.round(pct)}%${g.deadline ? ' · deadline ' + fmtShort(fromYmd(g.deadline)) : ''}</div>
    <div class="subline" style="white-space:normal;margin-top:6px">${esc(eta)}</div>
    <div class="row-btns">
      <button class="btn sm" data-goal-add="${esc(g.id)}">+ Add savings</button>
      <button class="btn sm ghost" data-goal-edit="${esc(g.id)}">Edit</button>
    </div>
  </div>`;
}

function billHTML(b) {
  const i = billInfo(b);
  let status;
  if (i.paid) status = `✅ Paid · next due ${fmtShort(i.due)}`;
  else if (i.overdue) status = `🚨 Overdue by ${-i.days} day${-i.days > 1 ? 's' : ''}`;
  else if (i.days === 0) status = '🔔 Due today';
  else if (i.soon) status = `🔔 Due in ${i.days} day${i.days > 1 ? 's' : ''} · ${fmtShort(i.due)}`;
  else status = `📅 Due ${fmtShort(i.due)}`;
  const main = i.paid
    ? `<button class="btn sm ghost" data-bill-undo="${esc(b.id)}">Undo</button>`
    : `<button class="btn sm" data-bill-pay="${esc(b.id)}">✨ Pay now</button>`;
  return `<div class="bill">
    <div class="bar-top"><span>${esc(b.name)}</span><span>${rp(b.amount)}</span></div>
    <div class="subline" style="white-space:normal;margin-top:6px">${esc(status)} · ${esc(b.wallet)}</div>
    <div class="row-btns">${main}<button class="btn sm ghost" data-bill-edit="${esc(b.id)}">Edit</button></div>
  </div>`;
}

function renderPlan() {
  const avg = avgMonthlySave();
  const goals = goalsRead();
  $('#goalList').innerHTML = goals.length ? goals.map((g) => goalHTML(g, avg)).join('')
    : emptyHTML('No goals yet', 'Create a savings goal, like a laptop or a trip ✨');
  const bills = billsRead();
  $('#billList').innerHTML = bills.length ? bills.map(billHTML).join('')
    : emptyHTML('No bills yet', 'Add recurring bills like electricity or rent to get reminders 🧾');
  requestAnimationFrame(() => $$('#goalList .fill').forEach((b) => { b.style.width = b.dataset.w + '%'; }));
}

function wealthSeries() {
  const accs = accountList().map((a) => ({ ...a, saldo: balanceOf(a) })).filter((a) => a.saldo !== null);
  if (!accs.length) return null;
  const now = accs.reduce((s, a) => s + a.saldo, 0);
  const acuan = {};
  accs.forEach((a) => { acuan[a.nama] = a.tanggalAcuan || ''; });
  const names = new Set(accs.map((a) => a.nama));
  const events = [];
  allTx().forEach((t) => {
    if (!names.has(t.dompet) || t.tanggal <= acuan[t.dompet] || isCarry(t)) return;
    if (t.jenis === 'INCOME') events.push({ tanggal: t.tanggal, delta: t.nominal });
    if (t.jenis === 'EXPENSE') events.push({ tanggal: t.tanggal, delta: -t.nominal });
  });
  trades.forEach((x) => {
    const add = (name, delta) => {
      if (names.has(name) && x.tanggal > acuan[name]) events.push({ tanggal: x.tanggal, delta });
    };
    if (x.jenis === 'DEPOSIT') { add(x.dompetBank, -x.total); add(x.dompet, x.total); }
    if (x.jenis === 'WITHDRAW') { add(x.dompetBank, x.total); add(x.dompet, -x.total); }
    if (x.jenis === 'BELI') add(x.dompet, -x.total);
    if (x.jenis === 'JUAL') add(x.dompet, x.total);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const end = i === 0 ? today : new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const k = ymd(end);
    const later = events.filter((e) => e.tanggal > k).reduce((s, e) => s + e.delta, 0);
    out.push({ label: end.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), value: now - later });
  }
  return out;
}

function renderWealth() {
  const series = wealthSeries();
  if (!series) {
    $('#wealthEmpty').classList.remove('hidden');
    $('#wealthEmpty').innerHTML = emptyHTML('Not enough data yet', 'Set at least one wallet balance in the Wallets tab first.');
    $('#wealthBody').classList.add('hidden');
    dropChart('chartWealth');
    return;
  }
  $('#wealthEmpty').classList.add('hidden');
  $('#wealthBody').classList.remove('hidden');
  const last = series[series.length - 1].value;
  const prev = series.length > 1 ? series[series.length - 2].value : last;
  const diff = last - prev;
  animateNumber($('#wealthNow'), last);
  $('#wealthDiff').textContent = `${diff >= 0 ? '▲' : '▼'} ${rp(Math.abs(diff))} vs last month`;
  drawChart('chartWealth', {
    type: 'line',
    data: {
      labels: series.map((s) => s.label),
      datasets: [{ label: 'Cash balance', data: series.map((s) => s.value), borderColor: '#a78bfa', backgroundColor: 'rgba(196,181,253,.25)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#a78bfa' }]
    },
    options: baseOpts()
  });
}

/* ===================== CHARTS ===================== */
function drawChart(id, cfgChart) {
  if (typeof Chart === 'undefined') return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), cfgChart);
}

function dropChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function baseOpts() {
  return {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 900 },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${rp(c.raw)}` } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: '#f5e9f2' }, ticks: { callback: (v) => compact(v) } }
    }
  };
}

function barOpts() {
  const o = baseOpts();
  o.plugins.legend.display = false;
  return o;
}

function lineChart(labels, sets) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: sets.map((s) => ({
        label: s.label, data: s.data, borderColor: s.color,
        backgroundColor: s.fill ? 'rgba(240,111,160,.15)' : 'transparent',
        fill: s.fill, tension: .4, pointRadius: 3, pointBackgroundColor: s.color
      }))
    },
    options: baseOpts()
  };
}

/* ===================== NAVIGATION ===================== */
function showTab(id) {
  $$('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== id));
  $$('.bottom-nav [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  window.scrollTo({ top: 0 });
  renderAll();
}

function openHistory(cat) {
  renderFilterOptions();
  $('#filterCategory').value = cat;
  $('#filterType').value = 'EXPENSE';
  showTab('tabHistory');
}

function openHistorySearch(q) {
  renderFilterOptions();
  $('#search').value = q;
  $('#filterType').value = '';
  $('#filterCategory').value = '';
  showTab('tabHistory');
}

function setScreen(id) {
  ['setupScreen', 'lockScreen', 'app'].forEach((x) => $('#' + x).classList.toggle('hidden', x !== id));
}

/* ===================== SHEETS ===================== */
function openSheet(id) {
  SHEET_IDS.forEach((s) => $(s).classList.toggle('hidden', s !== id));
  $('#overlay').classList.remove('hidden');
}

function closeSheets() {
  SHEET_IDS.forEach((s) => $(s).classList.add('hidden'));
  $('#overlay').classList.add('hidden');
  editing = null;
  editingGoal = null;
  editingBill = null;
  fundGoalId = null;
}

