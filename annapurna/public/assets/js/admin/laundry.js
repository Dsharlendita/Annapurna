/* Admin · Laundry
   - Pesanan laundry diinput di Kasir (mode Laundry). Halaman ini untuk memantau status, menerima pembayaran, struk, dan kabar ke customer.
   - Laundry tanpa antar jemput: customer antar & ambil sendiri di toko.
   - Daftar harga hanya ditampilkan di sini; Owner mengubahnya di Konfigurasi Sistem → Laundry & Jasa Tenda. */
(function () {
  if (window.Admin.blocked) return;
  const { DB, STATUS, D, rupiah, Laundry, Svc } = Ann;
  const { $, $$, esc, param, toast, pill, bindExport } = UI;
  Admin.init('laundry', 'Laundry');
  const TABS = [['aktif', 'Sedang berjalan'], ['diterima', 'Diterima'], ['dicuci', 'Dicuci'], ['siap', 'Siap'], ['selesai', 'Selesai'], ['dibatalkan', 'Dibatalkan'], ['semua', 'Semua']];
  const ACTIVE = ['diterima', 'dicuci', 'siap'];
  let tab = param('tab') || 'aktif';

  /* ---------- Pesanan ---------- */
  const inTab = (o, k) => (k === 'semua' ? true : k === 'aktif' ? ACTIVE.includes(o.status) : o.status === k);
  function list() {
    const q = $('#q').value.trim().toLowerCase(), f = $('#from').value, t = $('#to').value;
    return DB.laundry().filter((o) => inTab(o, tab)
      && (!q || [o.no, o.customer.name, o.customer.phone, Admin.ldItems(o)].join(' ').toLowerCase().includes(q))
      && (!f || D.day(o.createdAt) >= f) && (!t || D.day(o.createdAt) <= t))
      .sort((a, b) => String(b.createdAt).localeCompare(a.createdAt));
  }
  function draw() {
    const all = DB.laundry();
    const T = D.today(); const mon = T.slice(0, 7);
    const income = all.reduce((a, o) => a + (o.payments || []).filter((p) => D.day(p.at).slice(0, 7) === mon).reduce((x, p) => x + p.amount, 0), 0);
    const unpaid = all.filter((o) => o.status !== 'dibatalkan' && Laundry.paid(o) < Laundry.total(o)).reduce((a, o) => a + Laundry.total(o) - Laundry.paid(o), 0);
    const st = (ic, tone, l, v) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong></div></div>`;
    $('#stats').innerHTML = st('fa-inbox', 'blue', 'Diterima, belum dicuci', all.filter((o) => o.status === 'diterima').length)
      + st('fa-jug-detergent', '', 'Sedang dicuci', all.filter((o) => o.status === 'dicuci').length)
      + st('fa-box', 'gold', 'Siap diambil', all.filter((o) => o.status === 'siap').length)
      + st('fa-coins', 'red', 'Belum dibayar', rupiah(unpaid))
      + st('fa-wallet', 'green', `Pemasukan ${D.BULAN_PANJANG[+mon.slice(5) - 1]}`, rupiah(income));
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l} <span class="cnt">${all.filter((o) => inTab(o, k)).length}</span></button>`).join('');
    const L = list();
    $('#rows').innerHTML = L.length ? L.map((o) => {
      const total = Laundry.total(o), paid = Laundry.paid(o); const nx = Laundry.FLOW[o.status];
      return `<tr>
        <td><strong>${esc(o.no)}</strong><small>${D.fmtDateTime(o.createdAt)}</small></td>
        <td>${esc(o.customer.name)}<small>${esc(o.customer.phone)}</small></td>
        <td style="min-width:190px;max-width:280px">${esc(Admin.ldItems(o))}</td>
        <td style="white-space:nowrap">${D.fmtDate(o.createdAt)}<small>${['selesai', 'dibatalkan'].includes(o.status) ? (o.pickedAt ? 'diambil ' + D.fmtDate(o.pickedAt) : '—') : `selesai ${D.fmtDate(Laundry.est(o))}${Laundry.est(o) < D.today() ? ' · <b style="color:var(--red)">lewat</b>' : Laundry.est(o) === D.today() ? ' · <b style="color:#9a6508">hari ini</b>' : ''}`}</small></td>
        <td class="num">${rupiah(total)}${o.discount ? `<small>diskon ${rupiah(o.discount)}</small>` : ''}</td>
        <td>${pill('payment', paid >= total ? 'paid' : 'unpaid')}${paid && paid < total ? `<small>dibayar ${rupiah(paid)}</small>` : ''}</td>
        <td>${pill('laundry', o.status)}${o.status === 'siap' && !o.notifiedReady ? '<small style="color:var(--red);font-weight:600"><i class="fa-solid fa-bell"></i> belum dikabari</small>' : ''}</td>
        <td><div class="acts">${o.status === 'siap' && !o.notifiedReady ? `<button class="btn btn-wa btn-xs" data-notify="${o.id}"><i class="fa-brands fa-whatsapp"></i> Kabari</button>` : ''}${nx && o.status !== 'dibatalkan' ? `<button class="btn btn-primary btn-xs" data-next="${o.id}"><i class="fa-solid ${nx[1]}"></i> ${nx[2]}</button>` : ''}<button class="btn btn-light btn-xs" data-detail="${o.id}">Detail</button></div></td></tr>`;
    }).join('') : `<tr><td colspan="8"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-solid fa-jug-detergent"></i></div><h3>Tidak ada laundry</h3><p>Input laundry baru dari Kasir saat barang customer diterima.</p></div></td></tr>`;
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { tab = b.dataset.tab; history.replaceState(null, '', '?tab=' + tab); draw(); } });
  ['#q', '#from', '#to'].forEach((s) => $(s).addEventListener('input', draw));
  $('#rows').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-detail]'); if (d) { Admin.laundryModal(d.dataset.detail, draw); return; }
    const nt = e.target.closest('[data-notify]'); if (nt) { Admin.ldNotify(DB.laundryOrder(nt.dataset.notify), draw); return; }
    const n = e.target.closest('[data-next]'); if (!n) return;
    const o = DB.laundryOrder(n.dataset.next); const to = Laundry.FLOW[o.status][0];
    if (to === 'selesai') { Admin.ldPickup(o, draw); return; }
    Admin.ldAdvance(o, to, draw);
  });
  bindExport($('#exp'), () => { const L = list();
    return { filename: `laundry-${D.today()}`, title: 'Data Laundry', subtitle: `Status: ${TABS.find((x) => x[0] === tab)[1]}`,
      summary: [['Jumlah pesanan', String(L.length)], ['Nilai laundry', L.filter((o) => o.status !== 'dibatalkan').reduce((a, o) => a + Laundry.total(o), 0)], ['Sudah dibayar', L.reduce((a, o) => a + Laundry.paid(o), 0)]],
      columns: [{ header: 'No. Nota' }, { header: 'Tanggal' }, { header: 'Customer' }, { header: 'Telepon' }, { header: 'Barang', width: 40 }, { header: 'Estimasi selesai' }, { header: 'Total', type: 'money' }, { header: 'Dibayar', type: 'money' }, { header: 'Status' }],
      rows: L.map((o) => [o.no, D.fmtDateTime(o.createdAt), o.customer.name, o.customer.phone, Admin.ldItems(o), D.fmtDate(Laundry.est(o)), Laundry.total(o), Laundry.paid(o), (STATUS.laundry[o.status] || {}).label || o.status]),
      foot: ['Total', '', '', '', '', '', L.reduce((a, o) => a + Laundry.total(o), 0), L.reduce((a, o) => a + Laundry.paid(o), 0), ''] }; });

  /* ---------- Daftar harga bergambar ----------
     Gambar item bisa diganti admin & owner (langsung tampil di kasir & halaman Laundry website).
     Harga, nama, dan harga minimal "Lain-lain" diubah Owner di Konfigurasi Sistem → Laundry & Jasa Tenda. */
  function drawPrices() {
    const cats = DB.laundryPrices(); const OT = DB.laundryOther();
    const card = (id, img, icon, name, sub, price, other) => `<div class="ld-pic ${other ? 'other' : ''}"><div class="im">${img ? `<img src="${UI.asset(img)}" alt="" loading="lazy">` : `<i class="fa-solid ${esc(icon || 'fa-jug-detergent')}"></i>`}</div>
      <div class="bd"><b>${esc(name)}</b><small>${esc(sub)}</small><span class="pr">${price}</span></div>
      <div class="acts"><label class="btn btn-light btn-xs" style="cursor:pointer"><i class="fa-solid fa-image"></i> ${img ? 'Ganti gambar' : 'Pasang gambar'}<input type="file" accept="image/*" hidden data-ldimg="${esc(id)}"></label>${img ? `<button type="button" class="btn btn-light btn-xs" data-ldimgrm="${esc(id)}" title="Hapus gambar"><i class="fa-solid fa-trash-can"></i></button>` : ''}</div></div>`;
    $('#vPrices').innerHTML = `<div class="card"><div class="card-title" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><span><i class="fa-solid fa-tags"></i> Daftar harga laundry</span>
        ${Admin.isOwner ? `<a class="btn btn-primary btn-sm" href="${UI.url('owner/konfigurasi?s=layanan')}"><i class="fa-solid fa-pen"></i> Ubah harga &amp; daftar</a>` : '<span class="muted" style="font-size:12.5px;font-weight:500"><i class="fa-solid fa-lock"></i> Harga diubah oleh Owner · gambar bisa kamu ganti</span>'}</div>
      <p class="muted" style="font-size:12.5px;margin:-4px 0 14px"><i class="fa-solid fa-circle-info"></i> Gambar tampil di kasir (mode Laundry) dan halaman Laundry di website. Pakai foto barang yang jelas, rasio 4:3.</p>
      ${cats.map((c) => `<h4 class="ld-cat-h"><i class="fa-solid ${esc(c.icon || 'fa-circle')}"></i> ${esc(c.name)}</h4><div class="ld-pics">${c.items.map((i) => card(i.id, i.img, c.icon, i.name, c.name, rupiah(i.price))).join('')}</div>`).join('')}
      ${OT.enabled !== false ? `<h4 class="ld-cat-h"><i class="fa-solid fa-plus"></i> ${esc(OT.name)}</h4><div class="ld-pics">${card('__other', OT.img, 'fa-plus', OT.name, 'Nama & harga diisi manual di kasir', 'mulai ' + rupiah(OT.minPrice), true)}</div>` : ''}
      <p class="muted" style="font-size:12.5px;margin-top:14px">Estimasi pengerjaan default ${Laundry.days()} hari. Jasa tenda: ${Svc.TENT_MODES.map((k) => `${Svc.spec(k).short} ${rupiah(Svc.fee(k))}`).join(' · ')} per tenda (di luar ongkir).</p></div>`;
  }
  $('#vPrices').addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-ldimg]'); if (!inp) return; const f = inp.files[0]; inp.value = ''; if (!f) return;
    if (f.size > 8e6) { toast('Ukuran gambar maksimal 8 MB.', 'err'); return; }
    const out = await UI.cropImage(f, { aspect: 4 / 3, size: 640, title: 'Atur gambar laundry' }); if (!out) return;
    if (DB.setLaundryImage(inp.dataset.ldimg, out)) { toast('Gambar laundry diperbarui.'); drawPrices(); }
  });
  $('#vPrices').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ldimgrm]'); if (!b) return;
    if (!(await UI.confirmBox({ title: 'Hapus gambar?', text: 'Item laundry akan memakai ikon kategori sampai gambar baru dipasang.', ok: 'Hapus gambar', danger: true }))) return;
    if (DB.setLaundryImage(b.dataset.ldimgrm, '')) { toast('Gambar dihapus.'); drawPrices(); }
  });

  $('#ldView').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; $$('#ldView [data-v]').forEach((x) => x.classList.toggle('active', x === b)); $('#vOrders').hidden = b.dataset.v !== 'orders'; $('#vPrices').hidden = b.dataset.v !== 'prices'; if (b.dataset.v === 'prices') drawPrices(); });
  draw();
  if (param('id')) Admin.laundryModal(param('id'), draw);
  if (param('view') === 'prices') { const b = $('#ldView [data-v=prices]'); if (b) b.click(); }
})();
