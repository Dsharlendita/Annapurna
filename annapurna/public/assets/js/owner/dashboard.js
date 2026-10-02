(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, AUDIT_TYPES, D, rupiah } = Ann;
  const { $, esc, url } = UI;
  Admin.init('owner-dashboard', 'Dashboard Owner');
  const T = D.today();
  const inR = (iso, f, t) => { const d = D.day(iso || ''); return d && d >= f && d <= t; };
  const A = Admin.A, O = Admin.O;
  $('#period').value = T.slice(0, 7); $('#period').max = T.slice(0, 7);
  const h = new Date().getHours();
  $('#greet').textContent = `${h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'}, ${Admin.me.name}. Pantau kinerja bisnis dan aktivitas staff dari sini.`;

  const stat = (ic, tone, label, val, d, href) => `<a class="stat" href="${href}"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${label}</small><strong>${val}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></a>`;

  function drawBiz() {
    const period = $('#period').value || T.slice(0, 7);
    let [f, t] = Reports.monthRange(period); if (t > T) t = T;
    const B = DB.bookings(), S = DB.sales(), L = Admin.ledger(f, t);
    const rentals = B.filter((b) => inR(b.start, f, t));
    const cancelled = B.filter((b) => b.cancel && inR(b.cancel.at, f, t));
    const sales = S.filter((s) => inR(s.createdAt, f, t) && s.status !== 'dibatalkan');
    const P = DB.products(true).filter((p) => p.rent && p.active !== false);
    const avail = P.reduce((a, p) => a + Rules.availableOn(p.id, T), 0), rented = P.reduce((a, p) => a + Rules.rentedNow(p.id), 0);
    const broken = DB.products(true).filter((p) => /Rusak|Perlu Perawatan/.test(p.cond));
    const dmgReturns = B.filter((b) => b.ret && inR(b.ret.at, f, t) && /Rusak|Hilang/.test(b.ret.cond)).length;
    const net = L.totalIn - L.totalOut;
    const lbl = Reports.monthName(period);
    const prev = Reports.prevPeriod(f); const [pf, pt0] = Reports.monthRange(prev); const LP = Admin.ledger(pf, pt0);
    const cmp = (cur, old, goodUp) => { if (!old) return `<span class="fin-cmp">Belum ada data ${Reports.monthName(prev)}</span>`; const pct = Math.round(((cur - old) / Math.abs(old)) * 100); const up = pct >= 0; const good = goodUp ? up : !up;
      return `<span class="fin-cmp ${pct === 0 ? '' : good ? 'good' : 'bad'}"><i class="fa-solid ${up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${up ? '+' : ''}${pct}% dari ${Reports.monthName(prev).split(' ')[0]}</span>`; };
    const fin = (ic, tone, label, val, extra, href) => `<a class="fin-card ${tone}" href="${href}"><div class="fin-h"><span class="ic"><i class="fa-solid ${ic}"></i></span><small>${label}</small></div><strong>${val}</strong>${extra}</a>`;
    $('#fin').innerHTML = [
      fin('fa-arrow-trend-up', 'in', `Pemasukan · ${lbl}`, rupiah(L.totalIn), cmp(L.totalIn, LP.totalIn, true), A('keuangan')),
      fin('fa-arrow-trend-down', 'out', `Pengeluaran · ${lbl}`, rupiah(L.totalOut), cmp(L.totalOut, LP.totalOut, false), A('keuangan')),
      fin('fa-scale-balanced', net >= 0 ? 'net' : 'out', `Laba / selisih · ${lbl}`, `${net < 0 ? '− ' : ''}${rupiah(Math.abs(net))}`, `<span class="fin-cmp ${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? 'Surplus' : 'Defisit'} · margin ${L.totalIn ? Math.round((net / L.totalIn) * 100) : 0}%</span>`, A('laporan?type=keuangan')),
    ].join('');
    $('#tx').innerHTML = [
      stat('fa-calendar-check', '', 'Total rental', rentals.filter((b) => b.status !== 'dibatalkan').length, lbl, A('booking')),
      stat('fa-person-hiking', '', 'Rental aktif', B.filter((b) => b.status === 'disewa').length, 'sedang disewa saat ini', A('booking?tab=disewa')),
      stat('fa-bag-shopping', 'gold', 'Penjualan', sales.length, `Omzet ${rupiah(sales.filter((s) => s.paymentStatus === 'paid').reduce((a, s) => a + s.total, 0))}`, A('penjualan')),
      stat('fa-ban', 'red', 'Booking dibatalkan', cancelled.length, lbl, A('permintaan?tab=cancel')),
    ].join('');
    $('#stk').innerHTML = [
      stat('fa-boxes-stacked', 'blue', 'Barang tersedia', avail + ' unit', 'siap disewa hari ini', A('barang')),
      stat('fa-box-open', 'gold', 'Barang sedang disewa', rented + ' unit', 'di tangan penyewa', A('pengembalian')),
      stat('fa-screwdriver-wrench', 'red', 'Rusak / perawatan', broken.length + ' jenis', `${dmgReturns} pengembalian rusak bulan ini`, A('barang')),
    ].join('');
    drawStaff(f, t);
  }

  let ch;
  function drawChart() {
    const months = []; const d = new Date(T + 'T00:00:00'); d.setDate(1);
    for (let i = 5; i >= 0; i--) { const x = new Date(d); x.setMonth(x.getMonth() - i); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
    const L = months.map((m) => { const [f, t] = Reports.monthRange(m); return Admin.ledger(f, t); });
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
  drawBiz(); drawChart(); drawRekap(); drawFeed();
})();
