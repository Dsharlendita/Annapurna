(function () {
  const { DB, Rules, D, rupiah } = Ann; const { $, $$, esc, asset, param, toast, Cart, stars, productCard, bindProductActions, dateGuard, waLink } = UI;
  const p = DB.product(param('id'));
  const root = $('#root');
  if (!p || (!DB.isActiveProduct(p) && !DB.isStaff(DB.session()))) {
    root.innerHTML = `<div class="empty-state"><div class="ic"><i class="fa-solid fa-tent"></i></div><h3>Produk tidak ditemukan</h3><p>Produk ini mungkin sudah tidak tersedia. Lihat alat lain di katalog.</p><a class="btn btn-primary" href="katalog">Buka katalog</a></div>`;
    return;
  }
  document.title = `${p.name} — Annapurna Adventure`;
  const cat = DB.categories().find((c) => c.id === p.cat) || { name: '' };
  const st = DB.settings();
  let mode = param('mode') === 'beli' && p.price ? 'buy' : p.rent ? 'rent' : 'buy';
  /* Galeri hanya berisi foto barang ini sendiri (bukan foto barang lain di kategori yang sama, supaya tidak menyesatkan) */
  const gallery = [p.img, ...(p.gallery || [])].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 4);

  const detailRows = [
    ['Merek', p.brand], ['Kode barang', p.sku], ['Kategori', cat.name], ['Warna', p.color], ['Bahan', p.material], ['Berat', p.weight], ['Ukuran / kapasitas', p.dimension],
    [DB.hasVariant(p) ? p.variant.label : 'Pilihan ukuran', DB.hasVariant(p) ? p.variant.options.map((o) => o.name).join(', ') : ''],
    ...Object.entries(p.attrs || {}).map(([k, v]) => [(DB.attributes(true).find((a) => a.id === k) || { name: '' }).name, v]).filter(([k]) => k),
    ['Status', DB.condRentable(p.cond) ? '' : `${p.cond} — sementara tidak bisa disewa`], ['Kelengkapan', p.includes], ['Minimal sewa', p.rent && p.minDays > 1 ? `${p.minDays} malam` : ''],
    ['Jaminan', p.deposit ? rupiah(p.deposit) + ' (dikembalikan saat barang kembali)' : ''],
  ].filter(([, v]) => v).map(([k, v]) => [k, esc(v)]);
  const alts = p.brand ? DB.products().filter((x) => x.id !== p.id && x.cat === p.cat && x.brand && x.brand !== p.brand && (p.rent ? x.rent : x.price)).slice(0, 4) : [];
  const stx = DB.settings();
  const infoRows = (p.rent ? [
    ['fa-id-card', 'Bawa identitas asli', 'KTP / KTM / SIM asli dititipkan sebagai jaminan selama masa sewa.'],
    ['fa-wallet', `DP ${stx.dpPercent}% saat booking`, `Sisanya dilunasi saat mengambil barang. Pembayaran: ${stx.banks.map((b) => b.bank).join(', ')} atau QRIS.`],
    ['fa-store', 'Ambil & kembalikan di toko', `${esc(stx.hours)}. Tidak ada layanan antar.`],
    ['fa-calendar-days', 'Durasi sewa', (stx.durations || []).map((d) => `${esc(d.name)}: ${esc(d.note.toLowerCase())}`).join(' · ') || 'Per malam, kegiatan 3 hari, atau ekspedisi 5 hari.'],
    ['fa-clock', 'Batas pengembalian', `Tanggal kembali${stx.lateAfterReturnTime ? `, paling lambat pukul ${esc(String(stx.returnTime).replace(':', '.'))} WIB (jam tutup toko)` : ''}. Terlambat dikenakan biaya ${esc(DB.lateFeeText())}.`],
    ['fa-soap', 'Sewa bersih, kembali kotor', 'Biar kami yang membersihkan. Kamu cukup memakainya dengan happy tanpa harus mencuci.'],
    ['fa-rotate-left', 'Pembatalan', `Batal paling lambat H-${stx.cancelDays}: DP dikembalikan ${stx.refundPercent ?? 100}%. Lewat dari itu DP hangus.`],
  ] : [
    ['fa-store', 'Ambil di toko', `${esc(stx.hours)}. Tunjukkan nota digital saat mengambil.`],
    ['fa-wallet', 'Bayar penuh saat checkout', `${stx.banks.map((b) => b.bank).join(', ')} atau QRIS.`],
  ]).concat(p.includes ? [['fa-box-open', 'Isi / kelengkapan', esc(p.includes)]] : [])
    .concat(DB.hasVariant(p) && p.dimension ? [['fa-ruler', 'Panduan ukuran', esc(p.dimension)]] : []);
  let selSize = null;
  root.innerHTML = `
    <div class="crumbs dark"><a href="./">Beranda</a><span>/</span><a href="katalog">Produk</a><span>/</span><a href="katalog?cat=${p.cat}">${esc(cat.name)}</a><span>/</span><span>${esc(p.name)}</span></div>
    <div class="detail" style="margin-top:14px">
      <div>
        <div class="gallery">
          <div class="main"><img id="mainImg" src="${asset(gallery[0])}" alt="${esc(p.name)}">${(() => { const ab = DB.autoBadge(p, mode === 'buy' ? 'buy' : 'rent'); const ic = { terlaris: 'fa-fire', hampir: 'fa-hourglass-half', rating: 'fa-star', penuh: 'fa-ban' }; return ab ? `<span class="pc-badge auto ${ab.key} pd-badge-l" title="${esc(ab.title)}"><i class="fa-solid ${ic[ab.key]}"></i> ${ab.label}</span>` : ''; })()}${p.badge ? `<span class="pc-badge adm ${String(p.badge).toLowerCase()} pd-badge-r">${esc(p.badge)}</span>` : ''}</div>
          <div class="thumbs" ${gallery.length > 1 ? '' : 'hidden'}>${gallery.map((g, i) => `<button class="${i === 0 ? 'active' : ''}" data-img="${asset(g)}" aria-label="Foto ${i + 1}"><img src="${asset(g)}" alt=""></button>`).join('')}</div>
        </div>
        <div class="calendar" id="calBox"></div>
      </div>
      <div>
        <span class="pill green plain">${esc(cat.name)}</span>
        <h1 style="margin-top:10px">${esc(p.name)}</h1>
        <div class="meta">${stars(p.rating, false)}<a href="#ulasan" class="link" style="font-size:inherit">${p.reviews ? `${Number(p.rating).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${p.reviews} ulasan` : 'Belum ada ulasan'}</a></div>
        <div class="price-box">
          ${p.rent ? Rules.tierRows(Rules.productTiers(p)).filter((x) => x.price).map((x) => `<div><small>${esc(x.name)}</small><span class="pb-val"><strong>${rupiah(x.price)}</strong>${x.days === 1 ? '<small>/ malam</small>' : ''}</span></div>`).join('') : ''}
          ${p.price ? `<div><small>Harga beli</small><strong>${rupiah(p.price)}</strong></div>` : ''}
        </div>
        <p style="color:var(--ink-2)">${esc(p.desc || '')}</p>
        <ul class="spec-list">${(p.specs || []).map((s) => `<li><i class="fa-solid fa-check"></i>${esc(s)}</li>`).join('')}</ul>
        ${DB.hasVariant(p) ? `<p class="size-note"><i class="fa-solid fa-ruler"></i> Tersedia ${esc(p.variant.label.toLowerCase())}: <b>${esc(p.variant.options.map((o) => o.name.replace(/\s*\(.*\)/, '')).join(', '))}</b>. Pilih ukuran di bawah.</p>` : ''}

        <div class="mode-switch" role="tablist">
          <button data-m="rent" class="${p.rent ? '' : 'na'}"><i class="fa-solid fa-campground"></i> Sewa${p.rent ? '' : '<em>Tidak tersedia</em>'}</button>
          <button data-m="buy" class="${p.price ? '' : 'na'}"><i class="fa-solid fa-bag-shopping"></i> Beli${p.price ? '' : '<em>Tidak tersedia</em>'}</button>
        </div>
        <div id="orderBox"></div>
      </div>
    </div>

    <div class="card info-rent" style="margin-top:36px"><div class="card-title"><i class="fa-solid fa-circle-info"></i> Info penting sebelum ${p.rent ? 'sewa' : 'beli'}</div><ul class="ir-list">${infoRows.map(([ic, t, d]) => `<li><span class="ir-ic"><i class="fa-solid ${ic}"></i></span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ul></div>
    ${alts.length ? `<div class="card alt-brands" style="margin-top:36px"><div class="card-title"><i class="fa-solid fa-code-compare"></i> Pilihan merek lain untuk ${esc(cat.name.toLowerCase())}</div><div class="alt-list">${alts.map((x) => `<a class="alt-it" href="produk?id=${x.id}"><img src="${asset(x.img)}" alt=""><span><small>${esc(x.brand)}</small><b>${esc(x.name)}</b><em>${x.rent ? `${rupiah(x.rent)}/malam` : rupiah(x.price)}${x.attrs && x.attrs['at-kapasitas'] ? ` · ${esc(x.attrs['at-kapasitas'])}` : ''}</em></span></a>`).join('')}</div></div>` : ''}
    ${detailRows.length ? `<div class="card prod-detail" style="margin-top:36px"><div class="card-title"><i class="fa-solid fa-list-check"></i> Detail produk</div><table class="spec-tbl">${detailRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table></div>` : ''}
    <div class="grid-2" style="gap:18px;margin-top:${detailRows.length ? 18 : 36}px">
      <div class="card" id="ketentuan"><div class="card-title"><i class="fa-solid fa-file-lines"></i> Ketentuan sewa</div><ul style="list-style:disc;padding-left:18px;color:var(--ink-2);font-size:14px">${st.rentalTerms.map((t) => `<li style="margin-bottom:6px">${esc(t)}</li>`).join('')}</ul></div>
      <div class="card" style="margin-top:0"><div class="card-title"><i class="fa-solid fa-rotate-left"></i> Kebijakan pembatalan</div><ul style="list-style:disc;padding-left:18px;color:var(--ink-2);font-size:14px">${st.cancelPolicy.map((t) => `<li style="margin-bottom:6px">${esc(t)}</li>`).join('')}</ul></div>
    </div>

    <section class="card rv-sec" id="ulasan" style="margin-top:18px"></section>

    <div class="sec-head" style="margin-top:48px"><h2 class="sec-title">Alat lain yang sering disewa bersama</h2><a class="link" href="katalog">Lihat semua <i class="fa-solid fa-arrow-right"></i></a></div>
    <div class="prod-grid cols-4" id="related"></div>`;

  $$('.thumbs button').forEach((b) => b.addEventListener('click', () => { $('#mainImg').src = b.dataset.img; $$('.thumbs button').forEach((x) => x.classList.toggle('active', x === b)); }));

  const box = $('#orderBox');
  function drawOrder() {
    $$('.mode-switch button').forEach((b) => b.classList.toggle('active', b.dataset.m === mode));
    /* Mode yang tidak tersedia untuk barang ini: tampilkan pemberitahuan + barang serupa yang tersedia */
    if ((mode === 'rent' && !p.rent) || (mode === 'buy' && !p.price)) {
      const rentNA = mode === 'rent';
      /* Urutkan saran: nama paling mirip dulu (mis. "Gas Kompor" → "Gas Kaleng"), lalu barang sekategori */
      const words = (t) => String(t).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
      const mine = new Set(words(p.name));
      const head = words(p.name)[0];
      const score = (x) => (head && words(x.name)[0] === head ? 20 : 0) + words(x.name).filter((w) => mine.has(w)).length * 10 + (x.cat === p.cat ? 1 : 0);
      const sim = DB.products().filter((x) => x.active !== false && x.id !== p.id && (rentNA ? x.rent > 0 : x.price > 0) && score(x) > 0)
        .sort((x, y) => score(y) - score(x)).slice(0, 3);
      const top = sim[0] && score(sim[0]) >= 10 ? sim[0] : null;
      const sbx = $('#stickyBuy'); if (sbx) sbx.remove();
      box.innerHTML = `<div class="na-box">
        <div class="notice red"><i class="fa-solid fa-circle-info"></i><div><strong>Maaf, barang ini tidak tersedia untuk ${rentNA ? 'disewakan' : 'dibeli'}.</strong><br>${esc(p.name)} ${rentNA ? 'hanya dijual' : 'hanya disewakan'}. ${top ? `Kamu bisa ${rentNA ? 'menyewa' : 'membeli'} barang yang mirip di bawah ini.` : sim.length ? `Berikut ${esc(cat.name.toLowerCase())} lain yang bisa ${rentNA ? 'disewa' : 'dibeli'}:` : ''}</div></div>
        ${top ? `<a class="na-top" href="produk?id=${encodeURIComponent(top.id)}${rentNA ? '' : '&mode=beli'}"><img src="${asset(top.img)}" alt=""><span><small>Yang paling mirip untuk ${rentNA ? 'disewa' : 'dibeli'}</small><b>${esc(top.name)}</b><em>${rentNA ? `${rupiah(top.rent)} / malam` : rupiah(top.price)}</em></span><span class="btn btn-primary btn-sm">${rentNA ? 'Sewa' : 'Beli'} ${esc(top.name)} <i class="fa-solid fa-arrow-right"></i></span></a>` : ''}
        ${sim.length > (top ? 1 : 0) ? `<div class="na-list">${sim.filter((x) => x !== top).map((x) => `<a class="na-item" href="produk?id=${encodeURIComponent(x.id)}${rentNA ? '' : '&mode=beli'}"><img src="${asset(x.img)}" alt=""><span><b>${esc(x.name)}</b><small>${rentNA ? `${rupiah(x.rent)} / malam` : rupiah(x.price)}</small></span><i class="fa-solid fa-chevron-right"></i></a>`).join('')}</div>` : ''}
        <div class="na-acts"><a class="btn btn-light btn-sm" href="${rentNA ? 'katalog' : 'belanja'}?cat=${encodeURIComponent(p.cat)}">Lihat semua ${esc(cat.name.toLowerCase())} ${rentNA ? 'untuk disewa' : 'untuk dibeli'}</a><button class="btn btn-primary btn-sm" type="button" id="naBack">${rentNA ? 'Beli barang ini' : 'Sewa barang ini'}</button></div>
      </div>`;
      $('#naBack').addEventListener('click', () => { mode = rentNA ? 'buy' : 'rent'; drawOrder(); });
      return;
    }
    if (mode === 'rent') {
      box.innerHTML = `
        <div class="grid-2">
          <div class="field"><label for="dStart">Tanggal ambil</label><input type="date" class="input" id="dStart" value="${sel.start}"></div>
          <div class="field"><label for="dEnd">Tanggal kembali</label><input type="date" class="input" id="dEnd" value="${sel.end}"></div>
        </div>
        <div id="dDur"></div>
        <div id="dSize"></div>
        <div class="field"><label>Jumlah</label><div class="qty"><button type="button" data-q="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input id="dQty" type="number" min="1" value="1" aria-label="Jumlah"><button type="button" data-q="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div></div>
        <div class="avail-msg" id="dAvail"></div>
        <div class="card" style="padding:16px;margin-top:14px">
          <div class="kv"><span>Harga sewa</span><span id="dLine"></span></div>
          <div class="kv total"><span>Total sewa</span><span id="dTotal"></span></div>
          <div class="kv hl"><span>DP ${st.dpPercent}% dibayar saat booking</span><span id="dDp"></span></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-outline" id="dCart" style="flex:1"><i class="fa-solid fa-cart-plus"></i> Tambah ke keranjang</button>
          <button class="btn btn-primary" id="dNow" style="flex:1">Sewa sekarang <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <a class="btn btn-ghost btn-sm" style="margin-top:8px" href="${waLink('Halo Annapurna, saya mau tanya ketersediaan ' + p.name)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Tanya lewat WhatsApp</a>`;
      const s = $('#dStart'), e = $('#dEnd'), q = $('#dQty');
      dateGuard(s, e);
      $('#dDur').appendChild(UI.durationChips(s, e));
      const calc = () => {
        sel.start = s.value; sel.end = e.value;
        const days = Rules.rentalDays(s.value, e.value);
        const sized = DB.hasVariant(p);
        if (sized) { const list = Rules.sizeAvailability(p.id, s.value, e.value); selSize = UI.firstAvailSize(list, selSize); $('#dSize').innerHTML = UI.sizePicker(p, list, selSize); }
        const avail = sized ? (selSize ? Rules.available(p.id, s.value, e.value, null, selSize) : 0) : Rules.available(p.id, s.value, e.value);
        const qty = Math.max(1, parseInt(q.value, 10) || 1); q.value = qty;
        const minD = p.minDays || 1; const maxD = st.maxRentDays || 60;
        const ok = qty <= avail && days >= minD && days <= maxD;
        const szTxt = selSize ? ` ukuran ${esc(selSize.replace(/\s*\(.*\)/, ''))}` : '';
        $('#dAvail').className = 'avail-msg ' + (ok ? 'ok' : 'no');
        $('#dAvail').innerHTML = !DB.condRentable(p.cond) ? `<i class="fa-solid fa-circle-xmark"></i> Barang sedang <b>${esc(p.cond.toLowerCase())}</b> dan belum bisa disewa. Coba lagi nanti atau tanya admin via WhatsApp.` : days > maxD ? `<i class="fa-solid fa-circle-xmark"></i> Maksimal lama sewa ${maxD} malam.` : days < minD ? `<i class="fa-solid fa-circle-xmark"></i> Minimal sewa ${minD} malam.` : ok ? `<i class="fa-solid fa-circle-check"></i> ${avail} unit${szTxt} tersedia untuk ${D.fmtRange(s.value, e.value)}` : sized && !selSize ? '<i class="fa-solid fa-circle-xmark"></i> Semua ukuran habis di tanggal ini. Pilih tanggal lain di kalender.' : `<i class="fa-solid fa-circle-xmark"></i> ${Rules.availMsg(p, qty, s.value, e.value, selSize, avail)}`;
        const tiers = Rules.productTiers(p); const unitTotal = Rules.tierPlan(tiers, days).total;
        $('#dLine').textContent = `${Rules.tierLabel(tiers, days)} · ${rupiah(unitTotal)} × ${qty}`;
        $('#dTotal').textContent = rupiah(unitTotal * qty);
        $('#dDp').textContent = rupiah(Math.round(unitTotal * qty * st.dpPercent / 100));
        $('#dCart').disabled = $('#dNow').disabled = !ok;
        const sb = $('#stickyBuy'); if (sb) { sb.querySelector('b').textContent = rupiah(unitTotal * qty); sb.querySelector('small').textContent = `${qty} unit · ${days} malam${selSize ? ' · ' + selSize.replace(/\s*\(.*\)/, '') : ''}`; sb.querySelector('button').disabled = !ok; }
        drawCal();
        return ok;
      };
      $$('[data-q]', box).forEach((b) => b.addEventListener('click', () => { q.value = Math.max(1, (+q.value || 1) + +b.dataset.q); calc(); }));
      [s, e, q].forEach((x) => x.addEventListener('change', calc));
      q.addEventListener('input', calc);
      $('#dSize').addEventListener('click', (ev) => { const b = ev.target.closest('[data-size]'); if (b && !b.disabled) { selSize = b.dataset.size; calc(); } });
      const add = () => calc() && (DB.setTrip(s.value, e.value), Cart.add(Object.assign({ type: 'rent', kind: 'product', refId: p.id, qty: +q.value, start: s.value, end: e.value }, selSize ? { size: selSize } : {})), true);
      $('#dCart').addEventListener('click', () => add() && toast(`${esc(DB.variantName(p, selSize))} masuk ke keranjang sewa.`));
      $('#dNow').addEventListener('click', () => add() && (location.href = 'keranjang'));
      if (!$('#stickyBuy')) { document.body.insertAdjacentHTML('beforeend', '<div class="sticky-buy" id="stickyBuy"><div><b></b><small></small></div><button class="btn btn-primary" type="button">Sewa sekarang <i class="fa-solid fa-arrow-right"></i></button></div>'); document.body.classList.add('has-sticky'); }
      $('#stickyBuy button').addEventListener('click', () => { if (!$('#dNow').disabled) $('#dNow').click(); else box.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      window.__setStart = (d) => { s.value = d; s.dispatchEvent(new Event('change')); calc(); };
      calc();
    } else {
      const sizedB = DB.hasVariant(p);
      const bList = sizedB ? p.variant.options.map((o) => ({ name: o.name, avail: o.stock })) : [];
      if (sizedB) selSize = UI.firstAvailSize(bList, selSize);
      const stockNow = () => DB.sizeStock(p, selSize);
      box.innerHTML = `
        <div id="bSize">${UI.sizePicker(p, bList, selSize)}</div>
        <div class="field"><label>Jumlah</label><div class="qty"><button type="button" data-q="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input id="bQty" type="number" min="1" value="1" aria-label="Jumlah"><button type="button" data-q="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div><span class="hint" id="bStock">Stok tersedia: ${stockNow()} unit</span></div>
        <div class="card" style="padding:16px"><div class="kv total" style="border:0;margin:0;padding:0"><span>Subtotal</span><span id="bTotal">${rupiah(p.price)}</span></div></div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-outline" id="bCart" style="flex:1" ${p.stock ? '' : 'disabled'}><i class="fa-solid fa-cart-plus"></i> Tambah ke keranjang</button>
          <button class="btn btn-primary" id="bNow" style="flex:1" ${p.stock ? '' : 'disabled'}>Beli sekarang <i class="fa-solid fa-arrow-right"></i></button>
        </div>`;
      const q = $('#bQty');
      const calc = () => { const st0 = stockNow(); const v = Math.min(Math.max(1, st0), Math.max(1, +q.value || 1)); q.value = v; $('#bTotal').textContent = rupiah(v * p.price); $('#bStock').textContent = `Stok tersedia: ${st0} unit${selSize ? ` (ukuran ${selSize.replace(/\s*\(.*\)/, '')})` : ''}`; $('#bCart').disabled = $('#bNow').disabled = !st0; };
      $('#bSize').addEventListener('click', (ev) => { const b = ev.target.closest('[data-size]'); if (b && !b.disabled) { selSize = b.dataset.size; $('#bSize').innerHTML = UI.sizePicker(p, bList, selSize); calc(); } });
      $$('[data-q]', box).forEach((b) => b.addEventListener('click', () => { q.value = (+q.value || 1) + +b.dataset.q; calc(); }));
      q.addEventListener('change', calc);
      $('#bCart').addEventListener('click', () => UI.quickBuy(p.id, +q.value, false, selSize || undefined));
      $('#bNow').addEventListener('click', () => UI.quickBuy(p.id, +q.value, true, selSize || undefined));
      calc();
      drawCal();
    }
  }
  $$('.mode-switch button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.m;
    if (b.classList.contains('na')) UI.toast(`Maaf, barang ini tidak tersedia untuk ${mode === 'rent' ? 'disewakan' : 'dibeli'}.`, 'err');
    drawOrder();
  }));

  const sel = Object.assign({}, UI.tripDefault());
  let viewMonth = new Date(); viewMonth.setDate(1);
  function drawCal() {
    const cb = $('#calBox');
    if (!p.rent) { cb.classList.add('hidden'); return; }
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const first = new Date(y, m, 1).getDay();
    const n = new Date(y, m + 1, 0).getDate();
    const now = new Date(); const isCur = y === now.getFullYear() && m === now.getMonth();
    let cells = '';
    for (let i = 0; i < first; i++) cells += `<span class="cal-day blank"></span>`;
    for (let d = 1; d <= n; d++) {
      const iso = D.toISO(new Date(y, m, d));
      const past = iso < D.today();
      const a = Rules.availableOn(p.id, iso, null, DB.hasVariant(p) ? selSize : null);
      const cls = past ? 'past' : a <= 0 ? 'full' : a <= Math.max(1, Math.floor(p.stock * .3)) ? 'low' : 'ok';
      const inSel = mode === 'rent' && iso >= sel.start && iso <= sel.end;
      cells += `<button class="cal-day ${cls} ${inSel ? 'sel' : ''}" data-d="${iso}" ${past ? 'disabled' : ''} aria-label="${D.fmtDate(iso)}: ${past ? 'lewat' : a + ' unit tersedia'}">${d}<small>${past ? '' : a <= 0 ? 'Penuh' : a + ' unit'}</small></button>`;
    }
    cb.innerHTML = `<div class="cal-head"><h3>Kalender ketersediaan</h3>
        <div style="display:flex;gap:4px;align-items:center"><button class="icon-btn" id="calPrev" ${isCur ? 'disabled style="opacity:.3"' : ''} aria-label="Bulan sebelumnya"><i class="fa-solid fa-chevron-left"></i></button><strong style="min-width:130px;text-align:center">${D.BULAN_PANJANG[m]} ${y}</strong><button class="icon-btn" id="calNext" aria-label="Bulan berikutnya"><i class="fa-solid fa-chevron-right"></i></button></div></div>
      <div class="cal-grid">${D.HARI.map((h) => `<span class="dow">${h}</span>`).join('')}${cells}</div>
      <div class="cal-legend" style="margin-top:12px"><span><i style="background:var(--g100);border:1px solid var(--g200)"></i>Tersedia</span><span><i style="background:#fdf4dc;border:1px solid #f1dca0"></i>Hampir habis</span><span><i style="background:#fae6e2;border:1px solid #f0c6be"></i>Penuh</span><span>Klik tanggal untuk memilih tanggal ambil</span></div>`;
    $('#calPrev').addEventListener('click', () => { viewMonth.setMonth(viewMonth.getMonth() - 1); drawCal(); });
    $('#calNext').addEventListener('click', () => { viewMonth.setMonth(viewMonth.getMonth() + 1); drawCal(); });
    $$('.cal-day[data-d]', cb).forEach((b) => b.addEventListener('click', () => {
      if (mode !== 'rent') { mode = 'rent'; drawOrder(); }
      window.__setStart && window.__setStart(b.dataset.d);
      toast(`Tanggal ambil diatur ke ${D.fmtDate(b.dataset.d)}.`);
    }));
  }
  drawOrder();

  const rel = DB.products().filter((x) => x.id !== p.id && x.rent && (x.cat !== p.cat)).sort((a, b) => b.reviews - a.reviews).slice(0, 4);
  (function reviews() {
    const R = DB.productReviews(p.id); let showAll = false;
    const dist = [5, 4, 3, 2, 1].map((n) => R.filter((r) => r.rating === n).length);
    const draw = () => {
      const list = showAll ? R : R.slice(0, 4);
      $('#ulasan').innerHTML = `<div class="card-title"><i class="fa-regular fa-star"></i> Ulasan pelanggan</div>
        <div class="rv-wrap">
          <div class="rv-score"><strong>${p.reviews ? p.rating.toLocaleString('id-ID') : '–'}</strong>${stars(p.rating, false)}<small>${p.reviews} ulasan</small>
            ${R.length ? `<ul class="rv-dist">${dist.map((c, i) => `<li><span>${5 - i}</span><i class="fa-solid fa-star"></i><div class="bar"><i style="width:${R.length ? (c / R.length) * 100 : 0}%"></i></div><span>${c}</span></li>`).join('')}</ul>` : ''}
            <p class="muted" style="font-size:12.5px;margin-top:10px">Ulasan hanya bisa ditulis oleh pelanggan yang sudah menyelesaikan rental / pembelian.</p></div>
          <div class="rv-list">${list.length ? list.map((r) => `<article class="rv-item">
              <div class="rv-h"><span class="rv-av">${r.img ? `<img src="${asset(r.img)}" alt="">` : esc(r.name.charAt(0))}</span><div><strong>${esc(r.name)}</strong><small>${r.type === 'rent' ? 'Menyewa' : 'Membeli'} · ${D.fmtDate(r.createdAt, true)}</small></div>${stars(r.rating, false)}</div>
              <p>${esc(r.text)}</p>
              ${r.reply ? `<div class="rv-reply"><strong><i class="fa-solid fa-store"></i> Balasan Annapurna Adventure${r.replyAt ? ` · ${D.fmtDate(r.replyAt, true)}` : ''}</strong> ${esc(r.reply)}</div>` : ''}
            </article>`).join('') : '<p class="muted">Belum ada ulasan tertulis untuk barang ini. Jadilah yang pertama setelah menyewa!</p>'}
            ${R.length > 4 ? `<button class="btn btn-light btn-sm" id="rvMore">${showAll ? 'Tampilkan lebih sedikit' : `Lihat semua ${R.length} ulasan`}</button>` : ''}</div>
        </div>`;
      const b = $('#rvMore'); if (b) b.addEventListener('click', () => { showAll = !showAll; draw(); });
    };
    draw();
  })();

  $('#related').innerHTML = rel.map((x) => productCard(x, 'rent')).join('');
  bindProductActions($('#related'));
  /* HP / tablet: kalender ketersediaan dipindah ke bawah form sewa, supaya customer melihat nama, harga & pilihan sewa dulu */
  (function placeCalendar() {
    const cal = document.getElementById('calBox'); if (!cal) return;
    const home = cal.parentElement, info = home && home.nextElementSibling; if (!info) return;
    const mq = matchMedia('(max-width: 1024px)');
    const place = () => { const target = mq.matches ? info : home; if (cal.parentElement !== target) target.appendChild(cal); cal.classList.toggle('cal-below', mq.matches); };
    place(); if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
  })();
})();

