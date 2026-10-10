(function () {
  const { DB } = Ann; const { $, $$, validate, isEmail, isPhone, toast, param } = UI;
  const next = param('next');
  if (next) $('#toLogin').href = 'masuk?next=' + encodeURIComponent(next);
  $$('.toggle-pw').forEach((b) => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; }));
  const form = $('#regForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = validate(form, {
      name: (v) => (v.length < 3 ? 'Isi nama lengkap, minimal 3 huruf.' : ''),
      email: (v) => (!isEmail(v) ? 'Format email belum benar.' : ''),
      phone: (v) => (!isPhone(v) ? 'Nomor WhatsApp tidak valid. Contoh: 081234567890.' : ''),
      password: (v) => (v.length < 6 ? 'Kata sandi minimal 6 karakter.' : ''),
      password2: (v) => (v !== form.elements.password.value ? 'Kata sandi tidak sama.' : ''),
      agree: (v, el) => (!el.checked ? 'Centang persetujuan untuk melanjutkan.' : ''),
    });
    if (!ok) return;

    /* Pendaftaran selalu lewat server (tanpa cadangan akun lokal). */
    const btn = form.querySelector('[type="submit"]');
    const r = await Api.busy(btn, () => Api.post('daftar', { name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), phone: form.elements.phone.value.trim(), password: form.elements.password.value, next: next || '' }, { redirectOn401: false }), 'Membuat akun…');
    if (!r) return;
    if (!r.ok) {
      if (r.status === 0 || r.status === 419 || r.status >= 500) { toast(r.msg, 'err'); return; }
      Api.showErrors(form, r);
      if (!r.errors && !(r.field && form.elements[r.field])) toast(r.msg, 'err');
      return;
    }
    const data = r.raw || {};
    DB.adoptSession(data.user);
    DB.notify(data.user.email, 'Selamat datang di Annapurna!', 'Akunmu sudah aktif. Yuk cek alat yang tersedia untuk petualangan berikutnya.', 'katalog');
    toast('Akun berhasil dibuat.');
    setTimeout(() => (location.href = data.redirect || next || './'), 450);
  });
})();

