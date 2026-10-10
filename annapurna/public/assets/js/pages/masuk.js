(function () {
  const { DB } = Ann; const { $, $$, esc, validate, isEmail, toast, modal, param } = UI;
  const next = param('next');
  if (param('nonaktif')) setTimeout(() => toast('Akun kamu dinonaktifkan oleh Owner. Hubungi Owner untuk informasi lebih lanjut.', 'err'), 300);
  if (param('idle')) setTimeout(() => toast(`Kamu otomatis keluar karena tidak ada aktivitas selama ${DB.settings().idleLogoutMin || 60} menit. Silakan masuk lagi.`), 300);
  if (next) $('#toRegister').href = 'daftar?next=' + encodeURIComponent(next);
  $$('.toggle-pw').forEach((b) => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = `<i class="fa-regular fa-eye${i.type === 'text' ? '-slash' : ''}"></i>`; }));
  $$('[data-demo]').forEach((b) => b.addEventListener('click', () => { const [e, p] = b.dataset.demo.split('|'); $('#email').value = e; $('#password').value = p; }));
  $('#forgot').addEventListener('click', (e) => {
    e.preventDefault();
    const m = modal({ title: 'Atur ulang kata sandi', body: `<ol class="fg-steps"><li class="on">Verifikasi</li><li>Kata sandi baru</li></ol>
      <div id="fgA"><p class="muted" style="font-size:13.5px;margin-bottom:12px">Masukkan email atau nomor WhatsApp akunmu. Kami kirim kode verifikasi 6 digit.</p>
        <div class="field"><label for="fgId">Email atau nomor WhatsApp</label><input class="input" id="fgId" value="${esc($('#email').value || '')}" placeholder="nama@email.com / 08xxxxxxxxxx"></div><div id="fgCodeBox"></div></div>
      <div id="fgB" hidden><div class="field"><label for="fgPw">Kata sandi baru</label><input class="input" type="password" id="fgPw" autocomplete="new-password"><span class="hint">Minimal 6 karakter.</span></div>
        <div class="field"><label for="fgPw2">Ulangi kata sandi</label><input class="input" type="password" id="fgPw2" autocomplete="new-password"></div></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="fgGo">Kirim kode</button>' });
    let step = 0, sent = null;
    m.$('#fgGo').addEventListener('click', () => {
      if (step === 0) {
        const r = Ann.DB.sendLoginCode(m.$('#fgId').value); if (!r.ok) { m.$('#fgId').classList.add('err'); toast(r.msg, 'err'); return; }
        sent = r; step = 1; m.$('#fgGo').textContent = 'Verifikasi';
        m.$('#fgCodeBox').innerHTML = `<p class="muted" style="font-size:13px">Kode dikirim ke ${esc(r.dest)}. <span class="otp-demo">Kode: <b>${r.code}</b></span></p><div class="field"><label for="fgCode">Kode verifikasi</label><input class="input otp-in" id="fgCode" inputmode="numeric" maxlength="6" placeholder="••••••"></div>`;
        m.$('#fgCode').focus(); return;
      }
      if (step === 1) {
        const v = Ann.DB.verifyLoginCode(m.$('#fgCode').value); if (!v.ok) { m.$('#fgCode').classList.add('err'); toast(v.msg, 'err'); return; }
        step = 2; m.$('#fgA').hidden = true; m.$('#fgB').hidden = false; m.$$('.fg-steps li')[1].classList.add('on'); m.$('#fgGo').textContent = 'Simpan & masuk'; m.$('#fgPw').focus(); return;
      }
      const a = m.$('#fgPw').value, b = m.$('#fgPw2').value;
      if (a.length < 6) { m.$('#fgPw').classList.add('err'); toast('Kata sandi minimal 6 karakter.', 'err'); return; }
      if (a !== b) { m.$('#fgPw2').classList.add('err'); toast('Kata sandi tidak sama.', 'err'); return; }
      Ann.DB.setOwnPassword(a); m.close(); toast('Kata sandi baru tersimpan. Kamu sudah masuk.');
      const nx = new URLSearchParams(location.search).get('next'); setTimeout(() => (location.href = UI.url(nx || './')), 500);
    });
  });
  const form = $('#loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(form, { email: (v) => (!v ? 'Isi email kamu.' : !isEmail(v) ? 'Format email belum benar.' : ''), password: (v) => (!v ? 'Isi kata sandi.' : '') })) return;
    
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    try {
      const response = await fetch(UI.url('masuk'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': csrfToken || '',
        },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value,
          next: next || '',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        validate(form, { [data.field || 'password']: () => data.msg || 'Gagal masuk. Periksa email dan password.' });
        return;
      }
      DB.adoptSession(data.user);
      toast(`Selamat datang, ${data.user.name.split(' ')[0]}!`);
      setTimeout(() => {
        location.href = data.redirect || (next ? next : DB.isStaff(data.user) ? DB.panelHome(data.user) : './');
      }, 450);
    } catch (err) {
      const r = DB.login(form.email.value, form.password.value);
      if (!r.ok) { validate(form, { [r.field]: () => r.msg }); return; }
      toast(`Selamat datang, ${r.user.name.split(' ')[0]}!`);
      setTimeout(() => { location.href = next ? next : DB.isStaff(r.user) ? DB.panelHome(r.user) : './'; }, 450);
    }
  });

  /* Masuk tanpa kata sandi: kode verifikasi */
  const ob = document.getElementById('otpBtn');
  if (ob) ob.addEventListener('click', () => {
    const m = UI.modal({ title: 'Masuk dengan kode verifikasi', body: `<p class="muted" style="font-size:13.5px;margin-bottom:12px">Cocok untuk akun yang dibuat otomatis saat checkout. Kode dikirim ke WhatsApp atau email kamu.</p>
      <div class="field"><label>Email atau nomor WhatsApp</label><input class="input" id="otpId" placeholder="nama@email.com / 08xxxxxxxxxx"></div><div id="otpStep"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="otpGo">Kirim kode</button>' });
    let sent = null;
    m.$('#otpGo').addEventListener('click', () => {
      if (!sent) {
        const r = Ann.DB.sendLoginCode(m.$('#otpId').value); if (!r.ok) { UI.toast(r.msg, 'err'); return; }
        sent = r; m.$('#otpGo').textContent = 'Masuk';
        m.$('#otpStep').innerHTML = `<p class="muted" style="font-size:13px">Halo ${UI.esc(r.name.split(' ')[0])}! Kode dikirim ke ${UI.esc(r.dest)}. <span class="otp-demo">Kode: <b>${r.code}</b></span></p><div class="field"><label>Kode verifikasi</label><input class="input otp-in" id="otpCode" inputmode="numeric" maxlength="6" placeholder="••••••"></div>`;
        m.$('#otpCode').focus(); return;
      }
      const v = Ann.DB.verifyLoginCode(m.$('#otpCode').value); if (!v.ok) { UI.toast(v.msg, 'err'); return; }
      UI.toast(`Selamat datang, ${v.user.name.split(' ')[0]}!`);
      const nx = new URLSearchParams(location.search).get('next');
      setTimeout(() => (location.href = UI.url(nx || './')), 400);
    });
  });
})();
