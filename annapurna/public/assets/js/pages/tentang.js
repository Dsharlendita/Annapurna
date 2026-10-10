(function () {
  const { DB, D } = Ann; const { $, $$, esc, waLink } = UI;
  const st = DB.settings();
  const products = DB.products();
  const sum = DB.ratingSummary();
  const units = products.reduce((a, p) => a + (p.stock || 0), 0);
  const stats = [
    { n: products.length, suffix: '', label: 'Jenis alat', note: 'Tenda, tas, footwear, fashion, outdoor & cooking equipment' },
    { n: units, suffix: '+', label: 'Unit perlengkapan', note: 'Siap disewa bergantian setiap hari' },
    { n: sum.avg, suffix: '', label: 'Rating pelanggan', dec: 1, star: true, note: 'Rata-rata dari ulasan penyewa' },
    { n: sum.count, suffix: '', label: 'Penilaian', note: 'Ulasan dari pelanggan yang sudah menyewa' },
  ];
  const statHTML = stats.map((x) => `<div class="ab-num"><div class="ab-num-v"><strong data-count="${x.n}" data-dec="${x.dec || 0}" data-suffix="${x.suffix}">0</strong>${x.star ? '<i class="fa-solid fa-star"></i>' : ''}</div><h4>${x.label}</h4><p>${x.note}</p></div>`).join('');
  $('#abStats').innerHTML = statHTML;
  $('#abDp').textContent = st.dpPercent; $('#abDp2').textContent = st.dpPercent;
  $('#abExample').textContent = `Sewa mulai tanggal 30, batas pembatalan dengan DP kembali adalah tanggal ${30 - st.cancelDays}.`;
  $('#terms').innerHTML = st.rentalTerms.map((t) => `<li>${esc(t)}</li>`).join('');
  $('#policy').innerHTML = st.cancelPolicy.map((t) => `<li>${esc(t)}</li>`).join('');
  const dr = $('#durRules'); if (dr) dr.innerHTML = (st.durations || []).map((d, i) => `<div class="dur-card"><h4>${i + 1}. ${esc(d.name)}</h4><p>${esc(d.note)}</p><div class="ex"><b>Contoh:</b> ${esc(d.example)}</div></div>`).join('');
  const tr = $('#tektokRules'); if (tr) tr.innerHTML = (st.tektokTerms || []).length ? `<b>Syarat &amp; ketentuan paket tektok:</b> ${st.tektokTerms.map(esc).join(' ')}` : '';
  $('#abWa').href = waLink('Halo Annapurna Adventure, saya ingin bertanya tentang sewa alat.');

  const fmt = (v, dec) => v.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = (el) => {
    const target = +el.dataset.count, dec = +el.dataset.dec, suf = el.dataset.suffix;
    if (reduce) { el.textContent = fmt(target, dec) + suf; return; }
    const t0 = performance.now(), dur = 1600;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(target * e, dec) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.6 }) : null;
  $$('[data-count]').forEach((el) => (io ? io.observe(el) : run(el)));

  $$('#abFaq details').forEach((d) => {
    const sm = d.querySelector('summary'), body = d.querySelector('.ab-faq-a');
    sm.addEventListener('click', (e) => {
      if (reduce) return;
      e.preventDefault();
      if (d.open) {
        body.style.height = body.scrollHeight + 'px';
        requestAnimationFrame(() => { body.style.height = '0px'; });
        body.addEventListener('transitionend', () => { d.open = false; body.style.height = ''; }, { once: true });
      } else {
        $$('#abFaq details[open]').forEach((o) => { if (o !== d) o.querySelector('summary').click(); });
        d.open = true; const h = body.scrollHeight; body.style.height = '0px';
        requestAnimationFrame(() => { body.style.height = h + 'px'; });
        body.addEventListener('transitionend', () => { body.style.height = ''; }, { once: true });
      }
    });
  });
})();

