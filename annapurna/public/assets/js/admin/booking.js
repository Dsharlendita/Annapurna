(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('booking', 'Booking Rental');
  const TABS = [['semua', 'Semua'], ['menunggu_pembayaran', 'Menunggu Bayar'], ['menunggu_konfirmasi', 'Menunggu Konfirmasi'], ['dikonfirmasi', 'Dikonfirmasi'], ['disewa', 'Sedang Disewa'], ['selesai', 'Selesai'], ['dibatalkan', 'Dibatalkan']];
  let tab = param('tab') || 'semua';
  function list() {
    const q = $('#q').value.trim().toLowerCase(), f = $('#from').value, t = $('#to').value;
    return DB.bookings().filter((b) => (tab === 'semua' || b.status === tab)
      && (!q || [b.id, NO(b), b.customer.name, b.customer.phone, Admin.itemsText(b)].join(' ').toLowerCase().includes(q))
      && (!f || b.start >= f) && (!t || b.start <= t))
      .sort((a, b) => String(b.createdAt).localeCompare(a.createdAt));
  }
  function draw() {
    const all = DB.bookings();
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l} <span class="cnt">${k === 'semua' ? all.length : all.filter((b) => b.status === k).length}</span></button>`).join('');
    const L = list();
    $('#rows').innerHTML = L.length ? L.map((b) => {
      const acts = Admin.bookingActions(b).slice(0, 1);
      const late = b.status === 'disewa' && b.end < D.today(); const due = b.status === 'disewa' && b.end <= D.today();
      const mates = Admin.groupMates(b);
      return `<tr>
        <td><strong>${NO(b)}</strong><small>${D.fmtDate(b.createdAt)}</small></td>
        <td>${esc(b.customer.name)}<small>${esc(b.customer.phone)}</small></td>
        <td style="min-width:190px;max-width:260px">${esc(Admin.itemsText(b))}${(b.changes || []).some((c) => c.status === 'menunggu') ? '<small style="color:#9a6508"><i class="fa-solid fa-arrows-rotate"></i> Ada permintaan ganti</small>' : ''}${b.group ? `<small class="grp-tag"><i class="fa-solid fa-link"></i> Pesanan gabungan${mates.length ? ' · ' + mates.map((x) => x.id).join(', ') : ''}</small>` : ''}</td>
        <td>${D.fmtRange(b.start, b.end)}<small>${b.days} malam${late ? ' · <span style="color:var(--red);font-weight:700">terlambat</span>' : ''}</small></td>
        <td class="num">${rupiah(b.total)}</td><td class="num">${rupiah(b.dp)}</td><td class="num">${b.status === 'dibatalkan' ? '-' : rupiah(Admin.sisa(b))}</td>
        <td>${pill('rental', b.status)}<small style="margin-top:4px">${pill('payment', b.paymentStatus)}</small></td>
        <td><div class="acts">${due ? `<button class="btn btn-wa btn-xs" data-remind="${b.id}" title="${late ? 'Kirim nota + denda ke customer' : 'Ingatkan pengembalian hari ini'}"><i class="fa-brands fa-whatsapp"></i> ${late ? 'Tagih denda' : 'Ingatkan'}</button>` : ''}${acts.map(([k, ic, l, c]) => `<button class="btn ${c} btn-xs" data-act="${k}" data-id="${b.id}" title="${l}"><i class="fa-solid ${ic}"></i> ${l}</button>`).join('')}<button class="btn btn-light btn-xs" data-act="detail" data-id="${b.id}">Detail</button></div></td></tr>`;
    }).join('') : `<tr><td colspan="9"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-regular fa-calendar"></i></div><h3>Tidak ada booking</h3><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;
    $('#count').textContent = `Menampilkan ${L.length} booking.`;
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { tab = b.dataset.tab; draw(); } });
  ['#q', '#from', '#to'].forEach((s) => $(s).addEventListener('input', draw));
  $('#reset').addEventListener('click', () => { $('#q').value = $('#from').value = $('#to').value = ''; tab = 'semua'; draw(); });
  $('#rows').addEventListener('click', (e) => { const w = e.target.closest('[data-remind]'); if (w) { Admin.remindCustomer(DB.booking(w.dataset.remind)).then(draw); return; } const b = e.target.closest('[data-act]'); if (b) Admin.runBooking(b.dataset.act, b.dataset.id, draw); });
  bindExport($('#exp'), () => { const L = list(); const f = $('#from').value, t = $('#to').value;
    return { filename: `booking-rental-${D.today()}`, title: 'Data Booking Rental', subtitle: `Status: ${TABS.find((x) => x[0] === tab)[1]}${f || t ? ` · Tanggal ambil ${f ? D.fmtDate(f, true) : '…'} – ${t ? D.fmtDate(t, true) : '…'}` : ''}`,
      summary: [['Jumlah booking', String(L.length)], ['Nilai sewa', L.filter((b) => b.status !== 'dibatalkan').reduce((a, b) => a + b.total, 0)], ['Sudah dibayar', L.reduce((a, b) => a + Rules.paidTotal(b), 0)]],
      columns: [{ header: 'No. Booking' }, { header: 'Tgl Booking' }, { header: 'Customer' }, { header: 'Telepon' }, { header: 'Barang', width: 40 }, { header: 'Periode Sewa' }, { header: 'Hari', type: 'number' }, { header: 'Total', type: 'money' }, { header: 'DP', type: 'money' }, { header: 'Dibayar', type: 'money' }, { header: 'Status' }, { header: 'Pembayaran' }],
      rows: L.map((b) => [NO(b), D.fmtDate(b.createdAt), b.customer.name, b.customer.phone, Admin.itemsText(b), D.fmtRange(b.start, b.end), b.days, b.total, b.dp, Rules.paidTotal(b), STATUS.rental[b.status].label, STATUS.payment[b.paymentStatus].label]),
      foot: ['Total', '', '', '', '', '', L.reduce((a, b) => a + b.days, 0), L.reduce((a, b) => a + b.total, 0), L.reduce((a, b) => a + b.dp, 0), L.reduce((a, b) => a + Rules.paidTotal(b), 0), '', ''] }; });
  draw();
  if (param('id')) Admin.bookingModal(param('id'), draw);
})();

