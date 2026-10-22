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
    $('#to').hidden = true; const sep = document.querySelector('#range .keu-dates > span'); if (sep) sep.hidden = true; $('#from').title = 'Pilih tanggal kas';
    document.querySelector('.grid-dash').remove(); $('#quick').remove();
  }
  const T = D.today(); let tab = param('tab') === 'out' ? 'out' : 'in'; let ch;
  $$('#tabs .tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
  const CATS = { get out() { return DB.financeCats('out'); }, get in() { return DB.financeCats('in'); } };
  function setRange(r) {
    const map = { today: [T, T], yday: [D.rel(-1), D.rel(-1)], week: [D.rel(-6), T], month: [T.slice(0, 8) + '01', T], 30: [D.rel(-29), T] };
    [$('#from').value, $('#to').value] = map[r];
    $$('#range [data-r]').forEach((b) => { b.classList.toggle('btn-primary', b.dataset.r === r); b.classList.toggle('btn-light', b.dataset.r !== r); });
    draw();
  }
  const sumCat = (l) => { const o = {}; l.forEach((x) => (o[x.cat] = (o[x.cat] || 0) + x.amount)); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  /* Komposisi: nilai negatif (refund DP = pengurang pemasukan) ditampilkan sebagai angka merah tanpa batang */
  const bars = (entries, color) => { const max = Math.max(1, ...entries.map(([, v]) => v)); return entries.length ? entries.map(([k, v]) => `<li><div class="bl"><span>${esc(k)}</span><strong${v < 0 ? ' style="color:var(--red)"' : ''}>${v < 0 ? '− ' : ''}${rupiah(Math.abs(v))}</strong></div><div class="bar"><i style="width:${v > 0 ? (v / max) * 100 : 0}%;background:${color}"></i></div></li>`).join('') : '<li class="muted">Tidak ada data.</li>'; };
  /* Filter lini bisnis: semua | rent (sewa) | sale (jual) | umum (operasional, promosi, dll.) — sama dengan tab di Dashboard owner */
  let LINE = ['rent', 'sale', 'umum'].includes(param('lini')) ? param('lini') : 'all';
  const LINE_LBL = { rent: 'Rental', sale: 'Penjualan', umum: 'Umum' };
  const lini = (x) => `<span class="lini ${x.line}">${LINE_LBL[x.line] || ''}</span>`;
  /* Tebakan awal lini untuk transaksi manual (aturan sama dengan Admin.ledger); staff tetap bisa mengubahnya di form */
  /* Jenis biaya → lini otomatis (staff tidak perlu menebak lini):
     Rental  : perawatan/perbaikan alat, deterjen & kebutuhan laundry, bensin antar-jemput sewa, kebutuhan rental
     Penjualan: kemasan barang jual, pembelian barang (restock sebaiknya lewat Data Barang)
     Umum    : wifi, listrik, gaji, sewa tempat, promosi, operasional & lainnya */
  const guessLine = (kind, cat) => (kind === 'out' && /perawatan|perbaikan|refund|deterjen|laundry|bensin antar|antar-jemput|kebutuhan rental|tenda/i.test(cat) ? 'rent'
    : kind === 'out' && /pembelian barang|restock|stok|kemasan|barang jual|kulak/i.test(cat) ? 'sale'
    : kind === 'in' && /cuci|servis|laundry|tenda|bongkar|pasang|ongkir/i.test(cat) ? 'rent' : 'umum');
  const LINE_HINT = { rent: 'Masuk lini Rental (mengurangi laba rental): kebutuhan laundry, bensin antar-jemput sewa, perawatan & perbaikan alat sewa.', sale: 'Masuk lini Penjualan: kemasan barang jual, dll. Restock barang jual pakai Data Barang → Restock.', umum: 'Masuk lini Umum (mengurangi laba bersih toko): wifi, listrik, gaji, sewa tempat, promosi & biaya toko lainnya.' };
  function led(f, t) {
    const L = Admin.ledger(f, t); if (LINE === 'all') return L;
    const income = L.income.filter((x) => x.line === LINE), expense = L.expense.filter((x) => x.line === LINE);
    const tot = (a) => a.reduce((s, x) => s + x.amount, 0);
    const ti = L.fromArchive ? L.by[LINE].in : tot(income), to = L.fromArchive ? L.by[LINE].out : tot(expense);
    return Object.assign({}, L, { income, expense, voided: L.voided.filter((x) => !x.line || x.line === LINE), totalIn: ti, totalOut: to, profit: L.by[LINE].profit, cogs: L.by[LINE].cogs || 0 });
  }
  function draw() {
    const f = $('#from').value, t = $('#to').value;
    const L = led(f, t);
    const q = (a, b) => led(a, b).profit;
    const qi = (a, b) => led(a, b).totalIn;
    const st = (ic, tone, l, v) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong></div></div>`;
    if ($('#quick')) $('#quick').innerHTML = st('fa-sun', 'gold', 'Pemasukan hari ini', rupiah(qi(T, T))) + st('fa-calendar-week', 'blue', 'Pemasukan minggu ini', rupiah(qi(D.rel(-6), T))) + st('fa-calendar', '', 'Pemasukan bulan ini', rupiah(qi(T.slice(0, 8) + '01', T))) + st('fa-scale-balanced', '', LINE === 'all' ? 'Laba bersih bulan ini' : `Laba kotor ${LINE_LBL[LINE]} bulan ini`, rupiah(q(T.slice(0, 8) + '01', T)));
    const net = OWN ? L.profit : L.totalIn - L.totalOut;
    $('#sum').classList.toggle('cols-4', !!(OWN && LINE === 'sale'));
    $('#sum').innerHTML = `<div class="sum-card pos"><small>${OWN ? `Total pemasukan (${D.fmtDate(f)} – ${D.fmtDate(t)})` : `Uang masuk · ${D.fmtDate(f, true)}`}</small><strong>${rupiah(L.totalIn)}</strong></div>
      <div class="sum-card neg"><small>${OWN ? (LINE === 'rent' ? 'Total pengeluaran rental' : LINE === 'sale' ? 'Belanja stok (uang keluar)' : 'Total pengeluaran') : 'Uang keluar'}</small><strong>${rupiah(L.totalOut)}</strong>${OWN && LINE === 'rent' ? '<small>Restock barang sewa, kebutuhan lain &amp; perawatan</small>' : OWN && LINE === 'umum' ? '<small>Wifi, listrik, gaji, sewa tempat, dll.</small>' : ''}</div>
      ${OWN && LINE === 'sale' ? `<div class="sum-card neg"><small>Modal barang terjual (harga beli)</small><strong>${rupiah(L.cogs)}</strong>${L.by.sale.missingCost ? `<small style="color:var(--red)">${L.by.sale.missingCost} transaksi tanpa harga beli</small>` : ''}</div>` : ''}
      <div class="sum-card ${net >= 0 ? 'pos' : 'neg'}"><small>${OWN ? (LINE === 'all' ? 'Laba bersih toko' : LINE === 'sale' ? 'Laba penjualan (jual − modal)' : LINE === 'rent' ? 'Laba rental' : 'Hasil lini Umum (pemasukan − pengeluaran)') : 'Saldo kas (masuk − keluar)'}</small><strong>${net < 0 ? '− ' : ''}${rupiah(Math.abs(net))}</strong>${OWN && LINE === 'all' && L.totalIn - L.totalOut !== net ? `<small>Arus kas (masuk − keluar): ${L.totalIn - L.totalOut < 0 ? '− ' : ''}${rupiah(Math.abs(L.totalIn - L.totalOut))}</small>` : ''}</div>${(() => { const held = DB.bookings().filter((b) => b.depositIn && !b.depositOut); const tot = held.reduce((x, b) => x + b.depositIn.amount, 0); return tot ? `<div class="sum-card"><small>Jaminan dipegang toko (bukan pemasukan)</small><strong>${rupiah(tot)}</strong><small>${held.length} booking · dikembalikan saat barang kembali</small></div>` : ''; })()}`;
    if ($('#compIn')) $('#compIn').innerHTML = bars(sumCat(L.income), 'var(--g600)');
    if ($('#compOut')) $('#compOut').innerHTML = bars(sumCat(L.expense), '#d9644f');
    $('#cIn').textContent = L.income.length; $('#cOut').textContent = L.expense.length;
    const acts = (x) => `<div class="acts"><button class="btn btn-light btn-xs" data-edit="${x.kind}|${x.id}" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="btn btn-light btn-xs" data-void="${x.kind}|${x.id}" title="Batalkan transaksi"><i class="fa-solid fa-ban"></i> Batalkan</button></div>`;
    const when = (x) => (String(x.date).length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date));
    const voidRows = (kind, span) => L.voided.filter((x) => x.kind === kind).map((x) => `<tr class="row-off"><td>${when(x)}</td>${span}<td><span class="pill gray">${esc(x.cat)}</span></td><td><s>${esc(x.desc)}</s><small>Dibatalkan oleh ${esc(x.voidBy || '-')}: ${esc(x.voidReason || '-')}</small></td><td class="num"><s>${rupiah(x.amount)}</s></td><td><span class="pill red plain">Dibatalkan</span></td></tr>`).join('');
    /* Pencarian tabel transaksi */
    const tq = String(($('#tq') || {}).value || '').trim().toLowerCase();
    const mt = (x) => !tq || [x.ref, Reports.refNo(x.ref || ''), x.cat, x.desc, x.line].join(' ').toLowerCase().includes(tq);
    const IN = L.income.filter(mt), OUT = L.expense.filter(mt);
    if (tab === 'in') {
      $('#th').innerHTML = '<tr><th>Tanggal</th><th>Referensi</th><th>Lini · Kategori</th><th>Keterangan</th><th class="num">Jumlah</th><th class="num">Aksi</th></tr>';
      $('#rows').innerHTML = (IN.length ? IN.map((x) => `<tr><td>${when(x)}</td><td>${x.manual ? `<span class="muted">${x.ref}</span>` : `<a href="${x.ref.startsWith('RNT') ? 'booking' : x.ref.startsWith('DRY') ? 'laundry' : 'penjualan'}?id=${x.ref}" style="font-weight:700;color:var(--g700)">${esc(Reports.refNo(x.ref))}</a>`}</td><td>${lini(x)}<span class="pill ${x.cat === 'Penjualan' ? 'blue' : x.cat === 'Denda' ? 'amber' : x.manual ? 'gray' : 'green'}">${x.cat}</span></td><td>${esc(x.desc)}${x.manual ? '' : '<small>Tercatat otomatis dari transaksi</small>'}</td><td class="num">${rupiah(x.amount)}</td><td>${x.manual ? acts(x) : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Tidak ada pemasukan pada periode ini.</td></tr>') + voidRows('in', '<td></td>');
      $('#tf').innerHTML = `<tr><td colspan="4">Total pemasukan${tq ? ' (hasil pencarian)' : ''}</td><td class="num">${rupiah(tq ? IN.reduce((a, x) => a + x.amount, 0) : L.totalIn)}</td><td></td></tr>`;
    } else {
      $('#th').innerHTML = '<tr><th>Tanggal</th><th>Lini · Kategori</th><th>Keterangan</th><th class="num">Jumlah</th><th class="num">Aksi</th></tr>';
      $('#rows').innerHTML = (OUT.length ? OUT.map((x) => `<tr><td>${when(x)}</td><td>${lini(x)}<span class="pill ${x.auto ? 'amber' : 'gray'}">${esc(x.cat)}</span></td><td>${esc(x.desc)}${x.auto ? '<small>Tercatat otomatis dari refund</small>' : ''}</td><td class="num">${rupiah(x.amount)}</td><td>${x.auto ? `<div class="acts"><a class="btn btn-light btn-xs" href="booking?id=${x.ref}">Lihat</a></div>` : acts(x)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Tidak ada pengeluaran pada periode ini.</td></tr>') + voidRows('out', '');
      $('#tf').innerHTML = `<tr><td colspan="3">Total pengeluaran${tq ? ' (hasil pencarian)' : ''}</td><td class="num">${rupiah(tq ? OUT.reduce((a, x) => a + x.amount, 0) : L.totalOut)}</td><td></td></tr>`;
    }
    const days = []; for (let d = f; d <= t && days.length < 62; d = D.addDays(d, 1)) days.push(d);
    const by = (l) => days.map((d) => l.filter((x) => D.day(x.date) === d).reduce((s, x) => s + x.amount, 0));
    if (window.Chart) {
      if (ch) ch.destroy();
      if (!$('#chart')) return;
      /* Grafik batang per hari: tidak melengkung di bawah nol seperti grafik garis */
      ch = new Chart($('#chart'), { type: 'bar', data: { labels: days.map((d) => D.fmtDate(d).replace(/ \d{4}$/, '')), datasets: [
        { label: 'Pemasukan', data: by(L.income), backgroundColor: '#2f6b43', borderRadius: 4, maxBarThickness: 18 },
        { label: 'Pengeluaran', data: by(L.expense), backgroundColor: '#e07a63', borderRadius: 4, maxBarThickness: 18 }] },
        options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rupiah(c.raw)}` } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => v >= 1e6 ? v / 1e6 + ' jt' : v >= 1e3 ? v / 1e3 + ' rb' : v }, grid: { color: '#eeece4' } } } } });
    }
  }
  function finForm(kind, e) {
    const isNew = !e; const cats = [...CATS[kind]]; if (e && e.category && !cats.includes(e.category)) cats.unshift(e.category); e = e || { date: T, category: cats[0], desc: '', amount: '' };
    const label = kind === 'in' ? 'pemasukan lainnya' : 'pengeluaran';
    let ln = e.line || (isNew && LINE !== 'all' ? LINE : guessLine(kind, e.category));
    const m = modal({ title: `${isNew ? 'Catat' : 'Edit'} ${label}`, body: `<form id="ef" novalidate>
      <div class="grid-2"><div class="field"><label>Tanggal</label><input class="input" type="date" name="date" value="${e.date}" max="${T}"></div>
      <div class="field"><label>${kind === 'out' ? 'Jenis biaya' : 'Jenis pemasukan'}</label><select class="select" name="category">${(kind === 'out' ? [['umum', 'Biaya toko (lini Umum)'], ['rent', 'Kebutuhan rental (lini Rental)'], ['sale', 'Kebutuhan penjualan (lini Penjualan)']].map(([g, gl]) => { const G = cats.filter((c) => guessLine('out', c) === g); return G.length ? `<optgroup label="${gl}">${G.map((c) => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</optgroup>` : ''; }).join('') : cats.map((c) => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join(''))}</select><small class="muted">Lini usaha terisi otomatis sesuai jenisnya.</small></div></div>
      <div class="notice amber" id="rsWarn" hidden style="margin-bottom:12px"><i class="fa-solid fa-triangle-exclamation"></i><div><b>Mau mencatat restock / beli barang?</b> Pakai <a class="link" href="${url('admin/barang')}">Data Barang → Restock</a> supaya stok &amp; unit ikut bertambah dan pengeluaran tidak tercatat dua kali. Catat di sini hanya untuk pembelian di luar stok barang.</div></div>
      <div class="field"><label>Untuk lini usaha</label><select class="select" name="line">${['rent', 'sale', 'umum'].map((k) => `<option value="${k}" ${k === ln ? 'selected' : ''}>${LINE_LBL[k]}</option>`).join('')}</select><small class="muted lini-hint" id="lnHint">${LINE_HINT[ln]}</small></div>
      <div class="field"><label>Keterangan</label><input class="input" name="desc" value="${esc(e.desc)}" placeholder="${kind === 'in' ? 'Contoh: Jasa cuci tenda milik customer' : 'Contoh: Servis kompor portable'}"></div>
      <div class="field"><label>Jumlah (Rp)</label><input class="input" type="number" min="0" step="500" name="amount" value="${e.amount}"></div>
      ${isNew ? '' : '<div class="notice"><i class="fa-solid fa-clock-rotate-left"></i><div>Perubahan tercatat di histori sistem beserta nilai sebelum dan sesudahnya.</div></div>'}</form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="eSave">Simpan</button>` });
    let lnTouched = !!e.line || (isNew && LINE !== 'all');
    const lnSel = m.$('#ef').elements.line, showHint = () => { m.$('#lnHint').textContent = LINE_HINT[lnSel.value]; };
    lnSel.addEventListener('change', () => { lnTouched = true; showHint(); });
    /* Laundry, jasa tenda & ongkir antar jemput selalu masuk lini Rental: pilihan lini dikunci */
    const RENT_ONLY = /laundry|tenda|bongkar|pasang|ongkir/i;
    const lockLine = (cat) => { const lock = kind === 'in' && RENT_ONLY.test(cat); if (lock) { lnSel.value = 'rent'; m.$('#lnHint').textContent = 'Laundry, jasa tenda & ongkir antar jemput selalu masuk lini Rental.'; } else showHint(); lnSel.disabled = lock; };
    /* Ganti jenis biaya → lini ikut berubah otomatis (masih bisa diubah manual sesudahnya) */
    const warn = () => { if (kind !== 'out') return; const E0 = m.$('#ef').elements; m.$('#rsWarn').hidden = !(/pembelian barang|restock/i.test(E0.category.value) || /restock|re-stock|kulak|beli (tenda|sepatu|carrier|sleeping|barang|stok)|tambah stok/i.test(E0.desc.value)); };
    m.$('#ef').elements.category.addEventListener('change', (ev) => { lnSel.value = guessLine(kind, ev.target.value); lnTouched = false; lockLine(ev.target.value); warn(); });
    m.$('#ef').elements.desc.addEventListener('input', warn);
    if (isNew && LINE !== 'all') { const first = cats.find((c) => guessLine(kind, c) === LINE); if (first) { m.$('#ef').elements.category.value = first; lnSel.value = LINE; } }
    lockLine(m.$('#ef').elements.category.value); warn();
    m.$('#eSave').addEventListener('click', () => {
      const F = m.$('#ef'), E = F.elements;
      if (!validate(F, { date: (v) => (!v ? 'Pilih tanggal.' : ''), desc: (v) => (v.length < 3 ? 'Isi keterangan.' : ''), amount: (v) => (!(+v > 0) ? 'Jumlah harus lebih dari 0.' : '') })) return;
      const all = kind === 'in' ? DB.incomes() : DB.expenses();
      const obj = { id: e.id || DB.nextId(kind === 'in' ? 'INC' : 'EXP', all), date: E.date.value, category: E.category.value, desc: E.desc.value.trim(), amount: Math.round(+E.amount.value), line: kind === 'in' && /laundry|tenda|bongkar|pasang|ongkir/i.test(E.category.value) ? 'rent' : E.line.value };
      DB.saveFinance(kind, obj); m.close(); toast(`${label[0].toUpperCase() + label.slice(1)} disimpan.`);
      tab = kind; $$('#tabs .tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === kind)); draw();
    });
  }
  $('#range').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) setRange(b.dataset.r); });
  if ($('#tq')) $('#tq').addEventListener('input', draw);
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
  bindExport($('#exp'), () => { const f = $('#from').value, t = $('#to').value; const L = led(f, t);
    const rows = [...L.income.map((x) => [x.date, x.date.length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date), 'Pemasukan', LINE_LBL[x.line] || '', x.cat, x.ref, x.desc, x.amount, '']), ...L.expense.map((x) => [x.date, x.date.length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date), 'Pengeluaran', LINE_LBL[x.line] || '', x.cat, x.ref, x.desc, '', x.amount])]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map((r) => r.slice(1));
    return { filename: `rekap-keuangan${LINE === 'all' ? '' : '-' + LINE}-${f}_${t}`, title: LINE === 'all' ? 'Rekap Keuangan (Gabungan)' : `Rekap Keuangan · Lini ${LINE_LBL[LINE]}`, subtitle: `Periode ${D.fmtDate(f, true)} – ${D.fmtDate(t, true)}`, orientation: 'portrait',
      summary: [['Total pemasukan', L.totalIn], ['Total pengeluaran (uang keluar)', L.totalOut], ...(LINE === 'sale' || LINE === 'all' ? [['Modal barang terjual', LINE === 'all' ? L.by.sale.cogs : L.cogs]] : []), [LINE === 'all' ? 'Laba bersih toko' : LINE === 'sale' ? 'Laba penjualan (jual − modal)' : LINE === 'rent' ? 'Laba rental' : 'Selisih lini Umum', L.profit]],
      columns: [{ header: 'Tanggal' }, { header: 'Jenis' }, { header: 'Lini' }, { header: 'Kategori' }, { header: 'Ref' }, { header: 'Keterangan', width: 34 }, { header: 'Masuk', type: 'money' }, { header: 'Keluar', type: 'money' }],
      rows, foot: ['Total', '', '', '', '', `Selisih: ${rupiah(L.totalIn - L.totalOut)}`, L.totalIn, L.totalOut] }; });
  setRange(OWN ? 'month' : 'today');
  /* Pilihan lini */
  const syncLini = () => { $$('#lini [data-l]').forEach((b) => b.classList.toggle('active', b.dataset.l === LINE)); $('#liniNote').textContent = { all: 'Semua transaksi: sewa, penjualan, dan pemasukan/pengeluaran umum toko. Angka ini sama dengan tab Gabungan di Dashboard owner.', rent: 'Hanya transaksi sewa: DP, pelunasan, denda, refund DP, perawatan & perbaikan alat sewa. Selisihnya adalah laba kotor sewa, belum dikurangi biaya Umum (listrik, gaji, dll.).', sale: 'Hanya transaksi jual: pembayaran pesanan beli (online & kasir) dan pembelian/restock barang jual. Selisihnya adalah laba kotor penjualan, belum dikurangi biaya Umum.', umum: 'Pemasukan & pengeluaran yang dipakai bersama sewa & jual: operasional, promosi, listrik, gaji, dll. Laba bersih toko hanya terlihat di Gabungan.' }[LINE]; };
  $('#lini').addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; LINE = b.dataset.l; history.replaceState(null, '', LINE === 'all' ? location.pathname : '?lini=' + LINE); syncLini(); draw(); });
  syncLini();
})();

