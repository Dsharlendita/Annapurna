(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, esc, modal, pill, toast, bindExport } = UI;
  Admin.init('owner-pelanggan', 'Data Pelanggan');
  const FL = { normal: ['Normal', 'green'], jaminan: ['Perlu jaminan tambahan', 'amber'], blacklist: ['Diblokir', 'red'] };
  const tier = (c) => (c.count >= 3 ? ['Langganan', 'blue'] : c.count ? ['Baru', 'gray'] : ['Belum transaksi', 'gray']);
  $('#filters').innerHTML = `<div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari nama, email, atau nomor HP…"></div>
    <select class="select" id="fFlag"><option value="">Semua status</option><option value="normal">Normal</option><option value="jaminan">Perlu jaminan</option><option value="blacklist">Diblokir</option><option value="late">Pernah terlambat</option></select>
    <select class="select" id="sort"><option value="total">Urut: nilai transaksi</option><option value="count">Urut: jumlah transaksi</option><option value="last">Urut: transaksi terakhir</option><option value="name">Urut: nama</option></select>
    <span style="flex:1"></span><span class="exp" id="exp">${UI.exportButtons()}</span>`;
  function list() {
    const q = $('#q').value.trim().toLowerCase(), f = $('#fFlag').value, so = $('#sort').value;
    return DB.customers().filter((c) => (!q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q)) && (!f || (f === 'late' ? c.late : (c.meta.flag || 'normal') === f)))
      .sort((a, b) => (so === 'name' ? a.name.localeCompare(b.name) : so === 'last' ? String(b.last).localeCompare(a.last) : b[so] - a[so]));
  }
  function draw() {
    const all = DB.customers();
    const st = (ic, tone, l, v, d) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></div>`;
    $('#stats').innerHTML = st('fa-users', '', 'Total pelanggan', all.length, `${all.filter((c) => c.registered).length} punya akun`) + st('fa-repeat', 'blue', 'Pelanggan langganan', all.filter((c) => c.count >= 3).length, '≥ 3 transaksi')
      + st('fa-sack-dollar', 'gold', 'Nilai transaksi', rupiah(all.reduce((a, c) => a + c.total, 0)), 'semua waktu') + st('fa-user-shield', 'red', 'Perlu perhatian', all.filter((c) => (c.meta.flag || 'normal') !== 'normal').length, `${all.filter((c) => c.late).length} pernah terlambat`);
    const L = list();
    $('#list').innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Pelanggan</th><th>Kontak</th><th class="num">Transaksi</th><th class="num">Nilai</th><th>Catatan perilaku</th><th>Status</th><th class="num"></th></tr></thead><tbody>
      ${L.length ? L.map((c) => { const t = tier(c); const f = FL[c.meta.flag || 'normal']; return `<tr><td><strong>${esc(c.name)}</strong><small><span class="pill ${t[1]} plain">${t[0]}</span>${c.last ? ` · terakhir ${D.fmtDate(c.last)}` : ''}</small></td>
        <td>${esc(c.phone || '-')}<small>${esc(c.email || '')}</small></td><td class="num">${c.rentals.length} sewa · ${c.sales.length} beli</td><td class="num">${rupiah(c.total)}</td>
        <td style="max-width:220px">${c.late ? `<span class="pill amber plain">${c.late}× terlambat</span> ` : ''}${c.cancel ? `<span class="pill gray plain">${c.cancel}× batal</span>` : ''}${c.meta.note ? `<small>${esc(c.meta.note)}</small>` : ''}${!c.late && !c.cancel && !c.meta.note ? '<span class="muted">—</span>' : ''}</td>
        <td><span class="pill ${f[1]}">${f[0]}</span></td><td><div class="acts"><button class="btn btn-light btn-xs" data-open="${esc(c.key)}">Detail</button></div></td></tr>`; }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Tidak ada pelanggan yang cocok.</td></tr>'}</tbody></table></div>`;
  }
  function detail(key) {
    const c = DB.customers().find((x) => x.key === key); if (!c) return;
    const tx = [...c.rentals.map((b) => ({ id: b.id, at: b.createdAt, t: 'Sewa', st: pill('rental', b.status), total: b.total, extra: `${D.fmtRange(b.start, b.end)}${b.ret && b.ret.lateDays ? ` · terlambat ${b.ret.lateDays} hari` : ''}`, href: `booking?id=${b.id}` })),
      ...c.sales.map((s) => ({ id: s.id, at: s.createdAt, t: 'Beli', st: pill('sale', s.status), total: s.total, extra: s.items.map((i) => `${i.qty}× ${i.name}`).join(', '), href: `penjualan?id=${s.id}` }))].sort((a, b) => String(b.at).localeCompare(a.at));
    const m = modal({ title: esc(c.name), size: 'lg', body: `<div class="kv-grid"><div class="kv"><span>Telepon</span><a href="${Admin.custLink(c)}" target="_blank" style="color:var(--g700);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ${esc(c.phone || '-')}</a></div><div class="kv"><span>Email</span><span>${esc(c.email || '-')}</span></div>
        <div class="kv"><span>Total transaksi</span><strong>${c.count}</strong></div><div class="kv"><span>Nilai dibayar</span><strong>${rupiah(c.total)}</strong></div></div>
      ${c.email ? `<div class="mini-sec"><h4>Status & catatan</h4><div class="seg-pick" style="grid-template-columns:repeat(3,1fr)">${Object.entries(FL).map(([k, [l]]) => `<label><input type="radio" name="flag" value="${k}" ${(c.meta.flag || 'normal') === k ? 'checked' : ''}><span><b>${l}</b><small>${k === 'normal' ? 'Proses biasa' : k === 'jaminan' ? 'Staff diberi peringatan saat barang keluar' : 'Tidak bisa checkout pesanan baru'}</small></span></label>`).join('')}</div>
        <div class="field" style="margin-top:10px"><label>Catatan internal (hanya dilihat staff & owner)</label><textarea class="textarea" id="cNote" rows="2">${esc(c.meta.note || '')}</textarea></div><button class="btn btn-primary btn-sm" id="cSave">Simpan</button></div>` : ''}
      <div class="mini-sec"><h4>Riwayat transaksi</h4>${tx.length ? tx.map((x) => `<div class="list-row"><span class="pill ${x.t === 'Sewa' ? 'green' : 'blue'} plain">${x.t}</span><div class="nm"><strong>${x.id} · ${rupiah(x.total)}</strong><small>${D.fmtDate(x.at)} · ${esc(x.extra)}</small></div>${x.st}<a class="btn btn-light btn-xs" href="${Admin.A(x.href)}">Buka</a></div>`).join('') : '<p class="muted">Belum ada transaksi.</p>'}</div>` });
    const sv = m.$('#cSave'); if (sv) sv.addEventListener('click', () => { DB.saveCustomerMeta(c.email, { flag: m.$('[name=flag]:checked').value, note: m.$('#cNote').value.trim() }, c.name); m.close(); toast('Catatan pelanggan disimpan.'); draw(); });
  }
  ['#q', '#fFlag', '#sort'].forEach((s) => $(s).addEventListener('input', draw));
  $('#list').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) detail(b.dataset.open); });
  bindExport($('#exp'), () => { const L = list(); return { filename: `data-pelanggan-${D.today()}`, title: 'Data Pelanggan', subtitle: `Per ${D.fmtDate(D.today(), true)}`,
    summary: [['Pelanggan', String(L.length)], ['Nilai transaksi', L.reduce((a, c) => a + c.total, 0)]],
    columns: [{ header: 'Nama' }, { header: 'Telepon' }, { header: 'Email' }, { header: 'Sewa', type: 'number' }, { header: 'Beli', type: 'number' }, { header: 'Nilai', type: 'money' }, { header: 'Terlambat', type: 'number' }, { header: 'Batal', type: 'number' }, { header: 'Status' }, { header: 'Catatan', width: 30 }],
    rows: L.map((c) => [c.name, c.phone, c.email, c.rentals.length, c.sales.length, c.total, c.late, c.cancel, FL[c.meta.flag || 'normal'][0], c.meta.note || '']) }; });
  if (UI.param('q')) $('#q').value = UI.param('q');
  draw();
})();
