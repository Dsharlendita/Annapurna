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
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(f, { fullname: (v) => (v.length < 3 ? 'Nama minimal 3 huruf.' : ''), phone: (v) => (!isPhone(v) ? 'Nomor WhatsApp tidak valid (contoh 0812xxxxxxx).' : '') })) return;
    DB.updateProfile({ name: f.elements.fullname.value.trim(), phone: f.elements.phone.value.trim(), address: f.elements.address.value.trim() });
    Site.renderHeader(); head(); toast('Profil berhasil diperbarui.');
  });

  const p = $('#fPw');
  p.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(p, { old: (v) => (!v ? 'Isi kata sandi lama.' : ''), npw: (v) => (v.length < 6 ? 'Minimal 6 karakter.' : ''), cpw: (v) => (v !== p.elements.npw.value ? 'Konfirmasi kata sandi tidak sama.' : '') })) return;
    if (!DB.changePassword(p.elements.old.value, p.elements.npw.value)) { validate(p, { old: () => 'Kata sandi lama salah.' }); return; }
    p.reset(); toast('Kata sandi berhasil diganti.');
  });

  function notifs() {
    const list = DB.notifications(user.email);
    $('#nCnt').textContent = list.filter((n) => !n.read).length;
    $('#nList').innerHTML = list.length ? list.map((n) => `<a class="notif-item ${n.read ? '' : 'unread'}" href="${n.link ? url(n.link) : '#'}" data-id="${n.id}">
        <span class="ic"><i class="fa-regular fa-bell"></i></span>
        <span style="flex:1;min-width:0"><strong>${esc(n.title)}</strong><br><span style="font-size:13.5px">${esc(n.text)}</span><br><small class="muted">${D.fmtDateTime(n.at)}</small></span></a>`).join('')
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
    DB.logout(); location.href = './';
  });
  head(); notifs(); if (param('tab')) show(param('tab'));
})();

