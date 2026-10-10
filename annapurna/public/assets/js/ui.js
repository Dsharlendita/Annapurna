(function () {
  const { DB, Rules, STATUS, D, rupiah } = window.Ann;
  const BASE = document.body.dataset.base || '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const asset = (p) => (!p ? '' : /^(data:|https?:|blob:)/.test(p) ? p : BASE + p);
  const url = (p) => BASE + p;
  const param = (k) => new URLSearchParams(location.search).get(k);

  /* Isi toast boleh memuat format sederhana (<b>, <strong>, <i>, <em>, <br>), tapi tidak pernah HTML lain.
     Teks dari pengguna (nama, nama barang, pesan server) aman walau lupa di-esc() di pemanggil. */
  const SAFE_TAGS = ['B', 'STRONG', 'I', 'EM', 'BR'];
  function safeHtml(msg) {
    const doc = new DOMParser().parseFromString(`<div>${String(msg == null ? '' : msg)}</div>`, 'text/html');
    const walk = (node) => [...node.childNodes].map((n) => {
      if (n.nodeType === 3) return esc(n.textContent);
      if (n.nodeType === 1 && ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(n.tagName)) return '';
      if (n.nodeType === 1 && SAFE_TAGS.includes(n.tagName)) return n.tagName === 'BR' ? '<br>' : `<${n.tagName.toLowerCase()}>${walk(n)}</${n.tagName.toLowerCase()}>`;
      return n.nodeType === 1 ? walk(n) : '';
    }).join('');
    return walk(doc.body.firstChild);
  }
  function toast(msg, type) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'err' ? ' err' : '');
    t.innerHTML = `<i class="fa-solid ${type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><div>${safeHtml(msg)}</div>`;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = '.3s'; t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; setTimeout(() => t.remove(), 300); }, 3200);
  }

  function modal({ title, body, foot, size, onOpen, locked }) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    const tid = 'mt' + Math.random().toString(36).slice(2, 8);
    m.setAttribute('aria-labelledby', tid);
    m.innerHTML = `<div class="modal-box ${size || ''}">
      <div class="modal-head"><h3 id="${tid}">${title}</h3>${locked ? '' : '<button class="icon-btn" data-close aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>'}</div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(m);
    const prevFocus = document.activeElement;
    const close = () => { m.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => m.remove(), 200); document.body.style.overflow = ''; prevFocus && prevFocus.focus && prevFocus.focus(); };
    const isTop = () => { const all = document.querySelectorAll('.modal'); return all[all.length - 1] === m; };
    const onKey = (e) => {
      if (!isTop()) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') { /* fokus tidak keluar dari jendela */
        const f = [...m.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    m.addEventListener('click', (e) => { if (!locked && (e.target === m || e.target.closest('[data-close]'))) close(); });
    document.addEventListener('keydown', (e) => { if (locked && e.key === 'Tab') onKey(e); });
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
      const same = cart.find((c) => c.type === item.type && c.kind === item.kind && c.refId === item.refId && (c.size || '') === (item.size || '') && JSON.stringify(c.swaps || {}) === JSON.stringify(item.swaps || {}) && JSON.stringify(c.sizes || {}) === JSON.stringify(item.sizes || {}) && (item.type === 'buy' || (c.start === item.start && c.end === item.end)));
      if (same) same.qty += item.qty; else cart.push(Object.assign({ key: 'c' + Date.now() + Math.random().toString(16).slice(2, 5) }, item));
      DB.setCart(cart);
    },
    update(key, patch) { const cart = DB.cart(); const it = cart.find((c) => c.key === key); if (it) Object.assign(it, patch); DB.setCart(cart); },
    remove(key) { DB.setCart(DB.cart().filter((c) => c.key !== key)); },
    clear(type) { DB.setCart(type ? DB.cart().filter((c) => c.type !== type) : []); },
    resolve(it) {
      if (it.kind === 'package') {
        const pk = DB.pkg(it.refId); if (!pk) return null;
        /* Paket dengan barang berukuran: ukuran tersimpan per isi paket (it.sizes = { indexIsi: 'ukuran' }) */
        const SZ = it.sizes || {};
        const withSize = (items) => items.map((i, k) => Object.assign({ productId: i.productId, qty: i.qty }, SZ[k] ? { size: SZ[k] } : {}));
        const szNote = Rules.packageSized(pk, it.swaps).filter((x) => SZ[x.k]).map((x) => `${x.product.name.replace(/\s*\(.*\)/, '')} ${String(SZ[x.k]).replace(/\s*\(.*\)/, '')}`).join(', ');
        const missing = Rules.packageSized(pk, it.swaps).filter((x) => !SZ[x.k]);
        const subOf = (items) => items.map((i, k) => `${i.qty}× ${(DB.product(i.productId) || {}).name}${SZ[k] ? ` (${String(SZ[k]).replace(/\s*\(.*\)/, '')})` : ''}`).join(', ');
        if (it.swaps && Object.keys(it.swaps).length) { const cp = Rules.customPackage(pk, it.swaps); return { name: cp.name + (szNote ? ` · ukuran: ${szNote}` : ''), img: pk.img, unit: cp.tiers.d1, tiers: cp.tiers, components: withSize(cp.items), sub: subOf(cp.items), missingSizes: missing }; }
        if (szNote || missing.length) return { name: pk.name + (szNote ? ` · ukuran: ${szNote}` : ''), img: pk.img, unit: pk.price, tiers: Rules.packageTiers(pk), components: withSize(pk.items), sub: subOf(pk.items), missingSizes: missing };
        return { name: pk.name, img: pk.img, unit: pk.price, tiers: Rules.packageTiers(pk), components: pk.items, sub: pk.items.map((i) => `${i.qty}× ${(DB.product(i.productId) || {}).name}`).join(', ') };
      }
      const p = DB.product(it.refId); if (!p) return null;
      const sz = it.size && DB.hasVariant(p) ? it.size : null;
      return { name: DB.variantName(p, sz), img: p.img, unit: it.type === 'buy' ? p.price : p.rent, tiers: Rules.productTiers(p), components: [sz ? { productId: p.id, qty: 1, size: sz } : { productId: p.id, qty: 1 }], product: p, size: sz };
    },
    lineTotal(it) {
      const r = Cart.resolve(it); if (!r) return 0;
      return it.type === 'buy' ? r.unit * it.qty : Rules.tierPlan(r.tiers, Rules.rentalDays(it.start, it.end)).total * it.qty;
    },
    availability(it) {
      if (it.type === 'buy') { const p = DB.product(it.refId); return p ? DB.sizeStock(p, it.size) : 0; }
      return it.kind === 'package' ? Rules.packageAvailable(it.refId, it.start, it.end, it.swaps, it.sizes) : Rules.available(it.refId, it.start, it.end, null, it.size || null);
    },
  };

  /* Saat tanggal ambil diganti: lama sewa (jumlah malam) dipertahankan, tanggal kembali ikut bergeser,
     lalu kalender "Kembali" dibuka supaya bisa langsung disesuaikan (tidak perlu mengisi ulang dari awal). */
  function shiftEnd(startEl, endEl, prevStart) {
    const nights = prevStart && endEl.value && endEl.value > prevStart ? Rules.rentalDays(prevStart, endEl.value) : 1;
    const minEnd = D.addDays(startEl.value || D.today(), 1);
    endEl.min = minEnd;
    if (startEl.value) endEl.value = D.addDays(startEl.value, Math.max(1, nights));
    endEl.classList.add('date-next');
    setTimeout(() => { try { endEl.focus({ preventScroll: true }); if (endEl.showPicker) endEl.showPicker(); } catch (e) { /* browser tidak mengizinkan membuka otomatis */ } }, 60);
    setTimeout(() => endEl.classList.remove('date-next'), 2500);
  }
  function dateGuard(startEl, endEl) {
    startEl.min = D.today();
    let prev = startEl.value;
    const minOnly = () => { const minEnd = D.addDays(startEl.value || D.today(), 1); endEl.min = minEnd; if (!endEl.value || endEl.value < minEnd) endEl.value = minEnd; };
    startEl.addEventListener('change', () => { shiftEnd(startEl, endEl, prev); prev = startEl.value; endEl.dispatchEvent(new Event('change')); });
    minOnly();
  }
  /* Pilihan durasi sesuai syarat & ketentuan: Per malam (1), Kegiatan 3 hari 3 malam, Ekspedisi 5 hari 5 malam.
     Mengisi tanggal kembali otomatis dari tanggal ambil. */
  function durationChips(startEl, endEl, onPick) {
    const wrap = document.createElement('div'); wrap.className = 'dur-chips';
    const draw = () => { const n = Rules.rentalDays(startEl.value, endEl.value);
      wrap.innerHTML = `<span class="dur-lbl">Durasi:</span>${Rules.TIERS.map((t) => `<button type="button" class="chip ${n === t.days ? 'active' : ''}" data-dur="${t.days}">${t.days === 1 ? 'Per malam' : t.days === 3 ? 'Kegiatan · 3H3M' : 'Ekspedisi · 5H5M'}</button>`).join('')}`; };
    wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-dur]'); if (!b) return; endEl.value = D.addDays(startEl.value || D.today(), +b.dataset.dur); endEl.dispatchEvent(new Event('change')); draw(); onPick && onPick(); });
    [startEl, endEl].forEach((el) => el.addEventListener('change', draw));
    draw(); return wrap;
  }
  /* Teks tarif ringkas: "Rp35.000 / malam · 3 hari Rp60.000 · 5 hari Rp100.000" */
  function tierText(t, html) {
    const rows = Rules.tierRows(t).filter((x) => x.price);
    const one = rows.find((x) => x.days === 1);
    const rest = rows.filter((x) => x.days !== 1).map((x) => `${x.days} hari ${rupiah(x.price)}`).join(' · ');
    return html ? `${one ? `${rupiah(one.price)} <small>/ malam</small>` : ''}` + (rest ? `<span class="tier-sub">${rest}</span>` : '') : `${one ? `${rupiah(one.price)} / malam` : ''}${rest ? ` · ${rest}` : ''}`;
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
    let tiers = isPkg ? Rules.packageTiers(item) : Rules.productTiers(item);
    const swaps = {}; const tektok = isPkg && item.tektok; const psizes = {};
    const m = modal({
      title: isPkg ? 'Sewa paket' : 'Sewa alat',
      body: `<div class="mini-line" style="border:0;padding-top:0"><img src="${asset(item.img)}" alt=""><div class="nm"><strong>${esc(item.name)}</strong><small>${esc(tierText(tiers))}</small></div></div>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label for="qrStart">Tanggal ambil</label><input type="date" id="qrStart" class="input" value="${tripDefault().start}"></div>
          <div class="field"><label for="qrEnd">Tanggal kembali</label><input type="date" id="qrEnd" class="input" value="${tripDefault().end}"></div>
        </div>
        <div id="qrDur"></div>
        ${tektok ? `<div class="tk-box"><div class="tk-h"><b><i class="fa-solid fa-arrows-rotate"></i> Sesuaikan isi paket</b><small>Tukar item dengan harga sama, atau upgrade dengan menambah selisih.</small></div>${item.items.map((it0, k) => { const p0 = DB.product(it0.productId); const opts = Rules.swapOptions(item, k); return `<div class="tk-row"><img src="${asset(p0.img)}" alt="" data-tkimg="${k}"><select class="select" data-tk="${k}" ${opts.length ? '' : 'disabled'}><option value="">${esc(p0.name)} (isi paket)</option>${opts.map((o) => `<option value="${o.id}">${esc(o.name)} · ${o.rent === p0.rent ? 'tukar, harga sama' : `upgrade +${rupiah((o.rent - p0.rent) * it0.qty)}`}</option>`).join('')}</select></div>`; }).join('')}<div class="tk-sum" id="tkSum"></div></div>` : ''}
        <div id="qrSize"></div>
        ${isPkg ? '<div id="qrPkSz"></div>' : ''}
        <div class="field"><label>Jumlah</label><div class="qty"><button type="button" data-q="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input id="qrQty" type="number" value="1" min="1" aria-label="Jumlah"><button type="button" data-q="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div></div>
        <div id="qrAvail" class="avail-msg"></div>
        <div class="kv"><span>Tarif</span><span id="qrTier">-</span></div>
        <div class="kv total"><span>Estimasi total</span><span id="qrTotal">-</span></div>
        <div class="kv hl"><span>DP ${DB.settings().dpPercent}% yang dibayar sekarang</span><span id="qrDp">-</span></div>
        ${isPkg && item.tektok ? `<p class="muted" style="font-size:12.5px;margin-top:8px"><i class="fa-solid fa-circle-info"></i> ${esc((DB.settings().tektokTerms || [])[0] || '')}</p>` : ''}`,
      foot: `<a class="btn btn-ghost" href="${url(isPkg ? 'paket' : 'produk?id=' + id)}">${isPkg ? 'Lihat isi paket' : 'Lihat detail'}</a><button class="btn btn-outline" id="qrCart"><i class="fa-solid fa-cart-plus"></i> Tambah ke keranjang</button><button class="btn btn-primary" id="qrNow">Sewa sekarang</button>`,
    });
    const s = m.$('#qrStart'), e = m.$('#qrEnd'), q = m.$('#qrQty');
    dateGuard(s, e);
    m.$('#qrDur').appendChild(durationChips(s, e, () => calc()));
    const sized = !isPkg && DB.hasVariant(item); let size = null;
    const calc = () => {
      const days = Rules.rentalDays(s.value, e.value);
      if (sized) { const list = Rules.sizeAvailability(id, s.value, e.value); size = firstAvailSize(list, size); m.$('#qrSize').innerHTML = sizePicker(item, list, size); }
      if (tektok) { const cp = Rules.customPackage(item, swaps); tiers = cp.tiers; m.$('#tkSum').innerHTML = cp.changed.length ? `Harga paket 1 malam: <b>${rupiah(cp.tiers.d1)}</b>${cp.upgrade ? ` (termasuk upgrade +${rupiah(cp.upgrade)})` : ' (tukar dengan harga sama)'}` : ''; }
      const avail = isPkg ? Rules.packageAvailable(id, s.value, e.value, tektok ? swaps : null, psizes) : sized ? (size ? Rules.available(id, s.value, e.value, null, size) : 0) : Rules.available(id, s.value, e.value);
      const qty = Math.max(1, parseInt(q.value, 10) || 1); q.value = qty;
      /* Paket berisi barang berukuran (mis. sepatu & jaket di Paket Tektok): ukuran wajib dipilih */
      let needSz = [];
      if (isPkg) {
        const sized = Rules.packageSized(item, tektok ? swaps : null);
        Object.keys(psizes).forEach((k) => { if (!sized.some((x) => String(x.k) === k)) delete psizes[k]; });
        needSz = sized.filter((x) => !psizes[x.k]);
        m.$('#qrPkSz').innerHTML = sized.length ? `<div class="pks-box"><div class="pks-h"><b><i class="fa-solid fa-ruler"></i> Pilih ukuran</b><small>Wajib untuk barang berukuran di paket ini.</small></div>${sized.map((x) => { const list = Rules.sizeAvailability(x.productId, s.value, e.value); const need = x.qty * qty;
          return `<div class="pks-row ${psizes[x.k] ? '' : 'need'}"><span><img src="${asset(x.product.img)}" alt="">${x.qty}× ${esc(x.product.name)}</span><select class="select" data-pks="${x.k}"><option value="">Pilih ukuran…</option>${list.map((o) => `<option value="${esc(o.name)}" ${psizes[x.k] === o.name ? 'selected' : ''} ${o.avail < need && psizes[x.k] !== o.name ? 'disabled' : ''}>${esc(o.name.replace(/\s*\(.*\)/, ''))} ${o.avail < need ? '(habis)' : `(sisa ${o.avail})`}</option>`).join('')}</select></div>`; }).join('')}</div>` : '';
      }
      const minD = (!isPkg && item.minDays) || 1; const maxD = DB.settings().maxRentDays || 60;
      const ok = qty <= avail && days >= minD && days <= maxD && !needSz.length;
      m.$('#qrAvail').className = 'avail-msg ' + (ok ? 'ok' : 'no');
      m.$('#qrAvail').innerHTML = !isPkg && !DB.condRentable(item.cond) ? `<i class="fa-solid fa-circle-xmark"></i> Barang sedang ${esc(String(item.cond).toLowerCase())} dan belum bisa disewa.` : days > maxD ? `<i class="fa-solid fa-circle-xmark"></i> Maksimal lama sewa ${maxD} malam.` : days < minD ? `<i class="fa-solid fa-circle-xmark"></i> Minimal sewa ${minD} malam.` : ok ? `<i class="fa-solid fa-circle-check"></i> Tersedia ${avail} unit${size ? ` ukuran ${esc(size.replace(/\s*\(.*\)/, ''))}` : ''} untuk ${days} malam sewa` : sized && !size ? `<i class="fa-solid fa-circle-xmark"></i> Semua ukuran habis untuk ${D.fmtRange(s.value, e.value)}. Coba geser tanggal.` : `<i class="fa-solid fa-circle-xmark"></i> ${isPkg ? `Paket ini hanya tersedia ${avail} di tanggal tersebut.` : Rules.availMsg(item, qty, s.value, e.value, size, avail)}`;
      const unitTotal = Rules.tierPlan(tiers, days).total;
      m.$('#qrTier').textContent = `${Rules.tierLabel(tiers, days)} · ${rupiah(unitTotal)} × ${qty}`;
      m.$('#qrTotal').textContent = rupiah(unitTotal * qty);
      m.$('#qrDp').textContent = rupiah(Math.round(unitTotal * qty * DB.settings().dpPercent / 100));
      if (needSz.length && qty <= avail) { m.$('#qrAvail').className = 'avail-msg no'; m.$('#qrAvail').innerHTML = `<i class="fa-solid fa-ruler"></i> Pilih ukuran ${needSz.map((x) => esc(x.product.name.replace(/\s*\(.*\)/, ''))).join(' & ')} dulu.`; }
      m.$('#qrCart').disabled = m.$('#qrNow').disabled = !ok;
      return ok;
    };
    m.$$('[data-q]').forEach((b) => b.addEventListener('click', () => { q.value = Math.max(1, (parseInt(q.value, 10) || 1) + Number(b.dataset.q)); calc(); }));
    [s, e, q].forEach((el) => el.addEventListener('change', calc));
    q.addEventListener('input', calc);
    m.$('#qrSize').addEventListener('click', (ev) => { const b = ev.target.closest('[data-size]'); if (b && !b.disabled) { size = b.dataset.size; calc(); } });
    calc();
    if (isPkg) m.$('#qrPkSz').addEventListener('change', (ev) => { const k = ev.target.dataset.pks; if (k == null) return; if (ev.target.value) psizes[k] = ev.target.value; else delete psizes[k]; calc(); });
    if (tektok) m.$('.tk-box').addEventListener('change', (ev) => { const k = ev.target.dataset.tk; if (k == null) return; delete psizes[k]; if (ev.target.value) swaps[k] = ev.target.value; else delete swaps[k]; const p1 = DB.product(swaps[k] || item.items[k].productId); m.$(`[data-tkimg="${k}"]`).src = asset(p1.img); calc(); });
    const add = () => { if (!calc()) return false; DB.setTrip(s.value, e.value); Cart.add(Object.assign({ type: 'rent', kind: isPkg ? 'package' : 'product', refId: id, qty: +q.value, start: s.value, end: e.value }, tektok && Object.keys(swaps).length ? { swaps: Object.assign({}, swaps) } : {}, Object.keys(psizes).length ? { sizes: Object.assign({}, psizes) } : {}, size ? { size } : {})); return true; };
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
  /* Pop-up "Beli Sekarang" untuk barang jual: detail singkat, harga, ukuran, jumlah → Tambah ke keranjang / Checkout sekarang */
  function buyModal(id) {
    const p = DB.product(id); if (!p || !p.price) return;
    const cat = (DB.categories().find((c) => c.id === p.cat) || {}).name || '';
    const attrName = (k) => ((DB.attributes(true) || []).find((a) => a.id === k) || {}).name || '';
    const rows = [['Merek', p.brand], ['Kategori', cat],
      ...Object.entries(p.attrs || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [attrName(k), Array.isArray(v) ? v.join(', ') : v]),
      ['Warna', p.color], ['Bahan', p.material], ['Berat', p.weight], ['Ukuran / kapasitas', p.dimension], ['Kelengkapan', p.includes]]
      .filter(([k, v]) => k && v)
      .filter(([k], i, arr) => !(k === 'Ukuran / kapasitas' && arr.some(([k2]) => /kapasitas/i.test(k2) && k2 !== k)));
    /* Fitur singkat: lewati yang sudah tercantum di tabel detail (mis. "Kapasitas 60 L") */
    const seen = rows.map(([, v]) => String(v).toLowerCase());
    const specs = (p.specs || []).filter((x) => !seen.some((v) => String(x).toLowerCase().includes(v))).slice(0, 4);
    const hasVar = DB.hasVariant(p);
    const list = hasVar ? p.variant.options.map((o) => ({ name: o.name, avail: o.stock })) : null;
    let size = hasVar ? firstAvailSize(list, null) : null;
    const inCart = (sz) => DB.cart().filter((c) => c.type === 'buy' && c.refId === p.id && (c.size || '') === (sz || '')).reduce((n, c) => n + c.qty, 0);
    const desc = String(p.desc || '').length > 170 ? String(p.desc).slice(0, 167).trim() + '…' : (p.desc || '');
    const m = modal({ title: 'Beli barang', size: 'md', body: `
      <div class="bm-top"><img src="${asset(p.img)}" alt="">
        <div><span class="pc-cat">${esc(cat)}</span><h3>${esc(p.name)}</h3>
          ${p.reviews ? `<div class="bm-rate">${stars(p.rating, false)} <span>${Number(p.rating).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${p.reviews} ulasan</span></div>` : ''}
          <div class="bm-price">${rupiah(p.price)}</div></div></div>
      ${desc ? `<p class="bm-desc">${esc(desc)} <a class="link" href="${url('produk?id=' + p.id + '&mode=beli')}">Detail lengkap</a></p>` : `<p class="bm-desc"><a class="link" href="${url('produk?id=' + p.id + '&mode=beli')}">Lihat detail lengkap</a></p>`}
      ${rows.length ? `<dl class="bm-spec">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${specs.length ? `<ul class="bm-feat">${specs.map((x) => `<li><i class="fa-solid fa-check"></i> ${esc(x)}</li>`).join('')}</ul>` : ''}
      ${hasVar ? `<div class="field" style="margin-top:12px"><label>${esc(p.variant.label || 'Ukuran')}</label><div id="bmSize"></div></div>` : ''}
      <div class="field" style="margin-top:12px"><label>Jumlah</label><div class="qty"><button type="button" data-q="-1" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button><input id="bmQty" type="number" value="1" min="1" aria-label="Jumlah"><button type="button" data-q="1" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button></div><span class="hint" id="bmStock"></span></div>
      <div class="bm-total"><span>Total</span><strong id="bmTotal">${rupiah(p.price)}</strong></div>`,
      foot: `<button class="btn btn-light" id="bmCart"><i class="fa-solid fa-cart-plus"></i> Tambah ke keranjang</button><button class="btn btn-primary" id="bmNow">Checkout sekarang <i class="fa-solid fa-arrow-right"></i></button>` });
    const q = m.$('#bmQty');
    const calc = () => {
      if (hasVar) m.$('#bmSize').innerHTML = sizePicker(p, list, size);
      const stock = DB.sizeStock(p, size) - inCart(size);
      const qty = Math.max(1, Math.min(parseInt(q.value, 10) || 1, Math.max(1, stock))); q.value = qty;
      const ok = (!hasVar || size) && stock >= qty && stock > 0;
      m.$('#bmStock').innerHTML = hasVar && !size ? 'Pilih ukuran dulu.' : stock > 0 ? `Stok tersedia ${stock} unit${inCart(size) ? ` (${inCart(size)} sudah di keranjang)` : ''}` : '<span style="color:var(--red)">Stok habis</span>';
      m.$('#bmTotal').textContent = rupiah(p.price * qty);
      m.$('#bmCart').disabled = m.$('#bmNow').disabled = !ok;
      return ok;
    };
    if (hasVar) m.$('#bmSize').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (b && !b.disabled) { size = b.dataset.size; q.value = 1; calc(); } });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; q.value = (parseInt(q.value, 10) || 1) + +b.dataset.q; calc(); });
    q.addEventListener('input', calc);
    const add = () => { if (!calc()) return false; Cart.add(Object.assign({ type: 'buy', kind: 'product', refId: p.id, qty: +q.value }, size ? { size } : {})); return true; };
    m.$('#bmCart').addEventListener('click', () => { if (add()) { m.close(); toast(`${esc(DB.variantName(p, size))} masuk ke keranjang belanja.`); } });
    m.$('#bmNow').addEventListener('click', () => { if (add()) location.href = url('checkout'); });
    calc();
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

  /* Kartu produk (dipakai di semua halaman). Ringkas: foto, kategori, nama, harga utama, satu baris info, tombol Lihat Detail.
     Pilihan durasi sewa / ukuran / jumlah ada di halaman detail produk. */
  function productCard(p, mode) {
    mode = mode || (p.rent ? 'rent' : 'buy');
    const href = url('produk?id=' + p.id + (mode === 'buy' ? '&mode=beli' : ''));
    /* Label: kiri atas = otomatis dari data (Terlaris / Hampir habis / Rating Tertinggi); kanan atas = pilihan admin (Baru / Premium / Rekomendasi / Promo) */
    const ab = DB.autoBadge(p, mode); const AB_IC = { terlaris: 'fa-fire', hampir: 'fa-hourglass-half', rating: 'fa-star', penuh: 'fa-ban' };
    const autoB = ab ? `<span class="pc-badge auto ${ab.key}" title="${esc(ab.title)}"><i class="fa-solid ${AB_IC[ab.key]}"></i> ${ab.label}</span>` : '';
    const badge = autoB + (p.badge ? `<span class="pc-badge adm ${String(p.badge).toLowerCase()}">${esc(p.badge)}</span>` : '');
    const cat = (DB.categories().find((c) => c.id === p.cat) || {}).name || '';
    const price = mode === 'buy' ? `<strong>${rupiah(p.price)}</strong>` : `<strong>${rupiah(p.rent)}</strong><small>/ malam</small>`;
    const info = DB.hasVariant(p) ? `<i class="fa-solid fa-ruler"></i> Ukuran ${esc(p.variant.options.map((o) => o.name.replace(/\s*\(.*\)/, '')).join(', '))}`
      : p.brand ? `<i class="fa-solid fa-tag"></i> ${esc(p.brand)}`
      : mode === 'buy' ? (p.rent ? '<i class="fa-solid fa-campground"></i> Bisa juga disewa' : '<i class="fa-solid fa-bag-shopping"></i> Barang jual')
      : (p.price ? '<i class="fa-solid fa-bag-shopping"></i> Bisa juga dibeli' : '');
    const rating = p.reviews
      ? `<div class="pc-stars">${stars(p.rating, false)}<span class="pc-rv">${p.rating.toLocaleString('id-ID', { maximumFractionDigits: 1 })} · ${p.reviews} ulasan</span></div>`
      : '<div class="pc-stars none"><span class="stars">' + '<i class="fa-regular fa-star"></i>'.repeat(5) + '</span><span class="pc-rv">Belum ada ulasan</span></div>';
    return `<article class="prod-card">
      <a class="ph" href="${href}" aria-label="Lihat ${esc(p.name)}"><img src="${asset(p.img)}" alt="${esc(p.name)}" loading="lazy">${badge}</a>
      <div class="bd">
        <div class="pc-top"><span class="pc-cat">${esc(cat)}</span></div>
        <h3><a href="${href}">${esc(p.name)}</a></h3>
        ${rating}
        <div class="pc-price">${price}</div>
        <div class="pc-info">${info || '&nbsp;'}</div>
        <div class="acts">
          <button class="btn btn-light pc-cart" type="button" data-qcart="${p.id}" data-qmode="${mode}" aria-label="Tambah ${esc(p.name)} ke keranjang" title="Tambah ke keranjang"><i class="fa-solid fa-cart-plus"></i></button>
          <button class="btn btn-primary" type="button" ${mode === 'buy' ? `data-buy="${p.id}"` : `data-rent="${p.id}"`}>${mode === 'buy' ? 'Beli' : 'Sewa'}<span class="pc-long">&nbsp;Sekarang</span></button>
        </div>
        <a class="pc-detail" href="${href}">Lihat detail <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </article>`;
  }
  function bindProductActions(root) {
    /* Cegah pemasangan ganda: halaman yang menggambar ulang daftar (mis. paket) memanggil ini berkali-kali */
    if (!root || root.dataset.actionsBound) return; root.dataset.actionsBound = '1';
    root.addEventListener('click', (e) => {
      /* Ikon keranjang: barang tanpa ukuran langsung masuk keranjang (tanggal trip / 1 malam); yang punya ukuran membuka pilihan dulu */
      const qc = e.target.closest('[data-qcart]');
      if (qc) {
        e.preventDefault(); const p = DB.product(qc.dataset.qcart); if (!p) return;
        if (qc.dataset.qmode === 'buy') { quickBuy(p.id); return; }
        if (DB.hasVariant(p) || (p.minDays || 1) > 1) { quickRent('product', p.id); return; }
        const t = tripDefault();
        if (Rules.available(p.id, t.start, t.end) < 1) { toast(`${esc(p.name)} penuh untuk ${D.fmtRange(t.start, t.end)}. Pilih tanggal lain.`, 'err'); quickRent('product', p.id); return; }
        Cart.add({ type: 'rent', kind: 'product', refId: p.id, qty: 1, start: t.start, end: t.end });
        toast(`${esc(p.name)} masuk keranjang (${D.fmtRange(t.start, t.end)}). Tanggal & ukuran bisa diubah di keranjang.`);
        return;
      }
      const r = e.target.closest('[data-rent]'); if (r) { e.preventDefault(); quickRent('product', r.dataset.rent); return; }
      const b = e.target.closest('[data-buy]'); if (b) { e.preventDefault(); buyModal(b.dataset.buy); return; }
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

  /* ====================== Potong foto saat upload (zoom, geser, crop) ======================
     cropImage(file, { aspect: 1, size: 800 }) → Promise<dataURL | null>
     - geser foto dengan drag (mouse / sentuh), zoom dengan slider, scroll mouse, atau tombol +/−
     - "Pas semua": seluruh foto masuk bingkai, sisa ruang diisi warna latar
     - "Putar": memutar 90°. Hasil: JPEG berukuran tetap sehingga semua foto produk seragam. */
  function cropImage(file, opts = {}) {
    const aspect = opts.aspect || 1, outW = opts.size || 800, outH = Math.round(outW / aspect), BG = opts.bg || '#f4f1ea';
    return new Promise((resolve) => {
      const rd = new FileReader();
      rd.onerror = () => resolve(null);
      rd.onload = () => {
        const src = new Image();
        src.onerror = () => { toast('File bukan gambar yang valid.', 'err'); resolve(null); };
        src.onload = () => {
          let done = false;
          const m = modal({ title: opts.title || 'Atur foto', size: 'md', body: `
            <p class="muted" style="font-size:13px;margin:-4px 0 10px">Geser foto untuk mengatur posisi, lalu atur zoom. Area di dalam bingkai yang akan disimpan.</p>
            <div class="crop-stage"><canvas id="crCv"></canvas><div class="crop-grid"></div></div>
            <div class="crop-ctrl">
              <button type="button" class="icon-btn" id="crOut" aria-label="Perkecil"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
              <input type="range" id="crZoom" min="0" max="1000" value="0" aria-label="Zoom">
              <button type="button" class="icon-btn" id="crIn" aria-label="Perbesar"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
            </div>
            <div class="crop-acts">
              <button type="button" class="btn btn-light btn-sm" id="crFit"><i class="fa-solid fa-expand"></i> Pas semua</button>
              <button type="button" class="btn btn-light btn-sm" id="crFill"><i class="fa-solid fa-crop-simple"></i> Penuhi bingkai</button>
              <button type="button" class="btn btn-light btn-sm" id="crRot"><i class="fa-solid fa-rotate-right"></i> Putar</button>
            </div>`,
            foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="crOk"><i class="fa-solid fa-check"></i> Pakai foto ini</button>' });
          const cv = m.$('#crCv'), ctx = cv.getContext('2d');
          const stage = m.$('.crop-stage');
          const VW = Math.min(440, (stage.clientWidth || 440)), VH = Math.round(VW / aspect), DPR = window.devicePixelRatio || 1;
          stage.style.width = VW + 'px'; stage.style.height = VH + 'px';
          cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
          let rot = 0, scale = 1, x = 0, y = 0, minS = 1, maxS = 4;
          const dims = () => (rot % 180 ? { w: src.height, h: src.width } : { w: src.width, h: src.height });
          const limits = () => { const d = dims(); const fit = Math.min(VW / d.w, VH / d.h), fill = Math.max(VW / d.w, VH / d.h); minS = fit; maxS = fill * 4; };
          const clampPos = () => { const d = dims(), w = d.w * scale, h = d.h * scale;
            x = w >= VW ? Math.min(0, Math.max(VW - w, x)) : (VW - w) / 2; y = h >= VH ? Math.min(0, Math.max(VH - h, y)) : (VH - h) / 2; };
          const zoomTo = (ns, cx = VW / 2, cy = VH / 2) => { ns = Math.min(maxS, Math.max(minS, ns)); x = cx - (cx - x) * (ns / scale); y = cy - (cy - y) * (ns / scale); scale = ns; clampPos(); syncSlider(); draw(); };
          const syncSlider = () => { m.$('#crZoom').value = Math.round(1000 * Math.log(scale / minS) / Math.log(maxS / minS || 2)); };
          const paint = (c, W, H, k) => {
            c.save(); c.fillStyle = BG; c.fillRect(0, 0, W, H);
            const d = dims(); c.translate(x * k, y * k); c.scale(scale * k, scale * k);
            c.translate(d.w / 2, d.h / 2); c.rotate(rot * Math.PI / 180); c.drawImage(src, -src.width / 2, -src.height / 2); c.restore();
          };
          const draw = () => paint(ctx, cv.width, cv.height, DPR);
          const fill = () => { limits(); const d = dims(); scale = Math.max(VW / d.w, VH / d.h); x = (VW - d.w * scale) / 2; y = (VH - d.h * scale) / 2; clampPos(); syncSlider(); draw(); };
          const fit = () => { limits(); const d = dims(); scale = minS; x = (VW - d.w * scale) / 2; y = (VH - d.h * scale) / 2; syncSlider(); draw(); };
          fill();
          m.$('#crZoom').addEventListener('input', (e) => zoomTo(minS * Math.pow(maxS / minS, e.target.value / 1000)));
          m.$('#crIn').addEventListener('click', () => zoomTo(scale * 1.15));
          m.$('#crOut').addEventListener('click', () => zoomTo(scale / 1.15));
          m.$('#crFit').addEventListener('click', fit);
          m.$('#crFill').addEventListener('click', fill);
          m.$('#crRot').addEventListener('click', () => { rot = (rot + 90) % 360; fill(); });
          cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomTo(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
          let drag = null;
          cv.addEventListener('pointerdown', (e) => { drag = { px: e.clientX, py: e.clientY, x, y }; cv.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
          cv.addEventListener('pointermove', (e) => { if (!drag) return; x = drag.x + (e.clientX - drag.px); y = drag.y + (e.clientY - drag.py); clampPos(); draw(); });
          const end = () => { drag = null; stage.classList.remove('dragging'); };
          cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
          cv.style.touchAction = 'none';
          m.$('#crOk').addEventListener('click', () => {
            const out = document.createElement('canvas'); out.width = outW; out.height = outH;
            paint(out.getContext('2d'), outW, outH, outW / VW);
            done = true; resolve(out.toDataURL('image/jpeg', 0.88)); m.close();
          });
          const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(null); } });
          obs.observe(document.body, { childList: true });
        };
        src.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

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

  /* opts.onePage (default true): seluruh isi dimuat dalam SATU halaman A4 (diperkecil proporsional bila terlalu panjang),
     supaya nota tidak terpotong ke beberapa halaman dan tidak perlu digulir. */
  async function elementToPDF(el, filename, opts = {}) {
    await loadScript(vendor('html2canvas.min.js')); await loadScript(vendor('jspdf.umd.min.js'));
    el.classList.add('pdf-render');
    let canvas; try { canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 820 }); } finally { el.classList.remove('pdf-render'); }
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 10;
    let iw = W - 2 * m, ih = canvas.height * iw / canvas.width;
    const img = canvas.toDataURL('image/jpeg', 0.92);
    if (opts.onePage !== false) {
      if (ih > H - 2 * m) { const k = (H - 2 * m) / ih; iw *= k; ih = H - 2 * m; }
      doc.addImage(img, 'JPEG', (W - iw) / 2, m, iw, ih);
    } else {
      let left = ih, pos = m; doc.addImage(img, 'JPEG', m, pos, iw, ih); left -= (H - 2 * m);
      while (left > 0) { pos -= (H - 2 * m); doc.addPage(); doc.addImage(img, 'JPEG', m, pos, iw, ih); left -= (H - 2 * m); }
    }
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

  /* ---------- Tanggal trip: dipilih sekali, dipakai di katalog, produk, keranjang ---------- */
  const tripText = (t) => `${D.fmtRange(t.start, t.end)} · ${Rules.rentalDays(t.start, t.end)} malam`;
  function tripBar(el, onChange) {
    const draw = () => {
      const t = DB.trip();
      el.innerHTML = `<div class="trip-bar ${t ? 'set' : ''}"><span class="tb-ic"><i class="fa-regular fa-calendar-check"></i></span>
        <div class="tb-t"><strong>${t ? 'Tanggal sewamu' : 'Kapan mau sewa?'}</strong><small>${t ? `${tripText(t)} — stok di bawah sudah sesuai tanggal ini` : 'Pilih tanggal sekali, stok semua alat langsung menyesuaikan.'}</small></div>
        <div class="tb-in"><label>Ambil<input type="date" class="input" data-ts value="${t ? t.start : ''}" min="${D.today()}"></label><label>Kembali<input type="date" class="input" data-te value="${t ? t.end : ''}" min="${t ? D.addDays(t.start, 1) : D.addDays(D.today(), 1)}"></label>${t ? '<button type="button" class="btn btn-ghost btn-sm" data-tclear title="Hapus tanggal"><i class="fa-solid fa-xmark"></i></button>' : ''}</div></div>`;
      const s0 = el.querySelector('[data-ts]'), e0 = el.querySelector('[data-te]');
      /* Simpan tanpa menggambar ulang kotak (agar kalender yang sedang dibuka tidak tertutup) */
      let prevStart = s0.value;
      const save = () => {
        if (!s0.value || !e0.value || e0.value <= s0.value) return;
        DB.setTrip(s0.value, e0.value);
        const bar = el.querySelector('.trip-bar'); bar.classList.add('set');
        bar.querySelector('.tb-t strong').textContent = 'Tanggal sewamu';
        bar.querySelector('.tb-t small').textContent = `${tripText(DB.trip())} — stok di bawah sudah sesuai tanggal ini`;
        if (!el.querySelector('[data-tclear]')) { el.querySelector('.tb-in').insertAdjacentHTML('afterend', '<button type="button" class="btn btn-ghost btn-sm" data-tclear title="Hapus tanggal"><i class="fa-solid fa-xmark"></i></button>'); el.querySelector('[data-tclear]').addEventListener('click', () => { DB.setTrip(null); draw(); onChange && onChange(); }); }
        onChange && onChange();
      };
      s0.addEventListener('change', () => { shiftEnd(s0, e0, prevStart); prevStart = s0.value; save(); });
      e0.addEventListener('change', save);
      const c = el.querySelector('[data-tclear]'); if (c) c.addEventListener('click', () => { DB.setTrip(null); draw(); onChange && onChange(); });
    };
    draw();
  }
  function tripModal(onDone) {
    const t = DB.trip() || { start: D.rel(1), end: D.rel(2) };
    const m = modal({ title: 'Pilih tanggal sewa', body: `<p class="muted" style="font-size:13.5px;margin-bottom:12px">Cukup pilih sekali. Stok di katalog, halaman produk, dan keranjang otomatis mengikuti tanggal ini.</p>
      <div class="grid-2"><div class="field"><label>Tanggal ambil</label><input type="date" class="input" id="tmS" value="${t.start}" min="${D.today()}"></div><div class="field"><label>Tanggal kembali</label><input type="date" class="input" id="tmE" value="${t.end}"></div></div><div id="tmDur"></div><p class="muted" id="tmInfo" style="font-size:13px"></p>`,
      foot: `${DB.trip() ? '<button class="btn btn-ghost" id="tmClear">Hapus tanggal</button>' : ''}<button class="btn btn-primary" id="tmOk"><i class="fa-solid fa-check"></i> Pakai tanggal ini</button>` });
    const S0 = m.$('#tmS'), E0 = m.$('#tmE');
    const info = () => { if (E0.value <= S0.value) E0.value = D.addDays(S0.value, 1); E0.min = D.addDays(S0.value, 1); m.$('#tmInfo').textContent = `${Rules.rentalDays(S0.value, E0.value)} malam sewa · ambil ${D.fmtDate(S0.value, true)}, kembali ${D.fmtDate(E0.value, true)} paling lambat pukul ${String(DB.settings().returnTime || '22:00').replace(':', '.')} WIB`; };
    S0.addEventListener('change', info); E0.addEventListener('change', info); info();
    m.$('#tmDur').appendChild(durationChips(S0, E0, info));
    m.$('#tmOk').addEventListener('click', () => { DB.setTrip(S0.value, E0.value); m.close(); toast(`Tanggal sewa: ${D.fmtRange(S0.value, E0.value)}`); onDone && onDone(); });
    const c = m.$('#tmClear'); if (c) c.addEventListener('click', () => { DB.setTrip(null); m.close(); onDone && onDone(); });
  }
  const tripDefault = () => DB.trip() || { start: D.rel(1), end: D.rel(2) };

  /* ---------- Pelacak status pesanan (seperti lacak paket) ---------- */
  /* ---------- Hitung mundur per detik ----------
     <span class="cd" data-deadline="ISO" data-expire="pay|return"></span>
     Warna: normal → kuning (≤30 menit) → merah (≤10 menit). Batas bayar habis → pesanan dibatalkan otomatis & halaman diperbarui. */
  const pad2 = (n) => String(n).padStart(2, '0');
  function cdText(ms) {
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${d ? d + ' hari ' : ''}${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  }
  const cdSpan = (iso, kind) => { setTimeout(cdTick, 0); return `<span class="cd" data-deadline="${iso}" data-expire="${kind || ''}">${cdText(new Date(iso) - Date.now())}</span>`; };
  /* Batas pengembalian: tanggal kembali pukul jam batas (mis. 22.00) */
  const returnDeadline = (b) => new Date(`${b.end}T${(DB.settings().returnTime || '22:00')}:00`);
  let cdReloading = false;
  function cdTick() {
    document.querySelectorAll('.cd[data-deadline]').forEach((el) => {
      const left = new Date(el.dataset.deadline) - Date.now();
      el.textContent = cdText(left);
      el.classList.toggle('warn', left > 0 && left <= 30 * 60e3 && left > 10 * 60e3);
      el.classList.toggle('crit', left > 0 && left <= 10 * 60e3);
      el.classList.toggle('over', left <= 0);
      if (left <= 0 && el.dataset.expire === 'pay' && !cdReloading) {
        cdReloading = true; el.textContent = 'Waktu habis';
        let n = 0; try { n = DB.expireUnpaid(); } catch (e) { /* abaikan */ }
        if (n) { toast('Batas waktu pembayaran habis. Pesanan dibatalkan otomatis.', 'err'); setTimeout(() => location.reload(), 1500); }
      }
    });
  }
  setInterval(cdTick, 1000);

  function orderTracker(x, opts) {
    opts = opts || {}; const st = DB.settings(); const rent = !!x.start;
    const steps = rent ? ['Booking dibuat', 'DP diverifikasi', 'Siap diambil', 'Sedang disewa', 'Selesai'] : ['Pesanan dibuat', 'Pembayaran diverifikasi', 'Dikemas', 'Siap diambil', 'Selesai'];
    const idx = rent ? { menunggu_pembayaran: 0, menunggu_konfirmasi: 1, dikonfirmasi: 2, disewa: 3, selesai: 5 }[x.status] : (x.paymentStatus === 'verifying' && ['menunggu_pembayaran', 'diproses'].includes(x.status) ? 1 : { menunggu_pembayaran: 0, diproses: 2, dikemas: 2, siap_diambil: 3, selesai: 5 }[x.status]);
    const late = rent && x.status === 'disewa' && D.today() > x.end;
    const sisa = rent ? Math.max(0, x.total - Rules.paidTotal(x)) : 0;
    const link = (h, t) => (opts.links === false ? '' : ` <a class="link" href="${url(h)}">${t}</a>`);
    let todo = '';
    if (x.status === 'dibatalkan') todo = `<i class="fa-solid fa-ban"></i> Pesanan dibatalkan.${x.cancel && x.cancel.refundable ? ' DP dikembalikan ke rekeningmu.' : ''}`;
    else if (rent) todo = {
      menunggu_pembayaran: `<i class="fa-solid fa-wallet"></i> <b>Yang perlu kamu lakukan:</b> bayar DP ${rupiah(x.dp)} dalam ${cdSpan(DB.payDeadline(x).toISOString(), 'pay')} lalu unggah bukti transfer.${link('pembayaran?ids=' + x.id, 'Bayar sekarang')}`,
      menunggu_konfirmasi: `<i class="fa-solid fa-hourglass-half"></i> Bukti pembayaranmu sedang dicek admin, maksimal 1×24 jam. Kamu akan dapat notifikasi.`,
      dikonfirmasi: `<i class="fa-solid fa-store"></i> <b>Ambil barang ${D.fmtDate(x.start, true)}</b> di toko (${esc(st.hours)}). Bawa kartu identitas asli & tunjukkan nota.${sisa ? ` Sisa bayar ${rupiah(sisa)} dilunasi saat ambil.` : ''}${link('invoice?id=' + x.id, 'Lihat nota')}`,
      disewa: late ? `<i class="fa-solid fa-triangle-exclamation"></i> <b>Terlambat ${billOf(x).late || D.diffDays(x.end, D.today())} malam · denda berjalan ${rupiah(billOf(x).fine)}.</b> Segera kembalikan ke toko agar denda tidak bertambah.${link('invoice?id=' + x.id, 'Lihat tagihan')}` : `<i class="fa-solid fa-person-hiking"></i> Selamat bertualang! <b>Kembalikan paling lambat ${D.fmtDate(x.end, true)}${st.lateAfterReturnTime ? `, pukul ${esc(String(st.returnTime).replace(':', '.'))} WIB` : ''}</b> · sisa waktu ${cdSpan(returnDeadline(x).toISOString(), 'return')}. Butuh lebih lama? Ajukan perpanjangan.`,
      selesai: `<i class="fa-solid fa-circle-check"></i> Sewa selesai. Terima kasih! Bagikan pengalamanmu lewat ulasan.`,
    }[x.status] || '';
    else todo = {
      menunggu_pembayaran: `<i class="fa-solid fa-wallet"></i> <b>Yang perlu kamu lakukan:</b> bayar ${rupiah(x.total)} dalam ${cdSpan(DB.payDeadline(x).toISOString(), 'pay')} lalu unggah bukti.${link('pembayaran?ids=' + x.id, 'Bayar sekarang')}`,
      diproses: x.paymentStatus === 'verifying' ? '<i class="fa-solid fa-hourglass-half"></i> Bukti pembayaranmu sedang dicek admin. Kamu akan dapat notifikasi setelah diverifikasi.' : '<i class="fa-solid fa-box"></i> Pembayaran diterima, pesananmu sedang disiapkan.',
      dikemas: '<i class="fa-solid fa-box"></i> Pesananmu sedang dikemas.',
      siap_diambil: `<i class="fa-solid fa-store"></i> <b>Pesanan siap diambil</b> di toko (${esc(st.hours)}). Tunjukkan nota digital.`,
      selesai: '<i class="fa-solid fa-circle-check"></i> Pesanan selesai. Terima kasih sudah berbelanja!',
    }[x.status] || '';
    const cancelled = x.status === 'dibatalkan';
    return `<div class="trk ${cancelled ? 'cancel' : ''} ${late ? 'late' : ''}">${cancelled ? '' : `<ol class="trk-steps">${steps.map((t, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"><span>${i < idx ? '<i class="fa-solid fa-check"></i>' : i + 1}</span><small>${t}</small></li>`).join('')}</ol>`}
      ${todo ? `<div class="trk-todo">${todo}</div>` : ''}</div>`;
  }

  /* ---------- Notifikasi (dropdown ringkas + pusat notifikasi) ---------- */
  const NCAT = [
    ['kembali', 'Pengembalian', /kembali|terlambat|pengingat/i, 'fa-rotate-left', 'teal'],
    ['bayar', 'Pembayaran', /dp|bayar|pembayaran|refund|lunas/i, 'fa-wallet', 'green'],
    ['ganti', 'Ganti & perpanjang', /ganti|perpanj/i, 'fa-arrows-rotate', 'blue'],
    ['stok', 'Stok & perawatan', /stok|perawatan|servis/i, 'fa-screwdriver-wrench', 'amber'],
    ['ulasan', 'Ulasan', /ulasan/i, 'fa-star', 'amber'],
    ['lain', 'Lainnya', /./, 'fa-bell', 'gray'],
  ];
  const nCat = (n) => NCAT.find((c) => c[2].test(n.title + ' ' + n.text)) || NCAT[NCAT.length - 1];
  const nDay = (iso) => { const d = D.day(iso), t = D.today(); return d === t ? 'Hari ini' : d === D.addDays(t, -1) ? 'Kemarin' : D.fmtDate(d, true); };
  const nItem = (n) => { const c = nCat(n); return `<a class="nx ${n.read ? '' : 'unread'}" href="${n.link ? url(n.link) : '#'}" data-nx="${n.id}"><span class="nx-ic ${c[4]}"><i class="fa-solid ${c[3]}"></i></span><span class="nx-bd"><strong>${esc(n.title)}${n.count > 1 ? ` <em>${n.count}×</em>` : ''}</strong><span>${esc(NOTXT(n.text))}</span><small>${D.fmtDateTime(n.at)}</small></span></a>`; };
  const nGrouped = (list) => { let last = ''; return list.map((n) => { const g = nDay(n.at); const h = g !== last ? `<div class="nx-day">${g}</div>` : ''; last = g; return h + nItem(n); }).join(''); };
  function notifMenu(box, email, onChange, tab) {
    tab = tab || 'unread';
    const all = DB.notifications(email); const unread = all.filter((n) => !n.read);
    const L = (tab === 'unread' ? unread : all).slice(0, 6);
    box.innerHTML = `<div class="nx-head"><strong>Notifikasi</strong>${unread.length ? '<button type="button" class="btn btn-ghost btn-xs" data-nread>Tandai semua dibaca</button>' : ''}</div>
      <div class="nx-tabs"><button type="button" data-ntab="unread" class="${tab === 'unread' ? 'on' : ''}">Belum dibaca <b>${unread.length}</b></button><button type="button" data-ntab="all" class="${tab === 'all' ? 'on' : ''}">Semua <b>${all.length}</b></button></div>
      <div class="nx-list">${L.length ? nGrouped(L) : `<div class="nx-empty"><i class="fa-regular fa-bell-slash"></i>${tab === 'unread' ? 'Tidak ada notifikasi baru.' : 'Belum ada notifikasi.'}</div>`}</div>
      <button type="button" class="nx-more" data-nall>Lihat semua notifikasi${all.length > L.length ? ` (${all.length})` : ''} <i class="fa-solid fa-arrow-right"></i></button>`;
    box.onclick = (e) => {
      const t = e.target.closest('[data-ntab]'); if (t) { e.stopPropagation(); notifMenu(box, email, onChange, t.dataset.ntab); return; }
      if (e.target.closest('[data-nread]')) { e.stopPropagation(); DB.markRead(email); onChange && onChange(); toast('Semua notifikasi ditandai dibaca.'); return; }
      if (e.target.closest('[data-nall]')) { e.stopPropagation(); box.closest('.dropdown') && box.closest('.dropdown').classList.remove('open'); notifCenter(email, onChange); return; }
      const a = e.target.closest('[data-nx]'); if (a) DB.markRead(email, a.dataset.nx);
    };
  }
  function notifCenter(email, onChange) {
    const st = { tab: 'all', cat: '', q: '', n: 20 };
    const m = modal({ title: 'Semua notifikasi', size: 'lg', body: `<div class="nx-tools"><div class="nx-tabs"><button type="button" data-ct="all" class="on">Semua</button><button type="button" data-ct="unread">Belum dibaca</button></div>
      <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="nxQ" placeholder="Cari notifikasi…"></div></div><div class="nx-cats" id="nxCats"></div><div class="nx-list full" id="nxList"></div>`,
      foot: '<button class="btn btn-light" id="nxClear"><i class="fa-regular fa-trash-can"></i> Bersihkan yang sudah dibaca</button><button class="btn btn-light" id="nxRead">Tandai semua dibaca</button><button class="btn btn-primary" data-close>Tutup</button>' });
    const draw = () => {
      const all = DB.notifications(email);
      const base = all.filter((n) => (st.tab === 'all' || !n.read) && (!st.q || (n.title + ' ' + NOTXT(n.text)).toLowerCase().includes(st.q)));
      m.$('#nxCats').innerHTML = [['', 'Semua kategori', base.length], ...NCAT.map((c) => [c[0], c[1], base.filter((n) => nCat(n)[0] === c[0]).length]).filter((c) => c[2])].map(([k, l, c]) => `<button type="button" data-cc="${k}" class="${st.cat === k ? 'on' : ''}">${l} <b>${c}</b></button>`).join('');
      const L = base.filter((n) => !st.cat || nCat(n)[0] === st.cat);
      m.$('#nxList').innerHTML = (L.length ? nGrouped(L.slice(0, st.n)) : '<div class="nx-empty"><i class="fa-regular fa-bell-slash"></i>Tidak ada notifikasi.</div>') + (L.length > st.n ? `<button type="button" class="nx-more" data-nmore>Muat ${Math.min(20, L.length - st.n)} lagi</button>` : '');
    };
    m.$('.nx-tools').addEventListener('click', (e) => { const b = e.target.closest('[data-ct]'); if (!b) return; st.tab = b.dataset.ct; m.$$('[data-ct]').forEach((x) => x.classList.toggle('on', x === b)); draw(); });
    m.$('#nxQ').addEventListener('input', () => { st.q = m.$('#nxQ').value.trim().toLowerCase(); st.n = 20; draw(); });
    m.$('#nxCats').addEventListener('click', (e) => { const b = e.target.closest('[data-cc]'); if (b) { st.cat = b.dataset.cc; st.n = 20; draw(); } });
    m.$('#nxList').addEventListener('click', (e) => { if (e.target.closest('[data-nmore]')) { st.n += 20; draw(); return; } const a = e.target.closest('[data-nx]'); if (a) DB.markRead(email, a.dataset.nx); });
    m.$('#nxRead').addEventListener('click', () => { DB.markRead(email); draw(); onChange && onChange(); });
    m.$('#nxClear').addEventListener('click', () => { DB.clearRead(email); draw(); onChange && onChange(); toast('Notifikasi yang sudah dibaca dibersihkan.'); });
    draw();
  }

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
    const m = modal({ title: `${staff ? 'Catat ganti barang' : 'Ganti barang'} · ${NO(b)}`, size: 'xl', body: `
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
      m.$('#cgLines').innerHTML = lines.map(({ it, i }) => `<button type="button" class="chg-line ${i === st.li ? 'on' : ''}" data-li="${i}"><img src="${asset(it.img)}" alt=""><span><b>${esc(it.name)}</b><small>${it.qty} unit · ${rupiah(Rules.lineUnit(it, b.days))} / ${b.days} malam</small></span><i class="fa-solid fa-circle-check"></i></button>`).join('');
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
        const on = st.pid === p.id; const ta = totalAvail(p); const pu = Rules.tierPlan(Rules.productTiers(p), b.days).total; const d = (pu - Rules.lineUnit(line, b.days));
        const sizes = on && DB.hasVariant(p) ? Rules.sizeAvailability(p.id, b.start, b.end, b.id) : null;
        return `<article class="pick-card ${on ? 'on' : ''} ${ta < st.qty ? 'low' : ''}" data-pid="${p.id}">
          <div class="pc-ph"><img src="${asset(p.img)}" alt="" loading="lazy">${on ? '<span class="pc-check"><i class="fa-solid fa-check"></i></span>' : ''}</div>
          <div class="pc-bd"><b>${esc(p.name)}</b><div class="pc-price">${rupiah(pu)} <small>/ ${b.days} malam</small></div>
            <div class="pc-meta"><span class="${ta >= st.qty ? 'ok' : 'no'}">${ta >= st.qty ? `${ta} tersedia` : ta ? `sisa ${ta}` : 'Penuh'}</span><span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${rupiah(Math.abs(d))}</span></div>
            ${DB.hasVariant(p) ? (sizes ? `<div class="pc-sizes">${sizes.filter((o) => !(p.id === line.refId && o.name === line.size)).map((o) => `<button type="button" data-psize="${esc(o.name)}" class="${st.size === o.name ? 'on' : ''}" ${o.avail >= st.qty ? '' : 'disabled'}>${esc(short(o.name))}<small>${o.avail}</small></button>`).join('')}</div>` : `<div class="size-hint"><i class="fa-solid fa-ruler"></i> ${esc(p.variant.options.map((o) => short(o.name)).join(' · '))}</div>`) : ''}
          </div></article>`;
      }).join('') : '<p class="muted" style="grid-column:1/-1;text-align:center;padding:24px">Tidak ada barang yang cocok.</p>';
      drawSum();
    }
    function calc() {
      const line = b.items[st.li]; const p = st.pid && DB.product(st.pid);
      if (!p) return null;
      if (DB.hasVariant(p) && !st.size) return { p, needSize: true };
      const a = avail(p, st.size); const diff = (Rules.tierPlan(Rules.productTiers(p), b.days).total - Rules.lineUnit(line, b.days)) * st.qty;
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
        <div class="kv"><span>Selisih (${st.qty} unit · ${esc(Rules.tierLabel(Rules.productTiers(r.p), b.days))})</span><span style="color:${r.diff > 0 ? '#9a6508' : r.diff < 0 ? 'var(--g700)' : 'inherit'}">${r.diff > 0 ? '+ ' : r.diff < 0 ? '− ' : ''}${rupiah(Math.abs(r.diff))}</span></div>
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
      const nameW = [...words(p.name), ...words(p.brand || '')], catW = words((cats.find((c) => c.id === p.cat) || {}).name);
      if (!tokens.every((t) => hit(nameW, t) || hit(catW, t))) return null;
      const n = norm(p.name);
      const score = (n === q ? 400 : 0) + (n.startsWith(q) ? 200 : 0) + tokens.reduce((a, t) => a + (hit(nameW, t) ? 50 : 10), 0);
      return { p, score };
    }).filter(Boolean);
    if (scored.length) return { list: scored.sort((a, b) => b.score - a.score).map((x) => x.p), mode: 'name' };
    const related = list.filter((p) => { const ws = words([p.desc, ...(p.specs || [])].join(' ')); return tokens.every((t) => hit(ws, t)); });
    return { list: related, mode: related.length ? 'related' : 'none' };
  }

  /* ====================== Hubungi admin via WhatsApp + nota digital ======================
     Jika user login dan punya pesanan aktif (sudah DP / dibeli / sedang disewa), setiap tombol WhatsApp di website
     membuka jendela ini dulu: nota digital ikut dikirim, lalu pesan user di bawahnya.
     - HP: gambar nota + pesan dibagikan langsung lewat menu "Bagikan" (pilih WhatsApp, lalu chat admin).
     - Laptop / browser lama: WhatsApp admin terbuka dengan ringkasan nota + link nota, gambar nota otomatis diunduh.
     Catatan: link wa.me dari website hanya bisa membawa teks (aturan WhatsApp), jadi gambar tidak bisa ditempel otomatis. */
  const ACTIVE_RENT = ['menunggu_konfirmasi', 'dikonfirmasi', 'disewa'];
  function activeOrders(user) {
    user = user || DB.session(); if (!user || !user.email) return [];
    const em = String(user.email).toLowerCase();
    const mine = (x) => x.customer && String(x.customer.email || '').toLowerCase() === em;
    const rent = DB.bookings().filter((b) => mine(b) && (ACTIVE_RENT.includes(b.status) || (b.status === 'menunggu_pembayaran' && b.paymentStatus !== 'unpaid')) && !['refunded', 'forfeited'].includes(b.paymentStatus))
      .map((b) => ({ kind: 'rent', x: b }));
    const buy = DB.sales().filter((x) => mine(x) && !['selesai', 'dibatalkan'].includes(x.status)).map((x) => ({ kind: 'buy', x }));
    return [...rent, ...buy].sort((a, b) => String(b.x.createdAt).localeCompare(String(a.x.createdAt)));
  }
  const paidOf = (x) => (x.payments || []).reduce((s, p) => s + (+p.amount || 0), 0) - (x.refunds || []).reduce((s, p) => s + (+p.amount || 0), 0);
  const stLabel = (g, k) => ((STATUS[g] || {})[k] || { label: k }).label;
  const notaUrl = (x) => new URL(url('invoice?id=' + x.id), location.href).href;
  function notaText(o) {
    const x = o.x, rent = o.kind === 'rent';
    const items = x.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
    const paid = paidOf(x), sisa = Math.max(0, x.total - paid);
    return [`*${rent ? 'Nota Sewa' : 'Nota Pembelian'} #${NO(x)}*`,
      rent ? `Tanggal: ${D.fmtRange(x.start, x.end)} (${x.days} malam), ambil & kembali di toko` : null,
      `Barang: ${items}`,
      ...(rent ? (x.changes || []).filter((c) => c.status !== 'ditolak').map((c) => `Ganti barang: ${c.fromName} → ${c.toName} (${(+c.diff || 0) >= 0 ? '+' : '−'}${rupiah(Math.abs(+c.diff || 0))}${c.status === 'menunggu' ? ', menunggu persetujuan' : ''})`) : []),
      `Total: ${rupiah(x.total)} · Dibayar: ${rupiah(paid)}${rent && x.paymentStatus === 'dp_paid' ? ' (DP)' : ''}${sisa ? ` · Sisa: ${rupiah(sisa)}` : ''}`,
      `Status: ${stLabel(rent ? 'rental' : 'sale', x.status)} · ${stLabel('payment', x.paymentStatus)}`,
      `Lihat nota: ${notaUrl(x)}`].filter(Boolean).join('\n');
  }
  /* Gambar nota digital (PNG) untuk satu atau beberapa pesanan */
  /* list: [{ kind, x, extra?: [{ l, r, color, bold, head }] }] — extra = baris tambahan (perubahan barang, denda) */
  function notaCanvas(list) {
    const st = DB.settings(), W = 720, S = 2, pad = 36;
    const blocks = list.map((o) => ({ o, h: 112 + o.x.items.length * 26 + 92 + (o.extra || []).length * 26 - ((o.extra || []).length ? 14 : 0) }));
    const H = 128 + blocks.reduce((s, b) => s + b.h + 18, 0) + 44;
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d'); c.scale(S, S);
    const font = (w, sz) => `${w} ${sz}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1f4d2f'; c.fillRect(0, 0, W, 104);
    c.fillStyle = '#fff'; c.font = font(800, 24); c.fillText(st.storeName || 'Annapurna Adventure', pad, 46);
    c.font = font(500, 13); c.fillStyle = '#d7e6d9'; c.fillText(`${st.address || ''}`.slice(0, 92), pad, 70); c.fillText(`WhatsApp ${st.phone || ''} · ${st.instagram || ''}`, pad, 90);
    c.textAlign = 'right'; c.fillStyle = '#f3d68b'; c.font = font(800, 15); c.fillText('NOTA DIGITAL', W - pad, 46); c.textAlign = 'left';
    let y = 128;
    const row = (l, r, bold, color) => { c.font = font(bold ? 700 : 500, 14); c.fillStyle = color || '#2a3a2f'; c.fillText(l, pad + 20, y); c.textAlign = 'right'; c.fillText(r, W - pad - 20, y); c.textAlign = 'left'; y += 26; };
    blocks.forEach(({ o, h }) => {
      const x = o.x, rent = o.kind === 'rent', top = y - 4;
      c.fillStyle = '#fff'; c.strokeStyle = '#e3dccd'; c.lineWidth = 1;
      if (c.roundRect) { c.beginPath(); c.roundRect(pad, top, W - pad * 2, h, 14); c.fill(); c.stroke(); } else { c.fillRect(pad, top, W - pad * 2, h); c.strokeRect(pad, top, W - pad * 2, h); }
      y = top + 34;
      c.font = font(800, 18); c.fillStyle = '#15311f'; c.fillText(`${rent ? 'Sewa' : 'Pembelian'} #${NO(x)}`, pad + 20, y);
      c.textAlign = 'right'; c.font = font(700, 12.5); c.fillStyle = '#2f6b43'; c.fillText(`${stLabel(rent ? 'rental' : 'sale', x.status)} · ${stLabel('payment', x.paymentStatus)}`, W - pad - 20, y); c.textAlign = 'left';
      y += 24; c.font = font(500, 13); c.fillStyle = '#6b7a70';
      c.fillText(`${x.customer.name}${x.customer.phone ? ' · ' + x.customer.phone : ''}${rent ? ` · ${D.fmtRange(x.start, x.end)} (${x.days} malam)` : ''}`, pad + 20, y);
      y += 16; c.strokeStyle = '#ece6da'; c.beginPath(); c.moveTo(pad + 20, y); c.lineTo(W - pad - 20, y); c.stroke(); y += 26;
      x.items.forEach((i) => { const amt = rent ? Rules.lineUnit(i, x.days) * i.qty : i.price * i.qty; row(`${i.qty}× ${i.name}`.slice(0, 60), rupiah(amt)); });
      y += 2; c.strokeStyle = '#ece6da'; c.beginPath(); c.moveTo(pad + 20, y - 14); c.lineTo(W - pad - 20, y - 14); c.stroke(); y += 6;
      const paid = paidOf(x), sisa = Math.max(0, x.total - paid);
      row('Total', rupiah(x.total), true, '#15311f');
      row(rent && x.paymentStatus === 'dp_paid' ? `Dibayar (DP ${st.dpPercent}%)` : 'Dibayar', rupiah(paid), true, '#2f6b43');
      row('Sisa bayar', rupiah(sisa), true, sisa ? '#b4561c' : '#2f6b43');
      if ((o.extra || []).length) { y += 2; c.strokeStyle = '#ece6da'; c.beginPath(); c.moveTo(pad + 20, y - 14); c.lineTo(W - pad - 20, y - 14); c.stroke(); y += 10; o.extra.forEach((e) => row(e.l, e.r || '', e.bold, e.color)); }
      y = top + h + 18 + 4;
    });
    c.font = font(500, 12); c.fillStyle = '#6b7a70'; c.fillText(`Dibuat ${new Date().toLocaleString('id-ID')} · Tunjukkan nota ini saat pengambilan / konsultasi.`, pad, H - 28);
    return cv;
  }
  /* ---------- Denda keterlambatan per barang (aturan denda Owner: % tarif per malam / nominal per barang) ---------- */
  function fineLines(b, late) {
    const st = DB.settings();
    return (b.items || []).map((it) => {
      const per = st.lateFeeMode === 'nominal' ? (+st.lateFeeAmount || 0) : Math.round((it.tiers ? it.tiers.d1 : it.pricePerDay) * (st.lateFeePercent / 100));
      return { name: it.name, img: it.img, qty: it.qty, per, total: per * it.qty * late };
    });
  }
  const nowHM = () => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); };
  /* Ringkasan tagihan sebuah booking sewa: dipakai halaman nota, gambar nota tagihan, dan pesan WhatsApp */
  function billOf(b) {
    const late = b.status === 'disewa' ? Rules.lateDays(b, D.today(), nowHM()) : 0;
    const fines = late ? fineLines(b, late) : []; const fine = fines.reduce((a, x) => a + x.total, 0);
    const paid = (b.payments || []).reduce((a, p) => a + (+p.amount || 0), 0) - (b.refunds || []).reduce((a, p) => a + (+p.amount || 0), 0);
    const sisa = Math.max(0, (b.total || 0) - paid);
    const dueToday = b.status === 'disewa' && !late && b.end === D.today();
    return { late, fines, fine, paid, sisa, due: sisa + fine, dueToday };
  }
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  /* Gambar NOTA TAGIHAN (PNG) bergaya nota booking di website */
  async function tagihanCanvas(b, opts = {}) {
    const st = DB.settings(), bill = billOf(b), CI = changeInfo(b);
    const W = 820, S = 2, P = 44, F = '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
    const chg = CI.all.filter((c) => c.status !== 'ditolak');
    const rowH = 46;
    let H = 250 + 150 + 44 + b.items.length * rowH + 20;
    if (chg.length) H += 54 + chg.length * 30;
    if (bill.late) H += 70 + 40 + bill.fines.length * 38;
    H += 40 + (CI.ok.length ? 2 : 0) * 28 + (bill.late ? 6 : 4) * 30 + 30 + 90 + 70;
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d'); c.scale(S, S);
    const f = (w, z) => `${w} ${z}px ${F}`;
    const txt = (t, x, y, o = {}) => { c.font = f(o.w || 500, o.z || 13); c.fillStyle = o.c || '#2a3a2f'; c.textAlign = o.a || 'left'; c.fillText(String(t), x, y); c.textAlign = 'left'; };
    const fit = (t, max, w, z) => { c.font = f(w, z); t = String(t); if (c.measureText(t).width <= max) return t; while (t.length > 3 && c.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
    const line = (x1, y1, x2, y2, col, lw = 1, dash) => { c.save(); c.strokeStyle = col; c.lineWidth = lw; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore(); };
    const rrect = (x, y, w, h, r, fill, stroke) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } };
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    /* kepala nota */
    const logo = await loadImg(asset('assets/img/logo.png'));
    if (logo) c.drawImage(logo, P, 30, 136, 64); else txt(st.storeName, P, 70, { w: 800, z: 22, c: '#1f4d2f' });
    const addr = String(st.address || ''); const cut = addr.lastIndexOf(',', 46) > 0 ? addr.lastIndexOf(',', 46) + 1 : 46;
    txt(addr.slice(0, cut).trim(), P, 118, { c: '#6b7a70', z: 12.5 }); txt(addr.slice(cut).trim(), P, 136, { c: '#6b7a70', z: 12.5 });
    txt(`${st.phone || ''} · ${st.email || ''}`, P, 154, { c: '#6b7a70', z: 12.5 });
    const QX = W - P - 132; const TX = QX - 24;
    txt(opts.title || 'NOTA TAGIHAN', TX, 56, { w: 800, z: 26, c: '#1f4d2f', a: 'right' });
    txt(`#${NO(b)}`, TX, 82, { w: 800, z: 16, c: '#15311f', a: 'right' });
    txt(`Tanggal: ${D.fmtDate(D.today(), true)}`, TX, 102, { c: '#6b7a70', z: 13, a: 'right' });
    const PS = { unpaid: ['BELUM DIBAYAR', '#b7791f'], dp_verifying: ['MENUNGGU VERIFIKASI', '#2b5aa8'], dp_paid: ['DP DIBAYAR', '#b7791f'], lunas: ['LUNAS', '#1f4d2f'] };
    const stamp = bill.late ? [`TERLAMBAT ${bill.late} MALAM`, '#b42318'] : bill.dueToday ? ['JATUH TEMPO HARI INI', '#b7791f'] : opts.booking && PS[b.paymentStatus] ? PS[b.paymentStatus] : bill.sisa ? ['BELUM LUNAS', '#b7791f'] : ['LUNAS', '#1f4d2f'];
    c.save(); c.translate(TX - 100, 152); c.rotate(-0.1); c.font = f(800, 14); const sw = c.measureText(stamp[0]).width + 30;
    c.strokeStyle = stamp[1]; c.lineWidth = 3; rrect(-sw / 2, -18, sw, 34, 7, null, stamp[1]); c.fillStyle = stamp[1]; c.textAlign = 'center'; c.fillText(stamp[0], 0, 5); c.restore();
    rrect(QX, 28, 132, 146, 12, '#fff', '#e6e1d6');
    try {
      await loadScript(asset('assets/vendor/qr/qrcode-generator.js'));
      const q = window.qrcode(0, 'M'); q.addData(new URL(url('invoice?id=' + b.id), location.href).href); q.make();
      const n = q.getModuleCount(), cs = 108 / n; c.fillStyle = '#111';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(QX + 12 + k * cs, 38 + r * cs, cs + 0.3, cs + 0.3);
    } catch (e) { /* QR opsional */ }
    txt('Scan untuk buka nota', QX + 66, 164, { z: 10.5, c: '#6b7a70', a: 'center' });
    line(P, 194, W - P, 194, '#1f4d2f', 2.5);
    /* ditagihkan & detail sewa */
    let y = 226; const CX = W / 2 + 10;
    txt('DITAGIHKAN KEPADA', P, y, { w: 700, z: 11.5, c: '#6b7a70' }); txt('DETAIL SEWA', CX, y, { w: 700, z: 11.5, c: '#6b7a70' });
    txt(b.customer.name, P, y + 26, { w: 700, z: 15, c: '#15311f' }); txt(b.customer.phone || '', P, y + 48, { z: 13.5 }); txt(b.customer.email || '', P, y + 68, { z: 13.5 });
    txt(`Periode: ${D.fmtRange(b.start, b.end)} (${b.days} malam)`, CX, y + 26, { w: 600, z: 13.5 });
    txt(`Ambil: ${D.fmtDate(b.start, true)}`, CX, y + 48, { z: 13.5 });
    txt(`Kembali: ${D.fmtDate(b.end, true)}, maks. pukul ${String(st.returnTime || '22:00').replace(':', '.')} WIB`, CX, y + 68, { z: 13.5, w: 700, c: bill.late ? '#b42318' : '#2a3a2f' });
    txt(`Status: ${(STATUS.rental[b.status] || { label: b.status }).label} · ${(STATUS.payment[b.paymentStatus] || { label: b.paymentStatus }).label}`, CX, y + 90, { z: 13 , c: '#2f6b43', w: 700 });
    /* tabel barang */
    y = 360; const col = { q: 390, h: 500, d: 528, j: W - P - 14 };
    const thead = (yy, cols) => { rrect(P, yy, W - P * 2, 40, 0, '#f8f6f1'); cols.forEach(([t, x, a]) => txt(t, x, yy + 25, { w: 700, z: 12, c: '#5d6b62', a })); line(P, yy + 40, W - P, yy + 40, '#e6e1d6'); };
    thead(y, [['Barang', P + 14], ['Qty', col.q, 'right'], ['Harga/unit', col.h, 'right'], ['Durasi', col.d], ['Jumlah', col.j, 'right']]);
    y += 40;
    const imgs = await Promise.all(b.items.map((it) => loadImg(asset(it.img))));
    b.items.forEach((it, i) => {
      const unit = Rules.lineUnit(it, b.days); const yy = y + i * rowH;
      if (imgs[i]) { c.save(); rrect(P + 12, yy + 7, 32, 32, 6); c.clip(); c.drawImage(imgs[i], P + 12, yy + 7, 32, 32); c.restore(); }
      txt(fit(it.name, 270, 700, 13.5), P + 54, yy + 28, { w: 700, z: 13.5, c: '#15311f' });
      txt(it.qty, col.q, yy + 28, { z: 13.5, a: 'right' }); txt(rupiah(unit), col.h, yy + 28, { z: 13.5, a: 'right' });
      txt(fit(Rules.tierLabel(it.tiers || { d1: it.pricePerDay }, b.days), 135, 500, 12.5), col.d, yy + 28, { z: 12.5, c: '#5d6b62' }); txt(rupiah(unit * it.qty), col.j, yy + 28, { z: 13.5, a: 'right', w: 600 });
      line(P, yy + rowH, W - P, yy + rowH, '#efebe2');
    });
    y += b.items.length * rowH + 20;
    /* perubahan barang */
    if (chg.length) {
      rrect(P, y, W - P * 2, 40 + chg.length * 30, 10, '#fffaf0', '#f1e2b8');
      txt('PERUBAHAN BARANG', P + 14, y + 24, { w: 700, z: 11.5, c: '#8a5a12' });
      chg.forEach((ch, i) => { const yy = y + 50 + i * 30; txt(fit(`${ch.qty}× ${ch.fromName} → ${ch.toName}${ch.status === 'menunggu' ? ' (menunggu persetujuan)' : ''}`, 560, 600, 13), P + 14, yy, { w: 600, z: 13 }); txt(`${(+ch.diff || 0) >= 0 ? '+' : '−'}${rupiah(Math.abs(+ch.diff || 0))}`, W - P - 14, yy, { w: 800, z: 13, c: ch.status === 'menunggu' ? '#9aa39d' : '#9a6508', a: 'right' }); });
      y += 54 + chg.length * 30;
    }
    /* rincian denda */
    if (bill.late) {
      txt(`RINCIAN DENDA KETERLAMBATAN · ${bill.late} MALAM`, P, y + 22, { w: 800, z: 12.5, c: '#b42318' });
      txt(`Terlambat sejak ${D.fmtDate(b.end, true)} pukul ${String(st.returnTime || '22:00').replace(':', '.')} WIB`, P, y + 42, { z: 12, c: '#6b7a70' });
      y += 56;
      const fc = { q: 470, t: 590, m: 680, d: W - P - 14 };
      rrect(P, y, W - P * 2, 40, 0, '#fdeceb'); [['Barang', P + 14], ['Qty', fc.q, 'right'], ['Tarif/malam', fc.t, 'right'], ['Malam', fc.m, 'right'], ['Denda', fc.d, 'right']].forEach(([t, x, a]) => txt(t, x, y + 25, { w: 700, z: 12, c: '#8f2a1d', a }));
      y += 40;
      bill.fines.forEach((x, i) => { const yy = y + i * 38; txt(fit(x.name, 330, 600, 13), P + 14, yy + 25, { w: 600, z: 13 }); txt(x.qty, fc.q, yy + 25, { z: 13, a: 'right' }); txt(rupiah(x.per), fc.t, yy + 25, { z: 13, a: 'right' }); txt(bill.late, fc.m, yy + 25, { z: 13, a: 'right' }); txt(rupiah(x.total), fc.d, yy + 25, { z: 13, a: 'right', w: 700, c: '#b42318' }); line(P, yy + 38, W - P, yy + 38, '#f4dcd8'); });
      y += bill.fines.length * 38 + 14;
    }
    /* ringkasan */
    y += 24; const LX = W / 2 + 40, RX = W - P;
    const kv = (l, r, o = {}) => { txt(l, LX, y, { z: o.z || 14, w: o.w || 500, c: o.c || '#5d6b62' }); txt(r, RX, y, { z: o.z || 14, w: o.w || 600, c: o.rc || o.c || '#15311f', a: 'right' }); y += o.gap || 30; };
    if (CI.ok.length) { kv('Total awal', rupiah(CI.base)); kv('Tambahan ganti barang', `${CI.add >= 0 ? '+' : '−'} ${rupiah(Math.abs(CI.add))}`, { rc: '#9a6508', w: 700 }); }
    kv(CI.ok.length ? 'Total sewa (baru)' : 'Total sewa', rupiah(b.total), { w: 700 });
    kv('Sudah dibayar', rupiah(bill.paid), { rc: '#2f6b43', w: 700 });
    if (pendingPay(b)) kv('Menunggu verifikasi', rupiah(pendingPay(b)), { c: '#9aa39d', rc: '#9aa39d' });
    kv('Sisa sewa', rupiah(bill.sisa));
    if (bill.late) kv('Denda keterlambatan', rupiah(bill.fine), { rc: '#b42318', w: 700 });
    line(LX, y - 12, RX, y - 12, '#d8d2c4', 1, [4, 4]); y += 10;
    const pre = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(b.status);
    kv(pre ? 'Sisa dibayar saat ambil' : 'Total dibayar saat kembali', rupiah(bill.due), { z: 17, w: 800, c: bill.late ? '#b42318' : '#15311f', gap: 34 });
    /* catatan bawah */
    y += 8; rrect(P, y, W - P * 2, 52, 10, bill.late ? '#fdf3f2' : '#f1f7f2');
    txt(bill.late ? 'Denda bertambah setiap malam keterlambatan. Mohon segera kembalikan barang ke toko.' : ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(b.status) ? 'Bawa nota ini dan kartu identitas asli saat mengambil barang di toko.' : 'Mohon kembalikan barang tepat waktu agar tidak dikenakan denda keterlambatan.', P + 16, y + 22, { z: 12.5, w: 600, c: bill.late ? '#8f2a1d' : '#1f4d2f' });
    txt(`Batas pengembalian pukul ${String(st.returnTime || '22:00').replace(':', '.')} WIB · ${st.hours || ''}`, P + 16, y + 41, { z: 12, c: '#6b7a70' });
    /* potong tinggi kanvas pas dengan isi */
    const endH = Math.min(H, Math.ceil(y + 52 + 30));
    const out = document.createElement('canvas'); out.width = W * S; out.height = endH * S;
    out.getContext('2d').drawImage(cv, 0, 0);
    return out;
  }

  /* Pratinjau gambar sebelum dikirim ke WhatsApp (laptop): Salin gambar → Buka WhatsApp → Ctrl+V */
  function sendPreview({ title, blob, name, text, waUrl, waLabel, onSent }) {
    const canCopy = !!(navigator.clipboard && window.ClipboardItem && window.isSecureContext);
    const imgUrl = URL.createObjectURL(blob);
    const m = modal({ title, size: 'lg', body: `
      <div class="tg-steps"><span><b>1</b> ${canCopy ? 'Tekan <b>Salin gambar nota</b>' : 'Tekan <b>Unduh gambar</b>'}</span><span><b>2</b> Tekan <b>${esc(waLabel)}</b> — pesan sudah terisi</span><span><b>3</b> Di chat WhatsApp, ${canCopy ? 'tekan <b>Ctrl+V</b> untuk menempel gambar' : 'lampirkan gambar yang diunduh'}, lalu kirim</span></div>
      <div class="tg-prev"><img src="${imgUrl}" alt="Nota"></div>
      <details class="tg-msg"><summary>Lihat isi pesan WhatsApp</summary><pre>${esc(text)}</pre></details>`,
      foot: `<button class="btn btn-light" id="spDl"><i class="fa-solid fa-download"></i> Unduh gambar</button>${canCopy ? '<button class="btn btn-light" id="spCopy"><i class="fa-regular fa-copy"></i> Salin gambar nota</button>' : ''}<button class="btn btn-wa" id="spWa"><i class="fa-brands fa-whatsapp"></i> ${esc(waLabel)}</button>` });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); URL.revokeObjectURL(imgUrl); } }); obs.observe(document.body, { childList: true });
    m.$('#spDl').addEventListener('click', () => { const a = document.createElement('a'); a.href = imgUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Gambar nota tersimpan di folder Unduhan.'); });
    if (m.$('#spCopy')) m.$('#spCopy').addEventListener('click', async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); m.$('#spCopy').innerHTML = '<i class="fa-solid fa-check"></i> Gambar tersalin'; m.$('#spCopy').classList.add('done'); toast('Gambar nota tersalin. Tempel di chat WhatsApp dengan Ctrl+V.'); } catch (e) { toast('Browser tidak mengizinkan menyalin gambar. Pakai tombol Unduh gambar.', 'err'); } });
    m.$('#spWa').addEventListener('click', () => { window.open(waUrl, '_blank', 'noopener'); if (onSent) onSent(); });
    return m;
  }
  function waContact(text, opts = {}) {
    const user = DB.session(); const orders = activeOrders(user);
    /* Dari halaman nota: pesanan itu selalu ikut, walau sudah selesai / belum dibayar */
    if (opts.focus) { const fx = DB.booking(opts.focus) || (DB.sale && DB.sale(opts.focus)); if (fx && !orders.some((o) => o.x.id === fx.id)) orders.unshift({ kind: String(fx.id).startsWith('RNT') ? 'rent' : 'buy', x: fx }); }
    if (!user || !orders.length) { window.open(waLink(text), '_blank', 'noopener'); return; }
    const m = modal({ title: 'Hubungi admin via WhatsApp', body: `
      <p class="muted" style="font-size:13.5px;margin-bottom:12px">Nota digital pesananmu ikut dikirim supaya admin langsung tahu pesanan yang kamu maksud. Pesanmu ditaruh di bawah nota.</p>
      <div class="wa-orders">${orders.map((o, i) => `<label class="wa-ord"><input type="checkbox" value="${i}" ${(opts.focus ? o.x.id === opts.focus : i < 3) ? 'checked' : ''}><span><b>#${NO(o.x)}</b> · ${o.kind === 'rent' ? `Sewa ${D.fmtRange(o.x.start, o.x.end)}` : 'Pembelian'}<small>${esc(o.x.items.map((it) => `${it.qty}× ${it.name}`).join(', '))}</small></span><em>${rupiah(o.x.total)}</em></label>`).join('')}</div>
      <div class="field" style="margin-top:12px"><label for="waMsg">Pesan untuk admin</label><textarea class="textarea" id="waMsg" rows="3" placeholder="Contoh: Apakah barangnya bisa diantar ke Jl. …?">${esc(text || '')}</textarea></div>
      <p class="muted" style="font-size:12px"><i class="fa-solid fa-circle-info"></i> Di HP, gambar nota + pesan dibagikan langsung (pilih WhatsApp lalu chat admin). Di laptop, WhatsApp admin terbuka dengan ringkasan & link nota, dan gambar nota terunduh untuk dilampirkan.</p>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="waGo"><i class="fa-brands fa-whatsapp"></i> Kirim ke WhatsApp</button>' });
    m.$('#waGo').addEventListener('click', async () => {
      const pick = m.$$('.wa-ord input:checked').map((c) => orders[+c.value]);
      const msg = m.$('#waMsg').value.trim();
      const body = [pick.length ? `Halo admin ${DB.settings().storeName}, berikut nota digital saya:\n\n${pick.map(notaText).join('\n\n')}` : `Halo admin ${DB.settings().storeName},`, msg ? `\n*Pesan:*\n${msg}` : ''].join('\n');
      if (!pick.length) { m.close(); window.open(waLink(body), '_blank', 'noopener'); return; }
      /* Gambar nota: desain sama dengan nota booking di website (satu halaman per pesanan, disusun ke bawah) */
      const parts = [];
      for (const o of pick) {
        if (o.kind === 'rent') { const bl = billOf(o.x); parts.push(await tagihanCanvas(o.x, { booking: true, title: bl.late ? 'NOTA TAGIHAN' : 'NOTA BOOKING' })); }
        else parts.push(notaCanvas([o]));
      }
      const W = Math.max(...parts.map((c) => c.width)), GAP = 40, H = parts.reduce((a, c) => a + c.height, 0) + GAP * (parts.length - 1);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d'); cx.fillStyle = '#f4f1ea'; cx.fillRect(0, 0, W, H);
      let yy = 0; parts.forEach((c) => { cx.drawImage(c, 0, yy); yy += c.height + GAP; });
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const name = `nota-${pick.map((o) => o.x.id).join('_')}.png`;
      const file = blob && typeof File !== 'undefined' ? new File([blob], name, { type: 'image/png' }) : null;
      m.close();
      /* HP: menu Bagikan (gambar + pesan sekaligus). Laptop: pratinjau → salin gambar / buka WhatsApp / unduh */
      if (matchMedia('(pointer: coarse)').matches && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text: body }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      sendPreview({ title: 'Kirim nota ke admin', blob, name, text: body, waUrl: waLink(body), waLabel: 'Buka WhatsApp admin' });
    });
  }
  /* ---------- Ringkasan ganti barang untuk nota & detail booking ---------- */
  function changeInfo(b) {
    const ch = (b.changes || []);
    const ok = ch.filter((c) => c.status === 'disetujui'); const add = ok.reduce((a, c) => a + (+c.diff || 0), 0);
    return { all: ch, ok, add, base: (b.total || 0) - add };
  }
  function changesHtml(b) {
    const ch = (b.changes || []); if (!ch.length) return '';
    const st = { disetujui: ['green', 'Disetujui'], menunggu: ['amber', 'Menunggu persetujuan'], ditolak: ['red', 'Ditolak'] };
    return `<div class="chg-sec"><h5>Perubahan barang</h5>${ch.map((c) => { const [tone, l] = st[c.status] || ['gray', c.status]; const d = +c.diff || 0;
      return `<div class="chg-row"><div class="chg-main"><b>${c.qty}× ${esc(c.fromName)}</b> <i class="fa-solid fa-arrow-right"></i> <b>${esc(c.toName)}</b><small>${D.fmtDateTime(c.at)}${c.reason ? ' · ' + esc(c.reason) : ''}${c.note ? ' · ' + esc(c.note) : ''}</small></div>
        <span class="pill ${tone} plain">${l}</span><span class="chg-diff ${c.status === 'disetujui' ? (d >= 0 ? 'up' : 'down') : 'off'}">${d >= 0 ? '+' : '−'}${rupiah(Math.abs(d))}${c.status === 'menunggu' ? '<small>belum dihitung</small>' : c.status === 'ditolak' ? '<small>tidak dihitung</small>' : ''}</span></div>`; }).join('')}</div>`;
  }
  /* Catatan layanan antar: aturan resmi tetap ambil & kembali di toko, pengantaran hanya lewat konsultasi admin */
  /* Kotak bantuan: (1) tanya pengantaran ke admin, (2) pertanyaan lain → Asisten Trip (instan) atau chat admin */
  function helpLine() {
    return `<div class="help-line"><i class="fa-regular fa-comments"></i><div><b>Ada pertanyaan lain?</b> Tanya <button type="button" class="link-btn" data-ai-open><i class="fa-solid fa-wand-magic-sparkles"></i> Asisten Trip</button> untuk jawaban instan (harga, durasi, denda, stok), atau <a href="${waLink('Halo admin Annapurna, saya mau bertanya.')}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> chat admin</a> kalau butuh bantuan langsung.</div></div>`;
  }
  function delivNote(ctx, opts = {}) {
    const t = `Halo admin, saya ingin konsultasi apakah barang ${ctx || 'sewaan saya'} bisa diantar. Alamat saya: `;
    return `<div class="help-box"><div class="deliv-note"><i class="fa-solid fa-truck-fast"></i><div><b>Tidak sempat ke toko?</b> Tanyakan ke admin apakah barang bisa diantar ke tempatmu. <a href="${waLink(t)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Tanya pengantaran</a></div></div>${opts.help === false ? '' : helpLine()}</div>`;
  }
  /* Permintaan antar (dipilih customer saat checkout). Kesepakatan diselesaikan langsung dengan admin lewat WhatsApp. */
  /* Pembayaran yang sudah dikirim customer tapi belum diverifikasi admin (ditampilkan abu-abu) */
  function pendingPay(x) {
    if (!x || !['dp_verifying', 'verifying'].includes(x.paymentStatus)) return 0;
    return +((x.proofMeta && x.proofMeta.amount) || (x.paymentStatus === 'dp_verifying' ? x.dp : x.total)) || 0;
  }
  function pendingPayHtml(x) {
    const n = pendingPay(x); if (!n) return '';
    return `<div class="kv pay-wait"><span><i class="fa-regular fa-clock"></i> Menunggu verifikasi admin</span><span>${rupiah(n)}</span></div>`;
  }
  /* Semua tombol / link WhatsApp di halaman customer otomatis lewat waContact (panel admin tidak) */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me/"]'); if (!a) return;
    if (String(document.body.dataset.page || '').startsWith('admin')) return;
    if (!DB.session() || (!activeOrders().length && !a.dataset.nota)) return;
    e.preventDefault();
    let text = ''; try { text = new URL(a.href).searchParams.get('text') || ''; } catch (err) { /* abaikan */ }
    if (/^Halo Annapurna Adventure, saya mau tanya soal sewa alat camping\.?$/.test(text)) text = '';
    waContact(text, { focus: a.dataset.nota || '' });
  });

  /* ====================== Halaman bernomor (pagination) ======================
     Otomatis untuk semua tabel daftar (.table-wrap > table.table) di panel admin/owner, data pelanggan,
     ulasan, dan riwayat pesanan customer. Default 30 data per halaman, bisa diganti 15 / 30 / 50.
     Saat jumlah data berubah (filter / pencarian) kembali ke halaman 1; kalau hanya diperbarui (mis. setelah verifikasi)
     tetap di halaman yang sama. Ringkasan dashboard & laporan tidak dipecah. */
  const PG = new WeakMap();
  const pgPer = () => { try { return +localStorage.getItem('ann_pg_per') || 30; } catch (e) { return 30; } };
  function pgTargets() {
    const page = String(document.body.dataset.page || '');
    if (page === 'admin-' || page === 'invoice' || /^admin-(dashboard|laporan|kalender)$/.test(page) || page === 'owner-dashboard') return [];
    const T = [];
    document.querySelectorAll('.table-wrap > table.table > tbody').forEach((tb) => { if (!tb.closest('.modal, [data-no-paginate]')) T.push({ box: tb, items: () => Array.from(tb.children).filter((r) => r.tagName === 'TR' && !(r.children.length === 1 && r.children[0].colSpan > 1)), anchor: tb.closest('.table-wrap') }); });
    document.querySelectorAll('#list').forEach((l) => {
      if (l.closest('.modal') || l.querySelector('[draggable="true"]')) return;
      const cards = () => Array.from(l.children).filter((c) => c.matches('.rv-card, .order-card'));
      if (cards().length) T.push({ box: l, items: cards, anchor: l });
    });
    return T;
  }
  function pgPages(cur, n) {
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const set = new Set([1, n, cur - 1, cur, cur + 1].filter((x) => x >= 1 && x <= n));
    const arr = [...set].sort((a, b) => a - b), out = [];
    arr.forEach((x, i) => { if (i && x - arr[i - 1] > 1) out.push('…'); out.push(x); });
    return out;
  }
  function pgApply(t) {
    const items = t.items(); let st = PG.get(t.box);
    if (!st) { st = { page: 1, count: -1, pager: null }; PG.set(t.box, st); }
    const per = pgPer(), n = items.length, pages = Math.max(1, Math.ceil(n / per));
    if (n !== st.count) { if (st.count !== -1) st.page = 1; st.count = n; }
    st.page = Math.min(Math.max(1, st.page), pages);
    const from = (st.page - 1) * per, to = from + per;
    items.forEach((el, i) => { const hide = n > per && (i < from || i >= to); if (hide !== (el.style.display === 'none')) el.style.display = hide ? 'none' : ''; });
    /* Navigasi halaman selalu tampil di daftar data (kecuali kosong), supaya jumlah data & pilihan per halaman selalu terlihat */
    /* Halaman customer (mis. Pesanan Saya): navigasi hanya muncul bila data lebih dari satu halaman */
    const custPage = !String(document.body.dataset.page || '').startsWith('admin');
    if (!n || (custPage && n <= per)) { if (st.pager) { st.pager.remove(); st.pager = null; } return; }
    if (!st.pager || !st.pager.isConnected) {
      st.pager = document.createElement('nav'); st.pager.className = 'pager'; st.pager.setAttribute('aria-label', 'Halaman data');
      t.anchor.insertAdjacentElement('afterend', st.pager);
      st.pager.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return;
        st.page = +b.dataset.pg; pgApply(t);
        const top = t.anchor.getBoundingClientRect().top + window.scrollY - 140; if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
      });
      st.pager.addEventListener('change', (e) => { if (!e.target.matches('[data-pg-per]')) return; try { localStorage.setItem('ann_pg_per', e.target.value); } catch (err) { /* abaikan */ } st.page = 1; pgScan(); });
    }
    const html = `<span class="pg-info">Menampilkan <b>${n ? from + 1 : 0}–${Math.min(to, n)}</b> dari <b>${n}</b></span>
      <div class="pg-btns"><button type="button" class="pg-b" data-pg="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>${pgPages(st.page, pages).map((x) => x === '…' ? '<span class="pg-gap">…</span>' : `<button type="button" class="pg-b ${x === st.page ? 'on' : ''}" data-pg="${x}" ${x === st.page ? 'aria-current="page"' : ''}>${x}</button>`).join('')}<button type="button" class="pg-b" data-pg="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Berikutnya"><i class="fa-solid fa-chevron-right"></i></button></div>
      <label class="pg-per">Tampilkan <select class="select" data-pg-per>${[15, 30, 50].map((v) => `<option value="${v}" ${v === per ? 'selected' : ''}>${v}</option>`).join('')}</select> per halaman</label>`;
    if (st.pager.dataset.h !== html) { st.pager.innerHTML = html; st.pager.dataset.h = html; }
  }
  let pgQueued = false;
  function pgScan() { pgQueued = false; pgTargets().forEach(pgApply); }
  if ('MutationObserver' in window) {
    const startPg = () => {
      pgScan();
      new MutationObserver((ms) => {
        if (pgQueued) return;
        const relevant = ms.some((m) => !(m.target.closest && m.target.closest('.pager')) && ![...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType !== 1 || n.classList.contains('pager')));
        if (relevant) { pgQueued = true; requestAnimationFrame(pgScan); }
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) startPg(); else document.addEventListener('DOMContentLoaded', startPg);
  }

  /* ---------- Input nominal rupiah ----------
     input type="number" membaca titik sebagai desimal, jadi "10.000" terbaca 10.
     Semua input harga (label berisi "Rp") diubah jadi input teks angka: titik, koma, spasi, "Rp" dibuang otomatis,
     dan di bawahnya tampil pratinjau "Rp 10.000" supaya admin yakin nominalnya benar. */
  function moneyInput(el) {
    if (el.dataset.money) return; el.dataset.money = '1';
    el.type = 'text'; el.setAttribute('inputmode', 'numeric'); el.setAttribute('autocomplete', 'off'); el.removeAttribute('step');
    el.classList.add('money-in');
    const pv = document.createElement('span'); pv.className = 'money-preview'; el.insertAdjacentElement('afterend', pv);
    const sync = () => { const d = String(el.value).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, ''); if (el.value !== d) el.value = d; pv.textContent = d && +d >= 1000 ? `= ${rupiah(+d)}` : ''; };
    el.addEventListener('input', sync); el.addEventListener('change', sync); sync();
  }
  function moneyScan(root) {
    (root.querySelectorAll ? root.querySelectorAll('input[type="number"]') : []).forEach((el) => {
      const f = el.closest('.field'); const lb = f && f.querySelector('label');
      if (lb && /\bRp\b/.test(lb.textContent)) moneyInput(el);
    });
  }
  if ('MutationObserver' in window) {
    const startMoney = () => { moneyScan(document.body); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && moneyScan(n)))).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) startMoney(); else document.addEventListener('DOMContentLoaded', startMoney);
  }

  /* Logout ke server (Laravel) DAN hapus sesi di browser. Sebelumnya hanya sesi browser yang dihapus,
     sehingga sesi Laravel masih hidup dan user otomatis "login lagi" saat halaman dimuat ulang. */
  async function serverLogout(to) {
    const token = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    try { await fetch(url('keluar'), { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' }); } catch (e) { /* tanpa server: cukup hapus sesi lokal */ }
    DB.logout();
    location.href = to || url('masuk');
  }

  /* to (opsional) = nomor customer, mis. 0812… → 62812… ; tanpa to = nomor WhatsApp toko */
  function waLink(text, to) { const num = to ? String(to).replace(/[^\d]/g, '').replace(/^0/, '62') : DB.settings().whatsapp; return `https://wa.me/${num}?text=${encodeURIComponent(text || 'Halo Annapurna Adventure, saya mau tanya soal sewa alat camping.')}`; }

  window.UI = { buyModal, cdSpan, cdText, returnDeadline, $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, stars, Cart, quickRent, quickBuy, sizePicker, firstAvailSize, changeModal, notifMenu, notifCenter, tripBar, tripModal, tripDefault, orderTracker, productCard, bindProductActions, validate, isEmail, isPhone, fileToDataURL, downloadCSV, exportExcel, exportPDF, elementToPDF, runExport, bindExport, exportButtons, loadScript, reviewModal, searchProducts, dateGuard, durationChips, tierText, waLink, waContact, sendPreview, pendingPay, pendingPayHtml, helpLine, fineLines, billOf, tagihanCanvas, changeInfo, changesHtml, delivNote, activeOrders, notaCanvas, serverLogout, moneyInput, cropImage, paginateScan: () => pgScan(), BASE };
})();
