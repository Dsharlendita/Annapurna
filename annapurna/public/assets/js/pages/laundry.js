/* Halaman Laundry (customer) — ketentuan mitra: TIDAK ada antar jemput laundry.
   - Hero, cara laundry, daftar harga + kalkulator estimasi, dan ketentuan (semua angka dari pengaturan Owner).
   - Tidak ada pesanan yang tersimpan dari website: customer membawa barang ke toko, staff mencatatnya di kasir (nota DRY/…). */
(function () {
  const { DB, D, rupiah, Laundry } = Ann; const { $, $$, esc, url, waLink } = UI;
  const st = DB.settings();
  const cats = DB.laundryPrices();
  const days = Laundry.days();
  const minAll = Math.min(...cats.flatMap((c) => c.items.map((i) => i.price)));
  const qty = {}; /* id item → jumlah */
  let filter = 'all';

  /* ---------- Hero: fakta singkat ---------- */
  $('#lpFacts').innerHTML = [
    ['fa-tags', `Mulai ${rupiah(minAll)}`, 'per barang'],
    ['fa-regular fa-clock', `±${days} hari`, 'estimasi selesai'],
    ['fa-store', 'Antar & ambil', 'langsung di toko'],
  ].map(([ic, b, s]) => `<li><i class="${ic.startsWith('fa-regular') ? ic : 'fa-solid ' + ic}"></i><span><b>${esc(b)}</b><small>${esc(s)}</small></span></li>`).join('');

  /* ---------- Cara laundry ---------- */
  $('#lpSteps').innerHTML = [
    ['fa-person-walking-luggage', 'Bawa ke toko', `Datang ke toko (${st.hours || 'jam buka toko'}). Staff mengecek kondisi barang bersamamu.`],
    ['fa-receipt', 'Terima struk', 'Kamu mendapat struk berisi rincian barang, total biaya, dan tanggal estimasi selesai.'],
    ['fa-jug-detergent', 'Kami cuci', `Barang dicuci sesuai jenis bahannya. Estimasi selesai ±${days} hari.`],
    ['fa-bag-shopping', 'Ambil & bayar', 'Kami kabari via WhatsApp saat siap. Tunjukkan struk dan bayar saat mengambil.'],
  ].map(([ic, t, d], i) => `<li><span class="n">${i + 1}</span><span class="ic"><i class="fa-solid ${ic}"></i></span><h3>${t}</h3><p>${esc(d)}</p></li>`).join('');

  /* ---------- Daftar harga + estimasi ---------- */
  const root = $('#root');
  root.innerHTML = `
    <div class="lp-list">
      <div class="lp-tabs" role="tablist" aria-label="Kategori laundry">
        <button type="button" class="on" data-f="all" role="tab">Semua</button>
        ${cats.map((c) => `<button type="button" data-f="${esc(c.id)}" role="tab"><i class="fa-solid ${esc(c.icon || 'fa-circle')}"></i> ${esc(c.name)}</button>`).join('')}
      </div>
      ${cats.map((c) => `<section class="lp-cat" data-cat="${esc(c.id)}" aria-labelledby="ldc-${esc(c.id)}">
        <h3 class="lp-cat-h" id="ldc-${esc(c.id)}"><span><i class="fa-solid ${esc(c.icon || 'fa-circle')}" aria-hidden="true"></i></span>${esc(c.name)}<small>${c.items.length} jenis</small></h3>
        <div class="lp-items">${c.items.map((it) => `<div class="lp-item" data-row="${esc(it.id)}">
          <div class="nm"><b>${esc(it.name)}</b><span>${rupiah(it.price)} <small>/ pcs</small></span></div>
          <div class="qty sm" role="group" aria-label="Jumlah ${esc(it.name)}">
            <button type="button" data-q="-1" data-id="${esc(it.id)}" aria-label="Kurangi ${esc(it.name)}"><i class="fa-solid fa-minus"></i></button>
            <input value="0" inputmode="numeric" data-in="${esc(it.id)}" aria-label="Jumlah ${esc(it.name)}">
            <button type="button" data-q="1" data-id="${esc(it.id)}" aria-label="Tambah ${esc(it.name)}"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>`).join('')}</div>
      </section>`).join('')}
    </div>
    <aside class="sticky-side lp-sum" aria-live="polite">
      <div class="lp-ticket">
        <div class="lp-ticket-h"><i class="fa-solid fa-receipt"></i><div><b>Estimasi laundry</b><small>Perkiraan dari daftar harga</small></div></div>
        <div id="ldLines"></div>
        <div class="lp-ticket-tot"><span>Estimasi total</span><b id="ldTotal">${rupiah(0)}</b></div>
        <div class="lp-ticket-meta"><span><i class="fa-regular fa-calendar"></i> Bawa hari ini, selesai ±<b id="ldDone">${D.fmtDate(D.addDays(D.today(), days), true)}</b></span></div>
        <button type="button" class="link-btn lp-reset" id="ldReset" hidden><i class="fa-solid fa-rotate-left"></i> Kosongkan</button>
      </div>
      <div class="lp-store">
        <div class="lp-store-h"><i class="fa-solid fa-store"></i> Bawa langsung ke toko</div>
        <p>${esc(st.address)}</p>
        <p class="hrs"><i class="fa-regular fa-clock"></i> ${esc(st.hours || '')}</p>
        <div class="acts"><a class="btn btn-primary btn-sm" href="${url('kontak#lokasi')}"><i class="fa-solid fa-location-dot"></i> Lihat peta</a><a class="btn btn-light btn-sm" id="ldAsk" href="${waLink('Halo admin Annapurna, saya mau tanya soal laundry.')}" target="_blank" rel="noopener" data-direct="1"><i class="fa-brands fa-whatsapp"></i> Tanya admin</a></div>
        <p class="note"><i class="fa-solid fa-circle-info"></i> Laundry hanya melalui toko, tidak ada antar jemput.</p>
      </div>
    </aside>
    <div class="ld-sticky"><div><small>Estimasi</small><b id="ldStickyAmt">${rupiah(0)}</b></div><a class="btn btn-primary btn-sm" href="${url('kontak#lokasi')}"><i class="fa-solid fa-store"></i> Lokasi toko</a></div>`;
  document.body.classList.add('has-ld-sticky');

  const picked = () => cats.flatMap((c) => c.items.filter((it) => qty[it.id] > 0).map((it) => ({ id: it.id, name: it.name, price: it.price, qty: qty[it.id] })));
  function sync() {
    const L = picked(); const total = L.reduce((a, i) => a + i.price * i.qty, 0); const n = L.reduce((a, i) => a + i.qty, 0);
    $('#ldLines').innerHTML = L.length ? `<ul class="lp-lines">${L.map((i) => `<li><span>${i.qty}× ${esc(i.name)}</span><b>${rupiah(i.price * i.qty)}</b></li>`).join('')}</ul>`
      : '<div class="lp-empty"><i class="fa-solid fa-basket-shopping"></i><p>Tambahkan jumlah barang di daftar harga untuk melihat estimasinya.</p></div>';
    $('#ldTotal').textContent = rupiah(total); $('#ldStickyAmt').textContent = n ? `${rupiah(total)} · ${n} barang` : rupiah(0);
    $('#ldReset').hidden = !L.length;
    /* Pesan tanya admin ikut membawa daftar barang yang dipilih */
    $('#ldAsk').href = waLink(L.length ? `Halo admin Annapurna, saya mau tanya soal laundry:\n${L.map((i) => `• ${i.qty}× ${i.name}`).join('\n')}\nEstimasi: ${rupiah(total)}` : 'Halo admin Annapurna, saya mau tanya soal laundry.');
    $$('[data-row]').forEach((r) => r.classList.toggle('on', qty[r.dataset.row] > 0));
  }
  const setQty = (id, v) => { qty[id] = Math.max(0, Math.min(99, Math.round(+v || 0))); const inp = root.querySelector(`[data-in="${id}"]`); if (inp) inp.value = qty[id]; sync(); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]'); if (b) { setQty(b.dataset.id, (qty[b.dataset.id] || 0) + +b.dataset.q); return; }
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; $$('.lp-tabs [data-f]').forEach((x) => x.classList.toggle('on', x === f)); $$('.lp-cat').forEach((c) => { c.hidden = filter !== 'all' && c.dataset.cat !== filter; }); return; }
    if (e.target.closest('#ldReset')) { Object.keys(qty).forEach((k) => setQty(k, 0)); }
  });
  root.addEventListener('change', (e) => { const i = e.target.closest('[data-in]'); if (i) setQty(i.dataset.in, String(i.value).replace(/[^\d]/g, '')); });
  root.addEventListener('focusin', (e) => { const i = e.target.closest('[data-in]'); if (i) i.select(); });
  sync();

  /* ---------- Ketentuan (diatur Owner, sama dengan yang dicetak di struk) ---------- */
  $('#lpTerms').innerHTML = `<div class="lp-terms-h"><span class="ic"><i class="fa-solid fa-clipboard-check"></i></span><div><h2 id="lpTermsT">Sebelum kamu datang</h2><p>Ketentuan laundry yang juga tercetak di struk.</p></div></div>
    <ol>${Laundry.terms().map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
})();
