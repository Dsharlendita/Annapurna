/* Halaman Laundry (customer) — ketentuan mitra: TIDAK ada antar jemput laundry.
   - Hanya daftar harga + kalkulator estimasi. Tidak ada pesanan yang tersimpan / dikirim dari website.
   - Customer membawa barang langsung ke toko; staff mencatat laundry & pembayarannya di kasir (nota DRY/…). */
(function () {
  const { DB, rupiah } = Ann; const { $, esc, url } = UI;
  const st = DB.settings();
  const cats = DB.laundryPrices();
  const qty = {}; /* id item → jumlah */
  const root = $('#root');

  root.innerHTML = `
    <div class="card">
      ${cats.map((c) => `<section class="ld-cat" aria-labelledby="ldc-${esc(c.id)}">
        <h2 class="ld-cat-h" id="ldc-${esc(c.id)}"><i class="fa-solid ${esc(c.icon || 'fa-circle')}" aria-hidden="true"></i>${esc(c.name)}</h2>
        ${c.items.map((it) => `<div class="ld-row" data-row="${esc(it.id)}">
          <span class="nm">${esc(it.name)}</span>
          <span class="pr">${rupiah(it.price)}</span>
          <div class="qty sm" role="group" aria-label="Jumlah ${esc(it.name)}">
            <button type="button" data-q="-1" data-id="${esc(it.id)}" aria-label="Kurangi ${esc(it.name)}"><i class="fa-solid fa-minus"></i></button>
            <input value="0" inputmode="numeric" data-in="${esc(it.id)}" aria-label="Jumlah ${esc(it.name)}">
            <button type="button" data-q="1" data-id="${esc(it.id)}" aria-label="Tambah ${esc(it.name)}"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>`).join('')}
      </section>`).join('')}
    </div>
    <aside class="card sticky-side ld-sum" aria-live="polite">
      <div class="card-title"><i class="fa-solid fa-calculator"></i> Estimasi biaya</div>
      <div id="ldLines"></div>
      <div class="kv total"><span>Estimasi</span><span id="ldTotal">${rupiah(0)}</span></div>
      <div class="ld-store">
        <i class="fa-solid fa-store ic" aria-hidden="true"></i>
        <div><b>Bawa langsung ke toko</b><small>${esc(st.address)}</small><small>${esc(st.hours || '')}</small>
          <a class="link" href="${url('kontak#lokasi')}" style="font-weight:600;font-size:13px"><i class="fa-solid fa-location-dot"></i> Lihat peta</a></div>
      </div>
      <p class="ld-note"><i class="fa-solid fa-circle-info"></i><span>Laundry hanya melalui toko, tidak ada layanan antar jemput. Estimasi dihitung dari daftar harga; biaya akhir dicatat staff saat barang diterima.</span></p>
    </aside>
    <div class="ld-sticky"><div><small>Estimasi</small><b id="ldStickyAmt">${rupiah(0)}</b></div><a class="btn btn-light btn-sm" href="${url('kontak#lokasi')}"><i class="fa-solid fa-store"></i> Lokasi toko</a></div>`;
  document.body.classList.add('has-ld-sticky');

  const picked = () => cats.flatMap((c) => c.items.filter((it) => qty[it.id] > 0).map((it) => ({ id: it.id, name: it.name, price: it.price, qty: qty[it.id] })));
  function sync() {
    const L = picked(); const total = L.reduce((a, i) => a + i.price * i.qty, 0); const n = L.reduce((a, i) => a + i.qty, 0);
    $('#ldLines').innerHTML = L.length ? `<div class="ld-lines">${L.map((i) => `<div class="kv"><span>${i.qty}× ${esc(i.name)}</span><span>${rupiah(i.price * i.qty)}</span></div>`).join('')}</div>`
      : '<p class="ld-empty">Tambahkan jumlah barang di daftar harga untuk melihat estimasinya.</p>';
    $('#ldTotal').textContent = rupiah(total); $('#ldStickyAmt').textContent = n ? `${rupiah(total)} · ${n} barang` : rupiah(0);
    document.querySelectorAll('[data-row]').forEach((r) => r.classList.toggle('on', qty[r.dataset.row] > 0));
  }
  const setQty = (id, v) => { qty[id] = Math.max(0, Math.min(99, Math.round(+v || 0))); const inp = root.querySelector(`[data-in="${id}"]`); if (inp) inp.value = qty[id]; sync(); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]'); if (b) setQty(b.dataset.id, (qty[b.dataset.id] || 0) + +b.dataset.q);
  });
  root.addEventListener('change', (e) => { const i = e.target.closest('[data-in]'); if (i) setQty(i.dataset.in, String(i.value).replace(/[^\d]/g, '')); });
  root.addEventListener('focusin', (e) => { const i = e.target.closest('[data-in]'); if (i) i.select(); });
  sync();
})();
