(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, AUDIT_TYPES, D, rupiah } = Ann;
  const { $, $$, esc, url } = UI;
  Admin.init('owner-dashboard', 'Dashboard');
  const T = D.today();
  const inR = (iso, f, t) => { const d = D.day(iso || ''); return d && d >= f && d <= t; };
  const A = Admin.A, O = Admin.O;
  $('#period').value = T.slice(0, 7); $('#period').max = T.slice(0, 7);
  const h = new Date().getHours();
  $('#greet').textContent = `${h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'}, ${Admin.me.name}. Pantau kinerja bisnis dan aktivitas staff dari sini.`;

  const stat = (ic, tone, label, val, d, href) => `<a class="stat" href="${href}"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${label}</small><strong>${val}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></a>`;

  let VIEW = 'all', drawn = false; let PER = ['day', 'week', 'month'].includes(UI.param('periode')) ? UI.param('periode') : 'month';
  function drawBiz() {
    /* Periode: Hari ini · Minggu ini · Bulan (pilih bulan). Perbandingan otomatis dengan periode sebelumnya. */
    const period = $('#period').value || T.slice(0, 7);
    let f, t, lbl, pf, pt0, pmL;
    if (PER === 'day') { f = t = T; lbl = 'Hari ini'; pf = pt0 = D.addDays(T, -1); pmL = 'kemarin'; }
    else if (PER === 'week') { const dow = (new Date(T + 'T00:00:00').getDay() + 6) % 7; f = D.addDays(T, -dow); t = T; lbl = 'Minggu ini'; pf = D.addDays(f, -7); pt0 = D.addDays(t, -7); pmL = 'minggu lalu'; }
    else { [f, t] = Reports.monthRange(period); if (t > T) t = T; lbl = Reports.monthName(period); const pv = Reports.prevPeriod(f); [pf, pt0] = Reports.monthRange(pv); pmL = Reports.monthName(pv).split(' ')[0]; }
    const B = DB.staffBookings(), S = DB.staffSales(), L = Admin.ledger(f, t);
    const rentals = B.filter((b) => inR(b.start, f, t));
    const cancelled = B.filter((b) => b.cancel && inR(b.cancel.at, f, t));
    const sales = S.filter((s) => inR(s.createdAt, f, t) && s.status !== 'dibatalkan');
    const P = DB.products(true).filter((p) => p.rent && p.active !== false);
    const avail = P.reduce((a, p) => a + Rules.availableOn(p.id, T), 0), rented = P.reduce((a, p) => a + Rules.rentedNow(p.id), 0);
    const cq = DB.careQueue();
    const dmgReturns = B.filter((b) => b.ret && inR(b.ret.at, f, t) && /Rusak|Hilang/.test(b.ret.cond)).length;
    const net = L.totalIn - L.totalOut;
    const LP = Admin.ledger(pf, pt0);
    /* Perbandingan dengan bulan lalu: selisih rupiah (persen hanya bila wajar, supaya tidak muncul angka seperti +1589%) */
    const short = (n) => { const a = Math.abs(n); return a >= 1e6 ? `Rp ${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : a >= 1e3 ? `Rp ${Math.round(a / 1e3).toLocaleString('id-ID')} rb` : rupiah(a); };
    const cmp = (cur, old, goodUp) => { const pm = pmL;
      if (!old) return `<span class="fin-cmp">Belum ada data ${pm} untuk dibandingkan</span>`;
      const diff = cur - old; if (!diff) return `<span class="fin-cmp">Sama dengan ${pm}</span>`;
      const up = diff > 0; const good = goodUp ? up : !up; const pct = Math.round((diff / Math.abs(old)) * 100);
      return `<span class="fin-cmp ${good ? 'good' : 'bad'}"><i class="fa-solid ${up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${up ? 'Naik' : 'Turun'} ${short(diff)}${Math.abs(pct) <= 300 ? ` (${up ? '+' : ''}${pct}%)` : ''} dari ${pm}</span>`; };
    const fin = (ic, tone, label, val, extra, href) => `<a class="fin-card ${tone}" href="${href}"><div class="fin-h"><span class="ic"><i class="fa-solid ${ic}"></i></span><small>${label}</small></div><strong>${val}</strong>${extra}</a>`;
    /* Tampilan: Gabungan | Rental | Penjualan (data keuangan dipisah per lini bisnis) */
    const V = VIEW;
    const LIN = V === 'all' ? { in: L.totalIn, out: L.totalOut, profit: L.profit } : L.by[V];
    const LPV = V === 'all' ? { in: LP.totalIn, out: LP.totalOut, profit: LP.profit } : LP.by[V];
    /* Laba memakai logika bisnis: Rental = pemasukan; Penjualan = jual − modal barang terjual; Gabungan = laba bersih toko */
    const netV = LIN.profit;
    const nm = { all: '', rent: ' rental', sale: ' penjualan' }[V];
    const strip = `<div class="lb-strip in-card"><span class="lb-i"><small>Rental</small><b>${short(L.by.rent.profit)}</b></span><span class="lb-op">+</span><span class="lb-i"><small>Penjualan</small><b>${short(L.by.sale.profit)}</b></span><span class="lb-op">${L.by.umum.profit < 0 ? '−' : '+'}</span><span class="lb-i" title="Pemasukan lain ${rupiah(L.by.umum.in)} − pengeluaran umum ${rupiah(L.by.umum.out)}"><small>Lini Umum</small><b>${short(L.by.umum.profit)}</b><em class="lb-sub">masuk ${short(L.by.umum.in)} · keluar ${short(L.by.umum.out)}</em></span></div>`;
    const ri = (re) => L.income.filter((x) => x.line === 'rent' && re.test(x.cat)).reduce((q, x) => q + x.amount, 0);
    const box = (l, v) => `<span class="lb-i"><small>${l}</small><b>${short(v)}</b></span>`;
    const stripSale = `<div class="lb-strip in-card">${box('Pemasukan', L.by.sale.in)}<span class="lb-op">−</span>${box('Modal barang terjual', L.by.sale.cogs)}</div>`;
    const stripRent = `<div class="lb-strip in-card">${box('Sewa &amp; denda', ri(/^Rental$|^Denda$|refund/i))}<span class="lb-op">+</span>${box('Laundry', ri(/laundry/i))}<span class="lb-op">+</span>${box('Jasa tenda &amp; ongkir', ri(/tenda|bongkar|ongkir/i))}<span class="lb-op">−</span>${box('Pengeluaran', L.by.rent.out)}</div>`;
    const ob = L.by.rent.outBy || { restock: 0, care: 0, ops: 0 };
    $('#bizNote').innerHTML = V === 'all' ? 'Kartu Pemasukan &amp; Pengeluaran = uang yang benar-benar masuk/keluar (termasuk belanja stok). Laba dihitung per lini usaha.'
      : V === 'rent' ? 'Laba rental = (sewa + denda + laundry + jasa tenda + ongkir; refund DP mengurangi) − pengeluaran rental (restock barang sewa, biaya operasional &amp; kebutuhan lain, perawatan &amp; perbaikan). Catat pengeluaran dengan lini <b>Rental</b> di Keuangan.'
      : `Laba penjualan = pemasukan − modal barang terjual (harga beli × jumlah). Belanja stok tidak mengurangi laba.${L.by.sale.missingCost ? ` <b style="color:var(--red)">${L.by.sale.missingCost} transaksi memuat barang tanpa harga beli</b> (modal dihitung Rp0).` : ''}`;
    const big = `<a class="fin-card net big ${netV < 0 ? 'neg' : ''}" href="${A('laporan?type=' + (V === 'sale' ? 'penjualan' : V === 'rent' ? 'rental' : 'keuangan'))}">
        <div class="fin-h"><span class="ic"><i class="fa-solid fa-scale-balanced"></i></span><small>${V === 'all' ? 'Laba bersih toko' : 'Laba' + nm} · ${lbl}</small></div>
        <strong>${netV < 0 ? '− ' : ''}${rupiah(Math.abs(netV))}</strong>
        <span class="fin-cmp">${netV >= 0 ? 'Surplus' : 'Defisit'} · margin ${LIN.in ? Math.round((netV / LIN.in) * 100) : 0}% · ${cmp(netV, LPV.profit, true).replace(/<\/?span[^>]*>/g, '')}</span>
        ${V === 'all' ? strip : V === 'sale' ? stripSale : stripRent}</a>`;
    /* Rincian pengeluaran untuk setiap kartu (angka 0 tetap ditampilkan agar jelas tidak ada pengeluaran) */
    const brk = (rows, note) => `<span class="fin-break">${rows.map(([l, v]) => `<span>${l} <b>${short(v)}</b></span>`).join('')}</span>${note ? `<span class="fin-sub">${note}</span>` : ''}`;
    const saleRs = DB.restocks().filter((r) => r.kind !== 'rent' && r.status !== 'dibatalkan' && inR(r.date, f, t)).reduce((a, r) => a + r.qty * r.cost, 0);
    const saleOther = Math.max(0, L.by.sale.out - saleRs);
    const umCat = {}; L.expense.filter((x) => x.line === 'umum').forEach((x) => { umCat[x.cat || 'Lainnya'] = (umCat[x.cat || 'Lainnya'] || 0) + x.amount; });
    const umTop = Object.entries(umCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${esc(c)} ${short(v)}`).join(' · ');
    $('#fin').innerHTML = big + `<div class="od-fin-side">${[
      fin('fa-arrow-trend-up', 'in', `Pemasukan${nm} · ${lbl}`, rupiah(LIN.in), cmp(LIN.in, LPV.in, true), A('keuangan' + (V !== 'all' ? '?lini=' + V : ''))),
      V === 'sale' ? fin('fa-boxes-packing', 'out', `Modal barang terjual · ${lbl}`, rupiah(LIN.cogs), `<span class="fin-cmp">Harga beli × jumlah terjual · rincian di tabel bawah</span>${brk([['Restock barang jual (uang keluar)', saleRs], ...(saleOther ? [['Pengeluaran lain penjualan', saleOther]] : [])], 'Restock baru menjadi modal saat barangnya terjual, jadi tidak langsung mengurangi laba.')}`, A('laporan?type=penjualan'))
        : V === 'rent' ? fin('fa-arrow-trend-down', 'out', `Pengeluaran rental · ${lbl}`, rupiah(LIN.out), `${cmp(LIN.out, LPV.out, false)}${brk([['Restock barang rental', ob.restock], ['Belanja kebutuhan lain', ob.ops], ['Perawatan &amp; perbaikan', ob.care]])}`, A('keuangan?tab=out&lini=rent'))
        : fin('fa-arrow-trend-down', 'out', `Pengeluaran · ${lbl}`, rupiah(LIN.out), `${cmp(LIN.out, LPV.out, false)}${brk([['Rental · restock &amp; kebutuhan lain', L.by.rent.out], ['Penjualan · restock barang jual', L.by.sale.out], ['Umum · biaya operasional toko', L.by.umum.out]])}${umTop ? `<span class="fin-sub">Biaya umum terbesar: ${umTop}</span>` : ''}`, A('keuangan?tab=out')),
    ].join('')}</div>`;
    /* Tab Penjualan: rincian laba per produk (total = kartu di atas) + belanja stok bulan ini */
    $('#profitTbl').innerHTML = V !== 'sale' ? '' : (() => {
      const X = Reports.salesByProduct(f, t); const top = X.rows.slice(0, 5);
      const RS = DB.restocks().filter((r) => r.status !== 'dibatalkan' && inR(r.date, f, t)); const rsTot = RS.reduce((a, r) => a + r.qty * r.cost, 0);
      const otherBuy = Math.max(0, L.by.sale.out - rsTot);
      return `<div class="panel pt-panel"><div class="panel-h"><h3><i class="fa-solid fa-table-list"></i> Rincian laba per produk · ${lbl}</h3><a class="btn btn-light btn-xs" href="${A('laporan?type=penjualan')}">Lihat semua ${X.rows.length} produk <i class="fa-solid fa-arrow-right"></i></a></div>
        ${X.rows.length ? `<div class="table-wrap" data-no-paginate><table class="table pt-tbl"><thead><tr><th>Produk</th><th class="num">Harga beli</th><th class="num">Harga jual</th><th class="num">Terjual</th><th class="num">Total modal</th><th class="num">Total jual</th><th class="num">Laba</th><th class="num">Margin</th></tr></thead><tbody>
          ${top.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.missing ? '<small style="color:var(--red)">harga beli belum diisi</small>' : ''}</td><td class="num">${rupiah(r.costUnit)}</td><td class="num">${rupiah(r.priceUnit)}</td><td class="num">${r.qty}</td><td class="num"><small class="pt-calc">${rupiah(r.costUnit)} × ${r.qty}</small>${rupiah(r.cost)}</td><td class="num">${rupiah(r.revenue)}</td><td class="num"><b>${rupiah(r.profit)}</b></td><td class="num">${r.margin}%</td></tr>`).join('')}
          ${X.rows.length > top.length ? `<tr class="pt-more"><td colspan="8">+ ${X.rows.length - top.length} produk lainnya (laba ${rupiah(X.rows.slice(5).reduce((a, r) => a + r.profit, 0))})</td></tr>` : ''}
          </tbody><tfoot><tr><td>Total semua produk</td><td></td><td></td><td class="num">${X.total.qty} unit</td><td class="num">${rupiah(X.total.cost)}</td><td class="num">${rupiah(X.total.revenue)}</td><td class="num">${rupiah(X.total.profit)}</td><td class="num">${X.total.margin}%</td></tr></tfoot></table></div>` : '<p class="muted" style="padding:6px 0">Belum ada penjualan yang dibayar pada periode ini.</p>'}
        <div class="pt-note"><span><i class="fa-solid fa-calculator"></i> <b>Total modal</b> = harga beli × jumlah terjual, dijumlahkan per produk. <b>Laba</b> = total jual − total modal.</span></div>
        <div class="pt-restock"><div><b><i class="fa-solid fa-truck-ramp-box"></i> Uang keluar untuk restock bulan ini: ${rupiah(L.by.sale.out)}</b><small>${RS.length} kali restock (${RS.reduce((a, r) => a + r.qty, 0)} unit masuk)${otherBuy ? ` + pembelian lain ${rupiah(otherBuy)}` : ''}. Tidak mengurangi laba, karena barangnya masih tersimpan sebagai stok sampai terjual.</small></div><a class="btn btn-light btn-xs" href="${A('laporan?type=penjualan#sec-restock')}">Rincian restock</a></div>
      </div>`;
    })();
    const salesPaid = sales.filter((s) => s.paymentStatus === 'paid');
    const units = salesPaid.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0);
    const SP = DB.products(true).filter((p) => p.price && p.active !== false);
    const lowStock = SP.filter((p) => p.stock <= (p.minStock ?? 2));
    const TX = {
      all: [
        stat('fa-calendar-check', '', 'Total rental', rentals.filter((b) => b.status !== 'dibatalkan').length, lbl, A('booking')),
        stat('fa-bag-shopping', 'gold', 'Pesanan penjualan', sales.length, `Omzet ${rupiah(salesPaid.reduce((a, s) => a + s.total, 0))}`, A('penjualan')),
        stat('fa-person-hiking', '', 'Rental aktif', B.filter((b) => b.status === 'disewa').length, 'sedang disewa saat ini', A('booking?tab=disewa')),
        stat('fa-ban', 'red', 'Dibatalkan', cancelled.length + S.filter((s) => s.status === 'dibatalkan' && inR(s.createdAt, f, t)).length, `${cancelled.length} sewa · ${S.filter((s) => s.status === 'dibatalkan' && inR(s.createdAt, f, t)).length} beli`, A('permintaan?tab=cancel')),
      ],
      rent: [
        stat('fa-calendar-check', '', 'Total rental', rentals.filter((b) => b.status !== 'dibatalkan').length, lbl, A('booking')),
        stat('fa-person-hiking', '', 'Rental aktif', B.filter((b) => b.status === 'disewa').length, 'sedang disewa saat ini', A('booking?tab=disewa')),
        stat('fa-hourglass-half', 'blue', 'DP perlu diverifikasi', B.filter((b) => b.paymentStatus === 'dp_verifying').length, 'menunggu admin', A('booking?tab=menunggu_konfirmasi')),
        stat('fa-ban', 'red', 'Booking dibatalkan', cancelled.length, lbl, A('permintaan?tab=cancel')),
      ],
      sale: [
        stat('fa-bag-shopping', 'gold', 'Pesanan penjualan', sales.length, lbl, A('penjualan')),
        stat('fa-boxes-packing', '', 'Unit terjual', units, `Omzet ${rupiah(salesPaid.reduce((a, s) => a + s.total, 0))}`, A('penjualan')),
        stat('fa-hourglass-half', 'blue', 'Perlu diverifikasi', S.filter((s) => s.paymentStatus === 'verifying').length, 'bukti pembayaran baru', A('penjualan')),
        stat('fa-ban', 'red', 'Pesanan dibatalkan', S.filter((s) => s.status === 'dibatalkan' && inR(s.createdAt, f, t)).length, lbl, A('penjualan')),
      ],
    };
    $('#tx').innerHTML = TX[V].join('');
    $('#stkLbl').innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> ${V === 'sale' ? 'Stok barang jual' : V === 'rent' ? 'Stok barang sewa' : 'Stok barang'}`;
    $('#stk').innerHTML = (V === 'sale' ? [
      stat('fa-boxes-stacked', 'blue', 'Stok barang jual', SP.reduce((a, p) => a + (+p.stock || 0), 0) + ' unit', `${SP.length} jenis barang`, A('barang?tab=jual')),
      stat('fa-warehouse', 'gold', 'Nilai stok (harga beli)', rupiah(SP.reduce((a, p) => a + (+p.stock || 0) * (+p.cost || 0), 0)), `${SP.filter((p) => p.cost == null || p.cost === '').length ? SP.filter((p) => p.cost == null || p.cost === '').length + ' barang belum ada harga beli' : 'uang belanja stok yang tersimpan di gudang'}`, A('barang?jenis=jual')),
      stat('fa-triangle-exclamation', 'red', 'Stok menipis', lowStock.length + ' barang', lowStock.slice(0, 2).map((p) => p.name).join(', ') || 'Aman', A('barang?tab=jual')),
      stat('fa-receipt', 'gold', 'Unit terjual', units + ' unit', lbl, A('penjualan')),
    ] : [
      stat('fa-boxes-stacked', 'blue', 'Barang sewa tersedia', avail + ' unit', 'siap disewa hari ini', A('barang')),
      stat('fa-box-open', 'gold', 'Barang sedang disewa', rented + ' unit', 'di tangan penyewa', A('pengembalian')),
      stat('fa-soap', 'red', 'Unit dalam perawatan', (cq.cuci.length + cq.perbaikan.length) + ' unit', `${cq.cuci.length} dicuci · ${cq.perbaikan.length} diperbaiki · ${dmgReturns} kembali rusak bulan ini`, A('perawatan')),
    ]).join('');
    const dk = document.querySelector('#chartTitle + a'); if (dk) dk.href = A('keuangan' + (V !== 'all' ? '?lini=' + V : ''));
    if (typeof drawChart === 'function' && drawn) drawChart();
    drawStaff(f, t);
  }

  let ch;
  function drawChart() {
    const months = []; const d = new Date(T + 'T00:00:00'); d.setDate(1);
    for (let i = 5; i >= 0; i--) { const x = new Date(d); x.setMonth(x.getMonth() - i); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
    const L = months.map((m) => { const [f, t] = Reports.monthRange(m); const x = Admin.ledger(f, t); return VIEW === 'all' ? x : { totalIn: x.by[VIEW].in, totalOut: VIEW === 'sale' ? x.by.sale.cogs : x.by[VIEW].out, profit: x.by[VIEW].profit }; });
    $('#chartTitle').textContent = `Pemasukan & pengeluaran${{ all: '', rent: ' rental', sale: ' penjualan' }[VIEW]} 6 bulan`;
    if (!window.Chart) { $('#chart').parentElement.innerHTML = '<p class="muted">Grafik tidak dapat dimuat.</p>'; return; }
    if (ch) ch.destroy();
    ch = new Chart($('#chart'), { data: { labels: months.map((m) => { const [y, mm] = m.split('-'); return `${D.BULAN[+mm - 1]} ${y.slice(2)}`; }),
      datasets: [
        { type: 'bar', label: 'Pemasukan', data: L.map((x) => x.totalIn), backgroundColor: '#1f4d2f', borderRadius: 6 },
        { type: 'bar', label: 'Pengeluaran', data: L.map((x) => x.totalOut), backgroundColor: '#d9644f', borderRadius: 6 },
        { type: 'line', label: 'Laba', data: L.map((x) => x.profit), borderColor: '#f2c14e', backgroundColor: '#f2c14e', tension: .35, pointRadius: 3 },
      ] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rupiah(c.raw)}` } } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : Math.abs(v) >= 1e3 ? v / 1e3 + ' rb' : v }, grid: { color: '#eeece4' } } } } });
  }

  function drawRekap() {
    const ig = DB.settings().integration || {};
    const last = DB.archives()[0];
    const next = new Date(); next.setDate(1); next.setMonth(next.getMonth() + 1); next.setDate(ig.sendDay || 1);
    const prev = Reports.prevPeriod();
    $('#rekap').innerHTML = `
      <div class="kv"><span>Status</span>${ig.autoMonthly && ig.driveConnected ? '<span class="pill green">Otomatis aktif</span>' : '<span class="pill gray">Nonaktif</span>'}</div>
      <div class="kv"><span>Penerima</span><span>${esc(ig.ownerEmail || '-')}</span></div>
      <div class="kv"><span>Jadwal berikutnya</span><span>${D.fmtDate(D.toISO(next), true)}, ${esc(ig.sendTime || '06:00')}</span></div>
      <div class="kv"><span>Rekap terakhir</span><span>${last ? `${Reports.monthName(last.period)} · ${D.fmtDateTime(last.createdAt)}` : 'Belum ada'}</span></div>
      ${last ? `<a class="drive-chip" href="${O('integrasi?folder=' + last.period)}"><i class="fa-solid fa-folder"></i><span><strong>${esc(Reports.folderName(last.period))}</strong><small>${last.files.length} file PDF · ${esc(last.path.slice(0, 2).join(' / '))}</small></span></a>` : ''}
      ${DB.archive(prev) ? '' : `<button class="btn btn-primary btn-sm btn-block" id="genPrev" style="margin-top:12px"><i class="fa-solid fa-cloud-arrow-up"></i> Buat rekap ${Reports.monthName(prev)} sekarang</button>`}`;
    const g = $('#genPrev'); if (g) g.addEventListener('click', () => { Reports.generateMonthly(prev); UI.toast(`Rekap ${Reports.monthName(prev)} dibuat dan email terkirim.`); drawRekap(); drawFeed(); });
  }

  function drawFeed() {
    const L = DB.audits().filter((a) => a.type !== 'akses').slice(-6).reverse(); /* ringkas: 6 aktivitas terakhir, sisanya di Histori sistem */
    $('#feed').innerHTML = L.length ? `<ul class="feed">${L.map((a) => { const ty = AUDIT_TYPES[a.type] || { label: a.type, tone: 'gray', icon: 'fa-circle' };
      return `<li><span class="feed-ic ${ty.tone}"><i class="fa-solid ${ty.icon}"></i></span><div><strong>${esc(a.userName)}</strong> <span class="muted">·</span> ${esc(NOTXT(a.action))}${(a.changes || []).length && a.changes[0].from ? `<small class="chg-inline">${esc(a.changes[0].field)}: ${esc(a.changes[0].from)} → ${esc(a.changes[0].to)}</small>` : ''}<small>${D.fmtDateTime(a.at)} · ${Admin.relTime(a.at)}</small></div></li>`; }).join('')}</ul>`
      : '<p class="muted">Belum ada aktivitas.</p>';
  }

  function drawStaff(f, t) {
    const acts = DB.audits().filter((a) => a.type !== 'akses' && inR(a.at, f, t));
    const L = DB.staff().sort((a, b) => (a.status === 'nonaktif') - (b.status === 'nonaktif') || String(b.lastLogin || '').localeCompare(a.lastLogin || ''));
    const on = L.filter((u) => Admin.presence(u).key === 'on').length;
    $('#staff').innerHTML = `<p class="muted" style="font-size:13px;margin-bottom:6px">${on} staff sedang login · aktivitas dihitung untuk periode terpilih</p>` + L.map((u) => {
      const p = Admin.presence(u); const n = acts.filter((a) => a.userId === u.id).length;
      return `<div class="list-row"><span class="av-dot ${p.key}">${esc(u.name.charAt(0))}</span><div class="nm"><strong>${esc(u.name)}</strong> <span class="pill ${u.role === 'owner' ? 'amber' : 'gray'} plain">${esc(DB.ROLE_LABEL[u.role])}</span><small>${p.label} · login terakhir ${u.lastLogin ? Admin.relTime(u.lastLogin) : 'belum pernah'}</small></div><a class="btn btn-light btn-xs" href="${O('histori?staff=' + u.id)}" title="Lihat histori">${n} aktivitas</a></div>`;
    }).join('');
  }

  $('#period').addEventListener('change', () => { PER = 'month'; syncPer(); drawBiz(); });
  function syncPer() { $$('#perMode [data-per]').forEach((b) => b.classList.toggle('active', b.dataset.per === PER)); $('#period').closest('.od-period').classList.toggle('dim', PER !== 'month'); }
  $('#perMode').addEventListener('click', (e) => { const b = e.target.closest('[data-per]'); if (!b) return; PER = b.dataset.per; history.replaceState(null, '', PER === 'month' ? location.pathname : '?periode=' + PER); syncPer(); drawBiz(); });
  syncPer();
  $('#bizView').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; VIEW = b.dataset.v; $$('#bizView [data-v]').forEach((x) => x.classList.toggle('active', x === b)); drawn = true; drawBiz(); });
  drawBiz(); drawChart(); drawRekap(); drawFeed();
})();
