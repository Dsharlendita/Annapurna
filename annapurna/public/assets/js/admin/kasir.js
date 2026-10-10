/* Kasir digital: pesanan offline (sewa & jual) yang dicatat staff di toko.
   - Sewa: "Diambil sekarang" → langsung dicatat barang keluar (Sedang disewa), atau "Diambil nanti" (DP / lunas).
   - Jual: stok berkurang, pesanan langsung Selesai.
   - Pembayaran tercatat di Keuangan dengan keterangan "Kasir · <metode>".
   - Nota: struk thermal 58 mm / 80 mm, nota A4 (halaman nota), atau kirim ke WhatsApp customer. */
(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, D, rupiah } = Ann;
  const { $, $$, esc, asset, toast, modal, Cart } = UI;
  Admin.init('kasir', 'Kasir');
  const me = Admin.me;
  const T = D.today();
  const st = DB.settings();
  const RC = Object.assign({ paper: 58, footerRent: 'Bawa struk ini & kartu identitas saat mengembalikan barang.', footerSale: 'Barang yang sudah dibeli tidak dapat ditukar kecuali cacat produksi.' }, st.receipt || {});
  const ALT = RC.paper === 80 ? 58 : 80;

  const S = {
    mode: 'rent', q: '', cat: '',
    pickup: 'now', start: T, end: D.addDays(T, 1),
    items: [], // { key, kind, refId, size, sizes, qty }
    name: '', phone: '', idType: 'KTP', note: '',
    disc: 0, payOpt: 'lunas', method: 'Tunai', received: 0,
  };
  const days = () => Math.max(1, Rules.rentalDays(S.start, S.end));
  const keyOf = (it) => [it.kind, it.refId, it.size || '', JSON.stringify(it.sizes || {})].join('|');
  const cartItem = (it) => Object.assign({ type: 'rent', kind: it.kind, refId: it.refId, qty: it.qty, start: S.start, end: S.end }, it.size ? { size: it.size } : {}, it.sizes ? { sizes: it.sizes } : {});

  /* ---------- Katalog kiri ---------- */
  function drawCats() {
    const cats = DB.categories().filter((c) => c.active !== false);
    $('#kCats').innerHTML = [`<button type="button" class="chip ${!S.cat ? 'on' : ''}" data-c="">Semua</button>`, ...(S.mode === 'rent' ? [`<button type="button" class="chip ${S.cat === 'paket' ? 'on' : ''}" data-c="paket"><i class="fa-solid fa-box-open"></i> Paket</button>`] : []),
      ...cats.map((c) => `<button type="button" class="chip ${S.cat === c.id ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}</button>`)].join('');
  }
  function drawDates() {
    if (S.mode !== 'rent') { $('#kDates').innerHTML = ''; return; }
    $('#kDates').innerHTML = `<div class="kd-row">
      <div class="seg kd-pick" role="radiogroup" aria-label="Waktu ambil"><button type="button" data-p="now" class="${S.pickup === 'now' ? 'active' : ''}"><i class="fa-solid fa-person-walking-luggage"></i> Diambil sekarang</button><button type="button" data-p="later" class="${S.pickup === 'later' ? 'active' : ''}"><i class="fa-regular fa-calendar"></i> Diambil nanti</button></div>
      <label>Ambil<input type="date" class="input" id="kStart" value="${S.start}" min="${T}" ${S.pickup === 'now' ? 'disabled' : ''}></label>
      <label>Kembali<input type="date" class="input" id="kEnd" value="${S.end}" min="${D.addDays(S.start, 1)}"></label>
      <div class="kd-dur">${[[1, 'Per malam'], [3, '3H3M'], [5, '5H5M']].map(([n, l]) => `<button type="button" class="chip ${days() === n ? 'on' : ''}" data-d="${n}">${l}</button>`).join('')}</div>
    </div><p class="muted kd-info">${days()} malam · kembali paling lambat <b>${D.fmtDate(S.end, true)} pukul ${String(st.returnTime || '22:00').replace(':', '.')} WIB</b> · stok di bawah sesuai tanggal ini</p>`;
  }
  function list() {
    const q = S.q.toLowerCase();
    if (S.mode === 'rent' && S.cat === 'paket') return DB.packages().filter((k) => k.active !== false && (!q || k.name.toLowerCase().includes(q))).map((k) => ({ kind: 'package', x: k }));
    const P = DB.products().filter((p) => p.active !== false && (S.mode === 'rent' ? p.rent > 0 : p.price > 0) && (!S.cat || p.cat === S.cat) && (!q || `${p.name} ${p.sku || ''} ${p.brand || ''}`.toLowerCase().includes(q)));
    const pk = S.mode === 'rent' && !S.cat ? DB.packages().filter((k) => k.active !== false && (!q || k.name.toLowerCase().includes(q))).map((k) => ({ kind: 'package', x: k })) : [];
    return [...P.map((p) => ({ kind: 'product', x: p })), ...pk];
  }
  function stockOf(kind, x) {
    if (S.mode === 'buy') return DB.saleableStock(x);
    return Cart.availability({ type: 'rent', kind, refId: x.id, qty: 1, start: S.start, end: S.end });
  }
  function drawGrid() {
    const L = list();
    $('#kGrid').innerHTML = L.length ? L.map(({ kind, x }) => {
      const n = stockOf(kind, x);
      const price = S.mode === 'buy' ? rupiah(x.price) : `${rupiah(Rules.unitPrice(x, days()))}<small> / ${days()} malam</small>`;
      return `<button type="button" class="k-item ${n <= 0 ? 'out' : ''}" data-add="${kind}|${x.id}" ${n <= 0 ? 'disabled' : ''}>
        <img src="${asset(x.img)}" alt="" loading="lazy"><span class="k-nm">${kind === 'package' ? '<span class="pill gray plain">Paket</span> ' : ''}${esc(x.name)}</span>
        <span class="k-pr">${price}</span><span class="k-st ${n <= 2 ? 'low' : ''}">${n <= 0 ? 'Habis' : `Sisa ${n}`}</span></button>`;
    }).join('') : '<p class="muted" style="grid-column:1/-1;padding:20px">Barang tidak ditemukan.</p>';
  }

  /* ---------- Tambah barang (pilih ukuran bila perlu) ---------- */
  function add(kind, id) {
    if (kind === 'product') {
      const p = DB.product(id);
      if (DB.hasVariant(p)) return pickSize(p);
      return push({ kind, refId: id, qty: 1 });
    }
    const pk = DB.pkg(id); const sized = Rules.packageSized(pk);
    if (!sized.length) return push({ kind, refId: id, qty: 1 });
    const m = modal({ title: `Ukuran isi ${pk.name}`, body: sized.map((x) => `<div class="field"><label>${esc(x.product.name)}</label><select class="select" data-k="${x.k}">${Rules.sizeAvailability(x.productId, S.start, S.end).map((o) => `<option value="${esc(o.name)}" ${o.avail < x.qty ? 'disabled' : ''}>${esc(o.name.replace(/\s*\(.*\)/, ''))} ${o.avail < x.qty ? '(habis)' : `(sisa ${o.avail})`}</option>`).join('')}</select></div>`).join(''),
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="kSz">Tambahkan</button>' });
    m.$('#kSz').addEventListener('click', () => { const sizes = {}; m.$$('[data-k]').forEach((s) => { sizes[s.dataset.k] = s.value; }); m.close(); push({ kind, refId: id, qty: 1, sizes }); });
  }
  function pickSize(p) {
    const opts = S.mode === 'buy' ? p.variant.options.map((o) => ({ name: o.name, avail: DB.saleableStock(p, o.name) })) : Rules.sizeAvailability(p.id, S.start, S.end);
    const m = modal({ title: `Pilih ${p.variant.label || 'ukuran'} · ${p.name}`, body: `<div class="k-sizes">${opts.map((o) => `<button type="button" class="size-btn" data-sz="${esc(o.name)}" ${o.avail <= 0 ? 'disabled' : ''}><b>${esc(o.name.replace(/\s*\(.*\)/, ''))}</b><small>${o.avail <= 0 ? 'habis' : `${o.avail} tersedia`}</small></button>`).join('')}</div>`, foot: '<button class="btn btn-light" data-close>Batal</button>' });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-sz]'); if (!b) return; m.close(); push({ kind: 'product', refId: p.id, size: b.dataset.sz, qty: 1 }); });
  }
  function push(it) {
    it.key = keyOf(it);
    const ex = S.items.find((x) => x.key === it.key);
    if (ex) ex.qty += it.qty; else S.items.push(it);
    if (!fits(ex || it)) { (ex || it).qty -= 1; if (!(ex || it).qty) S.items = S.items.filter((x) => x !== (ex || it)); toast('Stok tidak cukup untuk menambah barang ini.', 'err'); }
    drawBill();
  }
  function fits(it) {
    if (S.mode === 'buy') return DB.saleableStock(DB.product(it.refId), it.size) >= it.qty;
    return Cart.availability(cartItem(it)) >= it.qty;
  }

  /* ---------- Rincian transaksi (kanan) ---------- */
  function lines() {
    if (S.mode === 'buy') return S.items.map((it) => { const p = DB.product(it.refId); return { it, name: DB.variantName(p, it.size), img: p.img, unit: p.price, total: p.price * it.qty, sub: `${it.qty} × ${rupiah(p.price)}` }; });
    return S.items.map((it) => { const r = Cart.resolve(cartItem(it)); const unit = Rules.lineUnit({ pricePerDay: r.unit, tiers: r.tiers }, days());
      return { it, r, name: r.name, img: r.img, unit, total: unit * it.qty, sub: `${it.qty} × ${rupiah(unit)} · ${Rules.tierLabel(r.tiers || { d1: r.unit }, days())}` }; });
  }
  const totals = () => { const L = lines(); const sub = L.reduce((a, x) => a + x.total, 0); const disc = Math.min(sub, Math.max(0, +S.disc || 0)); const total = sub - disc;
    const payNow = S.mode === 'rent' && S.pickup === 'later' && S.payOpt === 'dp' ? Math.round(total * st.dpPercent / 100) : total;
    return { L, sub, disc, total, payNow, change: S.method === 'Tunai' ? Math.max(0, (+S.received || 0) - payNow) : 0 }; };

  function drawBill() {
    const t = totals();
    $('#kBill').innerHTML = `
      <div class="kb-h"><h3><i class="fa-solid fa-receipt"></i> ${S.mode === 'rent' ? 'Transaksi sewa' : 'Transaksi jual'}</h3><small class="muted">No. nota dibuat otomatis saat disimpan (format 001/${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date().getMonth()]}/${new Date().getFullYear()})</small></div>
      <div class="kb-items">${t.L.length ? t.L.map((x, i) => `<div class="kb-it"><img src="${asset(x.img)}" alt=""><div class="kb-nm"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></div>
        <div class="qty sm"><button type="button" data-q="-1" data-i="${i}" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input value="${x.it.qty}" readonly aria-label="Jumlah"><button type="button" data-q="1" data-i="${i}" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div>
        <span class="kb-pr">${rupiah(x.total)}</span><button type="button" class="icon-btn sm" data-del="${i}" aria-label="Hapus"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : '<div class="kb-empty"><i class="fa-solid fa-basket-shopping"></i><p>Klik barang di kiri untuk menambahkannya.</p></div>'}</div>
      <div class="kb-sec"><h4>Customer</h4>
        <div class="grid-2"><div class="field"><label>Nama <span class="req">*</span></label><input class="input" id="kName" value="${esc(S.name)}" placeholder="Nama customer"></div>
        <div class="field"><label>No. WhatsApp <span class="req">*</span></label><input class="input" id="kPhone" value="${esc(S.phone)}" placeholder="08xxxxxxxxxx" inputmode="tel"></div></div>
        ${S.mode === 'rent' ? `<div class="field"><label>Kartu identitas jaminan <span class="req">*</span></label><select class="select" id="kId">${['KTP', 'KTM', 'SIM'].map((x) => `<option ${S.idType === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>Catatan <span class="opt">(opsional)</span></label><input class="input" id="kNote" value="${esc(S.note)}" placeholder="Contoh: ambil jam 4 sore"></div>
      </div>
      <div class="kb-sec"><h4>Pembayaran</h4>
        <div class="kv"><span>Subtotal</span><span>${rupiah(t.sub)}</span></div>
        <div class="kv"><span>Diskon (Rp)</span><span><input class="input sm" id="kDisc" inputmode="numeric" value="${S.disc ? Number(S.disc).toLocaleString('id-ID') : ''}" placeholder="0"></span></div>
        <div class="kv total"><span>Total</span><span>${rupiah(t.total)}</span></div>
        ${S.mode === 'rent' && S.pickup === 'later' ? `<div class="seg kb-opt"><button type="button" data-o="dp" class="${S.payOpt === 'dp' ? 'active' : ''}">DP ${st.dpPercent}%</button><button type="button" data-o="lunas" class="${S.payOpt === 'lunas' ? 'active' : ''}">Lunas</button></div>` : ''}
        <div class="kv hl"><span>Dibayar sekarang</span><span>${rupiah(t.payNow)}</span></div>
        <div class="seg kb-opt" aria-label="Metode">${['Tunai', 'Transfer', 'QRIS'].map((x) => `<button type="button" data-m="${x}" class="${S.method === x ? 'active' : ''}">${x}</button>`).join('')}</div>
        ${S.method === 'Tunai' ? `<div class="field"><label>Uang diterima</label><input class="input" id="kRecv" inputmode="numeric" value="${S.received ? Number(S.received).toLocaleString('id-ID') : ''}" placeholder="0">
          <div class="kb-quick">${[t.payNow, Math.ceil(t.payNow / 50000) * 50000, Math.ceil(t.payNow / 100000) * 100000, Math.ceil((t.payNow + 1) / 100000) * 100000 + 100000].filter((v, i, a) => v > 0 && v >= t.payNow && a.indexOf(v) === i).slice(0, 4).map((v, i) => `<button type="button" class="chip" data-r="${v}">${i === 0 ? 'Uang pas' : rupiah(v)}</button>`).join('')}</div></div>
          <div class="kv kb-change ${(+S.received || 0) && (+S.received || 0) < t.payNow ? 'neg' : ''}"><span>${(+S.received || 0) && (+S.received || 0) < t.payNow ? 'Kurang' : 'Kembalian'}</span><span>${rupiah((+S.received || 0) && (+S.received || 0) < t.payNow ? t.payNow - S.received : t.change)}</span></div>` : ''}
      </div>
      <button type="button" class="btn btn-primary btn-block btn-lg" id="kSave" ${t.L.length ? '' : 'disabled'}><i class="fa-solid fa-check"></i> ${S.mode === 'rent' && S.pickup === 'now' ? 'Simpan & catat barang keluar' : 'Simpan transaksi'}</button>
      ${t.L.length ? '<button type="button" class="btn btn-ghost btn-block btn-sm" id="kReset">Kosongkan transaksi</button>' : ''}`;
  }
  const num = (v) => +String(v || '').replace(/[^\d]/g, '') || 0;

  /* ---------- Simpan ---------- */
  function save() {
    const t = totals();
    S.name = $('#kName').value.trim(); S.phone = $('#kPhone').value.trim(); S.note = $('#kNote').value.trim(); if ($('#kId')) S.idType = $('#kId').value;
    if (S.name.length < 2) { toast('Isi nama customer.', 'err'); $('#kName').focus(); return; }
    if (!UI.isPhone(S.phone)) { toast('Nomor WhatsApp tidak valid. Contoh: 081234567890.', 'err'); $('#kPhone').focus(); return; }
    if (S.items.some((it) => !fits(it))) { toast('Ada barang yang stoknya tidak cukup. Periksa lagi jumlahnya.', 'err'); drawGrid(); return; }
    if (S.method === 'Tunai' && num(S.received) < t.payNow) { toast(`Uang diterima kurang dari ${rupiah(t.payNow)}.`, 'err'); return; }
    const customer = { name: S.name, phone: S.phone, email: '' };
    const via = `Kasir · ${S.method}`;
    const kasir = { by: me.name, method: S.method, received: S.method === 'Tunai' ? num(S.received) : t.payNow, change: t.change, at: D.nowStamp() };
    if (S.mode === 'buy') {
      const items = S.items.map((it) => { const p = DB.product(it.refId); return Object.assign({ productId: p.id, name: DB.variantName(p, it.size), img: p.img, qty: it.qty, price: p.price }, it.size ? { size: it.size } : {}); });
      const o = { id: DB.nextId('ORD', DB.sales()), customer, userEmail: '', method: S.method, delivery: 'ambil', notes: S.note, channel: 'offline', kasir, createdAt: D.nowStamp(), items, subtotal: t.sub, total: t.total,
        ...(t.disc ? { discount: { code: 'KASIR', amount: t.disc } } : {}), status: 'selesai', paymentStatus: 'paid', payments: [{ at: D.nowStamp(), amount: t.total, type: 'Pembayaran', via }],
        history: [{ at: D.nowStamp(), text: `Penjualan offline di kasir oleh ${me.name} (${S.method})` }] };
      DB.sellStock(o.items, 1);
      DB.saveSale(o);
      reset(); /* form langsung kosong setelah tersimpan (mencegah tersimpan dua kali) */
      DB.audit({ type: 'penjualan', action: `Kasir: penjualan offline ${NO(o)} · ${items.map((i) => `${i.qty}× ${i.name}`).join(', ')} · ${rupiah(o.total)} (${S.method})`, ref: o.id });
      done(DB.sale(o.id), 'sale');
      return;
    }
    const lns = t.L.map((x) => Object.assign({ kind: x.it.kind, refId: x.it.refId, name: x.r.name, img: x.r.img, qty: x.it.qty, pricePerDay: x.r.unit, tiers: x.r.tiers, components: x.r.components }, x.r.size ? { size: x.r.size } : {}));
    const b = { id: DB.nextId('RNT', DB.bookings()), customer, userEmail: '', method: S.method, delivery: 'ambil', notes: S.note, idType: S.idType, channel: 'offline', kasir, createdAt: D.nowStamp(),
      items: lns, start: S.start, end: S.end, days: days(), deposit: 0, subtotal: t.sub, total: t.sub, dp: Math.round(t.sub * st.dpPercent / 100), fine: 0,
      ...(t.disc ? { discount: { code: 'KASIR', type: 'nominal', fixed: t.disc, amount: t.disc } } : {}),
      status: 'dikonfirmasi', paymentStatus: t.payNow >= t.total ? 'lunas' : 'dp_paid',
      payments: [{ at: D.nowStamp(), amount: t.payNow, type: t.payNow >= t.total ? 'Lunas' : 'DP', via }], refunds: [], changes: [],
      history: [{ at: D.nowStamp(), text: `Booking offline di kasir oleh ${me.name} (${S.method})` }] };
    Rules.recalc(b); if (b.paymentStatus === 'dp_paid') b.dp = t.payNow;
    DB.saveBooking(b);
    reset(); /* form langsung kosong setelah tersimpan (mencegah tersimpan dua kali) */
    DB.audit({ type: 'rental', action: `Kasir: sewa offline ${NO(b)} · ${Admin.itemsText(b)} · ${D.fmtRange(b.start, b.end)} · dibayar ${rupiah(t.payNow)} (${S.method})`, ref: b.id });
    /* Ambil sekarang: buka Catat barang keluar. Bila jendela itu ditutup tanpa disimpan, booking tetap tercatat (Dikonfirmasi & lunas)
       dan barang bisa dicatat keluar nanti dari menu Barang Keluar & Kembali. */
    if (S.pickup === 'now') { let ok = false; Admin.BK.pickup(DB.booking(b.id), () => { ok = true; done(DB.booking(b.id), 'rent'); });
      const watch = setInterval(() => { if (ok) { clearInterval(watch); return; } if (!document.querySelector('.modal')) { clearInterval(watch); done(DB.booking(b.id), 'rent'); } }, 400); }
    else done(DB.booking(b.id), 'rent');
  }

  /* ---------- Nota: struk thermal 58/80 mm & A4 ---------- */
  function strukHtml(x, kind, mm) {
    const L = kind === 'sale' ? x.items.map((i) => [i.name, `${i.qty} x ${rupiah(i.price)}`, rupiah(i.qty * i.price)]) : x.items.map((i) => [i.name, `${i.qty} x ${rupiah(Rules.lineUnit(i, x.days))}`, rupiah(i.qty * Rules.lineUnit(i, x.days))]);
    const paid = Rules.paidTotal(x), k = x.kasir || {};
    const row = (a, b, cls) => `<div class="r ${cls || ''}"><span>${a}</span><span>${b}</span></div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${esc(NO(x))}</title><style>
      @page { size: ${mm}mm 200mm; margin: 0; } * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { width: ${mm}mm; padding: 3mm ${mm === 58 ? 2.5 : 4}mm 6mm; font: ${mm === 58 ? 10.5 : 12}px/1.35 'Courier New', monospace; color: #000; }
      .c { text-align: center; } h1 { font-size: 1.25em; margin: 0; letter-spacing: .05em; } .s { font-size: .9em; }
      hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; } .r { display: flex; justify-content: space-between; gap: 6px; } .r span:last-child { text-align: right; white-space: nowrap; }
      .b { font-weight: 700; } .it { margin: 3px 0; } .big { font-size: 1.15em; font-weight: 700; }
    </style></head><body>
      <div class="c"><h1>ANNAPURNA ADVENTURE</h1><div class="s">${esc(st.address || '')}<br>WA ${esc(st.phone || '')}</div></div><hr>
      ${row('No. nota', esc(NO(x)), 'b')}${row('Tanggal', D.fmtDateTime(x.createdAt))}${row('Kasir', esc(k.by || me.name))}${row('Customer', esc(x.customer.name))}
      ${kind === 'rent' ? `${row('Sewa', D.fmtRange(x.start, x.end) + ' · ' + x.days + ' mlm')}${row('Kembali maks.', D.fmtDate(x.end) + ' 22.00')}` : ''}<hr>
      ${L.map(([n, q, tot]) => `<div class="it"><div>${esc(n)}</div>${row(q, tot)}</div>`).join('')}<hr>
      ${row('Subtotal', rupiah(x.subtotal))}${x.discount ? row('Diskon', '- ' + rupiah(x.discount.amount || x.discount.fixed || 0)) : ''}${row('TOTAL', rupiah(x.total), 'big')}
      ${row('Dibayar (' + esc(k.method || x.method) + ')', rupiah(paid))}${k.method === 'Tunai' ? row('Tunai', rupiah(k.received || paid)) + row('Kembalian', rupiah(k.change || 0)) : ''}
      ${x.total - paid > 0 ? row('Sisa bayar saat ambil', rupiah(x.total - paid), 'b') : ''}<hr>
      <div class="c s">${esc((kind === 'rent' ? RC.footerRent : RC.footerSale) || '')}<br><b>Terima kasih!</b><br>IG ${esc(st.instagram || '@annapurna_adv')}</div>
      <script>window.onload = () => { /* Tinggi kertas = panjang isi struk (bukan A4) */ const h = Math.ceil(document.body.scrollHeight * 25.4 / 96) + 4; const s = document.createElement('style'); s.textContent = '@page { size: ${mm}mm ' + h + 'mm; margin: 0; }'; document.head.appendChild(s); setTimeout(() => { window.print(); setTimeout(() => window.close(), 300); }, 120); };<\/script></body></html>`;
  }
  function printStruk(x, kind, mm) {
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) { toast('Izinkan pop-up di browser untuk mencetak struk.', 'err'); return; }
    w.document.open(); w.document.write(strukHtml(x, kind, mm)); w.document.close();
  }
  function done(x, kind) {
    const k = x.kasir || {};
    const link = location.origin + UI.url('invoice?id=' + x.id);
    const wa = `Halo ${x.customer.name}, terima kasih sudah ${kind === 'rent' ? 'menyewa' : 'berbelanja'} di Annapurna Adventure.\nNo. nota: ${NO(x)}\nTotal: ${rupiah(x.total)} · dibayar ${rupiah(Rules.paidTotal(x))} (${k.method || x.method})${kind === 'rent' ? `\nSewa: ${D.fmtRange(x.start, x.end)}, kembali paling lambat ${D.fmtDate(x.end, true)} pukul 22.00 WIB` : ''}\nNota digital: ${link}`;
    const m = modal({ title: `Transaksi tersimpan · ${NO(x)}`, body: `
      <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-circle-check"></i><div><b>${kind === 'rent' ? (x.status === 'disewa' ? 'Sewa offline tersimpan, barang sudah keluar.' : x.start <= D.today() ? 'Sewa offline tersimpan, tapi barang BELUM dicatat keluar.' : 'Booking offline tersimpan, barang diambil ' + D.fmtDate(x.start, true) + '.') : 'Penjualan offline tersimpan, stok sudah berkurang.'}</b>${kind === 'rent' && x.status !== 'disewa' && x.start <= D.today() ? `<br><a class="link" href="${UI.url('admin/pengembalian')}">Catat barang keluar sekarang →</a>` : ''}<br>Total ${rupiah(x.total)} · dibayar ${rupiah(Rules.paidTotal(x))}${k.method === 'Tunai' && k.change ? ` · kembalian ${rupiah(k.change)}` : ''}</div></div>
      <h4 style="margin:0 0 8px">Cetak / kirim nota</h4>
      <div class="k-print"><button type="button" class="btn btn-primary" data-pr="${RC.paper}"><i class="fa-solid fa-print"></i> Cetak struk (${RC.paper} mm)</button><button type="button" class="btn btn-light" data-pr="${ALT}"><i class="fa-solid fa-receipt"></i> Struk ${ALT} mm</button>
        <a class="btn btn-light" href="${UI.url('invoice?id=' + x.id)}" target="_blank" rel="noopener noreferrer"><i class="fa-regular fa-file-lines"></i> Nota A4 / PDF</a>
        <a class="btn btn-wa" href="${UI.waLink(wa, x.customer.phone)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Kirim ke WhatsApp</a></div>`,
      foot: '<button class="btn btn-primary" id="kNew"><i class="fa-solid fa-plus"></i> Transaksi baru</button>' });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pr]'); if (b) printStruk(DB[kind === 'sale' ? 'sale' : 'booking'](x.id), kind, +b.dataset.pr); });
    m.$('#kNew').addEventListener('click', () => { m.close(); reset(); $('#kQ').focus(); });
    toast(`Transaksi ${NO(x)} tersimpan.`);
  }
  /* Kosongkan transaksi: barang, customer, diskon, pembayaran. Jenis (sewa/jual) & tanggal tetap. */
  function reset() { Object.assign(S, { items: [], name: '', phone: '', idType: 'KTP', note: '', disc: 0, received: 0, payOpt: 'lunas', method: 'Tunai', q: '' }); if ($('#kQ')) $('#kQ').value = ''; draw(); }

  /* ---------- Event ---------- */
  function draw() { drawCats(); drawDates(); drawGrid(); drawBill(); }
  $('#kMode').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b || b.dataset.k === S.mode) return; if (S.items.length && !confirm('Ganti jenis transaksi akan mengosongkan barang yang sudah dipilih. Lanjutkan?')) return;
    S.mode = b.dataset.k; S.items = []; S.cat = ''; $$('#kMode [data-k]').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
  $('#kQ').addEventListener('input', (e) => { S.q = e.target.value.trim(); drawGrid(); });
  $('#kCats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; S.cat = b.dataset.c; drawCats(); drawGrid(); });
  $('#kDates').addEventListener('click', (e) => {
    const p = e.target.closest('[data-p]'); if (p) { S.pickup = p.dataset.p; if (S.pickup === 'now') { const n = days(); S.start = T; S.end = D.addDays(T, n); } drawDates(); drawGrid(); drawBill(); return; }
    const d = e.target.closest('[data-d]'); if (d) { S.end = D.addDays(S.start, +d.dataset.d); drawDates(); drawGrid(); drawBill(); }
  });
  $('#kDates').addEventListener('change', (e) => {
    if (e.target.id === 'kStart') { const n = days(); S.start = e.target.value || T; S.end = D.addDays(S.start, n); }
    if (e.target.id === 'kEnd') S.end = e.target.value > S.start ? e.target.value : D.addDays(S.start, 1);
    drawDates(); drawGrid(); drawBill();
  });
  $('#kGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (!b) return; const [kind, id] = b.dataset.add.split('|'); add(kind, id); });
  $('#kBill').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]'); if (q) { const it = S.items[+q.dataset.i]; it.qty += +q.dataset.q; if (it.qty < 1) S.items.splice(+q.dataset.i, 1); else if (!fits(it)) { it.qty -= 1; toast('Stok tidak cukup.', 'err'); } drawBill(); return; }
    const d = e.target.closest('[data-del]'); if (d) { S.items.splice(+d.dataset.del, 1); drawBill(); return; }
    const o = e.target.closest('[data-o]'); if (o) { S.payOpt = o.dataset.o; drawBill(); return; }
    const mm = e.target.closest('[data-m]'); if (mm) { S.method = mm.dataset.m; drawBill(); return; }
    const r = e.target.closest('[data-r]'); if (r) { S.received = +r.dataset.r; drawBill(); return; }
    if (e.target.closest('#kSave')) save();
    if (e.target.closest('#kReset')) reset();
  });
  $('#kBill').addEventListener('input', (e) => {
    if (e.target.id === 'kName') S.name = e.target.value; if (e.target.id === 'kPhone') S.phone = e.target.value; if (e.target.id === 'kNote') S.note = e.target.value;
  });
  $('#kBill').addEventListener('change', (e) => {
    if (e.target.id === 'kDisc') { S.disc = num(e.target.value); drawBill(); }
    if (e.target.id === 'kRecv') { S.received = num(e.target.value); drawBill(); }
    if (e.target.id === 'kId') S.idType = e.target.value;
  });
  draw();
})();
