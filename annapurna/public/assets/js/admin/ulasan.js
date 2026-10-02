(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('ulasan', 'Ulasan & Testimoni');
  const MAX = 6;
  $('#viewHome').href = url('./') + '#testimoni';
  let tab = param('tab') || 'semua';
  const fresh = new Set(DB.reviews().filter((r) => !r.seen).map((r) => r.id));
  if (fresh.size) { DB.set('reviews', DB.reviews().map((r) => Object.assign(r, { seen: true }))); Admin.refreshShell(); }
  const TABS = [['semua', 'Semua'], ['baru', 'Baru'], ['beranda', 'Tampil di Beranda'], ['rendah', 'Rating ≤ 3'], ['sembunyi', 'Disembunyikan']];
  const match = (r, k) => k === 'semua' || (k === 'baru' && fresh.has(r.id)) || (k === 'beranda' && r.featured && r.visible) || (k === 'rendah' && r.rating <= 3) || (k === 'sembunyi' && !r.visible);
  const featuredList = () => DB.testimonials();
  const txLink = (id) => (DB.booking(id) ? `booking?id=${id}` : DB.sale(id) ? `penjualan?id=${id}` : '');
  function list() {
    const q = $('#q').value.trim().toLowerCase(), fr = $('#fRate').value;
    let L = DB.reviews().filter((r) => match(r, tab) && (!fr || r.rating === +fr) && (!q || [r.name, r.text, r.refId].join(' ').toLowerCase().includes(q)));
    if (tab === 'beranda') L = featuredList();
    else L.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return L;
  }

  function draw() {
    const all = DB.reviews(), sum = DB.ratingSummary(), vis = all.filter((r) => r.visible);
    const avgNew = vis.length ? (vis.reduce((a, r) => a + r.rating, 0) / vis.length).toFixed(1).replace('.', ',') : '–';
    const st = (ic, tone, l, v, d) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></div>`;
    $('#stats').innerHTML = st('fa-star', 'gold', 'Rating toko', sum.avg.toLocaleString('id-ID'), `dari ${sum.count} penilaian`) + st('fa-comment-dots', '', 'Ulasan tertulis', all.length, `rata-rata ${avgNew}`)
      + st('fa-house', 'blue', 'Tampil di beranda', `${featuredList().length}/${MAX}`, 'pilih dengan ikon pin') + st('fa-eye-slash', 'red', 'Disembunyikan', all.filter((r) => !r.visible).length, '');
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l} <span class="cnt">${all.filter((r) => match(r, k)).length}</span></button>`).join('');
    const L = list(), F = featuredList();
    $('#list').innerHTML = (tab === 'beranda' && L.length ? `<div class="notice green" style="margin-bottom:12px"><i class="fa-solid fa-arrows-up-down"></i><div>Urutan di bawah sama dengan urutan testimoni di beranda. Gunakan tombol panah untuk mengatur urutan.</div></div>` : '')
      + (L.length ? L.map((r, i) => {
        const link = txLink(r.refId); const prods = r.productIds.map((id) => DB.product(id)).filter(Boolean);
        return `<article class="rv-card ${r.visible ? '' : 'is-hidden'}">
          <div class="rv-h">
            <span class="rv-av">${r.img ? `<img src="${asset(r.img)}" alt="">` : esc(r.name.charAt(0))}</span>
            <div class="who"><strong>${esc(r.name)}</strong>${fresh.has(r.id) ? ' <span class="pill amber plain">Baru</span>' : ''}${r.featured && r.visible ? ' <span class="pill green plain"><i class="fa-solid fa-thumbtack"></i> Beranda</span>' : ''}${!r.visible ? ' <span class="pill gray plain">Disembunyikan</span>' : ''}
              <small>${D.fmtDateTime(r.createdAt)} · ${r.type === 'rent' ? 'Rental' : 'Pembelian'} ${link ? `<a href="${link}" style="color:var(--g700);font-weight:700">${r.refId}</a>` : r.refId}</small></div>
            <span class="rv-stars">${UI.stars(r.rating, false)}</span>
          </div>
          <p class="rv-text">${esc(r.text)}</p>
          ${prods.length ? `<div class="rv-prods">${prods.map((p) => `<span class="stock-chip"><img src="${asset(p.img)}" alt="" style="width:18px;height:14px;object-fit:cover;border-radius:3px"> ${esc(p.name)}</span>`).join('')}</div>` : ''}
          ${r.reply ? `<div class="rv-reply"><strong><i class="fa-solid fa-reply"></i> Balasan toko${r.replyAt ? ` · ${D.fmtDate(r.replyAt, true)}` : ''}</strong> ${esc(r.reply)}${r.replySeen === false ? '<small class="muted" style="display:block;margin-top:4px"><i class="fa-regular fa-envelope"></i> Belum dibaca customer</small>' : r.replySeen ? '<small class="muted" style="display:block;margin-top:4px"><i class="fa-solid fa-check-double"></i> Sudah dibaca customer</small>' : ''}</div>` : ''}
          <div class="rv-acts">
            ${tab === 'beranda' ? `<button class="btn btn-light btn-xs" data-up="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan"><i class="fa-solid fa-arrow-up"></i></button><button class="btn btn-light btn-xs" data-down="${r.id}" ${i === L.length - 1 ? 'disabled' : ''} aria-label="Turunkan"><i class="fa-solid fa-arrow-down"></i></button>` : ''}
            ${r.visible ? `<button class="btn ${r.featured ? 'btn-primary' : 'btn-light'} btn-xs" data-feat="${r.id}"><i class="fa-solid fa-thumbtack"></i> ${r.featured ? 'Hapus dari beranda' : 'Tampilkan di beranda'}</button>` : ''}
            <button class="btn btn-light btn-xs" data-reply="${r.id}"><i class="fa-solid fa-reply"></i> ${r.reply ? 'Ubah balasan' : 'Balas'}</button>
            <button class="btn ${r.visible ? 'btn-light' : 'btn-primary'} btn-xs" data-vis="${r.id}"><i class="fa-regular ${r.visible ? 'fa-eye-slash' : 'fa-eye'}"></i> ${r.visible ? 'Sembunyikan' : 'Tampilkan lagi'}</button>
          </div>
        </article>`;
      }).join('') : `<div class="panel empty-state"><div class="ic"><i class="fa-regular fa-star"></i></div><h3>Tidak ada ulasan</h3><p>${tab === 'beranda' ? 'Belum ada testimoni yang dipilih. Buka tab Semua lalu klik "Tampilkan di beranda".' : 'Ulasan pelanggan akan muncul di sini setelah rental / pembelian selesai.'}</p></div>`);
  }
  const save = (r) => DB.saveReview(r);
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { tab = b.dataset.tab; draw(); } });
  ['#q', '#fRate'].forEach((s) => $(s).addEventListener('input', draw));
  $('#list').addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const id = t.dataset.feat || t.dataset.vis || t.dataset.reply || t.dataset.up || t.dataset.down; if (!id) return;
    const r = DB.review(id);
    if (t.dataset.feat) {
      if (!r.featured && DB.testimonials().length >= MAX) { toast(`Maksimal ${MAX} testimoni di beranda. Hapus salah satu dulu.`, 'err'); return; }
      const F0 = DB.testimonials(); F0.forEach((x, k) => { x.order = k; save(x); });
      const cur = DB.review(id); cur.featured = !cur.featured; cur.order = cur.featured ? F0.length : undefined; save(cur); r.featured = cur.featured;
      DB.audit({ type: 'ulasan', action: `${r.featured ? 'Menampilkan' : 'Melepas'} ulasan ${r.name} ${r.featured ? 'di' : 'dari'} testimoni beranda`, ref: r.id });
      toast(r.featured ? 'Ulasan ditampilkan di beranda.' : 'Ulasan dihapus dari beranda.');
    }
    if (t.dataset.vis) {
      if (r.visible && !(await confirmBox({ title: 'Sembunyikan ulasan?', text: 'Ulasan tidak akan tampil di halaman produk maupun beranda, dan tidak dihitung dalam rating.', ok: 'Sembunyikan', danger: true }))) return;
      r.visible = !r.visible; if (!r.visible) r.featured = false; save(r);
      DB.audit({ type: 'ulasan', action: `${r.visible ? 'Menampilkan kembali' : 'Menyembunyikan'} ulasan ${r.name} (${r.refId})`, ref: r.id, changes: [{ field: 'Tampil', from: r.visible ? 'Tidak' : 'Ya', to: r.visible ? 'Ya' : 'Tidak' }] }); toast(r.visible ? 'Ulasan ditampilkan kembali.' : 'Ulasan disembunyikan.');
    }
    if (t.dataset.reply) {
      const m = modal({ title: `Balas ulasan ${esc(r.name)}`, body: `<blockquote class="rv-quote">${UI.stars(r.rating, false)}<p>${esc(r.text)}</p></blockquote>
        <div class="field"><label>Balasan toko</label><textarea class="textarea" id="rpText" rows="3" maxlength="300" placeholder="Terima kasih atas ulasannya…">${esc(r.reply || '')}</textarea><span class="hint"><span id="rpCnt">0</span>/300</span></div>
        <div class="notice green"><i class="fa-solid fa-globe"></i><div>Balasan bersifat <strong>publik</strong>: tampil di bawah ulasan pada halaman produk${r.featured ? ' dan di testimoni beranda' : ''}. ${esc(r.name)} akan menerima notifikasi.</div></div>`,
        foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rpSave">Simpan balasan</button>` });
      const rc = () => (m.$('#rpCnt').textContent = m.$('#rpText').value.length); m.$('#rpText').addEventListener('input', rc); rc();
      m.$('#rpSave').addEventListener('click', () => { const v = m.$('#rpText').value.trim(); if (!v) { m.$('#rpText').classList.add('err'); return; }
        const isNew = !r.reply; const before = r.reply || ''; r.reply = v;
        DB.audit({ type: 'ulasan', action: `${isNew ? 'Membalas' : 'Mengubah balasan'} ulasan ${r.name} (${r.refId})`, ref: r.id, changes: isNew ? [] : [{ field: 'Balasan', from: before.slice(0, 80), to: v.slice(0, 80) }] }); r.replyAt = D.nowStamp(); r.replySeen = false; save(r); if (r.email) DB.notify(r.email, isNew ? 'Ulasanmu dibalas' : 'Balasan ulasan diperbarui', `Annapurna Adventure: "${v.slice(0, 70)}${v.length > 70 ? '…' : ''}"`, `pesanan?tab=riwayat&review=${r.refId}`); m.close(); toast('Balasan disimpan.'); draw(); });
      return;
    }
    if (t.dataset.up || t.dataset.down) {
      const F = DB.testimonials(); const i = F.findIndex((x) => x.id === id); const j = t.dataset.up ? i - 1 : i + 1;
      [F[i], F[j]] = [F[j], F[i]]; F.forEach((x, k) => { x.order = k; save(x); });
    }
    draw();
  });
  draw();
})();

