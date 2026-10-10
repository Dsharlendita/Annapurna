(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('pengembalian', 'Barang Keluar & Kembali');
  const T = D.today();
  function logRows() {
    const k = $('#kind').value, f = $('#from').value, t = $('#to').value; const rows = [];
    DB.bookings().forEach((b) => {
      const qty = b.items.reduce((s, i) => s + i.qty, 0);
      if (b.out) rows.push({ at: b.out.at, kind: 'keluar', b, qty, cond: b.out.cond, fine: 0, by: b.out.by, note: b.out.note });
      if (b.ret) rows.push({ at: b.ret.at, kind: 'kembali', b, qty, cond: b.ret.cond, fine: b.ret.fine || 0, by: b.ret.by, note: b.ret.note, late: b.ret.lateDays });
    });
    return rows.filter((r) => (!k || r.kind === k) && (!f || D.day(r.at) >= f) && (!t || D.day(r.at) <= t)).sort((a, b) => b.at.localeCompare(a.at));
  }
  function draw() {
    const B = DB.bookings();
    const out = B.filter((b) => b.status === 'dikonfirmasi').sort((a, b) => a.start.localeCompare(b.start));
    /* Urut tanggal kembali; booking dari pesanan gabungan yang sama ditaruh berdekatan */
    const rent0 = B.filter((b) => b.status === 'disewa').sort((a, b) => a.end.localeCompare(b.end));
    const rent = []; rent0.forEach((b) => { if (rent.includes(b)) return; rent.push(b); if (b.group) rent0.filter((x) => x !== b && x.group === b.group).forEach((x) => rent.push(x)); });
    const late = rent.filter((b) => b.end < T);
    const units = rent.reduce((s, b) => s + b.items.reduce((t, i) => t + i.qty, 0), 0);
    const fines = B.filter((b) => b.ret).reduce((s, b) => s + (b.ret.fine || 0), 0);
    const st = (ic, tone, l, v) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong></div></div>`;
    $('#stats').innerHTML = st('fa-box-open', 'gold', 'Siap diambil', out.length) + st('fa-person-hiking', '', 'Unit sedang disewa', units) + st('fa-triangle-exclamation', 'red', 'Terlambat kembali', late.length) + st('fa-coins', 'blue', 'Total denda tercatat', rupiah(fines));
    $('#toOut').innerHTML = out.length ? out.map((b) => `<div class="list-row"><div class="nm"><strong>${NO(b)} · ${esc(b.customer.name)}</strong><small>${esc(Admin.itemsText(b))}</small><small>Ambil ${D.fmtDate(b.start, true)}${b.start === T ? ' · <b style="color:var(--g700)">hari ini</b>' : b.start < T ? ' · <b style="color:var(--red)">lewat jadwal</b>' : ''} · sisa ${rupiah(Admin.sisa(b))}</small></div><button class="btn btn-primary btn-xs" data-act="pickup" data-id="${b.id}"><i class="fa-solid fa-check"></i> Keluar</button></div>`).join('') : '<p class="muted" style="font-size:13.5px">Tidak ada barang yang menunggu diambil.</p>';
    const due = rent.filter((b) => b.end <= T); const todo = due.filter((b) => !Admin.remindedToday(b));
    $('#dueBanner').innerHTML = due.length ? `<div class="notice ${todo.length ? '' : 'green'} due-banner"><i class="fa-brands fa-whatsapp"></i><div><strong>${due.filter((b) => b.end === T).length} rental harus kembali hari ini${late.length ? ` dan ${late.length} terlambat` : ''}.</strong> ${todo.length ? `${todo.length} penyewa belum diingatkan — kirim pengingat lewat WhatsApp agar barang kembali tepat waktu.` : 'Semua penyewa sudah diingatkan hari ini.'}</div></div>` : '';
    $('#toRet').innerHTML = rent.length ? rent.map((b) => { const ld = Rules.lateDays(b); return `<div class="list-row ${param('remind') === b.id ? 'hl-row' : ''}"><div class="nm"><strong>${NO(b)} · ${esc(b.customer.name)}</strong><small>${esc(Admin.itemsText(b))}</small>${b.group ? `<small class="grp-tag"><i class="fa-solid fa-link"></i> Pesanan gabungan${Admin.groupMates(b).length ? ' · ' + Admin.groupMates(b).map((x) => `${x.id} kembali ${D.fmtDate(x.end)}`).join(', ') : ''}</small>` : ''}<small>Kembali ${D.fmtDate(b.end, true)}${ld ? ` · <b style="color:var(--red)">terlambat ${ld} malam (denda ±${rupiah(Rules.lateFee(b, ld))})</b>` : b.end === T ? ' · <b style="color:#9a6508">hari ini</b>' : ''}</small></div>${b.end <= T ? `<button class="btn ${Admin.remindedToday(b) ? 'btn-light' : 'btn-wa'} btn-xs" data-remind="${b.id}" title="${ld ? 'Kirim nota + rincian denda via WhatsApp' : 'Kirim pengingat via WhatsApp'}"><i class="fa-brands fa-whatsapp"></i> ${Admin.remindedToday(b) ? 'Kirim ulang' : ld ? 'Tagih denda' : 'Ingatkan'}</button>` : `<a class="btn btn-light btn-xs" href="${Admin.custLink(b.customer)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`}<button class="btn btn-primary btn-xs" data-act="return" data-id="${b.id}"><i class="fa-solid fa-rotate-left"></i> Terima</button></div>`; }).join('') : '<p class="muted" style="font-size:13.5px">Tidak ada barang yang sedang disewa.</p>';
    const L = logRows();
    $('#log').innerHTML = L.length ? L.map((r) => `<tr><td>${D.fmtDateTime(r.at)}</td><td><span class="pill ${r.kind === 'keluar' ? 'amber' : 'green'}">${r.kind === 'keluar' ? 'Keluar' : 'Kembali'}</span></td>
      <td><a href="#" data-act="detail" data-id="${r.b.id}" style="font-weight:700;color:var(--g700)">${r.b.id}</a></td><td>${esc(r.b.customer.name)}</td><td style="min-width:190px;max-width:260px">${esc(Admin.itemsText(r.b))}${r.note ? `<small>${esc(r.note)}</small>` : ''}</td>
      <td class="num">${r.qty}</td><td>${/Rusak|Hilang/.test(r.cond) ? `<span style="color:var(--red);font-weight:600">${esc(r.cond)}</span>` : esc(r.cond)}${r.late ? `<small>Terlambat ${r.late} hari</small>` : ''}</td><td class="num">${r.fine ? rupiah(r.fine) : '-'}</td><td>${esc(r.by || '-')}</td></tr>`).join('')
      : '<tr><td colspan="9" class="muted" style="text-align:center;padding:24px">Belum ada catatan pada filter ini.</td></tr>';
  }
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-remind]'); if (r) { Admin.remindCustomer(DB.booking(r.dataset.remind)).then(draw); } });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && b.closest('.content')) { e.preventDefault(); Admin.runBooking(b.dataset.act, b.dataset.id, draw); } });
  ['#kind', '#from', '#to'].forEach((s) => $(s).addEventListener('change', draw));
  bindExport($('#exp'), () => { const L = logRows(); const f = $('#from').value, t = $('#to').value;
    return { filename: `barang-keluar-masuk-${T}`, title: 'Log Barang Keluar & Kembali', subtitle: f || t ? `Periode ${f ? D.fmtDate(f, true) : '…'} – ${t ? D.fmtDate(t, true) : '…'}` : 'Semua periode',
      summary: [['Barang keluar', String(L.filter((r) => r.kind === 'keluar').length)], ['Barang kembali', String(L.filter((r) => r.kind === 'kembali').length)], ['Total denda', L.reduce((a, r) => a + r.fine, 0)]],
      columns: [{ header: 'Tanggal' }, { header: 'Jenis' }, { header: 'Booking' }, { header: 'Customer' }, { header: 'Barang', width: 40 }, { header: 'Jml', type: 'number' }, { header: 'Kondisi' }, { header: 'Terlambat' }, { header: 'Denda', type: 'money' }, { header: 'Petugas' }, { header: 'Catatan', width: 30 }],
      rows: L.map((r) => [D.fmtDateTime(r.at), r.kind === 'keluar' ? 'Keluar' : 'Kembali', r.b.id, r.b.customer.name, Admin.itemsText(r.b), r.qty, r.cond, r.late ? r.late + ' hari' : '-', r.fine, r.by || '-', r.note || '']),
      foot: ['Total', '', '', '', '', L.reduce((a, r) => a + r.qty, 0), '', '', L.reduce((a, r) => a + r.fine, 0), '', ''] }; });
  draw();
})();

