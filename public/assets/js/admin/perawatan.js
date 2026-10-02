(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, esc, asset, toast, modal, confirmBox } = UI;
  Admin.init('perawatan', 'Perawatan Unit');
  const every = () => DB.settings().serviceEvery || 10;

  $('#careExplain').innerHTML = `<div class="ce-grid">
    <div class="ce cuci"><i class="fa-solid fa-soap"></i><div><b>Pembersihan</b><small>Setiap barang kembali. Kategori yang wajib dicuci diatur Owner. Unit belum bisa diserahkan sampai ditandai bersih.</small></div></div>
    <div class="ce fix"><i class="fa-solid fa-screwdriver-wrench"></i><div><b>Perbaikan</b><small>Saat ada kerusakan (sobek, patah, resleting rusak). Unit tidak dihitung di stok sampai selesai diperbaiki.</small></div></div>
    <div class="ce rutin"><i class="fa-solid fa-calendar-check"></i><div><b>Perawatan berkala</b><small>Pengecekan menyeluruh setiap ${every()} kali disewa (cek frame, lapisan anti air). Hanya pengingat, unit tetap bisa disewa.</small></div></div></div>`;

  const ago = (iso) => { if (!iso) return ''; const d = D.diffDays(D.day(iso), D.today()); return d <= 0 ? 'hari ini' : d === 1 ? 'kemarin' : `${d} hari lalu`; };
  const row = (x, kind) => {
    const { p, u } = x; const ci = u.careInfo || {};
    const sub = kind === 'cuci' ? `Masuk antrian ${ago(ci.since)}${ci.booking ? ` · dari ${ci.booking}` : ''}${ci.by ? ` · oleh ${esc(ci.by)}` : ''}`
      : kind === 'perbaikan' ? `<b class="issue">${esc(ci.issue || '-')}</b> · dilaporkan ${ago(ci.since)}${ci.booking ? ` · dari ${ci.booking}` : ''}${ci.by ? ` · oleh ${esc(ci.by)}` : ''}`
        : `Sudah ${u.sinceService}× disewa sejak perawatan terakhir${u.lastService ? ` (${D.fmtDate(u.lastService)})` : ''}`;
    const act = kind === 'cuci' ? `<button class="btn btn-primary btn-sm" data-clean="${p.id}|${u.code}"><i class="fa-solid fa-check"></i> Sudah bersih</button>`
      : kind === 'perbaikan' ? `<button class="btn btn-primary btn-sm" data-fixed="${p.id}|${u.code}"><i class="fa-solid fa-check"></i> Selesai diperbaiki</button><button class="btn btn-light btn-sm" data-retire="${p.id}|${u.code}" title="Tidak bisa diperbaiki">Tidak bisa diperbaiki</button>`
        : u.out ? `<span class="muted care-wait"><i class="fa-solid fa-person-hiking"></i> Sedang disewa (${u.out}) — kerjakan setelah kembali</span>` : `<button class="btn btn-light btn-sm" data-rutin="${p.id}|${u.code}"><i class="fa-solid fa-clipboard-check"></i> Catat perawatan</button>`;
    return `<div class="care-row"><img src="${asset(p.img)}" alt=""><div class="cr-bd"><b><span class="mono">${u.code}</span> · ${esc(p.name)}${u.size ? ` · ${esc(String(u.size).replace(/\s*\(.*\)/, ''))}` : ''}</b><small>${sub}</small></div><div class="cr-act">${act}</div></div>`;
  };
  const sec = (k, ic, t, empty, list, bulk) => `<section class="panel care-sec ${k}"><div class="panel-h"><h3><i class="fa-solid ${ic}"></i> ${t} <span class="cnt">${list.length}</span></h3>${bulk && list.length > 1 ? `<button class="btn btn-light btn-sm" data-bulk="${k}">Tandai semua sudah bersih</button>` : ''}</div>${list.length ? list.map((x) => row(x, k)).join('') : `<p class="care-empty"><i class="fa-regular fa-circle-check"></i> ${empty}</p>`}</section>`;

  function draw() {
    const q = DB.careQueue();
    const st = (ic, tone, l, v, d) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></div>`;
    $('#careStats').innerHTML = st('fa-soap', 'blue', 'Perlu dicuci', q.cuci.length + ' unit', 'belum bisa diserahkan') + st('fa-screwdriver-wrench', 'red', 'Dalam perbaikan', q.perbaikan.length + ' unit', 'tidak dihitung di stok') + st('fa-calendar-check', 'gold', 'Jatuh tempo perawatan', q.berkala.length + ' unit', `tiap ${every()}× disewa`);
    $('#careBody').innerHTML = sec('cuci', 'fa-soap', 'Perlu dicuci / dibersihkan', 'Tidak ada antrian cuci.', q.cuci, true)
      + sec('perbaikan', 'fa-screwdriver-wrench', 'Dalam perbaikan', 'Tidak ada unit yang sedang diperbaiki.', q.perbaikan)
      + sec('berkala', 'fa-calendar-check', 'Jatuh tempo perawatan berkala', 'Semua unit masih dalam jadwal perawatan.', q.berkala);
    Admin.refreshShell && Admin.refreshShell();
  }
  const split = (v) => v.split('|');
  document.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-clean]'), f = e.target.closest('[data-fixed]'), r = e.target.closest('[data-rutin]'), rt = e.target.closest('[data-retire]'), bk = e.target.closest('[data-bulk]');
    if (c) { const [pid, code] = split(c.dataset.clean); DB.finishCare(pid, code); toast(`${code} sudah bersih dan siap disewa.`); draw(); }
    if (bk) { const q = DB.careQueue().cuci; if (!(await confirmBox({ title: `Tandai ${q.length} unit sudah bersih?`, text: 'Pastikan semua unit benar-benar sudah dicuci & kering.', ok: 'Ya, sudah bersih' }))) return; q.forEach(({ p, u }) => DB.finishCare(p.id, u.code)); toast(`${q.length} unit siap disewa.`); draw(); }
    if (f) {
      const [pid, code] = split(f.dataset.fixed); const p = DB.product(pid); const u = p.units.find((x) => x.code === code);
      const m = modal({ title: `Selesai diperbaiki · ${code}`, body: `<div class="notice" style="margin-bottom:12px"><i class="fa-solid fa-screwdriver-wrench"></i><div>Kerusakan: <b>${esc((u.careInfo || {}).issue || '-')}</b></div></div>
        <div class="field"><label>Yang dikerjakan</label><input class="input" id="fxN" placeholder="Contoh: flysheet dijahit & dilapisi seam sealer"></div>
        <div class="grid-2"><div class="field"><label>Biaya perbaikan (Rp)</label><input class="input" type="number" min="0" step="1000" id="fxC" value="0"><span class="hint">Bila diisi, otomatis tercatat sebagai pengeluaran.</span></div>
        <div class="field"><label>Kondisi setelah diperbaiki</label><select class="select" id="fxK">${DB.COND_LIST.map((x) => `<option ${x === 'Baik' ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
        ${DB.needsWash(p) ? '<label class="chk-line"><input type="checkbox" id="fxW"> Cuci dulu sebelum disewakan lagi</label>' : ''}`,
        foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="fxOk"><i class="fa-solid fa-check"></i> Simpan</button>' });
      m.$('#fxOk').addEventListener('click', () => {
        const note = m.$('#fxN').value.trim(); if (!note) { m.$('#fxN').classList.add('err'); m.$('#fxN').focus(); return; }
        DB.finishCare(pid, code, { note, cost: Math.max(0, +m.$('#fxC').value || 0), cond: m.$('#fxK').value });
        if (m.$('#fxW') && m.$('#fxW').checked) DB.setCare(pid, code, 'cuci');
        m.close(); toast(`${code} selesai diperbaiki.`); draw();
      });
    }
    if (rt) {
      const [pid, code] = split(rt.dataset.retire);
      const x = await confirmBox({ title: `Unit ${code} tidak bisa diperbaiki?`, text: 'Unit dinonaktifkan dan tidak dihitung lagi di stok. Riwayatnya tetap tersimpan.', ok: 'Nonaktifkan unit', danger: true, input: { label: 'Alasan', required: true, error: 'Alasan wajib diisi.' } });
      if (x === false) return; DB.updateUnit(pid, code, { status: 'nonaktif', care: null, notes: x }, `Tidak bisa diperbaiki — unit dinonaktifkan: ${x}`); toast(`${code} dinonaktifkan.`); draw();
    }
    if (r) {
      const [pid, code] = split(r.dataset.rutin);
      const m = modal({ title: `Catat perawatan berkala · ${code}`, body: `<p class="muted" style="font-size:13.5px;margin-bottom:12px">Pengecekan menyeluruh rutin, bukan perbaikan kerusakan.</p>
        <div class="field"><label>Yang dicek / dikerjakan</label><input class="input" id="rtN" placeholder="Contoh: cek frame & pasak, lapisi ulang anti air"></div>
        <div class="field"><label>Biaya (Rp)</label><input class="input" type="number" min="0" step="1000" id="rtC" value="0"></div>
        <label class="chk-line"><input type="checkbox" id="rtF"> Ditemukan kerusakan — masukkan ke daftar perbaikan</label>`,
        foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rtOk">Simpan</button>' });
      m.$('#rtOk').addEventListener('click', () => {
        const note = m.$('#rtN').value.trim(); if (!note) { m.$('#rtN').classList.add('err'); return; }
        const cost = Math.max(0, +m.$('#rtC').value || 0);
        DB.updateUnit(pid, code, { sinceService: 0, lastService: D.nowStamp() }, `Perawatan berkala: ${note}`, cost ? [{ field: 'Biaya', from: '', to: rupiah(cost) }] : []);
        if (cost) DB.saveFinance('out', { id: DB.nextId('EXP', DB.expenses()), date: D.today(), category: DB.financeCats('out').find((x) => /perawatan/i.test(x)) || 'Perawatan Alat', desc: `Perawatan berkala ${code}: ${note}`, amount: cost });
        if (m.$('#rtF').checked) DB.setCare(pid, code, 'perbaikan', { issue: note });
        m.close(); toast('Perawatan berkala tercatat.'); draw();
      });
    }
  });
  draw();
})();
