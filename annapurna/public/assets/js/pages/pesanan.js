(function () {
  const { DB, Rules, D, rupiah } = Ann; const { $, $$, esc, asset, param, toast, modal, confirmBox, pill, Cart, stars, reviewModal } = UI;
  const user = Site.requireLogin(); if (!user) return;
  const st = DB.settings();
  let tab = param('tab') || 'sewa';
  if (param('paid')) toast('Bukti pembayaran terkirim. Admin akan memverifikasi dalam 1×24 jam.');

  const mine = () => ({
    rent: DB.bookings().filter((b) => b.customer.email === user.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    buy: DB.sales().filter((s) => s.customer.email === user.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
  const done = ['selesai', 'dibatalkan'];

  function lines(items) {
    return items.map((it) => `<div class="mini-line"><img src="${asset(it.img)}" alt=""><div class="nm">${it.qty}× ${esc(it.name)}${it.kind === 'package' ? ' <span class="pill green plain">Paket</span>' : ''}<small>${it.pricePerDay ? rupiah(it.pricePerDay) + ' / malam' : rupiah(it.price)}</small></div></div>`).join('');
  }
  function revBtn(x) {
    const r = DB.reviewFor(x.id);
    return r ? `<button class="btn btn-ghost btn-sm rv-done" data-act="review" data-id="${x.id}" title="Lihat / ubah ulasan">${stars(r.rating, false)} Ulasanmu${r.reply ? (r.replySeen === false ? ' <span class="pill amber plain">Balasan baru</span>' : ' <span class="pill green plain"><i class="fa-solid fa-reply"></i> Dibalas</span>') : ''}</button>`
      : `<button class="btn btn-gold btn-sm" data-act="review" data-id="${x.id}"><i class="fa-regular fa-star"></i> Beri ulasan</button>`;
  }
  function rentCard(b) {
    const paid = Rules.paidTotal(b);
    const pendingChange = b.changes.find((c) => c.status === 'menunggu');
    const acts = [];
    if (!['selesai', 'dibatalkan'].includes(b.status)) acts.push(`<button class="btn btn-ghost btn-sm wa-admin" data-act="waadmin" data-id="${b.id}" title="Tanya admin soal pesanan ini (mis. minta diantar)"><i class="fa-brands fa-whatsapp"></i> Chat admin</button>`);
    acts.push(`<button class="btn btn-ghost btn-sm" data-act="detail" data-id="${b.id}">Detail</button>`);
    if (['dikonfirmasi', 'disewa', 'selesai'].includes(b.status)) acts.push(`<a class="btn btn-light btn-sm" href="invoice?id=${b.id}"><i class="fa-solid fa-receipt"></i> Nota digital</a>`);
    if (b.status === 'dikonfirmasi' && !pendingChange) acts.push(`<button class="btn btn-outline btn-sm" data-act="change" data-id="${b.id}"><i class="fa-solid fa-arrows-rotate"></i> Ganti barang</button>`);
    const pendExt = (b.extensions || []).find((x) => x.status === 'menunggu');
    if (['dikonfirmasi', 'disewa'].includes(b.status)) acts.push(pendExt ? `<span class="pill amber">Perpanjangan s/d ${D.fmtDate(pendExt.to)} menunggu admin</span>` : `<button class="btn btn-outline btn-sm" data-act="extend" data-id="${b.id}"><i class="fa-solid fa-calendar-plus"></i> Perpanjang sewa</button>`);
    if (['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(b.status)) acts.push(`<button class="btn btn-danger btn-sm" data-act="cancel" data-id="${b.id}">Batalkan</button>`);
    if (b.status === 'menunggu_pembayaran') acts.push(`<a class="btn btn-primary btn-sm" href="pembayaran?ids=${b.id}">Bayar DP ${rupiah(b.dp)}</a>`);
    if (b.status === 'selesai') { acts.push(revBtn(b)); acts.push(`<button class="btn btn-primary btn-sm" data-act="again" data-id="${b.id}"><i class="fa-solid fa-rotate-right"></i> Sewa lagi</button>`); }
    const late = b.status === 'disewa' && D.today() > b.end;
    return `<article class="order-card">
      <div class="oh"><div><strong>${NO(b)}</strong><small>Dibuat ${D.fmtDateTime(b.createdAt)}</small>${b.group ? (() => { const mates = DB.bookings().filter((x) => x.group === b.group && x.id !== b.id); return mates.length ? `<small class="grp-tag"><i class="fa-solid fa-link"></i> Pesanan gabungan · ${mates.map((x) => `${x.id} kembali ${D.fmtDate(x.end)}`).join(', ')}</small>` : ''; })() : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${pill('rental', b.status)}${pill('payment', b.paymentStatus)}</div></div>
      ${UI.orderTracker(b)}
      <div class="ob">
        <div>
          <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13.5px;margin-bottom:8px">
            <span><i class="fa-regular fa-calendar" style="color:var(--g600)"></i> ${D.fmtRange(b.start, b.end)} · ${b.days} malam</span>
            <span><i class="fa-solid fa-store" style="color:var(--g600)"></i> Ambil di toko</span>
          </div>
          ${lines(b.items)}
          ${pendingChange ? `<div class="notice" style="margin-top:10px"><i class="fa-solid fa-arrows-rotate"></i><div>Permintaan ganti <strong>${esc(pendingChange.fromName)}</strong> → <strong>${esc(pendingChange.toName)}</strong> sedang ditinjau admin.</div></div>` : ''}
          ${late ? `<div class="notice red" style="margin-top:10px"><i class="fa-solid fa-clock"></i><div>Sudah lewat tanggal kembali ${D.diffDays(b.end, D.today())} hari. Segera kembalikan untuk menghindari denda bertambah.</div></div>` : ''}
          ${b.status === 'dibatalkan' && b.cancel ? `<div class="notice ${b.cancel.refundable ? 'green' : 'red'}" style="margin-top:10px"><i class="fa-solid fa-circle-info"></i><div>${b.cancel.refundable ? (b.cancel.refundStatus === 'selesai' ? `DP ${rupiah(b.dp)} sudah dikembalikan.` : b.cancel.refundStatus === 'menunggu' ? `Pengembalian DP ${rupiah(b.dp)} sedang diproses admin.` : 'Booking dibatalkan sebelum pembayaran.') : 'Dibatalkan kurang dari H-2, DP tidak dikembalikan.'}</div></div>` : ''}
        </div>
        <div class="sum"><small>Total sewa</small><strong>${rupiah(b.total)}</strong><small>Sudah dibayar ${rupiah(paid)}</small>${UI.pendingPay(b) ? `<small class="pay-wait-s"><i class="fa-regular fa-clock"></i> ${rupiah(UI.pendingPay(b))} menunggu verifikasi</small>` : ''}${b.status !== 'dibatalkan' && b.total - paid > 0 ? `<small style="color:var(--orange);font-weight:700">Sisa ${rupiah(b.total - paid)}</small>` : ''}</div>
      </div>
      <div class="of">${acts.join('')}</div>
    </article>`;
  }
  function saleCard(s) {
    const acts = [...(!['selesai', 'dibatalkan'].includes(s.status) ? [`<button class="btn btn-ghost btn-sm wa-admin" data-act="waadmin" data-id="${s.id}" title="Tanya admin soal pesanan ini (mis. minta diantar)"><i class="fa-brands fa-whatsapp"></i> Chat admin</button>`] : []), `<button class="btn btn-ghost btn-sm" data-act="sdetail" data-id="${s.id}">Detail</button>`];
    if (s.paymentStatus === 'paid') acts.push(`<a class="btn btn-light btn-sm" href="invoice?id=${s.id}"><i class="fa-solid fa-receipt"></i> Nota digital</a>`);
    if (s.status === 'menunggu_pembayaran') { acts.push(`<button class="btn btn-danger btn-sm" data-act="scancel" data-id="${s.id}">Batalkan</button>`); acts.push(`<a class="btn btn-primary btn-sm" href="pembayaran?ids=${s.id}">Bayar ${rupiah(s.total)}</a>`); }
    if (s.status === 'siap_diambil') acts.push(`<button class="btn btn-primary btn-sm" data-act="received" data-id="${s.id}"><i class="fa-solid fa-check"></i> Sudah saya ambil</button>`);
    if (s.status === 'selesai') { acts.push(revBtn(s)); acts.push(`<button class="btn btn-outline btn-sm" data-act="buyagain" data-id="${s.id}">Beli lagi</button>`); }
    return `<article class="order-card">
      <div class="oh"><div><strong>${NO(s)}</strong><small>Dibuat ${D.fmtDateTime(s.createdAt)}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap">${pill('sale', s.status)}${pill('payment', s.paymentStatus)}</div></div>
      ${UI.orderTracker(s)}
      <div class="ob"><div><div style="font-size:13.5px;margin-bottom:8px"><i class="fa-solid fa-store" style="color:var(--g600)"></i> ${s.status === 'siap_diambil' ? '<strong style="color:var(--g700)">Siap diambil di toko</strong> — bawa nota digital' : 'Ambil di toko'}</div>${lines(s.items)}</div>
      <div class="sum"><small>Total belanja</small><strong>${rupiah(s.total)}</strong>${s.status !== 'dibatalkan' ? `<small>Sudah dibayar ${rupiah(Rules.paidTotal ? (s.payments || []).reduce((a, p) => a + (+p.amount || 0), 0) : 0)}</small>` : ''}${UI.pendingPay(s) ? `<small class="pay-wait-s"><i class="fa-regular fa-clock"></i> ${rupiah(UI.pendingPay(s))} menunggu verifikasi</small>` : ''}</div></div>
      <div class="of">${acts.join('')}</div>
    </article>`;
  }
  const empty = (t, p, a) => `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-receipt"></i></div><h3>${t}</h3><p>${p}</p>${a}</div>`;

  function draw() {
    const { rent, buy } = mine();
    const running = rent.filter((b) => !done.includes(b.status));
    const hist = [...rent.filter((b) => done.includes(b.status)).map((b) => ({ ...b, _t: 'rent' })), ...buy.filter((s) => done.includes(s.status)).map((s) => ({ ...s, _t: 'buy' }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const activeBuy = buy.filter((s) => !done.includes(s.status));
    $('#cSewa').textContent = running.length; $('#cBeli').textContent = activeBuy.length; $('#cRiw').textContent = hist.length;
    $$('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    let html = '';
    if (tab === 'sewa') html = running.length ? running.map(rentCard).join('') : empty('Belum ada rental berjalan', 'Pilih alat dan tanggal sewa, lalu bayar DP untuk mengunci booking.', '<a class="btn btn-primary" href="katalog">Sewa alat sekarang</a>');
    if (tab === 'beli') html = activeBuy.length ? activeBuy.map(saleCard).join('') : empty('Belum ada pembelian berjalan', 'Butuh gas kaleng atau alat baru? Belanja langsung dari katalog.', '<a class="btn btn-primary" href="belanja">Belanja alat</a>');
    if (tab === 'riwayat') html = hist.length ? hist.map((x) => (x._t === 'rent' ? rentCard(x) : saleCard(x))).join('') : empty('Riwayat masih kosong', 'Rental dan pembelian yang sudah selesai akan tercatat di sini.', '');
    $('#list').innerHTML = html;
  }
  $$('#tabs .tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; history.replaceState(null, '', '?tab=' + tab); draw(); }));

  function detail(b) {
    modal({ title: `Detail ${NO(b)}`, size: 'lg', body: `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${pill('rental', b.status)}${pill('payment', b.paymentStatus)}</div>
      <div class="grid-2" style="gap:20px">
        <div>
          <h4 style="margin-bottom:8px">Barang</h4>${lines(b.items)}
          <div class="kv"><span>Tanggal sewa</span><span>${D.fmtRange(b.start, b.end)}</span></div>
          <div class="kv"><span>Lama sewa</span><span>${b.days} malam · ${esc(Rules.tierLabel(b.items[0] ? (b.items[0].tiers || { d1: b.items[0].pricePerDay }) : {}, b.days))}</span></div>
          <div class="kv"><span>Pengambilan</span><span>Ambil di toko</span></div>
          <div class="kv"><span>Metode bayar</span><span>${esc(b.method)}</span></div>
          <div class="kv"><span>Subtotal sewa</span><span>${rupiah(b.subtotal)}</span></div>
          ${b.fine ? `<div class="kv"><span>Denda</span><span style="color:var(--red)">${rupiah(b.fine)}</span></div>` : ''}
          <div class="kv total"><span>Total</span><span>${rupiah(b.total)}</span></div>
          <div class="kv hl"><span>Sudah dibayar</span><span>${rupiah(Rules.paidTotal(b))}</span></div>${UI.pendingPayHtml(b)}
          ${b.ret ? `<div class="notice green" style="margin-top:10px"><i class="fa-solid fa-box"></i><div>Dikembalikan ${D.fmtDateTime(b.ret.at)} · kondisi <strong>${esc(b.ret.cond)}</strong>${b.ret.note ? ' · ' + esc(b.ret.note) : ''}</div></div>` : ''}
        </div>
        <div>
          <h4 style="margin-bottom:10px">Riwayat status</h4>
          <ul class="timeline">${[...b.history].reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul>
          ${b.changes.length ? `<h4 style="margin:12px 0 8px">Permintaan ganti barang</h4>${b.changes.map((c) => `<div class="kv"><span>${esc(c.fromName)} → ${esc(c.toName)}</span><span class="pill ${c.status === 'disetujui' ? 'green' : c.status === 'ditolak' ? 'red' : 'amber'}">${c.status}</span></div>`).join('')}` : ''}
          ${b.proof ? `<h4 style="margin:12px 0 8px">Bukti pembayaran</h4><img src="${b.proof}" alt="Bukti pembayaran" style="border-radius:10px;max-height:200px">` : ''}
        </div>
      </div>`, foot: `<button class="btn btn-light" data-close>Tutup</button>${['dikonfirmasi', 'disewa', 'selesai'].includes(b.status) ? `<a class="btn btn-primary" href="invoice?id=${b.id}">Lihat bukti booking</a>` : ''}` });
  }
  function sdetail(s) {
    modal({ title: `Detail ${NO(s)}`, body: `<div style="display:flex;gap:6px;margin-bottom:12px">${pill('sale', s.status)}${pill('payment', s.paymentStatus)}</div>${lines(s.items)}
      <div class="kv"><span>Pengambilan</span><span>Ambil di toko</span></div>
      <div class="kv"><span>Subtotal</span><span>${rupiah(s.subtotal)}</span></div>
      <div class="kv total"><span>Total</span><span>${rupiah(s.total)}</span></div>
      <h4 style="margin:14px 0 10px">Riwayat status</h4><ul class="timeline">${[...s.history].reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul>`, foot: `<button class="btn btn-light" data-close>Tutup</button>` });
  }

  async function cancel(b) {
    const refundable = Rules.canRefund(b);
    const hasDp = ['dp_verifying', 'dp_paid'].includes(b.paymentStatus);
    const msg = !hasDp ? 'Booking ini belum dibayar, jadi bisa langsung dibatalkan tanpa biaya.'
      : refundable ? `Kamu membatalkan paling lambat H-${st.cancelDays}. DP <strong>${rupiah(b.dp)}</strong> akan dikembalikan penuh oleh admin.`
      : `Tanggal ambil tinggal ${Math.max(0, D.diffDays(D.today(), b.start))} hari lagi (kurang dari H-${st.cancelDays}). <strong>DP ${rupiah(b.dp)} tidak dapat dikembalikan.</strong>`;
    const reason = await confirmBox({ title: `Batalkan ${NO(b)}?`, text: msg, ok: 'Batalkan booking', cancel: 'Kembali', danger: true, input: { label: 'Alasan pembatalan', placeholder: 'Contoh: jadwal pendakian diundur', required: true, error: 'Tulis alasan pembatalan.' } });
    if (!reason) return;
    b.status = 'dibatalkan';
    b.cancel = { at: D.nowStamp(), reason, refundable: hasDp ? refundable : true, refundStatus: hasDp ? (refundable ? 'menunggu' : 'hangus') : 'tidak_perlu' };
    if (hasDp) b.paymentStatus = refundable ? 'refund_pending' : 'forfeited';
    b.history.push({ at: D.nowStamp(), text: `Customer membatalkan booking (${reason})` });
    DB.saveBooking(b);
    DB.notifyStaff('Pembatalan booking', `${b.customer.name} membatalkan ${NO(b)}.${hasDp && refundable ? ' DP perlu dikembalikan.' : ''}`, 'admin/permintaan');
    toast(hasDp && refundable ? 'Booking dibatalkan. Pengembalian DP sedang diproses.' : 'Booking dibatalkan.');
    draw();
  }

  function extend(b) {
    const st = DB.settings(); const maxEnd = D.addDays(b.start, st.maxRentDays || 60);
    const m = modal({ title: `Perpanjang sewa · ${NO(b)}`, body: `
      <p class="muted" style="margin-bottom:14px">Sewa sekarang ${D.fmtRange(b.start, b.end)}. Pilih tanggal kembali baru; admin akan mengecek dan menyetujui.</p>
      <div class="field"><label>Tanggal kembali baru</label><input class="input" type="date" id="xEnd" min="${D.addDays(b.end, 1)}" max="${maxEnd}" value="${D.addDays(b.end, 1)}"></div>
      <div id="xInfo"></div>
      <div class="field" style="margin-top:12px"><label>Alasan (opsional)</label><input class="input" id="xWhy" placeholder="Contoh: cuaca buruk, pendakian diundur sehari"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="xOk">Ajukan perpanjangan</button>' });
    const calc = () => { const r = Rules.extendCheck(b, m.$('#xEnd').value);
      m.$('#xInfo').innerHTML = r.extraDays > 0 ? `<div class="notice ${r.ok ? 'green' : 'red'}"><i class="fa-solid ${r.ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i><div>${r.ok ? `Tambahan <strong>${r.extraDays} malam</strong>, biaya <strong>${rupiah(r.cost)}</strong> (dibayar saat pengembalian).` : esc(r.msg)}</div></div>` : '';
      m.$('#xOk').disabled = !r.ok; return r; };
    m.$('#xEnd').addEventListener('change', calc); calc();
    m.$('#xOk').addEventListener('click', () => { const r = calc(); if (!r.ok) return; const to = m.$('#xEnd').value;
      b.extensions = b.extensions || []; b.extensions.push({ id: 'EXT-' + Date.now(), at: D.nowStamp(), from: b.end, to, days: r.extraDays, cost: r.cost, reason: m.$('#xWhy').value.trim(), status: 'menunggu', source: 'customer' });
      b.history.push({ at: D.nowStamp(), text: `Mengajukan perpanjangan sampai ${D.fmtDate(to, true)}` }); DB.saveBooking(b);
      DB.notifyStaff('Permintaan perpanjangan', `${b.customer.name} ingin memperpanjang ${NO(b)} sampai ${D.fmtDate(to, true)} (+${r.extraDays} hari).`, 'admin/permintaan?tab=extend');
      m.close(); toast('Permintaan perpanjangan terkirim ke admin.'); draw(); });
  }

  function change(b) {
    UI.changeModal(b, { mode: 'customer', onSubmit: (r) => {
      b.changes = b.changes || [];
      b.changes.push({ id: 'CHG-' + Date.now(), at: D.nowStamp(), lineIndex: r.lineIndex, fromId: r.line.refId, fromName: r.line.name, toId: r.p.id, toName: r.toName, toSize: r.size || null, qty: r.qty, diff: r.diff, reason: r.reason, status: 'menunggu', source: 'customer' });
      b.history.push({ at: D.nowStamp(), text: `Mengajukan ganti ${r.qty}× ${r.line.name} → ${r.toName}` });
      DB.saveBooking(b);
      DB.notifyStaff('Permintaan ganti barang', `${b.customer.name} ingin mengganti ${r.qty}× ${r.line.name} menjadi ${r.toName} (${NO(b)}).`, 'admin/permintaan');
      toast('Permintaan ganti barang terkirim ke admin.'); draw();
    } });
  }

  $('#list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    if (act === 'waadmin') { UI.waContact(`Halo admin, saya mau tanya soal pesanan #${NO(DB.booking(id) || DB.sale(id) || { id })}.`, { focus: id }); return; }
    if (act === 'detail') detail(DB.booking(id));
    if (act === 'cancel') cancel(DB.booking(id));
    if (act === 'change') change(DB.booking(id));
    if (act === 'extend') extend(DB.booking(id));
    if (act === 'again') {
      const b = DB.booking(id); const days = b.days;
      b.items.forEach((it) => Cart.add(Object.assign({ type: 'rent', kind: it.kind, refId: it.refId, qty: it.qty, start: D.rel(1), end: D.rel(1 + days) }, it.size ? { size: it.size } : {})));
      toast('Alat dari booking ini ditambahkan ke keranjang. Atur tanggalnya di keranjang.');
      setTimeout(() => (location.href = 'keranjang'), 800);
    }
    if (act === 'sdetail') sdetail(DB.sale(id));
    if (act === 'review') reviewModal(id.startsWith('RNT') ? DB.booking(id) : DB.sale(id), draw);
    if (act === 'scancel') {
      if (!(await confirmBox({ title: `Batalkan ${id}?`, text: 'Pesanan pembelian ini belum dibayar dan akan dibatalkan.', ok: 'Batalkan pesanan', danger: true }))) return;
      const s = DB.sale(id); s.status = 'dibatalkan'; s.history.push({ at: D.nowStamp(), text: 'Customer membatalkan pesanan' }); DB.saveSale(s); toast('Pesanan dibatalkan.'); draw();
    }
    if (act === 'received') { const s = DB.sale(id); s.status = 'selesai'; s.history.push({ at: D.nowStamp(), text: 'Barang sudah diambil customer' }); DB.saveSale(s); toast('Terima kasih! Pesanan selesai.'); draw(); setTimeout(() => reviewModal(DB.sale(id), draw), 500); }
    if (act === 'buyagain') { const s = DB.sale(id); s.items.forEach((i) => UI.Cart.add(Object.assign({ type: 'buy', kind: 'product', refId: i.productId, qty: i.qty }, i.size ? { size: i.size } : {}))); location.href = 'keranjang'; }
  });

  draw();
  const openId = param('id');
  if (openId) { const b = DB.booking(openId); if (b && b.customer.email === user.email) detail(b); }
  const revId = param('review');
  if (revId) { const x = revId.startsWith('RNT') ? DB.booking(revId) : DB.sale(revId); if (x && x.customer.email === user.email && x.status === 'selesai') reviewModal(x, draw); }
})();

