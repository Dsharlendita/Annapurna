(function () {
  const { DB, Rules, D, rupiah } = Ann; const { $, $$, esc, asset, Cart, toast, validate, isPhone, isEmail } = UI;
  let user = DB.session();
  const cart = Cart.all();
  const root = $('#root');
  if (!cart.length) { location.replace('keranjang'); return; }
  const st = DB.settings();
  const rent = cart.filter((c) => c.type === 'rent'), buy = cart.filter((c) => c.type === 'buy');
  const rentTotal = rent.reduce((s, i) => s + Cart.lineTotal(i), 0);
  const buyTotal = buy.reduce((s, i) => s + Cart.lineTotal(i), 0);
  const dp = Math.round(rentTotal * st.dpPercent / 100);
  const earliest = rent.map((r) => r.start).sort()[0];
  const depOf = (it) => { if (it.kind === 'package') { const pk = DB.pkg(it.refId); return pk ? pk.items.reduce((a, x) => a + ((DB.product(x.productId) || {}).deposit || 0) * x.qty, 0) * it.qty : 0; } return ((DB.product(it.refId) || {}).deposit || 0) * it.qty; };
  const depositTotal = rent.reduce((a, it) => a + depOf(it), 0);

  const blocked = !!user && DB.blockedContact(user.email, user.phone);
  let promo = null;
  const promoCalc = () => (promo ? DB.checkPromo(promo, { rent: rentTotal, buy: buyTotal, starts: rent.map((r) => r.start) }) : null);
  function drawSum() {
    const pr = promoCalc(); const dr = pr && pr.ok ? pr.rent : 0, db = pr && pr.ok ? pr.buy : 0;
    const dpNow = Math.round((rentTotal - dr) * st.dpPercent / 100);
    $('#coSum').innerHTML = `${rent.length ? `<div class="kv"><span>Total sewa</span><span>${rupiah(rentTotal)}</span></div>${dr ? `<div class="kv"><span>Diskon sewa (${esc(pr.promo.code)})</span><span style="color:var(--g700)">− ${rupiah(dr)}</span></div>` : ''}<div class="kv hl"><span>DP ${st.dpPercent}%</span><span>${rupiah(dpNow)}</span></div>` : ''}
      ${buy.length ? `<div class="kv"><span>Total belanja</span><span>${rupiah(buyTotal)}</span></div>${db ? `<div class="kv"><span>Diskon belanja (${esc(pr.promo.code)})</span><span style="color:var(--g700)">− ${rupiah(db)}</span></div>` : ''}` : ''}
      ${depositTotal ? `<div class="kv dep-kv"><span>Jaminan <small>dibayar saat ambil, dikembalikan saat kembali</small></span><span>${rupiah(depositTotal)}</span></div>` : ''}
      <div class="kv total"><span>Dibayar sekarang</span><span id="payNow">${rupiah(dpNow + buyTotal - db)}</span></div>`;
    const sb = document.getElementById('coStickyAmt'); if (sb) sb.textContent = rupiah(dpNow + buyTotal - db);
  }
  root.innerHTML = `<form id="coForm" class="layout-2" novalidate>
    <div>
      <div class="card">
        <div class="card-title"><i class="fa-regular fa-id-card"></i> Data ${rent.length ? 'penyewa' : 'pembeli'}</div>
        ${user ? '' : `<div class="notice green guest-note"><i class="fa-solid fa-bolt"></i><div><strong>Tidak perlu daftar.</strong> Isi data di bawah, akunmu dibuat otomatis supaya kamu bisa cek pesanan kapan saja. Sudah punya akun? <a class="link" href="masuk?next=checkout">Masuk</a></div></div>`}
        <div class="grid-2">
          <div class="field"><label for="name">Nama lengkap</label><input class="input" id="name" name="name" value="${esc(user ? user.name : '')}" autocomplete="name"></div>
          <div class="field"><label for="phone">No. WhatsApp</label><input class="input" id="phone" name="phone" inputmode="tel" value="${esc(user ? user.phone || '' : '')}" autocomplete="tel" placeholder="08xxxxxxxxxx"></div>
        </div>
        <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" value="${esc(user ? user.email : '')}" autocomplete="email" placeholder="nama@email.com"></div>
        <div class="field"><label for="idType">Kartu identitas yang dibawa saat ambil</label><select class="select" id="idType" name="idType"><option>KTP</option><option>KTM (Kartu Mahasiswa)</option><option>SIM</option></select></div>
      </div>

      <div class="card">
        <div class="card-title"><i class="fa-solid fa-store"></i> Pengambilan barang</div>
        <div class="pickup-box">
          <span class="rc-ic"><i class="fa-solid fa-store"></i></span>
          <div><strong>Ambil &amp; kembalikan di toko</strong><small>${esc(st.address)}</small><small>${esc(st.hours || '')}</small></div>
          <a class="btn btn-light btn-xs" href="kontak#lokasi" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-location-dot"></i> Lihat peta</a>
        </div>
        <p class="deliv-hint"><i class="fa-solid fa-truck-fast"></i> <span>Ingin barang diantar? <a href="${UI.waLink('Halo admin Annapurna, saya ingin menanyakan apakah barang sewaan saya bisa diantar. Alamat saya: ')}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Hubungi admin via WhatsApp</a> untuk menanyakan ketersediaan dan ongkirnya.</span></p>
        <p class="muted" style="font-size:13px;margin-top:8px"><i class="fa-solid fa-circle-info"></i> Tunjukkan nota digital${rent.length ? ' dan kartu identitas asli' : ''} saat mengambil barang.</p>
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
        <div class="field" style="margin-top:14px"><label class="check"><input type="checkbox" name="agree" id="agree"> <span>Saya sudah membaca dan setuju dengan <a class="link" href="tentang#ketentuan" target="_blank" rel="noopener noreferrer">ketentuan sewa</a> dan kebijakan pembatalan.</span></label></div>` : ''}
    </div>

    <aside class="card sticky-side">
      <div class="card-title">Pesananmu</div>
      ${rent.length ? `<small class="muted" style="font-weight:700">SEWA</small>${rent.map((it) => { const r = Cart.resolve(it); return `<div class="mini-line"><img src="${asset(r.img)}" alt=""><div class="nm">${it.qty}× ${esc(r.name)}<small>${D.fmtRange(it.start, it.end)} · ${esc(Rules.tierLabel(r.tiers, Rules.rentalDays(it.start, it.end)))}</small></div><span>${rupiah(Cart.lineTotal(it))}</span></div>`; }).join('')}` : ''}
      ${buy.length ? `<small class="muted" style="font-weight:700;display:block;margin-top:10px">BELI</small>${buy.map((it) => { const r = Cart.resolve(it); return `<div class="mini-line"><img src="${asset(r.img)}" alt=""><div class="nm">${it.qty}× ${esc(r.name)}</div><span>${rupiah(Cart.lineTotal(it))}</span></div>`; }).join('')}` : ''}
      <div class="promo-box"><label for="promoIn"><i class="fa-solid fa-ticket"></i> Kode promo</label><div class="promo-row"><input class="input" id="promoIn" placeholder="Contoh: WEEKDAY15" autocomplete="off"><button type="button" class="btn btn-light btn-sm" id="promoBtn">Pakai</button></div><div id="promoMsg"></div></div>
      <div style="margin-top:10px" id="coSum"></div>
      ${blocked ? `<div class="notice red" style="margin-top:12px"><i class="fa-solid fa-user-lock"></i><div>Akunmu sedang tidak bisa membuat pesanan baru. Silakan hubungi admin Annapurna via WhatsApp.</div></div>` : ''}
      <button class="btn btn-primary btn-block" ${blocked ? 'disabled' : ''} type="submit" style="margin-top:14px">Buat pesanan &amp; bayar <i class="fa-solid fa-arrow-right"></i></button>
      <a class="btn btn-ghost btn-block btn-sm" href="keranjang" style="margin-top:6px"><i class="fa-solid fa-arrow-left"></i> Ubah keranjang</a>
    </aside>
    <div class="sticky-buy co-sticky"><div><small>Dibayar sekarang</small><b id="coStickyAmt">-</b></div><button class="btn btn-primary" type="submit" ${blocked ? 'disabled' : ''}>Buat pesanan <i class="fa-solid fa-arrow-right"></i></button></div>
  </form>`;
  document.body.classList.add('has-sticky');

  const form = $('#coForm');
  drawSum();
  const applyPromo = () => { const v = $('#promoIn').value.trim(); if (!v) { promo = null; $('#promoMsg').innerHTML = ''; drawSum(); return; }
    const r = DB.checkPromo(v, { rent: rentTotal, buy: buyTotal, starts: rent.map((x) => x.start) });
    promo = r.ok ? r.promo.code : null;
    $('#promoMsg').innerHTML = `<p class="promo-msg ${r.ok ? 'ok' : 'no'}"><i class="fa-solid ${r.ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${esc(r.ok ? `${r.promo.name}: hemat ${rupiah(r.rent + r.buy)}` : r.msg)}</p>`; drawSum(); };
  $('#promoBtn').addEventListener('click', applyPromo);
  $('#promoIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
  const pre = new URLSearchParams(location.search).get('promo'); if (pre) { $('#promoIn').value = pre; applyPromo(); }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    /* Paket berisi barang berukuran wajib sudah dipilih ukurannya */
    const noSz = Cart.all().filter((it) => it.type === 'rent' && it.kind === 'package' && ((Cart.resolve(it) || {}).missingSizes || []).length);
    if (noSz.length) { toast('Pilih dulu ukuran barang di paket (mis. sepatu / jaket) di keranjang.', 'err'); setTimeout(() => (location.href = UI.url('keranjang')), 900); return; }
    const ok = validate(form, {
      name: (v) => (v.length < 3 ? 'Isi nama lengkap.' : ''),
      phone: (v) => (!isPhone(v) ? 'Nomor WhatsApp tidak valid. Contoh: 081234567890.' : ''),
      email: (v) => (!isEmail(v) ? 'Format email belum benar.' : ''),
      agree: (v, el) => (!el.checked ? 'Centang persetujuan untuk melanjutkan.' : ''),
    });
    if (!ok) return;
    if (blocked) { toast('Akun ini tidak bisa membuat pesanan. Hubungi admin.', 'err'); return; }
    const F = { name: form.elements.name.value.trim(), phone: form.phone.value.trim(), email: form.email.value.trim() };
    if (!user) {
      const r = DB.quickAccount(F);
      if (r.status === 'blocked') { blockedNotice(); return; }
      if (r.status === 'staff') { toast('Email/nomor ini milik akun staff. Gunakan data pribadi customer.', 'err'); return; }
      if (r.status === 'exists') { loginFirst(r, F); return; }
      user = r.user; toast('Akunmu dibuat otomatis. Pesanan bisa dicek di menu Pesanan.');
    } else if (DB.blockedContact(F.email, F.phone)) { blockedNotice(); return; }
    proceed();
  });
  function blockedNotice() {
    UI.modal({ title: 'Pesanan tidak bisa dibuat', body: '<div class="notice red"><i class="fa-solid fa-user-lock"></i><div>Data ini sedang tidak bisa membuat pesanan baru. Silakan hubungi admin Annapurna via WhatsApp untuk informasi lebih lanjut.</div></div>', foot: `<a class="btn btn-primary" href="${UI.waLink('Halo Annapurna, saya tidak bisa membuat pesanan di website.')}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Hubungi admin</a>` });
  }
  function loginFirst(r, F) {
    const m = UI.modal({ title: 'Kamu sudah punya akun', body: `<p style="font-size:14px;margin-bottom:12px">${r.by === 'email' ? 'Email' : 'Nomor WhatsApp'} ini sudah terdaftar atas nama <strong>${esc(r.user.name)}</strong>. Masuk dulu untuk melanjutkan — isi keranjangmu tetap aman.</p>
      <div class="seg" id="lfTab" style="margin-bottom:14px"><button type="button" class="active" data-t="code">Kode verifikasi</button><button type="button" data-t="pw">Kata sandi</button></div>
      <div id="lfBody"></div>`, foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="lfOk">Masuk &amp; lanjutkan</button>' });
    let mode = 'code', sent = null;
    const draw = () => {
      m.$$('#lfTab button').forEach((b) => b.classList.toggle('active', b.dataset.t === mode));
      m.$('#lfBody').innerHTML = mode === 'pw' ? `<div class="field"><label>Kata sandi</label><input class="input" type="password" id="lfPw" autocomplete="current-password"></div>`
        : `<button type="button" class="btn btn-light btn-sm" id="lfSend"><i class="fa-solid fa-paper-plane"></i> ${sent ? 'Kirim ulang kode' : 'Kirim kode verifikasi'}</button>${sent ? `<p class="muted" style="font-size:13px;margin:10px 0">Kode 6 digit dikirim ke ${esc(sent.dest)}. <span class="otp-demo">Kode: <b>${sent.code}</b></span></p><div class="field"><label>Kode verifikasi</label><input class="input otp-in" id="lfCode" inputmode="numeric" maxlength="6" placeholder="••••••"></div>` : ''}`;
      const sb = m.$('#lfSend'); if (sb) sb.addEventListener('click', () => { const x = DB.sendLoginCode(r.user.email); if (!x.ok) { toast(x.msg, 'err'); return; } sent = x; draw(); m.$('#lfCode').focus(); });
    };
    m.$('#lfTab').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.t; draw(); } });
    draw();
    m.$('#lfOk').addEventListener('click', async () => {
      let res;
      if (mode === 'pw') {
        /* Kata sandi dicek server; akun di browser hanya disalin dari jawaban server */
        const s = await Api.busy(m.$('#lfOk'), () => Api.post('masuk', { email: r.user.email, password: (m.$('#lfPw') || {}).value || '' }, { redirectOn401: false }), 'Masuk…');
        if (!s) return;
        res = s.ok && s.raw && s.raw.user ? { ok: true, user: DB.adoptSession(s.raw.user) } : { ok: false, msg: s.msg };
      }
      else { if (!sent) { toast('Kirim kode verifikasi dulu.', 'err'); return; } res = DB.verifyLoginCode((m.$('#lfCode') || {}).value || ''); }
      if (!res.ok) { toast(res.msg || 'Gagal masuk.', 'err'); return; }
      user = DB.session(); m.close();
      if (DB.blockedContact(user.email, F.phone)) { blockedNotice(); return; }
      proceed();
    });
  }
  function proceed() {
    const pr = promoCalc(); const usePr = pr && pr.ok ? pr : null;
    const bad = cart.filter((it) => it.qty > Cart.availability(it));
    if (bad.length) { toast('Stok berubah untuk beberapa alat. Periksa lagi keranjangmu.', 'err'); setTimeout(() => (location.href = 'keranjang'), 1200); return; }

    const customer = { name: form.elements.name.value.trim(), phone: form.phone.value.trim(), email: user.email };
    const common = { customer, userEmail: user.email, method: form.elements.method.value, delivery: 'ambil', notes: form.notes.value.trim(), idType: form.idType.value, createdAt: D.nowStamp() };
    const ids = [];
    const groups = {};
    rent.forEach((it) => { const k = it.start + '|' + it.end; (groups[k] = groups[k] || []).push(it); });
    /* Durasi berbeda dalam satu checkout = beberapa booking → ditandai satu "pesanan gabungan" */
    const grp = Object.keys(groups).length > 1 ? 'GRP-' + Date.now().toString(36).toUpperCase() : null;
    Object.entries(groups).forEach(([k, items]) => {
      const [start, end] = k.split('|');
      const days = Rules.rentalDays(start, end);
      const lines = items.map((it) => { const r = Cart.resolve(it); return Object.assign({ kind: it.kind, refId: it.refId, name: r.name, img: r.img, qty: it.qty, pricePerDay: r.unit, tiers: r.tiers, components: r.components }, r.size ? { size: r.size } : {}); });
      const subtotal = Rules.itemsSubtotal(lines, days);
      const disc = usePr && usePr.rent ? (usePr.promo.type === 'persen' ? { code: usePr.promo.code, type: 'persen', value: usePr.promo.value, amount: 0 } : { code: usePr.promo.code, type: 'nominal', fixed: Math.round(usePr.rent * subtotal / rentTotal), amount: 0 }) : null;
      const dep = items.reduce((a, it) => a + depOf(it), 0);
      const b = Object.assign({}, common, { id: DB.nextId('RNT', DB.bookings()), items: lines, start, end, days, deposit: dep, subtotal, total: subtotal, dp: Math.round(subtotal * st.dpPercent / 100), fine: 0, discount: disc,
        status: 'menunggu_pembayaran', paymentStatus: 'unpaid', payments: [], refunds: [], changes: [], history: [{ at: D.nowStamp(), text: 'Booking dibuat' }] }, grp ? { group: grp } : {});
      Rules.recalc(b); if (!b.discount) delete b.discount;
      DB.saveBooking(b); ids.push(b.id);
      DB.notifyStaff('Booking baru masuk', `${customer.name} membuat booking ${NO(b)} untuk ${D.fmtRange(start, end)}.`, 'admin/booking?id=' + b.id);
    });
    if (buy.length) {
      const items = buy.map((it) => { const p = DB.product(it.refId); return Object.assign({ productId: p.id, name: DB.variantName(p, it.size), img: p.img, qty: it.qty, price: p.price }, it.size ? { size: it.size } : {}); });
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const dAmt = usePr ? usePr.buy : 0;
      const o = Object.assign({}, common, { id: DB.nextId('ORD', DB.sales()), items, subtotal, total: subtotal - dAmt, ...(dAmt ? { discount: { code: usePr.promo.code, amount: dAmt } } : {}), delivery: 'ambil', status: 'menunggu_pembayaran', paymentStatus: 'unpaid', payments: [], history: [{ at: D.nowStamp(), text: 'Pesanan dibuat' }] });
      DB.saveSale(o); ids.push(o.id);
      DB.notifyStaff('Pesanan pembelian baru', `${customer.name} membuat pesanan ${NO(o)}.`, 'admin/penjualan?id=' + o.id);
    }
    if (usePr) DB.usePromo(usePr.promo.code);
    Cart.clear();
    location.href = 'pembayaran?ids=' + ids.join(',');
  }
})();

