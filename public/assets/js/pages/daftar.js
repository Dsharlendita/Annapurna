(function () {
  const { DB } = Ann; const { $, $$, validate, isEmail, isPhone, toast, param } = UI;
  const next = param('next');
  if (next) $('#toLogin').href = 'masuk?next=' + encodeURIComponent(next);
  $$('.toggle-pw').forEach((b) => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; }));
  const form = $('#regForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = validate(form, {
      name: (v) => (v.length < 3 ? 'Isi nama lengkap, minimal 3 huruf.' : ''),
      email: (v) => (!isEmail(v) ? 'Format email belum benar.' : ''),
      phone: (v) => (!isPhone(v) ? 'Nomor WhatsApp tidak valid. Contoh: 081234567890.' : ''),
      password: (v) => (v.length < 6 ? 'Kata sandi minimal 6 karakter.' : ''),
      password2: (v) => (v !== form.password.value ? 'Kata sandi tidak sama.' : ''),
      agree: (v, el) => (!el.checked ? 'Centang persetujuan untuk melanjutkan.' : ''),
    });
    if (!ok) return;
    const r = DB.register({ name: form.elements.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(), password: form.password.value });
    if (!r.ok) { validate(form, { [r.field]: () => r.msg }); return; }
    DB.notify(r.user.email, 'Selamat datang di Annapurna!', 'Akunmu sudah aktif. Yuk cek alat yang tersedia untuk petualangan berikutnya.', 'katalog');
    toast('Akun berhasil dibuat.');
    setTimeout(() => (location.href = next || './'), 450);
  });
})();

