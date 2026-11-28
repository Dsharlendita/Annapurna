(function () {
  const { DB, D } = Ann; const { $, $$, esc, toast, validate, isPhone, param, confirmBox, url } = UI;
  let user = Site.requireLogin(); if (!user) return;

  function head() {
    user = DB.session();
    $('#av').textContent = user.name.trim().charAt(0).toUpperCase();
    $('#pName').textContent = user.name; $('#pEmail').textContent = user.email;
    const bk = DB.bookings().filter((b) => b.customer.email === user.email);
    const sl = DB.sales().filter((s) => s.customer.email === user.email);
    $('#sRent').textContent = bk.filter((b) => !['selesai', 'dibatalkan'].includes(b.status)).length;
    $('#sBuy').textContent = sl.filter((s) => !['selesai', 'dibatalkan'].includes(s.status)).length;
    $('#sHist').textContent = bk.filter((b) => ['selesai', 'dibatalkan'].includes(b.status)).length + sl.filter((s) => ['selesai', 'dibatalkan'].includes(s.status)).length;
  }
  const f = $('#fData');
  f.elements.fullname.value = user.name; f.elements.phone.value = user.phone || ''; f.elements.address.value = user.address || ''; $('#email').value = user.email;
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(f, { fullname: (v) => (v.length < 3 ? 'Nama minimal 3 huruf.' : ''), phone: (v) => (!isPhone(v) ? 'Nomor WhatsApp tidak valid (contoh 0812xxxxxxx).' : '') })) return;
    const data = { name: f.elements.fullname.value.trim(), phone: f.elements.phone.value.trim(), address: f.elements.address.value.trim() };
    /* Disimpan ke server dulu (dulu hanya di browser, lalu kembali ke data lama saat halaman dimuat ulang) */
    const r = await Api.busy(f.querySelector('[type="submit"]'), () => Api.post('api/akun/profil', data, { redirectOn401: false }), 'Menyimpan…');
    if (!r) return;
    if (!r.ok) { toast(r.msg || 'Profil belum tersimpan. Coba lagi.', 'err'); return; }
    DB.updateProfile(data);
    Site.renderHeader(); head(); toast('Profil berhasil diperbarui.');
  });

  const p = $('#fPw');
  /* Akun yang dibuat lewat Google belum punya kata sandi: tidak ada "kata sandi lama" */
  const noPw = (DB.session() || {}).hasPassword === false;
  if (noPw && p.elements.old) {
    const fo = p.elements.old.closest('.field'); if (fo) fo.hidden = true;
    p.insertAdjacentHTML('afterbegin', '<p class="muted" id="pwGoogleNote" style="font-size:13px;margin-bottom:10px">Akunmu masuk lewat Google. Buat kata sandi kalau ingin bisa masuk juga dengan email &amp; kata sandi.</p>');
  }
  p.addEventListener('submit', async (e) => {
    e.preventDefault();
    const needOld = !((DB.session() || {}).hasPassword === false);
    if (!validate(p, { old: (v) => (needOld && !v ? 'Isi kata sandi lama.' : ''), npw: (v) => (v.length < 6 ? 'Minimal 6 karakter.' : ''), cpw: (v) => (v !== p.elements.npw.value ? 'Konfirmasi kata sandi tidak sama.' : '') })) return;
    const r = await Api.busy(p.querySelector('[type="submit"]'), () => Api.changePassword(needOld ? p.elements.old.value : '', p.elements.npw.value), 'Menyimpan…');
    if (!r) return;
    if (!r.ok) { if (r.field === 'old') validate(p, { old: () => r.msg || 'Kata sandi lama salah.' }); else toast(r.msg, 'err'); return; }
    if (!needOld) { const s = DB.session(); if (s) { s.hasPassword = true; localStorage.setItem('annapurna:session', JSON.stringify(s)); } const fo = p.elements.old && p.elements.old.closest('.field'); if (fo) fo.hidden = false; const n = $('#pwGoogleNote'); if (n) n.remove(); }
    p.reset(); toast(needOld ? 'Kata sandi berhasil diganti.' : 'Kata sandi dibuat. Sekarang kamu juga bisa masuk dengan email & kata sandi.');
  });
  /* Lupa kata sandi lama: atur ulang lewat kode ke email akun (tidak perlu untuk akun Google tanpa kata sandi) */
  if (!noPw) UI.forgotOldLink(p);

  function notifs() {
    const list = DB.notifications(user.email);
    $('#nCnt').textContent = list.filter((n) => !n.read).length;
    $('#nList').innerHTML = list.length ? list.map((n) => `<a class="notif-item ${n.read ? '' : 'unread'}" href="${n.link ? url(n.link) : '#'}" data-id="${n.id}">
        <span class="ic"><i class="fa-regular fa-bell"></i></span>
        <span class="nf-bd"><strong>${esc(n.title)}</strong><span class="nf-tx">${esc(NOTXT(n.text))}</span><small class="muted">${D.fmtDateTime(n.at)}</small></span></a>`).join('')
      : `<div class="empty-state"><div class="ic"><i class="fa-regular fa-bell-slash"></i></div><h3>Belum ada notifikasi</h3><p>Info booking dan pembayaranmu akan muncul di sini.</p></div>`;
  }
  $('#nList').addEventListener('click', (e) => { const a = e.target.closest('[data-id]'); if (a) DB.markRead(user.email, a.dataset.id); });
  $('#readAllP').addEventListener('click', () => { DB.markRead(user.email); notifs(); Site.renderHeader(); toast('Semua notifikasi ditandai dibaca.'); });

  function show(t) {
    $$('#tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    $$('[data-pane]').forEach((s) => (s.hidden = s.dataset.pane !== t));
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) show(b.dataset.tab); });
  $('#logout').addEventListener('click', async () => {
    if (!(await confirmBox({ title: 'Keluar dari akun?', text: 'Kamu perlu masuk lagi untuk melihat pesanan.', ok: 'Keluar' }))) return;
    UI.serverLogout(UI.url('./'));
  });
  head(); notifs(); if (param('tab')) show(param('tab'));
})();

