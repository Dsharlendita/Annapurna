(function () {
  const { DB, Rules, STATUS, D, rupiah } = Ann; const { $, esc, asset, param, pill, waLink } = UI;
  const user = Site.requireLogin(); if (!user) return;
  const id = param('id') || '';
  const isRent = id.startsWith('RNT');
  const x = isRent ? DB.booking(id) : DB.sale(id);
  const st = DB.settings();
  if (DB.isStaff(user)) $('#back').href = isRent ? 'admin/booking?id=' + id : 'admin/penjualan?id=' + id;
  else $('#back').href = isRent ? 'pesanan?id=' + id : 'pesanan?tab=beli';

  if (!x || (!DB.isStaff(user) && x.customer.email !== user.email)) {
    $('#inv').innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-regular fa-file-lines"></i></div><h3>Invoice tidak ditemukan</h3><p>Nomor transaksi tidak valid atau bukan milik akunmu.</p><a class="btn btn-primary" href="pesanan">Ke Pesanan Saya</a></div>`;
    return;
  }
  const paid = Rules.paidTotal(x);
  const refunded = (x.refunds || []).reduce((s, r) => s + r.amount, 0);
  const total = x.total;
  const sisa = Math.max(0, total - paid);
  let stamp, stampColor;
  if (x.status === 'dibatalkan') { stamp = 'DIBATALKAN'; stampColor = '#b23a2a'; }
  else if (sisa <= 0) { stamp = 'LUNAS'; stampColor = '#1f4d2f'; }
  else if (paid > 0) { stamp = 'DP DIBAYAR'; stampColor = '#b7791f'; }
  else { stamp = 'BELUM DIBAYAR'; stampColor = '#b7791f'; }

  const rows = isRent
    ? x.items.map((it) => `<tr><td><div class="prod"><img src="${asset(it.img)}" alt=""><div><strong>${esc(it.name)}</strong>${it.kind === 'package' ? '<small>Paket</small>' : ''}</div></div></td><td class="num">${it.qty}</td><td class="num">${rupiah(it.pricePerDay)}</td><td class="num">${x.days} hari</td><td class="num">${rupiah(it.pricePerDay * it.qty * x.days)}</td></tr>`).join('')
    : x.items.map((it) => `<tr><td><div class="prod"><img src="${asset(it.img)}" alt=""><strong>${esc(it.name)}</strong></div></td><td class="num">${it.qty}</td><td class="num">${rupiah(it.price)}</td><td class="num">${rupiah(it.price * it.qty)}</td></tr>`).join('');

  $('#inv').innerHTML = `<div class="invoice">
    <div class="inv-head">
      <div><img src="assets/img/logo.png" alt="Annapurna Adventure"><p class="muted" style="font-size:13px;margin-top:8px;max-width:34ch">${esc(st.address)}<br>${esc(st.phone)} · ${esc(st.email)}</p></div>
      <div style="text-align:right">
        <h2>${isRent ? 'NOTA BOOKING' : 'NOTA PEMBELIAN'}</h2>
        <p style="font-weight:700;font-size:16px">#${esc(x.id)}</p>
        <p class="muted" style="font-size:13px">Tanggal: ${D.fmtDate(x.createdAt, true)}</p>
        <div style="margin-top:10px;color:${stampColor}"><span class="stamp">${stamp}</span></div>
      </div>
      <div class="inv-qr"><div id="invQr"></div><small>Tunjukkan QR ini ke staff</small></div>
    </div>
    <div class="inv-meta">
      <div><h5>Ditagihkan kepada</h5><strong>${esc(x.customer.name)}</strong><br>${esc(x.customer.phone)}<br>${esc(x.customer.email)}</div>
      <div><h5>${isRent ? 'Detail sewa' : 'Detail pesanan'}</h5>
        ${isRent ? `<div>Periode: <strong>${D.fmtRange(x.start, x.end)}</strong> (${x.days} hari)</div><div>Ambil: ${D.fmtDate(x.start, true)} · Kembali: ${D.fmtDate(x.end, true)}</div>` : ''}
        <div>Pengambilan: Ambil di toko</div>
        <div>Pembayaran: ${esc(x.method || '-')}</div>
        <div style="margin-top:6px">${isRent ? pill('rental', x.status) : pill('sale', x.status)} ${pill('payment', x.paymentStatus)}</div>
      </div>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Barang</th><th class="num">Qty</th><th class="num">${isRent ? 'Harga/hari' : 'Harga'}</th>${isRent ? '<th class="num">Durasi</th>' : ''}<th class="num">Jumlah</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="inv-foot"><div class="box">
      <div class="kv"><span>Subtotal</span><span>${rupiah(x.subtotal)}</span></div>
      ${x.discount ? `<div class="kv"><span>Promo ${esc(x.discount.code)}</span><span style="color:var(--g700)">− ${rupiah(x.discount.amount)}</span></div>` : ''}
      ${isRent && x.fine ? `<div class="kv"><span>Denda / biaya tambahan</span><span>${rupiah(x.fine)}</span></div>` : ''}
      <div class="kv total"><span>Total</span><span>${rupiah(total)}</span></div>
      ${isRent ? `<div class="kv"><span>DP ${st.dpPercent}%</span><span>${rupiah(x.dp)}</span></div>` : ''}
      <div class="kv hl"><span>Sudah dibayar</span><span>${rupiah(paid)}</span></div>
      ${refunded ? `<div class="kv"><span>Dikembalikan</span><span>− ${rupiah(refunded)}</span></div>` : ''}
      ${x.status !== 'dibatalkan' ? `<div class="kv"><span>Sisa pembayaran</span><strong>${rupiah(sisa)}</strong></div>` : ''}
    </div></div>
    ${(x.payments || []).length ? `<h5 style="margin:22px 0 8px;font-size:12px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase">Riwayat pembayaran</h5>
      ${x.payments.map((p) => `<div class="kv" style="border-bottom:1px dashed var(--line)"><span>${D.fmtDateTime(p.at)} · ${esc(p.type)}</span><span>${rupiah(p.amount)}</span></div>`).join('')}` : ''}
    ${isRent ? `<div class="notice green" style="margin-top:22px"><i class="fa-solid fa-circle-info"></i><div><strong>Ketentuan singkat</strong><ul>${st.rentalTerms.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}<li>${esc(st.cancelPolicy[0])}</li></ul></div></div>` : ''}
    <p class="muted" style="text-align:center;font-size:12.5px;margin-top:22px">Terima kasih telah mempercayai Annapurna Adventure. Tunjukkan nota ini${isRent ? ' dan kartu identitas asli' : ''} saat mengambil barang di toko.</p>
  </div>`;
  (async () => { try { await UI.loadScript(UI.asset('assets/vendor/qr/qrcode-generator.js')); const q = window.qrcode(0, 'M'); q.addData(`${UI.BASE}${isRent ? 'admin/booking' : 'admin/penjualan'}?id=${x.id}`); q.make(); $('#invQr').innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) { $('#invQr').closest('.inv-qr').remove(); } })();
  $('#waShare').href = waLink(`Halo Annapurna Adventure, berikut nota ${isRent ? 'booking' : 'pembelian'} saya: #${x.id} atas nama ${x.customer.name}. Total ${rupiah(total)}, sudah dibayar ${rupiah(paid)}.`);
  document.title = `${x.id} — Annapurna Adventure`;
  $('#dlPdf').addEventListener('click', async () => {
    const btn = $('#dlPdf'), h = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan…';
    try { await UI.elementToPDF($('#inv .invoice'), `${isRent ? 'Nota-Booking' : 'Invoice'}-${x.id}`); UI.toast('Nota PDF berhasil diunduh.'); }
    catch (e) { console.error(e); UI.toast('Gagal membuat PDF. Gunakan tombol Cetak.', 'err'); }
    btn.disabled = false; btn.innerHTML = h;
  });
})();

