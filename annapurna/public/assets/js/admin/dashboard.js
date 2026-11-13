(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah, Svc, Laundry } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('dashboard', 'Dashboard');
  const T = D.today(); let ACT_F = 'all';
  const ACT_MAX = 4; const ACT_OPEN = {}; /* grup tugas yang dibentangkan penuh lewat "Tampilkan lainnya" */
  let SRV_SVC = []; /* jadwal antar / jemput / bongkar pasang dari server (GET api/admin/layanan) */

  /* ---------- Pembantu tampilan (dipakai tab Sewa & tab Laundry) ---------- */
  const TIERS = [['urgent', 'Mendesak'], ['today', 'Hari ini'], ['check', 'Perlu dicek']];
  const taskRow = (x, k) => `<div class="task t-${k}"><span class="tk-ic"><i class="fa-solid ${x.ic}"></i></span><div class="tk-tx"><strong>${esc(x.t)}</strong><small>${esc(x.s)}</small></div>${x.tag ? `<span class="tk-tag">${esc(x.tag)}</span>` : ''}<div class="tk-act">${x.btns}</div></div>`;
  /* Daftar tugas per tingkat. Tiap grup menampilkan ACT_MAX baris dulu supaya daftar tetap ringkas. */
  function taskGroups(list, scope, filter) {
    return TIERS.filter(([k]) => filter === 'all' || filter === k).map(([k, label]) => {
      const L = list.filter((x) => x.tier === k); if (!L.length) return '';
      const key = scope + ':' + k, open = !!ACT_OPEN[key], shown = open ? L : L.slice(0, ACT_MAX);
      return `<div class="ac-group g-${k}"><div class="ac-gh">${label} <span>${L.length}</span></div>${shown.map((x) => taskRow(x, k)).join('')}${L.length > ACT_MAX ? `<button type="button" class="ac-more" data-more="${key}" aria-expanded="${open}">${open ? 'Ringkas daftar' : `Tampilkan ${L.length - ACT_MAX} lainnya`}</button>` : ''}</div>`;
    }).join('');
  }
  const actEmpty = (t, s) => `<div class="ac-empty"><i class="fa-solid fa-mug-hot"></i><div><b>${t}</b><small>${s}</small></div></div>`;
  const tierCount = (list) => Object.fromEntries(TIERS.map(([k]) => [k, list.filter((x) => x.tier === k).length]));
  const statCard = (ic, tone, label, val, d, href) => `<a class="stat" href="${href}"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${label}</small><strong>${val}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></a>`;
  const actBtn = (act, id, label, cls) => `<button class="btn ${cls || 'btn-primary'} btn-sm" data-act="${act}" data-id="${id}">${label}</button>`;
  const linkBtn = (href, label, cls) => `<a class="btn ${cls || 'btn-light'} btn-sm" href="${href}">${label}</a>`;

  /* ---------- Jadwal lapangan: antar / jemput & jasa bongkar pasang ----------
     Sumber utama = data di perangkat ini (sama dengan halaman Kalender). Jadwal dari server hanya ditambahkan
     untuk booking yang belum ada di perangkat ini, supaya tidak dobel dan tidak menimpa data lokal. */
  function fieldSchedule(from, to) {
    const local = Admin.svcSchedule(from, to).map((e) => { const bl = Svc.bill(e.b), d = e.b.deliv || {};
      return { type: e.type, date: e.date, time: e.time, kind: e.kind, tent: Svc.isTent(e.b), id: e.b.id, ref: NO(e.b), name: e.b.customer.name, phone: e.b.customer.phone,
        address: d.address || '', tents: d.tents || 0, due: bl.due, ongkirSet: bl.ongkirSet, canPickup: e.type === 'antar' && e.b.status === 'dikonfirmasi', remote: false }; });
    const have = new Set(DB.bookings().flatMap((b) => [b.id, b.no, b.booking_code]).filter(Boolean));
    const remote = SRV_SVC.filter((r) => r.date >= from && r.date <= to && !have.has(r.booking_code) && !have.has(r.nota_no))
      .map((r) => ({ type: r.type, date: r.date, time: r.time, kind: r.kind, tent: !!r.tent, id: r.booking_code, ref: r.nota_no || r.booking_code, name: r.customer_name, phone: r.customer_phone,
        address: r.address || '', tents: r.tents || 0, due: r.due || 0, ongkirSet: !!r.ongkir_set, canPickup: false, remote: true }));
    return [...local, ...remote].sort((a, c) => (a.date + (a.time || '')).localeCompare(c.date + (c.time || '')));
  }
  const dayShort = (d) => { const x = new Date(d + 'T00:00:00'); return `${D.HARI[x.getDay()]}, ${D.fmtDate(d).replace(/ \d{4}$/, '')}`; };
  const waSched = (e) => UI.waLink(`Halo ${e.name}, kami dari Annapurna Adventure ingin mengonfirmasi jadwal ${e.kind.toLowerCase()} untuk ${e.ref} pada ${D.fmtDate(e.date, true)}${e.time ? ' pukul ' + Svc.fmtT(e.time) : ''} di ${e.address || '-'}. Terima kasih.`, e.phone);
  function drawField() {
    const ev = fieldSchedule(T, D.addDays(T, 6)), tom = D.addDays(T, 1);
    const antarIds = new Set(ev.filter((e) => e.type === 'antar').map((e) => e.id));
    const row = (e) => {
      const showDue = e.due > 0 && (e.type === 'antar' || !antarIds.has(e.id)); /* sisa tagihan layanan cukup tampil sekali per booking */
      const main = e.canPickup ? `<button type="button" class="btn btn-primary btn-xs" data-act="pickup" data-id="${esc(e.id)}">Catat keluar</button>`
        : e.remote ? '' : `<a class="btn btn-light btn-xs" href="${url('admin/booking?id=' + encodeURIComponent(e.id))}">Buka</a>`;
      return `<div class="sv-row"><div class="sv-time">${e.time ? Svc.fmtT(e.time) : '—'}</div>
        <div class="sv-body"><div class="sv-tags"><span class="sv-tag ${e.type}">${esc(e.kind)}</span>${e.tent && e.tents ? `<span class="sv-tag">${e.tents} tenda</span>` : ''}${showDue ? `<span class="sv-tag warn">Sisa ${rupiah(e.due)}</span>` : ''}${e.type === 'antar' && !e.ongkirSet ? '<span class="sv-tag warn">Ongkir belum diisi</span>' : ''}</div>
          <strong>${esc(e.name)} <span class="muted">· ${esc(e.ref)}</span></strong><small><i class="fa-solid fa-location-dot"></i>${esc(e.address || 'Alamat belum diisi')}</small></div>
        <div class="sv-act"><a class="btn btn-light btn-xs sv-wa" href="${waSched(e)}" target="_blank" rel="noopener" title="Konfirmasi via WhatsApp" aria-label="Konfirmasi via WhatsApp ke ${esc(e.name)}"><i class="fa-brands fa-whatsapp"></i></a>${main}</div></div>`;
    };
    const panel = (list, host, subHost, empty) => {
      const nT = list.filter((e) => e.date === T).length, nB = list.filter((e) => e.date === tom).length;
      $(subHost).textContent = list.length ? `${nT} hari ini · ${nB} besok · ${list.length} dalam 7 hari` : 'Tidak ada jadwal 7 hari ke depan';
      const shown = list.slice(0, 6); let out = '', last = '';
      shown.forEach((e) => { if (e.date !== last) { last = e.date; out += `<div class="sv-day ${e.date === T ? 'now' : ''}">${e.date === T ? 'Hari ini' : e.date === tom ? 'Besok' : dayShort(e.date)}${e.date === T || e.date === tom ? `<small>${dayShort(e.date)}</small>` : ''}</div>`; } out += row(e); });
      if (list.length > shown.length) out += `<a class="sv-more" href="${url('admin/kalender')}">+${list.length - shown.length} jadwal lainnya di Kalender <i class="fa-solid fa-arrow-right"></i></a>`;
      $(host).innerHTML = list.length ? out : `<div class="sv-empty"><i class="fa-regular fa-calendar-check"></i>${empty}</div>`;
    };
    panel(ev.filter((e) => !e.tent), '#svcAntar', '#svcASub', 'Belum ada barang yang perlu diantar atau dijemput.');
    panel(ev.filter((e) => e.tent), '#svcTenda', '#svcTSub', 'Belum ada tenda yang perlu dipasang atau dibongkar.');
  }

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
    const units = DB.products().filter((p) => p.rent).reduce((a, p) => ({ av: a.av + Rules.availableOn(p.id, T), out: a.out + Rules.rentedNow(p.id) }), { av: 0, out: 0 });
    const txToday = [...B.flatMap((b) => [...(b.payments || []), ...(b.refunds || [])]), ...S.flatMap((s) => s.payments || [])].filter((p) => D.day(p.at) === T).length
      + DB.expenses().filter((e) => e.status !== 'dibatalkan' && e.date === T).length + DB.incomes().filter((e) => e.status !== 'dibatalkan' && e.date === T).length;
    const salesTodo = S.filter((s) => ['diproses', 'dikemas'].includes(s.status) || s.paymentStatus === 'verifying').length;
    const svcToday = fieldSchedule(T, T);
    const LD = DB.laundry(); const ldReady = LD.filter((o) => o.status === 'siap').length, ldRun = LD.filter((o) => ['diterima', 'dicuci'].includes(o.status)).length;
    const ldLate = LD.filter((o) => ['diterima', 'dicuci'].includes(o.status) && Laundry.est(o) < T).length;
    const verif = B.filter((b) => b.paymentStatus === 'dp_verifying').length;
    /* Kondisi toko: gambaran umum */
    $('#stats2').innerHTML = [
      statCard('fa-person-hiking', '', 'Rental aktif', active, `${units.av} unit tersedia di toko`, 'booking?tab=disewa'),
      statCard('fa-jug-detergent', ldReady || ldLate ? 'gold' : '', 'Laundry berjalan', ldRun + ldReady, `${ldReady} siap diambil${ldLate ? ` · ${ldLate} lewat estimasi` : ''}`, 'laundry'),
      /* Owner: angka uang dilihat di Ringkasan bisnis → Hari ini (tab ini khusus pekerjaan, tidak dobel) */
      Admin.isOwner ? statCard('fa-chart-line', 'blue', 'Pendapatan hari ini', '<span style="font-size:15px">Lihat ringkasan →</span>', 'laba, pemasukan & pengeluaran', Admin.O('dashboard?periode=day'))
        : statCard('fa-wallet', 'blue', 'Pemasukan rental hari ini', rupiah(L.by.rent.in), 'sewa, laundry & jasa tenda', 'keuangan?lini=rent'),
    ].join('');

    /* ===== Pusat tindakan: tugas dikelompokkan 3 tingkat ===== */
    const todo = []; /* {tier: urgent|today|check, ic, t, s, tag, btns: html} */
    const remBtn = (b, label) => `<button class="btn btn-wa btn-sm" data-remind="${b.id}"><i class="fa-brands fa-whatsapp"></i> ${label}</button>`;
    const hrs = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
    // Mendesak
    B.filter((b) => b.status === 'disewa' && b.end < T).forEach((b) => { const bl = UI.billOf(b); todo.push({ tier: 'urgent', ic: 'fa-triangle-exclamation', t: `${NO(b)} terlambat ${bl.late || D.diffDays(b.end, T)} hari`, s: `${b.customer.name} · ${Admin.itemsText(b)}`, tag: bl.fine ? `Denda ${rupiah(bl.fine)}` : 'Terlambat', btns: remBtn(b, 'Tagih denda') + actBtn('return', b.id, 'Catat pengembalian') }); });
    B.filter((b) => b.status === 'menunggu_konfirmasi').forEach((b) => { const pv = (b.payments || []).slice(-1)[0] || {}; const hh = pv.at ? hrs(pv.at) : 0; todo.push({ tier: hh >= 1 ? 'urgent' : 'today', ic: 'fa-receipt', t: `Verifikasi DP ${NO(b)}`, s: `${b.customer.name} · ${rupiah(b.dp)}`, tag: hh >= 1 ? `Menunggu ${hh} jam` : 'Baru masuk', btns: actBtn('detail', b.id, 'Verifikasi') }); });
    LD.filter((o) => ['diterima', 'dicuci'].includes(o.status) && Laundry.est(o) < T).forEach((o) => todo.push({ tier: 'urgent', ic: 'fa-jug-detergent', t: `Laundry ${o.no} lewat estimasi`, s: `${o.customer.name} · estimasi ${D.fmtDate(Laundry.est(o))}`, tag: 'Lewat estimasi', btns: linkBtn(UI.url('admin/laundry?id=' + o.id), 'Buka', 'btn-primary') }));
    /* Piutang: barang sudah kembali tapi sisa pembayaran belum diterima (identitas masih ditahan) */
    B.filter((b) => b.status === 'selesai' && Admin.sisa(b) > 0).forEach((b) => todo.push({ tier: 'urgent', ic: 'fa-hand-holding-dollar', t: `Sisa pembayaran ${NO(b)} belum diterima`, s: `${b.customer.name} · ${rupiah(Admin.sisa(b))}${b.piutang && b.piutang.note ? ' · ' + b.piutang.note : ''} · identitas ditahan`, tag: 'Piutang', btns: `<button class="btn btn-wa btn-sm" data-due="${b.id}"><i class="fa-brands fa-whatsapp"></i> Tagih</button>${actBtn('settle', b.id, 'Terima pelunasan')}` }));
    // Hari ini
    B.filter((b) => b.status === 'dikonfirmasi' && b.start === T && !Svc.delivers(b)).forEach((b) => todo.push({ tier: 'today', ic: 'fa-hand-holding', t: `${NO(b)} diambil hari ini`, s: `${b.customer.name} · ${Admin.itemsText(b)}`, tag: 'Ambil', btns: actBtn('pickup', b.id, 'Catat barang keluar') }));
    /* Antar / jemput & bongkar pasang tidak lagi dicampur di sini: punya seksi sendiri tepat di bawah (jadwal 7 hari + aksi) */
    B.filter((b) => b.status === 'disewa' && b.end === T).forEach((b) => todo.push({ tier: 'today', ic: 'fa-rotate-left', t: `${NO(b)} harus kembali hari ini`, s: `${b.customer.name}${Admin.remindedToday(b) ? ' · sudah diingatkan' : ' · belum diingatkan'}`, tag: 'Kembali', btns: (Admin.remindedToday(b) ? '' : remBtn(b, 'Ingatkan')) + actBtn('return', b.id, 'Terima barang', 'btn-light') }));
    LD.filter((o) => o.status === 'siap' && !o.notifiedReady).forEach((o) => todo.push({ tier: 'today', ic: 'fa-bell', t: `Kabari customer: laundry ${o.no} siap`, s: o.customer.name, tag: 'Laundry', btns: linkBtn(UI.url('admin/laundry?id=' + o.id), 'Kabari', 'btn-wa') }));
    /* Penjualan minta diantar: ongkir belum diinput admin */
    Ann.DB.staffSales().filter((x) => Svc.isSaleDeliv(x) && !['selesai', 'dibatalkan'].includes(x.status) && x.paymentStatus !== 'unpaid' && !Svc.bill(x).ongkirSet)
      .forEach((x) => todo.push({ tier: 'today', ic: 'fa-truck-fast', t: `Isi ongkir antar ${NO(x)}`, s: `${x.customer.name} · ${(x.deliv || {}).address || '-'}`, tag: 'Diantar', btns: linkBtn(UI.url('admin/penjualan?id=' + x.id), 'Buka pesanan') }));
    // Perlu dicek
    Admin.pendingRequests().forEach((r) => todo.push({ tier: 'check', ic: r.type === 'refund' ? 'fa-hand-holding-dollar' : r.type === 'extend' ? 'fa-calendar-plus' : 'fa-arrows-rotate', t: r.type === 'refund' ? `Refund DP ${NO(r.b)}` : r.type === 'extend' ? `Perpanjangan ${NO(r.b)}` : `Ganti barang ${NO(r.b)}`, s: r.b.customer.name, tag: 'Permintaan', btns: linkBtn(UI.url('admin/permintaan'), 'Proses', 'btn-primary') }));
    DB.products(true).forEach((p) => { const due = (p.units || []).filter((u) => DB.serviceDue(p, u)); if (due.length) todo.push({ tier: 'check', ic: 'fa-screwdriver-wrench', t: `Perawatan ${p.name}`, s: `${due.length} unit perlu servis: ${due.map((u) => u.code).join(', ')}`, tag: 'Servis', btns: linkBtn(UI.url('admin/barang?unit=' + p.id), 'Buka') }); });
    DB.reviews().filter((r) => !r.seen).forEach((r) => todo.push({ tier: r.rating <= 2 ? 'urgent' : 'check', ic: 'fa-star', t: `Ulasan baru ★${r.rating}${NOREF(r.refId) ? ' · ' + NOREF(r.refId) : ''}`, s: r.name, tag: r.rating <= 2 ? 'Rating rendah' : 'Ulasan', btns: linkBtn(UI.url('admin/ulasan'), 'Lihat') }));
    const tcnt = tierCount(todo);
    $('#actSub').innerHTML = todo.length ? `${todo.length} tugas · <b class="t-urgent">${tcnt.urgent} mendesak</b> · ${tcnt.today} hari ini · ${tcnt.check} perlu dicek` : 'Tidak ada tugas tertunda.';
    $('#actFilter').innerHTML = [['all', 'Semua', todo.length], ...TIERS.map(([k, l]) => [k, l, tcnt[k]])].map(([k, l, n]) => `<button type="button" class="ac-f ${k} ${k === 'urgent' && n ? 'has' : ''} ${ACT_F === k ? 'on' : ''}" data-f="${k}" aria-pressed="${ACT_F === k}">${l} <b>${n}</b></button>`).join('');
    $('#todayChips').innerHTML = [['Diambil hari ini', pickToday, 'pengembalian'], ['Antar & jemput', svcToday.filter((e) => !e.tent).length, '#svcSec'], ['Bongkar pasang', svcToday.filter((e) => e.tent).length, '#svcSec'], ['Kembali hari ini', dueToday, 'pengembalian'], ['Terlambat', late, 'booking', 1], ['DP perlu dicek', verif, 'booking?tab=menunggu_konfirmasi']]
      .map(([l, n, href, bad]) => `<a class="tc ${n ? (bad ? 'bad' : '') : 'zero'}" href="${href}"><b>${n}</b><span>${l}</span></a>`).join('');
    $('#todo').innerHTML = taskGroups(todo, 'sewa', ACT_F) || actEmpty('Semua beres untuk saat ini.', 'Tugas baru akan muncul di sini otomatis.');

    drawField();

    /* "Booking terbaru" & "Jadwal hari ini" dihapus dari dashboard: isinya sudah ada di Perlu tindakan & menu Booking Rental */
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
  /* "Tampilkan N lainnya" pada grup tugas (tab Sewa & Laundry) */
  document.addEventListener('click', (e) => { const m = e.target.closest('[data-more]'); if (!m) return; ACT_OPEN[m.dataset.more] = !ACT_OPEN[m.dataset.more]; draw(); drawLaundry(); });
  draw();

  /* ---------- Tab Penjualan (dipisah dari operasional sewa) ---------- */
  function drawJual() {
    const S = DB.staffSales(), L = Admin.ledger(T, T);
    const mStart = T.slice(0, 7) + '-01';
    const stat = statCard;
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

  /* ---------- Tab Laundry ---------- */
  function drawLaundry() {
    const LD = DB.laundry(); const ACTIVE = ['diterima', 'dicuci', 'siap'];
    const act = LD.filter((o) => ACTIVE.includes(o.status));
    const rem = (o) => Math.max(0, Laundry.total(o) - Laundry.paid(o));
    const est = (o) => D.day(Laundry.est(o));
    const unpaid = LD.filter((o) => o.status !== 'dibatalkan' && rem(o) > 0);
    const nRecv = act.filter((o) => o.status === 'diterima').length, nWash = act.filter((o) => o.status === 'dicuci').length, nReady = act.filter((o) => o.status === 'siap').length;
    const nLate = act.filter((o) => o.status !== 'siap' && est(o) < T).length, nUnnotified = act.filter((o) => o.status === 'siap' && !o.notifiedReady).length;
    $('#ldStats').innerHTML = [
      statCard('fa-inbox', 'blue', 'Diterima', nRecv, 'belum mulai dicuci', 'laundry?tab=diterima'),
      statCard('fa-jug-detergent', '', 'Sedang dicuci', nWash, nLate ? `${nLate} lewat estimasi` : 'sesuai estimasi', 'laundry?tab=dicuci'),
      statCard('fa-bag-shopping', 'gold', 'Siap diambil', nReady, nUnnotified ? `${nUnnotified} belum dikabari` : 'semua sudah dikabari', 'laundry?tab=siap'),
      statCard('fa-hourglass-half', 'red', 'Belum lunas', unpaid.length, unpaid.length ? `sisa ${rupiah(unpaid.reduce((s, o) => s + rem(o), 0))}` : 'tidak ada tagihan', 'laundry'),
    ].join('');

    /* Tombol langkah berikutnya mengikuti status pesanan */
    const next = (o) => o.status === 'diterima' ? `<button type="button" class="btn btn-primary btn-sm" data-ldact="dicuci" data-id="${esc(o.id)}">Mulai dicuci</button>`
      : o.status === 'dicuci' ? `<button type="button" class="btn btn-primary btn-sm" data-ldact="siap" data-id="${esc(o.id)}">Tandai siap</button>`
        : rem(o) > 0 ? linkBtn(UI.url('admin/laundry?id=' + encodeURIComponent(o.id)), 'Buka & terima bayar', 'btn-primary')
          : `<button type="button" class="btn btn-primary btn-sm" data-ldact="selesai" data-id="${esc(o.id)}">Tandai diambil</button>`;
    const todo = []; const who = (o) => `${o.customer.name} · ${Admin.ldItems(o)}`;
    act.filter((o) => o.status !== 'siap' && est(o) < T).forEach((o) => todo.push({ tier: 'urgent', ic: 'fa-jug-detergent', t: `${o.no} lewat estimasi`, s: `${who(o)} · estimasi ${D.fmtDate(est(o))}`, tag: 'Lewat estimasi', btns: next(o) }));
    act.filter((o) => o.status === 'siap' && !o.notifiedReady).forEach((o) => todo.push({ tier: 'today', ic: 'fa-bell', t: `Kabari customer: ${o.no} siap diambil`, s: who(o), tag: 'Belum dikabari', btns: `<button type="button" class="btn btn-wa btn-sm" data-ldact="notify" data-id="${esc(o.id)}"><i class="fa-brands fa-whatsapp"></i> Kabari</button>` }));
    act.filter((o) => o.status !== 'siap' && est(o) === T).forEach((o) => todo.push({ tier: 'today', ic: 'fa-calendar-day', t: `${o.no} estimasi selesai hari ini`, s: who(o), tag: o.status === 'dicuci' ? 'Sedang dicuci' : 'Belum dicuci', btns: next(o) }));
    act.filter((o) => o.status === 'siap' && o.notifiedReady).forEach((o) => todo.push({ tier: 'check', ic: 'fa-bag-shopping', t: `${o.no} menunggu diambil`, s: `${who(o)}${rem(o) > 0 ? ' · sisa ' + rupiah(rem(o)) : ''}`, tag: rem(o) > 0 ? 'Belum lunas' : 'Menunggu diambil', btns: next(o) }));
    act.filter((o) => o.status === 'diterima' && est(o) > T).forEach((o) => todo.push({ tier: 'check', ic: 'fa-inbox', t: `${o.no} belum mulai dicuci`, s: `${who(o)} · estimasi ${D.fmtDate(est(o))}`, tag: 'Diterima', btns: next(o) }));
    const tc = tierCount(todo);
    $('#ldSub').innerHTML = todo.length ? `${todo.length} tugas · <b class="t-urgent">${tc.urgent} mendesak</b> · ${tc.today} hari ini · ${tc.check} perlu dicek` : 'Tidak ada tugas laundry tertunda.';
    $('#ldTodo').innerHTML = taskGroups(todo, 'laundry', 'all') || actEmpty('Semua laundry beres.', 'Pesanan baru dari Kasir akan muncul di sini.');
    $('#cntLaundry').textContent = (tc.urgent + tc.today) || '';

    const latest = act.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);
    $('#ldLatest').innerHTML = latest.length ? latest.map((o) => `<tr><td class="nw"><strong>${esc(o.no)}</strong><small class="muted" style="display:block">${D.fmtDate(o.createdAt)}</small></td><td>${esc(o.customer.name)}</td><td>${esc(Admin.ldItems(o))}</td><td class="nw">${D.fmtDate(est(o))}</td><td class="num">${rupiah(Laundry.total(o))}</td><td>${pill('laundry', o.status)}</td><td><a class="btn btn-light btn-xs" href="${UI.url('admin/laundry?id=' + encodeURIComponent(o.id))}">Detail</a></td></tr>`).join('') : '<tr><td colspan="7" class="muted">Tidak ada pesanan laundry yang sedang berjalan.</td></tr>';
  }
  /* Aksi cepat laundry dari dashboard: memakai fungsi yang sama dengan halaman Laundry (ikut tersimpan ke server) */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ldact]'); if (!b) return;
    const o = DB.laundryOrder(b.dataset.id); if (!o) { toast('Pesanan laundry tidak ditemukan. Muat ulang halaman.', 'err'); return; }
    o.history = o.history || []; /* pesanan hasil sinkron server belum tentu punya riwayat lokal */
    const redraw = () => { drawLaundry(); draw(); Admin.refreshShell(); }; const a = b.dataset.ldact;
    if (a === 'notify') Admin.ldNotify(o, redraw); else if (a === 'selesai') Admin.ldPickup(o, redraw); else Admin.ldAdvance(o, a, redraw);
  });

  /* ---------- Sinkron dengan backend ---------- */
  /* Laundry: GET api/admin/laundry (pesanan aktif). Digabung dengan data lokal (bukan ditimpa) supaya riwayat & catatan lokal tidak hilang. */
  async function syncLaundry() {
    const r = await Api.get('api/admin/laundry', { redirectOn401: false });
    if (!(r && r.ok && Array.isArray(r.data))) return;
    r.data.forEach((so) => {
      const id = so.order_code || 'DRY-' + so.id; const cur = DB.laundryOrder(id) || {};
      const srv = {
        id, no: so.nota_no || so.order_code, order_code: so.order_code, nota_no: so.nota_no,
        customer: { name: so.customer_name, phone: so.customer_phone, email: so.customer_email || '' },
        items: (so.items || []).map((i) => ({ id: i.laundry_item_id, name: i.item_name, cat: i.category, price: i.unit_price, qty: i.qty, custom: i.is_custom })),
        discount: so.discount_amount || 0, discountReason: so.discount_reason, notifiedReady: so.notified_ready, notes: so.notes, status: so.status, paymentStatus: so.payment_status,
        total: so.total_amount, createdAt: so.created_at, pickedAt: so.picked_at,
        payments: (so.payments || []).map((p) => ({ at: p.paid_at, amount: p.amount, type: p.payment_type, via: p.payment_method })),
      };
      if (so.est_done) srv.estDone = D.day(so.est_done); /* Laravel mengirim tanggal sebagai ISO (UTC); D.day mengembalikannya ke tanggal lokal */
      DB.saveLaundry(Object.assign({ history: [] }, cur, srv));
    });
    drawLaundry(); draw(); Admin.refreshShell();
  }
  /* Antar / jemput / bongkar pasang: GET api/admin/layanan (jadwal 7 hari ke depan) */
  async function syncServices() {
    const r = await Api.get(`api/admin/layanan?from=${T}&to=${D.addDays(T, 6)}`, { redirectOn401: false });
    if (r && r.ok && Array.isArray(r.data)) { SRV_SVC = r.data; draw(); }
  }

  const B0 = DB.staffBookings(); $('#cntSewa').textContent = (B0.filter((b) => b.paymentStatus === 'dp_verifying').length + B0.filter((b) => b.status === 'disewa' && b.end <= T).length) || '';
  drawJual(); drawLaundry();
  const VIEWS = { sewa: '#dashSewa', jual: '#dashJual', laundry: '#dashLaundry' };
  const showView = (v) => {
    if (!VIEWS[v]) v = 'sewa';
    Object.entries(VIEWS).forEach(([k, sel]) => { $(sel).hidden = k !== v; });
    $$('#dashView [data-v]').forEach((x) => { const on = x.dataset.v === v; x.classList.toggle('active', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
    history.replaceState(null, '', v === 'sewa' ? location.pathname : `?tab=${v}`);
    if (v === 'sewa') window.dispatchEvent(new Event('resize'));
  };
  $('#actFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { ACT_F = b.dataset.f; draw(); } });
  $('#dashView').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) showView(b.dataset.v); });
  if (param('tab') === 'jual' || param('tab') === 'laundry') showView(param('tab'));
  syncLaundry(); syncServices();
})();
/* Chip "Antar & jemput" / "Bongkar pasang" menuju jadwal yang dilipat → buka lipatannya dulu */
document.addEventListener('click', (e) => { const a = e.target.closest('a[href$="#svcSec"]'); if (!a) return; const f = document.getElementById('svcFold'); if (f) f.open = true; });
