(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('barang', 'Data Barang');
  const T = D.today();
  const CONDS = DB.COND_LIST;
  const cats = () => DB.categories(true);
  const prods = () => DB.products(true);
  const ACTIVE_ST = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'];
  const catName = (id) => (cats().find((c) => c.id === id) || { name: id }).name;
  function fillCats() { $('#fCat').innerHTML = '<option value="">Semua kategori</option>' + cats().map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join(''); }
  /* Barang sewa & barang jual adalah dua stok terpisah (barang jual tidak bisa disewa, barang sewa tidak dijual). */
  let KIND = (param('jenis') === 'jual' || param('low')) ? 'buy' : 'rent';
  let TAB = 'sewa';
  const kindOf = (p) => (p.rent > 0 ? 'rent' : 'buy');
  /* Hitung ulang / pindah stok untuk unit fisik barang sewa. targets = { kombinasi: jumlah yang diinginkan }, '' = tanpa varian.
     Unit yang sedang disewa tidak diubah. Kelebihan dipindah ke kombinasi yang kurang; sisanya dinonaktifkan. Mengembalikan pesan error bila gagal. */
  function reconcileUnits(units, targets, reason) {
    const alive = (u) => u.status !== 'terjual' && u.status !== 'nonaktif';
    const keyOf = (u) => u.size || '';
    const logU = (u, text) => { u.log = u.log || []; u.log.push({ at: D.nowStamp(), text, by: Admin.me.name }); };
    const pool = [];
    for (const [k, want] of Object.entries(targets)) {
      const have = units.filter((u) => alive(u) && keyOf(u) === k);
      const extra = have.length - want;
      if (extra <= 0) continue;
      const free = have.filter((u) => !u.out);
      if (free.length < extra) return `Stok ${k || 'barang'} tidak bisa dikurangi ${extra} unit: ${have.length - free.length} unit sedang disewa atau dibooking.`;
      free.slice(0, extra).forEach((u) => pool.push(u));
    }
    for (const [k, want] of Object.entries(targets)) {
      let need = want - units.filter((u) => alive(u) && keyOf(u) === k).length;
      while (need > 0 && pool.length) {
        const u = pool.shift(); const from = keyOf(u);
        if (k) u.size = k; else delete u.size;
        logU(u, `Dipindah${from ? ' dari ' + from : ''}${k ? ' ke ' + k : ''} (pindah stok)`); need--;
      }
    }
    pool.forEach((u) => { u.status = 'nonaktif'; logU(u, `Dikurangi lewat hitung ulang${reason ? ': ' + reason : ''}`); });
    return null;
  }
  const soldQty = (id) => DB.sales().filter((s) => s.status !== 'dibatalkan').reduce((n, s) => n + s.items.filter((i) => i.productId === id).reduce((t, i) => t + i.qty, 0), 0);
  const TYPE_OPTS = { rent: [['', 'Semua barang sewa'], ['full', 'Sewa hampir penuh'], ['care', 'Perlu perawatan']], buy: [['', 'Semua barang jual'], ['lowsale', 'Stok menipis']] };
  function fillType() { const v = $('#fType').value; $('#fType').innerHTML = TYPE_OPTS[KIND].map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); $('#fType').value = TYPE_OPTS[KIND].some(([k]) => k === v) ? v : ''; }
  function list() {
    const q = $('#q').value.trim().toLowerCase(), c = $('#fCat').value, t = $('#fType').value, st = $('#fStatus').value;
    return prods().filter((p) => kindOf(p) === KIND && (!q || [p.name, p.sku, p.brand, ...(p.units || []).map((u) => u.code)].join(' ').toLowerCase().includes(q)) && (!c || p.cat === c)
      && (!st || (st === 'aktif' ? p.active !== false : p.active === false))
      && (!t || (t === 'lowsale' && DB.lowStock().some((x) => x.id === p.id)) || (t === 'full' && isFull(p)) || (t === 'care' && needsCare(p))));
  }
  const isFull = (p) => p.rent > 0 && p.active !== false && Rules.availableOn(p.id, T) <= 2;
  const needsCare = (p) => (p.units || []).some((u) => u.status === 'aktif' && (u.care || DB.serviceDue(p, u)));
  function quick() {
    const P = prods().filter((p) => kindOf(p) === KIND); const off = P.filter((p) => p.active === false).length;
    const cur = $('#fType').value || ($('#fStatus').value === 'nonaktif' ? 'off' : '');
    const box = $('#quickF'); if (!box) return;
    const chips = KIND === 'rent'
      ? [['', 'Semua barang sewa', P.length, 'fa-campground', ''], ['care', 'Perlu perawatan', P.filter(needsCare).length, 'fa-soap', 'Unit perlu dicuci, sedang diperbaiki, atau perlu servis berkala'], ['full', 'Sewa hampir penuh', P.filter(isFull).length, 'fa-calendar-xmark', 'Tersisa 2 unit atau kurang untuk hari ini'], ['off', 'Tidak aktif', off, 'fa-toggle-off', '']]
      : [['', 'Semua barang jual', P.length, 'fa-bag-shopping', ''], ['lowsale', 'Stok menipis', DB.lowStock().filter((p) => kindOf(p) === 'buy').length, 'fa-cart-flatbed', 'Stok di bawah / sama dengan stok minimum'], ['off', 'Tidak aktif', off, 'fa-toggle-off', '']];
    box.innerHTML = chips.map(([k, l, n, ic, tip]) => `<button type="button" data-qf="${k}" class="${cur === k ? 'on' : ''} ${n && k && k !== 'off' ? 'warn' : ''}" ${tip ? `title="${tip}"` : ''}><i class="fa-solid ${ic}"></i> ${l} <b>${n}</b></button>`).join('')
      + (cur === 'care' ? '<p class="qf-hint"><i class="fa-solid fa-circle-info"></i> Barang dengan unit yang <b>perlu dicuci</b>, <b>sedang diperbaiki</b>, atau <b>perlu servis berkala</b>. Kerjakan di <a class="link" href="perawatan">Perawatan Unit</a>.</p>'
        : cur === 'full' ? '<p class="qf-hint"><i class="fa-solid fa-circle-info"></i> Barang sewa yang tersisa 2 unit atau kurang untuk hari ini.</p>'
        : cur === 'lowsale' ? '<p class="qf-hint"><i class="fa-solid fa-circle-info"></i> Stok barang jual sudah sama / di bawah stok minimum. Segera restock.</p>' : '');
  }

  function draw() {
    fillType(); quick();
    const P = prods();
    $('#cS').textContent = P.filter((p) => kindOf(p) === 'rent').length; $('#cJ').textContent = P.filter((p) => kindOf(p) === 'buy').length; $('#cK').textContent = cats().length;
    $('#add').innerHTML = `<i class="fa-solid fa-plus"></i> Tambah barang ${KIND === 'rent' ? 'sewa' : 'jual'}`;
    /* Satu menu "Restock ▾": beberapa barang sekaligus (satu nota supplier), satu barang, riwayat */
    if (!$('#rsMulti')) $('#add').insertAdjacentHTML('afterend', `<button type="button" class="btn btn-light btn-sm" id="rsMulti"><i class="fa-solid fa-layer-group"></i> Restock banyak barang</button><button type="button" class="btn btn-light btn-sm" id="rsHist"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat restock</button>`);
    $('#th').innerHTML = KIND === 'rent'
      ? '<tr><th>Barang</th><th>Kategori</th><th class="num">Tarif sewa</th><th>Unit / stok</th><th>Kondisi</th><th class="num">Aksi</th></tr>'
      : '<tr><th>Barang</th><th>Kategori</th><th class="num">Harga beli · jual</th><th title="Stok saat ini & batas restock (stok minimum)">Stok &amp; batas restock</th><th class="num">Terjual</th><th class="num">Aksi</th></tr>';
    const L = list();
    const prodCell = (p) => `<td><div class="prod"><img loading="lazy" decoding="async" src="${asset(p.img)}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.sku || p.id)}${p.brand ? ` · ${esc(p.brand)}` : ''}${p.badge ? ` · ${esc(p.badge)}` : ''}${p.featured ? ' · <i class="fa-solid fa-star" style="color:var(--gold)"></i> Unggulan' : ''}</small></div></div></td>`;
    /* Varian 2 atribut: ringkas per atribut 1 (mis. ukuran) + tombol tabel Ukuran × Warna */
    const varChips = (p) => { if (!DB.hasVariant(p)) return '';
      if (!DB.isVar2(p)) { const O = p.variant.options; const shown = O.length > 6 ? O.slice(0, 5) : O; const nm = (o) => esc(o.name.replace(/\s*\(.*\)/, ''));
        return `<div class="var-chips" title="${esc(O.map((o) => o.name + ': ' + o.stock).join(', '))}"><small class="muted">${esc(DB.variantLabel(p) || 'Ukuran')} · stok</small>${shown.map((o) => `<span>${nm(o)} <b>${o.stock}</b></span>`).join('')}${O.length > 6 ? `<span class="muted">+${O.length - 5} lainnya</span>` : ''}</div>`; }
      const [A, B] = DB.variantAxes(p); const tot = (a) => p.variant.options.filter((o) => DB.vParts(p, o.name)[0] === a).reduce((x, o) => x + (+o.stock || 0), 0);
      return `<div class="var-chips">${A.values.map((a) => `<span>${esc(String(a).replace(/\s*\(.*\)/, ''))} <b>${tot(a)}</b></span>`).join('')}</div><button type="button" class="link-btn var-mx-btn" data-vmx="${p.id}"><i class="fa-solid fa-table-cells"></i> ${esc(String(A.label).replace(/\s*\(.*\)/, ''))} × ${esc(B.label)} (${B.values.length} ${esc(B.label.toLowerCase())})</button>`; };
    /* Aksi per baris: Restock & Edit; tombol Unit hanya muncul bila ada unit yang perlu perawatan (selain itu di menu "⋯") */
    const actions = (p, off) => `<td><div class="acts acts-compact">
          ${KIND === 'rent' && p.units ? `<button class="btn btn-light btn-xs" data-units="${p.id}" title="${needsCare(p) ? 'Ada unit yang perlu perawatan' : 'Lihat dan atur unit fisik'}"><i class="fa-solid fa-barcode"></i> Unit fisik${needsCare(p) ? ' <span class="dot-warn"></span>' : ''}</button>` : ''}
          <button class="btn btn-primary btn-xs" data-restock="${p.id}" title="${KIND === 'rent' ? 'Tambah unit barang sewa baru (harga beli & jumlah)' : 'Catat barang masuk dari supplier'}"><i class="fa-solid fa-truck-ramp-box"></i> Restock</button>
          <button class="btn btn-light btn-xs" data-edit="${p.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <div class="act-more"><button class="btn btn-light btn-xs act-more-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Aksi lainnya"><i class="fa-solid fa-ellipsis"></i></button>
            <div class="act-menu" role="menu" hidden>
              <button type="button" role="menuitem" data-hist="${p.id}"><i class="fa-solid fa-clock-rotate-left"></i> ${KIND === 'rent' ? 'Riwayat penyewaan' : 'Riwayat penjualan'}</button>
              <a role="menuitem" href="${url('produk?id=' + p.id + (KIND === 'buy' ? '&mode=beli' : ''))}" target="_blank" rel="noopener noreferrer"><i class="fa-regular fa-eye"></i> Lihat di website</a>
              <button type="button" role="menuitem" data-toggle="${p.id}" class="${off ? '' : 'danger'}"><i class="fa-solid ${off ? 'fa-toggle-off' : 'fa-toggle-on'}"></i> ${off ? 'Aktifkan kembali' : 'Nonaktifkan barang'}</button>
            </div></div></div></td>`;
    $('#rows').innerHTML = L.length ? L.map((p) => {
      const off = p.active === false;
      if (KIND === 'rent') {
        const rented = Rules.rentedNow(p.id), avail = Rules.availableOn(p.id, T);
        return `<tr class="${off ? 'row-off' : ''}">${prodCell(p)}<td>${esc(catName(p.cat))}</td>
          <td class="num">${rupiah(p.rent)}<small>/ malam</small><small>${[p.rent3 && '3 hari ' + rupiah(p.rent3), p.rent5 && '5 hari ' + rupiah(p.rent5)].filter(Boolean).join(' · ')}</small></td>
          <td>${varChips(p)}<span class="stock-chip">Stok <b>${p.stock}</b></span><span class="stock-chip">Tersedia <b style="color:${avail <= 2 ? 'var(--red)' : 'var(--g700)'}">${avail}</b></span>${rented ? `<span class="stock-chip">Disewa <b>${rented}</b></span>` : ''}</td>
          <td><span class="pill ${DB.condTone(p.cond)}">${esc(p.cond || 'Baik')}</span>${DB.condRentable(p.cond) ? '' : '<small style="color:var(--red)">Tidak bisa disewa</small>'}${off ? '<small><span class="pill gray plain">Tidak Aktif</span></small>' : ''}</td>
          ${actions(p, off)}</tr>`;
      }
      const low = DB.lowStock().some((x) => x.id === p.id);
      return `<tr class="${off ? 'row-off' : ''}">${prodCell(p)}<td>${esc(catName(p.cat))}</td>
        <td class="num">${rupiah(p.price)}<small>${p.cost != null && p.cost !== '' ? `modal ${rupiah(p.cost)} · margin ${p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%` : '<b style="color:var(--red)">harga beli belum diisi</b>'}</small></td>
        <td>${varChips(p)}<span class="stock-chip">Stok <b style="color:${low ? 'var(--red)' : 'var(--g700)'}">${p.stock}</b></span><span class="stock-chip ${low ? 'restock' : ''}" title="Ingatkan restock bila stok ≤ ${p.minStock ?? 0}">Min. stok <b>${p.minStock ?? 0}</b></span>${low ? '<small class="need-restock"><i class="fa-solid fa-triangle-exclamation"></i> Perlu restock</small>' : ''}${off ? '<small><span class="pill gray plain">Tidak Aktif</span></small>' : ''}</td>
        <td class="num">${soldQty(p.id)} unit</td>
        ${actions(p, off)}</tr>`;
    }).join('') : `<tr><td colspan="6" class="muted" style="text-align:center;padding:26px">Tidak ada barang ${KIND === 'rent' ? 'sewa' : 'jual'} yang cocok.</td></tr>`;
    $('#cats').innerHTML = cats().map((c) => { const n = prods().filter((p) => p.cat === c.id).length; const off = c.active === false; const at = DB.attrsForCat(c.id); return `<div class="list-row ${off ? 'row-off' : ''}"><img loading="lazy" decoding="async" src="${asset(c.img)}" alt="" style="width:52px;height:42px;object-fit:cover;border-radius:8px"><div class="nm"><strong>${esc(c.name)}</strong>${off ? ' <span class="pill gray plain">Tidak Aktif</span>' : ''}<small>${n} barang${at.length ? ' · atribut: ' + at.map((a) => esc(a.name) + (a.variant ? ' (varian stok)' : '')).join(', ') : ''}</small></div></div>`; }).join('');
  }

  const ACTIVE_STS = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'];
  const bookedSize = (pid, size) => DB.bookings().filter((b) => ACTIVE_STS.includes(b.status)).reduce((n, b) => n + b.items.reduce((t, it) => t + it.components.filter((c) => c.productId === pid && c.size === size).reduce((u, c) => u + c.qty * it.qty, 0), 0), 0);

  function form(p) {
    const isNew = !p;
    p = p ? JSON.parse(JSON.stringify(DB.get('products').find((x) => x.id === p.id) || p)) : { id: '', name: '', cat: cats()[0].id, img: '', rent: 0, price: 0, stock: 1, rating: 5, reviews: 0, cond: 'Sangat Baik', badge: '', featured: false, desc: '', specs: [], active: true, minDays: 1 };
    let img = p.img;
    /* Varian: 1 atribut (mis. Ukuran) atau 2 atribut (mis. Ukuran + Warna) dengan stok per kombinasi */
    const V0 = DB.hasVariant(p) ? p.variant : null;
    let vattr = V0 ? (V0.attrId || '') : '';
    let vattr2 = V0 && V0.label2 ? (V0.attrId2 || '') : '';
    const stockMap = {}; if (V0) V0.options.forEach((o) => { stockMap[o.name] = o.stock; });
    const parts0 = (n) => DB.vParts(p, n);
    let sel1 = new Set(V0 ? V0.options.map((o) => parts0(o.name)[0]) : []);
    let sel2 = new Set(V0 && V0.label2 ? V0.options.map((o) => parts0(o.name)[1]).filter(Boolean) : []);
    /* stok kombinasi lama: "42" (1 atribut) → dipakai sebagai stok awal "42 / Hitam" bila owner menambah atribut kedua */
    const attrVals = Object.assign({}, p.attrs || {});
    const varAttrs = (cat) => DB.attrsForCat(cat).filter((a) => a.variant && a.type === 'pilihan');
    const infoAttrs = (cat) => DB.attrsForCat(cat).filter((a) => !a.variant);
    const sec = (ic, t, sub) => `<div class="pf-sec"><h4><i class="fa-solid ${ic}"></i> ${t}</h4>${sub ? `<p>${sub}</p>` : ''}</div>`;
    let fk = isNew ? KIND : kindOf(p);
    const kindOpt = (k, ic, t, d) => `<label class="pk-opt"><input type="radio" name="pkind" value="${k}" ${fk === k ? 'checked' : ''}><span><i class="fa-solid ${ic}"></i><b>${t}</b><small>${d}</small></span></label>`;
    const m = modal({ title: isNew ? 'Tambah barang' : `Edit ${esc(p.name)}`, size: 'xl', body: `
      <form id="pf" novalidate class="pf">
        ${isNew ? `<div class="pk-pick"><p class="pk-q">Jenis barang</p><div class="pk-opts">${kindOpt('rent', 'fa-campground', 'Barang sewa', 'Disewakan per malam / 3 hari / 5 hari. Punya unit fisik yang kembali ke gudang.')}${kindOpt('buy', 'fa-bag-shopping', 'Barang jual', 'Dijual putus ke customer. Stok berkurang saat terjual dan tidak bisa disewa.')}</div></div>`
          : `<div class="notice ${fk === 'rent' ? 'green' : 'blue'}" style="margin-bottom:14px"><i class="fa-solid ${fk === 'rent' ? 'fa-campground' : 'fa-bag-shopping'}"></i><div><b>Barang ${fk === 'rent' ? 'sewa' : 'jual'}</b> · jenis barang tidak bisa diubah supaya riwayat ${fk === 'rent' ? 'penyewaan' : 'penjualan'} tidak tercampur.</div></div>`}
        ${sec('fa-circle-info', 'Informasi dasar')}
        <div class="pf-top">
          <div><div class="pf-photo" id="prev">${img ? `<img src="${asset(img)}" alt="">` : '<i class="fa-regular fa-image"></i>'}</div>
            <label class="btn btn-light btn-xs btn-block" style="margin-top:8px;cursor:pointer"><i class="fa-solid fa-upload"></i> Upload foto<input type="file" accept="image/*" id="pImg" hidden></label><span class="hint">JPG/PNG, maks. 5 MB</span></div>
          <div>
            <div class="field"><label>Nama barang <span class="req">*</span></label><input class="input" name="pname" value="${esc(p.name)}" placeholder="Contoh: Jaket Gunung Waterproof"></div>
              <div class="field"><label>Kategori</label><select class="select" name="cat">${cats().map((c) => `<option value="${c.id}" ${c.id === p.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <!-- Isian yang jarang diubah dilipat (tetap tersimpan seperti biasa) -->
            <details class="more-box pf-more"><summary><i class="fa-solid fa-plus"></i> Pengaturan lain <span class="opt">(merek, kode, kondisi, status, label)</span></summary><div class="more-in">
            <div class="grid-3">
              <div class="field"><label>Merek <span class="opt">(opsional)</span></label><input class="input" name="brand" value="${esc(p.brand || '')}" placeholder="Eiger, Consina…"></div>
              <div class="field"><label>Kode barang / SKU <span class="opt">(opsional)</span></label><input class="input" name="sku" value="${esc(p.sku || '')}" placeholder="JKT-WP-01"></div>
              <div class="field" data-k="rent"><label>Kondisi</label><select class="select" name="cond">${CONDS.map((c) => `<option ${c === p.cond ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>Status</label><select class="select" name="active"><option value="1" ${p.active !== false ? 'selected' : ''}>Aktif</option><option value="0" ${p.active === false ? 'selected' : ''}>Tidak aktif</option></select></div>
              <div class="field"><label>Label <span class="opt">(opsional)</span></label><select class="select" name="badge"><option value="">Tanpa label</option>${DB.ADMIN_BADGES.map((b) => `<option ${p.badge === b ? 'selected' : ''}>${b}</option>`).join('')}</select><span class="hint">Label Terlaris, Hampir habis, dan Rating Tertinggi diberikan otomatis oleh sistem.</span></div>
            </div>
            </div></details>
          </div>
        </div>

        ${sec('fa-tags', 'Harga & ketentuan', '<span data-k="rent">Isi 3 tarif sewa sesuai price list: per malam, perkegiatan 3 hari, dan ekspedisi 5 hari.</span><span data-k="buy">Isi harga jual dan stok minimum untuk pengingat restock.</span>')}
        <div class="grid-3" data-k="rent">
          <div class="field"><label>Sewa per malam (Rp) <span class="req">*</span></label><input class="input" type="number" min="0" step="1000" name="rent" value="${p.rent}"></div>
          <div class="field"><label>Perkegiatan · 3 hari (Rp)</label><input class="input" type="number" min="0" step="1000" name="rent3" value="${p.rent3 || ''}" placeholder="Otomatis"><span class="hint" id="r3h">Kosongkan = otomatis</span></div>
          <div class="field"><label>Ekspedisi · 5 hari (Rp)</label><input class="input" type="number" min="0" step="1000" name="rent5" value="${p.rent5 || ''}" placeholder="Otomatis"><span class="hint" id="r5h">Kosongkan = otomatis</span></div>
        </div>
        <div class="grid-2" data-k="buy"><!-- Harga beli/modal & harga jual: tidak diubah (dipakai Keuangan) -->
          <div class="field" data-k="buy"><label>Harga beli / modal (Rp) <span class="req">*</span></label><input class="input" type="number" min="0" step="500" name="cost" value="${p.cost != null ? p.cost : ''}" placeholder="Harga dari supplier"></div>
          <div class="field" data-k="buy"><label>Harga jual (Rp) <span class="req">*</span></label><input class="input" type="number" min="0" step="1000" name="price" value="${p.price}"><div class="mk-info" id="mkInfo"></div></div>
        </div>
        <details class="more-box pf-more"><summary><i class="fa-solid fa-plus"></i> Aturan khusus barang ini <span class="opt">(opsional)</span></summary><div class="more-in">
        <div class="grid-4">
          <div class="field" data-k="rent"><label>Minimal sewa (malam)</label><input class="input" type="number" min="1" max="30" name="minDays" value="${p.minDays || 1}"></div>
          <div class="field" data-k="rent"><label>Jaminan / deposit (Rp) <span class="opt">(opsional)</span></label><input class="input" type="number" min="0" step="5000" name="deposit" value="${p.deposit || 0}"><span class="hint">Opsional</span></div>
          <div class="field" data-k="buy"><label>Stok minimum</label><input class="input" type="number" min="0" name="minStock" value="${p.minStock ?? (DB.settings().minStockDefault ?? 2)}"><span class="hint">Staff diberi notifikasi bila stok ≤ angka ini.</span></div>
          <div class="field" data-k="rent"><label>Perawatan tiap … kali sewa</label><input class="input" type="number" min="0" name="serviceEvery" value="${p.serviceEvery || ''}" placeholder="${DB.settings().serviceEvery || 10} (default)"><span class="hint">Kosongkan = ikut aturan toko.</span></div>
          <div class="field" data-k="rent"><label>Wajib dicuci setiap kembali</label><select class="select" name="wash"><option value="" ${p.wash == null ? 'selected' : ''}>Ikuti kategori${DB.washCats().includes(p.cat) ? ' (ya)' : ' (tidak)'}</option><option value="1" ${p.wash === true ? 'selected' : ''}>Ya, selalu dicuci</option><option value="0" ${p.wash === false ? 'selected' : ''}>Tidak perlu dicuci</option></select></div>
        </div>
        </div></details>

        ${sec('fa-ruler', 'Stok & pilihan ukuran', 'Bila barang punya pilihan dengan stok berbeda (mis. ukuran sepatu 40, 41), pilih di sini lalu isi stok tiap pilihan. Bila tidak, cukup isi jumlah stok.')}
        <div class="grid-3">
          <div class="field"><label>Pilihan yang stoknya terpisah</label><select class="select" id="vType"></select><span class="hint" id="vHint"></span></div>
          <div class="field" id="v2Wrap"><label>Pilihan kedua <span class="opt">(opsional)</span></label><select class="select" id="vType2"></select><span class="hint">Contoh: Ukuran + <b>Warna</b>. Stok dihitung per kombinasi, harga tetap sama.</span></div>
          <div class="field" id="stockF"><label>Stok (unit)</label><input class="input" type="number" min="0" name="stock" value="${p.stock}" ${p.id ? 'readonly' : ''}><span class="hint" id="stockHint">${p.id ? (fk === 'rent' ? 'Tambah lewat <b>Restock</b>, kurangi lewat <b>Unit fisik</b>.' : 'Tambah lewat <b>Restock</b>. Kurangi di sini, akan diminta alasan.') : 'Stok awal saat barang pertama kali ditambahkan.'}</span></div>
        </div>
        ${p.id ? `<div class="stk-acts"><span><i class="fa-solid fa-boxes-stacked"></i> Ubah stok:</span><button type="button" class="btn btn-light btn-xs" data-go="restock"><i class="fa-solid fa-plus"></i> Tambah barang (Restock)</button>${p.rent > 0 ? '<button type="button" class="btn btn-light btn-xs" data-go="koreksi"><i class="fa-solid fa-barcode"></i> Kurangi unit (Unit fisik)</button>' : ''}</div>` : ''}
        <div id="vBox"></div>
        <div id="attrBox"></div>

        ${sec('fa-list-check', 'Detail & spesifikasi (opsional)', 'Semua isian di bagian ini boleh dikosongkan. Isi seperlunya saja, misalnya barang habis pakai seperti gas cukup diisi deskripsi singkat.')}
          <div class="field"><label>Kelengkapan <span class="opt">(opsional)</span></label><input class="input" name="includes" value="${esc(p.includes || '')}" placeholder="Contoh: frame, flysheet, 12 pasak, tas"></div>
        <details class="more-box pf-more"><summary><i class="fa-solid fa-plus"></i> Detail lain <span class="opt">(warna, bahan, berat, ukuran)</span></summary><div class="more-in">
        <div class="grid-3">
          <div class="field"><label>Warna <span class="opt">(opsional)</span></label><input class="input" name="color" value="${esc(p.color || '')}" placeholder="Hijau army"></div>
          <div class="field"><label>Bahan <span class="opt">(opsional)</span></label><input class="input" name="material" value="${esc(p.material || '')}" placeholder="Nylon ripstop 420D"></div>
          <div class="field"><label>Berat <span class="opt">(opsional)</span></label><input class="input" name="weight" value="${esc(p.weight || '')}" placeholder="1,2 kg"></div>
        </div>
          <div class="field"><label>Dimensi / kapasitas / panduan ukuran <span class="opt">(opsional)</span></label><input class="input" name="dimension" value="${esc(p.dimension || '')}" placeholder="Contoh: 60 liter · atau lingkar dada M 106 cm"></div>
        </div></details>
        <div class="field"><label>Deskripsi <span class="opt">(opsional)</span></label><textarea class="textarea" name="desc" rows="3" placeholder="Jelaskan kegunaan, keunggulan, dan cara pakai singkat">${esc(p.desc || '')}</textarea></div>
        <div class="field"><label>Spesifikasi singkat (satu per baris) <span class="opt">(opsional)</span></label><textarea class="textarea" name="specs" rows="3" placeholder="Waterproof 3000mm&#10;Kapasitas 4 orang">${esc((p.specs || []).join('\n'))}</textarea></div>
        <!-- Sematkan di beranda kini diatur di Konfigurasi Sistem → Tampilan & dokumen → Tampilan Beranda -->
      </form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="pSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button>` });
    const F = m.$('#pf'), E = F.elements;
    /* Barang yang sudah ada: stok tidak diketik di sini (mencegah stok bertambah tanpa tercatat / tercatat dua kali) */
    let dirty = false; F.addEventListener('input', () => { dirty = true; });
    /* Stok bisa diubah langsung di Edit: tambah lewat Restock, kurang/pindah lewat Edit (hitung ulang). */
    m.el.addEventListener('click', async (e) => { const g = e.target.closest('[data-go]'); if (!g || g.closest('.pf-nav')) return;
      if (dirty && !(await confirmBox({ title: 'Tutup form tanpa menyimpan?', text: 'Perubahan lain di form ini belum disimpan. Simpan dulu bila perlu, lalu buka Restock.', ok: 'Tutup & lanjut', cancel: 'Kembali ke form' }))) return;
      m.close(); setTimeout(() => (g.dataset.go === 'restock' ? restockModal(p.id) : unitsModal(p.id)), 230); });
    /* Harga paket 3 & 5 hari: kosong = otomatis (disimpan 0 seperti sebelumnya); tampilkan perkiraan nominalnya */
    const autoHint = () => { if (!E.rent || !m.$('#r3h')) return; const r = +E.rent.value || 0; const v3 = +E.rent3.value || 0;
      const a3 = Rules.tierPlan({ d1: r, d3: 0, d5: 0 }, 3).total; const a5 = Rules.tierPlan({ d1: r, d3: v3, d5: 0 }, 5).total;
      m.$('#r3h').textContent = r ? `Kosongkan = otomatis ${rupiah(a3)}` : 'Kosongkan = otomatis'; m.$('#r5h').textContent = r ? `Kosongkan = otomatis ${rupiah(a5)}` : 'Kosongkan = otomatis'; };
    ['rent', 'rent3'].forEach((n) => E[n] && E[n].addEventListener('input', autoHint)); autoHint();
    /* Markup = (jual − beli) ÷ beli · Margin keuntungan = (jual − beli) ÷ jual — dihitung langsung saat diketik */
    const mk = () => { const box = m.$('#mkInfo'); if (!box) return; const b = +String(E.cost.value).replace(/[^\d]/g, '') || 0, j = +String(E.price.value).replace(/[^\d]/g, '') || 0;
      if (!b || !j) { box.innerHTML = '<span class="muted">Isi harga beli &amp; jual untuk melihat markup dan margin.</span>'; return; }
      const up = Math.round(((j - b) / b) * 100), mg = Math.round(((j - b) / j) * 100), neg = j < b;
      box.innerHTML = `<span class="${neg ? 'bad' : ''}">Markup penjualan <b>${up}%</b></span><span class="${neg ? 'bad' : ''}">Margin keuntungan <b>${mg}%</b></span><span>Laba per unit <b>${neg ? '− ' : ''}${rupiah(Math.abs(j - b))}</b></span>`; };
    ['cost', 'price'].forEach((k) => E[k] && E[k].addEventListener('input', mk)); mk();
    { const secs = m.$$('.pf-sec'); secs.forEach((x, i) => { x.id = 'pfs' + i; });
      /* Kepala & tombol Simpan tetap di tempat; hanya isi form yang digulir, jadi navigasi bagian tidak menempel/menutupi judul modal */
      m.$('.modal-box').classList.add('pf-modal');
      m.$('.modal-body').insertAdjacentHTML('afterbegin', `<nav class="pf-nav">${secs.map((x, i) => `<button type="button" data-go="pfs${i}">${x.querySelector('h4').innerHTML}</button>`).join('')}</nav>`);
      m.$('.pf-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) m.$('#' + b.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
    const O = Admin.isOwner;
    /* Tampilkan hanya isian yang relevan untuk jenis barang */
    const applyKind = () => { m.$$('[data-k]').forEach((el) => { el.hidden = el.dataset.k !== fk; }); m.$('#stockF label').textContent = fk === 'rent' ? 'Jumlah unit' : 'Stok'; };
    m.$$('input[name="pkind"]').forEach((r) => r.addEventListener('change', () => { fk = r.value; applyKind(); }));
    const attrById = (id) => DB.attributes(true).find((a) => a.id === id);
    const curAttr = () => attrById(vattr);
    function fillVType() {
      const list = varAttrs(E.cat.value); const cur0 = curAttr();
      if (vattr && !list.some((a) => a.id === vattr) && cur0) list.push(cur0);
      if (V0 && !V0.attrId) list.push({ id: '', name: V0.label, values: [...sel1], legacy: true });
      m.$('#vType').innerHTML = '<option value="__none">Tanpa varian (satu stok)</option>' + list.map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.values.map((v) => v.replace(/\s*\(.*\)/, '')).slice(0, 8).join(', '))}${a.values.length > 8 ? ', …' : ''}</option>`).join('');
      m.$('#vType').value = V0 || vattr ? vattr : '__none';
      if (m.$('#vType').value !== (vattr || '__none')) m.$('#vType').value = '__none';
      m.$('#vHint').innerHTML = list.length ? '' : `Kategori ini belum punya atribut varian.${O ? ` Tambahkan di <a class="link" href="${Admin.O('konfigurasi?s=atribut')}">Konfigurasi → Atribut Barang</a>.` : ' Minta Owner menambahkannya di Konfigurasi Sistem.'}`;
      fillVType2();
    }
    function fillVType2() {
      const L = varAttrs(E.cat.value).filter((a) => a.id !== vattr); const a2 = attrById(vattr2);
      if (vattr2 && a2 && !L.some((a) => a.id === vattr2)) L.push(a2);
      if (V0 && V0.label2 && !V0.attrId2) L.push({ id: '', name: V0.label2, values: [...sel2], legacy: true });
      m.$('#vType2').innerHTML = '<option value="__none">Tanpa atribut kedua</option>' + L.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      m.$('#vType2').value = (V0 && V0.label2) || vattr2 ? vattr2 : '__none';
      if (!L.length) m.$('#vType2').value = '__none';
    }
    const isVar = () => m.$('#vType').value !== '__none';
    const is2 = () => isVar() && m.$('#vType2').value !== '__none';
    const lbl1 = () => (curAttr() || {}).name || (V0 && V0.label) || 'Varian';
    const lbl2 = () => (attrById(vattr2) || {}).name || (V0 && V0.label2) || 'Atribut 2';
    const vals1 = () => { const a = curAttr(); const base = a ? a.values : V0 && !V0.attrId ? [...new Set(V0.options.map((o) => parts0(o.name)[0]))] : []; return [...base, ...[...sel1].filter((v) => !base.includes(v))]; };
    const vals2 = () => { const a = attrById(vattr2); const base = a ? a.values : V0 && V0.label2 && !V0.attrId2 ? [...new Set(V0.options.map((o) => parts0(o.name)[1]).filter(Boolean))] : []; return [...base, ...[...sel2].filter((v) => !base.includes(v))]; };
    const combo = (a, b) => (is2() ? `${a}${DB.VSEP}${b}` : a);
    /* Daftar opsi varian sesuai pilihan sekarang: [{ name, v1, v2 }] */
    const combos = () => { const A = vals1().filter((v) => sel1.has(v)); if (!is2()) return A.map((a) => ({ name: a, v1: a })); const B = vals2().filter((v) => sel2.has(v)); return A.flatMap((a) => B.map((b) => ({ name: combo(a, b), v1: a, v2: b }))); };
    /* Menambah atribut kedua pada barang yang sudah punya stok per ukuran: stok ukuran lama (mis. "39")
       dipindah ke kombinasi warna PERTAMA yang dipilih ("39 / Hitam"); kombinasi lain mulai dari 0 */
    const seedOf = (c) => {
      const [a, b] = c.v1 != null ? [c.v1, c.v2] : String(c.name).split(DB.VSEP);
      if (b == null || V0 == null || V0.label2 || stockMap[a] == null) return null;
      const first = vals2().find((v) => sel2.has(v));
      return b === first ? +stockMap[a] : 0;
    };
    const stockOf = (c) => (stockMap[c.name] != null ? +stockMap[c.name] : 0);
    const usedOf = (name) => (p.id ? bookedSize(p.id, name) : 0);
    const lockedVal = (axis, v) => combos().length && (p.id ? (V0 ? V0.options : []).some((o) => { const [a, b] = parts0(o.name); return (axis === 1 ? a === v : b === v) && usedOf(o.name); }) : false);
    const chips = (axis, vals, sel) => `<div class="var2-vals">${vals.map((v) => { const on = sel.has(v); const lock = on && lockedVal(axis, v); return `<label class="${on ? 'on' : ''} ${lock ? 'lock' : ''}" title="${lock ? 'Sedang dipakai booking aktif' : ''}"><input type="checkbox" data-v${axis}="${esc(v)}" ${on ? 'checked' : ''} ${lock ? 'disabled' : ''}> ${esc(v)}</label>`; }).join('') || '<span class="muted" style="font-size:12.5px">Belum ada nilai.</span>'}</div>
      ${O ? `<div class="var2-add"><input class="input" data-newv="${axis}" placeholder="Tambah nilai ${esc(axis === 1 ? lbl1() : lbl2()).toLowerCase()}…" maxlength="30"><button type="button" class="btn btn-light btn-xs" data-addv="${axis}"><i class="fa-solid fa-plus"></i> Tambah</button></div>` : ''}`;
    function drawV() {
      const has = isVar();
      m.$('#v2Wrap').hidden = !has;
      const lockStock = has || (!!p.id && fk === 'rent'); E.stock.readOnly = lockStock; m.$('#stockF').classList.toggle('ro', lockStock);
      if (!has) { m.$('#vBox').innerHTML = ''; return; }
      /* Atribut kedua dihapus (mis. warna + ukuran → ukuran): stok tiap ukuran = jumlah semua kombinasi lamanya, otomatis */
      if (has && !is2() && V0 && V0.label2) vals1().forEach((v) => { if (stockMap[v] == null) stockMap[v] = V0.options.filter((o) => parts0(o.name)[0] === v).reduce((s0, o) => s0 + (+o.stock || 0), 0); });
      const C = combos(); const total = C.reduce((a, c) => a + stockOf(c), 0); E.stock.value = total;
      /* Atribut warna tunggal: pakai checklist chip seperti sepatu, stok diisi per warna yang dicentang */
      if (!is2() && /^warna$/i.test(lbl1())) {
        const chk = vals1().filter((v) => sel1.has(v));
        m.$('#vBox').innerHTML = `<div class="var2-pick"><div><b style="font-size:13.5px">${esc(lbl1())}</b> <small class="muted">centang yang tersedia</small>${chips(1, vals1(), sel1)}</div></div>
          ${chk.length ? `<div class="var-tbl"><div class="var-h"><span>${esc(lbl1())}</span><span>Stok</span><span>Sedang dipakai</span><span></span></div>
          ${chk.map((v) => { const used = usedOf(v); return `<label class="var-row"><span class="var-chk"><b>${esc(v)}</b></span><input class="input" type="number" min="${used}" data-vs="${esc(v)}" value="${stockMap[v] ?? 0}"><span class="muted">${used ? `${used} unit di booking aktif` : '—'}</span><span></span></label>`; }).join('')}
          <div class="var-foot"><span class="muted">${p.id ? 'Untuk menambah stok, gunakan Restock.' : 'Isi stok tiap warna.'}</span><span>Total <b id="vTot">${total}</b> unit</span></div></div>` : '<p class="var-hint"><i class="fa-solid fa-circle-info"></i> Centang minimal satu warna untuk mengisi stoknya.</p>'}`;
        drawUnassigned(); warnNow();
        return;
      }
      if (!is2()) {
        m.$('#vBox').innerHTML = `<div class="var-tbl"><div class="var-h"><span>${esc(lbl1())}</span><span>Stok</span><span>Sedang dipakai</span><span></span></div>
          ${vals1().map((v) => { const used = usedOf(v); const on = sel1.has(v); return `<label class="var-row ${on ? '' : 'off'}"><span class="var-chk"><input type="checkbox" data-v1="${esc(v)}" ${on ? 'checked' : ''} ${used ? 'disabled' : ''}> <b>${esc(v)}</b></span><input class="input" type="number" min="0" data-vs="${esc(v)}" value="${stockMap[v] ?? 0}" ${on ? '' : 'disabled'}><span class="muted">${used ? `${used} unit di booking aktif` : '—'}</span><span></span></label>`; }).join('')}
          <div class="var-foot"><span class="muted">${O ? 'Butuh nilai baru? Tambahkan di bawah.' : 'Nilai baru ditambahkan Owner di Konfigurasi Sistem.'}</span><span>Total <b id="vTot">${total}</b> unit</span></div></div>
          ${O ? `<div class="var2-add"><input class="input" data-newv="1" placeholder="Tambah nilai ${esc(lbl1().toLowerCase())}…" maxlength="30"><button type="button" class="btn btn-light btn-xs" data-addv="1"><i class="fa-solid fa-plus"></i> Tambah</button></div>` : ''}`;
        drawUnassigned(); warnNow();
        return;
      }
      const A = vals1().filter((v) => sel1.has(v)), B = vals2().filter((v) => sel2.has(v));
      const colTot = (b) => A.reduce((s0, a) => s0 + stockOf({ name: combo(a, b) }), 0);
      m.$('#vBox').innerHTML = `<div class="var2-pick">
          <div><b style="font-size:13.5px">${esc(lbl1())}</b> <small class="muted">centang yang tersedia</small>${chips(1, vals1(), sel1)}</div>
          <div><b style="font-size:13.5px">${esc(lbl2())}</b> <small class="muted">centang yang tersedia</small>${chips(2, vals2(), sel2)}</div></div>
        ${A.length && B.length ? `<div class="var-mx"><table><thead><tr><th>${esc(lbl1())} \\ ${esc(lbl2())}</th>${B.map((b) => `<th>${esc(b)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
          ${A.map((a) => `<tr><td>${esc(a)}</td>${B.map((b) => { const n = combo(a, b); const u = usedOf(n); return `<td><input class="input" type="number" min="${u}" data-vs="${esc(n)}" value="${stockOf({ name: n })}" aria-label="Stok ${esc(a)} ${esc(b)}">${u ? `<small>${u} dipakai</small>` : ''}</td>`; }).join('')}<td data-rt="${esc(a)}">${B.reduce((s0, b) => s0 + stockOf({ name: combo(a, b) }), 0)}</td></tr>`).join('')}
          </tbody><tfoot><tr><td>Total</td>${B.map((b) => `<td data-ct="${esc(b)}">${colTot(b)}</td>`).join('')}<td id="vTot">${total}</td></tr></tfoot></table></div>
          <p class="var-hint"><i class="fa-solid fa-circle-info"></i> Isi stok tiap kombinasi (mis. ${esc(A[0])} ${esc(B[0])} = 3). Isi 0 bila kombinasi itu tidak ada. Harga sewa/jual sama untuk semua kombinasi.</p>`
          : '<p class="var-hint"><i class="fa-solid fa-circle-info"></i> Centang minimal satu nilai di masing-masing atribut untuk mengisi stok per kombinasi.</p>'}`;
      drawUnassigned(); warnNow();
    }
    /* Peringatan stok di Edit: menambah diarahkan ke Restock; mengurangi wajib memilih alasan hitung ulang */
    const warnNow = () => {
      if (!p.id) return;
      const orig = DB.hasVariant(p) ? p.variant.options.reduce((a, o) => a + (+o.stock || 0), 0) : (+p.stock || 0);
      const tot = combos().reduce((a, c) => a + stockOf(c), 0);
      const diff = tot - orig;
      let w = m.$('#vWarn');
      if (!w) { w = document.createElement('div'); w.id = 'vWarn'; w.className = 'notice'; const tv = m.$('#vTot'); const anc = tv && (tv.closest('table') || tv.closest('.var-tbl')); if (anc) anc.insertAdjacentElement('afterend', w); else E.stock.closest('.field').insertAdjacentElement('afterend', w); }
      w.style.display = diff ? '' : 'none';
      w.innerHTML = !diff ? '' : `<i class="fa-solid fa-triangle-exclamation"></i><div>Total sekarang <b>${tot}</b> (sebelumnya <b>${orig}</b>). ${diff > 0 ? 'Saat Simpan, penambahan dibuka lewat <b>Restock</b>.' : (fk === 'rent' ? 'Bagi unit ke pilihan sampai totalnya sama. Pengurangan dilakukan lewat <b>Unit fisik</b>.' : 'Saat Simpan, pengurangan dicatat sebagai <b>koreksi</b> dan perlu alasan.')}</div>`;
    };
    const recount = () => { drawUnassigned(); const C = combos(); const tot = C.reduce((a, c) => a + stockOf(c), 0); E.stock.value = tot; const t = m.$('#vTot'); if (t) t.textContent = tot;
      const hint = m.$('#stockHint');
      if (hint && p.id && p.units) { const left = unplacedList().filter((u) => !assign[u.code]).length; hint.innerHTML = `Total <b>${tot}</b> unit.${left ? ` Belum dibagi: <b style="color:var(--red)">${left}</b>.` : ''} Tambah stok lewat <b>Restock</b>.`; }
      warnNow();
      if (is2()) { m.$$('[data-rt]').forEach((td) => { td.textContent = vals2().filter((v) => sel2.has(v)).reduce((s0, b) => s0 + stockOf({ name: combo(td.dataset.rt, b) }), 0); }); m.$$('[data-ct]').forEach((td) => { td.textContent = vals1().filter((v) => sel1.has(v)).reduce((s0, a) => s0 + stockOf({ name: combo(a, td.dataset.ct) }), 0); }); } };
    /* Stok awal kombinasi baru: ambil dari stok lama bila sebelumnya hanya 1 atribut */
    /* Unit yang belum punya kombinasi (mis. dibuat sebelum barang punya atribut): admin memilih kombinasinya di sini */
    const assign = {};
    const keptSet = () => new Set(V0 ? V0.options.map((o) => o.name).filter((n) => combos().some((c) => c.name === n)) : []);
    const unplacedList = () => { const k = keptSet(); return (p.units || []).filter((u) => u.status !== 'terjual' && u.status !== 'nonaktif' && !k.has(u.size)); };
    const drawUnassigned = () => {
      let box = m.$('#vUnplaced');
      const list = p.id && (+E.rent.value || 0) > 0 ? unplacedList() : [];
      const pendList = list.filter((u) => !assign[u.code]);
      if (!pendList.length) { if (box) box.remove(); return; }
      if (!box) {
        const anchor = m.$('#vTot') && (m.$('#vTot').closest('table') || m.$('#vTot').closest('.var-tbl')); const vb = m.$('#vBox'); if (!anchor && !vb) return;
        box = document.createElement('div'); box.id = 'vUnplaced'; box.className = 'notice';
        box.style.cssText = 'flex-direction:column;align-items:stretch;margin:12px 0';
        if (anchor) anchor.insertAdjacentElement('afterend', box); else vb.appendChild(box);
        box.addEventListener('change', (e) => { const s0 = e.target.closest('[data-ua]'); if (!s0) return; if (s0.value) assign[s0.dataset.ua] = s0.value; else delete assign[s0.dataset.ua]; applyAssign(); });
        box.addEventListener('click', (e) => {
          if (!e.target.closest('[data-qall]')) return;
          const to = box.querySelector('#uaAll').value; if (!to) return;
          unplacedList().filter((u) => !assign[u.code]).forEach((u) => { assign[u.code] = to; });
          applyAssign();
        });
      }
      const kept = keptSet(); const newC = combos().map((c) => c.name).filter((n) => !kept.has(n));
      box.innerHTML = `<div><b>${pendList.length} unit belum punya kombinasi.</b></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><span class="muted">Masukkan semua ke</span><select class="select" id="uaAll" style="width:auto;min-width:160px">${newC.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select><button type="button" class="btn btn-primary btn-xs" data-qall>Terapkan</button></div>
        <details style="margin-top:12px"><summary class="muted" style="cursor:pointer">Atur satu-satu</summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${list.map((u) => `<div style="display:flex;gap:10px;align-items:center"><code style="min-width:120px">${esc(u.code)}</code><span class="muted" style="min-width:150px">${u.size ? 'ukuran lama: ' + esc(u.size) : 'belum ada ukuran'}</span><select class="select" data-ua="${esc(u.code)}" style="flex:1"><option value="">— pilih kombinasi —</option>${newC.map((n) => `<option value="${esc(n)}"${assign[u.code] === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`).join('')}</div></details>`;
    };
    /* stok kombinasi baru tidak lagi diisi otomatis; diatur lewat pembagian unit */
    /* Atribut kedua ditambahkan ke barang yang sudah punya stok: stok lama langsung ikut, tanpa isi satu-satu.
       - Unit yang sudah punya ukuran tetap di ukurannya, masuk ke warna pertama yang dicentang.
       - Unit tanpa ukuran (atau stok tanpa unit) masuk ke kombinasi pertama.
       Setelah itu bisa diubah di tabel (pindah stok, tanpa alasan). */
    const seedCombos = () => {
      if (!p.id || !is2()) return;
      const first = vals2().find((v) => sel2.has(v)); if (!first) return;
      const C = combos(); const kept = keptSet();
      if (p.units) {
        Object.keys(assign).forEach((k) => { if (!C.some((c) => c.name === assign[k])) delete assign[k]; });
        let moved = 0;
        p.units.forEach((u) => {
          if (u.status === 'terjual' || u.status === 'nonaktif' || assign[u.code] || kept.has(u.size)) return;
          const base = u.size ? String(u.size).split(DB.VSEP)[0] : '';
          if (base && !C.some((c) => c.v1 === base)) return; /* ukuran ini sedang tidak dicentang: biarkan, pilih manual */
          const target = base ? C.find((c) => c.v1 === base && c.v2 === first) : C.find((c) => c.v2 === first);
          if (target) { assign[u.code] = target.name; moved++; }
        });
        if (moved) { applyAssign(); toast(`${moved} unit lama otomatis masuk ke kombinasi. Ubah di tabel bila perlu.`); }
        return;
      }
      /* Barang tanpa unit fisik (jual): stok lama dipindah ke kombinasi pertama, per ukuran bila sebelumnya ada ukuran */
      if (C.some((c) => stockMap[c.name] != null)) return; /* sudah ada stok kombinasi: jangan ditimpa */
      if (V0 && !V0.label2 && V0.options) V0.options.forEach((o) => { const t = C.find((c) => c.v1 === o.name && c.v2 === first); if (t && !kept.has(t.name)) stockMap[t.name] = +o.stock || 0; });
      else { const t = C.find((c) => c.v2 === first); const total = +p.stock || 0; if (t && !kept.has(t.name) && total) stockMap[t.name] = total; }
    };
    const applyAssign = () => {
      const cnt = {}; Object.values(assign).forEach((n) => { cnt[n] = (cnt[n] || 0) + 1; });
      const kept = keptSet(); combos().forEach((c) => { if (!kept.has(c.name)) stockMap[c.name] = cnt[c.name] || 0; });
      drawV(); recount();
    };
    async function addValue(axis) {
      const inp = m.$(`[data-newv="${axis}"]`); const v = inp.value.trim().replace(/\s+/g, ' '); if (!v) { inp.focus(); return; }
      const id = axis === 1 ? vattr : vattr2; const all = DB.attributes(true); const a = all.find((x) => x.id === id);
      const sel = axis === 1 ? sel1 : sel2;
      if (a) { if (!a.values.some((x) => x.toLowerCase() === v.toLowerCase())) { a.values.push(v); DB.saveConfig('attributes', all, `Menambahkan nilai "${v}" ke atribut ${a.name} (dari form barang)`, [{ field: 'Nilai', from: '', to: v }]); } sel.add(a.values.find((x) => x.toLowerCase() === v.toLowerCase())); }
      else sel.add(v);
      seedCombos(); drawV(); toast(`Nilai "${v}" ditambahkan.`);
    }
    function drawAttrs() {
      const L = infoAttrs(E.cat.value);
      [['color', /^warna$/i], ['material', /^(bahan|material)$/i], ['weight', /^berat$/i]].forEach(([k, re]) => { const fld = E[k] && E[k].closest('.field'); if (fld) fld.hidden = L.some((x) => re.test(x.name)); });
      m.$('#attrBox').innerHTML = L.length ? `<h5 class="pf-mini">Atribut tambahan</h5><div class="grid-3">${L.map((a) => `<div class="field"><label>${esc(a.name)}${a.required ? ' <span class="req">*</span>' : ''}</label>${a.type === 'pilihan'
        ? `<select class="select" data-at="${a.id}"><option value="">— Pilih —</option>${a.values.map((v) => `<option ${attrVals[a.id] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`
        : `<input class="input" data-at="${a.id}" ${a.type === 'angka' ? 'type="number"' : ''} value="${esc(attrVals[a.id] || '')}">`}</div>`).join('')}</div>` : '';
    }
    m.$('#vType').addEventListener('change', () => {
      const v = m.$('#vType').value; vattr = v === '__none' ? '' : v;
      if (vattr && !(V0 && V0.attrId === vattr)) { const a = curAttr(); sel1 = new Set(a ? a.values : []); }
      if (vattr2 === vattr) vattr2 = '';
      fillVType2(); drawV();
    });
    m.$('#vType2').addEventListener('change', () => {
      const v = m.$('#vType2').value; vattr2 = v === '__none' ? '' : v;
      if (vattr2 && !(V0 && V0.attrId2 === vattr2)) { sel2 = new Set(); const a2 = attrById(vattr2); if (a2 && a2.values.length) sel2.add(a2.values[0]); } /* nilai pertama langsung dicentang supaya stok lama ikut */
      seedCombos(); drawV();
    });
    E.cat.addEventListener('change', () => { fillVType(); drawV(); drawAttrs(); });
    m.$('#vBox').addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.v1 != null) { if (t.checked) sel1.add(t.dataset.v1); else sel1.delete(t.dataset.v1); seedCombos(); drawV(); return; }
      if (t.dataset.v2 != null) { if (t.checked) sel2.add(t.dataset.v2); else sel2.delete(t.dataset.v2); seedCombos(); drawV(); }
    });
    m.$('#vBox').addEventListener('input', (e) => { const st = e.target.dataset.vs; if (st != null) { stockMap[st] = Math.max(0, parseInt(e.target.value, 10) || 0); recount(); } });
    m.$('#vBox').addEventListener('click', (e) => { const b = e.target.closest('[data-addv]'); if (b) addValue(+b.dataset.addv); });
    m.$('#vBox').addEventListener('keydown', (e) => { if (e.target.dataset.newv && e.key === 'Enter') { e.preventDefault(); addValue(+e.target.dataset.newv); } });
    m.$('#attrBox').addEventListener('input', (e) => { const k = e.target.dataset.at; if (k) attrVals[k] = e.target.value; });
    fillVType(); drawV(); drawAttrs(); applyKind();
    m.$('#pImg').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 5e6) { toast('Ukuran foto maksimal 5 MB.', 'err'); return; }
      e.target.value = '';
      /* Atur posisi & zoom dulu supaya foto produk tidak terpotong asal (hasil persegi 800×800) */
      const out = await UI.cropImage(f, { aspect: 1, size: 800, title: 'Atur foto barang' }); if (!out) return;
      img = out; m.$('#prev').innerHTML = `<img src="${img}" alt="">`;
    });
    /* Stok di form lebih banyak dari stok sekarang: tawarkan langsung membuka Restock dengan selisihnya */
    /* Pengurangan stok barang jual: alasan dipilih di sini (tanpa pengeluaran). Mengembalikan null bila dibatalkan. */
    const askKoreksi = (diff) => new Promise((resolve) => {
      const km = modal({ title: `Kurangi ${diff} unit · koreksi stok`, body: `
        <div class="notice" style="margin-bottom:12px"><i class="fa-solid fa-circle-info"></i><div>Koreksi untuk hitung ulang, barang rusak, hilang, atau salah input. <b>Tidak</b> dicatat sebagai pengeluaran.</div></div>
        <div class="grid-2"><div class="field"><label>Alasan <span class="req">*</span></label><select class="select" id="kxWhy"><option>Hitung ulang stok</option><option>Barang rusak</option><option>Barang hilang</option><option>Salah input sebelumnya</option><option>Lainnya</option></select></div>
        <div class="field"><label>Catatan <span class="opt">(wajib bila Lainnya)</span></label><input class="input" id="kxNote" maxlength="120"></div></div>`,
        foot: '<button class="btn btn-light" data-close>Kembali ke form</button><button class="btn btn-primary" id="kxOk"><i class="fa-solid fa-check"></i> Kurangi & simpan</button>' });
      km.$('#kxOk').addEventListener('click', () => {
        const why = km.$('#kxWhy').value; const note = km.$('#kxNote').value.trim();
        if (why === 'Lainnya' && !note) { km.$('#kxNote').classList.add('err'); km.$('#kxNote').focus(); return; }
        km.close(); resolve({ why, note });
      });
      km.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) resolve(null); });
    });
    m.$('#pSave').addEventListener('click', async () => {
      if (!validate(F, { pname: (v) => (v.length < 3 ? 'Nama minimal 3 karakter.' : ''), stock: (v) => (v === '' || +v < 0 ? 'Stok tidak valid.' : ''),
        rent: () => (fk === 'rent' && +E.rent.value <= 0 ? 'Isi harga sewa per malam.' : ''), price: () => (fk === 'buy' && +E.price.value <= 0 ? 'Isi harga jual.' : ''), cost: (v) => (fk === 'buy' && String(v).replace(/[^\d]/g, '') === '' ? 'Isi harga beli (modal) supaya laba penjualan bisa dihitung.' : ''), minDays: (v) => (fk === 'rent' && !(+v >= 1) ? 'Minimal 1 malam.' : '') })) return;
      let variant = null;
      if (isVar()) {
        const C = combos();
        if (!C.length) { toast(is2() ? `Centang minimal satu ${lbl1().toLowerCase()} dan satu ${lbl2().toLowerCase()}, atau pilih "Tanpa varian".` : 'Centang minimal satu nilai varian, atau pilih "Tanpa varian".', 'err'); return; }
        const a = curAttr();
        variant = { attrId: a ? a.id : (V0 && V0.attrId) || '', label: lbl1(), options: C.map((c) => Object.assign({ name: c.name, stock: Math.max(0, stockOf(c)) }, is2() ? { v1: c.v1, v2: c.v2 } : {})) };
        if (is2()) { const a2 = attrById(vattr2); Object.assign(variant, { attrId2: a2 ? a2.id : (V0 && V0.attrId2) || '', label2: lbl2() }); }
        if (!p.id && !variant.options.some((o) => o.stock > 0) && fk === 'rent') { toast('Isi stok minimal 1 unit pada salah satu kombinasi.', 'err'); return; }
        for (const o of variant.options) { const used = usedOf(o.name); if (o.stock < used) { toast(`Stok ${o.name} tidak boleh kurang dari ${used} (sedang dipakai booking).`, 'err'); return; } }
        if (V0) { const gone = V0.options.filter((o) => !variant.options.some((x) => x.name === o.name) && usedOf(o.name)); if (gone.length) { toast(`${gone.map((o) => o.name).join(', ')} masih dipakai booking aktif, tidak bisa dihapus.`, 'err'); return; } }
        /* Edit hanya membagi unit yang sudah ada ke kombinasi baru. Total tidak boleh bertambah atau berkurang di sini:
           tambah stok lewat Restock, pindah stok antar kombinasi lama lewat Koreksi stok. */
        if (fk === 'rent' && p.units) {
          /* kombinasi yang tetap ada (terkunci) = nama lama yang masih dipakai di varian baru */
          const keptNames = new Set(variant.options.map((o) => o.name).filter((n) => V0 && V0.options.some((o) => o.name === n)));
          const unplacedUnits = p.units.filter((u) => u.status !== 'terjual' && u.status !== 'nonaktif' && !keptNames.has(u.size));
          const unplaced = unplacedUnits.length;
          const newSum = variant.options.filter((o) => !keptNames.has(o.name)).reduce((s0, o) => s0 + (+o.stock || 0), 0);
          /* unit yang belum berkombinasi wajib dipilih kombinasinya (lihat cek di bawah) */
        }
      } else if (p.id && DB.hasVariant(p) && p.variant.options.some((o) => bookedSize(p.id, o.name))) { toast('Varian tidak bisa dilepas karena masih dipakai di booking aktif.', 'err'); return; }
      let stkChange = null, restockAfter = null, stockOverride = null;
      if (p.id) {
        const oldTot = DB.hasVariant(p) ? p.variant.options.reduce((a, o) => a + (+o.stock || 0), 0) : (+p.stock || 0);
        const newTot = variant ? variant.options.reduce((a, o) => a + (+o.stock || 0), 0) : (parseInt(E.stock.value, 10) || 0);
        if (newTot > oldTot) {
          /* Tambah stok lewat Restock: atribut & kombinasi dari form disimpan dulu dengan stok LAMA
             (dipindah ke kombinasi yang setara per ukuran), lalu Restock dibuka dengan isian terisi */
          const diff = newTot - oldTot;
          const keyOf = (o) => String(o.v1 != null ? o.v1 : String(o.name).split(DB.VSEP)[0]);
          const rest = {};
          if (V0) V0.options.filter((x) => !variant.options.some((o) => o.name === x.name)).forEach((x) => { const k = keyOf(x); rest[k] = (rest[k] || 0) + (+x.stock || 0); });
          const structure = variant ? variant.options.map((o) => {
            const ex = V0 && V0.options.find((x) => x.name === o.name); if (ex) return +ex.stock || 0;
            const k = keyOf(o); const s = Math.min(rest[k] || 0, +o.stock || 0); rest[k] = (rest[k] || 0) - s; return s; }) : [oldTot];
          const adds = variant ? variant.options.map((o, i) => (+o.stock || 0) - structure[i]) : [diff];
          if (structure.reduce((a, b) => a + b, 0) !== oldTot || adds.some((x) => x < 0)) {
            toast(`Stok lama (${oldTot} unit) belum bisa dipindah otomatis ke kombinasi baru. Atur dulu lewat Koreksi stok, lalu tambah lewat Restock.`, 'err'); return; }
          const plan = variant ? variant.options.map((o, i) => ({ size: o.name, qty: adds[i], isNew: false })).filter((x) => x.qty > 0) : [{ size: '', qty: diff, isNew: false }];
          const ok = await confirmBox({ title: `Tambah ${diff} unit lewat Restock?`, text: `Atribut dan kombinasi di form disimpan dulu, lalu Restock terbuka dengan isian terisi: ${plan.map((x) => `${x.size || 'stok'} +${x.qty}`).join(', ')}.`, ok: 'Simpan & buka Restock', cancel: 'Kembali ke form' });
          if (!ok) return;
          restockAfter = plan;
          stockOverride = oldTot;
          if (variant) variant.options = variant.options.map((o, i) => Object.assign({}, o, { stock: structure[i] }));
        }
        if (newTot < oldTot) {
          if (fk !== 'buy') { toast(`Total stok harus tetap ${oldTot} unit. Kurangi lewat Unit fisik: nonaktifkan unit yang rusak atau hilang.`, 'err'); return; }
          /* barang jual: koreksi stok langsung di Edit (tanpa pengeluaran), disimpan bersama perubahan lain */
          const kx = await askKoreksi(oldTot - newTot); if (!kx) return;
          stkChange = { why: kx.why + (kx.note ? ': ' + kx.note : ''), oldTot, newTot };
        }
      }
      const missing = infoAttrs(E.cat.value).filter((a) => a.required && !String(attrVals[a.id] || '').trim());
      if (missing.length) { toast(`Isi atribut wajib: ${missing.map((a) => a.name).join(', ')}.`, 'err'); return; }
      const reqVar = varAttrs(E.cat.value).filter((a) => a.required);
      if (reqVar.length && !variant) { toast(`Kategori ini wajib memakai varian ${reqVar.map((a) => a.name).join(' / ')}.`, 'err'); return; }
      const attrs = {}; infoAttrs(E.cat.value).forEach((a) => { const v = String(attrVals[a.id] || '').trim(); if (v) attrs[a.id] = v; });
      if (!img) { toast('Upload foto barang terlebih dahulu.', 'err'); return; }
      /* Atribut kedua dihapus: unit lama ikut ke kombinasi dengan ukuran yang sama (stok per ukuran sudah dijumlahkan di form) */
      if (fk === 'rent' && variant && p.id && !is2() && V0 && V0.label2) unplacedList().forEach((u) => { if (assign[u.code]) return; const v1 = parts0(u.size)[0]; const c = combos().find((x) => x.v1 === v1); if (c) assign[u.code] = c.name; });
      if (fk === 'rent' && variant && p.id) { const pend = unplacedList().filter((u) => !assign[u.code]); if (pend.length) { toast(`Pilih kombinasi untuk ${pend.length} unit: ${pend.map((u) => u.code).join(', ')}.`, 'err'); return; } }
      let units = p.units ? JSON.parse(JSON.stringify(p.units)) : null;
      if (units) units.forEach((u) => { if (assign[u.code]) u.size = assign[u.code]; });
      if (units && (+E.rent.value || 0) > 0) {
        const alive = (u) => u.status !== 'terjual' && u.status !== 'nonaktif';
        /* Struktur varian berubah (mis. 1 atribut → 2 atribut): unit lama dipindah ke kombinasi baru dengan nilai atribut 1 yang sama */
        if (variant) {
          const names = variant.options.map((o) => o.name); const room = {}; variant.options.forEach((o) => { room[o.name] = o.stock - units.filter((u) => alive(u) && u.size === o.name).length; });
          units.filter((u) => alive(u) && !names.includes(u.size)).forEach((u) => { const v1 = String(u.size || '').split(DB.VSEP)[0];
            /* Bandingkan sebagai teks (v1 bisa tersimpan angka) dan cadangkan dari awalan nama kombinasi ("39 / Abu-abu" → "39") */
            const cand = variant.options.find((o) => String(o.v1 != null ? o.v1 : String(o.name).split(DB.VSEP)[0]) === v1 && room[o.name] > 0);
            if (cand) { u.size = cand.name; room[cand.name] -= 1; u.log = u.log || []; u.log.push({ at: D.nowStamp(), text: `Varian unit disesuaikan: ${v1 || '-'} → ${cand.name}`, by: Admin.me.name }); } });
        } else if (DB.hasVariant(p)) units.forEach((u) => { delete u.size; });
        const live = (size) => units.filter((u) => alive(u) && (size == null || u.size === size)).length;
        const stray = variant ? units.filter((u) => alive(u) && !variant.options.some((o) => o.name === u.size)).length : 0;
        if (stray) { const sz = [...new Set(units.filter((u) => alive(u) && !variant.options.some((o) => o.name === u.size)).map((u) => String(u.size || '').split(DB.VSEP)[0]))]; toast(`Ada ${stray} unit fisik ${sz.join(', ')} yang belum masuk kombinasi. Isi stok kombinasi ${sz.join(', ')} minimal sebanyak unitnya, atau nonaktifkan unit lewat tombol Unit.`, 'err'); return; }
        if (p.id) {
          const targets = variant ? Object.fromEntries(variant.options.map((o) => [o.name, o.stock])) : { '': stockOverride != null ? stockOverride : (parseInt(E.stock.value, 10) || 0) };
          const err = reconcileUnits(units, targets, '');
          if (err) { toast(err, 'err'); return; }
        }
      }
      const all = prods();
      const t = (k) => (E[k].value || '').trim();
      const obj = Object.assign({}, p, { id: p.id || 'p' + (Math.max(0, ...all.map((x) => parseInt(x.id.slice(1), 10) || 0)) + 1), name: t('pname'), cat: E.cat.value, cond: E.cond.value,
        rent: fk === 'rent' ? Math.max(0, +E.rent.value || 0) : 0, rent3: fk === 'rent' ? Math.max(0, +E.rent3.value || 0) : 0, rent5: fk === 'rent' ? Math.max(0, +E.rent5.value || 0) : 0, price: fk === 'buy' ? Math.max(0, +E.price.value || 0) : 0, cost: fk === 'buy' ? Math.max(0, +String(E.cost.value).replace(/[^\d]/g, '') || 0) : (p.cost != null ? p.cost : null), stock: stockOverride != null ? stockOverride : Math.max(0, parseInt(E.stock.value, 10) || 0), badge: t('badge'),
        brand: t('brand'), sku: t('sku'), color: t('color'), material: t('material'), weight: t('weight'), dimension: t('dimension'), includes: t('includes'),
        minDays: Math.max(1, parseInt(E.minDays.value, 10) || 1), deposit: Math.max(0, +E.deposit.value || 0), variant, attrs,
        minStock: Math.max(0, parseInt(E.minStock.value, 10) || 0), serviceEvery: parseInt(E.serviceEvery.value, 10) || null, wash: fk === 'rent' && E.wash ? (E.wash.value === '1' ? true : E.wash.value === '0' ? false : null) : null,
        desc: t('desc'), specs: E.specs.value.split('\n').map((s) => s.trim()).filter(Boolean), featured: fk === 'rent' && !!p.featured, /* diatur di Tampilan Beranda */ active: E.active.value === '1', img });
      if (!variant) delete obj.variant;
      if (units) obj.units = units;
      const before = stockMap0(isNew ? null : DB.product(obj.id));
      if (stkChange) DB.audit({ type: 'barang', action: `Koreksi stok ${obj.name} (${stkChange.why || 'pindah stok'})`, ref: obj.id, changes: [{ field: 'Stok', from: String(stkChange.oldTot), to: String(stkChange.newTot) }] });
      DB.saveProduct(obj); m.close(); toast(isNew ? 'Barang baru ditambahkan.' : 'Perubahan disimpan.'); draw();
      /* Tambah stok lewat Restock: struktur sudah tersimpan, sekarang Restock terbuka dengan kombinasi terisi */
      if (restockAfter) { setTimeout(() => restockModal(obj.id, { rows: restockAfter }), 230); return; }
      /* Stok bertambah lewat form (bukan Restock): tanyakan apakah ini pembelian baru → catat ke pengeluaran */
      const after = stockMap0(DB.product(obj.id)); const add = Object.keys(after).map((k) => ({ size: k === '_' ? '' : k, qty: after[k] - (before[k] || 0) })).filter((x) => x.qty > 0);
      const sumOf = (M) => Object.values(M).reduce((a, n) => a + n, 0);
      /* Hanya tanyakan pembelian bila TOTAL stok memang naik. Edit membagi stok yang ada, jadi total sama = bukan pembelian */
      if (add.length && (isNew || sumOf(after) > sumOf(before))) purchasePrompt(DB.product(obj.id), add, isNew, fk);
    });
  }
  const stockMap0 = (p) => { const M = {}; if (!p) return M; if (DB.hasVariant(p)) p.variant.options.forEach((o) => { M[o.name] = +o.stock || 0; }); else M._ = +p.stock || 0; return M; };
  function purchasePrompt(p, add, isNew, fk) {
    const qty = add.reduce((a, x) => a + x.qty, 0); const rent = fk === 'rent';
    const m = modal({ title: isNew ? 'Stok awal: barang baru dibeli?' : `Stok ${esc(p.name)} bertambah ${qty} unit`, body: `
      <p style="font-size:13.5px;margin:0 0 10px">${isNew ? `Barang ini dibuat dengan stok awal <b>${qty} unit</b>.` : `Stok bertambah <b>${qty} unit</b>${add.some((x) => x.size) ? ` (${esc(add.map((x) => `${x.size} +${x.qty}`).join(', '))})` : ''}.`} Apakah ini <b>pembelian baru</b>?</p>
      <div class="notice" style="margin-bottom:12px"><i class="fa-solid fa-circle-info"></i><div><b>Ya, pembelian baru</b> → dicatat sebagai pengeluaran <b>Pembelian Barang</b> lini <b>${rent ? 'Rental' : 'Penjualan'}</b>, supaya rekap keuangan benar.<br><b>Bukan</b> → hanya koreksi data / stok lama yang sudah dimiliki toko, tidak masuk keuangan.</div></div>
      <div class="grid-2"><div class="field"><label>Harga beli per unit (Rp)</label><input class="input" type="number" min="0" id="ppCost" value="${p.cost || ''}" placeholder="Harga dari supplier"></div>
      <div class="field"><label>Supplier <span class="opt">(opsional)</span></label><input class="input" id="ppSup"></div></div>
      <div class="kv total" id="ppSum"></div>`,
      foot: '<button class="btn btn-light" data-close>Bukan, hanya koreksi / stok lama</button><button class="btn btn-primary" id="ppOk"><i class="fa-solid fa-receipt"></i> Ya, catat sebagai pembelian</button>' });
    const sum = () => { m.$('#ppSum').innerHTML = `<span>Total pengeluaran</span><span>${qty} × ${rupiah(+m.$('#ppCost').value || 0)} = <b>${rupiah(qty * (+m.$('#ppCost').value || 0))}</b></span>`; };
    m.$('#ppCost').addEventListener('input', sum); sum(); setTimeout(() => m.$('#ppCost').focus(), 60);
    m.$('#ppOk').addEventListener('click', () => { const r = DB.recordPurchase({ productId: p.id, kind: fk, lines: add, cost: +m.$('#ppCost').value, supplier: m.$('#ppSup').value.trim() });
      if (!r.ok) { toast(r.msg, 'err'); m.$('#ppCost').focus(); return; } m.close(); draw(); toast(`Pembelian ${rupiah(r.amount)} tercatat di Keuangan (lini ${rent ? 'Rental' : 'Penjualan'}).`); });
  }
  /* ---------- Restock barang jual ----------
     Stok bertambah + harga beli diperbarui + pengeluaran "Pembelian Barang" (lini Penjualan) tercatat otomatis. */
  /* Restock: satu form untuk satu nota supplier. Tiap baris = satu kombinasi (ukuran/warna) + jumlah.
     Harga beli, tanggal, dan supplier berlaku untuk semua baris → SATU pengeluaran "Pembelian Barang". */
  function restockModal(pid, opts = {}) {
    const p = DB.product(pid); if (!p) return;
    const rent = kindOf(p) === 'rent'; const sized = DB.hasVariant(p); const two = sized && DB.isVar2(p);
    const vl = DB.variantLabel(p) || 'Ukuran';
    const lab = (name) => (two ? DB.vParts(p, name).join(' / ') : name);
    const initRows = opts.rows || (opts.size || opts.newCombo ? [{ size: opts.size || '', qty: opts.qty, newCombo: opts.newCombo || null }] : [{}]);
    const rowHtml = (r = {}) => `<div class="rs-b-row">
        ${sized ? `<select class="select" data-f="sz"><option value="">Pilih ${esc(vl.toLowerCase())}…</option>${p.variant.options.map((o) => `<option value="${esc(o.name)}">${esc(lab(o.name))} · stok ${o.stock}</option>`).join('')}<option value="__new">+ ${two ? 'Kombinasi' : esc(vl)} baru…</option></select>` : '<span class="muted" style="font-size:13px">Stok barang</span>'}
        <input class="input" type="number" min="1" max="200" data-f="qty" placeholder="Jumlah" value="${r.qty ? esc(String(r.qty)) : ''}">
        <span class="rs-sub muted">—</span>
        <button type="button" class="icon-btn" data-f="x" aria-label="Hapus baris" title="Hapus baris"><i class="fa-solid fa-xmark"></i></button>
        ${sized ? `<div class="rs-b-new" hidden><input class="input" data-f="v1" placeholder="${esc(p.variant.label)} baru (mis. 44)" maxlength="30" value="${esc(r.newCombo ? r.newCombo.v1 || '' : '')}">${two ? `<input class="input" data-f="v2" placeholder="${esc(p.variant.label2)} baru (mis. Hitam)" maxlength="30" value="${esc(r.newCombo ? r.newCombo.v2 || '' : '')}">` : ''}</div>` : ''}
      </div>`;
    const m = modal({ title: `Restock ${rent ? 'barang sewa' : 'barang jual'} · ${esc(p.name)}`, size: 'lg', body: `
      <div class="rs-head"><img src="${asset(p.img)}" alt=""><div><b>${esc(p.name)}</b><small>${rent ? `<b>${p.stock}</b> unit sewa · tarif ${rupiah(p.rent)}/malam` : `Stok sekarang <b>${p.stock}</b> unit · harga jual ${rupiah(p.price)}`}</small></div></div>
      ${rent ? '<div class="notice green" style="margin:0 0 12px"><i class="fa-solid fa-barcode"></i><div>Unit fisik baru dibuat otomatis dengan kode lanjutan dan langsung bisa disewakan. Satu nota = satu pengeluaran <b>Pembelian Barang</b> (lini Rental).</div></div>' : '<p class="muted" style="font-size:12.5px;margin:0 0 10px"><i class="fa-solid fa-circle-info"></i> Satu nota = satu pengeluaran <b>Pembelian Barang</b> (lini Penjualan). Belanja stok tidak mengurangi laba.</p>'}
      <div class="rs-b-head muted">${sized ? esc(vl) + (two ? ' & ' + esc(p.variant.label2) : '') + ' · jumlah' : 'Jumlah'}</div>
      <div id="rsBRows">${initRows.map((r) => rowHtml(r)).join('')}</div>
      <button type="button" class="btn btn-light btn-sm" id="rsBAdd"><i class="fa-solid fa-plus"></i> Tambah baris</button>
      <div class="grid-3" style="margin-top:14px">
        <div class="field"><label>Harga beli per unit (Rp) <span class="req">*</span></label><input class="input" type="number" min="0" id="rsCost" value="${p.cost != null && p.cost !== '' ? p.cost : ''}" placeholder="Harga dari supplier"></div>
        <div class="field"><label>Tanggal beli</label><input class="input" type="date" id="rsDate" value="${T}" max="${T}"></div>
        <div class="field"><label>Supplier / toko <span class="opt">(opsional)</span></label><input class="input" id="rsSup" placeholder="Contoh: ${rent ? 'Consina Store Purwokerto' : 'Toko Sumber Gas'}"></div>
      </div>
      <div class="field"><label>Catatan <span class="opt">(opsional)</span></label><input class="input" id="rsNote" placeholder="Contoh: no. nota 0231, garansi 1 tahun"></div>
      <div class="rs-sum" id="rsSum"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rsOk"><i class="fa-solid fa-check"></i> Simpan restock</button>' });
    const num = (el) => +String((el && el.value) || '').replace(/[^\d]/g, '') || 0;
    const rowsEl = () => m.$$('.rs-b-row');
    rowsEl().forEach((row, i) => { const r = initRows[i] || {}; if (sized && r.newCombo) row.querySelector('[data-f="sz"]').value = '__new'; else if (sized && r.size) row.querySelector('[data-f="sz"]').value = r.size; });
    const sum = () => {
      let q = 0;
      rowsEl().forEach((row) => {
        const qty = num(row.querySelector('[data-f="qty"]')); q += qty;
        const sz = row.querySelector('[data-f="sz"]'); const isNew = sz && sz.value === '__new';
        const nv = row.querySelector('.rs-b-new'); if (nv) nv.hidden = !isNew;
        const cur = sized ? (sz && sz.value && !isNew ? DB.sizeStock(p, sz.value) : null) : p.stock;
        row.querySelector('.rs-sub').textContent = isNew ? 'baru' : cur == null ? '—' : qty ? `${cur} → ${cur + qty}` : `stok ${cur}`;
      });
      const c = num(m.$('#rsCost'));
      m.$('#rsSum').innerHTML = `<div class="kv"><span>Total unit masuk</span><b>${q} unit${rent && q ? ' (unit fisik baru)' : ''}</b></div>
        <div class="kv"><span>Total belanja (satu pengeluaran)</span><strong>${q && c ? rupiah(q * c) : '-'}</strong></div>
        ${rent && c && p.rent ? `<div class="kv"><span>Balik modal per unit</span><span style="color:var(--g700);font-weight:700">± ${Math.ceil(c / p.rent)} malam sewa</span></div>` : ''}`;
    };
    m.$('#rsBAdd').addEventListener('click', () => { m.$('#rsBRows').insertAdjacentHTML('beforeend', rowHtml()); sum(); });
    m.el.addEventListener('click', (e) => {
      const x = e.target.closest('[data-f="x"]'); if (!x) return; const row = x.closest('.rs-b-row');
      if (rowsEl().length > 1) row.remove(); else row.querySelectorAll('input,select').forEach((i) => { i.value = ''; }); sum();
    });
    m.el.addEventListener('input', sum); m.el.addEventListener('change', sum); sum();
    setTimeout(() => { const f = rowsEl()[0]; const el = f && (f.querySelector('[data-f="sz"]') || f.querySelector('[data-f="qty"]')); if (el) el.focus(); }, 50);
    m.$('#rsOk').addEventListener('click', () => {
      const lines = []; let bad = null;
      rowsEl().forEach((row) => {
        const sz = row.querySelector('[data-f="sz"]'); const qEl = row.querySelector('[data-f="qty"]'); const q = num(qEl); const v = sz ? sz.value : '';
        if (!q && !v) return;
        if (sized && !v) { bad = bad || sz; return; }
        if (!q) { bad = bad || qEl; return; }
        if (v === '__new') {
          const v1 = row.querySelector('[data-f="v1"]').value.trim().replace(/\s+/g, ' ');
          const v2 = two ? row.querySelector('[data-f="v2"]').value.trim().replace(/\s+/g, ' ') : '';
          if (!v1 || (two && !v2)) { bad = bad || row.querySelector(!v1 ? '[data-f="v1"]' : '[data-f="v2"]'); return; }
          lines.push({ newCombo: { v1, v2 }, qty: q });
        } else lines.push({ size: v, qty: q });
      });
      m.el.querySelectorAll('.err').forEach((i) => i.classList.remove('err'));
      if (bad) { bad.classList.add('err'); bad.focus(); toast(sized && bad.matches('[data-f="sz"]') ? `Pilih ${vl.toLowerCase()} untuk setiap baris.` : 'Lengkapi baris restock yang ditandai.', 'err'); return; }
      if (!lines.length) { toast('Isi jumlah minimal satu baris.', 'err'); return; }
      const cost = num(m.$('#rsCost')); if (!cost) { toast('Isi harga beli per unit.', 'err'); m.$('#rsCost').focus(); return; }
      /* nilai baru → tambahkan ke atribut (supaya muncul di form barang & filter) */
      const newVals = lines.filter((l) => l.newCombo);
      if (newVals.length) {
        const all = DB.attributes(true); let ch = false; const added = [];
        newVals.forEach((l) => [[p.variant.attrId, l.newCombo.v1], [p.variant.attrId2, l.newCombo.v2]].forEach(([id, v]) => {
          const a = all.find((x) => x.id === id); if (a && v && !a.values.some((x) => x.toLowerCase() === v.toLowerCase())) { a.values.push(v); ch = true; added.push(v); } }));
        if (ch) DB.saveConfig('attributes', all, `Menambahkan nilai varian baru dari restock ${p.name}`, [{ field: 'Nilai', from: '', to: [...new Set(added)].join(', ') }]);
      }
      const date = m.$('#rsDate').value || T, supplier = m.$('#rsSup').value, note = m.$('#rsNote').value;
      const r = DB.restockBatch({ productId: pid, kind: rent ? 'rent' : 'sale', lines, cost, date, supplier, note });
      if (!r.ok) { toast(r.msg, 'err'); return; }
      r.restocks.forEach((rec, i) => syncRestock({ productId: pid, qty: rec.qty, cost, size: rec.size, date, supplier, note, expenseId: r.expenseId, expenseTotal: i === 0 ? r.amount : null, units: rec.units || null }, rent));
      m.close(); draw();
      if (rent) {
        modal({ title: 'Restock barang sewa tersimpan', body: `<div class="notice green" style="margin-bottom:12px"><i class="fa-solid fa-circle-check"></i><div><b>+${r.total} unit ${esc(p.name)}</b> siap disewakan. Satu pengeluaran ${rupiah(r.amount)} tercatat di Keuangan (lini Rental).</div></div>
          <ul class="ho-items" style="margin-bottom:10px">${r.restocks.map((x) => `<li><span>+${x.qty}</span> ${esc(x.size ? lab(x.size) : p.name)}${x.units && x.units.length ? `<div class="rs-units">${x.units.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}</li>`).join('')}</ul>
          <p style="font-size:13px;margin:0 0 4px"><b>Kode unit baru</b> <span class="muted">(tempel label pada barang)</span></p>`,
          foot: `<button class="btn btn-light" data-close>Tutup</button><button class="btn btn-primary" data-close data-units-after="${p.id}"><i class="fa-solid fa-barcode"></i> Lihat unit</button>` }).el.addEventListener('click', (e) => { const b = e.target.closest('[data-units-after]'); if (b) setTimeout(() => { const x = document.querySelector(`[data-units="${b.dataset.unitsAfter}"]`); if (x) x.click(); }, 250); });
      } else toast(`Restock tersimpan: +${r.total} ${esc(p.name)}. Pengeluaran ${rupiah(r.amount)} tercatat di Keuangan.`);
      if (opts.onDone) setTimeout(opts.onDone, 300);
    });
  }
  /* Tabel stok Ukuran × Warna (barang varian 2 atribut): total unit & tersedia hari ini per kombinasi */
  function varMatrix(pid) {
    const p = DB.product(pid); if (!p || !DB.isVar2(p)) return; const [A, B] = DB.variantAxes(p); const rent = kindOf(p) === 'rent';
    const cell = (a, b) => { const o = p.variant.options.find((x) => { const [v1, v2] = DB.vParts(p, x.name); return v1 === a && v2 === b; }); if (!o) return '<td class="muted">—</td>';
      const av = rent ? Rules.availableOn(p.id, T, null, o.name) : DB.saleableStock(p, o.name); return `<td><b>${o.stock}</b>${rent ? `<small class="${av ? '' : 'zero'}">${av} siap</small>` : ''}</td>`; };
    modal({ title: `Stok per kombinasi · ${esc(p.name)}`, size: 'lg', body: `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Angka besar = jumlah ${rent ? 'unit' : 'stok'}${rent ? '; kecil = siap disewa hari ini' : ''}. Ubah stok lewat <b>Edit</b>, tambah unit lewat <b>Restock</b>.</p>
      <div class="var-mx var-mx-ro"><table><thead><tr><th>${esc(A.label)} \\ ${esc(B.label)}</th>${B.values.map((b) => `<th>${esc(b)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${A.values.map((a) => `<tr><td>${esc(a)}</td>${B.values.map((b) => cell(a, b)).join('')}<td><b>${p.variant.options.filter((o) => DB.vParts(p, o.name)[0] === a).reduce((x, o) => x + (+o.stock || 0), 0)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td>${B.values.map((b) => `<td>${p.variant.options.filter((o) => DB.vParts(p, o.name)[1] === b).reduce((x, o) => x + (+o.stock || 0), 0)}</td>`).join('')}<td>${p.stock}</td></tr></tfoot></table></div>`,
      foot: `<button class="btn btn-light" data-close>Tutup</button>${rent ? `<button class="btn btn-light" data-close data-after-close="units:${esc(p.id)}"><i class="fa-solid fa-barcode"></i> Unit fisik</button>` : ''}<button class="btn btn-primary" data-close data-after-close="restock:${esc(p.id)}"><i class="fa-solid fa-truck-ramp-box"></i> Restock</button>` });
  }
  /* Sambungkan restock ke backend yang sudah ada: POST api/admin/products/{id}/restock
     (server mencatat stok/unit fisik + pengeluaran "Pembelian Barang" + riwayat restock). Satu panggilan per barang.
     404 = barang belum ada di server (dibuat di perangkat ini) → diabaikan. */
  function syncRestock(a, rent) {
    if (!window.Api) return;
    Api.post(`api/admin/products/${encodeURIComponent(a.productId)}/restock`, { qty: a.qty, unit_cost: a.cost, kind: rent ? 'rent' : 'sale', size: a.size || (a.newCombo ? [a.newCombo.v1, a.newCombo.v2].filter(Boolean).join(DB.VSEP || ' / ') : '') || null, supplier: a.supplier || null, restock_date: a.date || null, note: a.note || null, expense_id: a.expenseId || null, expense_total: a.expenseTotal || null, from_app: true, unit_codes: a.units || null }, { redirectOn401: false })
      .then((r) => { if (r && !r.ok && r.status && ![404, 405].includes(r.status)) toast(`Restock tersimpan, tetapi gagal dikirim ke server: ${r.msg}`, 'err'); });
  }
  /* Restock beberapa barang sekaligus (satu nota supplier). Setiap baris memakai fungsi restock yang sama seperti
     restock per barang (DB.restock / DB.restockRent) → pengeluaran "Pembelian Barang" tetap tercatat per barang seperti biasa. */
  function restockMulti() {
    const rent = KIND === 'rent';
    const L = prods().filter((x) => kindOf(x) === KIND && x.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    const lab = (x, n) => (DB.isVar2(x) ? DB.vParts(x, n).join(' / ') : n);
    const rowHtml = () => `<div class="rm-row"><select class="select" data-rm="p"><option value="">Pilih barang…</option>${L.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
      <select class="select" data-rm="s" disabled><option value="">—</option></select>
      <input class="input" type="number" min="1" data-rm="q" placeholder="Jumlah"><input class="input" type="number" min="0" data-rm="c" placeholder="Harga beli / unit">
      <span class="rm-sub">-</span><button type="button" class="icon-btn" data-rm="x" title="Hapus baris" aria-label="Hapus baris"><i class="fa-solid fa-xmark"></i></button></div>`;
    const m = modal({ title: `Restock beberapa barang ${rent ? 'sewa' : 'jual'}`, size: 'xl', body: `
      <p class="muted" style="font-size:13px;margin:0 0 12px">Untuk belanja beberapa barang sekaligus dari satu supplier. ${rent ? 'Unit fisik baru dibuat otomatis per barang. ' : ''}Setiap barang dicatat sebagai pengeluaran <b>Pembelian Barang</b> di Keuangan, sama seperti restock per barang.</p>
      <div class="grid-3"><div class="field"><label>Tanggal beli</label><input class="input" type="date" id="rmDate" value="${T}" max="${T}"></div>
        <div class="field"><label>Supplier / toko <span class="opt">(opsional)</span></label><input class="input" id="rmSup"></div>
        <div class="field"><label>No. nota / catatan <span class="opt">(opsional)</span></label><input class="input" id="rmNote"></div></div>
      <div class="rm-head"><span>Barang</span><span>Ukuran / pilihan</span><span>Jumlah</span><span>Harga beli / unit</span><span>Subtotal</span><span></span></div>
      <div id="rmRows">${rowHtml()}${rowHtml()}</div>
      <button type="button" class="btn btn-light btn-sm" id="rmAdd"><i class="fa-solid fa-plus"></i> Tambah baris</button>
      <div class="rm-total"><span>Total belanja</span><b id="rmTot">Rp 0</b></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rmOk"><i class="fa-solid fa-check"></i> Simpan restock</button>' });
    m.$('.modal-box').classList.add('wc-modal');
    const num = (el) => +String(el.value || '').replace(/[^\d]/g, '') || 0;
    const calc = () => { let t = 0; m.$$('.rm-row').forEach((r) => { const q = num(r.querySelector('[data-rm="q"]')), c = num(r.querySelector('[data-rm="c"]')); r.querySelector('.rm-sub').textContent = q && c ? rupiah(q * c) : '-'; t += q * c; }); m.$('#rmTot').textContent = rupiah(t);
      const n = m.$$('.rm-row').filter((r) => r.querySelector('[data-rm="p"]').value).length; m.$('#rmOk').innerHTML = `<i class="fa-solid fa-check"></i> Simpan restock${n ? ` (${n} barang)` : ''}`; };
    m.$('#rmAdd').addEventListener('click', () => { m.$('#rmRows').insertAdjacentHTML('beforeend', rowHtml()); calc(); });
    m.el.addEventListener('click', (e) => { const x = e.target.closest('[data-rm="x"]'); if (x) { const rows = m.$$('.rm-row'); if (rows.length > 1) x.closest('.rm-row').remove(); else x.closest('.rm-row').querySelectorAll('input,select').forEach((i) => { i.value = ''; }); calc(); } });
    m.el.addEventListener('change', (e) => { const sp = e.target.closest('[data-rm="p"]'); if (sp) { const r = sp.closest('.rm-row'); const x = DB.product(sp.value); const ss = r.querySelector('[data-rm="s"]');
        if (x && DB.hasVariant(x)) { ss.disabled = false; ss.innerHTML = `<option value="">Pilih ${esc((DB.variantLabel(x) || 'pilihan').toLowerCase())}…</option>` + x.variant.options.map((o) => `<option value="${esc(o.name)}">${esc(lab(x, o.name))} (stok ${+o.stock || 0})</option>`).join(''); }
        else { ss.disabled = true; ss.innerHTML = '<option value="">—</option>'; }
        const ci = r.querySelector('[data-rm="c"]'); if (x && !ci.value && x.cost) ci.value = x.cost; } calc(); });
    m.el.addEventListener('input', calc);
    m.$('#rmOk').addEventListener('click', () => {
      const lines = []; let bad = null;
      m.$$('.rm-row').forEach((r) => { const pid = r.querySelector('[data-rm="p"]').value; if (!pid) return; const x = DB.product(pid);
        const sz = r.querySelector('[data-rm="s"]').value; const q = num(r.querySelector('[data-rm="q"]')); const c = num(r.querySelector('[data-rm="c"]'));
        const el = DB.hasVariant(x) && !sz ? r.querySelector('[data-rm="s"]') : !q ? r.querySelector('[data-rm="q"]') : !c ? r.querySelector('[data-rm="c"]') : null;
        if (el && !bad) bad = el; lines.push({ x, sz, q, c }); });
      m.$$('.rm-row .err').forEach((i) => i.classList.remove('err'));
      if (!lines.length) { toast('Pilih minimal satu barang.', 'err'); return; }
      if (bad) { bad.classList.add('err'); bad.focus(); toast(bad.dataset.rm === 's' ? 'Pilih ukuran / pilihan barangnya.' : bad.dataset.rm === 'q' ? 'Isi jumlah barang masuk.' : 'Isi harga beli per unit.', 'err'); return; }
      const date = m.$('#rmDate').value || T, supplier = m.$('#rmSup').value, note = m.$('#rmNote').value;
      const done = []; const fail = [];
      lines.forEach((l) => { const args = { newCombo: null, productId: l.x.id, size: l.sz, qty: l.q, cost: l.c, date, supplier, note };
        const r = rent ? DB.restockRent(args) : DB.restock(args); if (r && r.ok) { done.push({ l, r }); syncRestock(Object.assign({ expenseId: r.restock && r.restock.expenseId, units: (r.restock && r.restock.units) || r.units || null }, args), rent); } else fail.push(`${l.x.name}: ${(r && r.msg) || 'gagal'}`); });
      m.close(); draw();
      const tot = done.reduce((a, d) => a + d.l.q * d.l.c, 0);
      modal({ title: 'Restock tersimpan', body: `${done.length ? `<div class="notice green" style="margin-bottom:12px"><i class="fa-solid fa-circle-check"></i><div><b>${done.length} barang</b> di-restock, total belanja <b>${rupiah(tot)}</b> tercatat di Keuangan (Pembelian Barang).</div></div>` : ''}
        ${fail.length ? `<div class="notice red" style="margin-bottom:12px"><i class="fa-solid fa-triangle-exclamation"></i><div>Tidak tersimpan:<br>${fail.map(esc).join('<br>')}</div></div>` : ''}
        <ul class="ho-items">${done.map((d) => `<li><span>+${d.l.q}</span> ${esc(d.l.x.name)}${d.l.sz ? ` · ${esc(lab(d.l.x, d.l.sz))}` : ''}${d.r.restock && d.r.restock.units && d.r.restock.units.length ? `<div class="rs-units">${d.r.restock.units.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}</li>`).join('')}</ul>
        ${rent && done.some((d) => d.r.restock && d.r.restock.units) ? '<p class="muted" style="font-size:12.5px;margin-top:8px">Tempel kode unit baru pada barangnya.</p>' : ''}`,
        foot: '<button class="btn btn-primary" data-close>Selesai</button>' });
    });
    calc();
  }
  function restockHistory() {
    const L = DB.restocks().filter((r) => r.status !== 'dibatalkan' && (KIND === 'rent' ? r.kind === 'rent' : r.kind !== 'rent'));
    const tot = L.reduce((a, r) => a + r.qty * r.cost, 0);
    modal({ title: `Riwayat restock barang ${KIND === 'rent' ? 'sewa' : 'jual'}`, size: 'lg', body: L.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Barang</th><th class="num">Jumlah</th><th class="num">Harga beli</th><th class="num">Total</th><th>Supplier</th><th>Oleh</th></tr></thead><tbody>
      ${L.map((r) => `<tr><td>${D.fmtDate(r.date)}</td><td>${esc(r.name)}${r.size ? ` · ${esc(r.size)}` : ''}${r.units && r.units.length ? `<small>${esc(r.units.join(', '))}</small>` : ''}${r.note ? `<small>${esc(r.note)}</small>` : ''}</td><td class="num">${r.qty}</td><td class="num">${rupiah(r.cost)}</td><td class="num">${rupiah(r.qty * r.cost)}</td><td>${esc(r.supplier || '-')}</td><td>${esc(r.by || '-')}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">Total belanja ${KIND === 'rent' ? 'barang sewa' : 'stok'}</td><td class="num">${rupiah(tot)}</td><td colspan="2"></td></tr></tfoot></table></div>` : `<p class="muted">Belum ada restock barang ${KIND === 'rent' ? 'sewa' : 'jual'}.</p>`,
      foot: `${KIND === 'buy' ? `<a class="btn btn-light" href="${Admin.A ? Admin.A('laporan?type=penjualan#sec-restock') : 'laporan?type=penjualan#sec-restock'}"><i class="fa-solid fa-file-lines"></i> Laporan restock</a>` : ''}<button class="btn btn-primary" data-close>Tutup</button>` });
  }
  /* Nonaktifkan unit sewa: Hilang / Rusak total / Lainnya (catatan wajib untuk Lainnya) */
  function offUnit(pid, code, done, preset) {
    const mm = modal({ title: `Nonaktifkan unit ${code}`, body: `<p class="muted" style="font-size:13px;margin-bottom:12px">Unit keluar dari stok dan tidak bisa disewa. Riwayatnya tetap tersimpan, dan unit bisa diaktifkan kembali kapan saja.</p>
      <div class="off-opts">${[['hilang', 'fa-circle-question', 'Hilang', 'Tidak kembali / tidak ditemukan di gudang'], ['rusak', 'fa-heart-crack', 'Rusak total', 'Tidak bisa diperbaiki lagi'], ['lainnya', 'fa-ellipsis', 'Lainnya', 'Mis. sudah terlalu tua dan dipensiunkan']].map(([k, ic, t, d]) => `<label class="pk-opt"><input type="radio" name="offR" value="${k}" ${k === (preset || 'hilang') ? 'checked' : ''}><span><i class="fa-solid ${ic}"></i><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
      <div class="field" style="margin-top:12px"><label>Catatan <span class="opt" id="offOpt">(opsional)</span></label><input class="input" id="offN" placeholder="Contoh: frame patah di 3 ruas, tidak ada suku cadang"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-danger" id="offOk"><i class="fa-solid fa-ban"></i> Nonaktifkan unit</button>' });
    const sync = () => { mm.$('#offOpt').textContent = mm.$('input[name="offR"]:checked').value === 'lainnya' ? '(wajib)' : '(opsional)'; };
    mm.$$('input[name="offR"]').forEach((r) => r.addEventListener('change', sync)); sync();
    mm.$('#offOk').addEventListener('click', () => {
      const r = mm.$('input[name="offR"]:checked').value, note = mm.$('#offN').value.trim();
      if (r === 'lainnya' && !note) { mm.$('#offN').classList.add('err'); toast('Tulis catatan untuk alasan "Lainnya".', 'err'); return; }
      const label = { hilang: 'Hilang', rusak: 'Rusak total', lainnya: 'Lainnya' }[r];
      DB.updateUnit(pid, code, { status: 'nonaktif', offReason: r, care: null, careInfo: null, notes: note || label }, `Unit dinonaktifkan · ${label}${note ? ': ' + note : ''}`);
      mm.close(); toast(`${code} dinonaktifkan (${label}).`); if (done) done();
    });
  }
  function unitsModal(pid) {
    const UF = { v1: '', v2: '', st: '' };
    const draw = () => {
      const p = DB.get('products').find((x) => x.id === pid); const every = p.serviceEvery || DB.settings().serviceEvery || 0;
      const U = p.units || []; const sz = DB.hasVariant(p);
      const sum = (f) => U.filter(f).length;
      const st = (u) => DB.unitState(u);
      const OFF = U.filter((u) => u.status !== 'aktif' && u.status !== 'terjual'); const offBy = (r) => OFF.filter((u) => st(u).reason === r).length;
      const rowOf = (u) => { const due = DB.serviceDue(p, u); const off = u.status !== 'aktif'; const S = st(u); const ci = u.careInfo || {};
          const acts = off ? (u.status === 'nonaktif' ? `<button class="btn btn-light btn-xs" data-uon="${u.code}">Aktifkan</button>` : '')
            : S.k === 'out' ? (S.due ? `<button class="btn btn-wa btn-xs" data-uwa="${S.booking}" title="Kirim pengingat ke customer"><i class="fa-brands fa-whatsapp"></i> ${S.due === 'late' ? 'Tagih denda' : 'Ingatkan'}</button>` : `<span class="muted unit-wait"><i class="fa-solid fa-person-hiking"></i> Dibawa customer</span>`)
            : S.k === 'cuci' ? `<button class="btn btn-primary btn-xs" data-uclean="${u.code}"><i class="fa-solid fa-check"></i> Sudah bersih</button>`
            : S.k === 'perbaikan' ? `<a class="btn btn-primary btn-xs" href="perawatan"><i class="fa-solid fa-screwdriver-wrench"></i> Proses perbaikan</a>`
            : `<button class="btn btn-light btn-xs" data-uwash="${u.code}" title="Kirim ke antrian cuci"><i class="fa-solid fa-soap"></i> Cuci</button><button class="btn btn-light btn-xs" data-ubroke="${u.code}" title="Laporkan kerusakan"><i class="fa-solid fa-triangle-exclamation"></i> Rusak</button>${due ? `<button class="btn btn-gold btn-xs" data-usvc="${u.code}" title="Catat perawatan berkala"><i class="fa-solid fa-clipboard-check"></i> Perawatan</button>` : ''}`;
          return `<tr class="${off ? 'row-off' : ''}"><td><b class="mono">${u.code}</b>${u.notes ? `<small class="unit-note">${esc(NOTXT(u.notes))}</small>` : ''}</td>${sz ? `<td>${esc(String(u.size || '').replace(/\s*\(.*\)/, ''))}</td>` : ''}
          <td><span class="pill ${S.tone} plain">${esc(S.l)}</span>${S.k === 'perbaikan' ? `<small class="issue">${esc(ci.issue || '')}</small>` : S.k === 'cuci' && ci.booking ? `<small>dari ${ci.booking}</small>` : ''}</td>
          <td class="num">${u.rents}×</td>
          <td>${!every ? '<span class="muted">Belum dijadwalkan</span>' : due ? '<span class="pill amber plain">Perlu servis</span>' : `<span class="muted">${u.sinceService}/${every}×</span>`}<small>${u.lastService ? 'terakhir ' + D.fmtDate(u.lastService) : 'belum pernah'}</small></td>
          <td><div class="acts">${acts}<button class="btn btn-light btn-xs" data-ulog="${u.code}" title="Riwayat unit"><i class="fa-solid fa-clock-rotate-left"></i></button>${off || S.k === 'out' ? '' : `<button class="btn btn-light btn-xs" data-uoff="${u.code}" title="Nonaktifkan unit (hilang / rusak total)"><i class="fa-solid fa-ban"></i></button>`}</div></td></tr>`; };
      /* Filter & kelompok per kombinasi (ukuran / warna) supaya unit mudah dicari */
      const stOf = (u) => (u.status !== 'aktif' ? 'off' : st(u).k);
      const pass = (u) => { const [a, b2] = sz ? DB.vParts(p, u.size) : ['', '']; return (!UF.v1 || a === UF.v1) && (!UF.v2 || b2 === UF.v2) && (!UF.st || stOf(u) === UF.st); };
      const UL = U.filter(pass); const AX = DB.variantAxes(p);
      const chip = (k, v, l, n) => `<button type="button" class="chip ${UF[k] === v ? 'on' : ''}" data-uf="${k}|${esc(v)}">${esc(l)}${n != null ? ` <b>${n}</b>` : ''}</button>`;
      const STL = [['', 'Semua status'], ['siap', 'Siap disewa'], ['out', 'Disewa'], ['cuci', 'Perlu dicuci'], ['perbaikan', 'Perbaikan'], ['off', 'Nonaktif']];
      const filt = `<div class="u-filter">${sz ? AX.map((x, i) => `<div class="u-frow"><span>${esc(String(x.label).replace(/\s*\(.*\)/, ''))}</span>${chip('v' + (i + 1), '', 'Semua')}${x.values.map((v) => chip('v' + (i + 1), v, v, U.filter((u) => DB.vParts(p, u.size)[i] === v && u.status === 'aktif').length)).join('')}</div>`).join('') : ''}
        <div class="u-frow"><span>Status</span>${STL.map(([k, l]) => chip('st', k, l, k ? U.filter((u) => stOf(u) === k).length : null)).join('')}</div></div>`;
      const groups = sz ? p.variant.options.map((o) => ({ o, L: UL.filter((u) => u.size === o.name) })).filter((g) => g.L.length) : [{ o: null, L: UL }];
      const stray = sz ? UL.filter((u) => !p.variant.options.some((o) => o.name === u.size)) : []; if (stray.length) groups.push({ o: { name: 'Tanpa ' + DB.variantLabel(p).toLowerCase() }, L: stray });
      const COLS = 5 + (sz ? 1 : 0);
      const grpHead = (g) => { const k = (f) => g.L.filter(f).length; return `<tr class="u-grp"><td colspan="${COLS}"><b>${esc(String(g.o.name).replace(/\s*\(.*\)/, ''))}</b> <span>${g.L.filter((u) => u.status === 'aktif').length} unit</span><small>${[['siap', 'siap', 'green'], ['out', 'disewa', 'blue'], ['cuci', 'perlu dicuci', 'teal'], ['perbaikan', 'perbaikan', 'red']].map(([s0, l, t]) => { const n = k((u) => u.status === 'aktif' && st(u).k === s0); return n ? `<em class="${t}">${n} ${l}</em>` : ''; }).join('')}</small></td></tr>`; };
      m.$('.modal-body').innerHTML = `<p class="muted" style="font-size:13px;margin:0 0 10px">Total aktif <b>${sum((u) => u.status === 'aktif')}</b> unit. Klik status di bawah untuk memfilter.</p>
        <div class="unit-legend"><b>Status:</b> <span class="pill green plain">Siap disewa</span> bisa diberikan · <span class="pill blue plain">Disewa</span> <span class="pill teal plain">Perlu dicuci</span> <span class="pill red plain">Perbaikan</span> belum bisa disewa · <span class="pill gray plain">Nonaktif</span> keluar dari stok.</div>
        ${filt}<p class="muted" style="font-size:12.5px;margin:0 0 12px">${DB.needsWash(p) ? '<i class="fa-solid fa-soap"></i> Kategori ini <b>wajib dicuci setiap kembali</b>. ' : ''}${every ? `Servis berkala setiap ${every} kali sewa.` : 'Jadwal servis berkala belum diatur (Konfigurasi Sistem).'} Unit tidak dihapus — nonaktifkan bila hilang / rusak total. <a class="link" href="perawatan">Buka Perawatan Unit</a></p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Kode</th>${sz ? `<th>${esc(DB.variantLabel(p))}</th>` : ''}<th>Status</th><th class="num">Disewa</th><th>Servis berkala</th><th class="num">Aksi</th></tr></thead><tbody>
        ${groups.map((g) => (sz ? grpHead(g) : '') + g.L.map(rowOf).join('')).join('') || `<tr><td colspan="${COLS}" class="muted" style="text-align:center;padding:18px">Tidak ada unit yang cocok dengan filter.</td></tr>`}
        </tbody></table></div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sz ? `<select class="select sm" id="uSize" style="width:auto">${p.variant.options.map((o) => `<option>${esc(o.name)}</option>`).join('')}</select>` : ''}<button type="button" class="btn btn-primary btn-sm" id="uAdd"><i class="fa-solid fa-truck-ramp-box"></i> Tambah unit (restock)</button><span class="muted" style="font-size:12.5px">Harga beli dicatat sebagai pengeluaran Rental.</span></div>`;
    };
    const p0 = DB.product(pid);
    const m = modal({ title: `Unit fisik · ${esc(p0.name)}`, size: 'xl', body: '<div></div>', foot: '<button class="btn btn-primary" data-close>Selesai</button>' });
    const body = m.$('.modal-body');
    body.addEventListener('click', async (e) => {
      const uf = e.target.closest('[data-uf]'); if (uf) { const [k, v] = uf.dataset.uf.split('|'); UF[k] = v; draw(); return; }
      const svc = e.target.closest('[data-usvc]'), lg = e.target.closest('[data-ulog]'), off = e.target.closest('[data-uoff]'), on = e.target.closest('[data-uon]');
      const wsh = e.target.closest('[data-uwash]'), brk = e.target.closest('[data-ubroke]'), cln = e.target.closest('[data-uclean]');
      if (wsh) { DB.setCare(pid, wsh.dataset.uwash, 'cuci'); toast(`${wsh.dataset.uwash} masuk antrian cuci.`); draw(); return; }
      if (cln) { DB.finishCare(pid, cln.dataset.uclean); toast(`${cln.dataset.uclean} sudah bersih dan siap disewa.`); draw(); return; }
      if (brk) { const r = await confirmBox({ title: `Laporkan kerusakan ${brk.dataset.ubroke}`, text: 'Unit masuk daftar perbaikan dan tidak dihitung di stok sampai selesai diperbaiki.', ok: 'Masukkan ke perbaikan', input: { label: 'Kerusakan apa?', required: true, error: 'Jelaskan kerusakannya.', placeholder: 'Contoh: flysheet sobek 5 cm' } });
        if (r === false) return; DB.setCare(pid, brk.dataset.ubroke, 'perbaikan', { issue: r }); toast('Unit masuk daftar perbaikan.'); draw(); return; }
      /* Tambah unit = pembelian barang sewa → lewat Restock supaya harga beli tercatat di pengeluaran Rental */
      if (e.target.closest('#uAdd')) { restockModal(pid, { size: m.$('#uSize') ? m.$('#uSize').value : '', onDone: draw }); return; }
      if (svc) {
        const code = svc.dataset.usvc;
        const mm = modal({ title: `Perawatan berkala · ${code}`, body: `<p class="muted" style="font-size:13px;margin-bottom:10px">Pengecekan rutin setiap ${p0.serviceEvery || DB.settings().serviceEvery || 10} kali sewa. Untuk kerusakan gunakan tombol <b>Rusak</b>.</p><div class="field"><label>Yang dicek / dikerjakan</label><textarea class="textarea" id="svN" placeholder="Contoh: cek frame & pasak, lapisi ulang anti air"></textarea></div>
          <div class="field"><label>Biaya (Rp) <span class="opt">(opsional)</span></label><input class="input" type="number" min="0" step="1000" id="svC" value="0"><span class="hint">Bila diisi, tercatat sebagai pengeluaran "Perawatan Alat". Kalau ternyata ada kerusakan, gunakan tombol <b>Rusak</b>.</span></div>`,
          foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="svOk">Simpan perawatan</button>' });
        mm.$('#svOk').addEventListener('click', () => {
          const note = mm.$('#svN').value.trim(); if (!note) { mm.$('#svN').classList.add('err'); return; }
          const cost = Math.max(0, +mm.$('#svC').value || 0);
          DB.updateUnit(pid, code, { sinceService: 0, lastService: D.nowStamp() }, `Servis berkala: ${note}`, cost ? [{ field: 'Biaya', from: '', to: rupiah(cost) }] : []);
          if (cost) DB.saveFinance('out', { id: DB.nextId('EXP', DB.expenses()), date: D.today(), category: DB.financeCats('out').find((c) => /perawatan/i.test(c)) || 'Perawatan Alat', desc: `Perawatan ${code} (${p0.name}): ${note}`, amount: cost });
          mm.close(); toast('Perawatan tercatat.'); draw();
        });
      }
      if (lg) { const u = DB.units(pid).find((x) => x.code === lg.dataset.ulog);
        modal({ title: `Riwayat unit ${u.code}`, body: u.log.length ? `<ul class="timeline">${u.log.slice().reverse().map((l) => `<li>${esc(NOTXT(l.text))}${l.by ? ` · ${esc(l.by)}` : ''}<small>${D.fmtDateTime(l.at)}</small></li>`).join('')}</ul>` : '<p class="muted">Belum ada riwayat.</p>' }); }
      if (off) { offUnit(pid, off.dataset.uoff, draw); return; }
      const wa = e.target.closest('[data-uwa]'); if (wa) { Admin.remindCustomer(DB.booking(wa.dataset.uwa)); return; }
      if (on) { DB.updateUnit(pid, on.dataset.uon, { status: 'aktif', offReason: null, notes: '' }, 'Unit diaktifkan kembali'); toast(`${on.dataset.uon} aktif kembali.`); draw(); }
    });
    draw();
    m.el.addEventListener('transitionend', () => {}, { once: true });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); window.dispatchEvent(new Event('units:closed')); } }); obs.observe(document.body, { childList: true });
  }
  window.addEventListener('units:closed', () => draw());
  function history(id) {
    const p = DB.product(id);
    if (kindOf(p) === 'buy') return saleHistory(p);
    const rows = [];
    DB.bookings().forEach((b) => b.items.forEach((i) => i.components.forEach((c) => { if (c.productId !== id) return;
      const q = c.qty * i.qty;
      if (b.out) rows.push({ at: b.out.at, t: 'Keluar', b, q, cond: b.out.cond });
      if (b.ret) rows.push({ at: b.ret.at, t: 'Kembali', b, q, cond: b.ret.cond });
      if (!b.out && ['dikonfirmasi', 'menunggu_konfirmasi', 'menunggu_pembayaran'].includes(b.status)) rows.push({ at: b.start, t: 'Dipesan', b, q, cond: '-' });
    })));
    rows.sort((a, b) => String(b.at).localeCompare(a.at));
    modal({ title: `Riwayat · ${esc(p.name)}`, size: 'lg', body: rows.length ? `<div class="table-wrap"><table class="table wide"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Booking</th><th>Customer</th><th class="num">Jml</th><th>Kondisi</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.at.length > 10 ? D.fmtDateTime(r.at) : D.fmtDate(r.at)}</td><td><span class="pill ${r.t === 'Keluar' ? 'amber' : r.t === 'Kembali' ? 'green' : 'blue'}">${r.t}</span></td><td>${NO(r.b)}</td><td>${esc(r.b.customer.name)}</td><td class="num">${r.q}</td><td>${esc(r.cond)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada riwayat penyewaan untuk barang ini.</p>' });
  }
  /* Riwayat barang jual: penjualan (ORD) + perubahan stok, bukan riwayat penyewaan */
  function saleHistory(p) {
    const SL = STATUS.sale || {};
    const sales = DB.sales().flatMap((s) => s.items.filter((i) => i.productId === p.id).map((i) => ({ at: s.createdAt, s, i })));
    const stock = DB.audits().filter((a) => a.ref === p.id && ['stok', 'tambah', 'harga'].includes(a.type)).map((a) => ({ at: a.at, a }));
    const rows = [...sales, ...stock].sort((x, y) => String(y.at).localeCompare(x.at));
    const done = sales.filter((r) => r.s.status !== 'dibatalkan');
    const qty = done.reduce((n, r) => n + r.i.qty, 0), omzet = done.reduce((n, r) => n + r.i.qty * r.i.price, 0);
    const sum = `<div class="stat-mini"><span>Terjual <b>${qty} unit</b></span><span>Pendapatan <b>${rupiah(omzet)}</b></span><span>Stok sekarang <b>${p.stock}</b></span><span>Stok minimum <b>${p.minStock ?? 0}</b></span></div>`;
    modal({ title: `Riwayat Penjualan · ${esc(p.name)}`, size: 'lg', body: rows.length ? `${sum}<div class="table-wrap" data-no-paginate><table class="table wide"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Referensi</th><th>Keterangan</th><th class="num">Jml</th><th class="num">Nilai</th></tr></thead><tbody>${rows.map((r) => r.s
      ? `<tr><td class="nw">${D.fmtDateTime ? D.fmtDateTime(r.at) : D.fmtDate(r.at)}</td><td><span class="pill ${r.s.status === 'dibatalkan' ? 'red' : 'blue'} plain">Penjualan</span></td><td><b>${NO(r.s)}</b></td><td>${esc(r.s.customer.name)}${r.i.size ? ` · ${esc(r.i.size)}` : ''}<small>${(SL[r.s.status] || { label: r.s.status }).label}</small></td><td class="num">${r.i.qty}</td><td class="num">${rupiah(r.i.qty * r.i.price)}</td></tr>`
      : `<tr><td class="nw">${D.fmtDateTime ? D.fmtDateTime(r.at) : D.fmtDate(r.at)}</td><td><span class="pill gray plain">${r.a.type === 'tambah' ? 'Barang baru' : r.a.type === 'harga' ? 'Harga' : 'Stok'}</span></td><td class="muted">${esc(r.a.by || '-')}</td><td>${esc(NOTXT(r.a.action))}${(r.a.changes || []).length ? `<small>${r.a.changes.map((c) => `${esc(c.field)}: ${esc(c.from || '–')} → ${esc(c.to || '–')}`).join(' · ')}</small>` : ''}</td><td class="num">—</td><td class="num">—</td></tr>`).join('')}</tbody></table></div>`
      : `${sum}<p class="muted">Belum ada riwayat penjualan untuk barang ini.</p>` });
  }
  function catForm(c) {
    const isNew = !c; c = c || { id: '', name: '', img: 'assets/img/categories/tenda.jpg' }; let img = c.img;
    const m = modal({ title: isNew ? 'Tambah kategori' : 'Edit kategori', body: `<form id="cf" novalidate>
        <div class="field"><label>Nama kategori</label><input class="input" name="cname" value="${esc(c.name)}" placeholder="Contoh: Peralatan Masak"></div>
        <div class="field"><label>Gambar kategori</label><div style="display:flex;gap:12px;align-items:center"><img id="cPrev" src="${asset(img)}" style="width:72px;height:72px;object-fit:cover;border-radius:10px"><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Ganti gambar<input type="file" accept="image/*" id="cImg" hidden></label></div></div></form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="cSave">Simpan</button>` });
    m.$('#cImg').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; e.target.value = ''; const out = await UI.cropImage(f, { aspect: 1, size: 600, title: 'Atur gambar kategori' }); if (!out) return; img = out; m.$('#cPrev').src = img; });
    m.$('#cSave').addEventListener('click', () => {
      const F = m.$('#cf'); if (!validate(F, { cname: (v) => (v.length < 3 ? 'Nama minimal 3 karakter.' : '') })) return;
      const name = F.elements.cname.value.trim(); const all = cats();
      if (isNew) { let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (all.some((x) => x.id === id)) id += '-' + Date.now().toString(36).slice(-3); DB.saveCategory({ id, name, img, active: true }); }
      else DB.saveCategory(Object.assign({}, c, { name, img }));
      m.close(); fillCats(); draw(); toast('Kategori disimpan.');
    });
  }

  /* ---------- Paket sewa (tab "Paket Sewa") ----------
     Paket disimpan di koleksi 'packages'; perubahan dikirim ke server lewat sinkronisasi (api/sync/packages). */
  const PK_TYPE = [['tenda', 'Paket Tenda'], ['bbq', 'Paket BBQ'], ['tektok', 'Paket Tektok']];
  const pkts = () => DB.packages();
  function drawPkt() {
    const L = pkts();
    $('#cP').textContent = L.length;
    $('#thPkt').innerHTML = '<tr><th>Nama paket</th><th>Jenis</th><th>Untuk</th><th class="num">Per malam</th><th class="num">3 hari</th><th class="num">5 hari</th><th>Isi paket</th><th>Status</th><th></th></tr>';
    $('#rowsPkt').innerHTML = L.length ? L.map((pk) => `<tr>
      <td><div class="prod"><img loading="lazy" decoding="async" src="${asset(pk.img)}" alt=""><div><b>${esc(pk.name)}</b>${pk.popular ? ' <span class="pill amber">Populer</span>' : ''}${pk.tagline ? `<br><small class="muted">${esc(pk.tagline)}</small>` : ''}</div></div></td>
      <td>${esc((PK_TYPE.find(([k]) => k === pk.type) || [null, pk.type])[1])}</td>
      <td>${esc(pk.people || '-')}</td>
      <td class="num">${rupiah(pk.price)}</td>
      <td class="num">${pk.price3 ? rupiah(pk.price3) : '-'}</td>
      <td class="num">${pk.price5 ? rupiah(pk.price5) : '-'}</td>
      <td>${pk.items.length} alat<br><small class="muted" title="${esc(pk.items.map((i) => (DB.product(i.productId) || {}).name || i.productId).join(', '))}">${pk.items.slice(0, 3).map((i) => esc((DB.product(i.productId) || {}).name || i.productId)).join(', ')}${pk.items.length > 3 ? ' …' : ''}</small></td>
      <td>${pk.active === false ? '<span class="pill gray">Tidak aktif</span>' : '<span class="pill green">Aktif</span>'}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:nowrap;align-items:center;white-space:nowrap">
        <button class="btn btn-light btn-xs" data-pkedit="${pk.id}"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="btn btn-light btn-xs" data-pktoggle="${pk.id}">${pk.active === false ? 'Aktifkan' : 'Nonaktifkan'}</button>
        <button class="btn btn-light btn-xs" data-pkdel="${pk.id}" style="color:var(--red);padding:4px 9px;flex:none" aria-label="Hapus paket" title="Hapus paket"><i class="fa-solid fa-trash"></i> Hapus</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="9" class="muted">Belum ada paket. Klik "Tambah paket".</td></tr>';
  }
  function pkForm(pk) {
    const isNew = !pk;
    const p = pk || { name: '', tagline: '', img: '', price: '', price3: '', price5: '', people: '', pMin: '', pMax: '', type: 'tenda', popular: false, active: true, items: [] };
    let img = p.img || '';
    let items = p.items.map((i) => ({ productId: i.productId, qty: i.qty }));
    let pickIdx = null, pickQ = '';
    const rentable = () => prods().filter((x) => (x.rent || 0) > 0);
    const thumb = (x, size) => (x && x.img)
      ? `<img src="${asset(x.img)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:8px;flex:none">`
      : `<span style="width:${size}px;height:${size}px;border-radius:8px;background:var(--sand);display:inline-flex;align-items:center;justify-content:center;flex:none;color:#8a8f86"><i class="fa-regular fa-image"></i></span>`;
    const pickList = () => {
      const q = pickQ.trim().toLowerCase();
      const L = rentable().filter((x) => !q || [x.name, catName(x.cat)].some((t) => String(t || '').toLowerCase().includes(q))).slice(0, 80);
      return L.length ? L.map((x) => `<button type="button" class="pk-hit" data-pid="${x.id}">${thumb(x, 40)}<span style="flex:1;min-width:0"><b style="display:block;font-size:13.5px">${esc(x.name)}</b><small class="muted">${esc(catName(x.cat))} · ${rupiah(x.rent)}/malam</small></span></button>`).join('')
        : '<p class="muted" style="font-size:13px;padding:8px">Barang tidak ditemukan.</p>';
    };
    const rowsHtml = () => items.map((it, i) => {
      const x = prods().find((y) => y.id === it.productId);
      return `<div class="pk-row" data-i="${i}" style="position:relative;display:flex;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:10px">
        ${thumb(x, 48)}
        <button type="button" class="btn btn-light btn-sm" data-pick="${i}" style="flex:1;min-width:0;justify-content:space-between;text-align:left;${x ? '' : 'color:#8a8f86'}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x ? esc(x.name) : 'Pilih barang…'}</span><i class="fa-solid fa-chevron-down" style="margin-left:8px"></i></button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#6b766e;flex:none">Jumlah <input class="input" type="number" min="1" data-f="qty" value="${it.qty || 1}" style="width:76px"></label>
        <button type="button" class="btn btn-light btn-sm" data-rm="${i}" aria-label="Hapus alat" style="color:var(--red);flex:none"><i class="fa-solid fa-trash"></i></button>
        ${pickIdx === i ? `<div class="pk-pop" style="position:absolute;left:10px;right:10px;top:calc(100% + 4px);z-index:30;background:#fff;border:1px solid var(--line-2);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:10px"><input class="input" id="pkQ" placeholder="Ketik nama barang atau kategori…" value="${esc(pickQ)}" autocomplete="off"><div id="pkList" style="max-height:280px;overflow:auto;margin-top:8px">${pickList()}</div></div>` : ''}
      </div>`;
    }).join('') || '<p class="muted" style="font-size:12.5px">Belum ada alat. Klik "Tambah alat".</p>';
    const m = modal({ title: isNew ? 'Tambah paket' : `Edit ${esc(p.name)}`, size: 'xl', body: `
      <form id="pkF" novalidate>
        <div class="grid-2">
          <div class="field"><label>Nama paket <span class="req">*</span></label><input class="input" name="name" value="${esc(p.name)}" placeholder="Contoh: Paket Tenda 2 Orang"></div>
          <div class="field"><label>Jenis</label><select class="select" name="type">${PK_TYPE.map(([k, l]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Keterangan singkat</label><textarea class="textarea" name="tagline" rows="2">${esc(p.tagline || '')}</textarea></div>
        <div class="grid-3">
          <div class="field"><label>Per malam (Rp) <span class="req">*</span></label><input class="input" type="number" min="0" step="500" name="price" value="${p.price ?? ''}"></div>
          <div class="field"><label>3 hari (Rp)</label><input class="input" type="number" min="0" step="500" name="price3" value="${p.price3 ?? ''}"><small class="muted pk-tk-note" hidden>Tidak berlaku untuk paket tektok.</small></div>
          <div class="field"><label>5 hari (Rp)</label><input class="input" type="number" min="0" step="500" name="price5" value="${p.price5 ?? ''}"><small class="muted pk-tk-note" hidden>Tidak berlaku untuk paket tektok.</small></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Untuk (label)</label><input class="input" name="people" value="${esc(p.people || '')}" placeholder="2–3 orang"></div>
          <div class="field"><label>Min orang</label><input class="input" type="number" min="1" name="pMin" value="${p.pMin ?? ''}"></div>
          <div class="field"><label>Max orang</label><input class="input" type="number" min="1" name="pMax" value="${p.pMax ?? ''}"></div>
        </div>
        <div class="grid-2" style="align-items:start">
          <div class="field"><label>Foto paket</label>
            <div style="width:180px"><div class="pf-photo" id="pkPrev" style="width:180px;height:180px">${img ? `<img src="${asset(img)}" alt="">` : '<i class="fa-regular fa-image"></i>'}</div>
              <label class="btn btn-light btn-xs btn-block" style="margin-top:8px;cursor:pointer"><i class="fa-solid fa-upload"></i> Upload foto<input type="file" accept="image/*" id="pkFile" hidden></label><span class="hint">JPG/PNG, maks. 5 MB</span></div>
          </div>
          <div class="field"><label>Opsi tampilan</label>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:6px"><label><input type="checkbox" name="popular" ${p.popular ? 'checked' : ''}> Tandai "Populer"</label><label><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> Aktif (tampil di website)</label></div>
          </div>
        </div>
        <div class="field"><label>Isi paket <span class="muted" style="font-weight:400">(klik kolom barang untuk mencari dan memilih)</span></label>
          <div id="pkItems">${rowsHtml()}</div>
          <button type="button" class="btn btn-light btn-sm" id="pkAdd"><i class="fa-solid fa-plus"></i> Tambah alat</button></div>
      </form>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="pkSave">Simpan paket</button>' });
    const syncQty = () => { [...m.$('#pkItems').querySelectorAll('.pk-row')].forEach((r) => { const i = +r.dataset.i; if (items[i]) items[i].qty = Math.max(1, +r.querySelector('[data-f="qty"]').value || 1); }); };
    const redraw = () => { m.$('#pkItems').innerHTML = rowsHtml(); if (pickIdx !== null) { const q = m.$('#pkQ'); if (q) q.focus(); } };
    m.$('#pkAdd').addEventListener('click', () => { syncQty(); items.push({ productId: '', qty: 1 }); pickIdx = items.length - 1; pickQ = ''; redraw(); });
    m.$('#pkItems').addEventListener('click', (e) => {
      const opt = e.target.closest('.pk-hit'), pick = e.target.closest('[data-pick]'), rm = e.target.closest('[data-rm]');
      if (opt && pickIdx !== null) { syncQty(); items[pickIdx].productId = opt.dataset.pid; pickIdx = null; pickQ = ''; redraw(); return; }
      if (pick) { syncQty(); const i = +pick.dataset.pick; pickIdx = pickIdx === i ? null : i; pickQ = ''; redraw(); return; }
      if (rm) { syncQty(); items.splice(+rm.dataset.rm, 1); pickIdx = null; redraw(); }
    });
    m.$('#pkItems').addEventListener('input', (e) => { if (e.target.id === 'pkQ') { pickQ = e.target.value; m.$('#pkList').innerHTML = pickList(); } });
    /* Paket tektok hanya per malam: harga 3 dan 5 hari dikunci dan dikosongkan */
    const applyType = () => {
      const tk = m.$('#pkF').elements['type'].value === 'tektok';
      ['price3', 'price5'].forEach((n) => { const el = m.$('#pkF').elements[n]; el.disabled = tk; if (tk) el.value = ''; el.closest('.field').querySelector('.pk-tk-note').hidden = !tk; });
    };
    m.$('#pkF').elements['type'].addEventListener('change', applyType);
    applyType();
    m.$('#pkFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 5e6) { toast('Ukuran foto maksimal 5 MB.', 'err'); return; }
      e.target.value = '';
      /* Atur posisi & zoom dulu, sama seperti foto barang lainnya (hasil persegi 800×800) */
      const out = await UI.cropImage(f, { aspect: 1, size: 800, title: 'Atur foto paket' }); if (!out) return;
      img = out; m.$('#pkPrev').innerHTML = `<img src="${img}" alt="">`;
    });
    m.$('#pkSave').addEventListener('click', () => {
      syncQty();
      const f = m.$('#pkF'); const v = (n) => f.elements[n];
      const name = v('name').value.trim();
      if (!name) { toast('Isi nama paket.', 'err'); v('name').focus(); return; }
      if (!(+v('price').value > 0)) { toast('Isi harga sewa per malam.', 'err'); v('price').focus(); return; }
      if (!items.length) { toast('Tambahkan minimal satu alat ke paket.', 'err'); return; }
      if (items.some((i) => !i.productId)) { toast('Pilih barang untuk setiap baris isi paket.', 'err'); return; }
      const num = (x) => (x === '' || +x <= 0 ? null : +x);
      const obj = { id: p.id || ('pk-' + Date.now().toString(36)), name, tagline: v('tagline').value.trim(), img, price: +v('price').value, price3: v('type').value === 'tektok' ? null : num(v('price3').value), price5: v('type').value === 'tektok' ? null : num(v('price5').value), people: v('people').value.trim(), pMin: num(v('pMin').value), pMax: num(v('pMax').value), type: v('type').value, popular: v('popular').checked, active: v('active').checked, items };
      const cur = pkts(); const idx = cur.findIndex((x) => x.id === obj.id);
      const L = cur.filter((x) => x.id !== obj.id);
      if (idx >= 0) L.splice(idx, 0, obj); else L.push(obj);
      DB.set('packages', L); m.close(); toast(isNew ? 'Paket ditambahkan.' : 'Paket disimpan.'); drawPkt();
    });
  }
  $('#addPkt').addEventListener('click', () => pkForm());
  $('#pPaket').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-pkedit]'), tg = e.target.closest('[data-pktoggle]'), dl = e.target.closest('[data-pkdel]');
    if (ed) { pkForm(pkts().find((x) => x.id === ed.dataset.pkedit)); return; }
    if (tg) {
      const pk = pkts().find((x) => x.id === tg.dataset.pktoggle); const off = pk.active === false;
      DB.set('packages', pkts().map((x) => (x.id === pk.id ? Object.assign({}, x, { active: off }) : x)));
      toast(off ? 'Paket diaktifkan.' : 'Paket dinonaktifkan.'); drawPkt(); return;
    }
    if (dl) {
      const pk = pkts().find((x) => x.id === dl.dataset.pkdel);
      const ok = await confirmBox({ title: `Hapus ${esc(pk.name)}?`, text: 'Paket dihapus dari daftar dan tidak tampil lagi di website. Riwayat pesanan yang sudah ada tetap tersimpan.', ok: 'Hapus', danger: true });
      if (!ok) return;
      DB.set('packages', pkts().filter((x) => x.id !== pk.id)); toast('Paket dihapus.'); drawPkt();
    }
  });

  function setTab(tab) {
    $$('#tabs .tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    TAB = tab; $('#pBarang').hidden = tab === 'kategori' || tab === 'paket'; $('#pKategori').hidden = tab !== 'kategori'; $('#pPaket').hidden = tab !== 'paket'; if (tab === 'paket') drawPkt();
    if (tab !== 'kategori') { const k = tab === 'jual' ? 'buy' : 'rent'; if (k !== KIND) { KIND = k; $('#fType').value = ''; $('#fStatus').value = ''; } draw(); }
  }
  /* Menu "⋯" di tabel: ditampilkan sebagai lapisan di atas halaman (agar tidak tertutup / terpotong tabel).
     Klik pada item menu meneruskan klik ke tombol asli di baris tabel, jadi semua aksi lama tetap berjalan. */
  let floating = null;
  const closeMenus = () => { if (floating) { floating.el.remove(); floating.btn.setAttribute('aria-expanded', 'false'); floating = null; } };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.act-more-btn');
    if (floating && floating.el.contains(e.target)) {
      const it = e.target.closest('[data-idx]'); const orig = it && floating.src.children[+it.dataset.idx];
      closeMenus(); if (orig && orig.tagName !== 'A') { e.preventDefault(); orig.click(); }
      return;
    }
    if (!b) { closeMenus(); return; }
    const reopen = floating && floating.btn === b; closeMenus(); if (reopen) return;
    const src = b.nextElementSibling; const el = src.cloneNode(true);
    el.hidden = false; el.classList.add('act-menu-float'); [...el.children].forEach((c, i) => { c.dataset.idx = i; c.removeAttribute('data-hist'); c.removeAttribute('data-toggle'); });
    document.body.appendChild(el); b.setAttribute('aria-expanded', 'true'); floating = { el, btn: b, src };
    const r = b.getBoundingClientRect(); const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, r.right - w) + 'px'; el.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
  });
  window.addEventListener('scroll', closeMenus, true); window.addEventListener('resize', closeMenus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  $('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
  ['#q', '#fCat', '#fType', '#fStatus'].forEach((s) => $(s).addEventListener('input', draw));
  $('#quickF').addEventListener('click', (e) => { const b = e.target.closest('[data-qf]'); if (!b) return; const k = b.dataset.qf; fillType(); $('#fType').value = ['care', 'full', 'lowsale'].includes(k) ? k : ''; $('#fStatus').value = k === 'off' ? 'nonaktif' : ''; draw(); });
  $('#add').addEventListener('click', () => form());
  if (Admin.isOwner) $('#addCat').addEventListener('click', () => { location.href = Admin.O('konfigurasi?s=kategori'); }); else $('#addCat').remove();
  document.querySelector('.content').addEventListener('click', async (e) => {
    const un = e.target.closest('[data-units]'); if (un) { unitsModal(un.dataset.units); return; }
    const rs = e.target.closest('[data-restock]'); if (rs) { restockModal(rs.dataset.restock); return; }
    if (e.target.closest('#rsHist')) { restockHistory(); return; }
    if (e.target.closest('#rsMulti')) { restockMulti(); return; }
    const vx = e.target.closest('[data-vmx]'); if (vx) { varMatrix(vx.dataset.vmx); return; }
    const ed = e.target.closest('[data-edit]'), tg = e.target.closest('[data-toggle]'), h = e.target.closest('[data-hist]'), ce = e.target.closest('[data-cedit]'), ct = e.target.closest('[data-ctoggle]');
    if (ed) form(DB.product(ed.dataset.edit));
    if (h) history(h.dataset.hist);
    if (tg) {
      const p = DB.product(tg.dataset.toggle); const off = p.active === false;
      const used = DB.bookings().filter((b) => ACTIVE_ST.includes(b.status) && b.items.some((i) => i.components.some((c) => c.productId === p.id))).length;
      const ok = await confirmBox(off
        ? { title: `Aktifkan ${esc(p.name)}?`, text: 'Barang akan tampil lagi di katalog dan bisa disewa / dibeli customer.', ok: 'Aktifkan' }
        : { title: `Nonaktifkan ${esc(p.name)}?`, text: `Barang disembunyikan dari katalog dan tidak bisa dipesan lagi. Data & riwayat transaksinya tetap tersimpan.${used ? ` <br><strong>${used} booking aktif</strong> yang memakai barang ini tetap berjalan.` : ''}`, ok: 'Nonaktifkan' });
      if (!ok) return;
      const raw = DB.get('products').find((x) => x.id === p.id);
      DB.saveProduct(Object.assign({}, raw, { active: off })); toast(off ? 'Barang diaktifkan kembali.' : 'Barang dinonaktifkan.'); draw();
    }
    if (ce) catForm(cats().find((c) => c.id === ce.dataset.cedit));
    if (ct) {
      const c = cats().find((x) => x.id === ct.dataset.ctoggle); const off = c.active === false;
      const n = prods().filter((p) => p.cat === c.id && p.active !== false).length;
      if (!(await confirmBox(off ? { title: `Aktifkan kategori ${esc(c.name)}?`, text: 'Kategori dan barang aktif di dalamnya tampil lagi di website.', ok: 'Aktifkan' }
        : { title: `Nonaktifkan kategori ${esc(c.name)}?`, text: `Kategori disembunyikan dari website${n ? `, termasuk ${n} barang di dalamnya` : ''}. Tidak ada data yang dihapus.`, ok: 'Nonaktifkan' }))) return;
      DB.saveCategory(Object.assign({}, c, { active: off })); fillCats(); draw(); toast(off ? 'Kategori diaktifkan.' : 'Kategori dinonaktifkan.');
    }
  });
  bindExport($('#exp'), () => { const L = list();
    const vtxt = (p) => (DB.hasVariant(p) ? p.variant.options.map((o) => `${o.name.replace(/\s*\(.*\)/, '')}: ${o.stock}`).join(', ') : '-');
    if (KIND === 'buy') return { filename: `barang-jual-${T}`, title: 'Data Barang Jual & Stok', subtitle: `Posisi stok per ${D.fmtDate(T, true)}`,
      summary: [['Jenis barang', String(L.length)], ['Total stok', String(L.reduce((a, p) => a + p.stock, 0))], ['Nilai stok (harga beli)', L.reduce((a, p) => a + (+p.stock || 0) * (+p.cost || 0), 0)], ['Total terjual', String(L.reduce((a, p) => a + soldQty(p.id), 0)) + ' unit']],
      columns: [{ header: 'ID' }, { header: 'Nama Barang', width: 30 }, { header: 'Kategori' }, { header: 'Harga Beli', type: 'money' }, { header: 'Harga Jual', type: 'money' }, { header: 'Stok', type: 'number' }, { header: 'Stok Minimum', type: 'number' }, { header: 'Terjual', type: 'number' }, { header: 'Ukuran' }, { header: 'Status' }],
      rows: L.map((p) => [p.id, p.name, catName(p.cat), p.cost ?? '', p.price, p.stock, p.minStock ?? 0, soldQty(p.id), vtxt(p), p.active === false ? 'Tidak aktif' : 'Aktif']),
      foot: ['Total', '', '', '', L.reduce((a, p) => a + p.stock, 0), '', L.reduce((a, p) => a + soldQty(p.id), 0), '', ''] };
    return { filename: `barang-sewa-${T}`, title: 'Data Barang Sewa & Unit', subtitle: `Posisi stok per ${D.fmtDate(T, true)}`,
      summary: [['Jenis barang', String(L.length)], ['Total unit', String(L.reduce((a, p) => a + p.stock, 0))], ['Sedang disewa', String(L.reduce((a, p) => a + Rules.rentedNow(p.id), 0)) + ' unit']],
      columns: [{ header: 'ID' }, { header: 'Nama Barang', width: 30 }, { header: 'Kategori' }, { header: 'Sewa / malam', type: 'money' }, { header: 'Perkegiatan 3 hari', type: 'money' }, { header: 'Ekspedisi 5 hari', type: 'money' }, { header: 'Total Unit', type: 'number' }, { header: 'Tersedia', type: 'number' }, { header: 'Disewa', type: 'number' }, { header: 'Ukuran' }, { header: 'Status' }],
      rows: L.map((p) => [p.id, p.name, catName(p.cat), p.rent, p.rent3 || '', p.rent5 || '', p.stock, Rules.availableOn(p.id, T), Rules.rentedNow(p.id), vtxt(p), p.active === false ? 'Tidak aktif' : 'Aktif']),
      foot: ['Total', '', '', '', '', '', L.reduce((a, p) => a + p.stock, 0), L.reduce((a, p) => a + Rules.availableOn(p.id, T), 0), L.reduce((a, p) => a + Rules.rentedNow(p.id), 0), '', ''] }; });
  fillType();
  if (param('low')) { setTab('jual'); $('#fType').value = 'lowsale'; }
  else if (param('jenis') === 'jual') setTab('jual');
  if (param('service') || param('care')) { $('#fType').value = 'care'; }
  if (UI.param('q')) $('#q').value = UI.param('q');
  draw();
  drawPkt(); /* isi jumlah paket di tab sejak halaman dibuka */
  if (param('unit') && DB.product(param('unit'))) unitsModal(param('unit'));
})();

