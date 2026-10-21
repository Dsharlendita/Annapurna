/* Kasir digital: pesanan offline (sewa & jual) yang dicatat staff di toko.
   - Sewa: "Diambil sekarang" → langsung dicatat barang keluar (Sedang disewa), atau "Diambil nanti" (DP / lunas).
   - Jual: stok berkurang, pesanan langsung Selesai.
   - Pembayaran tercatat di Keuangan dengan keterangan "Kasir · <metode>".
   - Nota: struk thermal 58 mm / 80 mm, nota A4 (halaman nota), atau kirim ke WhatsApp customer. */
(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, D, rupiah, Svc, Laundry } = Ann;
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
    /* Sewa: layanan tambahan (dibayar bersama transaksi, tidak masuk total sewa)
       svcMode: '' | 'antar' | 'pasang' (bongkar pasang) | 'pasang_saja' | 'bongkar_saja' */
    svcMode: '', svcTents: 1, svcOngkir: 0, svcAddr: '', svcTime: '08:00', svcBack: '16:00',
    /* Laundry: estimasi selesai (default = hari ini + lama pengerjaan dari pengaturan Owner) */
    ldEst: '',
  };
  if (UI.param('mode') === 'laundry') { S.mode = 'laundry'; S.payOpt = 'nanti'; setTimeout(() => $$('#kMode [data-k]').forEach((x) => x.classList.toggle('active', x.dataset.k === 'laundry')), 0); }
  const isLd = () => S.mode === 'laundry';
  const days = () => Math.max(1, Rules.rentalDays(S.start, S.end));
  const keyOf = (it) => [it.kind, it.refId, it.size || '', JSON.stringify(it.sizes || {})].join('|');
  const cartItem = (it) => Object.assign({ type: 'rent', kind: it.kind, refId: it.refId, qty: it.qty, start: S.start, end: S.end }, it.size ? { size: it.size } : {}, it.sizes ? { sizes: it.sizes } : {});

  /* ---------- Katalog kiri ---------- */
  function drawCats() {
    if (isLd()) { const OT = DB.laundryOther(); $('#kCats').innerHTML = [`<button type="button" class="chip ${!S.cat ? 'on' : ''}" data-c="">Semua</button>`, ...DB.laundryPrices().map((c) => `<button type="button" class="chip ${S.cat === c.id ? 'on' : ''}" data-c="${esc(c.id)}"><i class="fa-solid ${esc(c.icon || 'fa-circle')}"></i> ${esc(c.name)}</button>`), ...(OT.enabled !== false ? [`<button type="button" class="chip ${S.cat === '__other' ? 'on' : ''}" data-c="__other"><i class="fa-solid fa-plus"></i> ${esc(OT.name)}</button>`] : [])].join(''); return; }
    const cats = DB.categories().filter((c) => c.active !== false);
    $('#kCats').innerHTML = [`<button type="button" class="chip ${!S.cat ? 'on' : ''}" data-c="">Semua</button>`, ...(S.mode === 'rent' ? [`<button type="button" class="chip ${S.cat === 'paket' ? 'on' : ''}" data-c="paket"><i class="fa-solid fa-box-open"></i> Paket</button>`] : []),
      ...cats.map((c) => `<button type="button" class="chip ${S.cat === c.id ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}</button>`)].join('');
  }
  /* Mode laundry: daftar laundry yang sedang berjalan untuk diambil / dibayar di kasir */
  function drawLaundryQueue() {
    const q = S.q.toLowerCase(); const ord = { siap: 0, dicuci: 1, diterima: 2 };
    const L = DB.laundry().filter((o) => ['diterima', 'dicuci', 'siap'].includes(o.status) && (!q || [o.no, o.customer.name, o.customer.phone].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => ord[a.status] - ord[b.status] || String(b.createdAt).localeCompare(a.createdAt));
    const row = (o) => { const due = Math.max(0, Laundry.total(o) - Laundry.paid(o));
      return `<div class="list-row"><div class="nm"><strong>${esc(o.no)} · ${esc(o.customer.name)}</strong><small>${esc(Admin.ldItems(o))}</small><small>${UI.pill('laundry', o.status)} <span class="muted">selesai ${D.fmtDate(Laundry.est(o))}</span> ${due ? `<b style="color:var(--orange)">sisa ${rupiah(due)}</b>` : '<b style="color:var(--g700)">lunas</b>'}</small></div>
        ${due ? `<button type="button" class="btn btn-gold btn-xs" data-ldpay="${o.id}"><i class="fa-solid fa-cash-register"></i> Bayar</button>` : ''}
        ${o.status === 'siap' ? `<button type="button" class="btn btn-primary btn-xs" data-lddone="${o.id}"><i class="fa-solid fa-circle-check"></i> Diambil</button>` : `<button type="button" class="btn btn-light btn-xs" data-lddet="${o.id}">Detail</button>`}</div>`; };
    $('#kDates').innerHTML = `<div class="k-ldq"><div class="k-ldq-h"><span><i class="fa-solid fa-jug-detergent"></i> Laundry berjalan (${L.length}) · ambil &amp; bayar</span><a class="link" href="${UI.url('admin/laundry')}" style="font-size:12.5px">Buka menu Laundry</a></div>
      ${L.length ? L.slice(0, 6).map(row).join('') + (L.length > 6 ? `<p class="muted" style="font-size:12.5px">+${L.length - 6} lainnya di menu Laundry.</p>` : '') : '<p class="muted" style="font-size:13px">Tidak ada laundry yang sedang berjalan.</p>'}
      <p class="muted" style="font-size:12.5px;margin-top:8px">Laundry baru: pilih barang di bawah, isi data customer, lalu simpan.</p></div>`;
  }
  $('#kDates').addEventListener('click', async (e) => {
    const refresh = () => { drawLaundryQueue(); Admin.refreshShell(); };
    const p = e.target.closest('[data-ldpay]'); if (p) { Admin.ldPay(DB.laundryOrder(p.dataset.ldpay), refresh); return; }
    const d = e.target.closest('[data-lddet]'); if (d) { Admin.laundryModal(d.dataset.lddet, refresh); return; }
    const k = e.target.closest('[data-lddone]'); if (k) { const o = DB.laundryOrder(k.dataset.lddone);
      Admin.ldPickup(o, refresh); }
  });
  function drawDates() {
    if (isLd()) { drawLaundryQueue(); return; }
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
    if (isLd()) {
      const q = S.q.toLowerCase();
      const L = DB.laundryPrices().filter((c) => !S.cat || c.id === S.cat).flatMap((c) => c.items.map((i) => Object.assign({ icon: c.icon, cat: c.name }, i))).filter((i) => !q || i.name.toLowerCase().includes(q));
      const OT = DB.laundryOther(); const showOther = OT.enabled !== false && (!S.cat || S.cat === '__other') && (!q || 'lain lainnya barang lain'.includes(q) || OT.name.toLowerCase().includes(q));
      const pic = (img, icon) => (img ? `<img src="${asset(img)}" alt="" loading="lazy" decoding="async">` : `<span class="k-ic"><i class="fa-solid ${esc(icon || 'fa-jug-detergent')}"></i></span>`);
      const tiles = (S.cat === '__other' ? [] : L).map((i) => `<button type="button" class="k-item" data-add="laundry|${esc(i.id)}">${pic(i.img, i.icon)}<span class="k-nm">${esc(i.name)}</span><span class="k-pr">${rupiah(i.price)}</span><span class="k-st">${esc(i.cat)}</span></button>`);
      if (showOther) tiles.push(`<button type="button" class="k-item k-other" data-add="ldx|new">${OT.img ? pic(OT.img) : '<span class="k-ic k-ic-plus"><i class="fa-solid fa-plus"></i></span>'}<span class="k-nm">${esc(OT.name)}</span><span class="k-pr">mulai ${rupiah(OT.minPrice)}</span><span class="k-st">Isi nama &amp; harga manual</span></button>`);
      $('#kGrid').innerHTML = tiles.length ? tiles.join('') : '<p class="muted" style="grid-column:1/-1;padding:20px">Barang laundry tidak ditemukan. Pakai kartu <b>Lain-lain</b> untuk barang di luar daftar.</p>';
      return;
    }
    const L = list();
    $('#kGrid').innerHTML = L.length ? L.map(({ kind, x }) => {
      const n = stockOf(kind, x);
      const price = S.mode === 'buy' ? rupiah(x.price) : `${rupiah(Rules.unitPrice(x, days()))}<small> / ${days()} malam</small>`;
      return `<button type="button" class="k-item ${n <= 0 ? 'out' : ''}" data-add="${kind}|${x.id}" ${n <= 0 ? 'disabled' : ''}>
        <img src="${asset(x.img)}" alt="" loading="lazy" decoding="async"><span class="k-nm">${kind === 'package' ? '<span class="pill gray plain">Paket</span> ' : ''}${esc(x.name)}</span>
        <span class="k-pr">${price}</span><span class="k-st ${n <= 2 ? 'low' : ''}">${n <= 0 ? 'Habis' : `Sisa ${n}`}</span></button>`;
    }).join('') : '<p class="muted" style="grid-column:1/-1;padding:20px">Barang tidak ditemukan.</p>';
  }

  /* ---------- Tambah barang (pilih ukuran bila perlu) ---------- */
  /* Laundry "Lain-lain": nama barang & harga diisi manual (harga minimal dari Owner, default Rp5.000) */
  function ldOther(edit) {
    const OT = DB.laundryOther(); const min = Math.max(0, +OT.minPrice || 0); const cur = edit || { name: '', price: min, qty: 1 };
    const m = modal({ title: edit ? 'Ubah barang laundry lain-lain' : `Laundry ${esc(OT.name)}`, body: `
      <p class="muted" style="font-size:13px;margin:0 0 12px">${esc(OT.note || 'Barang di luar daftar harga.')} Harga minimal <b>${rupiah(min)}</b> per barang.</p>
      <div class="field"><label for="loName">Nama barang <span class="req">*</span></label><input class="input" id="loName" value="${esc(cur.name)}" placeholder="Contoh: Sarung tangan gunung" maxlength="60" autocomplete="off"></div>
      <div class="ld-other-sug">${['Sarung tangan', 'Topi / kupluk', 'Buff / masker', 'Tas pinggang', 'Gaiter', 'Hammock'].map((x) => `<button type="button" class="chip" data-sug="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="grid-2">
        <div class="field"><label for="loPrice">Harga per barang (Rp) <span class="req">*</span></label><input class="input" id="loPrice" inputmode="numeric" value="${Number(cur.price || min).toLocaleString('id-ID')}"><span class="hint" id="loHint">Minimal ${rupiah(min)}</span></div>
        <div class="field"><label for="loQty">Jumlah</label><input class="input" id="loQty" type="number" min="1" max="99" value="${cur.qty || 1}"></div>
      </div>
      <div class="kv total" id="loSum"></div>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="loOk"><i class="fa-solid fa-${edit ? 'check' : 'plus'}"></i> ${edit ? 'Simpan' : 'Tambahkan'}</button>` });
    const price = () => num(m.$('#loPrice').value), qty = () => Math.max(1, parseInt(m.$('#loQty').value, 10) || 1);
    const sum = () => { const p = price(); const bad = p < min; m.$('#loPrice').classList.toggle('err', bad); m.$('#loHint').classList.toggle('error', bad); m.$('#loHint').textContent = bad ? `Harga minimal ${rupiah(min)}` : `Minimal ${rupiah(min)}`; m.$('#loSum').innerHTML = `<span>Subtotal</span><span>${rupiah(p * qty())}</span>`; };
    m.$('#loPrice').addEventListener('input', (e) => { const v = num(e.target.value); e.target.value = v ? v.toLocaleString('id-ID') : ''; sum(); });
    m.$('#loQty').addEventListener('input', sum); sum();
    m.el.addEventListener('click', (e) => { const s = e.target.closest('[data-sug]'); if (s) { m.$('#loName').value = s.dataset.sug; m.$('#loPrice').focus(); m.$('#loPrice').select(); } });
    const ok = () => {
      const n = m.$('#loName').value.trim().replace(/\s+/g, ' ');
      if (n.length < 2) { m.$('#loName').classList.add('err'); m.$('#loName').focus(); toast('Isi nama barang yang dilaundry.', 'err'); return; }
      if (price() < min) { m.$('#loPrice').focus(); toast(`Harga minimal ${rupiah(min)}.`, 'err'); return; }
      m.close();
      if (edit) { Object.assign(edit, { name: n, price: price(), qty: qty() }); drawBill(); return; }
      push({ kind: 'ldx', refId: 'ldx-' + Date.now().toString(36), name: n, price: price(), qty: qty() });
    };
    m.$('#loOk').addEventListener('click', ok);
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); ok(); } });
  }
  function add(kind, id) {
    if (kind === 'ldx') return ldOther();
    if (kind === 'laundry') return push({ kind, refId: id, qty: 1 });
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
    const btn = (o, lbl) => `<button type="button" class="size-btn" data-sz="${esc(o.name)}" ${o.avail <= 0 ? 'disabled' : ''}><b>${esc(lbl)}</b><small>${o.avail <= 0 ? 'habis' : `${o.avail} tersedia`}</small></button>`;
    let body;
    if (DB.isVar2(p)) { /* matriks: baris = atribut 1 (mis. ukuran), tombol = atribut 2 (mis. warna) */
      const groups = []; opts.forEach((o) => { const [a, b] = DB.vParts(p, o.name); let g = groups.find((x) => x.a === a); if (!g) groups.push(g = { a, L: [] }); g.L.push([o, b]); });
      body = `<p class="muted" style="font-size:12.5px;margin:0 0 10px">${esc(p.variant.label)} × ${esc(p.variant.label2)} · klik kombinasi yang dibeli/disewa.</p><div class="k-matrix">${groups.map((g) => `<div class="km-row"><span class="km-h">${esc(String(g.a).replace(/\s*\(.*\)/, ''))}</span><div class="k-sizes">${g.L.map(([o, b]) => btn(o, b)).join('')}</div></div>`).join('')}</div>`;
    } else body = `<div class="k-sizes">${opts.map((o) => btn(o, o.name.replace(/\s*\(.*\)/, ''))).join('')}</div>`;
    const m = modal({ title: `Pilih ${esc(DB.variantLabel(p).toLowerCase() || 'ukuran')} · ${esc(p.name)}`, size: DB.isVar2(p) ? 'lg' : '', body, foot: '<button class="btn btn-light" data-close>Batal</button>' });
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
    if (it.kind === 'laundry' || it.kind === 'ldx') return true;
    if (S.mode === 'buy') return DB.saleableStock(DB.product(it.refId), it.size) >= it.qty;
    return Cart.availability(cartItem(it)) >= it.qty;
  }

  /* ---------- Rincian transaksi (kanan) ---------- */
  function lines() {
    if (isLd()) { const OT = DB.laundryOther(); return S.items.map((it) => { if (it.kind === 'ldx') { const x = { name: it.name, price: it.price, cat: OT.name }; return { it, x, name: x.name, img: OT.img || '', icon: 'fa-plus', unit: x.price, total: x.price * it.qty, sub: `${it.qty} × ${rupiah(x.price)} · ${OT.name} (input manual)`, editable: true }; }
      const x = DB.laundryItem(it.refId) || { name: it.refId, price: 0, cat: '' }; return { it, x, name: x.name, img: x.img || '', icon: x.icon || 'fa-jug-detergent', unit: x.price, total: x.price * it.qty, sub: `${it.qty} × ${rupiah(x.price)} · ${x.cat}` }; }); }
    if (S.mode === 'buy') return S.items.map((it) => { const p = DB.product(it.refId); return { it, name: DB.variantName(p, it.size), img: p.img, unit: p.price, total: p.price * it.qty, sub: `${it.qty} × ${rupiah(p.price)}` }; });
    return S.items.map((it) => { const r = Cart.resolve(cartItem(it)); const unit = Rules.lineUnit({ pricePerDay: r.unit, tiers: r.tiers }, days());
      return { it, r, name: r.name, img: r.img, unit, total: unit * it.qty, sub: `${it.qty} × ${rupiah(unit)} · ${Rules.tierLabel(r.tiers || { d1: r.unit }, days())}` }; });
  }
  /* Jumlah tenda di transaksi sewa (batas jasa tenda) */
  const tentMax = () => (S.mode === 'rent' ? Svc.tentCount(lines().map((x) => ({ kind: x.it.kind, refId: x.it.refId, qty: x.it.qty, components: x.r && x.r.components }))) : 0);
  const totals = () => { const L = lines(); const sub = L.reduce((a, x) => a + x.total, 0); const disc = Math.min(sub, Math.max(0, +S.disc || 0));
    if (isLd()) { const ong = 0; const total = sub - disc; const payNow = S.payOpt === 'nanti' ? 0 : total;
      return { L, sub, disc, ong, svc: 0, total, payNow, change: S.method === 'Tunai' ? Math.max(0, (+S.received || 0) - payNow) : 0 }; }
    const total = sub - disc;
    const fee = S.mode === 'rent' && Svc.isTent(S.svcMode) ? Math.min(S.svcTents, tentMax()) * Svc.fee(S.svcMode) : 0; const ong = S.mode === 'rent' && S.svcMode ? +S.svcOngkir || 0 : 0;
    const rentNow = S.mode === 'rent' && S.pickup === 'later' && S.payOpt === 'dp' ? Math.round(total * st.dpPercent / 100) : total;
    const payNow = rentNow + fee + ong;
    return { L, sub, disc, total, fee, ong, svc: fee + ong, rentNow, payNow, change: S.method === 'Tunai' ? Math.max(0, (+S.received || 0) - payNow) : 0 }; };

  /* Bagian tambahan di rincian: layanan sewa (antar / jasa tenda & ongkir) */
  function svcSec(t) {
    const H = Svc.hours(); const opt = (v) => H.map((h) => `<option value="${h}" ${h === v ? 'selected' : ''}>${h.replace(':', '.')}</option>`).join('');
    if (isLd()) { const est = S.ldEst || D.addDays(T, Laundry.days());
      return `<div class="kb-sec"><h4>Jadwal laundry</h4><div class="grid-2">
        <div class="field"><label>Tanggal terima</label><input class="input" value="${D.fmtDate(T, true)}" disabled></div>
        <div class="field"><label>Estimasi selesai</label><input class="input" type="date" id="kLdEst" min="${T}" value="${est}"></div></div>
        <small class="muted" style="font-size:12px">Default ${Laundry.days()} hari (atur di Konfigurasi Sistem). Dicetak di struk. Customer antar &amp; ambil sendiri di toko.</small></div>`; }
    if (S.mode !== 'rent' || !t.L.length) return '';
    const mx = tentMax(); if (!mx && Svc.isTent(S.svcMode)) S.svcMode = ''; if (S.svcTents > mx) S.svcTents = Math.max(1, mx);
    const sp = Svc.spec(S.svcMode || 'ambil'); const tent = Svc.isTent(S.svcMode || 'ambil');
    const modes = [['', 'Tanpa layanan'], ['antar', 'Antar'], ...(mx ? Svc.TENT_MODES.map((k) => [k, `${Svc.spec(k).short} · ${rupiah(Svc.fee(k))}`]) : [])];
    return `<div class="kb-sec"><h4>Layanan tambahan <span class="opt">(opsional)</span></h4>
      <div class="kasir-chips" style="margin-bottom:8px">${modes.map(([k, l]) => `<button type="button" class="chip ${S.svcMode === k ? 'on' : ''}" data-svm="${k}">${l}</button>`).join('')}</div>
      ${S.svcMode ? `${sp.desc ? `<p class="muted" style="font-size:12px;margin:0 0 8px">${sp.desc}</p>` : ''}
        ${tent ? `<div class="kv"><span>Jumlah tenda <small class="muted">${rupiah(Svc.fee(S.svcMode))}/tenda</small></span><span class="qty sm"><button type="button" data-sv="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input value="${S.svcTents}" readonly aria-label="Jumlah tenda"><button type="button" data-sv="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></span></div>` : ''}
        <div class="kv"><span>${Svc.spec(S.svcMode).ongkir ? Svc.spec(S.svcMode).ongkir.replace(/^o/, 'O') : 'Ongkir'} (Rp)</span><span><input class="input sm" id="kSvcOng" inputmode="numeric" value="${S.svcOngkir ? Number(S.svcOngkir).toLocaleString('id-ID') : ''}" placeholder="0"></span></div>
        <div class="field"><label>Lokasi${tent ? ' camping' : ' antar'}</label><input class="input" id="kSvcAddr" value="${esc(S.svcAddr)}" placeholder="Alamat / lokasi"></div>
        <div class="grid-2">${sp.deliver ? `<div class="field"><label>Jam ${tent ? 'antar &amp; pasang' : 'antar'}</label><select class="select" id="kSvcTime">${opt(S.svcTime)}</select></div>` : ''}${sp.pickup === true ? `<div class="field"><label>Jam bongkar &amp; jemput</label><select class="select" id="kSvcBack">${opt(S.svcBack)}</select></div>` : ''}</div>` : ''}
    </div>`;
  }
  function drawBill() {
    const t = totals();
    $('#kBill').innerHTML = `
      <div class="kb-h"><h3><i class="fa-solid ${isLd() ? 'fa-jug-detergent' : 'fa-receipt'}"></i> ${S.mode === 'rent' ? 'Transaksi sewa' : isLd() ? 'Transaksi laundry' : 'Transaksi jual'}</h3><small class="muted">No. nota dibuat otomatis saat disimpan (format ${isLd() ? DB.nextLaundryNo() : (S.mode === 'rent' ? 'RNT' : 'ODR') + '/001/' + ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date().getMonth()] + '/' + new Date().getFullYear()})</small></div>
      <div class="kb-items">${t.L.length ? t.L.map((x, i) => `<div class="kb-it">${x.img ? `<img src="${asset(x.img)}" alt="">` : `<span class="kb-ic"><i class="fa-solid ${x.icon}"></i></span>`}<div class="kb-nm"><b>${esc(x.name)}</b><small>${esc(x.sub)}${x.editable ? ` · <button type="button" class="link-btn" data-ldedit="${i}"><i class="fa-solid fa-pen"></i> ubah</button>` : ''}</small></div>
        <div class="qty sm"><button type="button" data-q="-1" data-i="${i}" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input value="${x.it.qty}" readonly aria-label="Jumlah"><button type="button" data-q="1" data-i="${i}" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div>
        <span class="kb-pr">${rupiah(x.total)}</span><button type="button" class="icon-btn sm" data-del="${i}" aria-label="Hapus"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : `<div class="kb-empty"><i class="fa-solid fa-basket-shopping"></i><p>Klik ${isLd() ? 'jenis barang laundry' : 'barang'} di kiri untuk menambahkannya.</p></div>`}</div>
      ${svcSec(t)}
      <div class="kb-sec"><h4>Customer</h4>
        ${S.mode === 'buy' ? '<p class="muted kb-opt-note"><i class="fa-solid fa-circle-info"></i> Untuk penjualan, nama &amp; WhatsApp <b>boleh dikosongkan</b> (pelanggan umum). Isi bila invoice ingin dikirim ke WhatsApp customer.</p>' : ''}
        <div class="grid-2"><div class="field"><label>Nama ${S.mode === 'buy' ? '<span class="opt">(opsional)</span>' : '<span class="req">*</span>'}</label><input class="input" id="kName" value="${esc(S.name)}" placeholder="${S.mode === 'buy' ? 'Pelanggan umum' : 'Nama customer'}"></div>
        <div class="field"><label>No. WhatsApp ${S.mode === 'buy' ? '<span class="opt">(opsional)</span>' : '<span class="req">*</span>'}</label><input class="input" id="kPhone" value="${esc(S.phone)}" placeholder="08xxxxxxxxxx" inputmode="tel"></div></div>
        ${S.mode === 'rent' ? UI.idField('kId', S.idType) : ''}
        <div class="field"><label>Catatan <span class="opt">(opsional)</span></label><input class="input" id="kNote" value="${esc(S.note)}" placeholder="${isLd() ? 'Contoh: noda lumpur di bagian bawah tenda' : 'Contoh: ambil jam 4 sore'}"></div>
      </div>
      <div class="kb-sec"><h4>Pembayaran</h4>
        <div class="kv"><span>Subtotal</span><span>${rupiah(t.sub)}</span></div>
        <div class="kv"><span>Diskon (Rp)</span><span><input class="input sm" id="kDisc" inputmode="numeric" value="${S.disc ? Number(S.disc).toLocaleString('id-ID') : ''}" placeholder="0"></span></div>
        ${isLd() && t.ong ? `<div class="kv"><span>Ongkir jemput / antar</span><span>${rupiah(t.ong)}</span></div>` : ''}
        <div class="kv total"><span>${S.mode === 'rent' && t.svc ? 'Total sewa' : 'Total'}</span><span>${rupiah(t.total)}</span></div>
        ${S.mode === 'rent' && t.svc ? `${t.fee ? `<div class="kv"><span>Jasa ${Svc.spec(S.svcMode).short.toLowerCase()} (${Math.min(S.svcTents, tentMax())} tenda)</span><span>${rupiah(t.fee)}</span></div>` : ''}${t.ong ? `<div class="kv"><span>Ongkir antar / jemput</span><span>${rupiah(t.ong)}</span></div>` : ''}<small class="muted" style="display:block;font-size:12px;margin:-2px 0 6px">Layanan dibayar sekarang, dicatat terpisah dari total sewa (Keuangan lini Rental).</small>` : ''}
        ${isLd() ? `<div class="seg kb-opt"><button type="button" data-o="lunas" class="${S.payOpt !== 'nanti' ? 'active' : ''}">Bayar sekarang</button><button type="button" data-o="nanti" class="${S.payOpt === 'nanti' ? 'active' : ''}">Bayar saat diambil</button></div>` : ''}
        ${S.mode === 'rent' && S.pickup === 'later' ? `<div class="seg kb-opt"><button type="button" data-o="dp" class="${S.payOpt === 'dp' ? 'active' : ''}">DP ${st.dpPercent}%</button><button type="button" data-o="lunas" class="${S.payOpt === 'lunas' ? 'active' : ''}">Lunas</button></div>` : ''}
        <div class="kv hl"><span>Dibayar sekarang</span><span>${rupiah(t.payNow)}</span></div>
        ${t.payNow ? `<div class="seg kb-opt" aria-label="Metode">${['Tunai', 'Transfer', 'QRIS'].map((x) => `<button type="button" data-m="${x}" class="${S.method === x ? 'active' : ''}">${x}</button>`).join('')}</div>
        ${S.method === 'Tunai' ? `<div class="field"><label>Uang diterima</label><input class="input" id="kRecv" inputmode="numeric" value="${S.received ? Number(S.received).toLocaleString('id-ID') : ''}" placeholder="0">
          <div class="kb-quick">${[t.payNow, Math.ceil(t.payNow / 50000) * 50000, Math.ceil(t.payNow / 100000) * 100000, Math.ceil((t.payNow + 1) / 100000) * 100000 + 100000].filter((v, i, a) => v > 0 && v >= t.payNow && a.indexOf(v) === i).slice(0, 4).map((v, i) => `<button type="button" class="chip" data-r="${v}">${i === 0 ? 'Uang pas' : rupiah(v)}</button>`).join('')}</div></div>
          <div class="kv kb-change ${(+S.received || 0) && (+S.received || 0) < t.payNow ? 'neg' : ''}"><span>${(+S.received || 0) && (+S.received || 0) < t.payNow ? 'Kurang' : 'Kembalian'}</span><span>${rupiah((+S.received || 0) && (+S.received || 0) < t.payNow ? t.payNow - S.received : t.change)}</span></div>` : ''}` : ''}
      </div>
      <button type="button" class="btn btn-primary btn-block btn-lg" id="kSave" ${t.L.length ? '' : 'disabled'}><i class="fa-solid fa-check"></i> ${S.mode === 'rent' && S.pickup === 'now' ? 'Simpan & catat barang keluar' : isLd() ? 'Simpan laundry' : 'Simpan transaksi'}</button>
      ${t.L.length ? '<button type="button" class="btn btn-ghost btn-block btn-sm" id="kReset">Kosongkan transaksi</button>' : ''}`;
    if ($('#kIdType')) UI.idBind($('#kBill'), 'kId', (v) => { S.idType = v; });
  }
  const num = (v) => +String(v || '').replace(/[^\d]/g, '') || 0;

  /* ---------- Simpan ---------- */
  function save() {
    const t = totals();
    S.name = $('#kName').value.trim(); S.phone = $('#kPhone').value.trim(); S.note = $('#kNote').value.trim();
    const optCust = S.mode === 'buy'; /* penjualan: nama & WA opsional · sewa & laundry: wajib */
    if (S.mode === 'rent') { const r = UI.idRead($('#kBill'), 'kId'); if (!r.ok) return; S.idType = r.value; }
    if (!optCust && S.name.length < 2) { toast(`Nama customer wajib diisi untuk ${isLd() ? 'laundry' : 'sewa'}.`, 'err'); $('#kName').classList.add('err'); $('#kName').focus(); return; }
    if (optCust && S.name && S.name.length < 2) { toast('Nama terlalu pendek. Kosongkan saja bila pelanggan umum.', 'err'); $('#kName').focus(); return; }
    if ((!optCust || S.phone) && !UI.isPhone(S.phone)) { toast(optCust ? 'Nomor WhatsApp tidak valid. Kosongkan bila tidak ada. Contoh: 081234567890.' : `No. WhatsApp wajib diisi untuk ${isLd() ? 'laundry' : 'sewa'}. Contoh: 081234567890.`, 'err'); $('#kPhone').classList.add('err'); $('#kPhone').focus(); return; }
    if (S.items.some((it) => !fits(it))) { toast('Ada barang yang stoknya tidak cukup. Periksa lagi jumlahnya.', 'err'); drawGrid(); return; }
    if (t.payNow && S.method === 'Tunai' && num(S.received) < t.payNow) { toast(`Uang diterima kurang dari ${rupiah(t.payNow)}.`, 'err'); return; }
    const customer = optCust && !S.name ? { name: 'Pelanggan Umum', phone: S.phone, email: '', walkIn: true } : { name: S.name, phone: S.phone, email: '' };
    const via = `Kasir · ${S.method}`;
    const kasir = { by: me.name, method: S.method, received: S.method === 'Tunai' ? num(S.received) : t.payNow, change: t.change, at: D.nowStamp() };
    if (isLd()) {
      const at = D.nowStamp();
      const items = t.L.map((x) => Object.assign({ id: x.it.refId, name: x.x.name, cat: x.x.cat, price: x.x.price, qty: x.it.qty }, x.it.kind === 'ldx' ? { custom: true } : {}));
      const o = { id: DB.nextId('DRY', DB.laundry()), no: DB.nextLaundryNo(at), customer: { name: S.name, phone: S.phone, email: '' }, items, discount: t.disc || 0, estDone: S.ldEst || D.addDays(T, Laundry.days()),
        notes: S.note, channel: 'kasir', by: me.name, kasir, createdAt: at, status: 'diterima', payments: t.payNow ? [{ at, amount: t.payNow, type: 'Lunas', via }] : [], paymentStatus: t.payNow ? 'paid' : 'unpaid',
        history: [{ at, text: `Barang diterima di toko dan dicatat di kasir oleh ${me.name}${t.payNow ? ` · dibayar ${rupiah(t.payNow)} (${S.method})` : ' · dibayar saat diambil'}` }] };
      DB.saveLaundry(o);
      reset();
      DB.audit({ type: 'laundry', action: `Kasir: laundry ${o.no} · ${items.map((i) => `${i.qty}× ${i.name}`).join(', ')} · ${rupiah(Laundry.total(o))}${t.payNow ? ` · dibayar ${rupiah(t.payNow)} (${S.method})` : ' · belum dibayar'}`, ref: o.id });
      DB.notifyStaff('Laundry baru', `${o.customer.name} · ${o.no} (${items.length} jenis barang).`, 'admin/laundry?id=' + o.id);
      doneLaundry(DB.laundryOrder(o.id));
      return;
    }
    if (S.mode === 'buy') {
      const items = S.items.map((it) => { const p = DB.product(it.refId); return Object.assign({ productId: p.id, name: DB.variantName(p, it.size), img: p.img, qty: it.qty, price: p.price, cost: p.cost != null && p.cost !== '' ? +p.cost : null }, it.size ? { size: it.size } : {}); });
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
    /* Layanan tambahan: jasa tenda & ongkir dibayar sekarang, dicatat terpisah dari total sewa */
    if (S.svcMode) {
      const at = D.nowStamp(); const sp = Svc.spec(S.svcMode); const tent = Svc.isTent(S.svcMode); const tents = tent ? Math.min(S.svcTents, tentMax()) : 0; b.svc = [];
      if (t.fee) b.svc.push({ id: 'SVC-' + Date.now().toString(36).toUpperCase() + 'P', kind: 'pasang', amount: t.fee, at, by: me.name, via, note: `${sp.short} ${tents} tenda` });
      if (t.ong) b.svc.push({ id: 'SVC-' + Date.now().toString(36).toUpperCase() + 'O', kind: 'ongkir', amount: t.ong, at, by: me.name, via, note: '' });
      b.delivery = S.svcMode;
      b.deliv = Object.assign({ address: S.svcAddr.trim(), date: b.start, time: sp.deliver ? S.svcTime : '', ongkir: t.ong || 0, notaAt: at, notaBy: me.name, returnMode: sp.pickup === true ? 'jemput' : sp.pickup === false ? 'toko' : '' }, sp.pickup === true ? { backDate: b.end, backTime: S.svcBack } : {}, tent ? { tents } : {});
      b.history.push({ at, text: `${tent ? `Jasa ${sp.short.toLowerCase()} ${tents} tenda` : 'Antar ke lokasi'}${t.svc ? ` · dibayar ${rupiah(t.svc)} di kasir (${S.method})` : ''}` });
      if (t.svc) { b.payments[0].amount = t.rentNow; b.paymentStatus = t.rentNow >= t.total ? 'lunas' : 'dp_paid'; b.payments[0].type = t.rentNow >= t.total ? 'Lunas' : 'DP'; }
    }
    Rules.recalc(b); if (b.paymentStatus === 'dp_paid') b.dp = t.svc ? t.rentNow : t.payNow;
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
      ${x.total - paid > 0 ? row('Sisa bayar saat ambil', rupiah(x.total - paid), 'b') : ''}
      ${(x.svc || []).length ? `<hr>${x.svc.map((v) => row(v.kind === 'pasang' ? 'Jasa tenda' + (v.note ? ' (' + esc(v.note) + ')' : '') : 'Ongkir antar/jemput', rupiah(v.amount))).join('')}${row('Layanan dibayar', rupiah(x.svc.reduce((a, v) => a + v.amount, 0)), 'b')}` : ''}<hr>
      <div class="c s">${esc((kind === 'rent' ? RC.footerRent : RC.footerSale) || '')}<br><b>Terima kasih!</b><br>IG ${esc(st.instagram || '@annapurnaadv')}</div>
      <script>window.onload = () => { /* Tinggi kertas = panjang isi struk (bukan A4) */ const h = Math.ceil(document.body.scrollHeight * 25.4 / 96) + 4; const s = document.createElement('style'); s.textContent = '@page { size: ${mm}mm ' + h + 'mm; margin: 0; }'; document.head.appendChild(s); setTimeout(() => { window.print(); setTimeout(() => window.close(), 300); }, 120); };<\/script></body></html>`;
  }
  function printStruk(x, kind, mm) {
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) { toast('Izinkan pop-up di browser untuk mencetak struk.', 'err'); return; }
    w.document.open(); w.document.write(strukHtml(x, kind, mm)); w.document.close();
  }
  async function done(x, kind) {
    const k = x.kasir || {};
    await Ann.Share.ensure(x);
    const m = modal({ title: `Transaksi tersimpan · ${NO(x)}`, body: `
      <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-circle-check"></i><div><b>${kind === 'rent' ? (x.status === 'disewa' ? 'Sewa offline tersimpan, barang sudah keluar.' : x.start <= D.today() ? 'Sewa offline tersimpan, tapi barang BELUM dicatat keluar.' : 'Booking offline tersimpan, barang diambil ' + D.fmtDate(x.start, true) + '.') : 'Penjualan offline tersimpan, stok sudah berkurang.'}</b>${kind === 'rent' && x.status !== 'disewa' && x.start <= D.today() ? `<br><a class="link" href="${UI.url('admin/pengembalian')}">Catat barang keluar sekarang →</a>` : ''}<br>Total ${rupiah(x.total)} · dibayar ${rupiah(Rules.paidTotal(x))}${k.method === 'Tunai' && k.change ? ` · kembalian ${rupiah(k.change)}` : ''}</div></div>
      <h4 style="margin:0 0 8px">Cetak / kirim nota</h4>
      <div class="k-print"><button type="button" class="btn btn-primary" data-pr="${RC.paper}"><i class="fa-solid fa-print"></i> Cetak struk (${RC.paper} mm)</button>
        <a class="btn btn-light" href="${UI.url('invoice?id=' + x.id)}" target="_blank" rel="noopener noreferrer"><i class="fa-regular fa-file-lines"></i> Nota A4 / PDF</a>
        <button type="button" class="btn btn-wa" id="kWa"><i class="fa-brands fa-whatsapp"></i> Kirim ${kind === 'sale' ? 'invoice' : 'nota'} ke WhatsApp</button></div>
      ${kind === 'sale' && !x.customer.phone ? '<p class="muted" style="font-size:12.5px;margin-top:8px"><i class="fa-solid fa-circle-info"></i> Pelanggan umum tanpa nomor WhatsApp: gambar invoice tetap bisa diunduh / disalin dari tombol di atas.</p>' : ''}`,
      foot: '<button class="btn btn-primary" id="kNew"><i class="fa-solid fa-plus"></i> Transaksi baru</button>' });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pr]'); if (b) printStruk(DB[kind === 'sale' ? 'sale' : 'booking'](x.id), kind, +b.dataset.pr); });
    m.$('#kNew').addEventListener('click', () => { m.close(); reset(); $('#kQ').focus(); });
    m.$('#kWa').addEventListener('click', async (e) => { const bt = e.currentTarget; bt.disabled = true;
      try {
        if (kind === 'sale') { await Admin.contactSale(DB.sale(x.id), { tplKey: 'kasir_sale', title: `Kirim invoice · ${NO(x)}` }); return; }
        const b = DB.booking(x.id); await Ann.Share.ensure(b);
        const cv = await UI.tagihanCanvas(b, { booking: true, title: b.status === 'disewa' ? 'NOTA SEWA' : 'NOTA BOOKING' }); const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        UI.waCompose({ title: `Kirim nota · ${NO(b)}`, blob, name: `nota-${NO(b).replace(/\//g, '_')}.png`, text: DB.waText('kasir_rent', Object.assign(Admin.rentVars(b, false), { metode: (b.kasir || {}).method || b.method || '' })), phone: b.customer.phone,
          waLabel: `Kirim ke ${esc((b.customer.name || 'customer').split(' ')[0])}`, tplKey: 'kasir_rent' });
      } finally { bt.disabled = false; } });
    toast(`Transaksi ${NO(x)} tersimpan.`);
  }
  /* Setelah laundry disimpan: staff WAJIB mencetak struk DAN mengabari customer.
     Jendela terkunci (tidak tertutup bila klik di luar / Esc) dan tombol lanjut aktif setelah dua langkah selesai.
     Bila ada kendala nyata (printer rusak, customer tanpa WhatsApp), staff wajib menulis alasan: dicatat di riwayat laundry
     & Histori Sistem, dan laundry tetap muncul di Dashboard (Perlu tindakan) sampai langkahnya dikerjakan. */
  function doneLaundry(o) {
    const total = Laundry.total(o), paid = Laundry.paid(o); const step = { print: false, wa: false };
    const m = modal({ title: `Laundry tersimpan · ${o.no}`, locked: true, body: `
      <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-circle-check"></i><div><b>Barang diterima di toko, estimasi selesai ${D.fmtDate(Laundry.est(o), true)}.</b><br>Total ${rupiah(total)} · ${paid ? `dibayar ${rupiah(paid)}${o.kasir && o.kasir.method === 'Tunai' && o.kasir.change ? ` · kembalian ${rupiah(o.kasir.change)}` : ''}` : 'dibayar saat diambil'}</div></div>
      <h4 style="margin:0 0 10px">Wajib dilakukan sebelum lanjut</h4>
      <ol class="ld-steps-req">
        <li id="stPrint"><span class="ck"><i class="fa-solid fa-check"></i></span><div><b>1. Cetak struk (${RC.paper} mm)</b><small>Berikan struk ke customer sebagai bukti pengambilan.</small></div><button type="button" class="btn btn-primary btn-sm" data-pr="${RC.paper}"><i class="fa-solid fa-print"></i> Cetak</button></li>
        <li id="stWa"><span class="ck"><i class="fa-solid fa-check"></i></span><div><b>2. Kabari customer via WhatsApp</b><small>Gambar nota &amp; pesan disiapkan otomatis, isi pesan bisa diedit dulu.</small></div><button type="button" class="btn btn-wa btn-sm" id="ldWaBtn"><i class="fa-brands fa-whatsapp"></i> Kirim</button></li>
      </ol>
      <p class="ld-lock-note" id="ldLockNote"><i class="fa-solid fa-lock"></i> Jendela ini baru bisa ditutup setelah kedua langkah di atas selesai.</p>
      <details class="ld-skip" id="ldSkip"><summary>Ada kendala (printer rusak / customer tidak punya WhatsApp)?</summary>
        <div class="field" style="margin-top:8px"><label>Alasan <span class="req">*</span></label><select class="select" id="ldSkipWhy"><option value="">Pilih alasan…</option><option>Printer struk bermasalah</option><option>Customer tidak punya WhatsApp</option><option>Nomor WhatsApp tidak aktif</option><option>Lainnya</option></select></div>
        <div class="field"><label>Keterangan <span class="req">*</span></label><input class="input" id="ldSkipNote" placeholder="Contoh: kertas struk habis, struk ditulis tangan"></div>
        <button type="button" class="btn btn-light btn-sm" id="ldSkipOk">Catat kendala &amp; lanjutkan</button>
        <small class="muted" style="display:block;margin-top:6px">Kendala dicatat di riwayat laundry dan Histori Sistem. Laundry ini tetap muncul di Dashboard sampai struk dicetak dan customer dikabari.</small></details>`,
      foot: `<button type="button" class="btn btn-light" id="kOpenLd" disabled><i class="fa-solid fa-jug-detergent"></i> Buka di menu Laundry</button><button class="btn btn-primary" id="kNew" disabled><i class="fa-solid fa-plus"></i> Transaksi baru</button>` });
    const ok = () => step.print && step.wa;
    const sync = () => { m.$('#stPrint').classList.toggle('done', step.print); m.$('#stWa').classList.toggle('done', step.wa);
      ['#kNew', '#kOpenLd'].forEach((id) => { m.$(id).disabled = !ok(); m.$(id).title = ok() ? '' : 'Cetak struk dan kabari customer dulu'; });
      m.$('#ldLockNote').hidden = ok(); m.$('#ldSkip').hidden = ok(); };
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pr]'); if (b) { Admin.ldStruk(DB.laundryOrder(o.id), +b.dataset.pr); step.print = true; sync(); } });  /* ldStruk mencatat receiptPrintedAt */
    m.$('#ldWaBtn').addEventListener('click', () => Admin.ldContact(DB.laundryOrder(o.id), { title: `Kabari customer · ${o.no}`, logText: 'Customer dikabari via WhatsApp (laundry diterima)', patch: () => ({ notifiedReceivedAt: D.nowStamp() }), onSent: () => { step.wa = true; sync(); } }));
    const finish = (toLaundry) => { m.close(); if (toLaundry) location.href = UI.url('admin/laundry?id=' + o.id); else $('#kQ').focus(); };
    m.$('#kNew').addEventListener('click', () => { if (ok()) finish(false); });
    m.$('#kOpenLd').addEventListener('click', () => { if (ok()) finish(true); });
    m.$('#ldSkipOk').addEventListener('click', () => {
      const why = m.$('#ldSkipWhy').value, note = m.$('#ldSkipNote').value.trim();
      if (!why || note.length < 5) { toast('Pilih alasan dan tulis keterangan kendala (minimal 5 huruf).', 'err'); return; }
      const miss = [!step.print && 'struk belum dicetak', !step.wa && 'customer belum dikabari'].filter(Boolean).join(' & ');
      const x = DB.laundryOrder(o.id); x.history.push({ at: D.nowStamp(), text: `Kendala: ${why} — ${note} (${miss}) · dicatat ${me.name}` }); x.skipNote = { why, note, by: me.name, at: D.nowStamp() }; DB.saveLaundry(x);
      DB.audit({ type: 'laundry', action: `Melewati langkah wajib laundry ${o.no}: ${miss}`, ref: o.id, changes: [{ field: 'Alasan', from: '', to: `${why} — ${note}` }] });
      toast(`Kendala dicatat. ${o.no} tetap muncul di Dashboard sampai ${miss.replace('belum ', '')}.`, 'err'); finish(false);
    });
    sync(); toast(`Laundry ${o.no} tersimpan.`);
  }
  /* Kosongkan transaksi: barang, customer, diskon, pembayaran. Jenis (sewa/jual) & tanggal tetap. */
  function reset() { Object.assign(S, { items: [], name: '', phone: '', idType: 'KTP', note: '', disc: 0, received: 0, payOpt: isLd() ? 'nanti' : 'lunas', method: 'Tunai', q: '', svcMode: '', svcTents: 1, svcOngkir: 0, svcAddr: '', ldEst: '' }); if ($('#kQ')) $('#kQ').value = ''; draw(); }

  /* ---------- Event ---------- */
  function draw() { drawCats(); drawDates(); drawGrid(); drawBill(); }
  $('#kMode').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b || b.dataset.k === S.mode) return; if (S.items.length && !confirm('Ganti jenis transaksi akan mengosongkan barang yang sudah dipilih. Lanjutkan?')) return;
    S.mode = b.dataset.k; S.items = []; S.cat = ''; S.payOpt = S.mode === 'laundry' ? 'nanti' : 'lunas'; S.svcMode = ''; S.svcTents = 1; S.svcOngkir = 0; $$('#kMode [data-k]').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
  $('#kQ').addEventListener('input', (e) => { S.q = e.target.value.trim(); drawGrid(); if (isLd()) drawLaundryQueue(); });
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
    const le = e.target.closest('[data-ldedit]'); if (le) { ldOther(S.items[+le.dataset.ldedit]); return; }
    const d = e.target.closest('[data-del]'); if (d) { S.items.splice(+d.dataset.del, 1); drawBill(); return; }
    const o = e.target.closest('[data-o]'); if (o) { S.payOpt = o.dataset.o; drawBill(); return; }
    const svm = e.target.closest('[data-svm]'); if (svm) { S.svcMode = svm.dataset.svm; if (Svc.isTent(S.svcMode) && !S.svcTents) S.svcTents = 1; drawBill(); return; }
    const sv = e.target.closest('[data-sv]'); if (sv) { S.svcTents = Math.max(1, Math.min(tentMax(), S.svcTents + +sv.dataset.sv)); drawBill(); return; }
    const mm = e.target.closest('[data-m]'); if (mm) { S.method = mm.dataset.m; drawBill(); return; }
    const r = e.target.closest('[data-r]'); if (r) { S.received = +r.dataset.r; drawBill(); return; }
    if (e.target.closest('#kSave')) save();
    if (e.target.closest('#kReset')) reset();
  });
  $('#kBill').addEventListener('input', (e) => {
    if (e.target.id === 'kName') S.name = e.target.value; if (e.target.id === 'kPhone') S.phone = e.target.value; if (e.target.id === 'kNote') S.note = e.target.value;
    if (e.target.id === 'kSvcAddr') S.svcAddr = e.target.value;
  });
  $('#kBill').addEventListener('change', (e) => {
    if (e.target.id === 'kDisc') { S.disc = num(e.target.value); drawBill(); }
    if (e.target.id === 'kRecv') { S.received = num(e.target.value); drawBill(); }
    if (e.target.id === 'kSvcOng') { S.svcOngkir = num(e.target.value); drawBill(); }
    if (e.target.id === 'kLdEst') S.ldEst = e.target.value >= T ? e.target.value : T;
    if (e.target.id === 'kSvcTime') S.svcTime = e.target.value; if (e.target.id === 'kSvcBack') S.svcBack = e.target.value;
  });
  draw();
})();
