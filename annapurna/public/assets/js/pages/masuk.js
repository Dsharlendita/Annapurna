(function () {
  const { DB } = Ann; const { $, $$, validate, isEmail, toast, modal, param } = UI;
  const next = param('next');
  if (param('nonaktif')) setTimeout(() => toast('Akun kamu dinonaktifkan oleh Owner. Hubungi Owner untuk informasi lebih lanjut.', 'err'), 300);
  if (next) $('#toRegister').href = 'daftar?next=' + encodeURIComponent(next);
  $$('.toggle-pw').forEach((b) => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = `<i class="fa-regular fa-eye${i.type === 'text' ? '-slash' : ''}"></i>`; }));
  $$('[data-demo]').forEach((b) => b.addEventListener('click', () => { const [e, p] = b.dataset.demo.split('|'); $('#email').value = e; $('#password').value = p; }));
  $('#forgot').addEventListener('click', (e) => {
    e.preventDefault();
    const m = modal({ title: 'Atur ulang kata sandi', body: `<p class="muted" style="margin-bottom:14px">Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru.</p><div class="field"><label>Email</label><input class="input" id="fgEmail" type="email" value="${$('#email').value}"></div>`, foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="fgSend">Kirim tautan</button>` });
    m.$('#fgSend').addEventListener('click', () => { const v = m.$('#fgEmail').value.trim(); if (!isEmail(v)) { m.$('#fgEmail').classList.add('err'); return; } m.close(); toast(`Tautan atur ulang dikirim ke ${v}.`); });
  });
  const form = $('#loginForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(form, { email: (v) => (!v ? 'Isi email kamu.' : !isEmail(v) ? 'Format email belum benar.' : ''), password: (v) => (!v ? 'Isi kata sandi.' : '') })) return;
    const r = DB.login(form.email.value, form.password.value);
    if (!r.ok) { validate(form, { [r.field]: () => r.msg }); return; }
    toast(`Selamat datang, ${r.user.name.split(' ')[0]}!`);
    setTimeout(() => { location.href = next ? next : DB.isStaff(r.user) ? DB.panelHome(r.user) : './'; }, 450);
  });
})();

