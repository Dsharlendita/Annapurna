(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('dashboard', 'Dashboard');
  const T = D.today();
  function draw() {
    const B = DB.bookings(), S = DB.sales();
    const h = new Date().getHours();
    $('#greet').textContent = `${h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'}, ${Admin.me.name}. Berikut ringkasan operasional hari ini.${Admin.isOwner ? ' Ringkasan keuangan & bisnis ada di tab Ringkasan bisnis.' : ''}`;
    const L = Admin.ledger(T, T);
    const newToday = B.filter((b) => D.day(b.createdAt) === T).length;
    const outToday = B.filter((b) => b.out && D.day(b.out.at) === T).reduce((s, b) => s + b.items.reduce((t, i) => t + i.qty, 0), 0);
    const pickToday = B.filter((b) => b.status === 'dikonfirmasi' && b.start === T).length;
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
    $('#stats').innerHTML = [
      stat('fa-calendar-plus', '', 'Booking hari ini', newToday, `${pickToday} diambil hari ini · ${outToday} unit keluar`, 'booking'),
      stat('fa-person-hiking', '', 'Rental aktif', active, '', 'booking?tab=disewa'),
      stat('fa-rotate-left', 'blue', 'Barang harus kembali hari ini', dueToday, `${retToday} sudah kembali hari ini`, 'pengembalian'),
      stat('fa-triangle-exclamation', 'red', 'Barang terlambat', late, late ? 'Segera hubungi customer' : 'Semua tepat waktu', 'pengembalian'),
      stat('fa-bag-shopping', 'gold', 'Pesanan penjualan', salesTodo, `${salesToday} pesanan masuk hari ini`, 'penjualan'),
      stat('fa-boxes-stacked', '', 'Barang tersedia', units.av + ' unit', `${units.out} unit sedang disewa`, 'barang'),
      stat('fa-wallet', 'blue', 'Pemasukan hari ini', rupiah(L.totalIn), `Rental ${rupiah(rentIn)} · Penjualan ${rupiah(saleIn)}`, 'keuangan'),
      stat('fa-receipt', 'gold', 'Transaksi hari ini', txToday, 'Pembayaran, refund & kas manual', 'keuangan'),
    ].join('');

    const todo = [];
    B.filter((b) => b.status === 'menunggu_konfirmasi').forEach((b) => todo.push({ ic: 'fa-receipt', t: `Verifikasi DP ${b.id}`, s: `${b.customer.name} · ${rupiah(b.dp)}`, act: 'detail', id: b.id }));
    B.filter((b) => b.status === 'disewa' && b.end === T).forEach((b) => todo.push({ ic: 'fa-bell', t: `${b.id} harus kembali hari ini`, s: `${b.customer.name}${Admin.remindedToday(b) ? ' · sudah diingatkan' : ' · belum diingatkan'}`, remind: b.id, done: Admin.remindedToday(b) }));
    B.filter((b) => b.status === 'disewa' && b.end < T).forEach((b) => todo.push({ ic: 'fa-triangle-exclamation', t: `${b.id} terlambat ${D.diffDays(b.end, T)} hari`, s: b.customer.name, act: 'return', id: b.id, red: 1 }));
    Admin.pendingRequests().forEach((r) => todo.push({ ic: r.type === 'refund' ? 'fa-hand-holding-dollar' : r.type === 'extend' ? 'fa-calendar-plus' : 'fa-arrows-rotate', t: r.type === 'refund' ? `Refund DP ${r.b.id}` : r.type === 'extend' ? `Perpanjangan ${r.b.id}` : `Ganti barang ${r.b.id}`, s: r.type === 'refund' ? r.b.customer.name : r.type === 'extend' ? `${r.b.customer.name} · sampai ${D.fmtDate(r.x.to)}` : `${r.c.fromName} → ${r.c.toName}`, href: r.type === 'extend' ? 'permintaan?tab=extend' : 'permintaan' }));
    DB.lowStock().forEach((p) => todo.push({ ic: 'fa-box-archive', t: `Stok menipis: ${p.name}`, s: `Sisa ${DB.saleableStock(p)} · minimum ${p.minStock}`, href: 'barang?low=1', red: 1 }));
    DB.products(true).forEach((p) => { const due = (p.units || []).filter((u) => DB.serviceDue(p, u)); if (due.length) todo.push({ ic: 'fa-screwdriver-wrench', t: `Perawatan ${p.name}`, s: `${due.length} unit perlu servis: ${due.map((u) => u.code).join(', ')}`, href: 'barang?unit=' + p.id }); });
    DB.reviews().filter((r) => !r.seen).forEach((r) => todo.push({ ic: 'fa-star', t: `Ulasan baru ★${r.rating} · ${r.refId}`, s: r.name, href: 'ulasan', red: r.rating <= 2 }));
    S.filter((s) => s.paymentStatus === 'verifying').forEach((s) => todo.push({ ic: 'fa-bag-shopping', t: `Verifikasi bayar ${s.id}`, s: `${s.customer.name} · ${rupiah(s.total)}`, href: `penjualan?id=${s.id}` }));
    $('#todo').innerHTML = todo.length ? todo.slice(0, 8).map((x) => `<div class="list-row"><span class="stat" style="padding:0;border:0"><span class="ic ${x.red ? 'red' : 'gold'}" style="width:36px;height:36px;font-size:14px"><i class="fa-solid ${x.ic}"></i></span></span><div class="nm"><strong>${esc(x.t)}</strong><small>${esc(x.s)}</small></div>${x.remind ? `<button class="btn ${x.done ? 'btn-light' : 'btn-wa'} btn-xs" data-remind="${x.remind}"><i class="fa-brands fa-whatsapp"></i> ${x.done ? 'Kirim lagi' : 'Ingatkan'}</button>` : x.href ? `<a class="btn btn-light btn-xs" href="${x.href}">Buka</a>` : `<button class="btn btn-light btn-xs" data-act="${x.act}" data-id="${x.id}">Proses</button>`}</div>`).join('')
      : '<div class="empty-state" style="padding:24px"><div class="ic"><i class="fa-solid fa-mug-hot"></i></div><h3>Semua beres!</h3><p>Tidak ada tugas tertunda.</p></div>';

    $('#latest').innerHTML = B.slice().sort((a, b) => String(b.createdAt).localeCompare(a.createdAt)).slice(0, 8).map((b) => `<tr>
      <td class="nw"><strong>${b.id}</strong></td><td>${esc(b.customer.name)}</td><td class="nw">${D.fmtRange(b.start, b.end)}</td>
      <td class="num">${rupiah(b.total)}</td><td>${pill('rental', b.status)}</td><td><button class="btn btn-light btn-xs" data-act="detail" data-id="${b.id}">Detail</button></td></tr>`).join('');

    const pick = B.filter((b) => b.status === 'dikonfirmasi' && b.start === T);
    const due = B.filter((b) => b.status === 'disewa' && b.end <= T);
    $('#today').innerHTML = (pick.length || due.length) ? [
      ...pick.map((b) => `<div class="list-row"><span class="pill blue plain">Ambil</span><div class="nm"><strong>${b.id} · ${esc(b.customer.name)}</strong><small>${esc(Admin.itemsText(b))}</small></div><button class="btn btn-primary btn-xs" data-act="pickup" data-id="${b.id}">Catat keluar</button></div>`),
      ...due.map((b) => `<div class="list-row"><span class="pill ${b.end < T ? 'red' : 'amber'} plain">${b.end < T ? 'Terlambat' : 'Kembali'}</span><div class="nm"><strong>${b.id} · ${esc(b.customer.name)}</strong><small>${esc(Admin.itemsText(b))}</small></div><button class="btn btn-primary btn-xs" data-act="return" data-id="${b.id}">Terima</button></div>`),
    ].join('') : '<p class="muted" style="font-size:13.5px">Tidak ada jadwal ambil/kembali hari ini.</p>';

    const cnt = {};
    B.filter((b) => b.status !== 'dibatalkan').forEach((b) => b.items.forEach((i) => i.components.forEach((c) => { cnt[c.productId] = (cnt[c.productId] || 0) + c.qty * i.qty; })));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = top.length ? top[0][1] : 1;
    $('#top').innerHTML = top.map(([id, n]) => `<li><div class="bl"><span>${esc((DB.product(id) || { name: id }).name)}</span><strong>${n}×</strong></div><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></li>`).join('');

    const pins = DB.sops().filter((x) => x.pinned && x.active !== false);
    $('#sopPanel').hidden = !pins.length;
    $('#sopPin').innerHTML = pins.map((x) => `<details class="sop-mini"><summary>${esc(x.title)}</summary><p>${esc(x.body)}</p></details>`).join('');
    chart();
  }
  let ch;
  function chart() {
    const days = [...Array(7)].map((_, i) => D.rel(i - 6));
    const L = Admin.ledger(days[0], T);
    const by = (cat) => days.map((d) => L.income.filter((x) => D.day(x.date) === d && cat(x.cat)).reduce((s, x) => s + x.amount, 0));
    const data = { labels: days.map((d) => { const x = new Date(d + 'T00:00:00'); return `${D.HARI[x.getDay()]} ${x.getDate()}`; }),
      datasets: [
        { label: 'Rental & denda', data: by((c) => c !== 'Penjualan'), backgroundColor: '#1f4d2f', borderRadius: 6 },
        { label: 'Penjualan', data: by((c) => c === 'Penjualan'), backgroundColor: '#f2c14e', borderRadius: 6 },
      ] };
    if (!window.Chart) { $('#chart').parentElement.innerHTML = '<p class="muted">Grafik tidak dapat dimuat.</p>'; return; }
    if (ch) ch.destroy();
    ch = new Chart($('#chart'), { type: 'bar', data, options: { maintainAspectRatio: false, responsive: true,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Figtree' } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rupiah(c.raw)}` } } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: (v) => v >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : v >= 1e3 ? v / 1e3 + ' rb' : v }, grid: { color: '#eeece4' } } } } });
  }
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-remind]'); if (r) { Admin.remindWa(DB.booking(r.dataset.remind)); UI.toast('WhatsApp dibuka dengan pesan pengingat.'); draw(); } });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) Admin.runBooking(b.dataset.act, b.dataset.id, draw); });
  draw();
})();

