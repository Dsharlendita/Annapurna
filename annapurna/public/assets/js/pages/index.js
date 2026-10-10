(function () {
  const { DB, D, rupiah } = Ann; const { $, $$, esc, asset, url, productCard, bindProductActions, stars } = UI;
  $('#swoosh').innerHTML = MTN.swoosh;
  $('#mtnSolid').innerHTML = MTN.solid;
  $('#mtnSolid2').innerHTML = MTN.solid;

  $('#heroSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#heroQ').value.trim();
    const beli = ($('#heroSearch').querySelector('input[name="hmode"]:checked') || {}).value === 'beli';
    location.href = (beli ? 'belanja' : 'katalog') + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  const prods = DB.products();
  $('#catGrid').innerHTML = DB.categories().map((c) => {
    const n = prods.filter((p) => p.cat === c.id).length;
    return `<a class="cat-card" href="katalog?cat=${c.id}"><div class="ph"><img src="${asset(c.img)}" alt="${esc(c.name)}" loading="lazy"></div><div class="tx"><strong>${esc(c.name)}</strong><small>(${n} Produk)</small></div></a>`;
  }).join('');

  /* Produk Rental Terlaris: dihitung dari jumlah sewa (pengaturan owner: otomatis / manual / gabungan). 3 teratas dapat label "Terlaris". */
  const HB = DB.homeBest();
  const best = HB.items.map((x) => x.p);
  const bestTitle = $('#bestTitle'), bestEye = $('#bestEyebrow'), bestNote = $('#bestNote');
  if (bestTitle) bestTitle.textContent = HB.cfg.mode === 'manual' ? 'Produk Pilihan Kami' : 'Produk Rental Terlaris';
  if (bestEye) bestEye.textContent = HB.cfg.mode === 'manual' ? 'Rekomendasi Toko' : 'Produk Pilihan';
  if (bestNote) bestNote.textContent = HB.cfg.mode === 'manual' ? 'Dipilih langsung oleh tim Annapurna.' : `Berdasarkan jumlah sewa ${+HB.cfg.days ? HB.cfg.days + ' hari terakhir' : 'sepanjang waktu'}.`;
  $('#bestGrid').innerHTML = best.map((p) => productCard(p, 'rent')).join('');
  bindProductActions($('#bestGrid'));

  /* Produk Jual Terlaris: jumlah terjual dari pesanan beli yang tidak dibatalkan (cadangan: rating) */
  const sold = {}; DB.sales().filter((s) => s.status !== 'dibatalkan').forEach((s) => s.items.forEach((i) => { sold[i.refId] = (sold[i.refId] || 0) + i.qty; }));
  const shop = DB.products().filter((p) => p.price > 0 && p.active !== false && p.stock > 0).sort((a, b) => (sold[b.id] || 0) - (sold[a.id] || 0) || (b.rating || 0) - (a.rating || 0)).slice(0, 6);
  if ($('#shopGrid')) { $('#shopGrid').innerHTML = shop.map((p) => UI.productCard(p, 'buy')).join(''); UI.bindProductActions($('#shopGrid')); }
  /* Cara Sewa | Cara Beli: isi langkah dari pengaturan owner */
  const HT = Object.assign({}, (DB.settings().howto) || {});
  const HREF = { sewa: ['katalog', 'keranjang', 'pesanan', 'pesanan'], beli: ['belanja', 'keranjang', 'pesanan?tab=beli', 'pesanan?tab=beli'] };
  ['sewa', 'beli'].forEach((k) => { const ol = document.querySelector(`[data-how-steps="${k}"]`); const L = HT[k]; if (!ol || !L || !L.length) return;
    ol.innerHTML = L.map((s, i) => `${i ? '<li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>' : ''}<li class="step in"><a href="${UI.url(HREF[k][i] || HREF[k][HREF[k].length - 1])}"><div class="blob"><span class="num">${i + 1}</span><i class="fa-solid ${esc(s.icon || 'fa-circle')}"></i></div><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></a></li>`).join('');
    ol.style.setProperty('--n', L.length); });
  /* Cara Sewa | Cara Beli */
  const HOW = { sewa: ['Cara Sewa', 'Nikmati proses penyewaan yang praktis dan aman bersama Annapurna Adventure.'], beli: ['Cara Beli', 'Belanja perlengkapan baru semudah sewa: pilih, bayar, ambil di toko.'] };
  document.querySelectorAll('[data-how]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.how; document.querySelectorAll('[data-how]').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('[data-how-steps]').forEach((o) => { o.hidden = o.dataset.howSteps !== k; o.querySelectorAll('.step').forEach((st) => st.classList.add('in')); });
    $('#howTitle').textContent = HOW[k][0]; $('#howSub').textContent = HOW[k][1];
  }));
  /* Testimoni dipisah: Penyewa | Pembeli (yang disematkan admin tampil dulu) */
  const REV = (DB.reviews ? DB.reviews() : DB.get('reviews')).filter((r) => r.visible !== false);
  const byType = (t) => REV.filter((r) => (r.type || 'rent') === t).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.order ?? 99) - (b.order ?? 99) || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);
  let tType = 'rent';
  const ctx = (t) => { const names = (t.productIds || []).map((id) => (DB.product(id) || {}).name).filter(Boolean); return names.length ? `<span class="t-ctx ${t.type || 'rent'}"><i class="fa-solid ${t.type === 'buy' ? 'fa-bag-shopping' : 'fa-campground'}"></i> ${t.type === 'buy' ? 'Beli' : 'Sewa'} · ${esc(names.slice(0, 2).join(', '))}${names.length > 2 ? ` +${names.length - 2}` : ''}</span>` : ''; };
  const T = byType('rent'), sum = DB.ratingSummary();
  $('#testiScore').innerHTML = sum.count ? `<strong>${sum.avg.toLocaleString('id-ID')}</strong><div>${stars(sum.avg, false)}<small>dari ${sum.count.toLocaleString('id-ID')} penilaian pelanggan</small></div>` : '';
  if (!byType('rent').length && !byType('buy').length) { $('#testimoni').hidden = true; }
  const drawTesti = (L) => { $('#testiCards').innerHTML = L.length ? L.map((t) => `
    <figure class="t-card">
      <i class="fa-solid fa-quote-right q" aria-hidden="true"></i>
      <div class="who"><span class="rv-av">${t.img ? `<img src="${asset(t.img)}" alt="">` : esc(t.name.charAt(0))}</span><div><strong>${esc(t.name)}</strong><small>${esc(t.role || (t.type === 'rent' ? 'Penyewa' : 'Pembeli'))}</small>${stars(t.rating, false)}</div></div>
      ${ctx(t)}
      <p>“${esc(t.text)}”</p>
      ${t.reply ? `<div class="t-reply"><strong><i class="fa-solid fa-store"></i> Balasan Annapurna</strong><span>${esc(t.reply)}</span></div>` : ''}
    </figure>`).join('') : `<div class="t-empty"><i class="fa-regular fa-comment-dots"></i> Belum ada ulasan ${tType === 'buy' ? 'pembeli' : 'penyewa'} yang ditampilkan.</div>`; $('#testiCards').scrollLeft = 0; };
  drawTesti(T);
  document.querySelectorAll('[data-tt]').forEach((b) => b.addEventListener('click', () => { tType = b.dataset.tt; document.querySelectorAll('[data-tt]').forEach((x) => x.classList.toggle('active', x === b)); drawTesti(byType(tType)); }));
  if (T.length > 3) {
    const track = $('#testiCards'); $('#testiNav').hidden = false;
    const step = () => track.querySelector('.t-card').offsetWidth + 14;
    const go = (dir) => { const max = track.scrollWidth - track.clientWidth - 4; track.scrollTo({ left: dir > 0 && track.scrollLeft >= max ? 0 : track.scrollLeft + dir * step(), behavior: 'smooth' }); };
    $('#testiNav').addEventListener('click', (e) => { const b = e.target.closest('[data-dir]'); if (b) go(+b.dataset.dir); });
    let timer = setInterval(() => go(1), 5000);
    ['mouseenter', 'touchstart', 'focusin'].forEach((ev) => track.addEventListener(ev, () => clearInterval(timer), { passive: true }));
  }
  $('#aiPlanForm').addEventListener('submit', (e) => { e.preventDefault(); AI.openPlanner($('#aiPlanQ').value.trim() || ''); });
  $('#aiAsk') && $('#aiAsk').addEventListener('click', () => window.AIChat && AIChat.open('chat'));
  $$('#aiPlanForm .ex button').forEach((b) => b.addEventListener('click', () => AI.openPlanner(b.textContent)));
  const TD = D.today();
  const promos = DB.promos().filter((p) => p.active && p.home && TD >= p.start && TD <= p.end && !(p.quota && p.used >= p.quota));
  if (promos.length) {
    $('#promo').hidden = false;
    const AP = { rent: 'Sewa alat', buy: 'Belanja alat', all: 'Sewa & belanja' };
    $('#promoStrip').innerHTML = promos.map((p) => `<article class="promo-tile"><div><span class="pt-val">${p.type === 'persen' ? `${p.value}%` : rupiah(p.value)}<small>${p.type === 'persen' ? 'diskon' : 'potongan'}</small></span></div>
      <div class="pt-bd"><strong>${esc(p.name)}</strong><p>${esc(p.desc || '')}</p><small>${AP[p.applies]}${p.minTotal ? ` · min. ${rupiah(p.minTotal)}` : ''}${p.weekday ? ' · ambil Senin–Kamis' : ''} · s/d ${D.fmtDate(p.end, true)}</small>
      <button class="pt-code" data-code="${esc(p.code)}" title="Salin kode"><i class="fa-regular fa-copy"></i> ${esc(p.code)}</button></div></article>`).join('');
    $('#promoStrip').addEventListener('click', (e) => { const b = e.target.closest('[data-code]'); if (!b) return; navigator.clipboard && navigator.clipboard.writeText(b.dataset.code); UI.toast(`Kode ${b.dataset.code} disalin. Masukkan saat checkout.`); });
  }

  /* Untuk customer yang sudah login: pesanan aktif atau "sewa lagi" trip terakhir */
  (function mine() {
    const u = DB.session(); if (!u || DB.isStaff(u)) return;
    const B = DB.bookings().filter((b) => b.customer.email === u.email || b.userEmail === u.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    /* Pesanan aktif, diurutkan dari yang paling mendesak: terlambat → kembali hari ini → belum bayar → sedang disewa → siap ambil → menunggu verifikasi */
    const T = Ann.D.today();
    const rank = (b) => (b.status === 'disewa' && T > b.end ? 0 : b.status === 'disewa' && T === b.end ? 1 : b.status === 'menunggu_pembayaran' ? 2 : b.status === 'disewa' ? 3 : b.status === 'dikonfirmasi' ? 4 : 5);
    const acts = B.filter((b) => ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'].includes(b.status)).sort((x, y) => rank(x) - rank(y) || x.start.localeCompare(y.start));
    const act = acts[0];
    const rowInfo = (b) => {
      if (b.status === 'disewa' && T > b.end) return ['red', 'Terlambat', `Lewat batas kembali ${Ann.D.fmtDate(b.end, true)}. Segera kembalikan, denda berjalan.`];
      if (b.status === 'disewa') return [T === b.end ? 'amber' : 'teal', T === b.end ? 'Kembali hari ini' : 'Sedang disewa', `Kembalikan paling lambat ${Ann.D.fmtDate(b.end, true)} pukul ${String(DB.settings().returnTime || '22:00').replace(':', '.')} · sisa ${UI.cdSpan(UI.returnDeadline(b).toISOString(), 'return')}`];
      if (b.status === 'menunggu_pembayaran') return ['amber', 'Belum bayar', `Bayar DP ${rupiah(b.dp)} dalam ${UI.cdSpan(DB.payDeadline(b).toISOString(), 'pay')}`];
      if (b.status === 'dikonfirmasi') return ['green', 'Siap diambil', `Ambil ${Ann.D.fmtDate(b.start, true)} di toko`];
      return ['blue', 'Menunggu verifikasi', 'Bukti pembayaran sedang dicek admin'];
    };
    const last = B.find((b) => b.status === 'selesai');
    const box = $('#mineBox'); const first = u.name.split(' ')[0];
    if (act) {
      const more = acts.slice(1, 3);
      box.innerHTML = `<div class="mine-card"><div class="mc-h"><div><small>Halo, ${esc(first)} · ${acts.length > 1 ? `${acts.length} pesanan aktif` : 'Pesanan aktifmu'}</small><strong>${act.id} · ${Ann.D.fmtRange(act.start, act.end)}</strong></div><a class="btn btn-light btn-sm" href="pesanan?id=${act.id}">Lihat pesanan</a></div>${UI.orderTracker(act)}
        ${more.length ? `<div class="mine-more">${more.map((b) => { const [tone, lab, txt] = rowInfo(b); return `<a class="mine-row" href="pesanan?id=${b.id}"><span class="pill ${tone}">${lab}</span><span class="mr-main"><b>${NO(b)}</b> · ${Ann.D.fmtRange(b.start, b.end)}<small>${txt}</small></span><i class="fa-solid fa-chevron-right"></i></a>`; }).join('')}${acts.length > 3 ? `<a class="mine-all" href="pesanan">Lihat semua pesanan (${acts.length})</a>` : ''}</div>` : ''}</div>`;
    } else if (last) {
      const items = last.items;
      box.innerHTML = `<div class="mine-card again"><div class="mc-h"><div><small>Halo, ${esc(first)}</small><strong>Sewa lagi perlengkapan trip terakhirmu?</strong></div></div>
        <div class="again-items">${items.map((i) => `<span><img src="${asset(i.img)}" alt="">${i.qty}× ${esc(i.name)}</span>`).join('')}</div>
        <div class="again-f"><span class="muted">Trip terakhir ${Ann.D.fmtRange(last.start, last.end)} · ${last.days} hari</span><button class="btn btn-primary" id="againBtn"><i class="fa-solid fa-rotate-right"></i> Sewa lagi</button></div></div>`;
      $('#againBtn').addEventListener('click', () => UI.tripModal(() => {
        const t = DB.trip(); if (!t) return;
        items.forEach((it) => UI.Cart.add(Object.assign({ type: 'rent', kind: it.kind, refId: it.refId, qty: it.qty, start: t.start, end: t.end }, it.size ? { size: it.size } : {})));
        location.href = 'keranjang';
      }));
    } else return;
    $('#mineSec').hidden = false;
  })();
})();
