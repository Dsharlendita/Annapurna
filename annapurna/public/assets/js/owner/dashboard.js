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

  let VIEW = 'all', drawn = false;
  function drawBiz() {
    const period = $('#period').value || T.slice(0, 7);
    let [f, t] = Reports.monthRange(period); if (t > T) t = T;
    const B = DB.bookings(), S = DB.sales(), L = Admin.ledger(f, t);
    const rentals = B.filter((b) => inR(b.start, f, t));
    const cancelled = B.filter((b) => b.cancel && inR(b.cancel.at, f, t));
    const sales = S.filter((s) => inR(s.createdAt, f, t) && s.status !== 'dibatalkan');
    const P = DB.products(true).filter((p) => p.rent && p.active !== false);
    const avail = P.reduce((a, p) => a + Rules.availableOn(p.id, T), 0), rented = P.reduce((a, p) => a + Rules.rentedNow(p.id), 0);
    const cq = DB.careQueue();
    const dmgReturns = B.filter((b) => b.ret && inR(b.ret.at, f, t) && /Rusak|Hilang/.test(b.ret.cond)).length;
    const net = L.totalIn - L.totalOut;
    const lbl = Reports.monthName(period);
    const prev = Reports.prevPeriod(f); const [pf, pt0] = Reports.monthRange(prev); const LP = Admin.ledger(pf, pt0);
    const cmp = (cur, old, goodUp) => { if (!old) return `<span class="fin-cmp">Belum ada data ${Reports.monthName(prev)}</span>`; const pct = Math.round(((cur - old) / Math.abs(old)) * 100); const up = pct >= 0; const good = goodUp ? up : !up;
      return `<span class="fin-cmp ${pct === 0 ? '' : good ? 'good' : 'bad'}"><i class="fa-solid ${up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${up ? '+' : ''}${pct}% dari ${Reports.monthName(prev).split(' ')[0]}</span>`; };
    const fin = (ic, tone, label, val, extra, href) => `<a class="fin-card ${tone}" href="${href}"><div class="fin-h"><span class="ic"><i class="fa-solid ${ic}"></i></span><small>${label}</small></div><strong>${val}</strong>${extra}</a>`;
    /* Tampilan: Gabungan | Rental | Penjualan (data keuangan dipisah per lini bisnis) */
    const V = VIEW;
    const LIN = V === 'all' ? { in: L.totalIn, out: L.totalOut } : L.by[V];
    const LPV = V === 'all' ? { in: LP.totalIn, out: LP.totalOut } : LP.by[V];
    const netV = LIN.in - LIN.out;
    const nm = { all: '', rent: ' rental', sale: ' penjualan' }[V];
    $('#bizNote').innerHTML = V === 'all'
      ? `Total semua lini bisnis. Rental <b>${rupiah(L.by.rent.in)}</b> · Penjualan <b>${rupiah(L.by.sale.in)}</b> · Lainnya <b>${rupiah(L.by.umum.in)}</b> (pemasukan). Pengeluaran umum (operasional, promosi) hanya dihitung di Gabungan.`
      : V === 'rent' ? 'Hanya transaksi sewa: pembayaran DP/pelunasan, denda, refund DP, serta biaya perawatan & perbaikan alat sewa.'
      : 'Hanya transaksi jual: pembayaran pesanan beli dan pembelian/restock barang jual.';
    $('#fin').innerHTML = [
      fin('fa-arrow-trend-up', 'in', `Pemasukan${nm} · ${lbl}`, rupiah(LIN.in), cmp(LIN.in, LPV.in, true), A('keuangan' + (V !== 'all' ? '?lini=' + V : ''))),
      fin('fa-arrow-trend-down', 'out', `Pengeluaran${nm} · ${lbl}`, rupiah(LIN.out), cmp(LIN.out, LPV.out, false), A('keuangan?tab=out' + (V !== 'all' ? '&lini=' + V : ''))),
      fin('fa-scale-balanced', netV >= 0 ? 'net' : 'out', `Laba${nm} · ${lbl}`, `${netV < 0 ? '− ' : ''}${rupiah(Math.abs(netV))}`, `<span class="fin-cmp ${netV >= 0 ? 'good' : 'bad'}">${netV >= 0 ? 'Surplus' : 'Defisit'} · margin ${LIN.in ? Math.round((netV / LIN.in) * 100) : 0}%</span>`, A('laporan?type=keuangan')),
    ].join('');
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
    $('#stkLbl').textContent = V === 'sale' ? 'Stok barang jual' : V === 'rent' ? 'Stok barang sewa' : 'Stok barang';
    $('#stk').innerHTML = (V === 'sale' ? [
      stat('fa-boxes-stacked', 'blue', 'Stok barang jual', SP.reduce((a, p) => a + (+p.stock || 0), 0) + ' unit', `${SP.length} jenis barang`, A('barang?tab=jual')),
      stat('fa-triangle-exclamation', 'red', 'Stok menipis', lowStock.length + ' barang', lowStock.slice(0, 2).map((p) => p.name).join(', ') || 'Aman', A('barang?tab=jual')),
      stat('fa-receipt', 'gold', 'Terjual bulan ini', units + ' unit', lbl, A('penjualan')),
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
    const L = months.map((m) => { const [f, t] = Reports.monthRange(m); const x = Admin.ledger(f, t); return VIEW === 'all' ? x : { totalIn: x.by[VIEW].in, totalOut: x.by[VIEW].out }; });
    $('#chartTitle').textContent = `Pemasukan & pengeluaran${{ all: '', rent: ' rental', sale: ' penjualan' }[VIEW]} 6 bulan`;
    if (!window.Chart) { $('#chart').parentElement.innerHTML = '<p class="muted">Grafik tidak dapat dimuat.</p>'; return; }
    if (ch) ch.destroy();
    ch = new Chart($('#chart'), { data: { labels: months.map((m) => { const [y, mm] = m.split('-'); return `${D.BULAN[+mm - 1]} ${y.slice(2)}`; }),
      datasets: [
        { type: 'bar', label: 'Pemasukan', data: L.map((x) => x.totalIn), backgroundColor: '#1f4d2f', borderRadius: 6 },
        { type: 'bar', label: 'Pengeluaran', data: L.map((x) => x.totalOut), backgroundColor: '#d9644f', borderRadius: 6 },
        { type: 'line', label: 'Laba', data: L.map((x) => x.totalIn - x.totalOut), borderColor: '#f2c14e', backgroundColor: '#f2c14e', tension: .35, pointRadius: 3 },
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
    const L = DB.audits().filter((a) => a.type !== 'akses').slice(-12).reverse();
    $('#feed').innerHTML = L.length ? `<ul class="feed">${L.map((a) => { const ty = AUDIT_TYPES[a.type] || { label: a.type, tone: 'gray', icon: 'fa-circle' };
      return `<li><span class="feed-ic ${ty.tone}"><i class="fa-solid ${ty.icon}"></i></span><div><strong>${esc(a.userName)}</strong> <span class="muted">·</span> ${esc(a.action)}${(a.changes || []).length && a.changes[0].from ? `<small class="chg-inline">${esc(a.changes[0].field)}: ${esc(a.changes[0].from)} → ${esc(a.changes[0].to)}</small>` : ''}<small>${D.fmtDateTime(a.at)} · ${Admin.relTime(a.at)}</small></div></li>`; }).join('')}</ul>`
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

  $('#period').addEventListener('change', drawBiz);
  $('#bizView').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; VIEW = b.dataset.v; $$('#bizView [data-v]').forEach((x) => x.classList.toggle('active', x === b)); drawn = true; drawBiz(); });
  drawBiz(); drawChart(); drawRekap(); drawFeed();
})();
