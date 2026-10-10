(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, $$, esc, param, toast, confirmBox, validate, isEmail } = UI;
  Admin.init('owner-integrasi', 'Google Drive & Email');
  const T = D.today();
  const G = $('#gf'), M = $('#mf');
  const ig = () => DB.settings().integration || {};

  function load() {
    const x = ig();
    G.elements.driveAccount.value = x.driveAccount || ''; G.elements.driveRoot.value = x.driveRoot || 'ANNAPURNA ADVENTURE';
    G.elements.autoMonthly.checked = !!x.autoMonthly; G.elements.sendDay.value = String(x.sendDay || 1); G.elements.sendTime.value = x.sendTime || '06:00';
    M.elements.ownerEmail.value = x.ownerEmail || ''; M.elements.ccEmails.value = x.ccEmails || '';
    $('#driveState').innerHTML = x.driveConnected
      ? `<span class="pill green plain"><i class="fa-solid fa-circle-check"></i> Terhubung</span> <button class="btn btn-light btn-xs" id="conn">Putuskan</button>`
      : `<span class="pill gray">Belum terhubung</span> <button class="btn btn-primary btn-xs" id="conn"><i class="fa-brands fa-google"></i> Hubungkan</button>`;
    $('#conn').addEventListener('click', toggleConn);
    const next = new Date(); next.setDate(1); next.setMonth(next.getMonth() + 1); next.setDate(x.sendDay || 1);
    const nextPeriod = T.slice(0, 7);
    $('#nextRun').innerHTML = x.autoMonthly && x.driveConnected
      ? `<i class="fa-solid fa-calendar-check"></i><div>Rekap <strong>${Reports.monthName(nextPeriod)}</strong> akan dibuat otomatis pada <strong>${D.fmtDate(D.toISO(next), true)} pukul ${esc(x.sendTime || '06:00')}</strong>, disimpan ke Drive, lalu dikirim ke ${esc(x.ownerEmail || '-')}${x.ccEmails ? ` (CC: ${esc(x.ccEmails)})` : ''}.</div>`
      : '<i class="fa-solid fa-circle-pause"></i><div>Rekap otomatis sedang nonaktif. Rekap tetap bisa dibuat manual dari arsip di bawah.</div>';
    $('#nextRun').className = `notice ${x.autoMonthly && x.driveConnected ? 'green' : ''}`;
  }
  async function toggleConn() {
    const x = ig();
    if (x.driveConnected && !(await confirmBox({ title: 'Putuskan Google Drive?', text: 'Rekap otomatis tidak akan diunggah sampai Drive dihubungkan lagi. Arsip yang sudah ada tidak terhapus.', ok: 'Putuskan', danger: true }))) return;
    const next = Object.assign({}, DB.settings()); next.integration = Object.assign({}, x, { driveConnected: !x.driveConnected });
    DB.saveSettings(next);
    DB.audit({ type: 'pengaturan', action: `${x.driveConnected ? 'Memutuskan' : 'Menghubungkan'} integrasi Google Drive (${x.driveAccount || '-'})` });
    toast(x.driveConnected ? 'Google Drive diputuskan.' : 'Google Drive terhubung.'); load(); drawDrive();
  }
  $('#saveInt').addEventListener('click', () => {
    const okG = validate(G, { driveAccount: (v) => (!isEmail(v) ? 'Email Google tidak valid.' : ''), driveRoot: (v) => (v.length < 3 ? 'Isi nama folder.' : ''), sendTime: (v) => (!v ? 'Isi jam.' : '') });
    const okM = validate(M, { ownerEmail: (v) => (!isEmail(v) ? 'Email tidak valid.' : ''), ccEmails: (v) => (v && v.split(',').some((e) => !isEmail(e.trim())) ? 'Ada email CC yang tidak valid.' : '') });
    if (!okG || !okM) return;
    const next = Object.assign({}, DB.settings());
    next.integration = Object.assign({}, ig(), { driveAccount: G.elements.driveAccount.value.trim(), driveRoot: G.elements.driveRoot.value.trim().toUpperCase(), autoMonthly: G.elements.autoMonthly.checked,
      sendDay: +G.elements.sendDay.value, sendTime: G.elements.sendTime.value, ownerEmail: M.elements.ownerEmail.value.trim(), ccEmails: M.elements.ccEmails.value.split(',').map((e) => e.trim()).filter(Boolean).join(', ') });
    toast(DB.saveSettings(next) ? 'Pengaturan integrasi disimpan.' : 'Tidak ada perubahan.'); load();
  });

  /* ---------- Pembersihan data setelah rekap ---------- */
  function drawCleanup() {
    const mode = DB.cleanupMode(); $$('input[name="clMode"]').forEach((r) => { r.checked = r.value === mode; });
    const pend = DB.cleanupPending(); const req = DB.cleanupReq();
    const A = DB.archives().slice().sort((a, b) => b.period.localeCompare(a.period));
    const todo = A.filter((a) => !a.purged);
    const done = A.filter((a) => a.purged);
    const lbl = { bookings: 'pesanan sewa', sales: 'pembelian', logs: 'log', notifications: 'notifikasi', emails: 'email', finance: 'catatan kas', photos: 'berisi foto' };
    const txt = (c) => Object.entries(c).filter(([k, v]) => v && k !== 'photos').map(([k, v]) => `${v} ${lbl[k]}`).join(' · ') || 'tidak ada data lama';
    $('#clPrev').innerHTML = `${pend.length && mode === 'approve' ? `<div class="cl-wait"><i class="fa-solid fa-hourglass-half"></i><div><b>Menunggu persetujuanmu</b><small>${pend.map((x) => Reports.monthName(x.a.period)).join(', ')} · ${pend.reduce((a, x) => a + x.p.total, 0)} data${req.snoozeUntil > T ? ` · diingatkan lagi ${D.fmtDate(req.snoozeUntil, true)}` : ''}${req.skipUntil > T ? ` · dilewati sampai ${D.fmtDate(req.skipUntil, true)}` : ''}</small></div><button class="btn btn-primary btn-sm" type="button" id="clReview2">Tinjau &amp; putuskan</button></div>` : ''}${todo.length ? `<h4 class="cfg-sub">Siap dibersihkan</h4>${todo.map((a) => { const p = DB.cleanupArchived(a.period, true);
      return `<div class="cl-row"><span><i class="fa-solid fa-folder"></i> <b>${esc(Reports.monthName(a.period))}</b> · rekap tersimpan ${D.fmtDateTime(a.createdAt)}</span><small>${p.ok ? txt(p.counts) : esc(p.reason)}</small><button class="btn btn-light btn-xs" data-clean="${a.period}" ${p.ok && p.total ? '' : 'disabled'}><i class="fa-solid fa-broom"></i> Bersihkan sekarang</button></div>`; }).join('')}` : ''}
      ${done.length ? `<h4 class="cfg-sub">Riwayat pembersihan</h4>${done.map((a) => `<div class="cl-row done"><span><i class="fa-solid fa-circle-check"></i> <b>${esc(Reports.monthName(a.period))}</b> · ${D.fmtDateTime(a.purged.at)} oleh ${esc(a.purged.by)}</span><small>${txt(a.purged.counts)} dihapus. Laporan tetap bisa diunduh dari arsip.</small></div>`).join('')}` : ''}
      ${!A.length ? '<p class="muted" style="font-size:13px">Belum ada rekap bulanan. Pembersihan berjalan setelah rekap pertama tersimpan.</p>' : ''}`;
  }
  const MODE_LBL = { approve: 'Minta persetujuan owner', auto: 'Otomatis', off: 'Nonaktif' };
  document.querySelector('.cl-modes').addEventListener('change', (e) => { if (e.target.name !== 'clMode') return; const st = DB.settings(); const from = DB.cleanupMode();
    DB.set('settings', Object.assign({}, st, { cleanup: { mode: e.target.value } }));
    DB.audit({ type: 'konfigurasi', action: 'Mengubah mode pembersihan data setelah rekap', changes: [{ field: 'Mode pembersihan', from: MODE_LBL[from], to: MODE_LBL[e.target.value] }] });
    toast(`Mode pembersihan: ${MODE_LBL[e.target.value]}.`); drawCleanup(); });
  document.addEventListener('click', (e) => { if (e.target.closest('#clReview2')) { const P = DB.cleanupPending(); if (P.length) Admin.cleanupModal(P); } });
  window.onCleanupDone = () => { drawCleanup(); drawDrive(); };
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-clean]'); if (!b) return;
    const p = b.dataset.clean; const pv = DB.cleanupArchived(p, true); if (!pv.ok) { toast(pv.reason, 'err'); return; }
    if (!(await confirmBox({ title: `Bersihkan data ${Reports.monthName(p)}?`, text: `Akan dihapus: ${pv.counts.bookings} pesanan sewa, ${pv.counts.sales} pembelian, ${pv.counts.logs} log, ${pv.counts.notifications} notifikasi, ${pv.counts.emails} email, ${pv.counts.finance} catatan kas (s.d. ${D.fmtDate(pv.endD, true)}). Semua sudah tersimpan di rekap Google Drive. Pesanan aktif & data barang tidak tersentuh.`, ok: 'Ya, bersihkan', danger: true }))) return;
    Reports.snapshot(p);
    const r = DB.cleanupArchived(p); if (!r.ok) toast(r.reason, 'err'); if (r.ok) { DB.setCleanupReq({ snoozeUntil: '', skipUntil: '' }); toast(`${r.total} data ${Reports.monthName(p)} dibersihkan.`); drawCleanup(); drawDrive(); }
  });

  function drawDrive() {
    const x = ig(); const A = DB.archives(); const open = param('folder');
    const years = [...new Set([T.slice(0, 4), ...A.map((a) => a.period.slice(0, 4))])].sort().reverse();
    const cur = T.slice(0, 7);
    $('#drive').innerHTML = `<div class="drive">
      <div class="drive-root"><i class="fa-brands fa-google-drive"></i> <strong>${esc(x.driveRoot || 'ANNAPURNA ADVENTURE')}</strong> <small class="muted">${esc(x.driveAccount || '')}</small></div>
      ${years.map((y) => { const months = A.filter((a) => a.period.startsWith(y));
        return `<details class="drive-f" ${y === T.slice(0, 4) || (open && open.startsWith(y)) ? 'open' : ''}><summary><i class="fa-solid fa-folder"></i> TAHUN ${y} <small>${months.length} folder</small></summary>
          ${months.map((a) => `<details class="drive-f sub" id="f-${a.period}" ${open === a.period ? 'open' : ''}><summary><i class="fa-solid fa-folder"></i> ${esc(Reports.folderName(a.period))} <small>${a.files.length} file · ${a.auto ? 'otomatis' : 'manual'} · ${D.fmtDateTime(a.createdAt)}${a.version > 1 ? ` · versi ${a.version}` : ''}</small></summary>
            <div class="drive-sum"><span>Rental <b>${a.summary.rental}</b></span><span>Penjualan <b>${a.summary.penjualan}</b></span><span>Pemasukan <b>${rupiah(a.summary.pemasukan)}</b></span><span>Pengeluaran <b>${rupiah(a.summary.pengeluaran)}</b></span><span>Aktivitas staff <b>${a.summary.aktivitas}</b></span></div>
            <ul class="drive-files">${a.files.map((f) => `<li><i class="fa-regular fa-file-pdf"></i><span>${esc(f.name)}</span><button class="btn btn-light btn-xs" data-dl="${a.period}|${f.type}"><i class="fa-solid fa-download"></i> Unduh</button></li>`).join('')}</ul>
            <div class="drive-acts"><button class="btn btn-light btn-xs" data-all="${a.period}"><i class="fa-solid fa-file-arrow-down"></i> Unduh semua</button><button class="btn btn-light btn-xs" data-mail="${a.mailId}"><i class="fa-regular fa-envelope"></i> Lihat email</button><button class="btn btn-light btn-xs" data-regen="${a.period}"><i class="fa-solid fa-rotate"></i> Perbarui &amp; kirim ulang</button></div>
          </details>`).join('')}
          ${y === T.slice(0, 4) ? `<div class="drive-f sub pending"><i class="fa-regular fa-folder"></i> ${esc(Reports.folderName(cur))} <small>dibuat otomatis awal bulan depan</small></div>` : ''}
        </details>`; }).join('')}</div>`;
    if (open) { const el = $('#f-' + open); if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); }
  }
  function drawOutbox() {
    const L = DB.outbox();
    $('#obCount').textContent = `${L.length} email`;
    const kind = { staff_invite: ['blue', 'Akun staff'], password_reset: ['amber', 'Reset sandi'], monthly_report: ['green', 'Rekap bulanan'] };
    $('#outbox').innerHTML = L.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Waktu</th><th>Jenis</th><th>Kepada</th><th>Subjek</th><th>Status</th><th class="num"></th></tr></thead><tbody>
      ${L.map((m) => { const k = kind[m.kind] || ['gray', m.kind]; return `<tr><td class="nw">${D.fmtDateTime(m.at)}</td><td><span class="pill ${k[0]}">${k[1]}</span></td><td>${esc(m.to)}</td><td style="min-width:220px">${esc(m.subject)}</td><td><span class="pill green plain"><i class="fa-solid fa-check"></i> Terkirim</span></td><td class="num"><button class="btn btn-light btn-xs" data-mail="${m.id}">Lihat</button></td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="muted">Belum ada email terkirim.</p>';
  }

  $('#genPeriod').max = T.slice(0, 7); $('#genPeriod').value = Reports.prevPeriod();
  $('#gen').addEventListener('click', async () => {
    const p = $('#genPeriod').value; if (!p) { toast('Pilih bulan.', 'err'); return; }
    if (!ig().driveConnected) { toast('Hubungkan Google Drive terlebih dahulu.', 'err'); return; }
    const exists = DB.archive(p);
    if (!(await confirmBox({ title: `${exists ? 'Perbarui' : 'Buat'} rekap ${Reports.monthName(p)}?`, text: `${exists ? 'Folder yang ada akan diperbarui dengan data terbaru. ' : ''}${Reports.MONTHLY.length} laporan PDF disimpan ke folder <strong>${esc(Reports.folderName(p))}</strong> dan email ringkasan dikirim ke ${esc(ig().ownerEmail)}.${p === T.slice(0, 7) ? '<br><br>Catatan: bulan berjalan belum selesai, datanya masih bisa bertambah.' : ''}`, ok: exists ? 'Perbarui' : 'Buat & kirim' }))) return;
    Reports.generateMonthly(p); toast(`Rekap ${Reports.monthName(p)} tersimpan dan email terkirim.`);
    history.replaceState(null, '', '?folder=' + p); drawDrive(); drawOutbox();
  });
  document.querySelector('.content').addEventListener('click', async (e) => {
    const dl = e.target.closest('[data-dl]'), all = e.target.closest('[data-all]'), ml = e.target.closest('[data-mail]'), rg = e.target.closest('[data-regen]');
    if (dl) { const [p, t] = dl.dataset.dl.split('|'); const h = dl.innerHTML; dl.disabled = true; dl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; try { await Reports.downloadArchiveFile(p, t); } catch (er) { console.error(er); toast('Gagal membuat PDF.', 'err'); } dl.disabled = false; dl.innerHTML = h; }
    if (all) { const p = all.dataset.all; all.disabled = true; for (const [t] of Reports.MONTHLY) { try { await Reports.downloadArchiveFile(p, t); } catch (er) { console.error(er); } await new Promise((r) => setTimeout(r, 350)); } all.disabled = false; toast('Semua laporan diunduh.'); }
    if (ml) { const m = DB.outbox().find((x) => x.id === ml.dataset.mail); if (m) Reports.mailModal(m); }
    if (rg) { const p = rg.dataset.regen; if (!(await confirmBox({ title: `Perbarui rekap ${Reports.monthName(p)}?`, text: 'Folder diperbarui dengan data terbaru dan email ringkasan dikirim ulang ke Owner.', ok: 'Perbarui & kirim' }))) return; Reports.generateMonthly(p); toast('Rekap diperbarui.'); drawDrive(); drawOutbox(); }
  });
  load(); drawDrive(); drawOutbox();
  drawCleanup();
})();
