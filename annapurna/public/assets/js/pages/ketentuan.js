/* Halaman Ketentuan (navbar). Semua isi diambil dari Konfigurasi Sistem:
   - Durasi & aturan paket   → Konfigurasi → Aturan Rental (durasi peminjaman & aturan durasi sewa)
   - Ketentuan sewa          → Konfigurasi → Aturan Rental (Ketentuan rental)
   - Kebijakan pembatalan    → Konfigurasi → Pembatalan & Refund
   - Paket tektok            → Konfigurasi → Aturan Rental (Ketentuan paket tektok)
   - Laundry                 → Konfigurasi → Laundry & Jasa Tenda
   - Pembayaran              → DP & rekening dari Pengaturan toko */
(function () {
  const { DB, Rules, rupiah } = Ann; const { $, esc } = UI;
  const st = DB.settings();
  const li = (L) => (L || []).filter(Boolean).map((t) => `<li>${esc(t)}</li>`).join('') || '<li class="muted">Belum ada ketentuan.</li>';
  const ret = String(st.returnTime || '22:00').replace(':', '.');

  /* Durasi peminjaman + tabel aturan paket (mengikuti Konfigurasi) */
  const dr = $('#durRules');
  if (dr) {
    const name = { 1: '1 malam', 3: 'paket 3 hari', 5: 'paket 5 hari' };
    const cards = (st.durations || []).map((d, i) => `<div class="dur-card"><h4>${i + 1}. ${esc(d.name)}</h4><p>${esc(d.note)}</p><div class="ex"><b>Contoh:</b> ${esc(d.example)}</div></div>`).join('');
    const rule = (st.durMode || 'aturan') === 'aturan'
      ? `<div class="kt-dur"><h4><i class="fa-solid fa-calculator"></i> Lama sewa lain dihitung dengan paket</h4><div class="kt-dur-grid">${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<div><b>${n} hari</b><span>${Rules.durBlocks(n).map((x) => name[x]).join(' + ')}</span></div>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">Lebih dari 10 hari: paket 5 hari + aturan sisa harinya. Batas pengembalian tetap sesuai tanggal yang kamu pilih, maksimal pukul ${esc(ret)} WIB.</p></div>`
      : `<p class="muted" style="font-size:13px">Lama sewa lain dihitung dari kombinasi tarif paling hemat. Pengembalian maksimal pukul ${esc(ret)} WIB.</p>`;
    dr.innerHTML = cards + rule;
  }
  const tr = $('#tektokRules'); if (tr) tr.innerHTML = '';
  if ($('#terms')) $('#terms').innerHTML = li(st.rentalTerms);
  if ($('#policy')) $('#policy').innerHTML = li(st.cancelPolicy);
  if ($('#abExample')) $('#abExample').textContent = `Sewa mulai tanggal 30: batal paling lambat tanggal ${30 - (st.cancelDays ?? 2)} → DP dikembalikan ${st.refundPercent ?? 100}%. Batal sesudahnya (H-1 / hari H) → DP tidak dikembalikan.`;
  if ($('#ktTektok')) $('#ktTektok').innerHTML = li(st.tektokTerms);
  if ($('#ktLaundry')) $('#ktLaundry').innerHTML = li(st.laundryTerms);
  if ($('#ktPay')) $('#ktPay').innerHTML = `<ol class="ab-list">
      <li>Booking sewa online cukup bayar <b>DP ${esc(st.dpPercent)}%</b>. Sisanya dilunasi saat mengambil barang, saat barang diantar, atau saat barang dikembalikan.</li>
      <li>Pembelian barang dibayar penuh saat checkout. Ongkir kirim dikonfirmasi admin dan dibayar terpisah.</li>
      <li>Batas waktu membayar DP ${esc(+st.payWindowHours || 1)} jam sejak pesanan dibuat. Lewat dari itu booking dibatalkan otomatis.</li>
      <li>Promo / diskon (mis. untuk yang memberi ulasan di Google Maps) dipotong dari sisa pelunasan setelah dicek admin.</li></ol>
    <div class="kt-banks">${(st.banks || []).map((b) => `<div><small>${esc(b.bank)}</small><b>${esc(b.number)}</b><span>a.n. ${esc(b.holder)}</span></div>`).join('')}${st.qrisImg ? '<div><small>QRIS</small><b>Semua e-wallet &amp; m-banking</b><span>Scan saat pembayaran</span></div>' : ''}</div>`;
  if ($('#ktShip')) $('#ktShip').innerHTML = li([
    'Barang sewa bisa diantar-jemput staff toko ke lokasimu. Ongkir sesuai jarak dan dikonfirmasi admin via WhatsApp.',
    'Jasa bongkar-pasang tenda tersedia untuk barang sewa (biaya jasa per tenda + ongkir).',
    'Barang beli bisa dikirim ke alamat via ekspedisi (J&T, JNE, SPX, AnterAja, Grab, Gojek). Nomor resi dikirim lewat WhatsApp.',
    'Ongkir tidak termasuk total belanja / DP dan dibayar langsung ke admin.',
  ]);
  if ($('#ktUpd')) $('#ktUpd').innerHTML = `<i class="fa-solid fa-circle-info"></i> Ketentuan dapat berubah sewaktu-waktu. Ada pertanyaan? <a class="link" href="${UI.waLink('Halo Annapurna Adventure, saya mau bertanya tentang ketentuan sewa.')}" target="_blank" rel="noopener">Tanya lewat WhatsApp</a>.`;
  /* lompat ke bagian dari tautan (#durasi, #batal, dll.) setelah konten terisi */
  if (location.hash) setTimeout(() => { const t = document.querySelector(location.hash); if (t) t.scrollIntoView({ block: 'start' }); }, 120);
})();
