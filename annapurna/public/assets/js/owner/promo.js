(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, esc, modal, toast, validate } = UI;
  Admin.init('owner-promo', 'Promo & Kode Diskon');
  const T = D.today();
  const AP = { rent: 'Sewa alat', buy: 'Belanja', all: 'Sewa & belanja' };
  const state = (p) => (!p.active ? ['Nonaktif', 'gray'] : T < p.start ? ['Terjadwal', 'blue'] : T > p.end ? ['Berakhir', 'gray'] : p.quota && p.used >= p.quota ? ['Kuota habis', 'amber'] : ['Berjalan', 'green']);
  const valTxt = (p) => (p.type === 'persen' ? `${p.value}%` : rupiah(p.value));
  $('#filters').innerHTML = '<span style="flex:1"></span><button class="btn btn-primary btn-sm" id="add"><i class="fa-solid fa-plus"></i> Buat promo</button>';
  function draw() {
    const L = DB.promos().slice().sort((a, b) => b.start.localeCompare(a.start));
    const st = (ic, tone, l, v, d) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></div>`;
    const disc = [...DB.bookings(), ...DB.sales()].filter((x) => x.discount && x.status !== 'dibatalkan');
    $('#stats').innerHTML = st('fa-ticket', '', 'Promo berjalan', L.filter((p) => state(p)[0] === 'Berjalan').length, `${L.length} total`) + st('fa-receipt', 'blue', 'Transaksi pakai promo', disc.length, '')
      + st('fa-tags', 'gold', 'Total diskon diberikan', rupiah(disc.reduce((a, x) => a + (x.discount.amount || 0), 0)), '') + st('fa-house', '', 'Tampil di beranda', L.filter((p) => p.home && state(p)[0] === 'Berjalan').length, '');
    $('#list').innerHTML = `<div class="promo-grid">${L.map((p) => { const s = state(p); return `<article class="promo-card ${p.active ? '' : 'row-off'}"><div class="pc-top"><span class="code">${esc(p.code)}</span><span class="pill ${s[1]}">${s[0]}</span></div>
      <h3>${esc(p.name)}</h3><p>${esc(p.desc || '')}</p>
      <div class="pc-facts"><span><b>${valTxt(p)}</b> ${AP[p.applies]}</span>${p.minTotal ? `<span>Min. ${rupiah(p.minTotal)}</span>` : ''}${p.weekday ? '<span>Senin–Kamis</span>' : ''}<span>${D.fmtDate(p.start)} – ${D.fmtDate(p.end)}</span><span>Dipakai ${p.used}${p.quota ? `/${p.quota}` : ''}</span>${p.home ? '<span><i class="fa-solid fa-house"></i> Beranda</span>' : ''}</div>
      <div class="acts" style="justify-content:flex-start"><button class="btn btn-light btn-xs" data-edit="${p.id}"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn btn-light btn-xs" data-toggle="${p.id}">${p.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></article>`; }).join('') || '<p class="muted">Belum ada promo.</p>'}</div>`;
  }
  function form(p) {
    const isNew = !p; p = p ? Object.assign({}, p) : { id: '', code: '', name: '', desc: '', type: 'persen', value: 10, applies: 'rent', minTotal: 0, start: T, end: D.addDays(T, 30), weekday: false, quota: 0, used: 0, active: true, home: true };
    const m = modal({ title: isNew ? 'Buat promo' : `Edit promo ${esc(p.code)}`, size: 'lg', body: `<form id="pf" novalidate>
      <div class="grid-2"><div class="field"><label>Kode promo</label><input class="input" name="code" value="${esc(p.code)}" placeholder="HEMAT20" style="text-transform:uppercase" ${isNew ? '' : 'readonly'}></div><div class="field"><label>Nama promo</label><input class="input" name="pname" value="${esc(p.name)}" placeholder="Hemat Akhir Bulan"></div></div>
      <div class="field"><label>Deskripsi (tampil ke customer)</label><input class="input" name="desc" value="${esc(p.desc || '')}"></div>
      <div class="grid-3"><div class="field"><label>Jenis potongan</label><select class="select" name="type"><option value="persen" ${p.type === 'persen' ? 'selected' : ''}>Persentase (%)</option><option value="nominal" ${p.type === 'nominal' ? 'selected' : ''}>Nominal (Rp)</option></select></div>
        <div class="field"><label>Besar potongan</label><input class="input" type="number" min="1" name="value" value="${p.value}"></div>
        <div class="field"><label>Berlaku untuk</label><select class="select" name="applies">${Object.entries(AP).map(([k, l]) => `<option value="${k}" ${p.applies === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="grid-4"><div class="field"><label>Mulai</label><input class="input" type="date" name="start" value="${p.start}"></div><div class="field"><label>Berakhir</label><input class="input" type="date" name="end" value="${p.end}"></div>
        <div class="field"><label>Minimal transaksi (Rp)</label><input class="input" type="number" min="0" step="10000" name="minTotal" value="${p.minTotal || 0}"></div><div class="field"><label>Kuota pemakaian</label><input class="input" type="number" min="0" name="quota" value="${p.quota || 0}"><span class="hint">0 = tanpa batas</span></div></div>
      <label class="chk-line"><input type="checkbox" name="weekday" ${p.weekday ? 'checked' : ''}> Hanya untuk tanggal ambil Senin–Kamis (sewa hari kerja)</label>
      <label class="chk-line"><input type="checkbox" name="home" ${p.home ? 'checked' : ''}> Tampilkan di beranda website</label></form>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="pSave">Simpan promo</button>' });
    m.$('#pSave').addEventListener('click', () => {
      const F = m.$('#pf'), E = F.elements; const code = E.code.value.trim().toUpperCase().replace(/\s+/g, '');
      if (!validate(F, { code: () => (!/^[A-Z0-9]{4,16}$/.test(code) ? '4–16 huruf/angka tanpa spasi.' : isNew && DB.promos().some((x) => x.code === code) ? 'Kode sudah dipakai.' : ''), pname: (v) => (v.length < 3 ? 'Isi nama promo.' : ''),
        value: (v) => (!(+v > 0) ? 'Tidak valid.' : E.type.value === 'persen' && +v > 90 ? 'Maksimal 90%.' : ''), end: (v) => (!v || v < E.start.value ? 'Tanggal berakhir tidak valid.' : '') })) return;
      const next = Object.assign({}, p, { id: p.id || 'PR-' + Date.now().toString(36), code, name: E.pname.value.trim(), desc: E.desc.value.trim(), type: E.type.value, value: +E.value.value, applies: E.applies.value, start: E.start.value, end: E.end.value,
        minTotal: +E.minTotal.value || 0, quota: +E.quota.value || 0, weekday: E.weekday.checked, home: E.home.checked });
      const ch = isNew ? [{ field: 'Potongan', from: '', to: `${valTxt(next)} · ${AP[next.applies]}` }, { field: 'Periode', from: '', to: `${D.fmtDate(next.start)} – ${D.fmtDate(next.end)}` }]
        : [['value', 'Potongan'], ['type', 'Jenis'], ['applies', 'Berlaku untuk'], ['start', 'Mulai'], ['end', 'Berakhir'], ['minTotal', 'Minimal'], ['quota', 'Kuota'], ['weekday', 'Hanya Senin–Kamis'], ['home', 'Tampil di beranda'], ['name', 'Nama']].filter(([k]) => p[k] !== next[k]).map(([k, l]) => ({ field: l, from: String(p[k]), to: String(next[k]) }));
      DB.savePromo(next, `${isNew ? 'Membuat' : 'Mengubah'} promo ${code}`, ch); m.close(); toast('Promo disimpan.'); draw();
    });
  }
  $('#add').addEventListener('click', () => form());
  $('#list').addEventListener('click', (e) => { const ed = e.target.closest('[data-edit]'), tg = e.target.closest('[data-toggle]');
    if (ed) form(DB.promos().find((x) => x.id === ed.dataset.edit));
    if (tg) { const p = Object.assign({}, DB.promos().find((x) => x.id === tg.dataset.toggle)); p.active = !p.active; DB.savePromo(p, `${p.active ? 'Mengaktifkan' : 'Menonaktifkan'} promo ${p.code}`, [{ field: 'Status', from: p.active ? 'Nonaktif' : 'Aktif', to: p.active ? 'Aktif' : 'Nonaktif' }]); draw(); } });
  draw();
})();
