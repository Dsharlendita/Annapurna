(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('dashboard', 'Dashboard');
  const T = D.today(); let ACT_F = 'all';
  function draw() {
    const B = DB.staffBookings(), S = DB.staffSales();
    const h = new Date().getHours();
    $('#greet').textContent = `${h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'}, ${Admin.me.name}. Berikut ringkasan operasional hari ini.${Admin.isOwner ? ' Ringkasan keuangan & bisnis ada di tab Ringkasan bisnis.' : ''}`;
    const L = Admin.ledger(T, T);
    const newToday = B.filter((b) => D.day(b.createdAt) === T).length;
    const outToday = B.filter((b) => b.out && D.day(b.out.at) === T).reduce((s, b) => s + b.items.reduce((t, i) => t + i.qty, 0), 0);
    const pickToday = B.filter((b) => b.status === 'dikonfirmasi' && b.start === T && !Ann.Svc.delivers(b)).length;
    const retToday = B.filter((b) => b.ret && D.day(b.ret.at) === T).length;
    const active = B.filter((b) => b.status === 'disewa').length;
    const dueToday = B.filter((b) => b.status === 'disewa' && b.end === T).length;
    const late = B.filter((b) => b.status === 'disewa' && b.end < T).length;
    const salesToday = S.filter((s) => D.day(s.createdAt) === T && s.status !== 'dibatalkan').length;
    const rentIn = L.income.filter((x) => x.cat !== 'Penjualan').reduce((s, x) => s + x.amount, 0);
    const saleIn = L.income.filter((x) => x.cat === 'Penjualan').reduce((s, x) => s + x.amount, 0);
    const stat = (ic, tone, label, val, d, href) => `<a class="stat" href="${href}"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${label}</small><strong>${val}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></a>`;
    const units = DB.products().filter((p) => p.rent).reduce((a, p) => ({ av: a.av + Rules.availableOn(p.id, T), out: a.out + Rules.rentedNow(p.id) }), { av: 0, out: 0 });
    const txToday = [...B.flatMap((b) => [...(b.payments || []), ...(b.refunds || [])]), ...S.flatMap((s) => s.payments || [])].filter((p) => D.day(p.at) === T).length
      + DB.expenses().filter((e) => e.status !== 'dibatalkan' && e.date === T).length + DB.incomes().filter((e) => e.status !== 'dibatalkan' && e.date === T).length;
    const salesTodo = S.filter((s) => ['diproses', 'dikemas'].includes(s.status) || s.paymentStatus === 'verifying').length;
    const { Svc, Laundry } = Ann;
    const svcToday = Admin.svcSchedule(T, T), svcTom = Admin.svcSchedule(D.addDays(T, 1), D.addDays(T, 1));
    const LD = DB.laundry(); const ldReady = LD.filter((o) => o.status === 'siap').length, ldRun = LD.filter((o) => ['diterima', 'dicuci'].includes(o.status)).length;
    const ldLate = LD.filter((o) => ['diterima', 'dicuci'].includes(o.status) && Laundry.est(o) < T).length;
    const verif = B.filter((b) => b.paymentStatus === 'dp_verifying').length;
    /* Kondisi toko: gambaran umum */
    $('#stats2').innerHTML = [
      stat('fa-person-hiking', '', 'Rental aktif', active, `${units.av} unit tersedia di toko`, 'booking?tab=disewa'),
      stat('fa-jug-detergent', ldReady || ldLate ? 'gold' : '', 'Laundry berjalan', ldRun + ldReady, `${ldReady} siap diambil${ldLate ? ` · ${ldLate} lewat estimasi` : ''}`, 'laundry'),
      /* Owner: angka uang dilihat di Ringkasan bisnis → Hari ini (tab ini khusus pekerjaan, tidak dobel) */
      Admin.isOwner ? stat('fa-chart-line', 'blue', 'Pendapatan hari ini', '<span style="font-size:15px">Lihat ringkasan →</span>', 'laba, pemasukan & pengeluaran', Admin.O('dashboard?periode=day'))
        : stat('fa-wallet', 'blue', 'Pemasukan rental hari ini', rupiah(L.by.rent.in), 'sewa, laundry & jasa tenda', 'keuangan?lini=rent'),
    ].join('');

    /* ===== Pusat tindakan: tugas dikelompokkan 3 tingkat ===== */
    const todo = []; /* {tier: urgent|today|check, ic, t, s, tag, btns: html} */
    const actBtn = (act, id, label, cls) => `<button class="btn ${cls || 'btn-primary'} btn-sm" data-act="${act}" data-id="${id}">${label}</button>`;
    const linkBtn = (href, label, cls) => `<a class="btn ${cls || 'btn-light'} btn-sm" href="${href}">${label}</a>`;
    const remBtn = (b, label) => `<button class="btn btn-wa btn-sm" data-remind="${b.id}"><i class="fa-brands fa-whatsapp"></i> ${label}</button>`;
    const hrs = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
    // Mendesak
    B.filter((b) => b.status === 'disewa' && b.end < T).forEach((b) => { const bl = UI.billOf(b); todo.push({ tier: 'urgent', ic: 'fa-triangle-exclamation', t: `${NO(b)} terlambat ${bl.late || D.diffDays(b.end, T)} hari`, s: `${b.customer.name} · ${Admin.itemsText(b)}`, tag: bl.fine ? `Denda ${rupiah(bl.fine)}` : 'Terlambat', btns: remBtn(b, 'Tagih denda') + actBtn('return', b.id, 'Catat pengembalian') }); });
    B.filter((b) => b.status === 'menunggu_konfirmasi').forEach((b) => { const pv = (b.payments || []).slice(-1)[0] || {}; const h = pv.at ? hrs(pv.at) : 0; todo.push({ tier: h >= 1 ? 'urgent' : 'today', ic: 'fa-receipt', t: `Verifikasi DP ${NO(b)}`, s: `${b.customer.name} · ${rupiah(b.dp)}`, tag: h >= 1 ? `Menunggu ${h} jam` : 'Baru masuk', btns: actBtn('detail', b.id, 'Verifikasi') }); });
    LD.filter((o) => ['diterima', 'dicuci'].includes(o.status) && Laundry.est(o) < T).forEach((o) => todo.push({ tier: 'urgent', ic: 'fa-jug-detergent', t: `Laundry ${o.no} lewat estimasi`, s: `${o.customer.name} · estimasi ${D.fmtDate(Laundry.est(o))}`, tag: 'Lewat estimasi', btns: linkBtn(UI.url('admin/laundry?id=' + o.id), 'Buka', 'btn-primary') }));
    /* Piutang: barang sudah kembali tapi sisa pembayaran belum diterima (identitas masih ditahan) */
    B.filter((b) => b.status === 'selesai' && Admin.sisa(b) > 0).forEach((b) => todo.push({ tier: 'urgent', ic: 'fa-hand-holding-dollar', t: `Sisa pembayaran ${NO(b)} belum diterima`, s: `${b.customer.name} · ${rupiah(Admin.sisa(b))}${b.piutang && b.piutang.note ? ' · ' + b.piutang.note : ''} · identitas ditahan`, tag: 'Piutang', btns: `<button class="btn btn-wa btn-sm" data-due="${b.id}"><i class="fa-brands fa-whatsapp"></i> Tagih</button>${actBtn('settle', b.id, 'Terima pelunasan')}` }));
    // Hari ini
    B.filter((b) => b.status === 'dikonfirmasi' && b.start === T && !Svc.delivers(b)).forEach((b) => todo.push({ tier: 'today', ic: 'fa-hand-holding', t: `${NO(b)} diambil hari ini`, s: `${b.customer.name} · ${Admin.itemsText(b)}`, tag: 'Ambil', btns: actBtn('pickup', b.id, 'Catat barang keluar') }));
    svcToday.forEach((e) => todo.push({ tier: 'today', ic: e.ic, t: `${e.kind} ${e.time ? 'pukul ' + Svc.fmtT(e.time) : 'hari ini'} · ${NO(e.b)}`, s: `${e.b.customer.name} · ${(e.b.deliv || {}).address || '-'}`, tag: e.type === 'antar' ? 'Antar' : 'Jemput', btns: (e.type === 'antar' && e.b.status === 'dikonfirmasi' ? actBtn('pickup', e.b.id, 'Catat barang keluar') : '') + linkBtn(UI.url('admin/kalender'), 'Jadwal') }));
    B.filter((b) => b.status === 'disewa' && b.end === T).forEach((b) => todo.push({ tier: 'today', ic: 'fa-rotate-left', t: `${NO(b)} harus kembali hari ini`, s: `${b.customer.name}${Admin.remindedToday(b) ? ' · sudah diingatkan' : ' · belum diingatkan'}`, tag: 'Kembali', btns: (Admin.remindedToday(b) ? '' : remBtn(b, 'Ingatkan')) + actBtn('return', b.id, 'Terima barang', 'btn-light') }));
    LD.filter((o) => o.status === 'siap' && !o.notifiedReady).forEach((o) => todo.push({ tier: 'today', ic: 'fa-bell', t: `Kabari customer: laundry ${o.no} siap`, s: o.customer.name, tag: 'Laundry', btns: linkBtn(UI.url('admin/laundry?id=' + o.id), 'Kabari', 'btn-wa') }));
    /* Penjualan minta diantar: ongkir belum diinput admin */
    Ann.DB.staffSales().filter((x) => Svc.isSaleDeliv(x) && !['selesai', 'dibatalkan'].includes(x.status) && x.paymentStatus !== 'unpaid' && !Svc.bill(x).ongkirSet)
      .forEach((x) => todo.push({ tier: 'today', ic: 'fa-truck-fast', t: `Isi ongkir antar ${NO(x)}`, s: `${x.customer.name} · ${(x.deliv || {}).address || '-'}`, tag: 'Diantar', btns: linkBtn(UI.url('admin/penjualan?id=' + x.id), 'Buka pesanan') }));
    // Perlu dicek
    svcTom.forEach((e) => todo.push({ tier: 'check', ic: e.ic, t: `Besok: ${e.kind.toLowerCase()} ${e.time ? Svc.fmtT(e.time) : ''} · ${NO(e.b)}`, s: `${e.b.customer.name} · siapkan barang & kendaraan`, tag: 'Besok', btns: linkBtn(UI.url('admin/kalender'), 'Jadwal') }));
    Admin.pendingRequests().forEach((r) => todo.push({ tier: 'check', ic: r.type === 'refund' ? 'fa-hand-holding-dollar' : r.type === 'extend' ? 'fa-calendar-plus' : 'fa-arrows-rotate', t: r.type === 'refund' ? `Refund DP ${NO(r.b)}` : r.type === 'extend' ? `Perpanjangan ${NO(r.b)}` : `Ganti barang ${NO(r.b)}`, s: r.b.customer.name, tag: 'Permintaan', btns: linkBtn(UI.url('admin/permintaan'), 'Proses', 'btn-primary') }));
    DB.products(true).forEach((p) => { const due = (p.units || []).filter((u) => DB.serviceDue(p, u)); if (due.length) todo.push({ tier: 'check', ic: 'fa-screwdriver-wrench', t: `Perawatan ${p.name}`, s: `${due.length} unit perlu servis: ${due.map((u) => u.code).join(', ')}`, tag: 'Servis', btns: linkBtn(UI.url('admin/barang?unit=' + p.id), 'Buka') }); });
    DB.reviews().filter((r) => !r.seen).forEach((r) => todo.push({ tier: r.rating <= 2 ? 'urgent' : 'check', ic: 'fa-star', t: `Ulasan baru ★${r.rating}${NOREF(r.refId) ? ' · ' + NOREF(r.refId) : ''}`, s: r.name, tag: r.rating <= 2 ? 'Rating rendah' : 'Ulasan', btns: linkBtn(UI.url('admin/ulasan'), 'Lihat') }));
    const TIERS = [['urgent', 'Mendesak', 'fa-circle-exclamation'], ['today', 'Hari ini', 'fa-sun'], ['check', 'Perlu dicek', 'fa-magnifying-glass']];
    const tcnt = Object.fromEntries(TIERS.map(([k]) => [k, todo.filter((x) => x.tier === k).length]));
    $('#actSub').innerHTML = todo.length ? `${todo.length} tugas · <b class="t-urgent">${tcnt.urgent} mendesak</b> · ${tcnt.today} hari ini · ${tcnt.check} perlu dicek` : 'Tidak ada tugas tertunda.';
    $('#actFilter').innerHTML = [['all', 'Semua', todo.length], ...TIERS.map(([k, l]) => [k, l, tcnt[k]])].map(([k, l, n]) => `<button type="button" class="ac-f ${k} ${ACT_F === k ? 'on' : ''}" data-f="${k}">${l} <b>${n}</b></button>`).join('');
    $('#todayChips').innerHTML = [['fa-hand-holding', 'Diambil hari ini', pickToday, 'pengembalian'], ['fa-truck-fast', 'Antar / jemput', svcToday.length, 'kalender'], ['fa-rotate-left', 'Kembali hari ini', dueToday, 'pengembalian'], ['fa-triangle-exclamation', 'Terlambat', late, 'booking'], ['fa-hourglass-half', 'DP perlu dicek', verif, 'booking?tab=menunggu_konfirmasi']]
      .map(([ic, l, n, h]) => `<a class="tc ${n ? (ic === 'fa-triangle-exclamation' ? 'bad' : 'on') : ''}" href="${h}"><i class="fa-solid ${ic}"></i><span><b>${n}</b>${l}</span></a>`).join('');
    const list = TIERS.filter(([k]) => ACT_F === 'all' || ACT_F === k).map(([k, l, ic]) => { const L = todo.filter((x) => x.tier === k); if (!L.length) return ''; return `<div class="ac-group g-${k}"><div class="ac-gh"><i class="fa-solid ${ic}"></i> ${l} <span>${L.length}</span></div>
        ${L.map((x) => `<div class="task t-${k}"><span class="tk-ic"><i class="fa-solid ${x.ic}"></i></span><div class="tk-tx"><strong>${esc(x.t)}</strong><small>${esc(x.s)}</small></div>${x.tag ? `<span class="tk-tag">${esc(x.tag)}</span>` : ''}<div class="tk-act">${x.btns}</div></div>`).join('')}</div>`; }).join('');
    $('#todo').innerHTML = list || `<div class="ac-empty"><i class="fa-solid fa-mug-hot"></i><div><b>Semua beres untuk saat ini.</b><small>Tugas baru akan muncul di sini otomatis.</small></div></div>`;

    const latestAll = B.slice().sort((a, b) => String(b.createdAt).localeCompare(a.createdAt));
    $('#latestMore').innerHTML = `<a class="btn btn-light btn-sm btn-block" href="${UI.url('admin/booking')}">Lihat semua booking (${latestAll.length}) <i class="fa-solid fa-arrow-right"></i></a>`;
    $('#latest').innerHTML = latestAll.slice(0, 40).map((b) => `<tr>
      <td class="nw"><strong>${NO(b)}</strong></td><td>${esc(b.customer.name)}</td><td class="nw">${D.fmtRange(b.start, b.end)}</td>
      <td class="num">${rupiah(b.total)}</td><td>${pill('rental', b.status)}</td><td><button class="btn btn-light btn-xs" data-act="detail" data-id="${b.id}">Detail</button></td></tr>`).join('');

    /* Booking terbaru: tinggi mengikuti isinya sendiri (10 booking terbaru), tidak ikut memanjang saat SOP di kolom kanan dibuka */
    const fitLatest = () => {
      const panel = $('#latest').closest('.panel'); if (!panel) return;
      panel.style.alignSelf = 'start';
      [...$('#latest').children].forEach((r, i) => (r.style.display = i < 6 ? '' : 'none'));
    };
    fitLatest();
    if (!window.__fitLatest) { window.__fitLatest = true; window.addEventListener('resize', () => requestAnimationFrame(fitLatest)); window.addEventListener('load', fitLatest); }

    const pick = B.filter((b) => b.status === 'dikonfirmasi' && b.start === T && !Ann.Svc.delivers(b)); /* yang diantar sudah tampil sebagai jadwal Antar */
    const due = B.filter((b) => b.status === 'disewa' && b.end <= T);
    const svcRow = (e) => `<div class="list-row"><span class="pill gold plain">${e.type === 'antar' ? 'Antar' : 'Jemput'}</span><div class="nm"><strong>${e.time ? Svc.fmtT(e.time) + ' · ' : ''}${NO(e.b)} · ${esc(e.b.customer.name)}</strong><small>${esc(e.kind)} · ${esc((e.b.deliv || {}).address || '-')}</small></div><a class="btn btn-light btn-xs" href="kalender">Jadwal</a></div>`;
    $('#today').innerHTML = (pick.length || due.length || svcToday.length) ? [
      ...svcToday.map(svcRow),
      ...pick.map((b) => `<div class="list-row"><span class="pill blue plain">Ambil</span><div class="nm"><strong>${NO(b)} · ${esc(b.customer.name)}</strong><small>${esc(Admin.itemsText(b))}</small></div><button class="btn btn-primary btn-xs" data-act="pickup" data-id="${b.id}">Catat keluar</button></div>`),
      ...due.map((b) => `<div class="list-row"><span class="pill ${b.end < T ? 'red' : 'amber'} plain">${b.end < T ? 'Terlambat' : 'Kembali'}</span><div class="nm"><strong>${NO(b)} · ${esc(b.customer.name)}</strong><small>${esc(Admin.itemsText(b))}</small></div><button class="btn btn-primary btn-xs" data-act="return" data-id="${b.id}">Terima</button></div>`),
    ].join('') : '<p class="muted" style="font-size:13.5px">Tidak ada jadwal ambil, kembali, antar, atau jemput hari ini.</p>';

    /* Sama dengan perhitungan "Produk Rental Terlaris" di beranda (periode mengikuti pengaturan owner) */
    const hb = DB.settings().homeBest || {}; const cnt = DB.rentCounts(+hb.days || 0);
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = top.length ? top[0][1] : 1;
    $('#top').innerHTML = top.map(([id, n]) => `<li><div class="bl"><span>${esc((DB.product(id) || { name: id }).name)}</span><strong>${n}×</strong></div><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></li>`).join('');

    const pins = DB.sops().filter((x) => x.pinned && x.active !== false);
    $('#sopPanel').hidden = !pins.length;
    $('#sopPin').innerHTML = pins.map((x) => `<details class="sop-mini"><summary>${esc(x.title)}</summary><p>${esc(x.body)}</p></details>`).join('');
    chart();
  }
  let ch;
  function chart() {
    /* Owner: grafik uang sudah ada di Ringkasan bisnis — tab Operasional hari ini fokus ke pekerjaan */
    if (Admin.isOwner) { const pn = $('#chart') && $('#chart').closest('.panel'); if (pn) { pn.hidden = true; pn.parentElement.style.gridTemplateColumns = '1fr'; } return; }
    const days = [...Array(7)].map((_, i) => D.rel(i - 6));
    const L = Admin.ledger(days[0], T);
    const by = (cat) => days.map((d) => L.income.filter((x) => D.day(x.date) === d && cat(x.cat)).reduce((s, x) => s + x.amount, 0));
    const data = { labels: days.map((d) => { const x = new Date(d + 'T00:00:00'); return `${D.HARI[x.getDay()]} ${x.getDate()}`; }),
      datasets: [
        { label: 'Rental (sewa, laundry & jasa)', data: by((c) => c !== 'Penjualan'), backgroundColor: '#1f4d2f', borderRadius: 6 },
        { label: 'Penjualan', data: by((c) => c === 'Penjualan'), backgroundColor: '#f2c14e', borderRadius: 6 },
      ] };
    if (!window.Chart) { $('#chart').parentElement.innerHTML = '<p class="muted">Grafik tidak dapat dimuat.</p>'; return; }
    if (ch) ch.destroy();
    ch = new Chart($('#chart'), { type: 'bar', data, options: { maintainAspectRatio: false, responsive: true,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Figtree' } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rupiah(c.raw)}` } } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: (v) => v >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : v >= 1e3 ? v / 1e3 + ' rb' : v }, grid: { color: '#eeece4' } } } } });
  }
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-remind]'); if (r) { Admin.remindWa(DB.booking(r.dataset.remind)); UI.toast('WhatsApp dibuka dengan pesan pengingat.'); draw(); } });
  document.addEventListener('click', (e) => { const du = e.target.closest('[data-due]'); if (du) { Admin.contactDue(DB.booking(du.dataset.due)); return; } const b = e.target.closest('[data-act]'); if (b) Admin.runBooking(b.dataset.act, b.dataset.id, draw); });
  draw();

  /* ---------- Tab Penjualan (dipisah dari operasional sewa) ---------- */
  function drawJual() {
    const S = DB.staffSales(), L = Admin.ledger(T, T);
    const mStart = T.slice(0, 7) + '-01';
    const stat = (ic, tone, label, val, d, href) => `<a class="stat" href="${href}"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${label}</small><strong>${val}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></a>`;
    const verif = S.filter((s) => s.paymentStatus === 'verifying'), proses = S.filter((s) => ['diproses', 'dikemas'].includes(s.status) && s.paymentStatus === 'paid'), ready = S.filter((s) => s.status === 'siap_diambil');
    const low = DB.lowStock();
    $('#saleStats').innerHTML = [
      stat('fa-hourglass-half', 'blue', 'Pembayaran perlu diverifikasi', verif.length, 'cek bukti transfer', 'penjualan'),
      stat('fa-box', 'gold', 'Perlu dikemas', proses.length, 'pembayaran sudah diterima', 'penjualan'),
      stat('fa-store', '', 'Siap diambil', ready.length, 'menunggu customer datang', 'penjualan'),
      Admin.isOwner ? stat('fa-chart-line', 'blue', 'Pesanan masuk hari ini', S.filter((s) => D.day(s.createdAt) === T && s.status !== 'dibatalkan').length, 'pendapatan: Ringkasan bisnis → Hari ini', Admin.O('dashboard?periode=day'))
        : stat('fa-wallet', 'blue', 'Pemasukan penjualan hari ini', rupiah(L.by.sale.in), `${S.filter((s) => D.day(s.createdAt) === T && s.status !== 'dibatalkan').length} pesanan masuk hari ini`, 'keuangan'),
    ].join('');
    const latest = S.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
    $('#saleLatest').innerHTML = latest.length ? latest.map((s) => `<tr><td class="nw"><strong>${NO(s)}</strong><small class="muted" style="display:block">${D.fmtDate(s.createdAt)}</small></td><td>${esc(s.customer.name)}</td><td>${esc(s.items.map((i) => `${i.qty}× ${i.name}`).join(', '))}</td><td class="num">${rupiah(s.total)}</td><td>${pill('sale', s.status)}</td><td><a class="btn btn-light btn-xs" href="${UI.url('admin/penjualan?id=' + s.id)}">Detail</a></td></tr>`).join('') : '<tr><td colspan="6" class="muted">Belum ada pesanan penjualan.</td></tr>';
    const todo = [...verif.map((s) => ({ ic: 'fa-receipt', t: `Verifikasi pembayaran ${NO(s)}`, s: `${s.customer.name} · ${rupiah(s.total)}` })), ...proses.map((s) => ({ ic: 'fa-box', t: `Kemas pesanan ${NO(s)}`, s: s.items.map((i) => `${i.qty}× ${i.name}`).join(', ') })), ...ready.map((s) => ({ ic: 'fa-store', t: `${NO(s)} siap diambil`, s: s.customer.name }))];
    $('#saleTodo').innerHTML = todo.length ? todo.slice(0, 8).map((x) => `<a class="list-row" href="${UI.url('admin/penjualan')}"><span class="ic-sm"><i class="fa-solid ${x.ic}"></i></span><div class="nm"><strong>${esc(x.t)}</strong><small>${esc(x.s)}</small></div><i class="fa-solid fa-chevron-right muted"></i></a>`).join('') : '<p class="muted" style="padding:6px 2px">Tidak ada pesanan penjualan yang perlu diproses.</p>';
    $('#saleLow').innerHTML = low.length ? low.map((p) => `<div class="list-row"><img loading="lazy" decoding="async" src="${asset(p.img)}" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover"><div class="nm"><strong>${esc(p.name)}</strong><small>Sisa ${DB.saleableStock(p)} · minimum ${p.minStock ?? 2}</small></div><span class="pill red plain">Restock</span></div>`).join('') : '<p class="muted" style="padding:6px 2px">Semua stok barang jual aman.</p>';
    const cnt = {}; S.filter((s) => s.status !== 'dibatalkan' && D.day(s.createdAt) >= mStart).forEach((s) => s.items.forEach((i) => { cnt[i.refId] = (cnt[i.refId] || 0) + i.qty; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = top.length ? top[0][1] : 1;
    $('#saleTop').innerHTML = top.length ? top.map(([id, n]) => `<li><div class="bl"><span>${esc((DB.product(id) || { name: id }).name)}</span><strong>${n} unit</strong></div><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></li>`).join('') : '<li class="muted">Belum ada penjualan bulan ini.</li>';
    $('#cntJual').textContent = (verif.length + proses.length + ready.length) || '';
  }
  const B0 = DB.staffBookings(); $('#cntSewa').textContent = (B0.filter((b) => b.paymentStatus === 'dp_verifying').length + B0.filter((b) => b.status === 'disewa' && b.end <= T).length) || '';
  drawJual();
  const showView = (v) => { $('#dashSewa').hidden = v !== 'sewa'; $('#dashJual').hidden = v !== 'jual'; $$('#dashView [data-v]').forEach((x) => x.classList.toggle('active', x.dataset.v === v)); history.replaceState(null, '', v === 'jual' ? '?tab=jual' : location.pathname); if (v === 'sewa') window.dispatchEvent(new Event('resize')); };
  $('#actFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { ACT_F = b.dataset.f; draw(); } });
  $('#dashView').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) showView(b.dataset.v); });
  if (param('tab') === 'jual') showView('jual');
})();

