(function () {
  const { DB, Rules, D, rupiah } = Ann; const { $, $$, esc, asset, bindProductActions, waLink, param } = UI;
  $('#waCustom').href = waLink('Halo Annapurna, saya mau pesan paket sewa custom.');
  const TYPE = { hiking: 'Hiking', camping: 'Camping', pelengkap: 'Pelengkap' };
  const state = { q: param('q') || '', type: param('type') || '', p: '', sort: 'rec' };
  const open = new Set();
  const all = DB.packages().map((pk) => {
    const items = pk.items.map((i) => ({ ...i, p: DB.product(i.productId) })).filter((i) => i.p);
    const normal = items.reduce((s, i) => s + i.p.rent * i.qty, 0);
    return { ...pk, items, normal, save: Math.max(0, normal - pk.price), pct: normal ? Math.round((1 - pk.price / normal) * 100) : 0, avail: Rules.packageAvailable(pk.id, D.rel(1), D.rel(3)) };
  });
  const norm = (t) => String(t || '').toLowerCase();
  const fitPeople = (pk, v) => {
    if (!v) return true;
    const min = pk.pMin || 1, max = pk.pMax || min;
    if (v === '1') return min <= 1;
    if (v === '2') return min <= 2 && max >= 2;
    if (v === '4') return min <= 4 && max >= 3;
    return max >= 5;
  };
  function list() {
    const q = norm(state.q).trim();
    let L = all.filter((pk) => (!state.type || pk.type === state.type) && fitPeople(pk, state.p)
      && (!q || [pk.name, pk.tagline, ...pk.items.map((i) => i.p.name)].some((t) => norm(t).includes(q))));
    if (state.sort === 'low') L.sort((a, b) => a.price - b.price);
    else if (state.sort === 'high') L.sort((a, b) => b.price - a.price);
    else if (state.sort === 'save') L.sort((a, b) => b.pct - a.pct);
    else L.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    return L;
  }
  function card(pk) {
    const isOpen = open.has(pk.id);
    const preview = pk.items.slice(0, 2), more = pk.items.length - preview.length;
    return `<article class="pk ${pk.popular ? 'popular' : ''} ${isOpen ? 'open' : ''}" data-id="${pk.id}">
      <div class="pk-top">
        <div class="pk-ph"><img src="${asset(pk.img)}" alt="${esc(pk.name)}" loading="lazy">${pk.popular ? '<span class="pk-hot">Paling laris</span>' : ''}</div>
        <div class="pk-info">
          <div class="pk-meta"><span class="pk-tag t-${pk.type}">${TYPE[pk.type] || 'Paket'}</span><span><i class="fa-solid fa-user-group"></i> ${esc(pk.people)}</span><span><i class="fa-solid fa-box-open"></i> ${pk.items.length} alat</span></div>
          <h3>${esc(pk.name)}</h3>
          <p class="pk-tl">${esc(pk.tagline)}</p>
        </div>
        <div class="pk-side">
          <div class="pk-price"><strong>${rupiah(pk.price)}</strong><small>/ hari</small></div>
          <div class="pk-normal"><s>${rupiah(pk.normal)}</s>${pk.pct ? `<span class="pk-save">Hemat ${pk.pct}%</span>` : ''}</div>
          <p class="pk-stock ${pk.avail ? '' : 'out'}"><i class="fa-solid ${pk.avail ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${pk.avail ? `${pk.avail} tersedia besok` : 'Penuh untuk besok'}</p>
          <div class="pk-acts">
            <button class="btn btn-light btn-sm" data-toggle="${pk.id}" aria-expanded="${isOpen}">${isOpen ? 'Tutup' : 'Isi paket'} <i class="fa-solid fa-chevron-down"></i></button>
            <button class="btn btn-primary btn-sm" data-rent-pkg="${pk.id}">Sewa <i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>
        <div class="pk-items">${preview.map((i) => `<span>${i.qty}× ${esc(i.p.name)}</span>`).join('')}${more > 0 ? `<button class="pk-more" data-toggle="${pk.id}">+${more} lainnya</button>` : ''}</div>
      </div>
      <div class="pk-detail"><div class="pk-detail-in">
        <ul>${pk.items.map((i) => `<li><img src="${asset(i.p.img)}" alt=""><a href="produk?id=${i.p.id}">${esc(i.p.name)}</a><span class="muted">${i.qty}×</span><strong>${rupiah(i.p.rent * i.qty)}</strong></li>`).join('')}</ul>
        <div class="pk-sum"><span>Total sewa satuan</span><s>${rupiah(pk.normal)}</s><span>Harga paket</span><strong>${rupiah(pk.price)} / hari</strong><span>Kamu hemat</span><strong class="pk-green">${rupiah(pk.save)} / hari</strong></div>
      </div></div>
    </article>`;
  }
  function draw() {
    const L = list();
    $('#count').innerHTML = `Menampilkan <strong>${L.length}</strong> dari ${all.length} paket`;
    $('#pkList').innerHTML = L.length ? L.map(card).join('') : `<div class="empty-state card"><div class="ic"><i class="fa-solid fa-box-open"></i></div><h3>Paket tidak ditemukan</h3><p>Coba ubah filter, atau minta paket khusus lewat WhatsApp.</p><button class="btn btn-light btn-sm" id="resetF">Reset filter</button></div>`;
    bindProductActions($('#pkList'));
    const r = $('#resetF'); if (r) r.addEventListener('click', () => { Object.assign(state, { q: '', type: '', p: '', sort: 'rec' }); $('#q').value = ''; $('#sort').value = 'rec'; syncUI(); draw(); });
    UI.$$('#pkList .pk').forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 8)); requestAnimationFrame(() => el.classList.add('in')); });
  }
  function syncUI() {
    $$('#typeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.type === state.type));
    $$('#peopleChips .chip').forEach((b) => b.classList.toggle('active', b.dataset.p === state.p));
  }
  $('#q').value = state.q;
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
  $('#typeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.type = b.dataset.type; syncUI(); draw(); });
  $('#peopleChips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; state.p = b.dataset.p; syncUI(); draw(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; draw(); });
  $('#pkList').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]'); if (!t) return;
    const id = t.dataset.toggle, el = t.closest('.pk');
    if (open.has(id)) open.delete(id); else open.add(id);
    el.classList.toggle('open', open.has(id));
    const btn = el.querySelector('.pk-acts [data-toggle]');
    btn.setAttribute('aria-expanded', open.has(id)); btn.innerHTML = `${open.has(id) ? 'Tutup' : 'Isi paket'} <i class="fa-solid fa-chevron-down"></i>`;
  });
  $('#pkAi').addEventListener('click', () => AI.openPlanner(''));
  syncUI(); draw();
})();

