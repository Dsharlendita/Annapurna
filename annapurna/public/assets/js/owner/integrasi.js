(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, $$, esc, param, toast, confirmBox, validate, isEmail } = UI;
  Admin.init('owner-integrasi', 'Google Drive & Email');
  const T = D.today();
  const G = $('#gf'), M = $('#mf');
  const ig = () => DB.settings().integration || {};
  /* Status sungguhan dari server (BootController::userData): akun Drive yang terhubung & apakah email aktif */
  const info = () => DB.driveInfo() || {};
  const base = document.body.dataset.base || '/';

  /* Hasil kembali dari halaman izin Google (?drive=…). Gagal karena izin → petunjuk tetap tampil di atas (bukan toast sesaat) */
  let connFail = '';
  (function connectResult() {
    const r = param('drive'); if (!r) return;
    const MSG = {
      terhubung: ['ok', `Google Drive terhubung (${info().email || ''}).`],
      putus: ['ok', 'Google Drive diputuskan.'],
      batal: ['err', 'Menghubungkan Google Drive dibatalkan.'],
      izin: ['err', 'Google Drive belum terhubung: kotak izin di halaman Google belum dicentang. Lihat petunjuk di atas.'],
      'belum-aktif': ['err', 'Login Google belum diatur di server (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di .env).'],
      gagal: ['err', 'Gagal menghubungkan Google Drive. Coba lagi.'],
    };
    const m = MSG[r] || MSG.gagal;
    if (r === 'izin') connFail = r;
    if (r === 'terhubung') DB.audit({ type: 'pengaturan', action: `Menghubungkan Google Drive (${info().email || '-'})` });
    setTimeout(() => toast(m[1], m[0] === 'ok' ? undefined : 'err'), 300);
    const u = new URL(location.href); u.searchParams.delete('drive'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  })();

  function notice() {
    const i = info();
    let html;
    if (!i.enabled) html = '<div class="notice amber"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Google belum diatur di server.</strong> Isi GOOGLE_CLIENT_ID &amp; GOOGLE_CLIENT_SECRET di file .env agar Google Drive bisa dihubungkan.</div></div>';
    else if (!i.connected && connFail === 'izin') html = '<div class="notice red"><i class="fa-solid fa-circle-exclamation"></i><div><strong>Google Drive belum terhubung karena izin Drive belum dicentang.</strong> '
      + 'Di halaman izin Google ada <b>kotak centang untuk file Google Drive</b> (atau pilihan <b>Pilih semua</b>). Kotak itu harus dicentang sebelum menekan <b>Lanjutkan</b>. Tekan <b>Hubungkan</b> lagi untuk mencoba.'
      + '<br><span class="muted">Kotak "Buat rekap otomatis setiap bulan" di halaman ini tidak ada hubungannya: Drive bisa dihubungkan walau kotak itu tidak dicentang.</span></div></div>';
    else if (!i.connected) html = '<div class="notice amber"><i class="fa-brands fa-google-drive"></i><div><strong>Google Drive belum terhubung.</strong> Tekan <b>Hubungkan</b>, pilih akun Google toko, lalu di halaman Google <b>centang kotak izin file Google Drive</b> dan tekan <b>Lanjutkan</b>. Rekap belum bisa disimpan sebelum terhubung.</div></div>';
    else html = `<div class="notice green"><i class="fa-solid fa-circle-check"></i><div><strong>Terhubung ke Google Drive ${esc(i.email)}.</strong> Rekap disimpan sungguhan di Drive akun ini${i.rootUrl ? ` (<a href="${esc(i.rootUrl)}" target="_blank" rel="noopener">buka folder utama</a>)` : ''}.`
      + (i.mailOn ? '' : ' <br><span class="muted">Email ringkasan belum aktif karena server email belum diatur. Link folder tetap bisa dibuka dari halaman ini.</span>') + '</div></div>';
    $('#driveNotice').innerHTML = html;
  }

  function load() {
    const x = ig(), i = info();
    G.elements.driveRoot.value = x.driveRoot || 'ANNAPURNA ADVENTURE';
    G.elements.autoMonthly.checked = !!x.autoMonthly; G.elements.sendDay.value = String(x.sendDay || 1); G.elements.sendTime.value = x.sendTime || '06:00';
    M.elements.ownerEmail.value = x.ownerEmail || ''; M.elements.ccEmails.value = x.ccEmails || '';
    $('#driveAcc').innerHTML = i.connected ? `<i class="fa-brands fa-google"></i> ${esc(i.email)}` : '<span class="muted">Belum ada akun terhubung</span>';
    $('#driveState').innerHTML = i.connected
      ? `<span class="pill green plain"><i class="fa-solid fa-circle-check"></i> Terhubung</span> <button class="btn btn-light btn-xs" id="conn">Putuskan</button>`
      : `<span class="pill gray">Belum terhubung</span> <button class="btn btn-primary btn-xs" id="conn" ${i.enabled ? '' : 'disabled'}><i class="fa-brands fa-google"></i> Hubungkan</button>`;
    $('#conn').addEventListener('click', toggleConn);
    const next = new Date(); next.setDate(1); next.setMonth(next.getMonth() + 1); next.setDate(x.sendDay || 1);
    const nextPeriod = T.slice(0, 7);
    $('#nextRun').innerHTML = x.autoMonthly && i.connected
      ? `<i class="fa-solid fa-calendar-check"></i><div>Rekap <strong>${Reports.monthName(nextPeriod)}</strong> dibuat otomatis mulai <strong>${D.fmtDate(D.toISO(next), true)} pukul ${esc(x.sendTime || '06:00')} WIB</strong>, saat panel admin/owner pertama kali dibuka, lalu disimpan ke Google Drive${i.mailOn ? (x.ownerEmail ? ` dan ringkasannya dikirim ke ${esc(x.ownerEmail)}${x.ccEmails ? ` (CC: ${esc(x.ccEmails)})` : ''}` : `${x.ccEmails ? ` dan ringkasannya dikirim ke ${esc(x.ccEmails)}` : ' (email ringkasan tidak dikirim karena Email Owner kosong)'}`) : ''}. Bila sampai pukul 10.00 belum dibuat, Owner diingatkan lewat notifikasi.</div>`
      : `<i class="fa-solid fa-circle-pause"></i><div>Rekap otomatis sedang nonaktif${i.connected ? '' : ' (Google Drive belum terhubung)'}. Rekap tetap bisa dibuat manual dari arsip di bawah.</div>`;
    $('#nextRun').className = `notice ${x.autoMonthly && i.connected ? 'green' : ''}`;
    notice();
  }
  async function toggleConn(e) {
    const i = info();
    if (!i.connected) { e.currentTarget.disabled = true; location.href = base + 'owner/integrasi/google/hubungkan'; return; }
    if (!(await confirmBox({ title: 'Putuskan Google Drive?', text: `Izin akses Drive ${esc(i.email)} akan dicabut. Rekap tidak akan diunggah sampai Drive dihubungkan lagi. Folder & file yang sudah ada di Drive tidak terhapus.`, ok: 'Putuskan', danger: true }))) return;
    const r = await Api.busy(e.currentTarget, () => Api.del('api/owner/drive'), 'Memutuskan…'); if (!r) return;
    if (!r.ok) { toast(r.msg, 'err'); return; }
    DB.audit({ type: 'pengaturan', action: `Memutuskan Google Drive (${i.email || '-'})` });
    location.href = base + 'owner/integrasi?drive=putus';
  }
  $('#saveInt').addEventListener('click', () => {
    const okG = validate(G, { driveRoot: (v) => (v.length < 3 ? 'Isi nama folder.' : ''), sendTime: (v) => (!v ? 'Isi jam.' : '') });
    /* Email Owner boleh kosong: rekap tetap tersimpan di Drive, hanya email ringkasan yang tidak dikirim */
    const okM = validate(M, { ownerEmail: (v) => (v && !isEmail(v) ? 'Email tidak valid.' : ''), ccEmails: (v) => (v && v.split(',').some((e) => !isEmail(e.trim())) ? 'Ada email CC yang tidak valid.' : '') });
    if (!okG || !okM) return;
    const next = Object.assign({}, DB.settings());
    next.integration = Object.assign({}, ig(), { driveRoot: G.elements.driveRoot.value.trim().toUpperCase(), autoMonthly: G.elements.autoMonthly.checked,
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
    const chips = (c) => { const L2 = Object.entries(c).filter(([k, v]) => v && k !== 'photos'); return L2.length ? L2.map(([k, v]) => `<span class="cl-chip">${v} ${lbl[k]}</span>`).join('') : '<span class="cl-chip none">tidak ada data lama</span>'; };
    $('#clModePill').innerHTML = `<span class="pill ${mode === 'off' ? 'gray' : 'green'}">${MODE_LBL[mode]}</span>`;
    const card = (a, wait) => { const pv = DB.cleanupArchived(a.period, true);
      return `<div class="cl-card ${wait ? 'wait' : ''}"><div class="cl-card-h"><span class="ic"><i class="fa-solid ${wait ? 'fa-hourglass-half' : 'fa-folder-open'}"></i></span>
        <div><b>${esc(Reports.monthName(a.period))}</b><small>${wait ? 'Menunggu persetujuanmu' : 'Siap dibersihkan'} · rekap tersimpan ${D.fmtDateTime(a.createdAt)}</small></div>
        <span class="cl-total">${pv.ok ? pv.total : 0}<small>data lama</small></span></div>
        <div class="cl-chips">${pv.ok ? chips(pv.counts) : `<span class="cl-chip none">${esc(pv.reason)}</span>`}</div>
        ${wait && (req.snoozeUntil > T || req.skipUntil > T) ? `<p class="muted" style="font-size:12px;margin-top:6px">${req.snoozeUntil > T ? `Diingatkan lagi ${D.fmtDate(req.snoozeUntil, true)}` : `Dilewati sampai ${D.fmtDate(req.skipUntil, true)}`}</p>` : ''}
        <div class="cl-card-a">${wait ? '<button class="btn btn-primary btn-sm" type="button" id="clReview2"><i class="fa-solid fa-list-check"></i> Tinjau &amp; putuskan</button>' : `<button class="btn btn-primary btn-sm" data-clean="${a.period}" ${pv.ok && pv.total ? '' : 'disabled'}><i class="fa-solid fa-broom"></i> Bersihkan sekarang</button>`}</div></div>`; };
    const waitSet = new Set(mode === 'approve' ? pend.map((x) => x.a.period) : []);
    $('#clPrev').innerHTML = `${todo.length ? `<div class="cl-cards">${todo.map((a) => card(a, waitSet.has(a.period))).join('')}</div>` : (A.length ? '<div class="cl-ok"><i class="fa-solid fa-circle-check"></i> Semua rekap sudah dibersihkan. Tidak ada data lama yang perlu dihapus.</div>' : '<div class="cl-ok muted"><i class="fa-solid fa-circle-info"></i> Belum ada rekap bulanan. Pembersihan berjalan setelah rekap pertama tersimpan.</div>')}
      ${done.length ? `<details class="cl-hist"><summary>Riwayat pembersihan (${done.length})</summary>${done.map((a) => `<div class="cl-row done"><span><i class="fa-solid fa-circle-check"></i> <b>${esc(Reports.monthName(a.period))}</b> · ${D.fmtDateTime(a.purged.at)} oleh ${esc(a.purged.by)}</span><small>${txt(a.purged.counts)} dihapus.</small></div>`).join('')}</details>` : ''}`;
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
    const x = ig(), i = info(); const A = DB.archives(); const open = param('folder');
    const years = [...new Set([T.slice(0, 4), ...A.map((a) => a.period.slice(0, 4))])].sort().reverse();
    const cur = T.slice(0, 7);
    const mailPill = (a) => (a.mailStatus === 'terkirim' ? ' · email terkirim' : a.mailStatus === 'gagal' ? ' · email gagal' : '');
    $('#drive').innerHTML = `<div class="drive">
      <div class="drive-root"><i class="fa-brands fa-google-drive"></i> <strong>${esc(x.driveRoot || 'ANNAPURNA ADVENTURE')}</strong> <small class="muted">${esc(i.email || 'Google Drive belum terhubung')}</small>${i.rootUrl ? ` <a class="btn btn-light btn-xs" href="${esc(i.rootUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka di Drive</a>` : ''}</div>
      ${years.map((y) => { const months = A.filter((a) => a.period.startsWith(y));
        return `<details class="drive-f" ${y === T.slice(0, 4) || (open && open.startsWith(y)) ? 'open' : ''}><summary><i class="fa-solid fa-folder"></i> TAHUN ${y} <small>${months.length} folder</small></summary>
          ${months.map((a) => `<details class="drive-f sub" id="f-${a.period}" ${open === a.period ? 'open' : ''}><summary><i class="fa-solid fa-folder"></i> ${esc(Reports.folderName(a.period))} <small>${a.files.length} file · ${a.auto ? 'otomatis' : 'manual'} · ${D.fmtDateTime(a.createdAt)}${a.version > 1 ? ` · versi ${a.version}` : ''}${mailPill(a)}</small></summary>
            <div class="drive-sum"><span>Rental <b>${a.summary.rental}</b></span><span>Penjualan <b>${a.summary.penjualan}</b></span><span>Pemasukan <b>${rupiah(a.summary.pemasukan)}</b></span><span>Pengeluaran <b>${rupiah(a.summary.pengeluaran)}</b></span><span>Aktivitas staff <b>${a.summary.aktivitas}</b></span></div>
            <ul class="drive-files">${a.files.map((f) => `<li><i class="fa-regular fa-file-pdf"></i><span>${esc(f.name)}</span>${f.url ? `<a class="btn btn-light btn-xs" href="${esc(f.url)}" target="_blank" rel="noopener"><i class="fa-brands fa-google-drive"></i> Buka</a>` : ''}<button class="btn btn-light btn-xs" data-dl="${a.period}|${f.type}"><i class="fa-solid fa-download"></i> Unduh</button></li>`).join('')}</ul>
            <div class="drive-acts">${a.folderUrl ? `<a class="btn btn-primary btn-xs" href="${esc(a.folderUrl)}" target="_blank" rel="noopener"><i class="fa-brands fa-google-drive"></i> Buka folder di Drive</a>` : ''}<button class="btn btn-light btn-xs" data-all="${a.period}"><i class="fa-solid fa-file-arrow-down"></i> Unduh semua</button>${a.mailId ? `<button class="btn btn-light btn-xs" data-mail="${a.mailId}"><i class="fa-regular fa-envelope"></i> Lihat email</button>` : ''}<button class="btn btn-light btn-xs" data-regen="${a.period}"><i class="fa-solid fa-rotate"></i> Perbarui &amp; unggah ulang</button></div>
          </details>`).join('')}
          ${y === T.slice(0, 4) ? `<div class="drive-f sub pending"><i class="fa-regular fa-folder"></i> ${esc(Reports.folderName(cur))} <small>dibuat otomatis awal bulan depan</small></div>` : ''}
        </details>`; }).join('')}</div>`;
    if (open) { const el = $('#f-' + open); if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); }
  }
  /* Kotak keluar: 10 email per halaman (terbaru di atas) */
  let obPage = 1; const OB_PER = 10;
  function drawOutbox() {
    const L = DB.outbox().slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const pages = Math.max(1, Math.ceil(L.length / OB_PER)); obPage = Math.min(obPage, pages);
    const V = L.slice((obPage - 1) * OB_PER, obPage * OB_PER);
    $('#obCount').textContent = `${L.length} email`;
    const kind = { staff_invite: ['blue', 'Akun staff'], password_reset: ['amber', 'Reset sandi'], monthly_report: ['green', 'Rekap bulanan'] };
    $('#outbox').innerHTML = L.length ? `<div class="table-wrap" data-no-paginate><table class="table"><thead><tr><th>Waktu</th><th>Jenis</th><th>Kepada</th><th>Subjek</th><th>Status</th><th class="num"></th></tr></thead><tbody>
      ${V.map((m) => { const k = kind[m.kind] || ['gray', m.kind]; const st = m.status === 'nonaktif' ? '<span class="pill gray">Email belum aktif</span>' : m.status === 'gagal' ? '<span class="pill red">Gagal</span>' : '<span class="pill green plain"><i class="fa-solid fa-check"></i> Terkirim</span>'; return `<tr><td class="nw">${D.fmtDateTime(m.at)}</td><td><span class="pill ${k[0]}">${k[1]}</span></td><td>${esc(m.to)}</td><td style="min-width:220px">${esc(m.subject)}</td><td>${st}</td><td class="num"><button class="btn btn-light btn-xs" data-mail="${m.id}">Lihat</button></td></tr>`; }).join('')}</tbody></table></div>
      ${pages > 1 ? `<div class="ob-pager"><span>Menampilkan <b>${(obPage - 1) * OB_PER + 1}–${Math.min(obPage * OB_PER, L.length)}</b> dari <b>${L.length}</b></span><div class="pg">
        <button class="btn btn-light btn-xs" data-obp="${obPage - 1}" ${obPage === 1 ? 'disabled' : ''} aria-label="Sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>
        ${Array.from({ length: pages }, (_, i) => i + 1).map((n) => `<button class="btn btn-xs ${n === obPage ? 'btn-primary' : 'btn-light'}" data-obp="${n}">${n}</button>`).join('')}
        <button class="btn btn-light btn-xs" data-obp="${obPage + 1}" ${obPage === pages ? 'disabled' : ''} aria-label="Berikutnya"><i class="fa-solid fa-chevron-right"></i></button></div></div>` : ''}`
      : '<p class="muted">Belum ada email terkirim.</p>';
  }
  $('#outbox').addEventListener('click', (e) => { const b = e.target.closest('[data-obp]'); if (!b || b.disabled) return; obPage = +b.dataset.obp; drawOutbox(); });

  $('#genPeriod').max = T.slice(0, 7); $('#genPeriod').value = Reports.prevPeriod();
  /* Buat / perbarui rekap: PDF dibuat di browser lalu diunggah server ke Google Drive */
  async function runRekap(p, btn) {
    const r = await Api.busy(btn, () => Reports.generateMonthly(p), 'Mengunggah…'); if (!r) return;
    if (!r.ok) { toast(r.msg || 'Rekap gagal disimpan.', 'err'); if (r.reconnect) setTimeout(() => location.reload(), 1500); return; }
    const a = r.a;
    toast(`Rekap ${Reports.monthName(p)} tersimpan di Google Drive${a.mailStatus === 'terkirim' ? ` dan ringkasan dikirim ke ${a.mailTo}` : ''}.`);
    history.replaceState(null, '', '?folder=' + p); drawDrive(); drawOutbox(); drawCleanup();
  }
  $('#gen').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const p = $('#genPeriod').value; if (!p) { toast('Pilih bulan.', 'err'); return; }
    if (!info().connected) { toast('Hubungkan Google Drive terlebih dahulu.', 'err'); return; }
    const exists = DB.archive(p);
    if (!(await confirmBox({ title: `${exists ? 'Perbarui' : 'Buat'} rekap ${Reports.monthName(p)}?`, text: `${exists ? 'File di folder Drive akan diganti dengan data terbaru. ' : ''}${Reports.MONTHLY.length} laporan PDF diunggah ke folder <strong>${esc(Reports.folderName(p))}</strong> di Google Drive ${esc(info().email)}${info().mailOn && ig().ownerEmail ? ` dan email ringkasan dikirim ke ${esc(ig().ownerEmail)}` : ''}.${p === T.slice(0, 7) ? '<br><br>Catatan: bulan berjalan belum selesai, datanya masih bisa bertambah.' : ''}`, ok: exists ? 'Perbarui' : 'Buat & unggah' }))) return;
    runRekap(p, btn);
  });
  window.onRekapDone = () => { drawDrive(); drawOutbox(); drawCleanup(); };
  document.querySelector('.content').addEventListener('click', async (e) => {
    const dl = e.target.closest('[data-dl]'), all = e.target.closest('[data-all]'), ml = e.target.closest('[data-mail]'), rg = e.target.closest('[data-regen]');
    if (dl) { const [p, t] = dl.dataset.dl.split('|'); const h = dl.innerHTML; dl.disabled = true; dl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; try { await Reports.downloadArchiveFile(p, t); } catch (er) { console.error(er); toast('Gagal membuat PDF.', 'err'); } dl.disabled = false; dl.innerHTML = h; }
    if (all) { const p = all.dataset.all; all.disabled = true; for (const [t] of Reports.MONTHLY) { try { await Reports.downloadArchiveFile(p, t); } catch (er) { console.error(er); } await new Promise((r) => setTimeout(r, 350)); } all.disabled = false; toast('Semua laporan diunduh.'); }
    if (ml) { const m = DB.outbox().find((x) => x.id === ml.dataset.mail); if (m) Reports.mailModal(m); }
    if (rg) { const p = rg.dataset.regen; if (!info().connected) { toast('Hubungkan Google Drive terlebih dahulu.', 'err'); return; } if (!(await confirmBox({ title: `Perbarui rekap ${Reports.monthName(p)}?`, text: `File di folder Google Drive diganti dengan data terbaru${info().mailOn ? ' dan email ringkasan dikirim ulang ke Owner' : ''}.`, ok: 'Perbarui & unggah' }))) return; runRekap(p, rg); }
  });
  load(); drawDrive(); drawOutbox();
  drawCleanup();
})();
