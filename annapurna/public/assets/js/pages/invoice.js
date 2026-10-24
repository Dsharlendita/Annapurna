(async function () {
  const { DB, Rules, STATUS, D, rupiah, Laundry, Share } = Ann; const { $, esc, asset, param, pill, waLink } = UI;
  const id = param('id') || '';
  const isRent = id.startsWith('RNT');
  const isLd = id.startsWith('DRY'); /* nota laundry (DRY/001/X/2026): halaman PUBLIK, siapa pun yang punya link bisa membuka tanpa akun */
  const hasS = !!param('s'); /* link publik (nota sewa/beli/laundry yang dikirim lewat WhatsApp): isi nota ada di parameter s, tanpa login */
  const user = (isLd || hasS) ? DB.session() : Site.requireLogin(); if (!user && !isLd && !hasS) return;
  const staff = DB.isStaff(user);
  /* Nota laundry di link WhatsApp membawa isi notanya (parameter s) agar terbuka di HP customer mana pun. Staff tetap melihat data terkini. */
  const snap = isLd && param('s') ? await Laundry.fromShare(param('s')) : null;
  const local = isRent ? DB.booking(id) : isLd ? DB.laundryOrder(id) : DB.sale(id);
  const pubSnap = !isLd && hasS ? await Share.from(param('s')) : null;
  const mine = !isLd && local && user && (staff || (local.customer.email && local.customer.email === user.email)); /* pemilik/staff melihat data terkini */
  const x = isLd ? ((staff ? local || snap : snap || local)) : mine ? local : pubSnap && pubSnap.id === id ? pubSnap : (hasS ? null : local);
  const st = x && x._snap ? Object.assign({}, DB.settings(), x._snap.store, { laundryTerms: x._snap.terms || DB.settings().laundryTerms }) : DB.settings();
  const NUM = x ? (isLd ? x.no : NO(x)) : id;
  /* Tombol Kembali mengikuti asal halaman: dibuka dari website customer → kembali ke website customer,
     dibuka dari panel admin/owner → kembali ke panel. Owner/staff yang sedang di website customer tidak dilempar ke panel. */
  const ref = (() => { try { const u = new URL(document.referrer); return u.origin === location.origin && !/\/invoice\b/.test(u.pathname) ? u.pathname + u.search + u.hash : ''; } catch (e) { return ''; } })();
  const fromPanel = /^\/?(?:[^/]+\/)*(admin|owner)(\/|$)/.test(ref.replace(/^\/+/, '/'));
  const custBack = isRent ? 'pesanan?id=' + id : isLd ? 'pesanan' : 'pesanan?tab=beli';
  const panelBack = isRent ? 'admin/booking?id=' + id : isLd ? 'admin/laundry?id=' + id : 'admin/penjualan?id=' + id;
  const ownOrder = !!(local && user && local.customer && local.customer.email && local.customer.email === user.email);
  if (ref) $('#back').href = ref;
  else if (staff && !ownOrder) $('#back').href = panelBack;
  else if (!user) $('#back').remove(); /* pengunjung tanpa akun: tidak ada halaman "Kembali" yang relevan */
  else $('#back').href = custBack;
  if ($('#back')) $('#back').title = fromPanel ? 'Kembali ke panel' : 'Kembali';

  if (isLd && !x) {
    $('#inv').innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-regular fa-file-lines"></i></div><h3>Nota laundry tidak ditemukan</h3><p>Link nota tidak lengkap atau sudah rusak. Minta admin ${esc(st.storeName || 'Annapurna')} mengirim ulang link notanya.</p><a class="btn btn-primary" href="./">Ke Beranda</a></div>`;
    return;
  }
  if (!isLd && hasS && !x) {
    $('#inv').innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-regular fa-file-lines"></i></div><h3>Nota tidak ditemukan</h3><p>Link nota tidak lengkap atau sudah rusak. Minta admin ${esc(st.storeName || 'Annapurna')} mengirim ulang link notanya.</p><a class="btn btn-primary" href="./">Ke Beranda</a></div>`;
    return;
  }
  if (!x || (!isLd && !hasS && !staff && (!x.customer.email || x.customer.email !== user.email))) {
    $('#inv').innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-regular fa-file-lines"></i></div><h3>Invoice tidak ditemukan</h3><p>Nomor transaksi tidak valid atau bukan milik akunmu.</p><a class="btn btn-primary" href="pesanan">Ke Pesanan Saya</a></div>`;
    return;
  }
  const paid = isLd ? Laundry.paid(x) : Rules.paidTotal(x);
  const refunded = (x.refunds || []).reduce((s, r) => s + r.amount, 0);
  const total = isLd ? Laundry.total(x) : x.total;
  const sisa = Math.max(0, total - paid);
  let stamp, stampColor;
  if (x.status === 'dibatalkan') { stamp = 'DIBATALKAN'; stampColor = '#b23a2a'; }
  else if (isLd && x.status === 'selesai' && sisa <= 0) { stamp = 'LUNAS'; stampColor = '#1f4d2f'; }
  else if (isRent && UI.billOf(x).late) { stamp = `TERLAMBAT ${UI.billOf(x).late} MALAM`; stampColor = '#b42318'; }
  else if (isRent && UI.billOf(x).dueToday) { stamp = 'JATUH TEMPO HARI INI'; stampColor = '#b7791f'; }
  else if (sisa <= 0) { stamp = 'LUNAS'; stampColor = '#1f4d2f'; }
  else if (paid > 0) { stamp = 'DP DIBAYAR'; stampColor = '#b7791f'; }
  else if (!isLd && UI.pendingPay(x)) { stamp = 'MENUNGGU VERIFIKASI'; stampColor = '#2b5aa8'; }
  else { stamp = 'BELUM DIBAYAR'; stampColor = '#b7791f'; }

  const saleDel = !isRent && !isLd && Ann.Svc.isSaleDeliv(x); /* penjualan yang minta diantar ke tempat */
  const BL = isRent ? UI.billOf(x) : { late: 0, fines: [], fine: 0, dueToday: false };
  const CI = isLd ? { ok: [], all: [], add: 0, base: total } : UI.changeInfo(x); const dpPaid = (x.payments || []).filter((p) => p.type === 'DP').reduce((a, p) => a + (+p.amount || 0), 0);
  const rows = isLd
    ? (x.items || []).map((it) => `<tr><td><div class="prod"><div><strong>${esc(it.name)}</strong>${it.cat ? `<small>${esc(it.cat)}</small>` : ''}<small class="inv-m">${it.qty} × ${rupiah(it.price)}</small></div></div></td><td class="num">${it.qty}</td><td class="num">${rupiah(it.price)}</td><td class="num">${rupiah(it.price * it.qty)}</td></tr>`).join('')
    : isRent
    ? x.items.map((it) => `<tr><td><div class="prod"><img src="${asset(it.img)}" alt=""><div><strong>${esc(it.name)}</strong>${it.kind === 'package' ? '<small>Paket</small>' : ''}<small class="inv-m">${it.qty} × ${rupiah(Rules.lineUnit(it, x.days))} · ${esc(Rules.tierLabel(it.tiers || { d1: it.pricePerDay }, x.days))}</small></div></div></td><td class="num">${it.qty}</td><td class="num">${rupiah(Rules.lineUnit(it, x.days))}</td><td class="num">${esc(Rules.tierLabel(it.tiers || { d1: it.pricePerDay }, x.days))}</td><td class="num">${rupiah(Rules.lineUnit(it, x.days) * it.qty)}</td></tr>`).join('')
    : x.items.map((it) => `<tr><td><div class="prod"><img src="${asset(it.img)}" alt=""><div><strong>${esc(it.name)}</strong><small class="inv-m">${it.qty} × ${rupiah(it.price)}</small></div></div></td><td class="num">${it.qty}</td><td class="num">${rupiah(it.price)}</td><td class="num">${rupiah(it.price * it.qty)}</td></tr>`).join('');

  /* Tagihan layanan antar / jasa tenda: terpisah dari total sewa, ongkir diisi admin setelah kesepakatan WhatsApp */
  function svcBill() {
    const S = Ann.Svc; if (!(isRent && S.has(x)) && !saleDel) return '';
    const bl = S.bill(x); const tent = S.isTent(x); const d = x.deliv || {};
    return `<div class="inv-foot inv-svc"><div class="box">
      <h5>Biaya layanan · ${esc(saleDel ? 'Dikirim ke alamat' : S.label(x))}</h5>
      ${tent ? `<div class="kv"><span>Jasa ${esc(S.short(x).toLowerCase())} (${d.tents || 1} tenda)</span><span>${rupiah(bl.jasa)}</span></div>` : ''}
      <div class="kv"><span>${S.ongkirText(x).replace(/^o/, 'O')}</span><span>${bl.ongkirSet ? rupiah(bl.ongkir) : '<em class="muted">menunggu konfirmasi admin</em>'}</span></div>
      <div class="kv total"><span>${saleDel ? 'Total ongkir' : 'Total layanan'}</span><span>${rupiah(bl.total)}${bl.ongkirSet ? '' : ' + ongkir'}</span></div>
      <div class="kv hl"><span>Sudah dibayar</span><span>${rupiah(bl.paid)}</span></div>
      ${bl.ongkirSet ? `<div class="kv"><span>Sisa layanan</span><strong>${bl.due ? rupiah(bl.due) : 'Lunas'}</strong></div>` : ''}
      <p class="muted" style="font-size:11.5px;margin-top:6px">Dibayar terpisah dari ${saleDel ? 'total belanja' : 'sewa'}, langsung ke admin.${d.notaAt ? ` Diperbarui ${D.fmtDateTime(d.notaAt)}.` : ''}</p>
    </div></div>
    ${grandTotal(bl)}`;
  }
  /* Total akhir yang harus dibayar customer = sewa + layanan (antar / jasa tenda / ongkir) */
  function grandTotal(bl) {
    const paidRent = Rules.paidTotal(x); const fine = +x.fine || 0;
    const rentTot = x.total; const all = rentTot + bl.total; const paid = paidRent + bl.paid; const due = Math.max(0, all - paid);
    return `<div class="inv-foot inv-grand"><div class="box">
      <h5>Ringkasan pembayaran</h5>
      <div class="kv"><span>${saleDel ? 'Total belanja' : 'Total sewa'}${fine ? ' (termasuk denda)' : ''}</span><span>${rupiah(rentTot)}</span></div>
      <div class="kv"><span>${saleDel ? (Ann.Svc.shipMode(x) === 'kurir' ? 'Ongkir antar (staff toko)' : 'Ongkir (diteruskan ke ekspedisi)') : 'Total layanan'}</span><span>${rupiah(bl.total)}${bl.ongkirSet ? '' : ' + ongkir'}</span></div>
      <div class="kv total"><span>TOTAL KESELURUHAN</span><span>${rupiah(all)}${bl.ongkirSet ? '' : ' + ongkir'}</span></div>
      <div class="kv hl"><span>Sudah dibayar</span><span>${rupiah(paid)}</span></div>
      <div class="kv grand-due"><span>SISA YANG HARUS DIBAYAR</span><span>${due ? rupiah(due) : 'LUNAS'}${bl.ongkirSet || !due ? '' : ' + ongkir'}</span></div>
      ${!bl.ongkirSet ? '<p class="muted" style="font-size:11.5px;margin-top:6px">Ongkir ditambahkan setelah dikonfirmasi admin via WhatsApp.</p>' : ''}
    </div></div>`;
  }
  $('#inv').innerHTML = `<div class="invoice">
    <div class="inv-head">
      <div><img src="assets/img/logo.png" alt="Annapurna Adventure"><p class="muted" style="font-size:13px;margin-top:8px;max-width:34ch">${esc(st.address)}<br>${esc(st.phone)} · ${esc(st.email)}</p></div>
      <div style="text-align:right">
        <h2>${isRent ? 'NOTA BOOKING' : isLd ? 'NOTA LAUNDRY' : 'INVOICE'}</h2>
        <p style="font-weight:700;font-size:16px">#${esc(NUM)}</p>
        <p class="muted" style="font-size:13px">Tanggal: ${D.fmtDate(x.createdAt, true)}</p>
        <div style="margin-top:10px;color:${stampColor}"><span class="stamp">${stamp}</span></div>
      </div>
      <div class="inv-qr"><div id="invQr"></div><small>Tunjukkan QR ini ke staff</small></div>
    </div>
    <div class="inv-meta">
      <div><h5>Ditagihkan kepada</h5><strong>${esc(x.customer.name)}</strong><br>${esc(x.customer.phone)}${x.customer.email ? '<br>' + esc(x.customer.email) : ''}</div>
      <div><h5>${isRent ? 'Detail sewa' : isLd ? 'Detail laundry' : 'Detail pesanan'}</h5>
        ${isLd ? `<div>Diterima: ${D.fmtDateTime(x.createdAt)}</div><div>Estimasi selesai: <strong>${D.fmtDate(Laundry.est(x), true)}</strong></div><div>Pengambilan: Antar &amp; ambil sendiri di toko</div>` : ''}
        ${isRent ? `<div>Periode: <strong>${D.fmtRange(x.start, x.end)}</strong> (${x.days} malam · kembali maks. pukul ${String(st.returnTime || '22:00').replace(':', '.')} WIB)</div><div>Ambil: ${D.fmtDate(x.start, true)} · Kembali: ${D.fmtDate(x.end, true)}</div>` : ''}
        ${isLd ? '' : `<div>Pengambilan: ${isRent ? esc(Ann.Svc.label(x)) : saleDel ? 'Dikirim ke alamat' : 'Ambil di toko'}</div>`}${isRent && Ann.Svc.has(x) ? `<div>Layanan: ${esc(Ann.Svc.brief(x))}</div>${(x.deliv || {}).courier ? `<div>Pengantar: <strong>${esc(x.deliv.courier)}${x.deliv.courierPhone ? ' · ' + esc(x.deliv.courierPhone) : ''}</strong></div>` : ''}` : ''}${saleDel ? `<div>Alamat antar: ${esc((x.deliv || {}).address || '-')}</div>${Ann.Svc.shipRows(x).map(([, l, v]) => `<div>${esc(l)}: <strong>${esc(v)}</strong></div>`).join('')}` : ''}
        <div>Pembayaran: ${esc(isLd ? ((x.payments || []).slice(-1)[0] || {}).via || '-' : x.method || '-')}</div>
        <div style="margin-top:6px">${saleDel ? '<span class="svc-tag antar"><i class="fa-solid fa-truck-fast"></i> Diantar</span> ' : ''}${isRent ? pill('rental', x.status) : isLd ? pill('laundry', x.status) : pill('sale', x.status)} ${pill('payment', isLd ? (paid >= total ? 'paid' : 'unpaid') : x.paymentStatus)}</div>
      </div>
    </div>
    <div class="table-wrap" data-no-paginate><table class="table inv-items">
      <thead><tr><th>Barang</th><th class="num">Qty</th><th class="num">${isRent ? 'Harga/unit' : 'Harga'}</th>${isRent ? '<th class="num">Durasi</th>' : ''}<th class="num">Jumlah</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${isRent ? UI.changesHtml(x) : ''}
    ${BL.late ? `<div class="late-sec"><h5><i class="fa-solid fa-triangle-exclamation"></i> Tagihan denda keterlambatan · ${BL.late} malam</h5><p>Batas pengembalian ${D.fmtDate(x.end, true)} pukul ${String(st.returnTime || '22:00').replace(':', '.')} WIB sudah lewat. Denda bertambah setiap malam sampai barang dikembalikan.</p>
      <div class="table-wrap" data-no-paginate><table class="table inv-items"><thead><tr><th>Barang</th><th class="num">Qty</th><th class="num">Tarif/malam</th><th class="num">Malam</th><th class="num">Denda</th></tr></thead><tbody>${BL.fines.map((f) => `<tr><td>${esc(f.name)}<small class="inv-m">${f.qty} × ${rupiah(f.per)} × ${BL.late} malam</small></td><td class="num">${f.qty}</td><td class="num">${rupiah(f.per)}</td><td class="num">${BL.late}</td><td class="num"><b>${rupiah(f.total)}</b></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="inv-feet ${(isRent && Ann.Svc.has(x)) || saleDel ? 'has-svc' : ''}">
    <div class="inv-foot inv-main"><div class="box">
      ${isRent && CI.ok.length ? `<div class="kv"><span>Total awal</span><span>${rupiah(CI.base)}</span></div><div class="kv"><span>Tambahan ganti barang</span><span style="color:#9a6508;font-weight:700">${CI.add >= 0 ? '+' : '−'} ${rupiah(Math.abs(CI.add))}</span></div>` : ''}
      <div class="kv"><span>Subtotal${isRent && CI.ok.length ? ' (setelah ganti barang)' : ''}</span><span>${rupiah(isLd ? (x.items || []).reduce((a, i) => a + i.price * i.qty, 0) : x.subtotal)}</span></div>
      ${isLd && x.ongkir ? `<div class="kv"><span>Ongkir</span><span>${rupiah(x.ongkir)}</span></div>` : ''}
      ${isLd && x.discount ? `<div class="kv"><span>${esc(x.discountReason ? 'Diskon · ' + x.discountReason : 'Diskon')}</span><span style="color:var(--g700)">− ${rupiah(x.discount)}</span></div>` : ''}
      ${!isLd && x.discount ? `<div class="kv"><span>${esc(Ann.DB.discLabel(x.discount))}</span><span style="color:var(--g700)">− ${rupiah(x.discount.amount)}</span></div>` : ''}
      ${!isLd && x.settleDisc && +x.settleDisc.amount ? `<div class="kv"><span>Diskon pelunasan · ${esc(x.settleDisc.reason || '')}</span><span style="color:var(--g700)">− ${rupiah(x.settleDisc.amount)}</span></div>` : ''}
      ${isRent && x.fine ? `<div class="kv"><span>Denda / biaya tambahan</span><span>${rupiah(x.fine)}</span></div>` : ''}
      <div class="kv total"><span>${isRent && CI.ok.length ? 'Total baru' : 'Total'}</span><span>${rupiah(total)}</span></div>
      ${isRent ? (dpPaid ? `<div class="kv"><span>DP sudah dibayar</span><span>${rupiah(dpPaid)}</span></div>` : `<div class="kv"><span>DP ${st.dpPercent}% yang harus dibayar</span><span>${rupiah(x.dp)}</span></div>`) : ''}
      <div class="kv hl"><span>Sudah dibayar${!isLd && UI.pendingPay(x) ? ' (terverifikasi)' : ''}</span><span>${rupiah(paid)}</span></div>${isLd ? '' : UI.pendingPayHtml(x)}
      ${refunded ? `<div class="kv"><span>Dikembalikan</span><span>− ${rupiah(refunded)}</span></div>` : ''}
      ${x.status !== 'dibatalkan' ? `<div class="kv"><span>${isRent && ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(x.status) ? 'Sisa dibayar saat ambil' : 'Sisa pembayaran'}</span><strong>${rupiah(sisa)}</strong></div>` : ''}${BL.late ? `<div class="kv"><span>Denda keterlambatan (${BL.late} malam)</span><span style="color:#b42318;font-weight:700">${rupiah(BL.fine)}</span></div><div class="kv total" style="color:#b42318"><span>Total dibayar saat kembali</span><span>${rupiah(sisa + BL.fine)}</span></div>` : ''}${isRent && CI.all.some((c) => c.status === 'menunggu') ? '<p class="muted" style="font-size:12px;margin-top:6px">Ada permintaan ganti barang yang masih menunggu persetujuan admin, belum dihitung di total.</p>' : ''}
    </div></div>
    ${svcBill()}
    </div>
    ${(x.payments || []).length || (x.svc || []).length ? `<h5 class="inv-hist-h" style="margin:22px 0 8px;font-size:12px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase">Riwayat pembayaran</h5>
      ${[...(x.payments || []).map((p) => ({ at: p.at, t: p.type || p.via || 'Pembayaran', a: p.amount })), ...(x.svc || []).map((p) => ({ at: p.at, t: p.kind === 'pasang' ? 'Jasa tenda' : 'Ongkir', a: p.amount }))].sort((a, b) => String(a.at).localeCompare(String(b.at))).map((p) => `<div class="kv" style="border-bottom:1px dashed var(--line)"><span>${D.fmtDateTime(p.at)} · ${esc(p.t)}</span><span>${rupiah(p.a)}</span></div>`).join('')}` : ''}
    ${isRent ? `<div class="notice green" style="margin-top:22px"><i class="fa-solid fa-circle-info"></i><div><strong>Ketentuan singkat</strong><ul>${st.rentalTerms.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}<li>${esc(st.cancelPolicy[0])}</li></ul></div></div>` : ''}
    ${isLd ? `<div class="notice green" style="margin-top:22px"><i class="fa-solid fa-circle-info"></i><div><strong>Ketentuan laundry</strong><ul>${(x._snap ? x._snap.terms || [] : Laundry.terms()).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>` : ''}
    <p class="muted" style="text-align:center;font-size:12.5px;margin-top:22px">Terima kasih telah mempercayai Annapurna Adventure. Tunjukkan nota ini${isRent ? ' dan kartu identitas asli' : ''} saat ${saleDel ? 'barang diantar' : 'mengambil barang di toko'}.</p>
  </div>`;
  (async () => { try { await UI.loadScript(UI.asset('assets/vendor/qr/qrcode-generator.js')); const q = window.qrcode(0, 'M'); q.addData(`${UI.BASE}${isRent ? 'admin/booking' : isLd ? 'admin/laundry' : 'admin/penjualan'}?id=${x.id}`); q.make(); $('#invQr').innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) { $('#invQr').closest('.inv-qr').remove(); } })();
  /* Tombol WhatsApp: membuka jendela kirim nota digital (gambar nota + pesan) ke admin */
  const direct = isLd || !!x._snap; /* nota dari link publik: tidak ada data lokal, jadi langsung buka chat admin */
  $('#waShare').href = direct ? waLink(`Halo ${st.storeName || 'Annapurna'}, saya mau tanya soal nota ${isLd ? 'laundry ' : ''}${NUM}.`) : waLink('');
  if (direct) $('#waShare').dataset.direct = '1'; else $('#waShare').dataset.nota = x.id;
  if (x._snap) $('#inv .invoice').insertAdjacentHTML('beforeend', `<p class="muted no-print" style="text-align:center;font-size:11.5px;margin-top:6px">Data nota per ${D.fmtDateTime(x._snap.at)}. Untuk status terbaru, hubungi toko.</p>`);
  /* Dibuka staff/owner dari panel admin: tombol WhatsApp customer tidak ditampilkan */
  const staffView = ['admin', 'owner'].includes((user || {}).role);
  if (staffView) $('#waShare').remove();
  document.title = `Nota ${NUM} — Annapurna Adventure`;
  /* Struk thermal 58/80 mm (ukuran dari Konfigurasi → Nota & Struk) */
  if ($('#prStruk')) $('#prStruk').addEventListener('click', () => UI.printAny(Object.assign({}, x, { no: x.no || NUM })));
  $('#dlPdf').addEventListener('click', async () => {
    const btn = $('#dlPdf'), h = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan…';
    const fname = `${isRent ? 'Nota-Booking' : isLd ? 'Nota-Laundry' : 'Invoice'}-${NUM.replace(/\//g, '-')}`;
    /* PDF dari gambar nota yang digambar sistem (sama dengan nota WhatsApp): teks label & tabel selalu rapi di dalam kotaknya */
    try { const nx = Object.assign({}, x, { no: x.no || NUM }); const cv = isRent ? await UI.tagihanCanvas(nx, { booking: true, title: 'NOTA BOOKING' }) : isLd ? await UI.ldNotaCanvas(nx) : await UI.saleCanvas(nx);
      await UI.canvasToPDF(cv, fname); UI.toast('Nota PDF berhasil diunduh.'); }
    catch (e0) { console.error(e0); try { await UI.elementToPDF($('#inv .invoice'), fname); UI.toast('Nota PDF berhasil diunduh.'); } catch (e) { console.error(e); UI.toast('Gagal membuat PDF. Gunakan tombol Cetak.', 'err'); } }
    btn.disabled = false; btn.innerHTML = h;
  });
})();

