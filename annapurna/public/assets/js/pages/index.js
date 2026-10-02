(function () {
  const { DB, rupiah } = Ann; const { $, $$, esc, asset, productCard, bindProductActions, stars } = UI;
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
})();

