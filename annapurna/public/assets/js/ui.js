(function () {
  const { DB, Rules, STATUS, D, rupiah } = window.Ann;
  const BASE = document.body.dataset.base || '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const asset = (p) => (!p ? '' : /^(data:|https?:|blob:)/.test(p) ? p : BASE + p);
  const url = (p) => BASE + p;
  const param = (k) => new URLSearchParams(location.search).get(k);

  function toast(msg, type) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'err' ? ' err' : '');
    t.innerHTML = `<i class="fa-solid ${type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><div>${msg}</div>`;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = '.3s'; t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; setTimeout(() => t.remove(), 300); }, 3200);
  }

  function modal({ title, body, foot, size, onOpen, locked }) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="modal-box ${size || ''}">
      <div class="modal-head"><h3>${title}</h3>${locked ? '' : '<button class="icon-btn" data-close aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>'}</div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(m);
    const prevFocus = document.activeElement;
    const close = () => { m.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => m.remove(), 200); document.body.style.overflow = ''; prevFocus && prevFocus.focus && prevFocus.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    m.addEventListener('click', (e) => { if (!locked && (e.target === m || e.target.closest('[data-close]'))) close(); });
    if (!locked) document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { m.classList.add('open'); const f = m.querySelector('input,select,textarea'); if (f) f.focus(); });
    const api = { el: m, close, $: (s) => m.querySelector(s), $$: (s) => Array.from(m.querySelectorAll(s)) };
    onOpen && onOpen(api);
    return api;
  }
  function confirmBox({ title, text, ok = 'Ya, lanjutkan', cancel = 'Batal', danger, input }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title,
        body: `<p style="color:var(--ink-2)">${text}</p>${input ? `<div class="field" style="margin:14px 0 0"><label>${input.label}</label><textarea class="textarea" id="cfInput" placeholder="${esc(input.placeholder || '')}"></textarea><span class="error hidden" id="cfErr">${input.error || 'Wajib diisi.'}</span></div>` : ''}`,
        foot: `<button class="btn btn-light" data-close>${cancel}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cfOk">${ok}</button>`,
      });
      m.$('#cfOk').addEventListener('click', () => {
        let val = true;
        if (input) {
          val = m.$('#cfInput').value.trim();
          if (input.required && !val) { m.$('#cfErr').classList.remove('hidden'); m.$('#cfInput').classList.add('err'); return; }
          val = val || '-';
        }
        done = true; m.close(); resolve(val);
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe(document.body, { childList: true });
    });
  }

  const pill = (group, key) => { const s = (STATUS[group] || {})[key] || { label: key, tone: 'gray' }; return `<span class="pill ${s.tone}">${s.label}</span>`; };
  const stars = (r, count) => {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<i class="fa-${r >= i ? 'solid fa-star' : r >= i - .5 ? 'solid fa-star-half-stroke' : 'regular fa-star'}"></i>`;
    return `<span class="stars" aria-label="Rating ${r} dari 5">${h}${count !== false ? `<span>(${r})</span>` : ''}</span>`;
  };

  const Cart = {
    all: () => DB.cart(),
    count: () => DB.cart().reduce((s, i) => s + 1, 0),
    add(item) {
      const cart = DB.cart();
      const same = cart.find((c) => c.type === item.type && c.kind === item.kind && c.refId === item.refId && (c.size || '') === (item.size || '') && (item.type === 'buy' || (c.start === item.start && c.end === item.end)));
      if (same) same.qty += item.qty; else cart.push(Object.assign({ key: 'c' + Date.now() + Math.random().toString(16).slice(2, 5) }, item));
      DB.setCart(cart);
    },
    update(key, patch) { const cart = DB.cart(); const it = cart.find((c) => c.key === key); if (it) Object.assign(it, patch); DB.setCart(cart); },
    remove(key) { DB.setCart(DB.cart().filter((c) => c.key !== key)); },
    clear(type) { DB.setCart(type ? DB.cart().filter((c) => c.type !== type) : []); },
    resolve(it) {
      if (it.kind === 'package') {
        const pk = DB.pkg(it.refId); if (!pk) return null;
        return { name: pk.name, img: pk.img, unit: pk.price, components: pk.items, sub: pk.items.map((i) => `${i.qty}× ${(DB.product(i.productId) || {}).name}`).join(', ') };
      }
      const p = DB.product(it.refId); if (!p) return null;
      const sz = it.size && DB.hasVariant(p) ? it.size : null;
      return { name: DB.variantName(p, sz), img: p.img, unit: it.type === 'buy' ? p.price : p.rent, components: [sz ? { productId: p.id, qty: 1, size: sz } : { productId: p.id, qty: 1 }], product: p, size: sz };
    },
    lineTotal(it) {
      const r = Cart.resolve(it); if (!r) return 0;
      return it.type === 'buy' ? r.unit * it.qty : r.unit * it.qty * Rules.rentalDays(it.start, it.end);
    },
    availability(it) {
      if (it.type === 'buy') { const p = DB.product(it.refId); return p ? DB.sizeStock(p, it.size) : 0; }
      return it.kind === 'package' ? Rules.packageAvailable(it.refId, it.start, it.end) : Rules.available(it.refId, it.start, it.end, null, it.size || null);
    },
  };

  function dateGuard(startEl, endEl) {
    startEl.min = D.today();
    const sync = () => { const minEnd = D.addDays(startEl.value || D.today(), 1); endEl.min = minEnd; if (!endEl.value || endEl.value < minEnd) endEl.value = minEnd; };
    startEl.addEventListener('change', sync); sync();
  }
  /* Pilihan ukuran berbentuk chip. list: [{ name, avail }] */
  function sizePicker(p, list, selected) {
    if (!DB.hasVariant(p)) return '';
    return `<div class="field size-field"><label>${esc(p.variant.label)} <span class="req">*</span></label><div class="size-pick" data-size-pick>${list.map((o) => {
      const short = o.name.replace(/\s*\(.*\)/, ''); const note = (o.name.match(/\((.*)\)/) || [])[1];
      return `<button type="button" data-size="${esc(o.name)}" class="${o.name === selected ? 'on' : ''}" ${o.avail > 0 ? '' : 'disabled'} title="${esc(o.name)}"><b>${esc(short)}</b><small>${o.avail > 0 ? `${o.avail} tersedia` : 'Habis'}</small>${note ? `<em>${esc(note)}</em>` : ''}</button>`; }).join('')}</div></div>`;
  }
  const firstAvailSize = (list, cur) => { const c = list.find((o) => o.name === cur && o.avail > 0); return c ? c.name : (list.find((o) => o.avail > 0) || {}).name || null; };

  function quickRent(kind, id) {
    const isPkg = kind === 'package';
    const item = isPkg ? DB.pkg(id) : DB.product(id);
    if (!item) return;
    const price = isPkg ? item.price : item.rent;
    const m = modal({
      title: isPkg ? 'Sewa paket' : 'Sewa alat',
      body: `<div class="mini-line" style="border:0;padding-top:0"><img src="${asset(item.img)}" alt=""><div class="nm"><strong>${esc(item.name)}</strong><small>${rupiah(price)} / hari</small></div></div>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label for="qrStart">Tanggal ambil</label><input type="date" id="qrStart" class="input" value="${D.rel(1)}"></div>
          <div class="field"><label for="qrEnd">Tanggal kembali</label><input type="date" id="qrEnd" class="input" value="${D.rel(3)}"></div>
        </div>
        <div id="qrSize"></div>
        <div class="field"><label>Jumlah</label><div class="qty"><button type="button" data-q="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input id="qrQty" type="number" value="1" min="1" aria-label="Jumlah"><button type="button" data-q="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div></div>
        <div id="qrAvail" class="avail-msg"></div>
        <div class="kv total"><span>Estimasi total</span><span id="qrTotal">-</span></div>
        <div class="kv hl"><span>DP 50% yang dibayar sekarang</span><span id="qrDp">-</span></div>`,
      foot: `<a class="btn btn-ghost" href="${url(isPkg ? 'paket' : 'produk?id=' + id)}">${isPkg ? 'Lihat isi paket' : 'Lihat detail'}</a><button class="btn btn-outline" id="qrCart"><i class="fa-solid fa-cart-plus"></i> Tambah ke keranjang</button><button class="btn btn-primary" id="qrNow">Sewa sekarang</button>`,
    });
    const s = m.$('#qrStart'), e = m.$('#qrEnd'), q = m.$('#qrQty');
    dateGuard(s, e);
    const sized = !isPkg && DB.hasVariant(item); let size = null;
    const calc = () => {
      const days = Rules.rentalDays(s.value, e.value);
      if (sized) { const list = Rules.sizeAvailability(id, s.value, e.value); size = firstAvailSize(list, size); m.$('#qrSize').innerHTML = sizePicker(item, list, size); }
      const avail = isPkg ? Rules.packageAvailable(id, s.value, e.value) : sized ? (size ? Rules.available(id, s.value, e.value, null, size) : 0) : Rules.available(id, s.value, e.value);
      const qty = Math.max(1, parseInt(q.value, 10) || 1); q.value = qty;
      const minD = (!isPkg && item.minDays) || 1; const maxD = DB.settings().maxRentDays || 60;
      const ok = qty <= avail && days >= minD && days <= maxD;
      m.$('#qrAvail').className = 'avail-msg ' + (ok ? 'ok' : 'no');
      m.$('#qrAvail').innerHTML = !isPkg && !DB.condRentable(item.cond) ? `<i class="fa-solid fa-circle-xmark"></i> Barang sedang ${esc(String(item.cond).toLowerCase())} dan belum bisa disewa.` : days > maxD ? `<i class="fa-solid fa-circle-xmark"></i> Maksimal lama sewa ${maxD} hari.` : days < minD ? `<i class="fa-solid fa-circle-xmark"></i> Minimal sewa ${minD} hari.` : ok ? `<i class="fa-solid fa-circle-check"></i> Tersedia ${avail} unit${size ? ` ukuran ${esc(size.replace(/\s*\(.*\)/, ''))}` : ''} untuk ${days} hari sewa` : sized && !size ? '<i class="fa-solid fa-circle-xmark"></i> Semua ukuran habis di tanggal ini. Coba tanggal lain.' : `<i class="fa-solid fa-circle-xmark"></i> Hanya tersedia ${avail} unit di tanggal ini. Kurangi jumlah atau ganti tanggal.`;
      m.$('#qrTotal').textContent = rupiah(price * qty * days);
      m.$('#qrDp').textContent = rupiah(price * qty * days * DB.settings().dpPercent / 100);
      m.$('#qrCart').disabled = m.$('#qrNow').disabled = !ok;
      return ok;
    };
    m.$$('[data-q]').forEach((b) => b.addEventListener('click', () => { q.value = Math.max(1, (parseInt(q.value, 10) || 1) + Number(b.dataset.q)); calc(); }));
    [s, e, q].forEach((el) => el.addEventListener('change', calc));
    q.addEventListener('input', calc);
    m.$('#qrSize').addEventListener('click', (ev) => { const b = ev.target.closest('[data-size]'); if (b && !b.disabled) { size = b.dataset.size; calc(); } });
    calc();
    const add = () => { if (!calc()) return false; Cart.add(Object.assign({ type: 'rent', kind: isPkg ? 'package' : 'product', refId: id, qty: +q.value, start: s.value, end: e.value }, size ? { size } : {})); return true; };
    m.$('#qrCart').addEventListener('click', () => { if (add()) { m.close(); toast(`${esc(item.name)} masuk ke keranjang sewa.`); } });
    m.$('#qrNow').addEventListener('click', () => { if (add()) location.href = url('keranjang'); });
  }
  function quickBuy(id, qty = 1, go, size) {
    const p = DB.product(id); if (!p || !p.price) return;
    if (DB.hasVariant(p) && !size) { buySizeModal(p, qty, go); return; }
    const stock = DB.sizeStock(p, size);
    const inCart = DB.cart().filter((c) => c.type === 'buy' && c.refId === id && (c.size || '') === (size || '')).reduce((s, c) => s + c.qty, 0);
    if (inCart + qty > stock) { toast(`Stok ${esc(DB.variantName(p, size))} tersisa ${stock} unit.`, 'err'); return; }
    Cart.add(Object.assign({ type: 'buy', kind: 'product', refId: id, qty }, size ? { size } : {}));
    if (go) location.href = url('keranjang'); else toast(`${esc(DB.variantName(p, size))} masuk ke keranjang belanja.`);
  }
  function buySizeModal(p, qty, go) {
    const list = p.variant.options.map((o) => ({ name: o.name, avail: o.stock }));
    let size = firstAvailSize(list, null);
    const m = modal({ title: 'Pilih ukuran', body: `<div class="mini-line" style="border:0;padding-top:0"><img src="${asset(p.img)}" alt=""><div class="nm"><strong>${esc(p.name)}</strong><small>${rupiah(p.price)}</small></div></div><div id="bsSize" style="margin-top:12px"></div>`,
      foot: `<a class="btn btn-ghost" href="${url('produk?id=' + p.id + '&mode=beli')}">Lihat detail</a><button class="btn btn-primary" id="bsOk"><i class="fa-solid fa-cart-plus"></i> ${go ? 'Beli sekarang' : 'Tambah ke keranjang'}</button>` });
    const draw = () => { m.$('#bsSize').innerHTML = sizePicker(p, list, size); m.$('#bsOk').disabled = !size; };
    m.$('#bsSize').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (b && !b.disabled) { size = b.dataset.size; draw(); } });
    draw();
    m.$('#bsOk').addEventListener('click', () => { if (!size) return; m.close(); quickBuy(p.id, qty, go, size); });
  }

  function productCard(p, mode) {
    mode = mode || (p.rent ? 'rent' : 'buy');
    const badgeL = p.badge === 'Populer' ? `<span class="badge-tag l">Populer</span>` : '';
    const badgeR = p.badge === 'Best Seller' ? `<span class="badge-tag r">Best Seller</span>` : '';
    const price = mode === 'buy' ? `${rupiah(p.price)}` : `${rupiah(p.rent)} <small>/ hari</small>`;
    const alt = mode === 'buy' ? (p.rent ? `Sewa ${rupiah(p.rent)}/hari` : 'Hanya dijual') : (p.price ? `Beli ${rupiah(p.price)}` : 'Hanya disewakan');
    const btn = mode === 'buy'
      ? `<button class="btn btn-primary" data-buy="${p.id}">Beli Sekarang <i class="fa-solid fa-arrow-right"></i></button>`
      : `<button class="btn btn-primary" data-rent="${p.id}">Sewa Sekarang <i class="fa-solid fa-arrow-right"></i></button>`;
    return `<article class="prod-card">
      <a class="ph" href="${url('produk?id=' + p.id + (mode === 'buy' ? '&mode=beli' : ''))}" aria-label="Lihat ${esc(p.name)}"><img src="${asset(p.img)}" alt="${esc(p.name)}" loading="lazy">${badgeL}${badgeR}</a>
      <div class="bd">
        <h3><a href="${url('produk?id=' + p.id + (mode === 'buy' ? '&mode=beli' : ''))}">${esc(p.name)}</a></h3>
        <div class="price">${price}</div>
        <div class="sub-price">${alt}</div>
        ${DB.hasVariant(p) ? `<div class="size-hint"><i class="fa-solid fa-ruler"></i> ${esc(p.variant.options.map((o) => o.name.replace(/\s*\(.*\)/, '')).join(' · '))}</div>` : ''}
        ${p.reviews ? `${stars(p.rating, false)}<span class="rv-count">${p.rating.toLocaleString('id-ID')} · ${p.reviews} ulasan</span>` : '<span class="rv-count">Belum ada ulasan</span>'}
        <div class="acts">${btn}</div>
      </div>
    </article>`;
  }
  function bindProductActions(root) {
    root.addEventListener('click', (e) => {
      const r = e.target.closest('[data-rent]'); if (r) { e.preventDefault(); quickRent('product', r.dataset.rent); return; }
      const b = e.target.closest('[data-buy]'); if (b) { e.preventDefault(); quickBuy(b.dataset.buy); return; }
      const pk = e.target.closest('[data-rent-pkg]'); if (pk) { e.preventDefault(); quickRent('package', pk.dataset.rentPkg); }
    });
  }

  function validate(form, rules) {
    let ok = true, first = null;
    form.querySelectorAll('.error.js').forEach((x) => x.remove());
    form.querySelectorAll('.err').forEach((x) => x.classList.remove('err'));
    Object.entries(rules).forEach(([name, fn]) => {
      const el = form.elements[name]; if (!el) return;
      const msg = fn(el.value.trim(), el);
      if (msg) {
        ok = false; el.classList.add('err');
        const s = document.createElement('span'); s.className = 'error js'; s.textContent = msg;
        (el.closest('.field') || el.parentElement).appendChild(s);
        first = first || el;
      }
    });
    first && first.focus();
    return ok;
  }
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone = (v) => /^(\+62|62|0)8[0-9]{7,12}$/.test(v.replace(/[\s-]/g, ''));

  function fileToDataURL(file, maxW = 900) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas'); c.width = img.width * sc; c.height = img.height * sc;
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', .82));
        };
        img.onerror = rej; img.src = r.result;
      };
      r.onerror = rej; r.readAsDataURL(file);
    });
  }

  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  const REV_LABEL = ['', 'Sangat kecewa', 'Kurang puas', 'Cukup', 'Puas', 'Sangat puas!'];
  function reviewModal(tx, onDone) {
    const user = DB.session(); const old = DB.reviewFor(tx.id);
    const isRent = tx.id.startsWith('RNT');
    const pids = isRent ? [...new Set(tx.items.flatMap((i) => i.components.map((c) => c.productId)))] : [...new Set(tx.items.map((i) => i.productId))];
    let rating = old ? old.rating : 0;
    const m = modal({ title: old ? 'Ulasan kamu' : 'Beri ulasan', body: `
      <p class="muted" style="font-size:13.5px;margin-bottom:12px">${isRent ? 'Rental' : 'Pembelian'} <strong>${tx.id}</strong> · ${esc(tx.items.map((i) => `${i.qty}× ${i.name}`).join(', '))}</p>
      <div class="star-input" id="rvStars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-label="${n} bintang" data-n="${n}"><i class="fa-solid fa-star"></i></button>`).join('')}<span id="rvLbl" class="muted"></span></div>
      <div class="field" style="margin-top:14px"><label for="rvText">Ceritakan pengalamanmu</label><textarea class="textarea" id="rvText" rows="4" maxlength="400" placeholder="Bagaimana kondisi alat, pelayanan, dan proses ${isRent ? 'sewanya' : 'pembeliannya'}?">${esc(old ? old.text : '')}</textarea><span class="hint"><span id="rvCnt">0</span>/400 · minimal 10 karakter</span></div>
      <p class="muted" style="font-size:12.5px"><i class="fa-regular fa-eye"></i> Ulasan tampil di halaman produk dengan nama <strong>${esc(user.name)}</strong>. Admin dapat memilih ulasan untuk ditampilkan sebagai testimoni di beranda.</p>
      ${old && old.reply ? `<div class="rv-reply" style="margin-top:12px"><strong><i class="fa-solid fa-store"></i> Balasan Annapurna Adventure${old.replyAt ? ` · ${D.fmtDate(old.replyAt, true)}` : ''}</strong> ${esc(old.reply)}</div>` : ''}`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rvSave"><i class="fa-solid fa-paper-plane"></i> ${old ? 'Perbarui ulasan' : 'Kirim ulasan'}</button>` });
    if (old && old.reply && old.replySeen === false) { old.replySeen = true; DB.saveReview(old); onDone && setTimeout(onDone, 0); }
    const paint = (n) => { m.$$('#rvStars button').forEach((b) => b.classList.toggle('on', +b.dataset.n <= n)); m.$('#rvLbl').textContent = REV_LABEL[n] || 'Pilih bintang'; };
    m.$$('#rvStars button').forEach((b) => {
      b.addEventListener('mouseenter', () => paint(+b.dataset.n));
      b.addEventListener('click', () => { rating = +b.dataset.n; paint(rating); b.closest('.star-input').classList.remove('err'); });
    });
    m.$('#rvStars').addEventListener('mouseleave', () => paint(rating));
    const cnt = () => (m.$('#rvCnt').textContent = m.$('#rvText').value.length); m.$('#rvText').addEventListener('input', cnt); cnt(); paint(rating);
    m.$('#rvSave').addEventListener('click', () => {
      const text = m.$('#rvText').value.trim();
      if (!rating) { m.$('#rvStars').classList.add('err'); toast('Pilih jumlah bintang dulu.', 'err'); return; }
      if (text.length < 10) { m.$('#rvText').classList.add('err'); m.$('#rvText').focus(); return; }
      const r = Object.assign(old || { id: DB.nextId('REV', DB.reviews()), refId: tx.id, type: isRent ? 'rent' : 'buy', email: user.email, img: '', role: isRent ? 'Penyewa' : 'Pembeli', createdAt: D.nowStamp(), visible: true, featured: false, reply: '' },
        { name: user.name, rating, text, productIds: pids, updatedAt: D.nowStamp(), seen: false });
      DB.saveReview(r);
      if (!old) DB.notifyStaff(`Ulasan baru ★${rating}`, `${user.name} memberi ulasan untuk ${tx.id}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`, 'admin/ulasan');
      m.close(); toast(old ? 'Ulasan diperbarui.' : 'Terima kasih atas ulasanmu!'); onDone && onDone(r);
    });
  }

  const loadedScripts = {};
  function loadScript(src) {
    return loadedScripts[src] || (loadedScripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src;
      s.onload = res; s.onerror = () => { delete loadedScripts[src]; rej(new Error('Gagal memuat ' + src)); };
      document.head.appendChild(s);
    }));
  }
  const vendor = (f) => asset('assets/vendor/export/' + f);
  function saveBlob(blob, filename) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  async function imgData(src) {
    const r = await fetch(asset(src)); const b = await r.blob();
    return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
  }
  const stamp = () => { const d = new Date(); return `${d.getDate()} ${D.BULAN[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`; };
  const pdfText = (v) => String(v ?? '').replace(/→/g, '->').replace(/−/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x00-\xFF–—…•€]/g, '');
  const cellText = (v, c) => (v === '' || v == null ? '' : c.type === 'money' && typeof v === 'number' ? rupiah(v) : c.type === 'number' && typeof v === 'number' ? v.toLocaleString('id-ID') : String(v));

  async function exportExcel(spec) {
    await loadScript(vendor('exceljs.min.js'));
    const st = DB.settings();
    const wb = new window.ExcelJS.Workbook(); wb.creator = st.storeName; wb.created = new Date();
    const ws = wb.addWorksheet(spec.title.replace(/[\\/?*[\]:]/g, '').slice(0, 31), {
      pageSetup: { paperSize: 9, orientation: spec.orientation || 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
      headerFooter: { oddFooter: `&L${st.storeName}&RHalaman &P dari &N` },
    });
    const n = spec.columns.length; const GREEN = 'FF1F4D2F', CREAM = 'FFF6F4EE', LINE = 'FFE3DED2';
    const merge = (r, text, font, h) => { ws.mergeCells(r, 1, r, n); const c = ws.getCell(r, 1); c.value = text; c.font = font; c.alignment = { vertical: 'middle' }; if (h) ws.getRow(r).height = h; };
    try {
      const logo = wb.addImage({ base64: await imgData('assets/img/logo.png'), extension: 'png' });
      ws.addImage(logo, { tl: { col: 0, row: 0 }, ext: { width: 118, height: 55 } });
    } catch (e) { }
    ws.getRow(1).height = 22; ws.getRow(2).height = 22; ws.getRow(3).height = 16;
    const right = (r, text, font) => { const c = ws.getCell(r, n); c.value = text; c.font = font; c.alignment = { horizontal: 'right' }; };
    right(1, st.storeName, { bold: true, size: 13, color: { argb: GREEN } });
    right(2, st.address, { size: 9, color: { argb: 'FF5B6B5E' } });
    right(3, `${st.phone} · ${st.email}`, { size: 9, color: { argb: 'FF5B6B5E' } });
    let r = 5;
    merge(r++, spec.title, { bold: true, size: 15, color: { argb: 'FF15311F' } }, 24);
    if (spec.subtitle) merge(r++, spec.subtitle, { size: 10, color: { argb: 'FF5B6B5E' } });
    merge(r++, `Dicetak: ${stamp()}`, { size: 9, italic: true, color: { argb: 'FF8A958C' } });
    r++;
    (spec.summary || []).forEach(([l, v]) => {
      const lEnd = n >= 4 ? 2 : 1, vEnd = n >= 4 ? 4 : Math.min(n, 2);
      if (lEnd > 1) ws.mergeCells(r, 1, r, lEnd);
      if (vEnd > lEnd + 1) ws.mergeCells(r, lEnd + 1, r, vEnd);
      const a = ws.getCell(r, 1), b = ws.getCell(r, lEnd + 1);
      a.value = l; a.font = { size: 10, color: { argb: 'FF5B6B5E' } }; a.alignment = { vertical: 'middle' };
      b.value = v; b.font = { bold: true, size: 11 }; b.alignment = { vertical: 'middle' }; if (typeof v === 'number') b.numFmt = '"Rp" #,##0';
      for (let k = 1; k <= vEnd; k++) { const c = ws.getCell(r, k); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }; c.border = { bottom: { style: 'thin', color: { argb: LINE } } }; }
      ws.getRow(r).height = 18; r++;
    });
    if ((spec.summary || []).length) r++;
    const head = r;
    spec.columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1); cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      cell.alignment = { vertical: 'middle', horizontal: c.type === 'money' || c.type === 'number' ? 'right' : 'left', wrapText: true, indent: c.type === 'money' || c.type === 'number' ? 0 : 1 };
      cell.border = { top: { style: 'thin', color: { argb: GREEN } }, bottom: { style: 'thin', color: { argb: GREEN } } };
    });
    ws.getRow(r).height = 22; r++;
    const fmt = (cell, c) => { if (c.type === 'money') cell.numFmt = '"Rp" #,##0'; else if (c.type === 'number') cell.numFmt = '#,##0'; };
    spec.rows.forEach((row, ri) => {
      spec.columns.forEach((c, i) => {
        const cell = ws.getCell(r, i + 1); const v = row[i];
        cell.value = v === '' || v == null ? null : v; fmt(cell, c);
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: c.type === 'money' || c.type === 'number' ? 'right' : 'left', indent: c.type === 'money' || c.type === 'number' ? 0 : 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
        if (ri % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
      });
      r++;
    });
    if (!spec.rows.length) { merge(r++, 'Tidak ada data pada periode ini.', { italic: true, color: { argb: 'FF8A958C' } }); }
    if (spec.foot && spec.rows.length) {
      spec.columns.forEach((c, i) => {
        const cell = ws.getCell(r, i + 1); const v = spec.foot[i];
        cell.value = v === '' || v == null ? null : v; fmt(cell, c);
        cell.font = { bold: true, size: 10.5 };
        cell.alignment = { horizontal: c.type === 'money' || c.type === 'number' ? 'right' : 'left' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEBE2' } };
        cell.border = { top: { style: 'medium', color: { argb: GREEN } }, bottom: { style: 'medium', color: { argb: GREEN } } };
      });
      r++;
    }
    spec.columns.forEach((c, i) => {
      const lens = [c.header, ...spec.rows.map((row) => cellText(row[i], c))].map((t) => Math.min(48, String(t).length));
      ws.getColumn(i + 1).width = c.width || Math.max(c.type === 'money' ? 16 : 10, Math.max(...lens) + 3);
    });
    ws.views = [{ state: 'frozen', ySplit: head }];
    if (spec.rows.length) ws.autoFilter = { from: { row: head, column: 1 }, to: { row: head + spec.rows.length, column: n } };
    const buf = await wb.xlsx.writeBuffer();
    saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), spec.filename + '.xlsx');
  }

  async function exportPDF(spec) {
    await loadScript(vendor('jspdf.umd.min.js')); await loadScript(vendor('jspdf.plugin.autotable.min.js'));
    const st = DB.settings();
    const doc = new window.jspdf.jsPDF({ orientation: spec.orientation || 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), M = 12;
    try { doc.addImage(await imgData('assets/img/logo.png'), 'PNG', M, 9, 30, 14); } catch (e) { }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(31, 77, 47);
    doc.text(pdfText(st.storeName), W - M, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(91, 107, 94);
    doc.text(pdfText(st.address), W - M, 18, { align: 'right' });
    doc.text(pdfText(`${st.phone} · ${st.email}`), W - M, 22, { align: 'right' });
    doc.setDrawColor(31, 77, 47); doc.setLineWidth(0.6); doc.line(M, 26, W - M, 26);
    let y = 34;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(21, 49, 31); doc.text(pdfText(spec.title), M, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(91, 107, 94);
    if (spec.subtitle) { doc.text(pdfText(spec.subtitle), M, y); y += 5; }
    doc.setFontSize(8); doc.setTextColor(138, 149, 140); doc.text(pdfText(`Dicetak: ${stamp()}`), M, y); y += 5;
    const sum = spec.summary || [];
    if (sum.length) {
      const gap = 4, bw = Math.min(62, (W - 2 * M - gap * (sum.length - 1)) / sum.length);
      sum.forEach(([l, v], i) => {
        const x = M + i * (bw + gap);
        doc.setFillColor(246, 244, 238); doc.setDrawColor(227, 222, 210); doc.roundedRect(x, y, bw, 15, 2, 2, 'FD');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(91, 107, 94); doc.text(pdfText(l), x + 3, y + 5.5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(21, 49, 31); doc.text(pdfText(typeof v === 'number' ? rupiah(v) : v), x + 3, y + 11.5);
      });
      y += 20;
    }
    const align = (c) => (c.type === 'money' || c.type === 'number' ? 'right' : 'left');
    doc.autoTable({
      startY: y, margin: { left: M, right: M, bottom: 16 },
      head: [spec.columns.map((c) => ({ content: pdfText(c.header), styles: { halign: align(c) } }))],
      body: spec.rows.length ? spec.rows.map((row) => spec.columns.map((c, i) => pdfText(cellText(row[i], c)))) : [[{ content: 'Tidak ada data pada periode ini.', colSpan: spec.columns.length, styles: { halign: 'center', textColor: [138, 149, 140], fontStyle: 'italic' } }]],
      foot: spec.foot && spec.rows.length ? [spec.columns.map((c, i) => ({ content: pdfText(cellText(spec.foot[i], c)), styles: { halign: align(c) } }))] : undefined,
      showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [33, 43, 36], lineColor: [227, 222, 210], lineWidth: { bottom: 0.2 }, overflow: 'linebreak' },
      headStyles: { fillColor: [31, 77, 47], textColor: 255, fontStyle: 'bold', fontSize: 8.8 },
      footStyles: { fillColor: [239, 235, 226], textColor: [21, 49, 31], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 244, 238] },
      columnStyles: Object.fromEntries(spec.columns.map((c, i) => [i, { halign: align(c), cellWidth: c.pdfWidth || (c.type === 'money' || c.type === 'number' || i === 0 ? 'wrap' : 'auto') }])),
      didDrawPage: () => {
        const H = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5); doc.setTextColor(138, 149, 140); doc.setFont('helvetica', 'normal');
        doc.text(pdfText(`${st.storeName} · ${spec.title}`), M, H - 7);
        doc.text(`Halaman ${doc.internal.getNumberOfPages()}`, W - M, H - 7, { align: 'right' });
      },
    });
    doc.save(spec.filename + '.pdf');
  }

  async function elementToPDF(el, filename) {
    await loadScript(vendor('html2canvas.min.js')); await loadScript(vendor('jspdf.umd.min.js'));
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 900 });
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 8;
    const iw = W - 2 * m, ih = canvas.height * iw / canvas.width;
    const img = canvas.toDataURL('image/jpeg', 0.92);
    let left = ih, pos = m;
    doc.addImage(img, 'JPEG', m, pos, iw, ih);
    left -= (H - 2 * m);
    while (left > 0) { pos -= (H - 2 * m); doc.addPage(); doc.addImage(img, 'JPEG', m, pos, iw, ih); left -= (H - 2 * m); }
    doc.save(filename + '.pdf');
  }

  async function runExport(btn, kind, specFn) {
    const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan…';
    try {
      const spec = specFn();
      await (kind === 'xlsx' ? exportExcel(spec) : exportPDF(spec));
      DB.audit({ type: 'laporan', action: `Mengekspor ${spec.title} (${kind === 'xlsx' ? 'Excel' : 'PDF'})`, changes: spec.subtitle ? [{ field: 'Keterangan', from: '', to: spec.subtitle }] : [] });
      toast(kind === 'xlsx' ? 'File Excel berhasil diunduh.' : 'File PDF berhasil diunduh.');
    } catch (e) { console.error(e); toast('Gagal membuat file. Coba lagi.', 'err'); }
    btn.disabled = false; btn.innerHTML = html;
  }
  function bindExport(root, specFn) {
    root.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => runExport(b, b.dataset.export, specFn)));
  }
  const exportButtons = () => '<button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button>';

  /* ---------- Ganti barang sewa (customer & staff) ---------- */
  function changeModal(b, opts) {
    opts = opts || {};
    const staff = opts.mode === 'staff';
    const lines = b.items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'product');
    if (!lines.length) { toast('Booking ini berisi paket. Penggantian isi paket dilakukan langsung dengan admin.', 'err'); return null; }
    const cats = DB.categories();
    const st = { li: lines[0].i, qty: lines[0].it.qty, cat: '', q: '', pid: null, size: null };
    const fromProd = () => DB.product(b.items[st.li].refId) || {};
    st.cat = fromProd().cat || '';
    const out = b.status === 'disewa';
    const m = modal({ title: `${staff ? 'Catat ganti barang' : 'Ganti barang'} · ${b.id}`, size: 'xl', body: `
      <p class="muted" style="margin-bottom:16px;font-size:13.5px">${staff ? `Untuk permintaan customer langsung di toko. Perubahan langsung berlaku dan tercatat atas nama <strong>${esc((DB.session() || {}).name || '')}</strong>.` : 'Pilih barang yang mau diganti, lalu pilih penggantinya. Permintaan akan dicek admin.'} Sewa ${D.fmtRange(b.start, b.end)} · ${b.days} hari.</p>
      <div class="chg-steps">
        <section class="chg-step"><h4><span>1</span> Barang yang diganti</h4><div class="chg-lines" id="cgLines"></div>
          <div class="chg-qty" id="cgQtyWrap"><label>Jumlah yang diganti</label><div class="qty"><button type="button" data-cq="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input id="cgQty" type="number" min="1" value="1" aria-label="Jumlah"><button type="button" data-cq="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div><small class="muted" id="cgQtyHint"></small></div></section>
        <section class="chg-step"><h4><span>2</span> Pilih barang pengganti</h4>
          <div class="pick-bar"><div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="cgQ" placeholder="Cari barang…"></div><div class="pick-cats" id="cgCats"></div></div>
          <div class="pick-grid" id="cgGrid"></div></section>
        <section class="chg-step"><h4><span>3</span> Ringkasan</h4><div id="cgSum"></div>
          ${staff && out ? `<div class="field" style="margin-top:12px"><label>Kondisi barang lama saat diterima kembali</label><select class="select" id="cgCond"><option>Baik</option><option>Kotor (perlu dicuci)</option><option>Rusak ringan</option><option>Rusak berat</option></select></div>` : ''}
          <div class="field" style="margin-top:12px"><label>${staff ? 'Keterangan' : 'Alasan penggantian'}</label><textarea class="textarea" id="cgReason" rows="2" placeholder="${staff ? 'Contoh: customer minta ukuran lebih besar saat mencoba di toko' : 'Contoh: jumlah peserta bertambah / ukuran kurang pas'}">${staff ? 'Permintaan customer di toko' : ''}</textarea></div>
          <div id="cgPay"></div></section>
      </div>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="cgOk" disabled><i class="fa-solid fa-arrows-rotate"></i> ${staff ? 'Simpan penggantian' : 'Ajukan ganti barang'}</button>` });

    const avail = (p, size) => Rules.available(p.id, b.start, b.end, b.id, size || null);
    const totalAvail = (p) => (DB.hasVariant(p) ? Rules.sizeAvailability(p.id, b.start, b.end, b.id).reduce((a, o) => a + o.avail, 0) : avail(p));
    const short = (n) => String(n).replace(/\s*\(.*\)/, '');
    function drawLines() {
      m.$('#cgLines').innerHTML = lines.map(({ it, i }) => `<button type="button" class="chg-line ${i === st.li ? 'on' : ''}" data-li="${i}"><img src="${asset(it.img)}" alt=""><span><b>${esc(it.name)}</b><small>${it.qty} unit · ${rupiah(it.pricePerDay)}/hari</small></span><i class="fa-solid fa-circle-check"></i></button>`).join('');
      const max = b.items[st.li].qty; st.qty = Math.min(Math.max(1, st.qty), max);
      m.$('#cgQty').value = st.qty; m.$('#cgQty').max = max;
      m.$('#cgQtyWrap').hidden = max <= 1;
      m.$('#cgQtyHint').textContent = max > 1 ? `dari ${max} unit` : '';
    }
    function drawCats() {
      const used = new Set(DB.products().filter((p) => p.rent).map((p) => p.cat));
      m.$('#cgCats').innerHTML = [['', 'Semua'], ...cats.filter((c) => used.has(c.id)).map((c) => [c.id, c.name])].map(([id, n]) => `<button type="button" data-cat="${id}" class="${st.cat === id ? 'on' : ''}">${esc(n)}</button>`).join('');
    }
    function drawGrid() {
      const line = b.items[st.li];
      const q = st.q.toLowerCase();
      const L = DB.products().filter((p) => p.rent && (!st.cat || p.cat === st.cat) && (!q || p.name.toLowerCase().includes(q)) && !(p.id === line.refId && !DB.hasVariant(p)));
      m.$('#cgGrid').innerHTML = L.length ? L.map((p) => {
        const on = st.pid === p.id; const ta = totalAvail(p); const d = (p.rent - line.pricePerDay);
        const sizes = on && DB.hasVariant(p) ? Rules.sizeAvailability(p.id, b.start, b.end, b.id) : null;
        return `<article class="pick-card ${on ? 'on' : ''} ${ta < st.qty ? 'low' : ''}" data-pid="${p.id}">
          <div class="pc-ph"><img src="${asset(p.img)}" alt="" loading="lazy">${on ? '<span class="pc-check"><i class="fa-solid fa-check"></i></span>' : ''}</div>
          <div class="pc-bd"><b>${esc(p.name)}</b><div class="pc-price">${rupiah(p.rent)} <small>/ hari</small></div>
            <div class="pc-meta"><span class="${ta >= st.qty ? 'ok' : 'no'}">${ta >= st.qty ? `${ta} tersedia` : ta ? `sisa ${ta}` : 'Penuh'}</span><span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${rupiah(Math.abs(d))}/hari</span></div>
            ${DB.hasVariant(p) ? (sizes ? `<div class="pc-sizes">${sizes.filter((o) => !(p.id === line.refId && o.name === line.size)).map((o) => `<button type="button" data-psize="${esc(o.name)}" class="${st.size === o.name ? 'on' : ''}" ${o.avail >= st.qty ? '' : 'disabled'}>${esc(short(o.name))}<small>${o.avail}</small></button>`).join('')}</div>` : `<div class="size-hint"><i class="fa-solid fa-ruler"></i> ${esc(p.variant.options.map((o) => short(o.name)).join(' · '))}</div>`) : ''}
          </div></article>`;
      }).join('') : '<p class="muted" style="grid-column:1/-1;text-align:center;padding:24px">Tidak ada barang yang cocok.</p>';
      drawSum();
    }
    function calc() {
      const line = b.items[st.li]; const p = st.pid && DB.product(st.pid);
      if (!p) return null;
      if (DB.hasVariant(p) && !st.size) return { p, needSize: true };
      const a = avail(p, st.size); const diff = (p.rent - line.pricePerDay) * st.qty * b.days;
      return { p, line, size: st.size, avail: a, ok: a >= st.qty, diff };
    }
    function drawSum() {
      const r = calc(); const line = b.items[st.li];
      if (!r) { m.$('#cgSum').innerHTML = '<p class="muted" style="font-size:13.5px">Pilih barang pengganti di langkah 2.</p>'; m.$('#cgPay').innerHTML = ''; m.$('#cgOk').disabled = true; return; }
      if (r.needSize) { m.$('#cgSum').innerHTML = `<div class="notice"><i class="fa-solid fa-ruler"></i><div>Pilih ${esc(r.p.variant.label.toLowerCase())} untuk <strong>${esc(r.p.name)}</strong> pada kartunya.</div></div>`; m.$('#cgPay').innerHTML = ''; m.$('#cgOk').disabled = true; return; }
      const newName = DB.variantName(r.p, r.size);
      const paid = Rules.paidTotal(b); const newTotal = b.total + r.diff;
      m.$('#cgSum').innerHTML = `<div class="chg-sum"><div class="cs-row"><span>${st.qty}× ${esc(line.name)}</span><i class="fa-solid fa-arrow-right"></i><strong>${st.qty}× ${esc(newName)}</strong></div>
        <div class="kv"><span>Total sewa sebelumnya</span><span>${rupiah(b.total)}</span></div>
        <div class="kv"><span>Selisih (${st.qty} unit × ${b.days} hari)</span><span style="color:${r.diff > 0 ? '#9a6508' : r.diff < 0 ? 'var(--g700)' : 'inherit'}">${r.diff > 0 ? '+ ' : r.diff < 0 ? '− ' : ''}${rupiah(Math.abs(r.diff))}</span></div>
        <div class="kv total"><span>Total sewa baru</span><span>${rupiah(newTotal)}</span></div>
        ${r.ok ? '' : `<div class="notice red" style="margin-top:10px"><i class="fa-solid fa-circle-xmark"></i><div>${esc(newName)} hanya tersedia ${r.avail} unit di tanggal sewa ini.</div></div>`}</div>`;
      const payBox = m.$('#cgPay');
      if (staff && r.ok && paid > 0) {
        const extra = newTotal - paid;
        payBox.innerHTML = r.diff > 0 && (b.paymentStatus === 'lunas' || extra > 0) && out ? `<label class="chk-line"><input type="checkbox" id="cgPaid" checked> Selisih ${rupiah(r.diff)} sudah dibayar customer sekarang</label>`
          : r.diff < 0 && paid > newTotal ? `<label class="chk-line"><input type="checkbox" id="cgBack" checked> Kembalikan kelebihan bayar ${rupiah(paid - newTotal)} ke customer sekarang</label>` : '';
      } else payBox.innerHTML = !staff && r.ok ? `<p class="muted" style="font-size:12.5px;margin-top:8px">${r.diff > 0 ? 'Selisih dibayar saat pengambilan barang.' : r.diff < 0 ? 'Kelebihan bayar dipotong dari sisa pembayaran.' : 'Tidak ada selisih harga.'}</p>` : '';
      m.$('#cgOk').disabled = !r.ok;
    }
    m.$('#cgLines').addEventListener('click', (e) => { const x = e.target.closest('[data-li]'); if (!x) return; st.li = +x.dataset.li; st.qty = b.items[st.li].qty; st.pid = null; st.size = null; st.cat = fromProd().cat || ''; drawLines(); drawCats(); drawGrid(); });
    m.$$('[data-cq]').forEach((x) => x.addEventListener('click', () => { st.qty += +x.dataset.cq; drawLines(); drawGrid(); }));
    m.$('#cgQty').addEventListener('change', () => { st.qty = parseInt(m.$('#cgQty').value, 10) || 1; drawLines(); drawGrid(); });
    m.$('#cgCats').addEventListener('click', (e) => { const x = e.target.closest('[data-cat]'); if (!x) return; st.cat = x.dataset.cat; drawCats(); drawGrid(); });
    m.$('#cgQ').addEventListener('input', () => { st.q = m.$('#cgQ').value.trim(); drawGrid(); });
    m.$('#cgGrid').addEventListener('click', (e) => {
      const sz = e.target.closest('[data-psize]'); if (sz) { if (!sz.disabled) { st.size = sz.dataset.psize; drawGrid(); } return; }
      const c = e.target.closest('[data-pid]'); if (!c) return;
      if (st.pid !== c.dataset.pid) { st.pid = c.dataset.pid; st.size = null; const p = DB.product(st.pid);
        if (DB.hasVariant(p)) { const line = b.items[st.li]; st.size = firstAvailSize(Rules.sizeAvailability(p.id, b.start, b.end, b.id).filter((o) => o.avail >= st.qty && !(p.id === line.refId && o.name === line.size)), null); } drawGrid(); }
    });
    m.$('#cgReason').addEventListener('input', () => m.$('#cgReason').classList.remove('err'));
    m.$('#cgOk').addEventListener('click', () => {
      const r = calc(); if (!r || !r.ok) return;
      const reason = m.$('#cgReason').value.trim(); if (!reason) { m.$('#cgReason').classList.add('err'); m.$('#cgReason').focus(); return; }
      const res = { lineIndex: st.li, qty: st.qty, line: r.line, p: r.p, size: r.size, toName: DB.variantName(r.p, r.size), diff: r.diff, reason,
        oldCond: m.$('#cgCond') ? m.$('#cgCond').value : '', paidNow: !!(m.$('#cgPaid') && m.$('#cgPaid').checked), refundNow: !!(m.$('#cgBack') && m.$('#cgBack').checked) };
      if (opts.onSubmit && opts.onSubmit(res) !== false) m.close();
    });
    drawLines(); drawCats(); drawGrid();
    return m;
  }

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function searchProducts(list, query) {
    const q = norm(query); if (!q) return { list, mode: 'all' };
    const tokens = q.split(' ');
    const cats = DB.categories();
    const words = (t) => norm(t).split(' ');
    const hit = (ws, tok) => ws.some((w) => w.startsWith(tok));
    const scored = list.map((p) => {
      const nameW = words(p.name), catW = words((cats.find((c) => c.id === p.cat) || {}).name);
      if (!tokens.every((t) => hit(nameW, t) || hit(catW, t))) return null;
      const n = norm(p.name);
      const score = (n === q ? 400 : 0) + (n.startsWith(q) ? 200 : 0) + tokens.reduce((a, t) => a + (hit(nameW, t) ? 50 : 10), 0);
      return { p, score };
    }).filter(Boolean);
    if (scored.length) return { list: scored.sort((a, b) => b.score - a.score).map((x) => x.p), mode: 'name' };
    const related = list.filter((p) => { const ws = words([p.desc, ...(p.specs || [])].join(' ')); return tokens.every((t) => hit(ws, t)); });
    return { list: related, mode: related.length ? 'related' : 'none' };
  }

  function waLink(text) { return `https://wa.me/${DB.settings().whatsapp}?text=${encodeURIComponent(text || 'Halo Annapurna Adventure, saya mau tanya soal sewa alat camping.')}`; }

  window.UI = { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, stars, Cart, quickRent, quickBuy, sizePicker, firstAvailSize, changeModal, productCard, bindProductActions, validate, isEmail, isPhone, fileToDataURL, downloadCSV, exportExcel, exportPDF, elementToPDF, runExport, bindExport, exportButtons, loadScript, reviewModal, searchProducts, dateGuard, waLink, BASE };
})();
