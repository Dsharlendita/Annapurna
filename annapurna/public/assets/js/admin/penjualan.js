(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('penjualan', 'Penjualan');
  const TABS = [['semua', 'Semua'], ['masuk', 'Pesanan Masuk'], ['diproses', 'Diproses'], ['dikemas', 'Dikemas'], ['siap_diambil', 'Siap Diambil'], ['selesai', 'Selesai'], ['dibatalkan', 'Dibatalkan']];
  let tab = param('tab') || 'semua';
  const match = (s, k) => k === 'semua' || (k === 'masuk' ? s.status === 'menunggu_pembayaran' || s.paymentStatus === 'verifying' : s.status === k);
  const txt = (s) => s.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
  function list() {
    const q = $('#q').value.trim().toLowerCase(), f = $('#from').value, t = $('#to').value;
    return DB.sales().filter((s) => match(s, tab) && (!q || [s.id, s.customer.name, txt(s)].join(' ').toLowerCase().includes(q))
      && (!f || D.day(s.createdAt) >= f) && (!t || D.day(s.createdAt) <= t)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  function draw() {
    const S = DB.sales(); const T = D.today();
    const month = T.slice(0, 7);
    const paidMonth = S.filter((s) => s.paymentStatus === 'paid' && s.createdAt.slice(0, 7) === month && s.status !== 'dibatalkan');
    const st = (ic, tone, l, v) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong></div></div>`;
    $('#stats').innerHTML = st('fa-inbox', 'gold', 'Pesanan masuk', S.filter((s) => match(s, 'masuk')).length) + st('fa-box', 'blue', 'Perlu diproses / dikemas', S.filter((s) => ['diproses', 'dikemas'].includes(s.status)).length)
      + st('fa-circle-check', '', 'Selesai bulan ini', paidMonth.filter((s) => s.status === 'selesai').length) + st('fa-sack-dollar', '', 'Omzet bulan ini', rupiah(paidMonth.reduce((a, s) => a + s.total, 0)));
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l} <span class="cnt">${S.filter((s) => match(s, k)).length}</span></button>`).join('');
    const L = list();
    $('#rows').innerHTML = L.length ? L.map((s) => { const a = Admin.saleActions(s)[0]; return `<tr>
      <td><strong>${s.id}</strong><small>${D.fmtDateTime(s.createdAt)}</small></td><td>${esc(s.customer.name)}<small>${esc(s.customer.phone)}</small></td>
      <td style="min-width:190px;max-width:260px">${esc(txt(s))}</td>
      <td class="num">${rupiah(s.total)}</td><td>${pill('payment', s.paymentStatus)}</td><td>${pill('sale', s.status)}</td>
      <td><div class="acts">${a ? `<button class="btn ${a[3]} btn-xs" data-act="${a[0]}" data-id="${s.id}"><i class="fa-solid ${a[1]}"></i> ${a[2]}</button>` : ''}<button class="btn btn-light btn-xs" data-act="sdetail" data-id="${s.id}">Detail</button></div></td></tr>`; }).join('')
      : '<tr><td colspan="7"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-solid fa-bag-shopping"></i></div><h3>Tidak ada pesanan</h3><p>Coba ubah filter.</p></div></td></tr>';
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { tab = b.dataset.tab; draw(); } });
  ['#q', '#from', '#to'].forEach((s) => $(s).addEventListener('input', draw));
  $('#rows').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) Admin.runSale(b.dataset.act, b.dataset.id, draw); });
  bindExport($('#exp'), () => { const L = list(); const ok = L.filter((s) => s.status !== 'dibatalkan');
    return { filename: `penjualan-${D.today()}`, title: 'Data Penjualan', subtitle: `Status: ${TABS.find((x) => x[0] === tab)[1]}`,
      summary: [['Jumlah pesanan', String(L.length)], ['Barang terjual', ok.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0) + ' unit'], ['Omzet (lunas)', ok.filter((s) => s.paymentStatus === 'paid').reduce((a, s) => a + s.total, 0)]],
      columns: [{ header: 'No. Pesanan' }, { header: 'Tanggal' }, { header: 'Customer' }, { header: 'Telepon' }, { header: 'Barang', width: 40 }, { header: 'Qty', type: 'number' }, { header: 'Total', type: 'money' }, { header: 'Pembayaran' }, { header: 'Status' }],
      rows: L.map((s) => [s.id, D.fmtDateTime(s.createdAt), s.customer.name, s.customer.phone, txt(s), s.items.reduce((x, i) => x + i.qty, 0), s.total, STATUS.payment[s.paymentStatus].label, STATUS.sale[s.status].label]),
      foot: ['Total', '', '', '', '', ok.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0), ok.reduce((a, s) => a + s.total, 0), '', ''] }; });
  draw();
  if (param('id')) Admin.saleModal(param('id'), draw);
})();

