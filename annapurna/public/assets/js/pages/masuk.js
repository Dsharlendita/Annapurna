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
  /* Lupa kata sandi: kode dikirim server ke email akun → kata sandi baru → langsung masuk */
  $('#forgot').addEventListener('click', (e) => {
    e.preventDefault();
    /* Email pengirim kode belum dipasang: tawarkan Google atau bantuan admin lewat WhatsApp */
    if (!hasMail) {
      modal({ title: 'Lupa kata sandi', body: `${hasGoogle ? `<p style="font-size:14px;margin-bottom:12px">Akunmu memakai <b>Gmail</b>? Masuk saja dengan Google tanpa kata sandi, lalu buat kata sandi baru di halaman <b>Profil</b>.</p>
          <a class="btn btn-light btn-block btn-google" href="${esc($('#googleBtn') ? $('#googleBtn').href : UI.url('auth/google'))}">${$('#googleBtn') ? $('#googleBtn').innerHTML : 'Masuk dengan Google'}</a><div class="or-sep"><span>atau</span></div>` : ''}
        <p class="muted" style="font-size:13.5px">Hubungi Owner Annapurna lewat WhatsApp untuk mengatur ulang kata sandi akunmu.</p>`,
        foot: `<button class="btn btn-light" data-close>Tutup</button><a class="btn btn-primary" href="${UI.waLink('Halo Annapurna, saya lupa kata sandi akun website. Email akun saya: ' + ($('#email').value || ''))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Hubungi Owner</a>` });
      return;
    }
    const m = modal({ title: 'Atur ulang kata sandi', body: `<ol class="fg-steps"><li class="on">Verifikasi</li><li>Kata sandi baru</li></ol>
      <div id="fgA"><p class="muted" style="font-size:13.5px;margin-bottom:12px">Masukkan email atau nomor WhatsApp akunmu. Kami kirim kode verifikasi 6 digit ke <b>email akunmu</b>.</p>
        <div class="field"><label for="fgId">Email atau nomor WhatsApp</label><input class="input" id="fgId" value="${esc($('#email').value || '')}" placeholder="nama@email.com / 08xxxxxxxxxx"></div><div id="fgCodeBox"></div></div>
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
  });
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

  /* Masuk tanpa kata sandi: kode verifikasi dikirim server ke email akun (khusus customer) */
  const ob = document.getElementById('otpBtn');
  if (ob) ob.addEventListener('click', () => {
    const m = UI.modal({ title: 'Masuk dengan kode verifikasi', body: `<p class="muted" style="font-size:13.5px;margin-bottom:12px">Cocok untuk akun yang dibuat otomatis saat checkout. Kode dikirim ke <b>email akunmu</b>.</p>
      <div class="field"><label for="otpId">Email atau nomor WhatsApp</label><input class="input" id="otpId" placeholder="nama@email.com / 08xxxxxxxxxx"></div><div id="otpStep"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="otpGo">Kirim kode</button>' });
    let ident = '';
    const go = m.$('#otpGo');
    const send = async (btn) => {
      const r = await Api.busy(btn, () => Api.code.send(ident, 'login'), 'Mengirim…'); if (!r) return false;
      if (!r.ok) { m.$('#otpId').classList.add('err'); UI.toast(r.msg, 'err'); return false; }
      m.$('#otpStep').innerHTML = `<p style="font-size:13.5px;margin-top:10px">Halo ${UI.esc(String(r.raw.name || '').split(' ')[0])}!</p>` + Api.code.field('otpCode', r.raw);
      Api.code.countdown(m.$('#otpCodeRe'), r.raw.resendIn);
      m.$('#otpCodeRe').addEventListener('click', (ev) => send(ev.currentTarget));
      m.$('#otpCode').focus(); return true;
    };
    go.addEventListener('click', async () => {
      if (!ident) {
        const id = m.$('#otpId').value.trim(); if (!id) { m.$('#otpId').classList.add('err'); UI.toast('Isi email atau nomor WhatsApp.', 'err'); return; }
        ident = id;
        if (await send(go)) { m.$('#otpId').readOnly = true; go.textContent = 'Masuk'; } else ident = '';
        return;
      }
      const v = await Api.busy(go, () => Api.code.check(ident, 'login', m.$('#otpCode').value, next), 'Memeriksa…'); if (!v) return;
      if (!v.ok) { m.$('#otpCode').classList.add('err'); UI.toast(v.msg, 'err'); return; }
      DB.adoptSession(v.raw.user);
      UI.toast(`Selamat datang, ${v.raw.user.name.split(' ')[0]}!`);
      setTimeout(() => (location.href = v.raw.redirect || UI.url('./')), 400);
    });
  });
})();
