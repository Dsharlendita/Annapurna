(function () {
  const { DB, Rules, D, rupiah } = Ann; const { $, $$, esc, asset, Cart, toast, confirmBox } = UI;
  const root = $('#root');
  function setAll(start, end) {
    const cart = Cart.all(); cart.forEach((c) => { if (c.type === 'rent') Object.assign(c, { start, end }); });
    DB.setCart(cart); DB.setTrip(start, end); draw();
    const bad = Cart.all().filter((it) => it.type === 'rent' && it.qty > Cart.availability(it)).length;
    toast(bad ? `Tanggal disamakan. ${bad} alat perlu dicek stoknya.` : `Semua alat disewa ${D.fmtRange(start, end)}.`, bad ? 'err' : undefined);
  }
  function draw() {
    const cart = Cart.all();
    if (!cart.length) {
      root.innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-cart-shopping"></i></div><h3>Keranjang masih kosong</h3><p>Pilih alat yang mau disewa atau dibeli. Semua yang kamu tambahkan akan muncul di sini.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="katalog">Sewa alat</a><a class="btn btn-outline" href="paket">Lihat paket</a><a class="btn btn-light" href="katalog?mode=beli">Belanja alat</a></div></div>`;
      return;
    }
    const rent = cart.filter((c) => c.type === 'rent'), buy = cart.filter((c) => c.type === 'buy');
    let problems = 0;
    const row = (it) => {
      const r = Cart.resolve(it);
      if (!r) return '';
      const avail = Cart.availability(it);
      const bad = it.qty > avail;
      if (bad) problems++;
      const days = it.type === 'rent' ? Rules.rentalDays(it.start, it.end) : 0;
      return `<div class="cart-item" data-key="${it.key}">
        <img src="${asset(r.img)}" alt="">
        <div>
          <h4>${esc(r.name)} ${it.kind === 'package' ? '<span class="pill green plain" style="margin-left:4px">Paket</span>' : ''}</h4>
          <div class="sm">${it.type === 'rent' ? `${rupiah(r.unit)} / hari × ${days} hari` : rupiah(r.unit)}${r.sub ? `<br>${esc(r.sub)}` : ''}</div>
          ${it.type === 'rent' ? `<div class="dates"><label class="sr-only">Tanggal ambil</label><input type="date" class="input" data-f="start" value="${it.start}" min="${D.today()}"><span class="sm" style="align-self:center">sampai</span><label class="sr-only">Tanggal kembali</label><input type="date" class="input" data-f="end" value="${it.end}" min="${D.addDays(it.start, 1)}"></div>` : ''}
          ${bad ? `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i> ${it.type === 'rent' ? (it.kind === 'product' ? Rules.availMsg(DB.product(it.refId), it.qty, it.start, it.end, it.size, avail) : `Paket ini hanya tersedia ${avail} untuk ${D.fmtRange(it.start, it.end)}. Kurangi jumlah atau ubah tanggal.`) : `Stok tersisa ${avail} unit${it.size ? ` untuk ukuran ${esc(it.size)}` : ''}.`}</div>` : ''}
        </div>
        <div class="end">
          <strong>${rupiah(Cart.lineTotal(it))}</strong>
          <div style="display:flex;gap:8px;align-items:center">
            <div class="qty"><button data-q="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input type="number" min="1" value="${it.qty}" data-f="qty" aria-label="Jumlah"><button data-q="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div>
            <button class="icon-btn" data-del aria-label="Hapus ${esc(r.name)}" style="color:var(--red)"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
      </div>`;
    };
    const rentTotal = rent.reduce((s, i) => s + Cart.lineTotal(i), 0);
    const buyTotal = buy.reduce((s, i) => s + Cart.lineTotal(i), 0);
    const dp = Math.round(rentTotal * DB.settings().dpPercent / 100);
    const rentHtml = rent.map(row).join(''), buyHtml = buy.map(row).join('');
    root.innerHTML = `<div class="layout-2">
      <div>
        ${(() => { const ranges = [...new Set(rent.map((r) => r.start + '|' + r.end))]; const t = DB.trip() || (rent[0] && { start: rent[0].start, end: rent[0].end });
          if (!rent.length || !t) return '';
          if (ranges.length > 1) return `<div class="notice date-sync"><i class="fa-regular fa-calendar"></i><div><strong>Tanggal sewa di keranjang berbeda-beda.</strong> Samakan semua menjadi <b>${D.fmtRange(t.start, t.end)}</b>? Biasanya semua alat untuk satu trip diambil & dikembalikan bersamaan.</div><button class="btn btn-primary btn-sm" id="syncDates" data-s="${t.start}" data-e="${t.end}">Samakan</button></div>`;
          return `<div class="notice green date-sync"><i class="fa-regular fa-calendar-check"></i><div>Semua alat disewa untuk <b>${D.fmtRange(rent[0].start, rent[0].end)}</b> · ${Rules.rentalDays(rent[0].start, rent[0].end)} hari.</div><button class="btn btn-light btn-sm" id="chgDates">Ubah tanggal</button></div>`; })()}
        ${rent.length ? `<section class="cart-group"><h3><i class="fa-solid fa-campground" style="color:var(--g600)"></i> Sewa alat <span class="muted" style="font-weight:500;font-size:13px">(${rent.length})</span></h3>${rentHtml}</section>` : ''}
        ${buy.length ? `<section class="cart-group"><h3><i class="fa-solid fa-bag-shopping" style="color:var(--g600)"></i> Beli alat <span class="muted" style="font-weight:500;font-size:13px">(${buy.length})</span></h3>${buyHtml}</section>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-light btn-sm" href="katalog"><i class="fa-solid fa-plus"></i> Tambah alat lain</a><button class="btn btn-ghost btn-sm" id="clearCart" style="color:var(--red)">Kosongkan keranjang</button></div>
      </div>
      <aside class="card sticky-side">
        <div class="card-title">Ringkasan</div>
        ${rent.length ? `<div class="kv"><span>Total sewa</span><span>${rupiah(rentTotal)}</span></div><div class="kv hl"><span>DP ${DB.settings().dpPercent}% sewa</span><span>${rupiah(dp)}</span></div><div class="kv"><span>Sisa bayar saat ambil</span><span>${rupiah(rentTotal - dp)}</span></div>` : ''}
        ${buy.length ? `<div class="kv"><span>Total belanja</span><span>${rupiah(buyTotal)}</span></div>` : ''}
        <div class="kv total"><span>Dibayar sekarang</span><span>${rupiah(dp + buyTotal)}</span></div>
        ${problems ? `<div class="notice red" style="margin:12px 0"><i class="fa-solid fa-circle-exclamation"></i><div>Ada ${problems} item yang jumlahnya melebihi stok. Perbaiki dulu sebelum lanjut.</div></div>` : ''}
        <button class="btn btn-primary btn-block" id="goCheckout" style="margin-top:12px" ${problems ? 'disabled' : ''}>Lanjut ke checkout <i class="fa-solid fa-arrow-right"></i></button>
        <p class="muted" style="font-size:12.5px;margin-top:10px"><i class="fa-solid fa-circle-info"></i> Pembatalan sewa maksimal H-2 sebelum tanggal ambil, DP dikembalikan penuh.</p>
      </aside>
    </div>`;
    $('#goCheckout').addEventListener('click', () => (location.href = 'checkout'));
    $('#clearCart').addEventListener('click', async () => { if (await confirmBox({ title: 'Kosongkan keranjang?', text: 'Semua alat di keranjang akan dihapus.', ok: 'Kosongkan', danger: true })) { Cart.clear(); draw(); toast('Keranjang dikosongkan.'); } });
    const syn = $('#syncDates'); if (syn) syn.addEventListener('click', () => { setAll(syn.dataset.s, syn.dataset.e); });
    const chg = $('#chgDates'); if (chg) chg.addEventListener('click', () => UI.tripModal(() => { const t = DB.trip(); if (t) setAll(t.start, t.end); }));
  }
  root.addEventListener('click', (e) => {
    const item = e.target.closest('.cart-item'); if (!item) return;
    const key = item.dataset.key; const it = Cart.all().find((c) => c.key === key);
    const q = e.target.closest('[data-q]');
    if (q) { Cart.update(key, { qty: Math.max(1, it.qty + +q.dataset.q) }); draw(); }
    if (e.target.closest('[data-del]')) { Cart.remove(key); draw(); toast('Item dihapus dari keranjang.'); }
  });
  root.addEventListener('change', (e) => {
    const f = e.target.dataset.f; if (!f) return;
    const key = e.target.closest('.cart-item').dataset.key; const it = Cart.all().find((c) => c.key === key);
    if (f === 'qty') Cart.update(key, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) });
    if (f === 'start') { const s = e.target.value < D.today() ? D.today() : e.target.value; Cart.update(key, { start: s, end: it.end <= s ? D.addDays(s, 1) : it.end }); }
    if (f === 'end') { Cart.update(key, { end: e.target.value <= it.start ? D.addDays(it.start, 1) : e.target.value }); }
    draw();
  });
  draw();
})();

