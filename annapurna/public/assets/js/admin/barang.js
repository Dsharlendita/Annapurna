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
  function list() {
    const q = $('#q').value.trim().toLowerCase(), c = $('#fCat').value, t = $('#fType').value, st = $('#fStatus').value;
    return prods().filter((p) => (!q || [p.name, p.sku, p.brand, ...(p.units || []).map((u) => u.code)].join(' ').toLowerCase().includes(q)) && (!c || p.cat === c)
      && (!st || (st === 'aktif' ? p.active !== false : p.active === false))
      && (!t || (t === 'rent' && p.rent) || (t === 'buy' && p.price) || (t === 'lowsale' && DB.lowStock().some((x) => x.id === p.id)) || (t === 'full' && isFull(p)) || (t === 'care' && needsCare(p))));
  }
  const isFull = (p) => p.rent > 0 && p.active !== false && Rules.availableOn(p.id, T) <= 2;
  const needsCare = (p) => (p.units || []).some((u) => u.status === 'aktif' && (u.care || DB.serviceDue(p, u)));
  function quick() {
    const P = prods(); const care = P.filter(needsCare).length; const full = P.filter(isFull).length; const low = DB.lowStock().length; const off = P.filter((p) => p.active === false).length;
    const cur = $('#fType').value || ($('#fStatus').value === 'nonaktif' ? 'off' : '');
    const box = $('#quickF'); if (!box) return;
    box.innerHTML = [['', 'Semua barang', P.length, 'fa-boxes-stacked', ''], ['care', 'Perlu perawatan', care, 'fa-soap', 'Unit perlu dicuci, sedang diperbaiki, atau jatuh tempo perawatan berkala'], ['full', 'Sewa hampir penuh', full, 'fa-calendar-xmark', 'Barang sewa yang tersisa 2 unit atau kurang untuk hari ini'], ['lowsale', 'Stok jual menipis', low, 'fa-cart-arrow-down', 'Barang jual di bawah stok minimum — perlu belanja / restock'], ['off', 'Tidak aktif', off, 'fa-toggle-off', 'Barang yang dinonaktifkan']]
      .map(([k, l, n, ic, tip]) => `<button type="button" data-qf="${k}" class="${cur === k ? 'on' : ''} ${n && k && k !== 'off' ? 'warn' : ''}" ${tip ? `title="${tip}"` : ''}><i class="fa-solid ${ic}"></i> ${l} <b>${n}</b></button>`).join('')
      + (cur && cur !== 'off' ? `<p class="qf-hint">${{ care: '<i class="fa-solid fa-circle-info"></i> Barang dengan unit yang <b>perlu dicuci</b>, <b>sedang diperbaiki</b>, atau <b>jatuh tempo perawatan berkala</b>. Kerjakan di <a class="link" href="perawatan">Perawatan Unit</a>.', full: '<i class="fa-solid fa-circle-info"></i> Barang <b>sewa</b> yang hari ini tinggal 2 unit atau kurang — tanda permintaan tinggi, pertimbangkan menambah unit.', lowsale: '<i class="fa-solid fa-circle-info"></i> Barang <b>jual</b> yang stoknya di bawah minimum — perlu belanja / restock.' }[cur] || ''}</p>` : '');
  }

  function draw() {
    quick();
    $('#cB').textContent = prods().length; $('#cK').textContent = cats().length;
    const L = list();
    $('#rows').innerHTML = L.length ? L.map((p) => {
      const rented = Rules.rentedNow(p.id), avail = Rules.availableOn(p.id, T);
      const off = p.active === false;
      return `<tr class="${off ? 'row-off' : ''}">
        <td><div class="prod"><img src="${asset(p.img)}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.sku || p.id)}${p.brand ? ` · ${esc(p.brand)}` : ''}${p.badge ? ` · ${esc(p.badge)}` : ''}${p.featured ? ' · <i class="fa-solid fa-star" style="color:var(--gold)"></i> Unggulan' : ''}</small></div></div></td>
        <td>${esc(catName(p.cat))}</td>
        <td class="num">${p.rent ? rupiah(p.rent) : '<span class="muted">—</span>'}</td>
        <td class="num">${p.price ? rupiah(p.price) : '<span class="muted">—</span>'}</td>
        <td>${DB.hasVariant(p) ? `<div class="var-chips">${p.variant.options.map((o) => `<span title="${esc(o.name)}">${esc(o.name.replace(/\s*\(.*\)/, ''))} <b>${o.stock}</b></span>`).join('')}</div>` : ''}<span class="stock-chip">Total <b>${p.stock}</b></span><span class="stock-chip">Tersedia <b style="color:${avail <= 2 ? 'var(--red)' : 'var(--g700)'}">${avail}</b></span>${p.rent ? `<span class="stock-chip">Disewa <b>${rented}</b></span>` : ''}${!p.rent && p.minStock ? `<span class="stock-chip" title="Stok minimum barang jual">Min <b style="color:${DB.saleableStock(p) < p.minStock ? 'var(--red)' : 'inherit'}">${p.minStock}</b></span>` : ''}</td>
        <td><span class="pill ${DB.condTone(p.cond)}">${esc(p.cond || 'Baik')}</span>${DB.condRentable(p.cond) ? '' : '<small style="color:var(--red)">Tidak bisa disewa</small>'}${off ? '<small><span class="pill gray plain">Tidak Aktif</span></small>' : ''}</td>
        <td><div class="acts">
          ${p.units ? `<button class="btn btn-light btn-xs" data-units="${p.id}" title="Unit fisik"><i class="fa-solid fa-barcode"></i> Unit${needsCare(p) ? ' <span class="dot-warn" title="Ada unit yang perlu perawatan"></span>' : ''}</button>` : ''}
          <button class="btn btn-light btn-xs" data-hist="${p.id}" title="Riwayat"><i class="fa-solid fa-clock-rotate-left"></i></button>
          <a class="btn btn-light btn-xs" href="${url('produk?id=' + p.id)}" target="_blank" title="Lihat di website"><i class="fa-regular fa-eye"></i></a>
          <button class="btn btn-light btn-xs" data-edit="${p.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="btn ${off ? 'btn-primary' : 'btn-light'} btn-xs" data-toggle="${p.id}" title="${off ? 'Aktifkan kembali' : 'Nonaktifkan (tidak tampil di katalog)'}"><i class="fa-solid ${off ? 'fa-toggle-off' : 'fa-toggle-on'}"></i> ${off ? 'Aktifkan' : 'Nonaktifkan'}</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Tidak ada barang yang cocok.</td></tr>';
    $('#cats').innerHTML = cats().map((c) => { const n = prods().filter((p) => p.cat === c.id).length; const off = c.active === false; const at = DB.attrsForCat(c.id); return `<div class="list-row ${off ? 'row-off' : ''}"><img src="${asset(c.img)}" alt="" style="width:52px;height:42px;object-fit:cover;border-radius:8px"><div class="nm"><strong>${esc(c.name)}</strong>${off ? ' <span class="pill gray plain">Tidak Aktif</span>' : ''}<small>${n} barang${at.length ? ' · atribut: ' + at.map((a) => esc(a.name) + (a.variant ? ' (varian stok)' : '')).join(', ') : ''}</small></div></div>`; }).join('');
  }

  const ACTIVE_STS = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'];
  const bookedSize = (pid, size) => DB.bookings().filter((b) => ACTIVE_STS.includes(b.status)).reduce((n, b) => n + b.items.reduce((t, it) => t + it.components.filter((c) => c.productId === pid && c.size === size).reduce((u, c) => u + c.qty * it.qty, 0), 0), 0);

  function form(p) {
    const isNew = !p;
    p = p ? JSON.parse(JSON.stringify(DB.get('products').find((x) => x.id === p.id) || p)) : { id: '', name: '', cat: cats()[0].id, img: '', rent: 0, price: 0, stock: 1, rating: 5, reviews: 0, cond: 'Sangat Baik', badge: '', featured: false, desc: '', specs: [], active: true, minDays: 1 };
    let img = p.img;
    let vattr = DB.hasVariant(p) ? (p.variant.attrId || '') : '';
    const stockMap = {}; if (DB.hasVariant(p)) p.variant.options.forEach((o) => { stockMap[o.name] = o.stock; });
    let checked = new Set(DB.hasVariant(p) ? p.variant.options.map((o) => o.name) : []);
    const attrVals = Object.assign({}, p.attrs || {});
    const varAttrs = (cat) => DB.attrsForCat(cat).filter((a) => a.variant && a.type === 'pilihan');
    const infoAttrs = (cat) => DB.attrsForCat(cat).filter((a) => !a.variant);
    const curAttr = () => DB.attributes(true).find((a) => a.id === vattr);
    const sec = (ic, t, sub) => `<div class="pf-sec"><h4><i class="fa-solid ${ic}"></i> ${t}</h4>${sub ? `<p>${sub}</p>` : ''}</div>`;
    const m = modal({ title: isNew ? 'Tambah barang' : `Edit ${esc(p.name)}`, size: 'xl', body: `
      <form id="pf" novalidate class="pf">
        ${sec('fa-circle-info', 'Informasi dasar')}
        <div class="pf-top">
          <div><div class="pf-photo" id="prev">${img ? `<img src="${asset(img)}" alt="">` : '<i class="fa-regular fa-image"></i>'}</div>
            <label class="btn btn-light btn-xs btn-block" style="margin-top:8px;cursor:pointer"><i class="fa-solid fa-upload"></i> Upload foto<input type="file" accept="image/*" id="pImg" hidden></label><span class="hint">JPG/PNG, maks. 5 MB</span></div>
          <div>
            <div class="field"><label>Nama barang <span class="req">*</span></label><input class="input" name="pname" value="${esc(p.name)}" placeholder="Contoh: Jaket Gunung Waterproof"></div>
            <div class="grid-3">
              <div class="field"><label>Kategori</label><select class="select" name="cat">${cats().map((c) => `<option value="${c.id}" ${c.id === p.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
              <div class="field"><label>Merek</label><input class="input" name="brand" value="${esc(p.brand || '')}" placeholder="Eiger, Consina…"></div>
              <div class="field"><label>Kode barang / SKU</label><input class="input" name="sku" value="${esc(p.sku || '')}" placeholder="JKT-WP-01"></div>
            </div>
            <div class="grid-3">
              <div class="field"><label>Kondisi</label><select class="select" name="cond">${CONDS.map((c) => `<option ${c === p.cond ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
              <div class="field"><label>Status</label><select class="select" name="active"><option value="1" ${p.active !== false ? 'selected' : ''}>Aktif</option><option value="0" ${p.active === false ? 'selected' : ''}>Tidak aktif</option></select></div>
              <div class="field"><label>Label</label><input class="input" name="badge" value="${esc(p.badge || '')}" placeholder="Populer / Best Seller / Baru"></div>
            </div>
          </div>
        </div>

        ${sec('fa-tags', 'Harga & ketentuan', 'Isi harga sewa untuk barang rental, harga jual untuk barang yang dijual. Bisa keduanya.')}
        <div class="grid-4">
          <div class="field"><label>Harga sewa / hari (Rp)</label><input class="input" type="number" min="0" step="1000" name="rent" value="${p.rent}"><span class="hint">0 = tidak disewakan</span></div>
          <div class="field"><label>Harga jual (Rp)</label><input class="input" type="number" min="0" step="1000" name="price" value="${p.price}"><span class="hint">0 = tidak dijual</span></div>
          <div class="field"><label>Minimal sewa (hari)</label><input class="input" type="number" min="1" max="30" name="minDays" value="${p.minDays || 1}"></div>
          <div class="field"><label>Jaminan / deposit (Rp)</label><input class="input" type="number" min="0" step="5000" name="deposit" value="${p.deposit || 0}"><span class="hint">Opsional</span></div>
        </div>
        <div class="grid-4">
          <div class="field"><label>Stok minimum (barang jual)</label><input class="input" type="number" min="0" name="minStock" value="${p.minStock ?? (DB.settings().minStockDefault ?? 2)}"><span class="hint">Staff diberi notifikasi bila stok ≤ angka ini.</span></div>
          <div class="field"><label>Perawatan tiap … kali sewa</label><input class="input" type="number" min="0" name="serviceEvery" value="${p.serviceEvery || ''}" placeholder="${DB.settings().serviceEvery || 10} (default)"><span class="hint">Kosongkan = ikut aturan toko.</span></div>
        </div>

        ${sec('fa-ruler', 'Ukuran / varian & stok', 'Pilihan varian mengikuti atribut yang diatur Owner untuk kategori barang ini. Centang nilai yang tersedia lalu isi stoknya.')}
        <div class="grid-3">
          <div class="field" style="grid-column:span 2"><label>Varian stok</label><select class="select" id="vType"></select><span class="hint" id="vHint"></span></div>
          <div class="field" id="stockF"><label>Stok total (unit)</label><input class="input" type="number" min="0" name="stock" value="${p.stock}"></div>
        </div>
        <div id="vBox"></div>
        <div id="attrBox"></div>

        ${sec('fa-list-check', 'Detail & spesifikasi', 'Ditampilkan di halaman produk agar customer tahu persis barang yang disewa / dibeli.')}
        <div class="grid-3">
          <div class="field"><label>Warna</label><input class="input" name="color" value="${esc(p.color || '')}" placeholder="Hijau army"></div>
          <div class="field"><label>Bahan</label><input class="input" name="material" value="${esc(p.material || '')}" placeholder="Nylon ripstop 420D"></div>
          <div class="field"><label>Berat</label><input class="input" name="weight" value="${esc(p.weight || '')}" placeholder="1,2 kg"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Dimensi / kapasitas / panduan ukuran</label><input class="input" name="dimension" value="${esc(p.dimension || '')}" placeholder="Contoh: 60 liter · atau lingkar dada M 106 cm"></div>
          <div class="field"><label>Kelengkapan</label><input class="input" name="includes" value="${esc(p.includes || '')}" placeholder="Contoh: frame, flysheet, 12 pasak, tas"></div>
        </div>
        <div class="field"><label>Deskripsi</label><textarea class="textarea" name="desc" rows="3" placeholder="Jelaskan kegunaan, keunggulan, dan cara pakai singkat">${esc(p.desc || '')}</textarea></div>
        <div class="field"><label>Spesifikasi singkat (satu per baris)</label><textarea class="textarea" name="specs" rows="3" placeholder="Waterproof 3000mm&#10;Kapasitas 4 orang">${esc((p.specs || []).join('\n'))}</textarea></div>
        <label class="chk-line"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Tampilkan di "Produk Rental Terlaris" beranda</label>
      </form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="pSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button>` });
    const F = m.$('#pf'), E = F.elements;
    { const secs = m.$$('.pf-sec'); secs.forEach((x, i) => { x.id = 'pfs' + i; });
      m.$('.modal-body').insertAdjacentHTML('afterbegin', `<nav class="pf-nav">${secs.map((x, i) => `<button type="button" data-go="pfs${i}">${x.querySelector('h4').innerHTML}</button>`).join('')}</nav>`);
      m.$('.pf-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) m.$('#' + b.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
    const O = Admin.isOwner;
    function fillVType() {
      const list = varAttrs(E.cat.value); const cur0 = curAttr();
      if (vattr && !list.some((a) => a.id === vattr) && cur0) list.push(cur0);
      if (vattr && !cur0 && DB.hasVariant(p)) list.push({ id: '', name: p.variant.label, values: p.variant.options.map((o) => o.name), legacy: true });
      m.$('#vType').innerHTML = '<option value="__none">Tanpa varian (satu stok)</option>' + list.map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.values.map((v) => v.replace(/\s*\(.*\)/, '')).join(', '))}</option>`).join('');
      m.$('#vType').value = DB.hasVariant(p) || vattr ? vattr : '__none';
      if (m.$('#vType').value !== (vattr || '__none')) m.$('#vType').value = '__none';
      m.$('#vHint').innerHTML = list.length ? '' : `Kategori ini belum punya atribut varian.${O ? ` Tambahkan di <a class="link" href="${Admin.O('konfigurasi?s=atribut')}">Konfigurasi → Atribut Barang</a>.` : ' Minta Owner menambahkannya di Konfigurasi Sistem.'}`;
    }
    const isVar = () => m.$('#vType').value !== '__none';
    const valuesOf = () => { const a = curAttr(); const base = a ? a.values : DB.hasVariant(p) ? p.variant.options.map((o) => o.name) : []; return [...base, ...[...checked].filter((v) => !base.includes(v))]; };
    function drawV() {
      const has = isVar();
      E.stock.readOnly = has; m.$('#stockF').classList.toggle('ro', has);
      if (!has) { m.$('#vBox').innerHTML = ''; return; }
      const vals = valuesOf();
      const total = [...checked].reduce((a, v) => a + (+stockMap[v] || 0), 0); E.stock.value = total;
      m.$('#vBox').innerHTML = `<div class="var-tbl"><div class="var-h"><span>Nilai</span><span>Stok</span><span>Sedang dipakai</span><span></span></div>
        ${vals.map((v) => { const used = p.id ? bookedSize(p.id, v) : 0; const on = checked.has(v); return `<label class="var-row ${on ? '' : 'off'}"><span class="var-chk"><input type="checkbox" data-vc="${esc(v)}" ${on ? 'checked' : ''} ${used ? 'disabled' : ''}> <b>${esc(v)}</b></span><input class="input" type="number" min="0" data-vs="${esc(v)}" value="${stockMap[v] ?? 0}" ${on ? '' : 'disabled'}><span class="muted">${used ? `${used} unit di booking aktif` : '—'}</span><span></span></label>`; }).join('')}
        <div class="var-foot"><span class="muted">Nilai baru ditambahkan Owner di Konfigurasi Sistem.</span><span>Total <b>${total}</b> unit</span></div></div>`;
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
      if (vattr && !(DB.hasVariant(p) && p.variant.attrId === vattr)) { const a = curAttr(); checked = new Set(a ? a.values : []); }
      drawV();
    });
    E.cat.addEventListener('change', () => { fillVType(); drawV(); drawAttrs(); });
    m.$('#vBox').addEventListener('change', (e) => { const c = e.target.dataset.vc; if (c != null) { if (e.target.checked) checked.add(c); else checked.delete(c); drawV(); } });
    m.$('#vBox').addEventListener('input', (e) => { const st = e.target.dataset.vs; if (st != null) { stockMap[st] = Math.max(0, parseInt(e.target.value, 10) || 0); E.stock.value = [...checked].reduce((a, v) => a + (+stockMap[v] || 0), 0); m.$('.var-foot b').textContent = E.stock.value; } });
    m.$('#attrBox').addEventListener('input', (e) => { const k = e.target.dataset.at; if (k) attrVals[k] = e.target.value; });
    fillVType(); drawV(); drawAttrs();
    m.$('#pImg').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 5e6) { toast('Ukuran foto maksimal 5 MB.', 'err'); return; }
      img = await fileToDataURL(f, 800); m.$('#prev').innerHTML = `<img src="${img}" alt="">`;
    });
    m.$('#pSave').addEventListener('click', () => {
      if (!validate(F, { pname: (v) => (v.length < 3 ? 'Nama minimal 3 karakter.' : ''), stock: (v) => (v === '' || +v < 0 ? 'Stok tidak valid.' : ''),
        rent: () => (+E.rent.value <= 0 && +E.price.value <= 0 ? 'Isi harga sewa atau harga jual.' : ''), minDays: (v) => (!(+v >= 1) ? 'Minimal 1 hari.' : '') })) return;
      let variant = null;
      if (isVar()) {
        const vals = valuesOf().filter((v) => checked.has(v));
        if (!vals.length) { toast('Centang minimal satu nilai varian, atau pilih "Tanpa varian".', 'err'); return; }
        const a = curAttr();
        variant = { attrId: a ? a.id : (p.variant && p.variant.attrId) || '', label: a ? a.name : p.variant.label, options: vals.map((v) => ({ name: v, stock: Math.max(0, +stockMap[v] || 0) })) };
        for (const o of variant.options) { const used = p.id ? bookedSize(p.id, o.name) : 0; if (o.stock < used) { toast(`Stok ${o.name} tidak boleh kurang dari ${used} (sedang dipakai booking).`, 'err'); return; } }
      } else if (p.id && DB.hasVariant(p) && p.variant.options.some((o) => bookedSize(p.id, o.name))) { toast('Varian tidak bisa dilepas karena masih dipakai di booking aktif.', 'err'); return; }
      const missing = infoAttrs(E.cat.value).filter((a) => a.required && !String(attrVals[a.id] || '').trim());
      if (missing.length) { toast(`Isi atribut wajib: ${missing.map((a) => a.name).join(', ')}.`, 'err'); return; }
      const reqVar = varAttrs(E.cat.value).filter((a) => a.required);
      if (reqVar.length && !variant) { toast(`Kategori ini wajib memakai varian ${reqVar.map((a) => a.name).join(' / ')}.`, 'err'); return; }
      const attrs = {}; infoAttrs(E.cat.value).forEach((a) => { const v = String(attrVals[a.id] || '').trim(); if (v) attrs[a.id] = v; });
      if (!img) { toast('Upload foto barang terlebih dahulu.', 'err'); return; }
      if (p.units && (+E.rent.value || 0) > 0) {
        const live = (size) => p.units.filter((u) => u.status !== 'terjual' && u.status !== 'nonaktif' && (size == null || u.size === size)).length;
        const bad = variant ? variant.options.filter((o) => o.stock < live(o.name)).map((o) => o.name) : (+E.stock.value < live(null) && !DB.hasVariant(p) ? ['total'] : []);
        if (bad.length) { toast(`Stok tidak bisa dikurangi dari form (${bad.join(', ')}). Kurangi lewat tombol Unit: tandai unit sebagai tidak aktif / hilang.`, 'err'); return; }
      }
      const all = prods();
      const t = (k) => (E[k].value || '').trim();
      const obj = Object.assign({}, p, { id: p.id || 'p' + (Math.max(0, ...all.map((x) => parseInt(x.id.slice(1), 10) || 0)) + 1), name: t('pname'), cat: E.cat.value, cond: E.cond.value,
        rent: Math.max(0, +E.rent.value || 0), price: Math.max(0, +E.price.value || 0), stock: Math.max(0, parseInt(E.stock.value, 10) || 0), badge: t('badge'),
        brand: t('brand'), sku: t('sku'), color: t('color'), material: t('material'), weight: t('weight'), dimension: t('dimension'), includes: t('includes'),
        minDays: Math.max(1, parseInt(E.minDays.value, 10) || 1), deposit: Math.max(0, +E.deposit.value || 0), variant, attrs,
        minStock: Math.max(0, parseInt(E.minStock.value, 10) || 0), serviceEvery: parseInt(E.serviceEvery.value, 10) || null,
        desc: t('desc'), specs: E.specs.value.split('\n').map((s) => s.trim()).filter(Boolean), featured: E.featured.checked, active: E.active.value === '1', img });
      if (!variant) delete obj.variant;
      DB.saveProduct(obj); m.close(); toast(isNew ? 'Barang baru ditambahkan.' : 'Perubahan disimpan.'); draw();
    });
  }
  function unitsModal(pid) {
    const draw = () => {
      const p = DB.get('products').find((x) => x.id === pid); const every = p.serviceEvery || DB.settings().serviceEvery || 10;
      const U = p.units || []; const sz = DB.hasVariant(p);
      const sum = (f) => U.filter(f).length;
      const st = (u) => DB.unitState(u);
      m.$('.modal-body').innerHTML = `<div class="unit-sum"><span>Total <b>${sum((u) => u.status === 'aktif')}</b></span><span class="green">Siap disewa <b>${sum((u) => st(u).k === 'siap')}</b></span><span class="blue">Sedang disewa <b>${sum((u) => st(u).k === 'out')}</b></span><span class="teal">Perlu dicuci <b>${sum((u) => st(u).k === 'cuci')}</b></span><span class="red">Dalam perbaikan <b>${sum((u) => st(u).k === 'perbaikan')}</b></span><span>Nonaktif / terjual <b>${sum((u) => u.status !== 'aktif')}</b></span></div>
        <p class="muted" style="font-size:12.5px;margin:0 0 12px">${DB.needsWash(p) ? '<i class="fa-solid fa-soap"></i> Kategori ini <b>wajib dicuci setiap kembali</b>. ' : ''}Perawatan berkala setiap ${every} kali sewa. Unit tidak dihapus — nonaktifkan bila hilang / sudah tidak dipakai. <a class="link" href="perawatan">Buka Perawatan Unit</a></p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Kode</th>${sz ? '<th>Ukuran</th>' : ''}<th>Status</th><th>Kualitas</th><th class="num">Disewa</th><th>Perawatan berkala</th><th class="num">Aksi</th></tr></thead><tbody>
        ${U.map((u) => { const due = DB.serviceDue(p, u); const off = u.status !== 'aktif'; const S = st(u); const ci = u.careInfo || {};
          const acts = off ? (u.status === 'nonaktif' ? `<button class="btn btn-light btn-xs" data-uon="${u.code}">Aktifkan</button>` : '')
            : S.k === 'out' ? `<span class="muted unit-wait"><i class="fa-solid fa-person-hiking"></i> Dibawa customer — tindakan tersedia setelah kembali</span>`
            : S.k === 'cuci' ? `<button class="btn btn-primary btn-xs" data-uclean="${u.code}"><i class="fa-solid fa-check"></i> Sudah bersih</button>`
            : S.k === 'perbaikan' ? `<a class="btn btn-primary btn-xs" href="perawatan"><i class="fa-solid fa-screwdriver-wrench"></i> Proses perbaikan</a>`
            : `<button class="btn btn-light btn-xs" data-uwash="${u.code}" title="Kirim ke antrian cuci"><i class="fa-solid fa-soap"></i> Cuci</button><button class="btn btn-light btn-xs" data-ubroke="${u.code}" title="Laporkan kerusakan"><i class="fa-solid fa-triangle-exclamation"></i> Rusak</button>${due ? `<button class="btn btn-gold btn-xs" data-usvc="${u.code}" title="Catat perawatan berkala"><i class="fa-solid fa-clipboard-check"></i> Perawatan</button>` : ''}`;
          return `<tr class="${off ? 'row-off' : ''}"><td><b class="mono">${u.code}</b>${u.notes && off ? `<small>${esc(u.notes)}</small>` : ''}</td>${sz ? `<td>${esc(String(u.size || '').replace(/\s*\(.*\)/, ''))}</td>` : ''}
          <td><span class="pill ${S.tone} plain">${esc(S.l)}</span>${S.k === 'perbaikan' ? `<small class="issue">${esc(ci.issue || '')}</small>` : S.k === 'cuci' && ci.booking ? `<small>dari ${ci.booking}</small>` : ''}</td>
          <td>${off ? '—' : `<select class="select sm" data-ucond="${u.code}" ${S.k === 'out' ? 'disabled title="Bisa diubah setelah barang kembali"' : ''}>${DB.COND_LIST.map((c) => `<option ${c === u.cond ? 'selected' : ''}>${c}</option>`).join('')}</select>`}</td>
          <td class="num">${u.rents}×</td>
          <td>${due ? '<span class="pill amber plain">Jatuh tempo</span>' : `<span class="muted">${u.sinceService}/${every}×</span>`}<small>${u.lastService ? 'terakhir ' + D.fmtDate(u.lastService) : 'belum pernah'}</small></td>
          <td><div class="acts">${acts}<button class="btn btn-light btn-xs" data-ulog="${u.code}" title="Riwayat unit"><i class="fa-solid fa-clock-rotate-left"></i></button>${off || S.k === 'out' ? '' : `<button class="btn btn-light btn-xs" data-uoff="${u.code}" title="Nonaktifkan unit (hilang / tidak dipakai)"><i class="fa-solid fa-ban"></i></button>`}</div></td></tr>`; }).join('')}
        </tbody></table></div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sz ? `<select class="select sm" id="uSize" style="width:auto">${p.variant.options.map((o) => `<option>${esc(o.name)}</option>`).join('')}</select>` : ''}<button class="btn btn-light btn-sm" id="uAdd"><i class="fa-solid fa-plus"></i> Tambah unit baru</button><span class="muted" style="font-size:12.5px">Stok ikut bertambah otomatis.</span></div>`;
    };
    const p0 = DB.product(pid);
    const m = modal({ title: `Unit fisik · ${esc(p0.name)}`, size: 'xl', body: '<div></div>', foot: '<button class="btn btn-primary" data-close>Selesai</button>' });
    const body = m.$('.modal-body');
    body.addEventListener('change', (e) => { const c = e.target.dataset.ucond; if (!c) return; DB.updateUnit(pid, c, { cond: e.target.value }, `Kualitas diubah menjadi ${e.target.value}`); toast(`Kualitas ${c} disimpan.`); draw(); });
    body.addEventListener('click', async (e) => {
      const svc = e.target.closest('[data-usvc]'), lg = e.target.closest('[data-ulog]'), off = e.target.closest('[data-uoff]'), on = e.target.closest('[data-uon]');
      const wsh = e.target.closest('[data-uwash]'), brk = e.target.closest('[data-ubroke]'), cln = e.target.closest('[data-uclean]');
      if (wsh) { DB.setCare(pid, wsh.dataset.uwash, 'cuci'); toast(`${wsh.dataset.uwash} masuk antrian cuci.`); draw(); return; }
      if (cln) { DB.finishCare(pid, cln.dataset.uclean); toast(`${cln.dataset.uclean} sudah bersih dan siap disewa.`); draw(); return; }
      if (brk) { const r = await confirmBox({ title: `Laporkan kerusakan ${brk.dataset.ubroke}`, text: 'Unit masuk daftar perbaikan dan tidak dihitung di stok sampai selesai diperbaiki.', ok: 'Masukkan ke perbaikan', input: { label: 'Kerusakan apa?', required: true, error: 'Jelaskan kerusakannya.', placeholder: 'Contoh: flysheet sobek 5 cm' } });
        if (r === false) return; DB.setCare(pid, brk.dataset.ubroke, 'perbaikan', { issue: r }); toast('Unit masuk daftar perbaikan.'); draw(); return; }
      if (e.target.closest('#uAdd')) {
        const all = DB.get('products'); const p = all.find((x) => x.id === pid);
        if (DB.hasVariant(p)) { const o = p.variant.options.find((x) => x.name === m.$('#uSize').value); o.stock += 1; } else p.stock += 1;
        DB.saveProduct(p); toast('Unit baru ditambahkan.'); draw(); return; }
      if (svc) {
        const code = svc.dataset.usvc;
        const mm = modal({ title: `Perawatan berkala · ${code}`, body: `<p class="muted" style="font-size:13px;margin-bottom:10px">Pengecekan rutin setiap ${p0.serviceEvery || DB.settings().serviceEvery || 10} kali sewa. Untuk kerusakan gunakan tombol <b>Rusak</b>.</p><div class="field"><label>Yang dicek / dikerjakan</label><textarea class="textarea" id="svN" placeholder="Contoh: cek frame & pasak, lapisi ulang anti air"></textarea></div>
          <div class="grid-2"><div class="field"><label>Biaya (Rp)</label><input class="input" type="number" min="0" step="1000" id="svC" value="0"><span class="hint">Bila diisi, tercatat sebagai pengeluaran "Perawatan Alat".</span></div>
          <div class="field"><label>Kualitas setelah dicek</label><select class="select" id="svK">${DB.COND_LIST.map((c) => `<option ${c === 'Baik' ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>`,
          foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="svOk">Simpan perawatan</button>' });
        mm.$('#svOk').addEventListener('click', () => {
          const note = mm.$('#svN').value.trim(); if (!note) { mm.$('#svN').classList.add('err'); return; }
          const cost = Math.max(0, +mm.$('#svC').value || 0);
          DB.updateUnit(pid, code, { cond: mm.$('#svK').value, sinceService: 0, lastService: D.nowStamp() }, `Perawatan berkala: ${note}`, cost ? [{ field: 'Biaya', from: '', to: rupiah(cost) }] : []);
          if (cost) DB.saveFinance('out', { id: DB.nextId('EXP', DB.expenses()), date: D.today(), category: DB.financeCats('out').find((c) => /perawatan/i.test(c)) || 'Perawatan Alat', desc: `Perawatan ${code} (${p0.name}): ${note}`, amount: cost });
          mm.close(); toast('Perawatan tercatat.'); draw();
        });
      }
      if (lg) { const u = DB.units(pid).find((x) => x.code === lg.dataset.ulog);
        modal({ title: `Riwayat unit ${u.code}`, body: u.log.length ? `<ul class="timeline">${u.log.slice().reverse().map((l) => `<li>${esc(l.text)}${l.by ? ` · ${esc(l.by)}` : ''}<small>${D.fmtDateTime(l.at)}</small></li>`).join('')}</ul>` : '<p class="muted">Belum ada riwayat.</p>' }); }
      if (off) { const r = await confirmBox({ title: `Nonaktifkan unit ${off.dataset.uoff}?`, text: 'Unit tidak dihitung dalam stok dan tidak bisa disewa. Riwayatnya tetap tersimpan.', ok: 'Nonaktifkan', danger: true, input: { label: 'Alasan (mis. hilang, rusak total)', required: true, error: 'Alasan wajib diisi.' } });
        if (r === false) return; DB.updateUnit(pid, off.dataset.uoff, { status: 'nonaktif', notes: r }, `Unit dinonaktifkan: ${r}`); toast('Unit dinonaktifkan.'); draw(); }
      if (on) { DB.updateUnit(pid, on.dataset.uon, { status: 'aktif' }, 'Unit diaktifkan kembali'); draw(); }
    });
    draw();
    m.el.addEventListener('transitionend', () => {}, { once: true });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); window.dispatchEvent(new Event('units:closed')); } }); obs.observe(document.body, { childList: true });
  }
  window.addEventListener('units:closed', () => draw());
  function history(id) {
    const p = DB.product(id); const rows = [];
    DB.bookings().forEach((b) => b.items.forEach((i) => i.components.forEach((c) => { if (c.productId !== id) return;
      const q = c.qty * i.qty;
      if (b.out) rows.push({ at: b.out.at, t: 'Keluar', b, q, cond: b.out.cond });
      if (b.ret) rows.push({ at: b.ret.at, t: 'Kembali', b, q, cond: b.ret.cond });
      if (!b.out && ['dikonfirmasi', 'menunggu_konfirmasi', 'menunggu_pembayaran'].includes(b.status)) rows.push({ at: b.start, t: 'Dipesan', b, q, cond: '-' });
    })));
    rows.sort((a, b) => String(b.at).localeCompare(a.at));
    modal({ title: `Riwayat · ${esc(p.name)}`, size: 'lg', body: rows.length ? `<div class="table-wrap"><table class="table wide"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Booking</th><th>Customer</th><th class="num">Jml</th><th>Kondisi</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.at.length > 10 ? D.fmtDateTime(r.at) : D.fmtDate(r.at)}</td><td><span class="pill ${r.t === 'Keluar' ? 'amber' : r.t === 'Kembali' ? 'green' : 'blue'}">${r.t}</span></td><td>${r.b.id}</td><td>${esc(r.b.customer.name)}</td><td class="num">${r.q}</td><td>${esc(r.cond)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada riwayat penyewaan untuk barang ini.</p>' });
  }
  function catForm(c) {
    const isNew = !c; c = c || { id: '', name: '', img: 'assets/img/categories/tenda.jpg' }; let img = c.img;
    const m = modal({ title: isNew ? 'Tambah kategori' : 'Edit kategori', body: `<form id="cf" novalidate>
        <div class="field"><label>Nama kategori</label><input class="input" name="cname" value="${esc(c.name)}" placeholder="Contoh: Peralatan Masak"></div>
        <div class="field"><label>Gambar kategori</label><div style="display:flex;gap:12px;align-items:center"><img id="cPrev" src="${asset(img)}" style="width:80px;height:64px;object-fit:cover;border-radius:10px"><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Ganti gambar<input type="file" accept="image/*" id="cImg" hidden></label></div></div></form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="cSave">Simpan</button>` });
    m.$('#cImg').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; img = await fileToDataURL(f, 500); m.$('#cPrev').src = img; });
    m.$('#cSave').addEventListener('click', () => {
      const F = m.$('#cf'); if (!validate(F, { cname: (v) => (v.length < 3 ? 'Nama minimal 3 karakter.' : '') })) return;
      const name = F.elements.cname.value.trim(); const all = cats();
      if (isNew) { let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (all.some((x) => x.id === id)) id += '-' + Date.now().toString(36).slice(-3); DB.saveCategory({ id, name, img, active: true }); }
      else DB.saveCategory(Object.assign({}, c, { name, img }));
      m.close(); fillCats(); draw(); toast('Kategori disimpan.');
    });
  }

  $('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (!t) return; $$('#tabs .tab').forEach((x) => x.classList.toggle('active', x === t)); $('#pBarang').hidden = t.dataset.tab !== 'barang'; $('#pKategori').hidden = t.dataset.tab !== 'kategori'; });
  ['#q', '#fCat', '#fType', '#fStatus'].forEach((s) => $(s).addEventListener('input', draw));
  $('#quickF').addEventListener('click', (e) => { const b = e.target.closest('[data-qf]'); if (!b) return; const k = b.dataset.qf; $('#fType').value = ['care', 'full', 'lowsale'].includes(k) ? k : ''; $('#fStatus').value = k === 'off' ? 'nonaktif' : ''; draw(); });
  $('#add').addEventListener('click', () => form());
  if (Admin.isOwner) $('#addCat').addEventListener('click', () => { location.href = Admin.O('konfigurasi?s=kategori'); }); else $('#addCat').remove();
  document.querySelector('.content').addEventListener('click', async (e) => {
    const un = e.target.closest('[data-units]'); if (un) { unitsModal(un.dataset.units); return; }
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
    return { filename: `data-barang-${T}`, title: 'Data Barang & Stok', subtitle: `Posisi stok per ${D.fmtDate(T, true)}`,
      summary: [['Jenis barang', String(L.length)], ['Total unit', String(L.reduce((a, p) => a + p.stock, 0))], ['Sedang disewa', String(L.reduce((a, p) => a + Rules.rentedNow(p.id), 0)) + ' unit']],
      columns: [{ header: 'ID' }, { header: 'Nama Barang', width: 30 }, { header: 'Kategori' }, { header: 'Sewa / hari', type: 'money' }, { header: 'Harga Jual', type: 'money' }, { header: 'Stok', type: 'number' }, { header: 'Tersedia', type: 'number' }, { header: 'Disewa', type: 'number' }, { header: 'Ukuran & stok', width: 30 }, { header: 'Kondisi' }, { header: 'Status' }],
      rows: L.map((p) => [p.id, p.name, catName(p.cat), p.rent || '', p.price || '', p.stock, Rules.availableOn(p.id, T), Rules.rentedNow(p.id), DB.hasVariant(p) ? p.variant.options.map((o) => `${o.name.replace(/\s*\(.*\)/, '')}: ${o.stock}`).join(', ') : '-', p.cond, p.active === false ? 'Tidak Aktif' : 'Aktif']),
      foot: ['Total', '', '', '', '', L.reduce((a, p) => a + p.stock, 0), L.reduce((a, p) => a + Rules.availableOn(p.id, T), 0), L.reduce((a, p) => a + Rules.rentedNow(p.id), 0), '', '', ''] }; });
  fillCats();
  if (param('low')) { const ft = $('#fType'); ft.value = 'lowsale'; }
  if (param('service') || param('care')) { $('#fType').value = 'care'; }
  if (UI.param('q')) $('#q').value = UI.param('q');
  draw();
  if (param('unit') && DB.product(param('unit'))) unitsModal(param('unit'));
})();

