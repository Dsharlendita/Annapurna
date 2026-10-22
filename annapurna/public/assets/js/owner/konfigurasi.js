(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah, Svc } = Ann;
  const { $, $$, esc, asset, param, toast, modal, confirmBox, validate, fileToDataURL } = UI;
  Admin.init('owner-konfigurasi', 'Konfigurasi Sistem');

  const SECTIONS = [
    ['kategori', 'fa-folder-tree', 'Kategori Barang', 'Kelompok barang di katalog dan form barang.'],
    ['atribut', 'fa-ruler-combined', 'Atribut Barang', 'Ukuran, warna, kapasitas, dll. per kategori.'],
    ['status', 'fa-toggle-on', 'Kualitas Barang', 'Pilihan kualitas (Sangat Baik, Baik, …).'],
    ['rental', 'fa-calendar-check', 'Aturan Rental', 'DP, aturan durasi & harga paket, jam batas pengembalian.'],
    ['beranda', 'fa-fire', 'Tampilan Beranda', 'Produk Rental Terlaris & tata cara sewa/beli.'],
    ['nota', 'fa-receipt', 'Nota & Struk', 'Ukuran kertas struk kasir & pesan penutup.'],
    ['pesan', 'fa-comment-dots', 'Template Pesan WhatsApp', 'Pesan otomatis ke customer: invoice, nota sewa, pengingat, laundry.'],
    ['asisten', 'fa-comments', 'Asisten Trip (Tanya jawab)', 'Aturan JIKA–MAKA chatbot, kata kunci & jawaban, pertanyaan belum terjawab.'],
    ['layanan', 'fa-jug-detergent', 'Laundry & Jasa Tenda', 'Harga laundry, estimasi selesai, ketentuan struk, tarif jasa tenda.'],
    ['sesi', 'fa-user-clock', 'Sesi Staff', 'Logout otomatis (default nonaktif).'],
    ['batal', 'fa-rotate-left', 'Pembatalan & Refund', 'Batas H- dan persentase DP yang dikembalikan.'],
    ['denda', 'fa-gavel', 'Aturan Denda', 'Denda keterlambatan & kerusakan.'],
    ['stok', 'fa-soap', 'Perawatan & Stok', 'Wajib cuci, perawatan berkala, stok minimum.'],
    ['keuangan', 'fa-wallet', 'Keuangan & Ongkir', 'Pencatatan ongkir & jenis pemasukan/pengeluaran manual.'],
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
  function go(k) { const mn = $('#cfgMain'); mn.onclick = mn.oninput = mn.onchange = null; cur = k; history.replaceState(null, '', '?s=' + k); nav(); R[k](); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  /* ---------- Aturan durasi sewa (ketentuan mitra, bisa diubah Owner) ---------- */
  function drawDur() {
    const box = $('#durPanel'); if (!box) return;
    const Rr = Ann.Rules.durRules(); const mode = S().durMode || 'aturan';
    const rentP = DB.products().filter((p) => (+p.rent || 0) > 0 && +p.rent3 > 0 && +p.rent5 > 0 && p.active !== false);
    let pid = (rentP.find((p) => p.id === 'fw-low') || rentP[0] || {}).id;
    const txt = (a) => a.join(' + ');
    const parse = (v) => String(v).replace(/\s+/g, '').split('+').filter(Boolean).map(Number);
    const name = { 1: '1 malam', 3: 'Paket 3 (Perkegiatan)', 5: 'Paket 5 (Ekspedisi)' };
    box.innerHTML = `<div class="panel-h"><h3><i class="fa-solid fa-calendar-days"></i> Aturan durasi sewa &amp; harga paket</h3></div>
      <p class="muted" style="font-size:13px;margin:-4px 0 12px">Menentukan paket yang dipakai untuk setiap lama sewa. Isi dengan angka paket: <b>1</b> = per malam, <b>3</b> = paket 3 hari, <b>5</b> = paket 5 hari, digabung dengan tanda <b>+</b> (mis. <code>5+3+1</code>). Batas pengembalian tetap sesuai tanggal yang dipilih customer. Perubahan berlaku untuk booking baru.</p>
      <div class="grid-2" style="max-width:720px"><div class="field"><label>Cara menghitung</label><select class="select" id="durMode"><option value="aturan" ${mode === 'aturan' ? 'selected' : ''}>Ikuti tabel aturan di bawah (ketentuan mitra)</option><option value="termurah" ${mode === 'termurah' ? 'selected' : ''}>Kombinasi tarif termurah (otomatis)</option></select></div>
      <div class="field"><label>Pratinjau harga dengan barang</label><select class="select" id="durP">${rentP.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)} (${rupiah(p.rent)} / ${rupiah(p.rent3)} / ${rupiah(p.rent5)})</option>`).join('')}</select></div></div>
      <div class="table-wrap" data-no-paginate><table class="table dur-tbl"><thead><tr><th>Lama sewa</th><th>Dihitung sebagai</th><th>Keterangan</th><th class="num">Harga contoh</th></tr></thead><tbody id="durRows"></tbody></table></div>
      <p class="muted" style="font-size:12.5px;margin:8px 0 12px" id="durMore"></p>
      <div class="tpl-acts"><button type="button" class="btn btn-primary btn-sm" id="durSave"><i class="fa-solid fa-floppy-disk"></i> Simpan aturan durasi</button><button type="button" class="btn btn-light btn-sm" id="durReset"><i class="fa-solid fa-rotate-left"></i> Kembalikan ke aturan mitra</button></div>`;
    const cur = {}; for (let n = 1; n <= 10; n++) cur[n] = Rr[n].slice();
    const price = (B) => { const p = DB.product(pid); if (!p) return 0; const k = { 1: p.rent, 3: p.rent3, 5: p.rent5 }; return B.reduce((a, x) => a + (+k[x] || 0), 0); };
    const rows = () => { $('#durRows').innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => { const B = cur[n]; const sum = B.reduce((a, x) => a + x, 0); const bad = !B.length || sum < n;
      return `<tr class="${bad ? 'bad' : ''}"><td><b>${n} hari</b></td><td><input class="input sm" data-dur="${n}" value="${txt(B)}" style="max-width:130px" aria-label="Aturan ${n} hari"></td><td><small class="${bad ? 'err-t' : 'muted'}">${bad ? `Total paket (${sum} hari) kurang dari ${n} hari` : B.map((x) => name[x]).join(' + ')}${!bad && sum > n ? ` · dibulatkan ke ${sum} hari` : ''}</small></td><td class="num">${bad ? '—' : rupiah(price(B))}</td></tr>`; }).join('');
      const ex = [11, 12, 14, 15].map((n) => `${n} hari = ${txt(Ann.Rules.durBlocks(n, cur))}`).join(' · ');
      $('#durMore').innerHTML = `<i class="fa-solid fa-circle-info"></i> Lebih dari 10 hari: paket 5 + aturan sisa harinya. Contoh: ${ex}.`;
      $('#durRows').closest('table').style.opacity = $('#durMode').value === 'aturan' ? 1 : 0.45; };
    rows();
    box.oninput = (e) => { const n = e.target.dataset.dur; if (!n) return; const B = parse(e.target.value); if (B.every((x) => [1, 3, 5].includes(x))) { cur[n] = B; const pos = e.target.selectionStart; rows(); const el = box.querySelector(`[data-dur="${n}"]`); el.focus(); el.setSelectionRange(pos, pos); } };
    box.onchange = (e) => { if (e.target.id === 'durP') { pid = e.target.value; rows(); } if (e.target.id === 'durMode') rows(); };
    $('#durReset').onclick = () => { for (let n = 1; n <= 10; n++) cur[n] = Ann.Rules.DUR_DEFAULT[n].slice(); $('#durMode').value = 'aturan'; rows(); toast('Aturan dikembalikan ke ketentuan mitra. Tekan Simpan untuk menerapkan.'); };
    $('#durSave').onclick = () => {
      for (let n = 1; n <= 10; n++) { const v = box.querySelector(`[data-dur="${n}"]`).value; const B = parse(v); if (!B.length || !B.every((x) => [1, 3, 5].includes(x)) || B.reduce((a, x) => a + x, 0) < n) { toast(`Aturan ${n} hari belum benar. Pakai angka 1, 3, 5 dengan tanda +, totalnya minimal ${n}.`, 'err'); box.querySelector(`[data-dur="${n}"]`).focus(); return; } cur[n] = B; }
      const old = Ann.Rules.durRules(); const oldMode = S().durMode || 'aturan'; const mode2 = $('#durMode').value;
      const ch = []; for (let n = 1; n <= 10; n++) if (txt(old[n]) !== txt(cur[n])) ch.push({ field: `${n} hari`, from: txt(old[n]), to: txt(cur[n]) });
      if (oldMode !== mode2) ch.push({ field: 'Cara menghitung', from: oldMode, to: mode2 });
      if (!ch.length) { toast('Tidak ada perubahan.'); return; }
      const chR = ch.filter((c) => c.field !== 'Cara menghitung'); if (chR.length) DB.saveConfig('durRules', cur, 'Mengubah aturan durasi sewa', chR); if (oldMode !== mode2) DB.saveConfig('durMode', mode2, 'Mengubah cara menghitung durasi sewa', ch.filter((c) => c.field === 'Cara menghitung'));
      toast('Aturan durasi disimpan. Berlaku untuk booking baru.'); drawDur();
    };
  }
  const R = {
    /* ---------- Template pesan WhatsApp ----------
       Owner mengatur kalimat pesan otomatis. Kode {nama}, {no_nota}, … diganti data asli saat dikirim.
       Staff tetap bisa mengedit isi pesan di jendela kirim sebelum WhatsApp dibuka. */
    pesan() {
      const saved = Object.assign({}, S().waTemplates || {}); const cur = {}; DB.WA_TPL.forEach((t) => { cur[t.key] = typeof saved[t.key] === 'string' && saved[t.key].trim() ? saved[t.key] : t.def; });
      const openKey = param('t') || '';
      const SAMPLE = { nama: 'Dimas Saputra', nama_depan: 'Dimas', no_nota: 'RNTL/019/X/2026', tanggal: D.fmtDate(D.today(), true), total: rupiah(185000), dibayar: rupiah(92500), sisa: rupiah(92500), metode: 'Tunai',
        rincian: '• 1× Tenda Kapasitas 4 (Double Layer) — Rp 40.000\n• 1× Sleeping Bag — Rp 10.000\nTotal sewa: Rp 50.000 · Sudah dibayar: Rp 25.000 · Sisa: Rp 25.000',
        link_nota: 'https://annapurna.id/invoice?id=…', pengiriman: 'Diantar ke: Kost Lestari, Jl. Kampus', tgl_sewa: '20–21 Okt 2026', tgl_ambil: '20 Oktober 2026', tgl_kembali: '21 Oktober 2026', jam_kembali: String(S().returnTime || '22:00').replace(':', '.'),
        lama: '1 malam', status: 'Booking Dikonfirmasi · DP Lunas', terlambat: 2, denda: rupiah(80000), total_bayar: rupiah(105000), estimasi: 'Kamis, 24 Oktober 2026' };
      const prev = (k) => DB.waFill(cur[k], Object.assign({}, SAMPLE, k.startsWith('ld_') ? { no_nota: 'DRY/004/X/2026', rincian: '*NOTA LAUNDRY DRY/004/X/2026*\nTanggal terima: 21 Oktober 2026\n• 1× Tenda 2P Double Layer = Rp 30.000\n• 1× Sarung tangan = Rp 5.000\n*Total: Rp 35.000*\nDibayar saat pengambilan: Rp 35.000' } : k.startsWith('sale') || k === 'kasir_sale' ? { no_nota: 'ODR/008/X/2026', rincian: '• 1× Kursi Camping = Rp 185.000\nOngkir antar: Rp 20.000\n*Total: Rp 205.000* · Dibayar: Rp 205.000 · LUNAS' } : {}));
      const waHtml = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>');
      const groups = [...new Set(DB.WA_TPL.map((t) => t.group))];
      const ICON = { Penjualan: 'fa-bag-shopping', Rental: 'fa-campground', Laundry: 'fa-jug-detergent' };
      const card = (t) => { const changed = cur[t.key] !== t.def;
        return `<details class="tpl-card" data-tc="${t.key}" ${openKey === t.key ? 'open' : ''}><summary><span class="ic"><i class="fa-brands fa-whatsapp"></i></span><span class="t"><b>${esc(t.title)}</b><small>Dipakai di: ${esc(t.when)}</small></span>${changed ? '<span class="pill blue plain" data-chg>Diubah</span>' : '<span class="pill gray plain" data-chg>Bawaan</span>'}<i class="fa-solid fa-chevron-down muted"></i></summary>
          <div class="tpl-body"><div>
            <label class="muted" style="font-size:12.5px;font-weight:600">Isi template</label>
            <textarea class="textarea" data-tk="${t.key}" spellcheck="false">${esc(cur[t.key])}</textarea>
            <div class="tpl-vars">${[...new Set([...t.vars, 'nama_toko', 'alamat_toko', 'jam_buka'])].map((v) => `<button type="button" data-ins="${t.key}|${v}" title="${esc(DB.WA_VARS[v] || v)}">{${v}}</button>`).join('')}</div>
            <p class="muted" style="font-size:12px;margin:0 0 8px">Klik kode untuk menyisipkan di posisi kursor. <b>*teks*</b> = tebal, <b>_teks_</b> = miring di WhatsApp. Kode yang datanya kosong otomatis dihapus.</p>
            <div class="tpl-acts"><button type="button" class="btn btn-light btn-xs" data-tdef="${t.key}" ${changed ? '' : 'disabled'}><i class="fa-solid fa-rotate-left"></i> Kembalikan ke bawaan</button></div></div>
            <div class="tpl-prev"><h5>Pratinjau (data contoh)</h5><div class="tpl-bubble" data-tp="${t.key}">${waHtml(prev(t.key))}</div></div></div></details>`; };
      $('#cfgMain').innerHTML = head('Template Pesan WhatsApp', 'Atur kalimat pesan otomatis yang dikirim staff ke customer. Saat mengirim, staff tetap bisa mengedit pesan sebelum WhatsApp dibuka.')
        + groups.map((g) => `<div class="cfg-block"><h3><i class="fa-solid ${ICON[g] || 'fa-comment'}"></i> ${esc(g)}</h3><div class="tpl-list">${DB.WA_TPL.filter((t) => t.group === g).map(card).join('')}</div></div>`).join('')
        + `<div class="cfg-block"><h3><i class="fa-solid fa-code"></i> Arti kode</h3><div class="kv-grid">${Object.entries(DB.WA_VARS).map(([k, l]) => `<div class="kv"><span><code>{${k}}</code></span><span>${esc(l)}</span></div>`).join('')}</div></div>`
        + saveBar('saveTpl');
      const box = $('#cfgMain');
      const sync = (k) => { const b = box.querySelector(`[data-tp="${k}"]`); if (b) b.innerHTML = waHtml(prev(k)); const t = DB.WA_TPL.find((x) => x.key === k); const card0 = box.querySelector(`[data-tc="${k}"]`); const ch = cur[k] !== t.def;
        card0.querySelector('[data-chg]').outerHTML = ch ? '<span class="pill blue plain" data-chg>Diubah</span>' : '<span class="pill gray plain" data-chg>Bawaan</span>'; card0.querySelector('[data-tdef]').disabled = !ch; };
      box.oninput = (e) => { const k = e.target.dataset.tk; if (!k) return; cur[k] = e.target.value; sync(k); };
      box.onchange = null;
      box.onclick = (e) => {
        const ins = e.target.closest('[data-ins]'); if (ins) { const [k, v] = ins.dataset.ins.split('|'); const ta = box.querySelector(`[data-tk="${k}"]`); const s0 = ta.selectionStart ?? ta.value.length, e0 = ta.selectionEnd ?? s0;
          ta.value = ta.value.slice(0, s0) + `{${v}}` + ta.value.slice(e0); ta.focus(); ta.selectionStart = ta.selectionEnd = s0 + v.length + 2; cur[k] = ta.value; sync(k); return; }
        const df = e.target.closest('[data-tdef]'); if (df) { const k = df.dataset.tdef; const t = DB.WA_TPL.find((x) => x.key === k); cur[k] = t.def; box.querySelector(`[data-tk="${k}"]`).value = t.def; sync(k); return; }
        if (e.target.closest('#saveTpl')) {
          const empty = DB.WA_TPL.filter((t) => !String(cur[t.key] || '').trim()); if (empty.length) { toast(`Template "${empty[0].title}" masih kosong. Isi atau kembalikan ke bawaan.`, 'err'); return; }
          const next = {}; DB.WA_TPL.forEach((t) => { if (cur[t.key].trim() !== t.def.trim()) next[t.key] = cur[t.key]; });
          const ch = DB.WA_TPL.filter((t) => (saved[t.key] || '') !== (next[t.key] || '')).map((t) => ({ field: t.title, from: saved[t.key] ? 'versi Owner' : 'bawaan', to: next[t.key] ? 'versi Owner (diperbarui)' : 'bawaan' }));
          if (!ch.length) { toast('Tidak ada perubahan.'); return; }
          DB.saveConfig('waTemplates', next, 'Mengubah template pesan WhatsApp', ch); toast('Template pesan disimpan. Berlaku untuk semua staff.'); R.pesan();
        }
      };
      if (openKey) setTimeout(() => { const c = box.querySelector(`[data-tc="${openKey}"]`); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200);
    },
    /* ---------- Asisten Trip: aturan chatbot JIKA (kata kunci) – MAKA (jawaban) ---------- */
    asisten() {
      let rules = DB.chatRules(); let sp = DB.chatSpecial(); let open = '';
      const PRI = [['normal', 'Normal'], ['tinggi', 'Tinggi (diperiksa lebih dulu)']];
      const keysOf = (r) => (r.keys || []).map((k) => DB.chatNorm(k)).filter(Boolean);
      const conflicts = (r) => { const mine = new Set(keysOf(r)); return rules.filter((o) => o !== r && o.active !== false && r.active !== false).flatMap((o) => keysOf(o).filter((k) => mine.has(k)).map((k) => `"${k}" juga dipakai di ${o.title || 'aturan tanpa judul'}`)); };
      const grab = () => { $$('[data-ri]').forEach((el) => { const r = rules[+el.dataset.ri]; const k = el.dataset.k;
        if (k === 'keys') r.keys = el.value.split(',').map((x) => x.trim()).filter(Boolean); else if (k === 'active') r.active = el.checked; else r[k] = el.value; });
        $$('[data-sp]').forEach((el) => { sp[el.dataset.sp] = el.checked; }); };
      const card = (r, i) => { const cf = conflicts(r);
        return `<details class="cb-rule ${r.active === false ? 'off' : ''}" data-card="${i}" ${open === String(i) ? 'open' : ''}>
          <summary><span class="cb-t"><b>${esc(r.title || 'Aturan baru')}</b><small>${esc((r.keys || []).slice(0, 6).join(', ') || 'belum ada kata kunci')}${(r.keys || []).length > 6 ? ', …' : ''}</small></span>
            <span class="cb-tags">${r.builtin ? '<span class="pill gray plain">Bawaan</span>' : '<span class="pill blue plain">Buatan Owner</span>'}${r.priority === 'tinggi' ? '<span class="pill gold plain">Prioritas tinggi</span>' : ''}${r.active === false ? '<span class="pill red plain">Nonaktif</span>' : ''}${cf.length ? '<span class="pill red plain"><i class="fa-solid fa-triangle-exclamation"></i> Bentrok</span>' : ''}</span></summary>
          <div class="cb-body">
            <div class="grid-2"><div class="field"><label>Judul topik</label><input class="input" data-ri="${i}" data-k="title" value="${esc(r.title || '')}" placeholder="Contoh: Sewa untuk rombongan sekolah"></div>
              <div class="field"><label>Prioritas</label><select class="select" data-ri="${i}" data-k="priority">${PRI.map(([v, l]) => `<option value="${v}" ${(r.priority || 'normal') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
            <div class="field"><label><b>JIKA</b> pertanyaan mengandung salah satu kata kunci (pisahkan dengan koma)</label><textarea class="input" rows="2" data-ri="${i}" data-k="keys" placeholder="sekolah, pramuka, study tour">${esc((r.keys || []).join(', '))}</textarea>
              ${cf.length ? `<small style="color:var(--red)">${cf.slice(0, 3).map(esc).join(' · ')}</small>` : ''}</div>
            <div class="field"><label><b>MAKA</b> tampilkan jawaban</label><textarea class="input cb-ans" rows="4" data-ri="${i}" data-k="answer" placeholder="${r.builtin ? 'Kosongkan untuk memakai jawaban otomatis bawaan (selalu mengikuti pengaturan toko).' : 'Tulis jawaban. **tebal**, baris diawali - menjadi daftar, dan isian seperti {jam_buka} terisi otomatis.'}">${esc(r.answer || '')}</textarea>
              ${r.builtin && !String(r.answer || '').trim() ? '<small class="muted">Memakai jawaban otomatis bawaan.</small>' : ''}</div>
            <div class="cb-row"><div class="field" style="margin:0"><label>Tombol di bawah jawaban</label><select class="select" data-ri="${i}" data-k="action">${DB.CHAT_ACTIONS.map(([v, l]) => `<option value="${v}" ${(r.action || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <label class="cb-sw"><input type="checkbox" data-ri="${i}" data-k="active" ${r.active === false ? '' : 'checked'}> Aktif</label>
              <span class="cb-acts">${r.builtin ? (String(r.answer || '').trim() ? `<button type="button" class="btn btn-light btn-xs" data-reset="${i}">Pakai jawaban bawaan</button>` : '') : `<button type="button" class="btn btn-light btn-xs" data-del="${i}"><i class="fa-solid fa-trash-can"></i> Hapus</button>`}</span></div>
          </div></details>`; };
      const draw = () => {
        const miss = DB.chatMisses();
        $('#cfgMain').innerHTML = head('Asisten Trip – Tanya jawab', 'Chatbot memakai aturan <b>JIKA</b> pertanyaan mengandung kata kunci <b>MAKA</b> tampilkan jawaban. Tambah atau ubah aturan di sini; perubahan langsung dipakai Asisten Trip di website. Fitur Rencanakan trip (sistem rekomendasi) tidak diatur di sini.')
          + `<div class="cfg-block"><h3><i class="fa-solid fa-flask"></i> Coba tanya</h3>
              <div class="cb-test"><input class="input" id="cbQ" placeholder="Contoh: bisa sewa untuk acara sekolah?"><button type="button" class="btn btn-primary btn-sm" id="cbTry">Coba</button></div><div id="cbOut"></div>
              <small class="muted">Uji memakai aturan di layar (termasuk yang belum disimpan). Aturan khusus berbasis data (nomor nota, produk, trip) diuji langsung di website.</small></div>
            <div class="cfg-block"><h3><i class="fa-solid fa-list-check"></i> Aturan JIKA–MAKA <small class="muted" style="font-weight:500">${rules.filter((r) => r.active !== false).length} aktif dari ${rules.length}</small></h3>
              <p class="muted" style="font-size:12.5px;margin:-6px 0 10px">Urutan pemeriksaan: nomor nota → aturan <b>prioritas tinggi</b> → aturan khusus berbasis data → aturan <b>prioritas normal</b> (skor kata kunci tertinggi) → bila tidak ada yang cocok, diarahkan ke admin dan dicatat di "Pertanyaan belum terjawab".</p>
              <div class="cb-list">${rules.map(card).join('')}</div>
              <button type="button" class="btn btn-light btn-sm" id="cbAdd"><i class="fa-solid fa-plus"></i> Tambah aturan</button>
              <div class="cb-ph"><b>Isian otomatis untuk jawaban</b> (klik untuk menyisipkan): ${DB.CHAT_PH.map(([k, l]) => `<button type="button" class="chip" data-ph="${k}" title="${esc(l)}">${k}</button>`).join(' ')}</div></div>
            <div class="cfg-block"><h3><i class="fa-solid fa-database"></i> Aturan khusus berbasis data</h3>
              <p class="muted" style="font-size:12.5px;margin:-6px 0 10px">Jawabannya dihitung dari data stok, harga, dan pesanan sehingga tidak bisa diubah teksnya, tetapi bisa dinonaktifkan.</p>
              <div class="cb-sp">${DB.CHAT_SPECIAL.map(([k, l]) => `<label class="cb-sw"><input type="checkbox" data-sp="${k}" ${sp[k] !== false ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
            <div class="cfg-block"><h3><i class="fa-solid fa-circle-question"></i> Pertanyaan belum terjawab <small class="muted" style="font-weight:500">${miss.length}</small></h3>
              ${miss.length ? `<div class="table-wrap" data-no-paginate><table class="table"><thead><tr><th>Pertanyaan customer</th><th class="num">Ditanyakan</th><th>Terakhir</th><th class="num">Aksi</th></tr></thead><tbody>
                ${miss.slice(0, 30).map((m) => `<tr><td>${esc(m.text)}</td><td class="num">${m.count}×</td><td>${D.fmtDateTime(m.last)}</td><td><div class="acts"><button type="button" class="btn btn-primary btn-xs" data-mk="${esc(m.key)}">Jadikan aturan</button><button type="button" class="btn btn-light btn-xs" data-ign="${esc(m.key)}">Abaikan</button></div></td></tr>`).join('')}
                </tbody></table></div>` : '<p class="muted" style="font-size:13px">Belum ada. Pertanyaan customer yang tidak cocok dengan aturan mana pun akan muncul di sini.</p>'}</div>
            ${saveBar('saveCb')}`;
      };
      draw();
      const box = $('#cfgMain');
      let lastTa = null;
      box.onfocusin = (e) => { if (e.target.matches('.cb-ans')) lastTa = e.target; };
      if (box._cbT) box.removeEventListener('toggle', box._cbT, true);
      box._cbT = (e) => { const d = e.target.closest && e.target.closest('[data-card]'); if (d && d.open) open = d.dataset.card; };
      box.addEventListener('toggle', box._cbT, true);
      box.onclick = async (e) => {
        const t = e.target;
        if (t.closest('#cbAdd')) { grab(); rules.push({ id: 'cr-' + Date.now().toString(36), title: '', keys: [], answer: '', action: '', priority: 'normal', active: true, builtin: false }); open = String(rules.length - 1); draw(); const c = box.querySelector(`[data-card="${open}"]`); if (c) { c.scrollIntoView({ block: 'center' }); c.querySelector('input').focus(); } return; }
        const del = t.closest('[data-del]'); if (del) { grab(); const r = rules[+del.dataset.del]; if (!(await confirmBox({ title: `Hapus aturan ${r.title || ''}?`, text: 'Aturan dihapus setelah kamu menekan Simpan perubahan.', ok: 'Hapus', danger: true }))) return; rules.splice(+del.dataset.del, 1); open = ''; draw(); return; }
        const rs = t.closest('[data-reset]'); if (rs) { grab(); rules[+rs.dataset.reset].answer = ''; draw(); return; }
        const ph = t.closest('[data-ph]'); if (ph) { const ta = lastTa && document.body.contains(lastTa) ? lastTa : box.querySelector('details[open] .cb-ans'); if (!ta) { toast('Klik dulu kolom jawaban yang ingin diisi.', 'err'); return; } const p0 = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p0) + ph.dataset.ph + ta.value.slice(p0); ta.focus(); return; }
        const mk = t.closest('[data-mk]'); if (mk) { grab(); const m = DB.chatMisses().find((x) => x.key === mk.dataset.mk); rules.push({ id: 'cr-' + Date.now().toString(36), title: m ? m.text.slice(0, 40) : 'Aturan baru', keys: m ? [m.key] : [], answer: '', action: '', priority: 'normal', active: true, builtin: false, fromMiss: mk.dataset.mk }); open = String(rules.length - 1); draw(); toast('Aturan baru dibuat dari pertanyaan. Rapikan kata kunci, tulis jawaban, lalu simpan.'); const c = box.querySelector(`[data-card="${open}"]`); if (c) c.scrollIntoView({ block: 'center' }); return; }
        const ig = t.closest('[data-ign]'); if (ig) { DB.dismissChatMiss(ig.dataset.ign); grab(); draw(); return; }
        if (t.closest('#cbTry')) {
          grab(); const q = $('#cbQ').value.trim(); if (!q) return;
          const saved = DB.settings().chatRules; const tmp = Object.assign({}, DB.settings(), { chatRules: rules });
          /* uji tanpa menyimpan: pakai aturan di layar sementara */
          const orig = DB.settings; DB.settings = () => tmp;
          let hit; try { hit = DB.chatMatch(q, 'tinggi') || DB.chatMatch(q, 'normal'); } finally { DB.settings = orig; }
          $('#cbOut').innerHTML = hit ? `<div class="cb-res ok"><div><small>Aturan terpakai</small><b>${esc(hit.rule.title || 'Aturan tanpa judul')}</b> · skor ${hit.score}${hit.rule.priority === 'tinggi' ? ' · prioritas tinggi' : ''}</div>
              <div class="cb-ans-prev">${hit.rule.builtin && !String(hit.rule.answer || '').trim() ? '<i class="muted">Jawaban otomatis bawaan (mengikuti pengaturan toko).</i>' : DB.chatRender(hit.rule.answer)}</div></div>`
            : '<div class="cb-res no"><b>Tidak ada aturan yang cocok.</b> Di website, pertanyaan ini akan diarahkan ke admin dan masuk daftar "Pertanyaan belum terjawab".</div>';
          void saved; return;
        }
        if (t.closest('#saveCb')) {
          grab();
          const bad = rules.find((r) => r.active !== false && (!String(r.title || '').trim() || !(r.keys || []).length || (!r.builtin && !String(r.answer || '').trim())));
          if (bad) { toast(`Lengkapi aturan "${bad.title || 'tanpa judul'}": judul, kata kunci, dan jawaban wajib diisi.`, 'err'); open = String(rules.indexOf(bad)); draw(); return; }
          const clean = rules.map((r) => ({ id: r.id, title: String(r.title).trim(), keys: (r.keys || []).map((k) => k.trim().toLowerCase()).filter(Boolean), answer: String(r.answer || '').trim(), action: r.action || '', priority: r.priority === 'tinggi' ? 'tinggi' : 'normal', active: r.active !== false, builtin: !!r.builtin }));
          rules.filter((r) => r.fromMiss).forEach((r) => DB.dismissChatMiss(r.fromMiss));
          const next = Object.assign({}, S(), { chatRules: clean, chatSpecial: Object.assign({}, sp) });
          cfgSave(next, 'Mengubah aturan Asisten Trip (tanya jawab)', [['chatRules', 'Aturan tanya jawab', (v) => `${(v || []).filter((r) => r.active !== false).length} aktif dari ${(v || []).length} aturan`], ['chatSpecial', 'Aturan khusus', (v) => Object.entries(v || {}).filter(([, on]) => !on).map(([k]) => k + ' nonaktif').join(', ') || 'semua aktif']]);
        }
      };
      box.oninput = null; box.onchange = null;
    },
    /* ---------- Laundry & Jasa Tenda ---------- */
    layanan() {
      const st = S(); let cats = JSON.parse(JSON.stringify(DB.laundryPrices()));
      /* Nilai yang sedang diketik (hari, ketentuan, tarif) disimpan dulu supaya tidak hilang saat daftar harga digambar ulang */
      const tmp = { days: +st.laundryDays || 3, terms: (st.laundryTerms || []).slice(), fees: {}, other: DB.laundryOther() };
      const grab = () => { if (!$('#ldDays')) return; tmp.days = $('#ldDays').value; tmp.terms = $$('#ldTerms textarea').map((t) => t.value); $$('[data-fee]').forEach((el) => { tmp.fees[el.dataset.fee] = el.value; });
        if ($('#ldoName')) Object.assign(tmp.other, { enabled: $('#ldoOn').checked, name: $('#ldoName').value, note: $('#ldoNote').value, minPrice: num($('#ldoMin').value) }); };
      const FK = { pasang: 'setupFee', pasang_saja: 'pasangFee', bongkar_saja: 'bongkarFee' };
      const ICONS = [['fa-tent', 'Ikon tenda'], ['fa-bed', 'Ikon sleeping bag'], ['fa-shirt', 'Ikon pakaian'], ['fa-suitcase-rolling', 'Ikon tas'], ['fa-shoe-prints', 'Ikon sepatu'], ['fa-rug', 'Ikon matras'], ['fa-hat-cowboy', 'Ikon topi'], ['fa-mitten', 'Ikon sarung tangan'], ['fa-jug-detergent', 'Ikon umum']];
      const draw = () => {
        grab();
        $('#cfgMain').innerHTML = head('Laundry & Jasa Tenda', 'Harga di sini langsung tampil di halaman Laundry & beranda website, kasir, dan struk. Laundry tanpa antar jemput: customer antar & ambil sendiri di toko.')
          + `<div class="cfg-block"><h3><i class="fa-solid fa-tags"></i> Daftar harga laundry</h3>
            <div class="ld-cfg">${cats.map((c, ci) => `<div class="ld-cfg-cat">
              <div class="ld-cfg-h"><select class="select" data-ci="${ci}" data-k="icon" aria-label="Ikon kategori">${ICONS.map(([ic, l]) => `<option value="${ic}" ${ic === c.icon ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <input class="input" data-ci="${ci}" data-k="name" value="${esc(c.name)}" placeholder="Nama kategori" aria-label="Nama kategori">
                <button type="button" class="btn btn-light btn-xs" data-rmcat="${ci}" title="Hapus kategori"><i class="fa-solid fa-trash-can"></i></button></div>
              ${c.items.map((it, ii) => `<div class="ld-cfg-row"><label class="ld-thumb ${it.img ? 'has' : ''}" style="${it.img ? `background-image:url('${asset(it.img)}')` : ''}" title="${it.img ? 'Ganti gambar' : 'Pasang gambar'}">${it.img ? '' : '<i class="fa-regular fa-image"></i>'}<input type="file" accept="image/*" hidden data-ldimg="${ci}|${ii}"></label><input class="input" data-ci="${ci}" data-ii="${ii}" data-k="name" value="${esc(it.name)}" placeholder="Nama barang" aria-label="Nama barang">
                <div class="ld-cfg-pr"><span>Rp</span><input class="input" data-ci="${ci}" data-ii="${ii}" data-k="price" inputmode="numeric" value="${it.price ? Number(it.price).toLocaleString('id-ID') : ''}" placeholder="0" aria-label="Harga"></div>
                <button type="button" class="icon-btn sm" data-rmit="${ci}|${ii}" aria-label="Hapus ${esc(it.name)}"><i class="fa-solid fa-xmark"></i></button></div>`).join('')}
              <button type="button" class="btn btn-ghost btn-xs" data-addit="${ci}"><i class="fa-solid fa-plus"></i> Tambah barang</button></div>`).join('')}</div>
            <button type="button" class="btn btn-light btn-sm" id="addLdCat"><i class="fa-solid fa-folder-plus"></i> Tambah kategori laundry</button>
            <p class="muted" style="font-size:12.5px;margin:10px 0 0"><i class="fa-regular fa-image"></i> Klik kotak gambar di kiri tiap barang untuk memasang / mengganti gambar. Admin juga bisa mengganti gambar dari menu Laundry → Daftar harga.</p></div>
          <div class="cfg-block"><h3><i class="fa-solid fa-plus"></i> Laundry lain-lain <small class="muted" style="font-weight:500">barang di luar daftar, nama &amp; harga diisi manual di kasir</small></h3>
            <label class="chk-line" style="margin-bottom:10px"><input type="checkbox" id="ldoOn" ${tmp.other.enabled !== false ? 'checked' : ''}> <span>Tampilkan kartu <b>Lain-lain</b> di kasir &amp; halaman Laundry website</span></label>
            <div class="ld-cfg-other" style="display:grid;grid-template-columns:auto minmax(0,1fr) 200px;gap:12px;align-items:start">
              <label class="ld-thumb ${tmp.other.img ? 'has' : ''}" style="width:72px;height:72px;border-radius:12px;border:1px dashed var(--line-2);background:var(--g50) center/cover no-repeat;display:grid;place-items:center;color:var(--g600);cursor:pointer;${tmp.other.img ? `background-image:url('${asset(tmp.other.img)}');border-style:solid` : ''}" title="Gambar kartu Lain-lain">${tmp.other.img ? '' : '<i class="fa-regular fa-image"></i>'}<input type="file" accept="image/*" hidden data-ldimg="other"></label>
              <div><div class="field"><label>Nama kartu</label><input class="input" id="ldoName" value="${esc(tmp.other.name)}" maxlength="30"></div>
                <div class="field"><label>Keterangan <span class="opt">(tampil di kasir &amp; website)</span></label><input class="input" id="ldoNote" value="${esc(tmp.other.note || '')}" maxlength="140"></div></div>
              <div class="field"><label>Harga minimal (mulai dari)</label><div class="ld-cfg-pr"><span>Rp</span><input class="input" id="ldoMin" inputmode="numeric" value="${Number(tmp.other.minPrice || 0).toLocaleString('id-ID')}"></div><small class="muted">Staff tidak bisa mengisi harga di bawah angka ini.</small></div>
            </div></div>
          <div class="cfg-block"><h3 id="ldTermsH"><i class="fa-solid fa-receipt"></i> Struk &amp; ketentuan laundry</h3>
            <div class="field" style="max-width:260px"><label>Estimasi lama pengerjaan (hari)</label><input class="input" type="number" min="1" max="30" id="ldDays" value="${esc(String(tmp.days))}"><small class="muted">Tanggal estimasi selesai otomatis terisi di kasir, staff tetap bisa mengubahnya.</small></div>
            <div class="field"><label>Ketentuan laundry <span class="opt">(tampil di halaman Laundry website &amp; dicetak di struk)</span></label>${listEditor('ldTerms', tmp.terms, 'Contoh: Pengambilan wajib menunjukkan struk.')}</div></div>
          <div class="cfg-block"><h3><i class="fa-solid fa-tents"></i> Tarif jasa tenda <small class="muted" style="font-weight:500">per tenda, di luar ongkir</small></h3>
            <div class="ld-cfg-fees">${Svc.TENT_MODES.map((k) => `<div class="field"><label>${Svc.spec(k).short}</label><div class="ld-cfg-pr"><span>Rp</span><input class="input" inputmode="numeric" data-fee="${FK[k]}" value="${esc(tmp.fees[FK[k]] != null ? tmp.fees[FK[k]] : Number(Svc.fee(k)).toLocaleString('id-ID'))}"></div><small class="muted">${Svc.spec(k).desc}</small></div>`).join('')}</div></div>
          ${saveBar('saveLd')}`;
      };
      const num = (v) => +String(v || '').replace(/[^\d]/g, '') || 0;
      draw();
      const box = $('#cfgMain');
      const onInput = (e) => { const t = e.target; if (t.dataset.ci == null) return; const c = cats[+t.dataset.ci];
        if (t.dataset.ii != null) { const it = c.items[+t.dataset.ii]; if (t.dataset.k === 'price') { it.price = num(t.value); t.value = it.price ? it.price.toLocaleString('id-ID') : ''; } else it.name = t.value; }
        else c[t.dataset.k] = t.value; };
      box.oninput = onInput;
      box.onchange = async (e) => { const fi = e.target.closest('[data-ldimg]');
        if (fi) { const f = fi.files[0]; fi.value = ''; if (!f) return; if (f.size > 8e6) { toast('Ukuran gambar maksimal 8 MB.', 'err'); return; }
          const out = await UI.cropImage(f, { aspect: 4 / 3, size: 640, title: 'Atur gambar laundry' }); if (!out) return;
          if (fi.dataset.ldimg === 'other') { grab(); tmp.other.img = out; } else { const [ci, ii] = fi.dataset.ldimg.split('|').map(Number); cats[ci].items[ii].img = out; }
          draw(); toast('Gambar dipasang. Jangan lupa Simpan perubahan.'); return; }
        onInput(e); };
      box.onclick = async (e) => {
        const a = e.target.closest('[data-addit]'); if (a) { cats[+a.dataset.addit].items.push({ id: 'ld-' + Date.now().toString(36), name: '', price: 0 }); draw(); const L = $$(`[data-ci="${a.dataset.addit}"][data-k="name"][data-ii]`); L[L.length - 1].focus(); return; }
        const r = e.target.closest('[data-rmit]'); if (r) { const [ci, ii] = r.dataset.rmit.split('|').map(Number); cats[ci].items.splice(ii, 1); draw(); return; }
        const rc = e.target.closest('[data-rmcat]'); if (rc) { const c = cats[+rc.dataset.rmcat]; if (c.items.length && !(await confirmBox({ title: `Hapus kategori ${c.name}?`, text: `${c.items.length} harga di dalamnya ikut terhapus dari daftar.`, ok: 'Hapus', danger: true }))) return; cats.splice(+rc.dataset.rmcat, 1); draw(); return; }
        if (e.target.closest('#addLdCat')) { cats.push({ id: 'ldc-' + Date.now().toString(36), name: '', icon: 'fa-jug-detergent', items: [{ id: 'ld-' + Date.now().toString(36), name: '', price: 0 }] }); draw(); return; }
        if (e.target.closest('#saveLd')) {
          if (!cats.length) { toast('Minimal ada satu kategori laundry.', 'err'); return; }
          if (cats.some((c) => !c.name.trim() || !c.items.length || c.items.some((i) => !i.name.trim() || !i.price))) { toast('Lengkapi nama kategori, nama barang, dan harga (tidak boleh kosong).', 'err'); return; }
          grab(); if (!String(tmp.other.name || '').trim()) { toast('Isi nama kartu Lain-lain.', 'err'); $('#ldoName').focus(); return; }
          const next = Object.assign({}, S(), { laundry: cats.map((c) => Object.assign({}, c, { name: c.name.trim(), items: c.items.map((i) => Object.assign({}, i, { name: i.name.trim() })) })), laundryDays: Math.max(1, Math.min(30, +$('#ldDays').value || 3)), laundryTerms: readLines('ldTerms'),
            laundryOther: Object.assign({}, tmp.other, { name: String(tmp.other.name).trim(), note: String(tmp.other.note || '').trim(), minPrice: Math.max(0, +tmp.other.minPrice || 0) }) });
          $$('[data-fee]').forEach((el) => { next[el.dataset.fee] = num(el.value); });
          const flat = (L) => (L || []).map((c) => `${c.name}: ` + c.items.map((i) => `${i.name} ${rupiah(i.price)}`).join(', ')).join(' | ');
          cfgSave(next, 'Mengubah pengaturan laundry & jasa tenda', [['laundry', 'Harga laundry', flat], ['laundryOther', 'Laundry lain-lain', (v) => `${v && v.enabled === false ? 'Nonaktif' : 'Aktif'} · ${(v && v.name) || ''} mulai ${rupiah((v && v.minPrice) || 0)}${v && v.img ? ' · bergambar' : ''}`], ['laundryDays', 'Estimasi pengerjaan (hari)'], ['laundryTerms', 'Ketentuan struk laundry', (v) => `${(v || []).length} poin`],
            ['setupFee', 'Tarif bongkar pasang', rupiah], ['pasangFee', 'Tarif pasang saja', rupiah], ['bongkarFee', 'Tarif bongkar saja', rupiah]]);
        }
      };
    },
    /* ---------- Kategori ---------- */
    kategori() {
      const cats = DB.categories(true); const P = productsRaw();
      $('#cfgMain').innerHTML = head('Kategori Barang', 'Kategori tampil di katalog customer dan dipakai untuk menentukan atribut apa saja yang muncul di form barang.', '<button class="btn btn-primary btn-sm" id="addCat"><i class="fa-solid fa-plus"></i> Tambah kategori</button>')
        + `<div class="cfg-cards">${cats.map((c) => { const n = P.filter((p) => p.cat === c.id).length; const at = DB.attrsForCat(c.id); const off = c.active === false;
          return `<article class="cfg-card ${off ? 'row-off' : ''}"><img loading="lazy" decoding="async" src="${asset(c.img)}" alt=""><div class="cc-bd"><strong>${esc(c.name)}</strong>${off ? ' <span class="pill gray plain">Tidak aktif</span>' : ''}<small>${n} barang</small>
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
      $('#cfgMain').innerHTML = head('Kualitas Barang', 'Penilaian kualitas fisik barang/unit (misalnya Sangat Baik, Baik, Cukup). Kualitas yang tidak "bisa disewa" membuat unit tidak ditawarkan ke customer. Untuk barang kotor atau rusak, staff memakai alur <b>Perawatan Unit</b> (cuci & perbaikan), bukan kualitas ini.', '<button class="btn btn-light btn-sm" id="addCond"><i class="fa-solid fa-plus"></i> Tambah status</button>')
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
    /* ---------- Sesi staff: logout otomatis ---------- */
    sesi() {
      const cur = +(S().idleLogoutMin ?? 0);
      $('#cfgMain').innerHTML = head('Sesi Staff', 'Secara bawaan staff tidak dikeluarkan otomatis. Nyalakan hanya bila komputer kasir sering dipakai bergantian atau ditinggal dalam keadaan login.') + `<div class="panel"><form id="ssf" novalidate>
        <div class="field" style="max-width:360px"><label>Logout otomatis setelah tidak aktif</label><select class="select" name="idle">${[[0, 'Nonaktif — staff tidak pernah dikeluarkan otomatis (bawaan)'], [15, '15 menit'], [30, '30 menit'], [60, '60 menit'], [120, '2 jam'], [240, '4 jam']].map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <p class="muted" style="font-size:13px;margin:0"><i class="fa-solid fa-circle-info"></i> "Tidak aktif" = tidak ada klik, ketik, atau gulir di panel. Staff yang lupa menekan <b>Keluar</b> (misalnya langsung menutup browser) akan tercatat <b>Logout otomatis</b> dengan jam aktivitas terakhirnya, sehingga durasi kerja di Histori Login selalu terisi dan akun tidak terbuka terlalu lama di komputer toko.</p>
      </form></div>${saveBar('saveSs')}`;
      $('#saveSs').addEventListener('click', () => { const v = +$('#ssf').elements.idle.value; cfgSave(Object.assign({}, S(), { idleLogoutMin: v }), 'Mengubah logout otomatis staff', [['idleLogoutMin', 'Logout otomatis', (x) => (+x ? `${x} menit` : 'Tidak pernah')]]); });
    },
    /* ---------- Nota & struk kasir ---------- */
    nota() {
      const r = Object.assign({ paper: 58, footerRent: '', footerSale: '' }, S().receipt || {});
      $('#cfgMain').innerHTML = head('Nota & Struk', 'Pengaturan struk yang dicetak dari menu Kasir (printer thermal) dan pesan penutup di struk.') + `<div class="panel"><form id="ntf" novalidate>
        <h4 class="cfg-sub" style="margin-top:0">Ukuran kertas struk</h4>
        <div class="pk-opts nt-paper">${[[58, '58 mm', 'Printer thermal kecil (paling umum, kertas 57–58 mm).'], [80, '80 mm', 'Printer thermal besar (kertas 79–80 mm), tulisan lebih lega.']].map(([v, t, d]) => `<label class="pk-opt"><input type="radio" name="paper" value="${v}" ${+r.paper === v ? 'checked' : ''}><span><i class="fa-solid fa-receipt"></i><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0"><i class="fa-solid fa-circle-info"></i> Ukuran ini dipakai semua tombol <b>Cetak struk</b>: struk sewa &amp; jual di Kasir, serta struk laundry. Default <b>58 mm</b>. Panjang kertas mengikuti isi struk secara otomatis. Di jendela cetak, pilih printer thermal dan atur <b>Margin: Tidak ada</b>.</p>
        <h4 class="cfg-sub">Pesan penutup struk</h4>
        <div class="field"><label>Struk sewa</label><textarea class="textarea" name="footerRent" rows="2" maxlength="200">${esc(r.footerRent)}</textarea></div>
        <div class="field"><label>Struk penjualan</label><textarea class="textarea" name="footerSale" rows="2" maxlength="200">${esc(r.footerSale)}</textarea></div>
      </form></div>${saveBar('saveNt')}`;
      $('#saveNt').addEventListener('click', () => {
        const E = $('#ntf').elements;
        const next = Object.assign({}, S(), { receipt: { paper: +$('#ntf').querySelector('input[name="paper"]:checked').value, footerRent: E.footerRent.value.trim(), footerSale: E.footerSale.value.trim() } });
        cfgSave(next, 'Mengubah pengaturan nota & struk', [['receipt', 'Struk kasir', (v) => (v ? `${v.paper} mm` : '-')]]);
      });
    },
    /* ---------- Tampilan beranda: Produk Rental Terlaris ---------- */
    beranda() {
      const hb = Object.assign({ mode: 'gabungan', days: 90, count: 6, onlyAvailable: true }, S().homeBest || {});
      const opt = (v, t, d) => `<label class="pk-opt"><input type="radio" name="mode" value="${v}" ${hb.mode === v ? 'checked' : ''}><span><i class="fa-solid ${v === 'otomatis' ? 'fa-chart-line' : v === 'manual' ? 'fa-hand-pointer' : 'fa-layer-group'}"></i><b>${t}</b><small>${d}</small></span></label>`;
      const draw = () => {
        const prev = DB.homeBest();
        $('#hbPrev').innerHTML = prev.items.length ? prev.items.map((x, i) => `<li><span class="hb-n">${i + 1}</span><img loading="lazy" decoding="async" src="${UI.asset(x.p.img)}" alt=""><span class="hb-name">${esc(x.p.name)}</span>${x.pinned ? '<span class="pill gray plain">Disematkan</span>' : ''}<span class="hb-c">${x.n ? `${x.n}× disewa` : 'cadangan (rating)'}</span></li>`).join('') : '<li class="muted">Belum ada barang yang memenuhi.</li>';
      };
      $('#cfgMain').innerHTML = head('Tampilan Beranda', 'Mengatur isi section "Produk Rental Terlaris" di beranda customer.') + `<div class="panel"><form id="hbf" novalidate>
        <h4 class="cfg-sub" style="margin-top:0">Sumber data</h4>
        <div class="pk-opts hb-modes">${opt('gabungan', 'Gabungan (disarankan)', 'Barang yang disematkan admin tampil dulu (maks. setengah), sisanya otomatis dari yang paling sering disewa.')}${opt('otomatis', 'Otomatis', 'Murni dari jumlah sewa. Judul: "Produk Rental Terlaris".')}${opt('manual', 'Manual', 'Hanya barang yang disematkan admin. Judul berubah jadi "Produk Pilihan Kami".')}</div>
        <div class="grid-3" style="margin-top:14px">
          <div class="field"><label>Periode hitung</label><select class="select" name="days">${[[30, '30 hari terakhir'], [90, '90 hari terakhir'], [0, 'Sepanjang waktu']].map(([v, l]) => `<option value="${v}" ${+hb.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint">Booking yang dibatalkan tidak dihitung. Isi paket ikut dihitung per barang.</span></div>
          <div class="field"><label>Jumlah barang tampil</label><select class="select" name="count">${[4, 6, 8].map((v) => `<option ${+hb.count === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <label class="chk-line"><input type="checkbox" name="onlyAvailable" ${hb.onlyAvailable ? 'checked' : ''}> Sembunyikan barang yang stoknya habis hari ini</label>
        <p class="muted" style="font-size:12.5px;margin-top:6px"><i class="fa-solid fa-circle-info"></i> Sematkan barang lewat <b>Data Barang → Edit → "Sematkan di beranda"</b>. 3 barang teratas otomatis mendapat label <b>Terlaris</b>. Kartu "Barang paling sering disewa" di dashboard admin memakai periode yang sama.</p>
        <h4 class="cfg-sub">Pratinjau (dengan pengaturan tersimpan)</h4><ol class="hb-prev" id="hbPrev"></ol>
      </form></div>${saveBar('saveHb')}
      <div class="panel" style="margin-top:18px"><h4 class="cfg-sub" style="margin-top:0">Tata cara di beranda</h4>
        <p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Langkah yang tampil di section "Cara Sewa | Cara Beli" beranda. Minimal 2, maksimal 5 langkah.</p>
        <div class="seg biz-view" id="htTab"><button type="button" data-ht="sewa" class="active">Cara Sewa</button><button type="button" data-ht="beli">Cara Beli</button></div>
        <div id="htList" class="ht-list"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn btn-light btn-sm" id="htAdd"><i class="fa-solid fa-plus"></i> Tambah langkah</button><button type="button" class="btn btn-ghost btn-sm" id="htReset"><i class="fa-solid fa-rotate-left"></i> Kembalikan ke bawaan</button></div>
      </div>${saveBar('saveHt')}`;
      draw();
      $('#saveHb').addEventListener('click', () => {
        const E = $('#hbf').elements;
        const next = Object.assign({}, S(), { homeBest: { mode: $('#hbf').querySelector('input[name="mode"]:checked').value, days: +E.days.value, count: +E.count.value, onlyAvailable: E.onlyAvailable.checked } });
        const fmt = (v) => (v ? `${{ gabungan: 'Gabungan', otomatis: 'Otomatis', manual: 'Manual' }[v.mode] || v.mode}, ${+v.days ? v.days + ' hari' : 'semua waktu'}, ${v.count} barang` : '-');
        cfgSave(next, 'Mengubah tampilan beranda (Produk Rental Terlaris)', [['homeBest', 'Produk Rental Terlaris', fmt]]);
      });
      /* Editor tata cara sewa / beli */
      const ICONS = [['fa-calendar-days', 'Kalender'], ['fa-magnifying-glass', 'Cari'], ['fa-bag-shopping', 'Tas belanja'], ['fa-cart-shopping', 'Keranjang'], ['fa-clipboard', 'Form'], ['fa-credit-card', 'Pembayaran'], ['fa-qrcode', 'QRIS'], ['fa-receipt', 'Nota'], ['fa-box', 'Paket/kemas'], ['fa-store', 'Toko'], ['fa-person-hiking', 'Pendaki'], ['fa-campground', 'Tenda'], ['fa-rotate-left', 'Kembali'], ['fa-circle-check', 'Selesai']];
      const ht = JSON.parse(JSON.stringify(S().howto || {})); let htK = 'sewa';
      const drawHt = () => {
        $('#htList').innerHTML = (ht[htK] || []).map((x, i) => `<div class="ht-row"><span class="ht-n">${i + 1}</span>
          <select class="select" data-hi="${i}" data-hf="icon">${ICONS.map(([v, l]) => `<option value="${v}" ${x.icon === v ? 'selected' : ''}>${l}</option>`).join('')}</select><i class="fa-solid ${esc(x.icon)} ht-ic"></i>
          <input class="input" data-hi="${i}" data-hf="title" value="${esc(x.title)}" maxlength="30" placeholder="Judul langkah">
          <input class="input ht-text" data-hi="${i}" data-hf="text" value="${esc(x.text)}" maxlength="120" placeholder="Penjelasan singkat">
          <span class="ht-mv"><button type="button" class="icon-btn sm" data-hup="${i}" ${i ? '' : 'disabled'} aria-label="Naikkan"><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="icon-btn sm" data-hdel="${i}" aria-label="Hapus" ${(ht[htK] || []).length <= 2 ? 'disabled' : ''}><i class="fa-solid fa-trash-can"></i></button></span></div>`).join('');
        $('#htAdd').disabled = (ht[htK] || []).length >= 5;
      };
      drawHt();
      $('#htTab').addEventListener('click', (e) => { const b = e.target.closest('[data-ht]'); if (!b) return; htK = b.dataset.ht; $$('#htTab [data-ht]').forEach((x) => x.classList.toggle('active', x === b)); drawHt(); });
      $('#htList').addEventListener('input', (e) => { const i = e.target.dataset.hi; if (i == null) return; ht[htK][+i][e.target.dataset.hf] = e.target.value; if (e.target.dataset.hf === 'icon') drawHt(); });
      $('#htList').addEventListener('change', (e) => { if (e.target.dataset.hf === 'icon') { ht[htK][+e.target.dataset.hi].icon = e.target.value; drawHt(); } });
      $('#htList').addEventListener('click', (e) => { const u = e.target.closest('[data-hup]'); if (u) { const i = +u.dataset.hup; [ht[htK][i - 1], ht[htK][i]] = [ht[htK][i], ht[htK][i - 1]]; drawHt(); } const d = e.target.closest('[data-hdel]'); if (d) { ht[htK].splice(+d.dataset.hdel, 1); drawHt(); } });
      $('#htAdd').addEventListener('click', () => { ht[htK].push({ icon: 'fa-circle-check', title: '', text: '' }); drawHt(); });
      $('#htReset').addEventListener('click', () => { ht[htK] = JSON.parse(JSON.stringify(Ann.DEFAULT_SETTINGS.howto[htK])); drawHt(); toast('Langkah dikembalikan ke bawaan (belum disimpan).'); });
      $('#saveHt').addEventListener('click', () => {
        for (const k of ['sewa', 'beli']) { if ((ht[k] || []).some((x) => !String(x.title).trim() || !String(x.text).trim())) { toast(`Lengkapi judul & penjelasan semua langkah ${k === 'sewa' ? 'Cara Sewa' : 'Cara Beli'}.`, 'err'); return; } }
        const fmt = (v) => (v || []).map((x, i) => `${i + 1}. ${x.title}`).join(' · ');
        cfgSave(Object.assign({}, S(), { howto: { sewa: ht.sewa, beli: ht.beli } }), 'Mengubah tata cara sewa/beli di beranda', [['howto', 'Tata cara', (v) => `Sewa: ${fmt(v && v.sewa)} | Beli: ${fmt(v && v.beli)}`]]);
      });
    },
    /* ---------- Aturan rental ---------- */
    rental() {
      const st = S();
      $('#cfgMain').innerHTML = head('Aturan Rental', 'Dipakai otomatis saat customer booking, di keranjang, nota, dan halaman Tentang Kami.') + `<div class="panel"><form id="rf" novalidate>
        <div class="grid-3">
          <div class="field"><label>Minimal DP (%)</label><input class="input" type="number" min="10" max="100" name="dpPercent" value="${st.dpPercent}"><span class="hint">Dibayar customer untuk mengunci booking.</span></div>
          <div class="field"><label>Batas waktu bayar DP (jam)</label><input class="input" type="number" min="1" max="48" name="payWindowHours" value="${st.payWindowHours || 1}"><span class="hint">Lewat batas ini, booking yang belum dibayar dibatalkan otomatis.</span></div>
          <div class="field"><label>Maksimal lama sewa (malam)</label><input class="input" type="number" min="1" max="60" name="maxRentDays" value="${st.maxRentDays || 14}"></div>
          <div class="field"><label>Jam batas pengembalian</label><input class="input" type="time" name="returnTime" value="${st.returnTime || '22:00'}"><span class="hint">Sesuai price list: jam tutup toko 22.00 WIB.</span></div>
        </div>
        <label class="chk-line" style="margin-top:0"><input type="checkbox" name="lateAfterReturnTime" ${st.lateAfterReturnTime ? 'checked' : ''}> Barang yang kembali di hari terakhir <b>setelah jam batas</b> dihitung terlambat 1 hari</label>
        <h4 class="cfg-sub">Ketentuan rental (tampil di website)</h4>${listEditor('terms', st.rentalTerms, 'Contoh: Penyewa wajib menyerahkan KTP asli')}
      </form></div>${saveBar('saveRental')}
      <div class="panel" style="margin-top:18px" id="durPanel"></div>`;
      drawDur();
      $('#saveRental').addEventListener('click', () => {
        const F = $('#rf'), E = F.elements;
        if (!validate(F, { dpPercent: (v) => (!(+v >= 10 && +v <= 100) ? 'Isi 10–100.' : ''), payWindowHours: (v) => (!(+v >= 1 && +v <= 48) ? 'Isi 1–48 jam.' : ''), maxRentDays: (v) => (!(+v >= 1) ? 'Minimal 1.' : ''), returnTime: (v) => (!v ? 'Isi jam.' : '') })) return;
        const next = Object.assign({}, S(), { dpPercent: +E.dpPercent.value, payWindowHours: +E.payWindowHours.value, maxRentDays: +E.maxRentDays.value, returnTime: E.returnTime.value, lateAfterReturnTime: E.lateAfterReturnTime.checked, rentalTerms: readLines('terms') });
        cfgSave(next, 'Mengubah aturan rental', [['dpPercent', 'Minimal DP (%)'], ['payWindowHours', 'Batas waktu bayar DP (jam)'], ['maxRentDays', 'Maksimal lama sewa (hari)'], ['returnTime', 'Jam batas pengembalian'], ['lateAfterReturnTime', 'Terlambat bila lewat jam batas', (v) => (v ? 'Ya' : 'Tidak')], ['rentalTerms', 'Ketentuan rental', (v) => `${v.length} poin`]]);
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
          <label><input type="radio" name="lateFeeMode" value="persen" ${st.lateFeeMode !== 'nominal' ? 'checked' : ''}><span><b>Persentase harga sewa</b><small>Contoh 100% = denda sama dengan harga sewa per malam</small></span></label>
          <label><input type="radio" name="lateFeeMode" value="nominal" ${st.lateFeeMode === 'nominal' ? 'checked' : ''}><span><b>Nominal tetap</b><small>Contoh Rp20.000 per barang per malam</small></span></label></div></div>
        <div class="grid-2">
          <div class="field" id="fPct"><label>Persentase (% harga sewa / malam)</label><input class="input" type="number" min="0" max="300" name="lateFeePercent" value="${st.lateFeePercent}"></div>
          <div class="field" id="fAmt"><label>Nominal (Rp / barang / malam)</label><input class="input" type="number" min="0" step="1000" name="lateFeeAmount" value="${st.lateFeeAmount || 0}"></div>
        </div>
        <div class="notice green" id="dPrev"></div>
        <h4 class="cfg-sub">Aturan kerusakan & kehilangan</h4>${listEditor('dmg', st.damageRules || [], 'Contoh: Hilang = mengganti 100% harga barang')}
      </form></div>${saveBar('saveDenda')}`;
      const F = $('#df'), E = F.elements;
      const prev = () => { const nom = E.lateFeeMode.value === 'nominal'; $('#fPct').hidden = nom; $('#fAmt').hidden = !nom;
        $('#dPrev').innerHTML = `<i class="fa-solid fa-calculator"></i><div>Contoh: menyewa 2 barang @ ${rupiah(50000)}/malam, terlambat 1 malam (lewat jam batas) → denda <strong>${rupiah(nom ? (+E.lateFeeAmount.value || 0) * 2 : 100000 * (+E.lateFeePercent.value || 0) / 100)}</strong>.</div>`; };
      F.addEventListener('input', prev); prev();
      $('#saveDenda').addEventListener('click', () => {
        cfgSave(Object.assign({}, S(), { lateFeeMode: E.lateFeeMode.value, lateFeePercent: +E.lateFeePercent.value || 0, lateFeeAmount: +E.lateFeeAmount.value || 0, damageRules: readLines('dmg') }), 'Mengubah aturan denda',
          [['lateFeeMode', 'Cara hitung denda', (v) => (v === 'nominal' ? 'Nominal tetap' : 'Persentase')], ['lateFeePercent', 'Denda (%)'], ['lateFeeAmount', 'Denda nominal', rupiah], ['damageRules', 'Aturan kerusakan', (v) => `${v.length} poin`]]);
      });
    },
    stok() {
      const st = S(); const q = DB.careQueue(); const wc = DB.washCats();
      $('#cfgMain').innerHTML = head('Perawatan & Stok', 'Aturan pembersihan, perawatan berkala, dan pengingat stok. Setiap barang tetap bisa punya nilai sendiri di form barang (Data Barang → Edit).') + `<div class="panel"><form id="kf" novalidate>
        <h4 class="cfg-sub" style="margin-top:0"><i class="fa-solid fa-soap" style="color:var(--g600)"></i> Wajib dicuci / dibersihkan setiap kembali</h4>
        <p class="muted" style="font-size:13px;margin:-4px 0 10px">Unit dari kategori yang dicentang otomatis masuk antrian cuci saat staff mencatat barang kembali, dan staff mendapat pengingat. Unit belum bisa diserahkan ke customer sampai ditandai bersih.</p>
        <div class="cat-checks" id="wc">${DB.categories(true).map((c) => `<label><input type="checkbox" value="${c.id}" ${wc.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>
        <h4 class="cfg-sub"><i class="fa-solid fa-calendar-check" style="color:var(--g600)"></i> Perawatan berkala & stok</h4>
        <div class="grid-2">
          <div class="field"><label>Perawatan berkala setiap … kali disewa</label><input class="input" type="number" min="1" max="100" name="serviceEvery" value="${st.serviceEvery || 10}"><span class="hint">Pengecekan menyeluruh rutin (cek frame, lapisan anti air). Hanya pengingat — unit tetap bisa disewa.</span></div>
          <div class="field"><label>Stok minimum default barang jual</label><input class="input" type="number" min="0" name="minStockDefault" value="${st.minStockDefault ?? 2}"><span class="hint">Di bawah angka ini muncul di "Stok jual menipis".</span></div>
        </div>
        <div class="notice green"><i class="fa-solid fa-circle-info"></i><div>Saat ini: <b>${q.cuci.length}</b> unit perlu dicuci, <b>${q.perbaikan.length}</b> dalam perbaikan, <b>${q.berkala.length}</b> jatuh tempo perawatan berkala, <b>${DB.lowStock().length}</b> barang jual di bawah minimum. <a class="link" href="${Admin.A('perawatan')}">Buka Perawatan Unit</a></div></div>
      </form></div>${saveBar('saveStok')}`;
      $('#saveStok').addEventListener('click', () => {
        const F = $('#kf'), E = F.elements;
        if (!validate(F, { serviceEvery: (v) => (!(+v >= 1) ? 'Minimal 1.' : '') })) return;
        const washCats = $$('#wc input:checked').map((x) => x.value);
        cfgSave(Object.assign({}, S(), { serviceEvery: +E.serviceEvery.value, minStockDefault: Math.max(0, +E.minStockDefault.value || 0), washCats }), 'Mengubah aturan perawatan & stok',
          [['washCats', 'Wajib dicuci setiap kembali', (v) => (v || []).map(catName).join(', ') || '—'], ['serviceEvery', 'Perawatan berkala tiap … kali sewa'], ['minStockDefault', 'Stok minimum default']]);
      });
    },
    keuangan() {
      const fc = S().financeCats || { in: [], out: [] };
      const FN = Object.assign({ saleShipLedger: false, saleShipLine: 'sale', rentShipLine: 'rent' }, S().finance || {});
      const LBL = { rent: 'Rental', sale: 'Penjualan', umum: 'Umum' };
      const finBlock = `<div class="panel" style="margin-bottom:18px"><div class="panel-h"><h3><i class="fa-solid fa-truck-fast"></i> Pencatatan ongkir</h3></div>
        <div class="field"><label>Ongkir penjualan (barang yang dikirim ke customer)</label>
          <label class="chk-line"><input type="radio" name="ssl" value="0" ${FN.saleShipLedger ? '' : 'checked'}> <span><b>Tidak dicatat di keuangan</b>: titipan customer yang diteruskan ke ekspedisi. <span class="pill green plain">Ketentuan mitra</span><br><small class="muted">Contoh: beli Rp155 rb + ongkir Rp20 rb → yang tercatat hanya Rp155 rb. Ongkir tetap tampil di invoice &amp; status bayar.</small></span></label>
          <label class="chk-line"><input type="radio" name="ssl" value="1" ${FN.saleShipLedger ? 'checked' : ''}> <span><b>Dicatat sebagai pemasukan</b> lini <select class="select sm" id="sslLine" style="width:auto;display:inline-block">${['sale', 'umum', 'rent'].map((k) => `<option value="${k}" ${FN.saleShipLine === k ? 'selected' : ''}>${LBL[k]}</option>`).join('')}</select><br><small class="muted">Pilih ini bila ongkir menjadi penghasilan toko (mis. diantar staff sendiri).</small></span></label></div>
        <div class="field" style="max-width:420px"><label>Ongkir antar-jemput &amp; jasa tenda untuk <b>sewa</b> masuk lini</label><select class="select" id="rslLine">${['rent', 'umum'].map((k) => `<option value="${k}" ${FN.rentShipLine === k ? 'selected' : ''}>${LBL[k]}${k === 'rent' ? ' (ketentuan mitra)' : ''}</option>`).join('')}</select><span class="hint">Staff toko yang mengantar / memasang tenda = penghasilan toko.</span></div>
        <button type="button" class="btn btn-primary btn-sm" id="saveFin"><i class="fa-solid fa-floppy-disk"></i> Simpan pencatatan ongkir</button></div>
        <div class="panel" style="margin-bottom:18px"><div class="panel-h"><h3><i class="fa-solid fa-sitemap"></i> Panduan lini (otomatis di form Keuangan)</h3></div>
        <div class="table-wrap" data-no-paginate><table class="table"><thead><tr><th>Lini</th><th>Pemasukan</th><th>Pengeluaran</th></tr></thead><tbody>
          <tr><td><b>Rental</b></td><td>Sewa, DP, denda, laundry, jasa tenda, ongkir sewa (otomatis)</td><td>Restock barang sewa (otomatis dari Data Barang), perawatan &amp; perbaikan (otomatis), deterjen &amp; kebutuhan laundry, bensin antar-jemput sewa, kebutuhan rental lainnya</td></tr>
          <tr><td><b>Penjualan</b></td><td>Penjualan barang (otomatis, tanpa ongkir)</td><td>Restock barang jual (otomatis dari Data Barang; jadi modal saat terjual), kemasan barang jual</td></tr>
          <tr><td><b>Umum</b></td><td>Pemasukan lain (opsional), mis. sewa lapak event</td><td>Wifi/internet, listrik &amp; air, gaji staff, sewa tempat, promosi, operasional lainnya (opsional)</td></tr>
        </tbody></table></div><p class="muted" style="font-size:12.5px;margin:8px 0 0">Laba bersih toko = Laba Rental + Laba Penjualan + (pemasukan Umum − pengeluaran Umum).</p></div>`;
      const box = (k, t, arr) => `<div class="panel"><div class="panel-h"><h3>${t}</h3></div><p class="muted" style="font-size:13px;margin:-6px 0 12px">Satu kategori per baris.</p><textarea class="textarea" id="fc-${k}" rows="8">${esc(arr.join('\n'))}</textarea></div>`;
      $('#cfgMain').innerHTML = head('Keuangan & Ongkir', 'Pilihan kategori saat staff mencatat pemasukan lain dan pengeluaran. Pemasukan dari rental, penjualan, denda, dan refund tetap tercatat otomatis.')
        + finBlock + `<div class="grid-dash" style="grid-template-columns:1fr 1fr">${box('in', 'Pemasukan lainnya', fc.in)}${box('out', 'Pengeluaran (jenis biaya)', fc.out)}</div>${saveBar('saveFc')}`;
      $('#saveFin').addEventListener('click', () => {
        const next = { saleShipLedger: $('[name=ssl]:checked').value === '1', saleShipLine: $('#sslLine').value, rentShipLine: $('#rslLine').value };
        const old = Object.assign({ saleShipLedger: false, saleShipLine: 'sale', rentShipLine: 'rent' }, S().finance || {});
        if (JSON.stringify(old) === JSON.stringify(next)) { toast('Tidak ada perubahan.'); return; }
        const desc = (v) => `ongkir penjualan ${v.saleShipLedger ? 'dicatat (lini ' + LBL[v.saleShipLine] + ')' : 'tidak dicatat'} · ongkir sewa lini ${LBL[v.rentShipLine]}`;
        DB.saveConfig('finance', next, 'Mengubah pencatatan ongkir', [{ field: 'Pencatatan ongkir', from: desc(old), to: desc(next) }]); toast('Pencatatan ongkir disimpan. Berlaku untuk rekap keuangan & dashboard.'); R.keuangan();
      });
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
      $('#cfgMain').innerHTML = head('Form & Field Staff', 'Tentukan isian yang wajib diisi staff sesuai SOP toko. Foto barang bawaannya opsional karena staff lebih sering memakai komputer; ubah ke Wajib bila memang diperlukan.')
        + `<div class="grid-dash" style="grid-template-columns:1fr 1fr" id="formCards"></div>${saveBar('saveForm')}
          <div class="cfg-block" style="margin-top:18px"><h3><i class="fa-regular fa-id-card"></i> Jenis kartu identitas jaminan</h3>
            <p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Pilihan di kasir, catat barang keluar, dan checkout customer. Pilihan <b>Lainnya</b> (ketik manual, mis. Paspor) selalu tersedia.</p>
            <div class="field" style="max-width:520px"><input class="input" id="idTypes" value="${esc(DB.idTypes().join(', '))}" placeholder="KTP, KTM, SIM, Kartu Pelajar"><span class="hint">Pisahkan dengan koma.</span></div>
            <button type="button" class="btn btn-primary btn-sm" id="saveIdT"><i class="fa-solid fa-floppy-disk"></i> Simpan jenis identitas</button></div>`;
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
      $('#saveIdT').addEventListener('click', () => { const L = [...new Set(lines($('#idTypes').value).filter((x) => !/^lain/i.test(x)))];
        if (!L.length) { toast('Isi minimal satu jenis identitas.', 'err'); return; }
        const old = DB.idTypes(); if (old.join('|') === L.join('|')) { toast('Tidak ada perubahan.'); return; }
        DB.saveConfig('idTypes', L, 'Mengubah jenis kartu identitas jaminan', [{ field: 'Jenis identitas', from: old.join(', '), to: L.join(', ') }]); toast('Jenis identitas disimpan.'); R.form(); });
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
      <div class="field"><label>Gambar kategori</label><div style="display:flex;gap:12px;align-items:center"><img id="cPrev" src="${asset(img)}" style="width:72px;height:72px;object-fit:cover;border-radius:10px"><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Ganti gambar<input type="file" accept="image/*" id="cImg" hidden></label></div></div>
      <p class="muted" style="font-size:12.5px">Atribut untuk kategori ini diatur di bagian <b>Atribut Barang</b>.</p></form>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="cSave">Simpan</button>' });
    m.$('#cImg').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; e.target.value = ''; const out = await UI.cropImage(f, { aspect: 1, size: 600, title: 'Atur gambar kategori' }); if (!out) return; img = out; m.$('#cPrev').src = img; });
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
      <div class="field"><label>Tipe</label><select class="select" name="atype">${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint type-hint" id="typeHint"></span></div></div>
      <div class="field" id="valF"><label>Nilai pilihan</label><div class="tag-input" id="tags"></div><input class="input" id="tagIn" placeholder="Ketik nilai lalu Enter (contoh: S, M, L, XL)"><span class="hint">Nilai yang sudah dipakai barang tidak bisa dikeluarkan.</span></div>
      <div class="field"><label>Berlaku untuk kategori</label><div class="cat-checks">${cats.map((c) => `<label><input type="checkbox" value="${c.id}" ${(a.cats || []).includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div><span class="hint">Tidak dicentang semua = berlaku untuk semua kategori.</span></div>
      <label class="chk-line" id="varF"><input type="checkbox" name="avariant" ${a.variant ? 'checked' : ''}> <span><b>Jadikan varian stok</b> — stok dihitung per nilai dan customer wajib memilih saat menyewa/membeli<small class="chk-help">Centang bila tiap nilai adalah unit fisik berbeda yang dipilih customer, mis. ukuran sepatu 39–43 atau ukuran jaket M/L/XL. Jangan dicentang untuk keterangan saja seperti kapasitas tenda.</small></span></label>
      <label class="chk-line"><input type="checkbox" name="areq" ${a.required ? 'checked' : ''}> <span>Wajib diisi staff saat menambah / mengedit barang di kategori tersebut<small class="chk-help">Barang tidak bisa disimpan sebelum atribut ini diisi. Centang hanya bila semua barang di kategori itu pasti punya nilai ini (mis. ukuran sepatu di Footwear), bukan untuk kategori campuran seperti Fashion yang berisi topi & kacamata.</small></span></label>
      </form>`, foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="aSave"><i class="fa-solid fa-floppy-disk"></i> Simpan atribut</button>' });
    const F = m.$('#af'), E = F.elements;
    const TYPE_HELP = {
      pilihan: '<b>Pilihan:</b> nilai dipilih dari daftar yang kamu buat di bawah, mis. S, M, L atau 2 orang, 4 orang. Penulisan jadi seragam dan bisa dijadikan varian stok.',
      teks: '<b>Teks bebas:</b> staff mengetik sendiri isinya per barang, mis. Bahan "Nylon ripstop 420D". Cocok untuk keterangan yang berbeda-beda.',
      angka: '<b>Angka:</b> hanya boleh diisi angka, mis. Berat 1,2 (kg) atau Powerbank 10000 (mAh). Tidak ada salah ketik huruf.',
    };
    const drawTags = () => {
      m.$('#typeHint').innerHTML = TYPE_HELP[E.atype.value] || '';
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
