(function () {
  const { DB, D, rupiah, Svc } = Ann; const { $, esc, param, toast, fileToDataURL, pill } = UI;
  const user = Site.requireLogin(); if (!user) return;
  const st = DB.settings();
  const ids = (param('ids') || '').split(',').filter(Boolean);
  const orders = ids.map((id) => (id.startsWith('RNT') ? Object.assign({ _t: 'rent' }, DB.booking(id)) : Object.assign({ _t: 'buy' }, DB.sale(id)))).filter((o) => o.id && (o.customer.email === user.email || DB.isStaff(user)));
  const root = $('#root');
  const pending = orders.filter((o) => o.paymentStatus === 'unpaid' && o.status !== 'dibatalkan');
  if (!orders.length) { root.innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-receipt"></i></div><h3>Tagihan tidak ditemukan</h3><p>Buka halaman Pesanan Saya untuk melihat semua tagihanmu.</p><a class="btn btn-primary" href="pesanan">Buka Pesanan Saya</a></div>`; return; }
  if (!pending.length && orders.every((o) => o.status === 'dibatalkan')) { root.innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-ban"></i></div><h3>Pesanan dibatalkan otomatis</h3><p>${orders.map((o) => o.id).join(', ')} dibatalkan karena pembayaran tidak dilakukan dalam ${+DB.settings().payWindowHours || 1} jam. Barang sudah bisa disewa kembali, silakan buat pesanan baru.</p><a class="btn btn-primary" href="katalog">Sewa lagi</a></div>`; return; }
  if (!pending.length) { root.innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-circle-check"></i></div><h3>Semua tagihan sudah dibayar</h3><p>Admin akan memverifikasi pembayaranmu. Status terbaru bisa dilihat di Pesanan Saya.</p><a class="btn btn-primary" href="pesanan">Buka Pesanan Saya</a></div>`; return; }
  const due = (o) => (o._t === 'rent' ? o.dp : o.total);
  const total = pending.reduce((s, o) => s + due(o), 0);
  const method = pending[0].method;
  const deadline = DB.payDeadline(pending[0]);
  const bank = st.banks.find((b) => method.includes(b.bank));

  root.innerHTML = `<div class="layout-2">
    <div>
      <div class="card">
        <div class="pay-timer"><div><span class="pay-timer-l"><i class="fa-regular fa-clock"></i> Selesaikan pembayaran dalam</span>${UI.cdSpan(deadline.toISOString(), 'pay')}<small>Batas: ${D.fmtDateTime(deadline.toISOString())} WIB</small></div></div>
        <p class="muted">Kamu punya waktu <b>${+DB.settings().payWindowHours || 1} jam</b> sejak pesanan dibuat. Booking yang belum dibayar sampai batas waktu akan dibatalkan otomatis supaya alat bisa disewa orang lain.</p>
        <div style="margin-top:18px">
          ${bank ? `<div class="bank"><div><small class="muted">${esc(method)} · a.n. ${esc(bank.holder)}</small><br><strong id="accNo">${esc(bank.number)}</strong></div><button class="btn btn-light btn-sm" id="copyAcc"><i class="fa-regular fa-copy"></i> Salin</button></div>`
            : `<div class="qris-box"><img src="${UI.asset(st.qrisImg || 'assets/img/qris-annapurna.png')}" alt="QRIS Annapurna Adventure Shop" class="qris-img"><p class="muted" style="font-size:13px;margin:10px 0 8px">Scan dengan aplikasi e-wallet / m-banking (GoPay, OVO, DANA, ShopeePay, dll.), lalu masukkan nominal <b>${rupiah(total)}</b>.</p><a class="btn btn-light btn-sm" href="${UI.asset(st.qrisImg || 'assets/img/qris-annapurna.png')}" download="QRIS-Annapurna-Adventure.png"><i class="fa-solid fa-download"></i> Unduh QRIS</a></div>`}
          <div class="bank" style="background:#fff"><div><small class="muted">Jumlah yang harus ditransfer</small><br><strong style="color:var(--g800);font-size:22px">${rupiah(total)}</strong></div><button class="btn btn-light btn-sm" id="copyAmt"><i class="fa-regular fa-copy"></i> Salin</button></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-upload"></i> Unggah bukti pembayaran</div>
        <label class="upload" id="drop"><input type="file" id="proof" accept="image/*" class="sr-only"><div id="upPrev"><i class="fa-regular fa-image"></i><p style="margin-top:8px"><strong>Pilih foto bukti transfer</strong></p><p class="muted" style="font-size:13px">JPG atau PNG, maksimal 5 MB. Bisa juga seret file ke sini.</p></div></label>
        <span class="error hidden" id="proofErr">Unggah foto bukti pembayaran dulu.</span>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary" id="confirmPay" style="flex:1"><i class="fa-solid fa-paper-plane"></i> Kirim bukti pembayaran</button>
        </div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0"><i class="fa-regular fa-clock"></i> Pesanan baru diproses admin setelah bukti pembayaran dikirim. Belum sempat bayar? Pesanan tetap tersimpan di <a class="link" href="pesanan">Pesanan Saya</a> sampai batas waktu, lalu dibatalkan otomatis.</p>
      </div>
    </div>
    <aside class="card sticky-side">
      <div class="card-title">Rincian tagihan</div>
      ${pending.map((o, i) => `<div style="padding:10px 0;${i < pending.length - 1 ? 'border-bottom:1px dashed var(--line)' : ''}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong>${NO(o)}</strong>${pill(o._t === 'rent' ? 'rental' : 'sale', o.status)}</div>
        <small class="muted">${o._t === 'rent' ? `Sewa ${D.fmtRange(o.start, o.end)} · ${o.items.length} item` : `Pembelian · ${o.items.length} item`}</small>
        <div class="kv" style="padding-bottom:0"><span>${o._t === 'rent' ? `DP ${st.dpPercent}% dari ${rupiah(o.total)}` : 'Total belanja'}</span><span>${rupiah(due(o))}</span></div>
      </div>`).join('')}
      <div class="kv total"><span>Total dibayar</span><span>${rupiah(total)}</span></div>
    </aside>
  </div>`;

  const copy = (txt, label) => { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(`${label} disalin.`)).catch(() => toast(`${label}: ${txt}`)); };
  $('#copyAcc') && $('#copyAcc').addEventListener('click', () => copy(bank.number.replace(/\s/g, ''), 'Nomor rekening'));
  $('#copyAmt').addEventListener('click', () => copy(String(total), 'Jumlah transfer'));

  let proof = null;
  const handle = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('File harus berupa gambar (JPG/PNG).', 'err'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Ukuran file lebih dari 5 MB.', 'err'); return; }
    proof = await fileToDataURL(file, 700);
    $('#upPrev').innerHTML = `<img src="${proof}" alt="Bukti pembayaran"><p class="muted" style="font-size:13px">${esc(file.name)} · klik untuk mengganti</p>`;
    $('#proofErr').classList.add('hidden');
  };
  $('#proof').addEventListener('change', (e) => handle(e.target.files[0]));
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => handle(e.dataTransfer.files[0]));

  $('#confirmPay').addEventListener('click', async () => {
    if (!proof) { $('#proofErr').classList.remove('hidden'); toast('Unggah foto bukti pembayaran dulu.', 'err'); return; }
    
    const confirmBtn = $('#confirmPay');
    await Api.busy(confirmBtn, async () => {
      let fileBlob = null;
      const fileInput = $('#proof');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        fileBlob = fileInput.files[0];
      } else if (proof) {
        fileBlob = Api.dataURLtoBlob(proof);
      }

      for (const o of pending) {
        if (fileBlob) {
          const fd = new FormData();
          if (o._t === 'rent') {
            fd.append('booking_id', o.booking_code || o.id);
            fd.append('payment_type', 'DP');
            fd.append('amount', due(o));
          } else {
            fd.append('sale_id', o.sale_code || o.id);
            fd.append('payment_type', 'Penjualan');
            fd.append('amount', due(o));
          }
          fd.append('bank_name', bank ? bank.bank : 'QRIS');
          fd.append('proof_file', fileBlob, 'proof.jpg');

          await Api.try('POST', 'api/pembayaran/upload', fd, () => null);
        }

        const now = D.nowStamp();
        if (o._t === 'rent') {
          const b = DB.booking(o.id) || o;
          b.status = 'menunggu_konfirmasi'; b.paymentStatus = 'dp_verifying'; b.proof = proof;
          b.history.push({ at: now, text: 'Bukti pembayaran DP diunggah' });
          DB.saveBooking(b);
        } else {
          const s = DB.sale(o.id) || o;
          s.status = 'diproses'; s.paymentStatus = 'verifying'; s.proof = proof;
          s.history.push({ at: now, text: 'Bukti pembayaran diunggah' });
          DB.saveSale(s);
        }
        DB.notifyStaff('Bukti pembayaran masuk', `${o.customer.name} mengunggah bukti pembayaran untuk ${NO(o)}.`, o._t === 'rent' ? 'admin/booking?id=' + o.id : 'admin/penjualan?id=' + o.id);
      }

      DB.notify(user.email, 'Bukti pembayaran terkirim', `Admin sedang memverifikasi pembayaran ${pending.map((o) => NO(o)).join(', ')}.`, 'pesanan');
      /* Ada permintaan antar / bongkar pasang: satu langkah lagi, konfirmasi ongkir ke admin via WhatsApp */
      const svc = [...pending.filter((o) => o._t === 'rent').map((o) => DB.booking(o.id)).filter((b) => b && Svc.has(b)),
        ...pending.filter((o) => o._t === 'buy').map((o) => DB.sale(o.id)).filter((x) => x && Svc.isSaleDeliv(x))];
      if (svc.length) { nextStep(svc); return; }
      location.href = 'pesanan?paid=1';
    }, 'Mengirim bukti…');
  });

  function nextStep(list) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    root.innerHTML = list.map((b) => { const sale = !String(b.id).startsWith('RNT'); const txt = sale ? Svc.waTextSale(b) : Svc.waText(b); return `<div class="card svc-next">
      <div class="head"><span class="ic"><i class="fa-solid ${sale ? 'fa-truck-fast' : Svc.icon(b)}"></i></span><div>
        <h2>Satu langkah lagi: konfirmasi ke admin</h2>
        <p>${sale ? `Bukti pembayaran ${esc(NO(b))} sudah terkirim. Kamu memilih <b>diantar ke tempat</b>. Hubungi admin lewat pesan ini supaya admin bisa menghitung ongkir.` : `Bukti DP ${esc(NO(b))} sudah terkirim. Kamu memilih <b>${esc(Svc.label(b).toLowerCase())}</b>. Kirim pesan ini supaya admin bisa menghitung ${Svc.ongkirText(b)} dan mengunci jadwalnya.`}</p>
      </div></div>
      <p class="svc-msg-l">Pesan yang akan dikirim</p>
      <div class="svc-msg">${esc(txt)}</div>
      <div class="acts">
        <a class="btn btn-wa btn-lg" href="${UI.waLink(txt)}" target="_blank" rel="noopener" data-direct="1" data-svc="${b.id}"><i class="fa-brands fa-whatsapp"></i> ${sale ? 'Hubungi admin untuk ongkir' : 'Konfirmasi ke admin'}</a>
        <a class="btn btn-light" href="pesanan?paid=1">Nanti saja</a>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:12px"><i class="fa-solid fa-circle-info"></i> Tombol yang sama juga ada di Pesanan Saya. ${sale ? 'Ongkir dibayar langsung ke admin, tidak masuk total belanja.' : 'Biaya jasa &amp; ongkir dibayar langsung ke admin, tidak masuk DP.'}</p>
    </div>`; }).join('');
    root.addEventListener('click', (e) => { const a = e.target.closest('[data-svc]'); if (!a) return;
      const sl = !String(a.dataset.svc).startsWith('RNT'); const b = sl ? DB.sale(a.dataset.svc) : DB.booking(a.dataset.svc); if (b && !(b.deliv || {}).waAt) { b.deliv = Object.assign({}, b.deliv, { waAt: D.nowStamp() }); b.history.push({ at: D.nowStamp(), text: sl ? 'Customer menghubungi admin via WhatsApp untuk ongkir antar' : 'Customer mengirim konfirmasi layanan ke admin via WhatsApp' }); sl ? DB.saveSale(b) : DB.saveBooking(b); }
      setTimeout(() => { location.href = 'pesanan?paid=1'; }, 1200); });
  }
})();

