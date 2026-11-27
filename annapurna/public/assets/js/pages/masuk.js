(function () {
  const { DB } = Ann; const { $, $$, esc, validate, isEmail, toast, modal, param } = UI;
  const next = UI.safeNext(param('next'));
  if (param('nonaktif')) setTimeout(() => toast('Akun kamu dinonaktifkan oleh Owner. Hubungi Owner untuk informasi lebih lanjut.', 'err'), 300);
  if (param('idle')) setTimeout(() => toast(`Kamu otomatis keluar karena tidak ada aktivitas selama ${DB.settings().idleLogoutMin || 60} menit. Silakan masuk lagi.`), 300);
  if (next) $('#toRegister').href = 'daftar?next=' + encodeURIComponent(next);
  const box = $('.auth-box'); const hasGoogle = box && box.dataset.google === '1'; const hasMail = box && box.dataset.mail === '1';
  if (next && $('#googleBtn')) $('#googleBtn').href += '?next=' + encodeURIComponent(next);
  /* Kembali dari halaman Google tanpa berhasil masuk */
  const gMsg = { batal: 'Masuk dengan Google dibatalkan.', gagal: 'Masuk dengan Google gagal. Coba lagi.', email: 'Email akun Google belum terverifikasi.', 'belum-aktif': 'Masuk dengan Google belum diaktifkan toko.' }[param('google')];
  if (gMsg) setTimeout(() => toast(gMsg, 'err'), 300);
  $$('.toggle-pw').forEach((b) => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = `<i class="fa-regular fa-eye${i.type === 'text' ? '-slash' : ''}"></i>`; }));
  /* Lupa kata sandi. Langkah 1: server memeriksa email akun (api/lupa-sandi).
     - Staff  → Owner langsung dapat notifikasi + tombol WhatsApp ke nomor Owner (nomornya hanya dikirim server untuk akun staff).
     - Customer → masuk dengan Google lalu buat kata sandi di Profil, atau kode email bila email toko sudah aktif.
       Customer TIDAK diarahkan ke Owner. */
  const googleBtnHtml = () => `<a class="btn btn-light btn-block btn-google" href="${esc($('#googleBtn') ? $('#googleBtn').href : UI.url('auth/google'))}">${$('#googleBtn') ? $('#googleBtn').innerHTML : 'Masuk dengan Google'}</a>`;
  $('#forgot').addEventListener('click', (e) => {
    e.preventDefault();
    const m = modal({ title: 'Lupa kata sandi', body: `<div id="fgAsk"><p class="muted" style="font-size:13.5px;margin-bottom:12px">Masukkan email akunmu untuk melihat cara mengatur ulang kata sandi.</p>
        <div class="field"><label for="fgAskId">Email akun</label><input class="input" id="fgAskId" type="email" autocomplete="email" value="${esc($('#email').value || '')}" placeholder="nama@email.com"></div></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="fgAskGo">Lanjut</button>' });
    const ask = m.$('#fgAskGo');
    m.$('#fgAskId').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ask.click(); } });
    ask.addEventListener('click', async () => {
      const id = m.$('#fgAskId').value.trim();
      if (!id) { m.$('#fgAskId').classList.add('err'); toast('Isi email akunmu.', 'err'); return; }
      const r = await Api.busy(ask, () => Api.post('api/lupa-sandi', { identifier: id }, { redirectOn401: false }), 'Memeriksa…'); if (!r) return;
      if (!r.ok) { m.$('#fgAskId').classList.add('err'); toast(r.msg, 'err'); return; }
      const d = r.raw || {};
      if (d.kind === 'staff') {
        m.$('.modal-body').innerHTML = `<p style="font-size:14px;margin-bottom:10px"><i class="fa-solid fa-circle-check" style="color:var(--g700)"></i> Permintaanmu sudah masuk ke <b>notifikasi Owner</b>.</p>
          <p class="muted" style="font-size:13.5px">Owner akan membuat kata sandi baru untukmu lewat <b>Manajemen Staff</b>. Agar lebih cepat, kabari Owner lewat WhatsApp.</p>`;
        m.$('.modal-foot').innerHTML = `<button class="btn btn-light" data-close>Tutup</button><a class="btn btn-primary" href="${esc(d.wa)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Hubungi Owner</a>`;
        return;
      }
      m.close();
      if (hasMail) { openCodeReset(id); return; }
      modal({ title: 'Lupa kata sandi', body: hasGoogle
        ? `<p style="font-size:14px;margin-bottom:12px">Masuk dengan <b>Google</b> memakai Gmail akunmu, tanpa kata sandi. Setelah masuk, buat kata sandi baru di halaman <b>Profil</b>.</p>${googleBtnHtml()}
           <p class="muted" style="font-size:12.5px;margin-top:10px">Belum punya akun dengan Gmail ini? Kamu bisa <a class="link" href="${esc($('#toRegister').href)}">daftar akun baru</a>.</p>`
        : `<p style="font-size:14px">Atur ulang kata sandi lewat website belum tersedia. Kamu tetap bisa <a class="link" href="${esc($('#toRegister').href)}">daftar akun baru</a> atau memesan tanpa akun.</p>`,
        foot: '<button class="btn btn-light" data-close>Tutup</button>' });
    });
  });
  /* Kode dikirim server ke email akun → kata sandi baru → langsung masuk (hanya bila email toko aktif) */
  function openCodeReset(prefill) {
    const m = modal({ title: 'Atur ulang kata sandi', body: `<ol class="fg-steps"><li class="on">Verifikasi</li><li>Kata sandi baru</li></ol>
      <div id="fgA"><p class="muted" style="font-size:13.5px;margin-bottom:12px">Masukkan email atau nomor WhatsApp akunmu. Kami kirim kode verifikasi 6 digit ke <b>email akunmu</b>.</p>
        <div class="field"><label for="fgId">Email atau nomor WhatsApp</label><input class="input" id="fgId" value="${esc(prefill || '')}" placeholder="nama@email.com / 08xxxxxxxxxx"></div><div id="fgCodeBox"></div></div>
      <div id="fgB" hidden><div class="field"><label for="fgPw">Kata sandi baru</label><input class="input" type="password" id="fgPw" autocomplete="new-password"><span class="hint">Minimal 6 karakter.</span></div>
        <div class="field"><label for="fgPw2">Ulangi kata sandi</label><input class="input" type="password" id="fgPw2" autocomplete="new-password"></div></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="fgGo">Kirim kode</button>' });
    let step = 0, ident = '';
    const go = m.$('#fgGo');
    const send = async (btn) => {
      const r = await Api.busy(btn, () => Api.code.send(ident, 'reset'), 'Mengirim…'); if (!r) return false;
      if (!r.ok) { m.$('#fgId').classList.add('err'); toast(r.msg, 'err'); return false; }
      m.$('#fgCodeBox').innerHTML = Api.code.field('fgCode', r.raw);
      Api.code.countdown(m.$('#fgCodeRe'), r.raw.resendIn);
      m.$('#fgCodeRe').addEventListener('click', (ev) => send(ev.currentTarget));
      m.$('#fgCode').focus(); return true;
    };
    go.addEventListener('click', async () => {
      if (step === 0) {
        ident = m.$('#fgId').value.trim(); if (!ident) { m.$('#fgId').classList.add('err'); toast('Isi email atau nomor WhatsApp.', 'err'); return; }
        if (await send(go)) { step = 1; m.$('#fgId').readOnly = true; go.textContent = 'Verifikasi'; }
        return;
      }
      if (step === 1) {
        const v = await Api.busy(go, () => Api.code.check(ident, 'reset', m.$('#fgCode').value), 'Memeriksa…'); if (!v) return;
        if (!v.ok) { m.$('#fgCode').classList.add('err'); toast(v.msg, 'err'); return; }
        step = 2; m.$('#fgA').hidden = true; m.$('#fgB').hidden = false; m.$$('.fg-steps li')[1].classList.add('on'); go.textContent = 'Simpan & masuk'; m.$('#fgPw').focus(); return;
      }
      const a = m.$('#fgPw').value, b = m.$('#fgPw2').value;
      if (a.length < 6) { m.$('#fgPw').classList.add('err'); toast('Kata sandi minimal 6 karakter.', 'err'); return; }
      if (a !== b) { m.$('#fgPw2').classList.add('err'); toast('Kata sandi tidak sama.', 'err'); return; }
      const r = await Api.busy(go, () => Api.code.newPassword(a), 'Menyimpan…'); if (!r) return;
      if (!r.ok) { toast(r.msg, 'err'); return; }
      DB.adoptSession(r.raw.user); m.close(); toast('Kata sandi baru tersimpan. Kamu sudah masuk.');
      setTimeout(() => (location.href = next ? UI.url(next) : r.raw.redirect || UI.url('./')), 500);
    });
  }
  const form = $('#loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(form, { email: (v) => (!v ? 'Isi email kamu.' : !isEmail(v) ? 'Format email belum benar.' : ''), password: (v) => (!v ? 'Isi kata sandi.' : '') })) return;
    
    /* Login selalu lewat server. Tidak ada lagi login cadangan memakai data di browser:
       bila server error / sesi halaman kedaluwarsa, cukup tampilkan pesan yang jelas. */
    const btn = form.querySelector('[type="submit"]');
    const r = await Api.busy(btn, () => Api.post('masuk', { email: form.elements.email.value.trim(), password: form.elements.password.value, next: next || '' }, { redirectOn401: false }), 'Masuk…');
    if (!r) return;
    if (!r.ok) {
      if (r.status === 0 || r.status === 419 || r.status >= 500) { toast(r.msg, 'err'); return; }
      validate(form, { [r.field && form.elements[r.field] ? r.field : 'password']: () => r.msg || 'Gagal masuk. Periksa email dan kata sandi.' });
      return;
    }
    const data = r.raw || {};
    DB.adoptSession(data.user);
    toast(`Selamat datang, ${data.user.name.split(' ')[0]}!`);
    setTimeout(() => { location.href = data.redirect || (next ? next : DB.isStaff(data.user) ? DB.panelHome(data.user) : './'); }, 450);
  });
})();
