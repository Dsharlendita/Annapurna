(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, $$, esc, asset, param, toast, modal, confirmBox, validate, fileToDataURL } = UI;
  Admin.init('owner-konfigurasi', 'Konfigurasi Sistem');

  const SECTIONS = [
    ['kategori', 'fa-folder-tree', 'Kategori Barang', 'Kelompok barang di katalog dan form barang.'],
    ['atribut', 'fa-ruler-combined', 'Atribut Barang', 'Ukuran, warna, kapasitas, dll. per kategori.'],
    ['status', 'fa-toggle-on', 'Status / Kondisi Barang', 'Pilihan kondisi dan apakah barang bisa disewa.'],
    ['rental', 'fa-calendar-check', 'Aturan Rental', 'DP, lama sewa, jam batas pengembalian.'],
    ['batal', 'fa-rotate-left', 'Pembatalan & Refund', 'Batas H- dan persentase DP yang dikembalikan.'],
    ['denda', 'fa-gavel', 'Aturan Denda', 'Denda keterlambatan & kerusakan.'],
    ['keuangan', 'fa-wallet', 'Kategori Keuangan', 'Jenis pemasukan & pengeluaran manual.'],
    ['form', 'fa-list-check', 'Form & Field Staff', 'Isian wajib saat barang keluar & kembali.'],
    ['sop', 'fa-clipboard-list', 'SOP & Peraturan Staff', 'Standar kerja yang dibaca staff.'],
  ];
  let cur = param('s') && SECTIONS.some((x) => x[0] === param('s')) ? param('s') : 'atribut';
  const S = () => DB.settings();
  const TYPE_LABEL = { pilihan: 'Pilihan', teks: 'Teks bebas', angka: 'Angka' };
  const CTX = { umum: 'Umum', barang_keluar: 'Barang keluar', pengembalian: 'Pengembalian', pembatalan: 'Pembatalan & refund', penjualan: 'Penjualan' };
  const TONES = [['green', 'Hijau'], ['blue', 'Biru'], ['amber', 'Kuning'], ['red', 'Merah'], ['gray', 'Abu-abu']];
  const MODES = [['wajib', 'Wajib'], ['opsional', 'Opsional'], ['sembunyi', 'Sembunyikan']];
  const lines = (v) => String(v || '').split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  const catName = (id) => (DB.categories(true).find((c) => c.id === id) || { name: id }).name;
  const productsRaw = () => DB.get('products');
  const head = (t, sub, btn) => `<div class="cfg-head"><div><h2>${t}</h2><p>${sub}</p></div>${btn || ''}</div>`;
  const listEditor = (id, arr, ph) => `<div class="line-list" id="${id}">${arr.map((t) => lineRow(t, ph)).join('')}</div><button type="button" class="btn btn-light btn-sm" data-addline="${id}" data-ph="${esc(ph || '')}"><i class="fa-solid fa-plus"></i> Tambah poin</button>`;
  const lineRow = (t, ph) => `<div class="line-row"><textarea class="textarea" rows="2" placeholder="${esc(ph || '')}">${esc(t)}</textarea><button type="button" class="btn btn-light btn-xs" data-rmline title="Keluarkan poin"><i class="fa-solid fa-xmark"></i></button></div>`;
  const readLines = (id) => $$(`#${id} textarea`).map((t) => t.value.trim()).filter(Boolean);
  const saveBar = (id) => `<div class="cfg-save"><button class="btn btn-primary" id="${id}"><i class="fa-solid fa-floppy-disk"></i> Simpan perubahan</button><span class="muted">Perubahan langsung berlaku untuk staff dan website, serta tercatat di histori.</span></div>`;

  function nav() {
    $('#cfgNav').innerHTML = SECTIONS.map(([k, ic, t, d]) => `<button class="${k === cur ? 'on' : ''}" data-s="${k}"><i class="fa-solid ${ic}"></i><span><b>${t}</b><small>${d}</small></span></button>`).join('');
  }
  function go(k) { cur = k; history.replaceState(null, '', '?s=' + k); nav(); R[k](); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  const R = {
    /* ---------- Kategori ---------- */
    kategori() {
      const cats = DB.categories(true); const P = productsRaw();
      $('#cfgMain').innerHTML = head('Kategori Barang', 'Kategori tampil di katalog customer dan dipakai untuk menentukan atribut apa saja yang muncul di form barang.', '<button class="btn btn-primary btn-sm" id="addCat"><i class="fa-solid fa-plus"></i> Tambah kategori</button>')
        + `<div class="cfg-cards">${cats.map((c) => { const n = P.filter((p) => p.cat === c.id).length; const at = DB.attrsForCat(c.id); const off = c.active === false;
          return `<article class="cfg-card ${off ? 'row-off' : ''}"><img src="${asset(c.img)}" alt=""><div class="cc-bd"><strong>${esc(c.name)}</strong>${off ? ' <span class="pill gray plain">Tidak aktif</span>' : ''}<small>${n} barang</small>
            <div class="chips">${at.length ? at.map((a) => `<span class="${a.variant ? 'v' : ''}">${esc(a.name)}</span>`).join('') : '<span class="none">Tanpa atribut</span>'}</div></div>
            <div class="cc-act"><button class="btn btn-light btn-xs" data-cedit="${c.id}"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn btn-light btn-xs" data-ctoggle="${c.id}">${off ? 'Aktifkan' : 'Nonaktifkan'}</button></div></article>`; }).join('')}</div>`;
      $('#addCat').addEventListener('click', () => catForm());
    },
    /* ---------- Atribut ---------- */
    atribut() {
      const A = DB.attributes(true); const P = productsRaw();
      $('#cfgMain').innerHTML = head('Atribut Barang', 'Contoh: jaket awalnya tanpa ukuran, lalu Owner menambah atribut "Ukuran" untuk kategori Jaket — form barang staff langsung menampilkan pilihan S, M, L, XL tanpa mengubah kode.', '<button class="btn btn-primary btn-sm" id="addAt"><i class="fa-solid fa-plus"></i> Tambah atribut</button>')
        + `<div class="notice" style="margin-bottom:16px"><i class="fa-solid fa-circle-info"></i><div><strong>Varian stok</strong> = stok dihitung per nilai (misalnya stok jaket M dan L terpisah) dan customer wajib memilih nilainya saat menyewa/membeli. Atribut biasa hanya menjadi informasi di halaman produk.</div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Atribut</th><th>Nilai</th><th>Berlaku untuk</th><th>Dipakai</th><th class="num">Aksi</th></tr></thead><tbody>
        ${A.map((a) => { const used = P.filter((p) => (p.variant && p.variant.attrId === a.id) || (p.attrs && p.attrs[a.id])).length; const off = a.active === false;
          return `<tr class="${off ? 'row-off' : ''}"><td><strong>${esc(a.name)}</strong><small>${TYPE_LABEL[a.type]}${a.variant ? ' · <b style="color:var(--g700)">Varian stok</b>' : ''}${a.required ? ' · wajib diisi' : ''}${off ? ' · <b>nonaktif</b>' : ''}</small></td>
            <td style="max-width:280px"><div class="chips">${a.type === 'pilihan' ? a.values.map((v) => `<span>${esc(v)}</span>`).join('') : `<span class="none">Diisi bebas (${TYPE_LABEL[a.type].toLowerCase()})</span>`}</div></td>
            <td>${(a.cats || []).length ? a.cats.map(catName).map(esc).join(', ') : 'Semua kategori'}</td><td>${used} barang</td>
            <td><div class="acts"><button class="btn btn-light btn-xs" data-aedit="${a.id}"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn btn-light btn-xs" data-atoggle="${a.id}">${off ? 'Aktifkan' : 'Nonaktifkan'}</button></div></td></tr>`; }).join('')}
        </tbody></table></div>`;
      $('#addAt').addEventListener('click', () => attrForm());
    },
    /* ---------- Status ---------- */
    status() {
      const L = DB.conditions().map((c) => Object.assign({}, c)); const P = productsRaw();
      const draw = () => {
        $('#condRows').innerHTML = L.map((c, i) => { const used = P.filter((p) => p.cond === c.name).length; return `<div class="cond-row">
          <input class="input" data-cn="${i}" value="${esc(c.name)}" ${used ? 'readonly title="Sedang dipakai barang, nama tidak bisa diubah"' : ''}>
          <label class="switch"><input type="checkbox" data-cr="${i}" ${c.rentable !== false ? 'checked' : ''}><span></span> Bisa disewa</label>
          <select class="select" data-ct="${i}">${TONES.map(([k, l]) => `<option value="${k}" ${c.tone === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="pill ${c.tone}">${esc(c.name || '…')}</span><span class="muted" style="font-size:12.5px">${used} barang</span>
          ${used ? '<span></span>' : `<button type="button" class="btn btn-light btn-xs" data-crm="${i}" title="Keluarkan"><i class="fa-solid fa-xmark"></i></button>`}</div>`; }).join('');
      };
      $('#cfgMain').innerHTML = head('Status / Kondisi Barang', 'Pilihan kondisi di form barang. Kondisi yang tidak "bisa disewa" (misalnya Dicuci, Rusak) otomatis membuat barang tidak bisa dibooking customer sampai kondisinya diubah.', '<button class="btn btn-light btn-sm" id="addCond"><i class="fa-solid fa-plus"></i> Tambah status</button>')
        + `<div class="panel"><div id="condRows" class="cond-list"></div></div>${saveBar('saveCond')}`;
      draw();
      $('#condRows').addEventListener('input', (e) => { const t = e.target; if (t.dataset.cn != null) L[+t.dataset.cn].name = t.value; if (t.dataset.ct != null) { L[+t.dataset.ct].tone = t.value; draw(); } if (t.dataset.cr != null) L[+t.dataset.cr].rentable = t.checked; });
      $('#condRows').addEventListener('click', (e) => { const r = e.target.closest('[data-crm]'); if (r) { L.splice(+r.dataset.crm, 1); draw(); } });
      $('#addCond').addEventListener('click', () => { L.push({ name: '', rentable: true, tone: 'gray' }); draw(); const ins = $$('[data-cn]'); ins[ins.length - 1].focus(); });
      $('#saveCond').addEventListener('click', () => {
        const clean = L.map((c) => Object.assign({}, c, { name: c.name.trim() })).filter((c) => c.name);
        if (new Set(clean.map((c) => c.name.toLowerCase())).size !== clean.length) { toast('Ada nama status yang sama.', 'err'); return; }
        if (!clean.some((c) => c.rentable)) { toast('Minimal satu status harus bisa disewa.', 'err'); return; }
        const old = DB.conditions();
        const fmt = (l) => l.map((c) => `${c.name}${c.rentable ? '' : ' (tidak disewakan)'}`).join(', ');
        if (fmt(old) === fmt(clean) && JSON.stringify(old) === JSON.stringify(clean)) { toast('Tidak ada perubahan.'); return; }
        DB.saveConfig('conditions', clean, 'Mengubah daftar status / kondisi barang', [{ field: 'Status barang', from: fmt(old), to: fmt(clean) }]);
        toast('Status barang disimpan.'); R.status();
      });
    },
    /* ---------- Aturan rental ---------- */
    rental() {
      const st = S();
      $('#cfgMain').innerHTML = head('Aturan Rental', 'Dipakai otomatis saat customer booking, di keranjang, nota, dan halaman Tentang Kami.') + `<div class="panel"><form id="rf" novalidate>
        <div class="grid-3">
          <div class="field"><label>Minimal DP (%)</label><input class="input" type="number" min="10" max="100" name="dpPercent" value="${st.dpPercent}"><span class="hint">Dibayar customer untuk mengunci booking.</span></div>
          <div class="field"><label>Maksimal lama sewa (hari)</label><input class="input" type="number" min="1" max="60" name="maxRentDays" value="${st.maxRentDays || 14}"></div>
          <div class="field"><label>Jam batas pengembalian</label><input class="input" type="time" name="returnTime" value="${st.returnTime || '18:00'}"></div>
        </div>
        <label class="chk-line" style="margin-top:0"><input type="checkbox" name="lateAfterReturnTime" ${st.lateAfterReturnTime ? 'checked' : ''}> Barang yang kembali di hari terakhir <b>setelah jam batas</b> dihitung terlambat 1 hari</label>
        <h4 class="cfg-sub">Ketentuan rental (tampil di website)</h4>${listEditor('terms', st.rentalTerms, 'Contoh: Penyewa wajib menyerahkan KTP asli')}
      </form></div>${saveBar('saveRental')}`;
      $('#saveRental').addEventListener('click', () => {
        const F = $('#rf'), E = F.elements;
        if (!validate(F, { dpPercent: (v) => (!(+v >= 10 && +v <= 100) ? 'Isi 10–100.' : ''), maxRentDays: (v) => (!(+v >= 1) ? 'Minimal 1.' : ''), returnTime: (v) => (!v ? 'Isi jam.' : '') })) return;
        const next = Object.assign({}, S(), { dpPercent: +E.dpPercent.value, maxRentDays: +E.maxRentDays.value, returnTime: E.returnTime.value, lateAfterReturnTime: E.lateAfterReturnTime.checked, rentalTerms: readLines('terms') });
        cfgSave(next, 'Mengubah aturan rental', [['dpPercent', 'Minimal DP (%)'], ['maxRentDays', 'Maksimal lama sewa (hari)'], ['returnTime', 'Jam batas pengembalian'], ['lateAfterReturnTime', 'Terlambat bila lewat jam batas', (v) => (v ? 'Ya' : 'Tidak')], ['rentalTerms', 'Ketentuan rental', (v) => `${v.length} poin`]]);
      });
    },
    batal() {
      const st = S();
      $('#cfgMain').innerHTML = head('Pembatalan & Refund', 'Dipakai saat customer membatalkan booking dan saat staff memproses refund.') + `<div class="panel"><form id="bf" novalidate>
        <div class="grid-2">
          <div class="field"><label>Batas pembatalan dengan refund (H-)</label><input class="input" type="number" min="0" max="30" name="cancelDays" value="${st.cancelDays}"><span class="hint">Batal paling lambat H-${st.cancelDays}: DP dikembalikan. Kurang dari itu: DP hangus.</span></div>
          <div class="field"><label>DP yang dikembalikan (%)</label><input class="input" type="number" min="0" max="100" name="refundPercent" value="${st.refundPercent ?? 100}"><span class="hint">100 = dikembalikan penuh.</span></div>
        </div>
        <h4 class="cfg-sub">Kebijakan pembatalan (tampil di website)</h4>${listEditor('policy', st.cancelPolicy, 'Contoh: Pembatalan paling lambat H-2 …')}
      </form></div>${saveBar('saveBatal')}`;
      $('#saveBatal').addEventListener('click', () => {
        const F = $('#bf'), E = F.elements;
        if (!validate(F, { cancelDays: (v) => (v === '' || +v < 0 ? 'Tidak valid.' : ''), refundPercent: (v) => (!(+v >= 0 && +v <= 100) ? 'Isi 0–100.' : '') })) return;
        cfgSave(Object.assign({}, S(), { cancelDays: +E.cancelDays.value, refundPercent: +E.refundPercent.value, cancelPolicy: readLines('policy') }), 'Mengubah aturan pembatalan & refund',
          [['cancelDays', 'Batas refund (H-)'], ['refundPercent', 'DP dikembalikan (%)'], ['cancelPolicy', 'Kebijakan pembatalan', (v) => `${v.length} poin`]]);
      });
    },
    denda() {
      const st = S();
      $('#cfgMain').innerHTML = head('Aturan Denda', 'Dihitung otomatis saat staff memproses pengembalian barang.') + `<div class="panel"><form id="df" novalidate>
        <div class="field"><label>Cara menghitung denda keterlambatan</label><div class="seg-pick">
          <label><input type="radio" name="lateFeeMode" value="persen" ${st.lateFeeMode !== 'nominal' ? 'checked' : ''}><span><b>Persentase harga sewa</b><small>Contoh 100% = denda sama dengan harga sewa per hari</small></span></label>
          <label><input type="radio" name="lateFeeMode" value="nominal" ${st.lateFeeMode === 'nominal' ? 'checked' : ''}><span><b>Nominal tetap</b><small>Contoh Rp20.000 per barang per hari</small></span></label></div></div>
        <div class="grid-2">
          <div class="field" id="fPct"><label>Persentase (% harga sewa / hari)</label><input class="input" type="number" min="0" max="300" name="lateFeePercent" value="${st.lateFeePercent}"></div>
          <div class="field" id="fAmt"><label>Nominal (Rp / barang / hari)</label><input class="input" type="number" min="0" step="1000" name="lateFeeAmount" value="${st.lateFeeAmount || 0}"></div>
        </div>
        <div class="notice green" id="dPrev"></div>
        <h4 class="cfg-sub">Aturan kerusakan & kehilangan</h4>${listEditor('dmg', st.damageRules || [], 'Contoh: Hilang = mengganti 100% harga barang')}
      </form></div>${saveBar('saveDenda')}`;
      const F = $('#df'), E = F.elements;
      const prev = () => { const nom = E.lateFeeMode.value === 'nominal'; $('#fPct').hidden = nom; $('#fAmt').hidden = !nom;
        $('#dPrev').innerHTML = `<i class="fa-solid fa-calculator"></i><div>Contoh: menyewa 2 barang @ ${rupiah(50000)}/hari, terlambat 1 hari → denda <strong>${rupiah(nom ? (+E.lateFeeAmount.value || 0) * 2 : 100000 * (+E.lateFeePercent.value || 0) / 100)}</strong>.</div>`; };
      F.addEventListener('input', prev); prev();
      $('#saveDenda').addEventListener('click', () => {
        cfgSave(Object.assign({}, S(), { lateFeeMode: E.lateFeeMode.value, lateFeePercent: +E.lateFeePercent.value || 0, lateFeeAmount: +E.lateFeeAmount.value || 0, damageRules: readLines('dmg') }), 'Mengubah aturan denda',
          [['lateFeeMode', 'Cara hitung denda', (v) => (v === 'nominal' ? 'Nominal tetap' : 'Persentase')], ['lateFeePercent', 'Denda (%)'], ['lateFeeAmount', 'Denda nominal', rupiah], ['damageRules', 'Aturan kerusakan', (v) => `${v.length} poin`]]);
      });
    },
    keuangan() {
      const fc = S().financeCats || { in: [], out: [] };
      const box = (k, t, arr) => `<div class="panel"><div class="panel-h"><h3>${t}</h3></div><p class="muted" style="font-size:13px;margin:-6px 0 12px">Satu kategori per baris.</p><textarea class="textarea" id="fc-${k}" rows="8">${esc(arr.join('\n'))}</textarea></div>`;
      $('#cfgMain').innerHTML = head('Kategori Keuangan', 'Pilihan kategori saat staff mencatat pemasukan lain dan pengeluaran. Pemasukan dari rental, penjualan, denda, dan refund tetap tercatat otomatis.')
        + `<div class="grid-dash" style="grid-template-columns:1fr 1fr">${box('in', 'Pemasukan lainnya', fc.in)}${box('out', 'Pengeluaran', fc.out)}</div>${saveBar('saveFc')}`;
      $('#saveFc').addEventListener('click', () => {
        const next = { in: [...new Set(lines($('#fc-in').value.replace(/,/g, '\n')))], out: [...new Set(lines($('#fc-out').value.replace(/,/g, '\n')))] };
        if (!next.in.length || !next.out.length) { toast('Masing-masing minimal satu kategori.', 'err'); return; }
        const ch = []; ['in', 'out'].forEach((k) => { if (fc[k].join('|') !== next[k].join('|')) ch.push({ field: k === 'in' ? 'Kategori pemasukan' : 'Kategori pengeluaran', from: fc[k].join(', '), to: next[k].join(', ') }); });
        if (!ch.length) { toast('Tidak ada perubahan.'); return; }
        DB.saveConfig('financeCats', next, 'Mengubah kategori keuangan', ch); toast('Kategori keuangan disimpan.'); R.keuangan();
      });
    },
    /* ---------- Form & field ---------- */
    form() {
      const f = JSON.parse(JSON.stringify(S().forms || {}));
      f.pickup = Object.assign({ note: 'opsional', photo: 'opsional', idCard: 'wajib', custom: [] }, f.pickup);
      f.return = Object.assign({ note: 'opsional', photo: 'opsional', custom: [] }, f.return);
      const BUILT = { pickup: [['idCard', 'Identitas jaminan (KTP/KTM/SIM)'], ['photo', 'Foto barang saat keluar'], ['note', 'Catatan']], return: [['photo', 'Foto kondisi barang'], ['note', 'Catatan pemeriksaan']] };
      const FIX = { pickup: ['Kondisi barang saat keluar', 'Pelunasan diterima'], return: ['Tanggal & jam kembali', 'Kondisi barang', 'Biaya kerusakan'] };
      const TYPES = [['teks', 'Teks'], ['angka', 'Angka'], ['pilihan', 'Pilihan'], ['centang', 'Centang (konfirmasi)'], ['foto', 'Foto']];
      const card = (k, t) => `<div class="panel form-cfg"><div class="panel-h"><h3>${t}</h3></div>
        <div class="fc-list">${FIX[k].map((n) => `<div class="fc-row"><span>${n}</span><span class="pill green plain">Selalu wajib</span></div>`).join('')}
        ${BUILT[k].map(([key, n]) => `<div class="fc-row"><span>${n}</span><div class="seg sm">${MODES.map(([m, l]) => `<button type="button" data-f="${k}|${key}|${m}" class="${f[k][key] === m ? 'active' : ''}">${l}</button>`).join('')}</div></div>`).join('')}</div>
        <h4 class="cfg-sub">Field tambahan</h4>
        <div class="fc-custom" id="cust-${k}">${f[k].custom.map((c, i) => `<div class="fc-crow" data-k="${k}" data-i="${i}">
          <input class="input" data-cf="label" value="${esc(c.label)}" placeholder="Nama field, contoh: Nomor segel tas">
          <select class="select" data-cf="type">${TYPES.map(([v, l]) => `<option value="${v}" ${c.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input class="input" data-cf="options" value="${esc((c.options || []).join(', '))}" placeholder="Pilihan, pisahkan koma" ${c.type === 'pilihan' ? '' : 'hidden'}>
          <label class="switch"><input type="checkbox" data-cf="required" ${c.required ? 'checked' : ''}><span></span> Wajib</label>
          <button type="button" class="btn btn-light btn-xs" data-crmf="${k}|${i}" title="Keluarkan field"><i class="fa-solid fa-xmark"></i></button></div>`).join('') || '<p class="muted" style="font-size:13px">Belum ada field tambahan.</p>'}</div>
        <button type="button" class="btn btn-light btn-sm" data-addf="${k}"><i class="fa-solid fa-plus"></i> Tambah field</button></div>`;
      const draw = () => { $('#formCards').innerHTML = card('pickup', '<i class="fa-solid fa-box-open" style="color:var(--g600)"></i> Barang keluar') + card('return', '<i class="fa-solid fa-rotate-left" style="color:var(--g600)"></i> Pengembalian barang'); };
      $('#cfgMain').innerHTML = head('Form & Field Staff', 'Tentukan isian yang wajib diisi staff sesuai SOP toko. Contoh: setiap barang kembali wajib ada foto kondisi barang.')
        + `<div class="grid-dash" style="grid-template-columns:1fr 1fr" id="formCards"></div>${saveBar('saveForm')}`;
      draw();
      const box = $('#formCards');
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-f]'); if (b) { const [k, key, m] = b.dataset.f.split('|'); f[k][key] = m; draw(); return; }
        const a = e.target.closest('[data-addf]'); if (a) { f[a.dataset.addf].custom.push({ id: 'f-' + Date.now().toString(36), label: '', type: 'teks', required: false }); draw(); return; }
        const r = e.target.closest('[data-crmf]'); if (r) { const [k, i] = r.dataset.crmf.split('|'); f[k].custom.splice(+i, 1); draw(); }
      });
      box.addEventListener('input', (e) => {
        const row = e.target.closest('.fc-crow'); if (!row) return; const c = f[row.dataset.k].custom[+row.dataset.i]; const key = e.target.dataset.cf;
        if (key === 'label') c.label = e.target.value; if (key === 'required') c.required = e.target.checked;
        if (key === 'options') c.options = lines(e.target.value);
        if (key === 'type') { c.type = e.target.value; draw(); }
      });
      $('#saveForm').addEventListener('click', () => {
        for (const k of ['pickup', 'return']) { f[k].custom = f[k].custom.filter((c) => c.label.trim()).map((c) => Object.assign({}, c, { label: c.label.trim() }));
          if (f[k].custom.some((c) => c.type === 'pilihan' && !(c.options || []).length)) { toast('Field bertipe pilihan harus punya daftar pilihan.', 'err'); return; } }
        const old = S().forms || {}; const KL = { note: 'Catatan', photo: 'Foto', idCard: 'Identitas jaminan' }; const desc = (x) => { const o = x || {}; return [...Object.entries(o).filter(([k]) => k !== 'custom').map(([k, v]) => `${KL[k] || k}: ${v}`), ...(o.custom || []).map((c) => `+${c.label}${c.required ? '*' : ''}`)].join(', '); };
        const ch = [['pickup', 'Form barang keluar'], ['return', 'Form pengembalian']].filter(([k]) => desc(old[k]) !== desc(f[k])).map(([k, l]) => ({ field: l, from: desc(old[k]), to: desc(f[k]) }));
        if (!ch.length) { toast('Tidak ada perubahan.'); return; }
        DB.saveConfig('forms', f, 'Mengubah form & field staff', ch); toast('Form staff disimpan.'); R.form();
      });
    },
    /* ---------- SOP ---------- */
    sop() {
      const L = DB.sops();
      $('#cfgMain').innerHTML = head('SOP & Peraturan Staff', 'Tampil di menu SOP staff, di dashboard (yang disematkan), dan otomatis muncul di form terkait (misalnya SOP pengembalian saat staff memproses pengembalian).', '<button class="btn btn-primary btn-sm" id="addSop"><i class="fa-solid fa-plus"></i> Tambah SOP</button>')
        + `<div class="sop-list">${L.map((x) => `<article class="sop-card ${x.active === false ? 'row-off' : ''}"><div class="sop-h"><span class="pill blue plain">${CTX[x.context] || x.context}</span>${x.pinned ? '<span class="pill amber plain"><i class="fa-solid fa-thumbtack"></i> Disematkan</span>' : ''}${x.active === false ? '<span class="pill gray plain">Diarsipkan</span>' : ''}</div>
          <h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><div class="acts" style="justify-content:flex-start"><button class="btn btn-light btn-xs" data-sedit="${x.id}"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn btn-light btn-xs" data-stoggle="${x.id}">${x.active === false ? 'Aktifkan' : 'Arsipkan'}</button></div></article>`).join('') || '<p class="muted">Belum ada SOP.</p>'}</div>`;
      $('#addSop').addEventListener('click', () => sopForm());
    },
  };

  function cfgSave(next, action, fields) {
    const old = S(); const ch = fields.filter(([k]) => JSON.stringify(old[k]) !== JSON.stringify(next[k])).map(([k, l, f]) => ({ field: l, from: f ? f(old[k] ?? '') : String(old[k] ?? ''), to: f ? f(next[k]) : String(next[k]) }));
    if (!ch.length) { toast('Tidak ada perubahan.'); return; }
    DB.set('settings', next); DB.audit({ type: 'konfigurasi', action, changes: ch }); toast('Konfigurasi disimpan.'); R[cur]();
  }

  function catForm(c) {
    const isNew = !c; c = c || { id: '', name: '', img: 'assets/img/categories/tenda.jpg', active: true }; let img = c.img;
    const m = modal({ title: isNew ? 'Tambah kategori' : 'Edit kategori', body: `<form id="cf" novalidate>
      <div class="field"><label>Nama kategori</label><input class="input" name="cname" value="${esc(c.name)}" placeholder="Contoh: Peralatan Hiking"></div>
      <div class="field"><label>Gambar kategori</label><div style="display:flex;gap:12px;align-items:center"><img id="cPrev" src="${asset(img)}" style="width:90px;height:70px;object-fit:cover;border-radius:10px"><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Ganti gambar<input type="file" accept="image/*" id="cImg" hidden></label></div></div>
      <p class="muted" style="font-size:12.5px">Atribut untuk kategori ini diatur di bagian <b>Atribut Barang</b>.</p></form>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="cSave">Simpan</button>' });
    m.$('#cImg').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; img = await fileToDataURL(f, 500); m.$('#cPrev').src = img; });
    m.$('#cSave').addEventListener('click', () => {
      const F = m.$('#cf'); if (!validate(F, { cname: (v) => (v.length < 3 ? 'Nama minimal 3 karakter.' : '') })) return;
      const name = F.elements.cname.value.trim();
      if (isNew) { let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (DB.categories(true).some((x) => x.id === id)) id += '-' + Date.now().toString(36).slice(-3); DB.saveCategory({ id, name, img, active: true }); }
      else DB.saveCategory(Object.assign({}, c, { name, img }));
      m.close(); toast('Kategori disimpan.'); R.kategori();
    });
  }

  function attrForm(a) {
    const isNew = !a; a = a ? JSON.parse(JSON.stringify(a)) : { id: '', name: '', type: 'pilihan', values: [], variant: false, cats: [], required: false, active: true };
    const P = productsRaw(); const cats = DB.categories(true);
    const usedVals = (v) => P.filter((p) => (p.variant && p.variant.attrId === a.id && p.variant.options.some((o) => o.name === v)) || (p.attrs && p.attrs[a.id] === v)).length;
    const m = modal({ title: isNew ? 'Tambah atribut barang' : `Edit atribut · ${esc(a.name)}`, size: 'lg', body: `<form id="af" novalidate>
      <div class="grid-2"><div class="field"><label>Nama atribut</label><input class="input" name="aname" value="${esc(a.name)}" placeholder="Contoh: Ukuran, Warna, Kapasitas"></div>
      <div class="field"><label>Tipe</label><select class="select" name="atype">${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="field" id="valF"><label>Nilai pilihan</label><div class="tag-input" id="tags"></div><input class="input" id="tagIn" placeholder="Ketik nilai lalu Enter (contoh: S, M, L, XL)"><span class="hint">Nilai yang sudah dipakai barang tidak bisa dikeluarkan.</span></div>
      <div class="field"><label>Berlaku untuk kategori</label><div class="cat-checks">${cats.map((c) => `<label><input type="checkbox" value="${c.id}" ${(a.cats || []).includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div><span class="hint">Tidak dicentang semua = berlaku untuk semua kategori.</span></div>
      <label class="chk-line" id="varF"><input type="checkbox" name="avariant" ${a.variant ? 'checked' : ''}> <span><b>Jadikan varian stok</b> — stok dihitung per nilai dan customer wajib memilih saat menyewa/membeli</span></label>
      <label class="chk-line"><input type="checkbox" name="areq" ${a.required ? 'checked' : ''}> Wajib diisi staff saat menambah / mengedit barang di kategori tersebut</label>
      </form>`, foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="aSave"><i class="fa-solid fa-floppy-disk"></i> Simpan atribut</button>' });
    const F = m.$('#af'), E = F.elements;
    const drawTags = () => {
      const pil = E.atype.value === 'pilihan'; m.$('#valF').hidden = !pil; m.$('#varF').hidden = !pil; if (!pil) E.avariant.checked = false;
      m.$('#tags').innerHTML = a.values.map((v, i) => { const u = a.id ? usedVals(v) : 0; return `<span class="tag">${esc(v)}${u ? `<small>${u}</small>` : `<button type="button" data-tr="${i}" aria-label="Keluarkan ${esc(v)}">×</button>`}</span>`; }).join('') || '<span class="muted" style="font-size:12.5px">Belum ada nilai.</span>';
    };
    const addTags = () => { lines(m.$('#tagIn').value).forEach((v) => { if (!a.values.some((x) => x.toLowerCase() === v.toLowerCase())) a.values.push(v); }); m.$('#tagIn').value = ''; drawTags(); };
    m.$('#tagIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(); } });
    m.$('#tagIn').addEventListener('blur', addTags);
    m.$('#tags').addEventListener('click', (e) => { const b = e.target.closest('[data-tr]'); if (b) { a.values.splice(+b.dataset.tr, 1); drawTags(); } });
    E.atype.addEventListener('change', drawTags); drawTags();
    m.$('#aSave').addEventListener('click', () => {
      addTags();
      if (!validate(F, { aname: (v) => (v.length < 2 ? 'Isi nama atribut.' : DB.attributes(true).some((x) => x.id !== a.id && x.name.toLowerCase() === v.toLowerCase()) ? 'Nama atribut sudah ada.' : '') })) return;
      if (E.atype.value === 'pilihan' && !a.values.length) { toast('Isi minimal satu nilai pilihan.', 'err'); return; }
      const next = Object.assign({}, a, { id: a.id || 'at-' + Date.now().toString(36), name: E.aname.value.trim(), type: E.atype.value, values: E.atype.value === 'pilihan' ? a.values : [],
        cats: m.$$('.cat-checks input:checked').map((x) => x.value), variant: E.atype.value === 'pilihan' && E.avariant.checked, required: E.areq.checked });
      const all = DB.attributes(true); const i = all.findIndex((x) => x.id === next.id); const old = i >= 0 ? all[i] : null;
      if (old && old.variant && !next.variant && P.some((p) => p.variant && p.variant.attrId === old.id)) { toast('Atribut ini masih dipakai sebagai varian stok barang, tidak bisa diubah jadi atribut biasa.', 'err'); return; }
      if (i >= 0) all[i] = next; else all.push(next);
      const ch = old ? [['name', 'Nama'], ['type', 'Tipe'], ['values', 'Nilai'], ['cats', 'Kategori'], ['variant', 'Varian stok'], ['required', 'Wajib']].filter(([k]) => JSON.stringify(old[k]) !== JSON.stringify(next[k]))
        .map(([k, l]) => ({ field: l, from: fmtA(k, old[k]), to: fmtA(k, next[k]) })) : [{ field: 'Nilai', from: '', to: next.values.join(', ') || TYPE_LABEL[next.type] }, { field: 'Kategori', from: '', to: fmtA('cats', next.cats) }];
      DB.saveConfig('attributes', all, `${old ? 'Mengubah' : 'Menambahkan'} atribut barang "${next.name}"`, ch);
      if (old && old.name !== next.name) { const prods = productsRaw(); prods.forEach((p) => { if (p.variant && p.variant.attrId === next.id) p.variant.label = next.name; }); DB.set('products', prods); }
      m.close(); toast('Atribut disimpan.'); R.atribut();
    });
  }
  const fmtA = (k, v) => (k === 'cats' ? ((v || []).length ? v.map(catName).join(', ') : 'Semua kategori') : k === 'values' ? (v || []).join(', ') : typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : String(v ?? ''));

  function sopForm(x) {
    const isNew = !x; x = x || { id: '', title: '', body: '', context: 'umum', pinned: false, active: true };
    const m = modal({ title: isNew ? 'Tambah SOP / peraturan' : 'Edit SOP', size: 'lg', body: `<form id="sf" novalidate>
      <div class="field"><label>Judul</label><input class="input" name="stitle" value="${esc(x.title)}" placeholder="Contoh: Peraturan Barang Keluar"></div>
      <div class="grid-2"><div class="field"><label>Berlaku saat</label><select class="select" name="sctx">${Object.entries(CTX).map(([k, l]) => `<option value="${k}" ${x.context === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint">SOP otomatis ditampilkan di form yang sesuai.</span></div>
      <div class="field"><label>&nbsp;</label><label class="chk-line" style="margin-top:8px"><input type="checkbox" name="spin" ${x.pinned ? 'checked' : ''}> Sematkan di dashboard staff</label></div></div>
      <div class="field"><label>Isi peraturan</label><textarea class="textarea" name="sbody" rows="6" placeholder="Tuliskan langkah atau aturan yang harus diikuti staff">${esc(x.body)}</textarea></div></form>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="sSave">Simpan SOP</button>' });
    m.$('#sSave').addEventListener('click', () => {
      const F = m.$('#sf'), E = F.elements;
      if (!validate(F, { stitle: (v) => (v.length < 3 ? 'Isi judul.' : ''), sbody: (v) => (v.length < 10 ? 'Isi peraturan minimal 10 karakter.' : '') })) return;
      const all = DB.sops(); const next = Object.assign({}, x, { id: x.id || 'sop-' + Date.now().toString(36), title: E.stitle.value.trim(), body: E.sbody.value.trim(), context: E.sctx.value, pinned: E.spin.checked });
      const i = all.findIndex((y) => y.id === next.id); if (i >= 0) all[i] = next; else all.push(next);
      DB.saveConfig('sops', all, `${isNew ? 'Menambahkan' : 'Mengubah'} SOP "${next.title}"`, isNew ? [{ field: 'Berlaku saat', from: '', to: CTX[next.context] }] : [{ field: 'Isi', from: x.body.slice(0, 60), to: next.body.slice(0, 60) }]);
      if (!isNew || true) DB.notifyStaff(`SOP ${isNew ? 'baru' : 'diperbarui'}: ${next.title}`, 'Owner memperbarui standar kerja. Baca di menu SOP & Peraturan.', 'admin/sop');
      m.close(); toast('SOP disimpan dan staff diberi notifikasi.'); R.sop();
    });
  }

  $('#cfgNav').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); });
  $('#cfgMain').addEventListener('click', async (e) => {
    const t = e.target;
    const al = t.closest('[data-addline]'); if (al) { $('#' + al.dataset.addline).insertAdjacentHTML('beforeend', lineRow('', al.dataset.ph)); $('#' + al.dataset.addline).lastElementChild.querySelector('textarea').focus(); return; }
    if (t.closest('[data-rmline]')) { t.closest('.line-row').remove(); return; }
    const ce = t.closest('[data-cedit]'); if (ce) catForm(DB.categories(true).find((c) => c.id === ce.dataset.cedit));
    const ct = t.closest('[data-ctoggle]'); if (ct) { const c = DB.categories(true).find((x) => x.id === ct.dataset.ctoggle); const off = c.active === false;
      if (await confirmBox(off ? { title: `Aktifkan ${esc(c.name)}?`, text: 'Kategori tampil lagi di website.', ok: 'Aktifkan' } : { title: `Nonaktifkan ${esc(c.name)}?`, text: 'Kategori dan barang di dalamnya disembunyikan dari website. Tidak ada data yang dihapus.', ok: 'Nonaktifkan' })) { DB.saveCategory(Object.assign({}, c, { active: off })); R.kategori(); } }
    const ae = t.closest('[data-aedit]'); if (ae) attrForm(DB.attributes(true).find((a) => a.id === ae.dataset.aedit));
    const at = t.closest('[data-atoggle]'); if (at) { const all = DB.attributes(true); const a = all.find((x) => x.id === at.dataset.atoggle); const off = a.active === false;
      if (!off && productsRaw().some((p) => p.variant && p.variant.attrId === a.id) && !(await confirmBox({ title: `Nonaktifkan "${esc(a.name)}"?`, text: 'Atribut tidak muncul lagi di form barang baru. Barang yang sudah memakai atribut ini tetap memakai stok per nilainya.', ok: 'Nonaktifkan' }))) return;
      a.active = off; DB.saveConfig('attributes', all, `${off ? 'Mengaktifkan' : 'Menonaktifkan'} atribut barang "${a.name}"`, [{ field: 'Status', from: off ? 'Nonaktif' : 'Aktif', to: off ? 'Aktif' : 'Nonaktif' }]); R.atribut(); }
    const se = t.closest('[data-sedit]'); if (se) sopForm(DB.sops().find((x) => x.id === se.dataset.sedit));
    const st = t.closest('[data-stoggle]'); if (st) { const all = DB.sops(); const x = all.find((y) => y.id === st.dataset.stoggle); const off = x.active === false; x.active = off;
      DB.saveConfig('sops', all, `${off ? 'Mengaktifkan kembali' : 'Mengarsipkan'} SOP "${x.title}"`, []); R.sop(); }
  });
  nav(); R[cur]();
})();
