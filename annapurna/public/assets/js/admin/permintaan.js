(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  Admin.init('permintaan', 'Pembatalan & Ganti Barang');
  let tab = param('tab') || 'change';
  const st = DB.settings();
  $('#policy').innerHTML = `<i class="fa-solid fa-scale-balanced"></i><div><strong>Kebijakan pembatalan aktif</strong><ul>${st.cancelPolicy.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  function draw() {
    const B = DB.bookings();
    const changes = []; B.forEach((b) => (b.changes || []).forEach((c) => changes.push({ b, c })));
    changes.sort((x, y) => (x.c.status === 'menunggu' ? -1 : 1) - (y.c.status === 'menunggu' ? -1 : 1) || y.c.at.localeCompare(x.c.at));
    const cancels = B.filter((b) => b.status === 'dibatalkan').sort((x, y) => (x.paymentStatus === 'refund_pending' ? -1 : 1) - (y.paymentStatus === 'refund_pending' ? -1 : 1) || String((y.cancel || {}).at).localeCompare((x.cancel || {}).at));
    $('#cC').textContent = changes.filter((x) => x.c.status === 'menunggu').length;
    $('#cR').textContent = cancels.filter((b) => b.paymentStatus === 'refund_pending').length;
    const exts = []; B.forEach((b) => (b.extensions || []).forEach((x) => exts.push({ b, x })));
    exts.sort((p, q) => (p.x.status === 'menunggu' ? -1 : 1) - (q.x.status === 'menunggu' ? -1 : 1) || q.x.at.localeCompare(p.x.at));
    $('#cE').textContent = exts.filter((e) => e.x.status === 'menunggu').length;
    $$('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    const tone = { menunggu: 'amber', disetujui: 'green', ditolak: 'red' };
    if (tab === 'extend') {
      const tone2 = { menunggu: 'amber', disetujui: 'green', ditolak: 'red' };
      $('#pane').innerHTML = exts.length ? `<div class="table-wrap"><table class="table wide"><thead><tr><th>Diajukan</th><th>Booking</th><th>Customer</th><th>Perpanjangan</th><th class="num">Biaya</th><th>Status</th><th class="num">Aksi</th></tr></thead><tbody>
        ${exts.map(({ b, x }) => `<tr><td>${D.fmtDateTime(x.at)}<small>${x.source === 'toko' ? `Di toko · ${esc(x.by || '')}` : 'Dari customer'}</small></td><td><strong>${NO(b)}</strong><small>${pill('rental', b.status)}</small></td><td>${esc(b.customer.name)}</td>
          <td>${D.fmtDate(x.from)} <i class="fa-solid fa-arrow-right" style="font-size:11px;color:var(--muted)"></i> <strong>${D.fmtDate(x.to)}</strong><small>+${x.days} hari${x.reason ? ` · ${esc(x.reason)}` : ''}</small></td><td class="num">${rupiah(x.cost)}</td>
          <td><span class="pill ${tone2[x.status]}">${x.status[0].toUpperCase() + x.status.slice(1)}</span></td>
          <td><div class="acts"><button class="btn btn-light btn-xs" data-open="${b.id}"><i class="fa-regular fa-file-lines"></i> Detail</button>${x.status === 'menunggu' ? `<button class="btn btn-primary btn-xs" data-ext="${b.id}|${x.id}"><i class="fa-solid fa-magnifying-glass"></i> Tinjau</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="panel empty-state"><div class="ic"><i class="fa-solid fa-calendar-plus"></i></div><h3>Belum ada perpanjangan</h3><p>Permintaan perpanjangan dari customer dan perpanjangan yang dicatat di toko akan muncul di sini.</p></div>';
    } else if (tab === 'change') {
      $('#pane').innerHTML = changes.length ? `<div class="table-wrap"><table class="table wide"><thead><tr><th>Diajukan</th><th>Booking</th><th>Customer</th><th>Perubahan</th><th class="num">Selisih</th><th>Alasan</th><th>Status</th><th class="num">Aksi</th></tr></thead><tbody>
        ${changes.map(({ b, c }) => { const avail = Rules.available(c.toId, b.start, b.end, b.id, c.toSize || null); return `<tr>
          <td>${D.fmtDateTime(c.at)}</td><td><strong>${NO(b)}</strong><small>${D.fmtRange(b.start, b.end)}</small></td><td>${esc(b.customer.name)}<small>${c.source === 'toko' ? `<i class="fa-solid fa-store"></i> Di toko · ${esc(c.by || '')}` : '<i class="fa-solid fa-mobile-screen"></i> Dari customer'}</small></td>
          <td>${c.qty}× ${esc(c.fromName)} <i class="fa-solid fa-arrow-right" style="color:var(--muted);font-size:11px"></i> <strong>${esc(c.toName)}</strong>${c.status === 'menunggu' ? `<small style="color:${avail >= c.qty ? 'var(--g600)' : 'var(--red)'}">Stok pengganti tersedia: ${avail}</small>` : ''}</td>
          <td class="num" style="color:${c.diff > 0 ? '#9a6508' : c.diff < 0 ? 'var(--g700)' : 'inherit'}">${c.diff > 0 ? '+' : c.diff < 0 ? '−' : ''}${rupiah(Math.abs(c.diff))}<small>${c.diff > 0 ? 'customer bayar' : c.diff < 0 ? 'potong sisa bayar' : 'tanpa selisih'}</small></td>
          <td style="max-width:200px">${esc(c.reason)}${c.note ? `<small>Catatan admin: ${esc(c.note)}</small>` : ''}</td>
          <td><span class="pill ${tone[c.status]}">${c.status[0].toUpperCase() + c.status.slice(1)}</span></td>
          <td><div class="acts"><button class="btn btn-light btn-xs" data-open="${b.id}"><i class="fa-regular fa-file-lines"></i> Detail</button>${c.status === 'menunggu' ? `<button class="btn btn-primary btn-xs" data-ok="${b.id}|${c.id}"><i class="fa-solid fa-check"></i> Setujui</button><button class="btn btn-danger btn-xs" data-no="${b.id}|${c.id}"><i class="fa-solid fa-xmark"></i> Tolak</button>` : ''}</div></td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="panel empty-state"><div class="ic"><i class="fa-solid fa-arrows-rotate"></i></div><h3>Belum ada permintaan</h3><p>Permintaan ganti barang dari customer akan muncul di sini.</p></div>';
    } else {
      const lbl = { menunggu: ['amber', 'Menunggu refund'], selesai: ['gray', 'Sudah dikembalikan'], hangus: ['red', 'DP hangus'], tidak_perlu: ['gray', 'Tidak ada DP'] };
      $('#pane').innerHTML = cancels.length ? `<div class="table-wrap"><table class="table wide"><thead><tr><th>Dibatalkan</th><th>Booking</th><th>Customer</th><th>Tanggal sewa</th><th>Alasan</th><th class="num">Dibayar</th><th>Refund</th><th class="num">Aksi</th></tr></thead><tbody>
        ${cancels.map((b) => { const c = b.cancel || { refundStatus: 'tidak_perlu' }; const L = lbl[c.refundStatus] || lbl.tidak_perlu; return `<tr>
          <td>${c.at ? D.fmtDateTime(c.at) : '-'}<small>oleh ${c.by === 'admin' ? 'admin' : 'customer'}</small></td><td><strong>${NO(b)}</strong></td><td>${esc(b.customer.name)}<small>${esc(b.customer.phone)}</small></td>
          <td>${D.fmtRange(b.start, b.end)}</td><td style="max-width:200px">${esc(c.reason || '-')}</td><td class="num">${rupiah(Rules.paidTotal(b))}</td>
          <td><span class="pill ${L[0]}">${L[1]}</span></td>
          <td><div class="acts"><button class="btn btn-light btn-xs" data-open="${b.id}"><i class="fa-regular fa-file-lines"></i> Detail</button>${b.paymentStatus === 'refund_pending' ? `<button class="btn btn-gold btn-xs" data-refund="${b.id}"><i class="fa-solid fa-hand-holding-dollar"></i> Proses refund</button>` : ''}<a class="btn btn-light btn-xs" href="${Admin.custLink(b.customer)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a></div></td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="panel empty-state"><div class="ic"><i class="fa-solid fa-ban"></i></div><h3>Belum ada pembatalan</h3><p>Booking yang dibatalkan akan tercatat di sini.</p></div>';
    }
  }
  $('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) { tab = t.dataset.tab; draw(); } });
  $('#storeChg').addEventListener('click', () => {
    const L = DB.bookings().filter((b) => ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'].includes(b.status) && b.items.some((i) => i.kind === 'product'))
      .sort((a, b) => (a.status === 'disewa' ? -1 : 1) - (b.status === 'disewa' ? -1 : 1) || a.start.localeCompare(b.start));
    const m = modal({ title: 'Catat ganti barang di toko', body: `<p class="muted" style="font-size:13.5px;margin-bottom:12px">Pilih booking milik customer yang sedang di toko.</p>
      <div class="input-icon" style="margin-bottom:10px"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="bkQ" placeholder="Cari no. booking atau nama customer…"></div><div id="bkList" class="bk-pick"></div>`, foot: '<button class="btn btn-light" data-close>Batal</button>' });
    const drawL = () => { const q = m.$('#bkQ').value.trim().toLowerCase(); const F = L.filter((b) => !q || `${b.id} ${NO(b)} ${b.customer.name}`.toLowerCase().includes(q));
      m.$('#bkList').innerHTML = F.length ? F.map((b) => `<button type="button" class="chg-line" data-bk="${b.id}"><span><b>${b.id} · ${esc(b.customer.name)}</b><small>${D.fmtRange(b.start, b.end)} · ${esc(Admin.itemsText(b))}</small></span>${pill('rental', b.status)}</button>`).join('') : '<p class="muted">Tidak ada booking aktif yang cocok.</p>'; };
    m.$('#bkQ').addEventListener('input', drawL); drawL();
    m.$('#bkList').addEventListener('click', (e) => { const x = e.target.closest('[data-bk]'); if (!x) return; m.close(); Admin.BK.storeChange(DB.booking(x.dataset.bk), () => { tab = 'change'; Admin.refreshShell(); draw(); }); });
  });
  $('#pane').addEventListener('click', async (e) => {
    const ex = e.target.closest('[data-ext]'); if (ex) { const [bid, xid] = ex.dataset.ext.split('|'); const b = DB.booking(bid); Admin.BK.extend(b, () => { Admin.refreshShell(); draw(); }, b.extensions.find((y) => y.id === xid)); return; }
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); Admin.bookingModal(o.dataset.open, () => { Admin.refreshShell(); draw(); }, { focusReq: true }); return; }
    const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'), rf = e.target.closest('[data-refund]');
    if (ok || no) {
      const [bid, cid] = (ok || no).dataset[ok ? 'ok' : 'no'].split('|'); const b = DB.booking(bid); const c = b.changes.find((x) => x.id === cid);
      if (ok) { if (!(await confirmBox({ title: 'Setujui ganti barang?', text: `${c.qty}× ${esc(c.fromName)} diganti <strong>${esc(c.toName)}</strong> pada ${b.id}. Total booking akan disesuaikan.`, ok: 'Setujui' }))) return; if (Admin.BK.approveChange(b, c)) { Admin.refreshShell(); draw(); } }
      else if (await Admin.BK.rejectChange(b, c)) { Admin.refreshShell(); draw(); }
    }
    if (rf) { if (await Admin.BK.refund(DB.booking(rf.dataset.refund))) { Admin.refreshShell(); draw(); } }
  });
  draw();
})();

