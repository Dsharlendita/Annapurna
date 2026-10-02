(function () {
  const { DB, D, rupiah } = Ann; const { $, $$, esc, asset, productCard, bindProductActions, stars } = UI;
  $('#swoosh').innerHTML = MTN.swoosh;
  $('#mtnSolid').innerHTML = MTN.solid;
  $('#mtnSolid2').innerHTML = MTN.solid;

  $('#heroSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#heroQ').value.trim();
    location.href = 'katalog' + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  const prods = DB.products();
  $('#catGrid').innerHTML = DB.categories().map((c) => {
    const n = prods.filter((p) => p.cat === c.id).length;
    return `<a class="cat-card" href="katalog?cat=${c.id}"><div class="ph"><img src="${asset(c.img)}" alt="${esc(c.name)}" loading="lazy"></div><div class="tx"><strong>${esc(c.name)}</strong><small>(${n} Produk)</small></div></a>`;
  }).join('');

  const best = prods.filter((p) => p.featured && p.rent).slice(0, 6);
  $('#bestGrid').innerHTML = best.map((p) => productCard(p, 'rent')).join('');
  bindProductActions($('#bestGrid'));

  const T = DB.testimonials(), sum = DB.ratingSummary();
  $('#testiScore').innerHTML = sum.count ? `<strong>${sum.avg.toLocaleString('id-ID')}</strong><div>${stars(sum.avg, false)}<small>dari ${sum.count.toLocaleString('id-ID')} penilaian pelanggan</small></div>` : '';
  if (!T.length) { $('#testimoni').hidden = true; }
  $('#testiCards').innerHTML = T.map((t) => `
    <figure class="t-card">
      <i class="fa-solid fa-quote-right q" aria-hidden="true"></i>
      <div class="who"><span class="rv-av">${t.img ? `<img src="${asset(t.img)}" alt="">` : esc(t.name.charAt(0))}</span><div><strong>${esc(t.name)}</strong><small>${esc(t.role || (t.type === 'rent' ? 'Penyewa' : 'Pembeli'))}</small>${stars(t.rating, false)}</div></div>
      <p>“${esc(t.text)}”</p>
      ${t.reply ? `<div class="t-reply"><strong><i class="fa-solid fa-store"></i> Balasan Annapurna</strong><span>${esc(t.reply)}</span></div>` : ''}
    </figure>`).join('');
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
    const act = B.find((b) => ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'].includes(b.status));
    const last = B.find((b) => b.status === 'selesai');
    const box = $('#mineBox'); const first = u.name.split(' ')[0];
    if (act) {
      box.innerHTML = `<div class="mine-card"><div class="mc-h"><div><small>Halo, ${esc(first)} 👋 · Pesanan aktifmu</small><strong>${act.id} · ${Ann.D.fmtRange(act.start, act.end)}</strong></div><a class="btn btn-light btn-sm" href="pesanan?id=${act.id}">Lihat pesanan</a></div>${UI.orderTracker(act)}</div>`;
    } else if (last) {
      const items = last.items;
      box.innerHTML = `<div class="mine-card again"><div class="mc-h"><div><small>Halo, ${esc(first)} 👋</small><strong>Sewa lagi perlengkapan trip terakhirmu?</strong></div></div>
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
