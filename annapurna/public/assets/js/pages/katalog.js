(function () {
  const { DB, Rules, D } = Ann; const { $, $$, esc, param, productCard, bindProductActions } = UI;
  const state = { cat: param('cat') || 'all', q: param('q') || '', mode: window.CATALOG_MODE === 'buy' ? 'buy' : 'rent', sort: 'pop', start: (DB.trip() || {}).start || '', end: (DB.trip() || {}).end || '', only: false, brands: new Set(param('merek') ? [param('merek')] : []) };
  /* Halaman Sewa (/katalog) dan Beli (/belanja) dipisah. Tautan lama katalog?mode=beli diarahkan ke /belanja. */
  if (param('mode') === 'beli' && state.mode !== 'buy') { location.replace(UI.url('belanja' + location.search.replace(/([?&])mode=beli&?/, '$1').replace(/[?&]$/, ''))); return; }
  $('#q').value = state.q;

  const cats = DB.categories();
  document.addEventListener('change', (e) => { const b = e.target.closest('[data-brand]'); if (!b) return; if (b.checked) state.brands.add(b.dataset.brand); else state.brands.delete(b.dataset.brand); draw(); });
  function drawCats() {
    const prods = DB.products().filter((p) => (state.mode === 'rent' ? p.rent : p.price));
    const all = [{ id: 'all', name: 'Semua alat' }, ...cats];
    $('#catList').innerHTML = all.map((c) => {
      const n = c.id === 'all' ? prods.length : prods.filter((p) => p.cat === c.id).length;
      return `<button class="${state.cat === c.id ? 'active' : ''}" data-cat="${c.id}"><span>${esc(c.name)}</span><small>${n}</small></button>`;
    }).join('');
  }
  function draw() {
    $$('.mode-links a').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    $('#dateFilter').classList.toggle('hidden', state.mode === 'buy');
    $('#pageTitle').textContent = state.mode === 'buy' ? 'Belanja Alat Outdoor' : 'Sewa Alat Outdoor';
    $('#crumbNow').textContent = state.mode === 'buy' ? 'Belanja Alat' : 'Sewa Alat';
    drawCats();
    let list = DB.products().filter((p) => (state.mode === 'rent' ? p.rent : p.price));
    if (state.cat !== 'all') list = list.filter((p) => p.cat === state.cat);
    const brandsHere = [...new Set(list.map((p) => p.brand).filter(Boolean))].sort();
    [...state.brands].forEach((b) => { if (!brandsHere.includes(b)) state.brands.delete(b); });
    $('#brandBox').hidden = brandsHere.length < 2;
    $('#brandList').innerHTML = brandsHere.map((b) => `<label class="check"><input type="checkbox" data-brand="${esc(b)}" ${state.brands.has(b) ? 'checked' : ''}> ${esc(b)} <small>${list.filter((p) => p.brand === b).length}</small></label>`).join('');
    if (state.brands.size) list = list.filter((p) => state.brands.has(p.brand));
    const q = state.q;
    const found = UI.searchProducts(list, q); list = found.list;
    const hasDates = state.mode === 'rent' && state.start && state.end && state.end > state.start;
    if (hasDates && state.only) list = list.filter((p) => Rules.available(p.id, state.start, state.end) > 0);
    const price = (p) => (state.mode === 'rent' ? p.rent : p.price);
    if (state.sort === 'low') list.sort((a, b) => price(a) - price(b));
    if (state.sort === 'high') list.sort((a, b) => price(b) - price(a));
    if (state.sort === 'rate') list.sort((a, b) => b.rating - a.rating);
    if (state.sort === 'pop' && !(q && found.mode === 'name')) list.sort((a, b) => b.reviews - a.reviews);

    const catName = state.cat === 'all' ? '' : ` di kategori ${(cats.find((c) => c.id === state.cat) || {}).name}`;
    $('#resultInfo').innerHTML = `Menampilkan <strong>${list.length}</strong> alat${catName}${state.brands.size ? ` merek ${esc([...state.brands].join(', '))}` : ''}${q ? ` untuk “${esc(state.q)}”` : ''}${found.mode === 'related' ? ' <span class="muted">· tidak ada nama alat yang cocok, menampilkan alat yang berkaitan</span>' : ''}${hasDates ? ` · tanggal ${D.fmtRange(state.start, state.end)}` : ''}`;
    $('#grid').innerHTML = list.length ? list.map((p) => {
      let card = productCard(p, state.mode);
      /* Satu acuan dengan label kartu: tanggal yang dipilih, atau hari ini */
      const ss = state.mode === 'rent' ? DB.stockState(p) : null;
      const avail = hasDates ? Rules.available(p.id, state.start, state.end) : state.mode === 'rent' ? ss.left : p.stock;
      const cls = avail <= 0 ? 'out' : (ss ? ss.hampir : avail <= 2) ? 'low' : '';
      const txt = state.mode === 'buy' ? (p.stock > 0 ? `Stok ${p.stock}` : 'Stok habis') : avail <= 0 ? (hasDates ? (() => { const nx = Rules.nextAvailable(p.id, 1, state.start, state.end); return nx ? `Penuh · tersedia lagi ${D.fmtDate(nx)}` : 'Penuh di tanggalmu'; })() : 'Sedang disewa semua') : `${avail} unit tersedia${hasDates ? ' di tanggalmu' : ' hari ini'}`;
      return card.replace('<div class="acts">', `<div class="stock-pill ${cls}">${txt}</div><div class="acts">`);
    }).join('') : `<div class="empty-state" style="grid-column:1/-1"><div class="ic"><i class="fa-solid fa-magnifying-glass"></i></div><h3>Alat tidak ditemukan</h3><p>Coba kata kunci lain atau pilih kategori “Semua alat”.</p><button class="btn btn-primary" id="resetF">Tampilkan semua alat</button></div>`;
    const r = $('#resetF'); r && r.addEventListener('click', () => { state.cat = 'all'; state.q = ''; $('#q').value = ''; draw(); });
    const u = new URL(location.href);
    ['cat', 'q', 'mode'].forEach((k) => u.searchParams.delete(k));
    if (state.cat !== 'all') u.searchParams.set('cat', state.cat);
    if (state.q) u.searchParams.set('q', state.q);
    if (state.mode === 'buy') u.searchParams.set('mode', 'beli');
    history.replaceState(null, '', u);
  }

  $('#catList').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; state.cat = b.dataset.cat; draw(); closeF(); });
  /* Tombol Sewa / Beli sekarang berupa tautan ke halaman masing-masing */
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; draw(); });
  let t; $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); draw(); }, 180); });
  const syncTrip = () => { const t = DB.trip(); state.start = t ? t.start : ''; state.end = t ? t.end : ''; if (!t) { state.only = false; $('#fOnlyAvail').checked = false; } draw(); };
  UI.tripBar($('#tripBar'), syncTrip);
  $('#fOnlyAvail').addEventListener('change', (e) => { if (e.target.checked && !DB.trip()) { e.target.checked = false; UI.tripModal(() => { syncTrip(); UI.tripBar($('#tripBar'), syncTrip); }); return; } state.only = e.target.checked; draw(); });

  const panel = $('#filterPanel'), bg = $('#filterBg');
  const closeF = () => { panel.classList.remove('open'); bg.classList.remove('open'); };
  $('#openFilter').addEventListener('click', () => { panel.classList.add('open'); bg.classList.add('open'); });
  $('#closeFilter').addEventListener('click', closeF);
  bg.addEventListener('click', closeF);

  bindProductActions($('#grid'));
  draw();
})();

