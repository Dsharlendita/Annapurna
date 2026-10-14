/* Admin · Laundry
   - Pesanan laundry diinput di Kasir (mode Laundry). Halaman ini untuk memantau status, menerima pembayaran, struk, dan kabar ke customer.
   - Laundry tanpa antar jemput: customer antar & ambil sendiri di toko.
   - Daftar harga laundry & tarif jasa tenda (bongkar pasang / pasang saja / bongkar saja): bisa diubah Owner, staff hanya melihat. */
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
        <td class="num">${rupiah(total)}${o.discount ? `<small>diskon ${rupiah(o.discount)}</small>` : ''}</td>
        <td>${pill('payment', paid >= total ? 'paid' : 'unpaid')}${paid && paid < total ? `<small>dibayar ${rupiah(paid)}</small>` : ''}</td>
        <td>${pill('laundry', o.status)}</td>
        <td><div class="acts">${nx && o.status !== 'dibatalkan' ? `<button class="btn btn-primary btn-xs" data-next="${o.id}"><i class="fa-solid ${nx[1]}"></i> ${nx[2]}</button>` : ''}<button class="btn btn-light btn-xs" data-detail="${o.id}">Detail</button></div></td></tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-solid fa-jug-detergent"></i></div><h3>Tidak ada laundry</h3><p>Input laundry baru dari Kasir saat barang customer diterima.</p></div></td></tr>`;
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { tab = b.dataset.tab; history.replaceState(null, '', '?tab=' + tab); draw(); } });
  ['#q', '#from', '#to'].forEach((s) => $(s).addEventListener('input', draw));
  $('#rows').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-detail]'); if (d) { Admin.laundryModal(d.dataset.detail, draw); return; }
    const n = e.target.closest('[data-next]'); if (!n) return;
    const o = DB.laundryOrder(n.dataset.next); const to = Laundry.FLOW[o.status][0];
    if (to === 'selesai' && Laundry.paid(o) < Laundry.total(o)) { Admin.laundryModal(o.id, draw); toast('Tagihan belum lunas. Terima pembayaran dulu sebelum menandai selesai.', 'err'); return; }
    Admin.ldAdvance(o, to, draw);
  });
  bindExport($('#exp'), () => { const L = list();
    return { filename: `laundry-${D.today()}`, title: 'Data Laundry', subtitle: `Status: ${TABS.find((x) => x[0] === tab)[1]}`,
      summary: [['Jumlah pesanan', String(L.length)], ['Nilai laundry', L.filter((o) => o.status !== 'dibatalkan').reduce((a, o) => a + Laundry.total(o), 0)], ['Sudah dibayar', L.reduce((a, o) => a + Laundry.paid(o), 0)]],
      columns: [{ header: 'No. Nota' }, { header: 'Tanggal' }, { header: 'Customer' }, { header: 'Telepon' }, { header: 'Barang', width: 40 }, { header: 'Total', type: 'money' }, { header: 'Dibayar', type: 'money' }, { header: 'Status' }],
      rows: L.map((o) => [o.no, D.fmtDateTime(o.createdAt), o.customer.name, o.customer.phone, Admin.ldItems(o), Laundry.total(o), Laundry.paid(o), (STATUS.laundry[o.status] || {}).label || o.status]),
      foot: ['Total', '', '', '', '', L.reduce((a, o) => a + Laundry.total(o), 0), L.reduce((a, o) => a + Laundry.paid(o), 0), ''] }; });

  /* ---------- Daftar harga & tarif ---------- */
  const canEdit = Admin.isOwner;
  let cats = JSON.parse(JSON.stringify(DB.laundryPrices()));
  function drawPrices() {
    const st = DB.settings();
    if (!canEdit) {
      $('#vPrices').innerHTML = `<div class="card"><div class="card-title"><i class="fa-solid fa-tags"></i> Daftar harga laundry</div>
        ${cats.map((c) => `<h4 style="margin:12px 0 4px"><i class="fa-solid ${esc(c.icon || 'fa-circle')}" style="color:var(--g600)"></i> ${esc(c.name)}</h4>${c.items.map((i) => `<div class="kv"><span>${esc(i.name)}</span><span>${rupiah(i.price)}</span></div>`).join('')}`).join('')}
        <h4 style="margin:16px 0 4px"><i class="fa-solid fa-tents" style="color:var(--g600)"></i> Jasa tenda (di luar ongkir)</h4>${Svc.TENT_MODES.map((k) => `<div class="kv"><span>${Svc.spec(k).short}</span><span>${rupiah(Svc.fee(k))} / tenda</span></div>`).join('')}
        <p class="muted" style="font-size:12.5px;margin-top:8px"><i class="fa-solid fa-lock"></i> Harga hanya bisa diubah Owner.</p></div>`;
      return;
    }
    const FK = { pasang: 'setupFee', pasang_saja: 'pasangFee', bongkar_saja: 'bongkarFee' };
    $('#vPrices').innerHTML = `<div class="card" style="margin-bottom:16px"><div class="card-title"><i class="fa-solid fa-tents"></i> Tarif jasa tenda (per unit, di luar ongkir)</div>
        <div class="grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${Svc.TENT_MODES.map((k) => `<div class="field"><label>${Svc.spec(k).short} (Rp)</label><input class="input" type="number" min="0" data-fee="${FK[k]}" value="${Svc.fee(k)}"><small class="muted">${Svc.spec(k).desc}</small></div>`).join('')}</div>
        <p class="muted" style="font-size:12.5px">Ongkir antar &amp; jemput tidak punya tarif tetap: disepakati dengan customer via WhatsApp sesuai jarak. Laundry tidak ada antar jemput.</p></div>
      <div class="card ld-price-edit"><div class="card-title"><i class="fa-solid fa-tags"></i> Daftar harga laundry</div>
        <p class="muted" style="font-size:13px">Harga ini tampil di halaman Laundry website, beranda, dan kasir.</p>
        ${cats.map((c, ci) => `<div class="ld-pe-cat"><i class="fa-solid ${esc(c.icon || 'fa-circle')}" style="color:var(--g600)"></i><input class="input" data-cn="${ci}" value="${esc(c.name)}" aria-label="Nama kategori"></div>
          ${c.items.map((i, ii) => `<div class="ld-pe-row"><input class="input" data-in="${ci}|${ii}" value="${esc(i.name)}" aria-label="Nama barang"><input class="input" data-ip="${ci}|${ii}" inputmode="numeric" value="${i.price}" aria-label="Harga"><button type="button" class="icon-btn sm" data-del="${ci}|${ii}" aria-label="Hapus ${esc(i.name)}"><i class="fa-solid fa-trash-can"></i></button></div>`).join('')}
          <button type="button" class="btn btn-ghost btn-xs" data-add="${ci}"><i class="fa-solid fa-plus"></i> Tambah barang di ${esc(c.name)}</button>`).join('')}
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" class="btn btn-light" id="pReset">Batalkan perubahan</button><button type="button" class="btn btn-primary" id="pSave"><i class="fa-solid fa-check"></i> Simpan harga &amp; tarif</button></div></div>`;
  }
  const num = (v) => +String(v || '').replace(/[^\d]/g, '') || 0;
  $('#vPrices').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.cn) cats[+t.dataset.cn].name = t.value;
    if (t.dataset.in) { const [c, i] = t.dataset.in.split('|').map(Number); cats[c].items[i].name = t.value; }
    if (t.dataset.ip) { const [c, i] = t.dataset.ip.split('|').map(Number); cats[c].items[i].price = num(t.value); }
  });
  $('#vPrices').addEventListener('click', (e) => {
    const a = e.target.closest('[data-add]'); if (a) { cats[+a.dataset.add].items.push({ id: 'ld-' + Date.now().toString(36), name: '', price: 0 }); drawPrices(); const ins = $$('[data-in^="' + a.dataset.add + '|"]'); ins[ins.length - 1].focus(); return; }
    const d = e.target.closest('[data-del]'); if (d) { const [c, i] = d.dataset.del.split('|').map(Number); cats[c].items.splice(i, 1); drawPrices(); return; }
    if (e.target.closest('#pReset')) { cats = JSON.parse(JSON.stringify(DB.laundryPrices())); drawPrices(); return; }
    if (e.target.closest('#pSave')) {
      if (cats.some((c) => !c.name.trim() || c.items.some((i) => !i.name.trim() || !i.price))) { toast('Lengkapi nama dan harga setiap barang.', 'err'); return; }
      const old = DB.laundryPrices();
      const flat = (L) => { const m = {}; L.forEach((c) => c.items.forEach((i) => { m[i.id] = `${i.name} ${rupiah(i.price)}`; })); return m; };
      const A = flat(old), B = flat(cats); const ch = [];
      Object.keys(Object.assign({}, A, B)).forEach((k) => { if (A[k] !== B[k]) ch.push({ field: 'Harga laundry', from: A[k] || '—', to: B[k] || 'dihapus' }); });
      if (ch.length || JSON.stringify(old) !== JSON.stringify(cats)) DB.saveConfig('laundry', JSON.parse(JSON.stringify(cats)), 'Mengubah daftar harga laundry', ch);
      const FN = { setupFee: 'Bongkar pasang', pasangFee: 'Pasang saja', bongkarFee: 'Bongkar saja' };
      $$('[data-fee]').forEach((el) => { const k = el.dataset.fee; const nv = num(el.value); const ov = +DB.settings()[k] || 0; if (nv !== ov) DB.saveConfig(k, nv, `Mengubah tarif jasa tenda: ${FN[k]}`, [{ field: `${FN[k]} per tenda`, from: rupiah(ov), to: rupiah(nv) }]); });
      toast('Harga tersimpan.'); drawPrices();
    }
  });

  $('#ldView').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; $$('#ldView [data-v]').forEach((x) => x.classList.toggle('active', x === b)); $('#vOrders').hidden = b.dataset.v !== 'orders'; $('#vPrices').hidden = b.dataset.v !== 'prices'; if (b.dataset.v === 'prices') drawPrices(); });
  draw();
  if (param('id')) Admin.laundryModal(param('id'), draw);
})();
