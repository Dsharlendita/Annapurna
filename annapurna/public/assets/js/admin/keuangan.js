(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  const OWN = Admin.isOwner;
  Admin.init('keuangan', OWN ? 'Keuangan' : 'Kas Harian');
  if (!OWN) {
    /* Staff: kas harian saja — tanpa laba, rekap bulanan, dan grafik */
    document.querySelector('.page-sub').innerHTML = 'Catat uang masuk & keluar toko per hari dan cocokkan dengan kas fisik. Pemasukan dari rental, penjualan, dan denda tercatat otomatis. Rekap laba & laporan bulanan dilihat Owner.';
    document.querySelectorAll('#range [data-r]').forEach((b) => { if (b.dataset.r !== 'today') b.remove(); });
    $('#range [data-r="today"]').insertAdjacentHTML('afterend', '<button class="btn btn-light btn-sm" data-r="yday">Kemarin</button>');
    $('#to').hidden = true; document.querySelector('#range .muted').hidden = true; $('#from').title = 'Pilih tanggal kas';
    document.querySelector('.grid-dash').remove(); $('#quick').remove();
  }
  const T = D.today(); let tab = 'in'; let ch;
  const CATS = { get out() { return DB.financeCats('out'); }, get in() { return DB.financeCats('in'); } };
  function setRange(r) {
    const map = { today: [T, T], yday: [D.rel(-1), D.rel(-1)], week: [D.rel(-6), T], month: [T.slice(0, 8) + '01', T], 30: [D.rel(-29), T] };
    [$('#from').value, $('#to').value] = map[r];
    $$('#range [data-r]').forEach((b) => { b.classList.toggle('btn-primary', b.dataset.r === r); b.classList.toggle('btn-light', b.dataset.r !== r); });
    draw();
  }
  const sumCat = (l) => { const o = {}; l.forEach((x) => (o[x.cat] = (o[x.cat] || 0) + x.amount)); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const bars = (entries, color) => { const max = entries.length ? entries[0][1] : 1; return entries.length ? entries.map(([k, v]) => `<li><div class="bl"><span>${esc(k)}</span><strong>${rupiah(v)}</strong></div><div class="bar"><i style="width:${(v / max) * 100}%;background:${color}"></i></div></li>`).join('') : '<li class="muted">Tidak ada data.</li>'; };
  function draw() {
    const f = $('#from').value, t = $('#to').value;
    const L = Admin.ledger(f, t);
    const q = (a, b) => { const x = Admin.ledger(a, b); return x.totalIn - x.totalOut; };
    const qi = (a, b) => Admin.ledger(a, b).totalIn;
    const st = (ic, tone, l, v) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong></div></div>`;
    if ($('#quick')) $('#quick').innerHTML = st('fa-sun', 'gold', 'Pemasukan hari ini', rupiah(qi(T, T))) + st('fa-calendar-week', 'blue', 'Pemasukan minggu ini', rupiah(qi(D.rel(-6), T))) + st('fa-calendar', '', 'Pemasukan bulan ini', rupiah(qi(T.slice(0, 8) + '01', T))) + st('fa-scale-balanced', '', 'Laba bersih bulan ini', rupiah(q(T.slice(0, 8) + '01', T)));
    const net = L.totalIn - L.totalOut;
    $('#sum').innerHTML = `<div class="sum-card pos"><small>${OWN ? `Total pemasukan (${D.fmtDate(f)} – ${D.fmtDate(t)})` : `Uang masuk · ${D.fmtDate(f, true)}`}</small><strong>${rupiah(L.totalIn)}</strong></div>
      <div class="sum-card neg"><small>${OWN ? 'Total pengeluaran' : 'Uang keluar'}</small><strong>${rupiah(L.totalOut)}</strong></div>
      <div class="sum-card ${net >= 0 ? 'pos' : 'neg'}"><small>${OWN ? 'Selisih (laba / rugi)' : 'Saldo kas (masuk − keluar)'}</small><strong>${net < 0 ? '− ' : ''}${rupiah(Math.abs(net))}</strong></div>${(() => { const held = DB.bookings().filter((b) => b.depositIn && !b.depositOut); const tot = held.reduce((x, b) => x + b.depositIn.amount, 0); return tot ? `<div class="sum-card"><small>Jaminan dipegang toko (bukan pemasukan)</small><strong>${rupiah(tot)}</strong><small>${held.length} booking · dikembalikan saat barang kembali</small></div>` : ''; })()}`;
    if ($('#compIn')) $('#compIn').innerHTML = bars(sumCat(L.income), 'var(--g600)');
    if ($('#compOut')) $('#compOut').innerHTML = bars(sumCat(L.expense), '#d9644f');
    $('#cIn').textContent = L.income.length; $('#cOut').textContent = L.expense.length;
    const acts = (x) => `<div class="acts"><button class="btn btn-light btn-xs" data-edit="${x.kind}|${x.id}" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="btn btn-light btn-xs" data-void="${x.kind}|${x.id}" title="Batalkan transaksi"><i class="fa-solid fa-ban"></i> Batalkan</button></div>`;
    const when = (x) => (String(x.date).length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date));
    const voidRows = (kind, span) => L.voided.filter((x) => x.kind === kind).map((x) => `<tr class="row-off"><td>${when(x)}</td>${span}<td><span class="pill gray">${esc(x.cat)}</span></td><td><s>${esc(x.desc)}</s><small>Dibatalkan oleh ${esc(x.voidBy || '-')}: ${esc(x.voidReason || '-')}</small></td><td class="num"><s>${rupiah(x.amount)}</s></td><td><span class="pill red plain">Dibatalkan</span></td></tr>`).join('');
    if (tab === 'in') {
      $('#th').innerHTML = '<tr><th>Tanggal</th><th>Referensi</th><th>Kategori</th><th>Keterangan</th><th class="num">Jumlah</th><th class="num">Aksi</th></tr>';
      $('#rows').innerHTML = (L.income.length ? L.income.map((x) => `<tr><td>${when(x)}</td><td>${x.manual ? `<span class="muted">${x.ref}</span>` : `<a href="${x.ref.startsWith('RNT') ? 'booking' : 'penjualan'}?id=${x.ref}" style="font-weight:700;color:var(--g700)">${x.ref}</a>`}</td><td><span class="pill ${x.cat === 'Penjualan' ? 'blue' : x.cat === 'Denda' ? 'amber' : x.manual ? 'gray' : 'green'}">${x.cat}</span></td><td>${esc(x.desc)}${x.manual ? '' : '<small>Tercatat otomatis dari transaksi</small>'}</td><td class="num">${rupiah(x.amount)}</td><td>${x.manual ? acts(x) : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Tidak ada pemasukan pada periode ini.</td></tr>') + voidRows('in', '<td></td>');
      $('#tf').innerHTML = `<tr><td colspan="4">Total pemasukan</td><td class="num">${rupiah(L.totalIn)}</td><td></td></tr>`;
    } else {
      $('#th').innerHTML = '<tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="num">Jumlah</th><th class="num">Aksi</th></tr>';
      $('#rows').innerHTML = (L.expense.length ? L.expense.map((x) => `<tr><td>${when(x)}</td><td><span class="pill ${x.auto ? 'amber' : 'gray'}">${esc(x.cat)}</span></td><td>${esc(x.desc)}${x.auto ? '<small>Tercatat otomatis dari refund</small>' : ''}</td><td class="num">${rupiah(x.amount)}</td><td>${x.auto ? `<div class="acts"><a class="btn btn-light btn-xs" href="booking?id=${x.ref}">Lihat</a></div>` : acts(x)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Tidak ada pengeluaran pada periode ini.</td></tr>') + voidRows('out', '');
      $('#tf').innerHTML = `<tr><td colspan="3">Total pengeluaran</td><td class="num">${rupiah(L.totalOut)}</td><td></td></tr>`;
    }
    const days = []; for (let d = f; d <= t && days.length < 62; d = D.addDays(d, 1)) days.push(d);
    const by = (l) => days.map((d) => l.filter((x) => D.day(x.date) === d).reduce((s, x) => s + x.amount, 0));
    if (window.Chart) {
      if (ch) ch.destroy();
      if (!$('#chart')) return;
      ch = new Chart($('#chart'), { type: 'line', data: { labels: days.map((d) => D.fmtDate(d).replace(/ \d{4}$/, '')), datasets: [
        { label: 'Pemasukan', data: by(L.income), borderColor: '#1f4d2f', backgroundColor: 'rgba(31,77,47,.12)', fill: true, tension: .35, pointRadius: days.length > 20 ? 0 : 3 },
        { label: 'Pengeluaran', data: by(L.expense), borderColor: '#d9644f', backgroundColor: 'rgba(217,100,79,.08)', fill: true, tension: .35, pointRadius: days.length > 20 ? 0 : 3 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rupiah(c.raw)}` } } },
          scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => v >= 1e6 ? v / 1e6 + ' jt' : v >= 1e3 ? v / 1e3 + ' rb' : v }, grid: { color: '#eeece4' } } } } });
    }
  }
  function finForm(kind, e) {
    const isNew = !e; const cats = [...CATS[kind]]; if (e && e.category && !cats.includes(e.category)) cats.unshift(e.category); e = e || { date: T, category: cats[0], desc: '', amount: '' };
    const label = kind === 'in' ? 'pemasukan lainnya' : 'pengeluaran';
    const m = modal({ title: `${isNew ? 'Catat' : 'Edit'} ${label}`, body: `<form id="ef" novalidate>
      <div class="grid-2"><div class="field"><label>Tanggal</label><input class="input" type="date" name="date" value="${e.date}" max="${T}"></div>
      <div class="field"><label>Kategori</label><select class="select" name="category">${cats.map((c) => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      <div class="field"><label>Keterangan</label><input class="input" name="desc" value="${esc(e.desc)}" placeholder="${kind === 'in' ? 'Contoh: Jasa cuci tenda milik customer' : 'Contoh: Servis kompor portable'}"></div>
      <div class="field"><label>Jumlah (Rp)</label><input class="input" type="number" min="0" step="500" name="amount" value="${e.amount}"></div>
      ${isNew ? '' : '<div class="notice"><i class="fa-solid fa-clock-rotate-left"></i><div>Perubahan tercatat di histori sistem beserta nilai sebelum dan sesudahnya.</div></div>'}</form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="eSave">Simpan</button>` });
    m.$('#eSave').addEventListener('click', () => {
      const F = m.$('#ef'), E = F.elements;
      if (!validate(F, { date: (v) => (!v ? 'Pilih tanggal.' : ''), desc: (v) => (v.length < 3 ? 'Isi keterangan.' : ''), amount: (v) => (!(+v > 0) ? 'Jumlah harus lebih dari 0.' : '') })) return;
      const all = kind === 'in' ? DB.incomes() : DB.expenses();
      const obj = { id: e.id || DB.nextId(kind === 'in' ? 'INC' : 'EXP', all), date: E.date.value, category: E.category.value, desc: E.desc.value.trim(), amount: Math.round(+E.amount.value) };
      DB.saveFinance(kind, obj); m.close(); toast(`${label[0].toUpperCase() + label.slice(1)} disimpan.`);
      tab = kind; $$('#tabs .tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === kind)); draw();
    });
  }
  $('#range').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) setRange(b.dataset.r); });
  ['#from', '#to'].forEach((s) => $(s).addEventListener('change', () => { if (!OWN) $('#to').value = $('#from').value; if ($('#from').value > $('#to').value) $('#to').value = $('#from').value; $$('#range [data-r]').forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-light'); }); draw(); }));
  $('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (!t) return; tab = t.dataset.tab; $$('#tabs .tab').forEach((x) => x.classList.toggle('active', x === t)); draw(); });
  $('#addExp').addEventListener('click', () => finForm('out'));
  $('#addInc').addEventListener('click', () => finForm('in'));
  $('#rows').addEventListener('click', async (ev) => {
    const ed = ev.target.closest('[data-edit]'), vd = ev.target.closest('[data-void]');
    const find = (v) => { const [k, id] = v.split('|'); return [k, (k === 'in' ? DB.incomes() : DB.expenses()).find((x) => x.id === id)]; };
    if (ed) { const [k, x] = find(ed.dataset.edit); finForm(k, x); }
    if (vd) {
      const [k, x] = find(vd.dataset.void);
      const r = await confirmBox({ title: `Batalkan ${k === 'in' ? 'pemasukan' : 'pengeluaran'} ${x.id}?`, text: `${esc(x.desc)} · ${rupiah(x.amount)}<br>Transaksi tidak dihapus, hanya ditandai <strong>dibatalkan</strong> dan tidak dihitung lagi dalam total. Tindakan ini tercatat di histori.`, ok: 'Batalkan transaksi', danger: true, input: { label: 'Alasan pembatalan', required: true, error: 'Alasan wajib diisi.' } });
      if (r === false) return;
      DB.voidFinance(k, x.id, r); toast('Transaksi ditandai dibatalkan.'); draw();
    }
  });
  bindExport($('#exp'), () => { const f = $('#from').value, t = $('#to').value; const L = Admin.ledger(f, t);
    const rows = [...L.income.map((x) => [x.date, x.date.length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date), 'Pemasukan', x.cat, x.ref, x.desc, x.amount, '']), ...L.expense.map((x) => [x.date, x.date.length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date), 'Pengeluaran', x.cat, x.ref, x.desc, '', x.amount])]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map((r) => r.slice(1));
    return { filename: `rekap-keuangan-${f}_${t}`, title: 'Rekap Keuangan', subtitle: `Periode ${D.fmtDate(f, true)} – ${D.fmtDate(t, true)}`, orientation: 'portrait',
      summary: [['Total pemasukan', L.totalIn], ['Total pengeluaran', L.totalOut], ['Laba / rugi', L.totalIn - L.totalOut]],
      columns: [{ header: 'Tanggal' }, { header: 'Jenis' }, { header: 'Kategori' }, { header: 'Ref' }, { header: 'Keterangan', width: 34 }, { header: 'Masuk', type: 'money' }, { header: 'Keluar', type: 'money' }],
      rows, foot: ['Total', '', '', '', `Selisih: ${rupiah(L.totalIn - L.totalOut)}`, L.totalIn, L.totalOut] }; });
  setRange(OWN ? 'month' : 'today');
})();

