(function () {
  const { DB, D, rupiah } = Ann; const { $, esc, param, toast, fileToDataURL, pill } = UI;
  const user = Site.requireLogin(); if (!user) return;
  const st = DB.settings();
  const ids = (param('ids') || '').split(',').filter(Boolean);
  const orders = ids.map((id) => (id.startsWith('RNT') ? Object.assign({ _t: 'rent' }, DB.booking(id)) : Object.assign({ _t: 'buy' }, DB.sale(id)))).filter((o) => o.id && (o.customer.email === user.email || DB.isStaff(user)));
  const root = $('#root');
  const pending = orders.filter((o) => o.paymentStatus === 'unpaid');
  if (!orders.length) { root.innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-receipt"></i></div><h3>Tagihan tidak ditemukan</h3><p>Buka halaman Pesanan Saya untuk melihat semua tagihanmu.</p><a class="btn btn-primary" href="pesanan">Buka Pesanan Saya</a></div>`; return; }
  if (!pending.length) { root.innerHTML = `<div class="card empty-state"><div class="ic"><i class="fa-solid fa-circle-check"></i></div><h3>Semua tagihan sudah dibayar</h3><p>Admin akan memverifikasi pembayaranmu. Status terbaru bisa dilihat di Pesanan Saya.</p><a class="btn btn-primary" href="pesanan">Buka Pesanan Saya</a></div>`; return; }
  const due = (o) => (o._t === 'rent' ? o.dp : o.total);
  const total = pending.reduce((s, o) => s + due(o), 0);
  const method = pending[0].method;
  const deadline = new Date(new Date(pending[0].createdAt).getTime() + 24 * 3600e3);
  const bank = st.banks.find((b) => method.includes(b.bank));
  let qr = ''; let seed = total % 997 + 7;
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { seed = (seed * 9301 + 49297) % 233280; const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13); const on = corner ? (x % 6 === 0 || y % 6 === 0 || (x % 7 > 1 && x % 7 < 5 && y % 7 > 1 && y % 7 < 5)) : seed / 233280 > .5; if (on) qr += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }

  root.innerHTML = `<div class="layout-2">
    <div>
      <div class="card">
        <div class="card-title"><i class="fa-regular fa-clock"></i> Selesaikan pembayaran sebelum ${D.fmtDateTime(deadline.toISOString())}</div>
        <p class="muted">Booking yang belum dibayar sampai batas waktu akan dibatalkan otomatis supaya alat bisa disewa orang lain.</p>
        <div style="margin-top:18px">
          ${bank ? `<div class="bank"><div><small class="muted">${esc(method)} · a.n. ${esc(bank.holder)}</small><br><strong id="accNo">${esc(bank.number)}</strong></div><button class="btn btn-light btn-sm" id="copyAcc"><i class="fa-regular fa-copy"></i> Salin</button></div>`
            : `<div style="text-align:center"><svg class="qris" viewBox="-1 -1 23 23" role="img" aria-label="Kode QRIS pembayaran"><g fill="#15311f">${qr}</g></svg><p class="muted" style="font-size:13px">Scan QRIS dengan aplikasi e-wallet atau m-banking</p></div>`}
          <div class="bank" style="background:#fff"><div><small class="muted">Jumlah yang harus ditransfer</small><br><strong style="color:var(--g800);font-size:22px">${rupiah(total)}</strong></div><button class="btn btn-light btn-sm" id="copyAmt"><i class="fa-regular fa-copy"></i> Salin</button></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-upload"></i> Unggah bukti pembayaran</div>
        <label class="upload" id="drop"><input type="file" id="proof" accept="image/*" class="sr-only"><div id="upPrev"><i class="fa-regular fa-image"></i><p style="margin-top:8px"><strong>Pilih foto bukti transfer</strong></p><p class="muted" style="font-size:13px">JPG atau PNG, maksimal 5 MB. Bisa juga seret file ke sini.</p></div></label>
        <span class="error hidden" id="proofErr">Unggah foto bukti pembayaran dulu.</span>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary" id="confirmPay" style="flex:1"><i class="fa-solid fa-paper-plane"></i> Kirim bukti pembayaran</button>
          <a class="btn btn-light" href="pesanan">Bayar nanti</a>
        </div>
      </div>
    </div>
    <aside class="card sticky-side">
      <div class="card-title">Rincian tagihan</div>
      ${pending.map((o) => `<div style="padding:10px 0;border-bottom:1px dashed var(--line)">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong>${o.id}</strong>${pill(o._t === 'rent' ? 'rental' : 'sale', o.status)}</div>
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

  $('#confirmPay').addEventListener('click', () => {
    if (!proof) { $('#proofErr').classList.remove('hidden'); toast('Unggah foto bukti pembayaran dulu.', 'err'); return; }
    pending.forEach((o) => {
      const now = D.nowStamp();
      if (o._t === 'rent') {
        const b = DB.booking(o.id);
        b.status = 'menunggu_konfirmasi'; b.paymentStatus = 'dp_verifying'; b.proof = proof;
        b.history.push({ at: now, text: 'Bukti pembayaran DP diunggah' });
        DB.saveBooking(b);
      } else {
        const s = DB.sale(o.id);
        s.status = 'diproses'; s.paymentStatus = 'verifying'; s.proof = proof;
        s.history.push({ at: now, text: 'Bukti pembayaran diunggah' });
        DB.saveSale(s);
      }
      DB.notifyStaff('Bukti pembayaran masuk', `${o.customer.name} mengunggah bukti pembayaran untuk ${o.id}.`, o._t === 'rent' ? 'admin/booking?id=' + o.id : 'admin/penjualan?id=' + o.id);
    });
    DB.notify(user.email, 'Bukti pembayaran terkirim', `Admin sedang memverifikasi pembayaran ${pending.map((o) => o.id).join(', ')}.`, 'pesanan');
    location.href = 'pesanan?paid=1';
  });
})();

