(function () {
  if (window.Admin.blocked) return;
  const { DB, D } = Ann;
  const { $, esc } = UI;
  Admin.init('sop', 'SOP & Peraturan');
  const CTX = { '': 'Semua', umum: 'Umum', barang_keluar: 'Barang keluar', pengembalian: 'Pengembalian', pembatalan: 'Pembatalan & refund', penjualan: 'Penjualan' };
  const ICON = { umum: 'fa-circle-info', barang_keluar: 'fa-box-open', pengembalian: 'fa-rotate-left', pembatalan: 'fa-ban', penjualan: 'fa-bag-shopping' };
  let ctx = '';
  function draw() {
    const all = DB.sops().filter((x) => x.active !== false);
    $('#ctx').innerHTML = Object.entries(CTX).filter(([k]) => !k || all.some((x) => x.context === k)).map(([k, l]) => `<button class="btn ${k === ctx ? 'btn-primary' : 'btn-light'} btn-sm" data-c="${k}">${l}</button>`).join('')
      + (Admin.isOwner ? `<span style="flex:1"></span><a class="btn btn-light btn-sm" href="${Admin.O('konfigurasi?s=sop')}"><i class="fa-solid fa-pen"></i> Kelola SOP</a>` : '');
    const L = all.filter((x) => !ctx || x.context === ctx).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    $('#list').innerHTML = L.length ? L.map((x) => `<article class="sop-card"><div class="sop-h"><span class="pill blue plain"><i class="fa-solid ${ICON[x.context] || 'fa-circle-info'}"></i> ${CTX[x.context] || x.context}</span>${x.pinned ? '<span class="pill amber plain"><i class="fa-solid fa-thumbtack"></i> Penting</span>' : ''}</div><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p></article>`).join('')
      : '<div class="panel empty-state"><div class="ic"><i class="fa-solid fa-clipboard-list"></i></div><h3>Belum ada SOP</h3><p>SOP yang dibuat Owner akan tampil di sini.</p></div>';
  }
  $('#ctx').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { ctx = b.dataset.c; draw(); } });
  draw();
})();
