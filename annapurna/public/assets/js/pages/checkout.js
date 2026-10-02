(function () {
  const { DB, Rules, D, rupiah } = Ann; const { $, $$, esc, asset, Cart, toast, validate, isPhone, isEmail } = UI;
  const user = Site.requireLogin(); if (!user) return;
  const cart = Cart.all();
  const root = $('#root');
  if (!cart.length) { location.replace('keranjang'); return; }
  const st = DB.settings();
  const rent = cart.filter((c) => c.type === 'rent'), buy = cart.filter((c) => c.type === 'buy');
  const rentTotal = rent.reduce((s, i) => s + Cart.lineTotal(i), 0);
  const buyTotal = buy.reduce((s, i) => s + Cart.lineTotal(i), 0);
  const dp = Math.round(rentTotal * st.dpPercent / 100);
  const earliest = rent.map((r) => r.start).sort()[0];

  root.innerHTML = `<form id="coForm" class="layout-2" novalidate>
    <div>
      <div class="card">
        <div class="card-title"><i class="fa-regular fa-id-card"></i> Data penyewa</div>
        <div class="grid-2">
          <div class="field"><label for="name">Nama lengkap</label><input class="input" id="name" name="name" value="${esc(user.name)}"></div>
          <div class="field"><label for="phone">No. WhatsApp</label><input class="input" id="phone" name="phone" inputmode="tel" value="${esc(user.phone || '')}"></div>
        </div>
        <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" value="${esc(user.email)}"></div>
        <div class="field"><label for="idType">Kartu identitas yang dibawa saat ambil</label><select class="select" id="idType" name="idType"><option>KTP</option><option>KTM (Kartu Mahasiswa)</option><option>SIM</option></select></div>
      </div>

      <div class="card">
        <div class="card-title"><i class="fa-solid fa-store"></i> Pengambilan barang</div>
        <div class="pickup-box">
          <span class="rc-ic"><i class="fa-solid fa-store"></i></span>
          <div><strong>Ambil &amp; kembalikan di toko</strong><small>${esc(st.address)}</small><small>${esc(st.hours || '')}</small></div>
          <a class="btn btn-light btn-xs" href="kontak#lokasi" target="_blank"><i class="fa-solid fa-location-dot"></i> Lihat peta</a>
        </div>
        <p class="muted" style="font-size:13px;margin-top:8px"><i class="fa-solid fa-circle-info"></i> Annapurna Adventure tidak menyediakan layanan antar. Tunjukkan nota digital${rent.length ? ' dan kartu identitas asli' : ''} saat mengambil barang.</p>
        <div class="field" style="margin-top:14px"><label for="notes">Catatan untuk admin <span class="muted">(opsional)</span></label><input class="input" id="notes" name="notes" placeholder="Contoh: ambil sore sekitar jam 4"></div>
      </div>

      <div class="card">
        <div class="card-title"><i class="fa-regular fa-credit-card"></i> Metode pembayaran</div>
        <div class="radio-cards">
          ${st.banks.map((b, i) => `<label class="radio-card"><input type="radio" name="method" value="Transfer ${esc(b.bank)}" ${i === 0 ? 'checked' : ''}><span class="rc-ic"><i class="fa-solid fa-building-columns"></i></span><span><strong>Transfer ${esc(b.bank)}</strong><small>a.n. ${esc(b.holder)}</small></span></label>`).join('')}
          <label class="radio-card"><input type="radio" name="method" value="QRIS"><span class="rc-ic"><i class="fa-solid fa-qrcode"></i></span><span><strong>QRIS</strong><small>GoPay, OVO, DANA, ShopeePay, m-banking</small></span></label>
        </div>
      </div>

      ${rent.length ? `<div class="notice" style="margin-top:18px"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Kebijakan pembatalan sewa</strong><ul>${st.cancelPolicy.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <p style="margin-top:6px">Tanggal ambil paling awal: <strong>${D.fmtDate(earliest, true)}</strong>. Batas pembatalan dengan DP kembali: <strong>${D.fmtDate(D.addDays(earliest, -st.cancelDays), true)}</strong>.</p></div></div>
        <div class="field" style="margin-top:14px"><label class="check"><input type="checkbox" name="agree" id="agree"> <span>Saya sudah membaca dan setuju dengan <a class="link" href="tentang#ketentuan" target="_blank">ketentuan sewa</a> dan kebijakan pembatalan.</span></label></div>` : ''}
    </div>

    <aside class="card sticky-side">
      <div class="card-title">Pesananmu</div>
      ${rent.length ? `<small class="muted" style="font-weight:700">SEWA</small>${rent.map((it) => { const r = Cart.resolve(it); return `<div class="mini-line"><img src="${asset(r.img)}" alt=""><div class="nm">${it.qty}× ${esc(r.name)}<small>${D.fmtRange(it.start, it.end)} · ${Rules.rentalDays(it.start, it.end)} hari</small></div><span>${rupiah(Cart.lineTotal(it))}</span></div>`; }).join('')}` : ''}
      ${buy.length ? `<small class="muted" style="font-weight:700;display:block;margin-top:10px">BELI</small>${buy.map((it) => { const r = Cart.resolve(it); return `<div class="mini-line"><img src="${asset(r.img)}" alt=""><div class="nm">${it.qty}× ${esc(r.name)}</div><span>${rupiah(Cart.lineTotal(it))}</span></div>`; }).join('')}` : ''}
      <div style="margin-top:10px">
        ${rent.length ? `<div class="kv"><span>Total sewa</span><span>${rupiah(rentTotal)}</span></div><div class="kv hl"><span>DP ${st.dpPercent}%</span><span>${rupiah(dp)}</span></div>` : ''}
        ${buy.length ? `<div class="kv"><span>Total belanja</span><span>${rupiah(buyTotal)}</span></div>` : ''}
        <div class="kv total"><span>Dibayar sekarang</span><span id="payNow">${rupiah(dp + buyTotal)}</span></div>
      </div>
      <button class="btn btn-primary btn-block" type="submit" style="margin-top:14px">Buat pesanan &amp; bayar <i class="fa-solid fa-arrow-right"></i></button>
      <a class="btn btn-ghost btn-block btn-sm" href="keranjang" style="margin-top:6px"><i class="fa-solid fa-arrow-left"></i> Ubah keranjang</a>
    </aside>
  </form>`;

  const form = $('#coForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = validate(form, {
      name: (v) => (v.length < 3 ? 'Isi nama lengkap.' : ''),
      phone: (v) => (!isPhone(v) ? 'Nomor WhatsApp tidak valid. Contoh: 081234567890.' : ''),
      email: (v) => (!isEmail(v) ? 'Format email belum benar.' : ''),
      agree: (v, el) => (!el.checked ? 'Centang persetujuan untuk melanjutkan.' : ''),
    });
    if (!ok) return;
    const bad = cart.filter((it) => it.qty > Cart.availability(it));
    if (bad.length) { toast('Stok berubah untuk beberapa alat. Periksa lagi keranjangmu.', 'err'); setTimeout(() => (location.href = 'keranjang'), 1200); return; }

    const customer = { name: form.elements.name.value.trim(), phone: form.phone.value.trim(), email: form.email.value.trim() };
    const common = { customer, userEmail: user.email, method: form.elements.method.value, delivery: 'ambil', notes: form.notes.value.trim(), idType: form.idType.value, createdAt: D.nowStamp() };
    const ids = [];
    const groups = {};
    rent.forEach((it) => { const k = it.start + '|' + it.end; (groups[k] = groups[k] || []).push(it); });
    Object.entries(groups).forEach(([k, items]) => {
      const [start, end] = k.split('|');
      const days = Rules.rentalDays(start, end);
      const lines = items.map((it) => { const r = Cart.resolve(it); return Object.assign({ kind: it.kind, refId: it.refId, name: r.name, img: r.img, qty: it.qty, pricePerDay: r.unit, components: r.components }, r.size ? { size: r.size } : {}); });
      const subtotal = lines.reduce((s, l) => s + l.pricePerDay * l.qty, 0) * days;
      const b = Object.assign({}, common, { id: DB.nextId('RNT', DB.bookings()), items: lines, start, end, days, subtotal, total: subtotal, dp: Math.round(subtotal * st.dpPercent / 100), fine: 0,
        status: 'menunggu_pembayaran', paymentStatus: 'unpaid', payments: [], refunds: [], changes: [], history: [{ at: D.nowStamp(), text: 'Booking dibuat' }] });
      DB.saveBooking(b); ids.push(b.id);
      DB.notifyStaff('Booking baru masuk', `${customer.name} membuat booking ${b.id} untuk ${D.fmtRange(start, end)}.`, 'admin/booking?id=' + b.id);
    });
    if (buy.length) {
      const items = buy.map((it) => { const p = DB.product(it.refId); return Object.assign({ productId: p.id, name: DB.variantName(p, it.size), img: p.img, qty: it.qty, price: p.price }, it.size ? { size: it.size } : {}); });
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const o = Object.assign({}, common, { id: DB.nextId('ORD', DB.sales()), items, subtotal, total: subtotal, delivery: 'ambil', status: 'menunggu_pembayaran', paymentStatus: 'unpaid', payments: [], history: [{ at: D.nowStamp(), text: 'Pesanan dibuat' }] });
      DB.saveSale(o); ids.push(o.id);
      DB.notifyStaff('Pesanan pembelian baru', `${customer.name} membuat pesanan ${o.id}.`, 'admin/penjualan?id=' + o.id);
    }
    Cart.clear();
    location.href = 'pembayaran?ids=' + ids.join(',');
  });
})();

