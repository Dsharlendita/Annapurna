/* ==========================================================================
   Api — satu pintu untuk memanggil server Laravel dari frontend.

   Pemakaian:
     const r = await Api.post('masuk', { email, password });
     if (!r.ok) { tampilkan r.msg / r.errors; return; }
     pakai r.data

   Setiap pemanggilan SELALU mengembalikan objek yang sama bentuknya (tidak pernah throw):
     { ok, status, data, msg, field, errors, raw, source }
       ok      : true bila server menjawab sukses
       status  : kode HTTP (0 = tidak ada koneksi)
       data    : isi `data` dari jawaban server, atau seluruh jawaban bila tidak ada `data`
       msg     : pesan yang siap ditampilkan ke pengguna (bahasa Indonesia)
       field   : nama isian yang salah (bila server mengirim `field`)
       errors  : { namaIsian: 'pesan' } dari validasi Laravel (status 422)
       raw     : jawaban JSON apa adanya
       source  : 'server' | 'local' (lihat Api.try)

   Mode transisi (Api.try):
     Selama backend belum menyediakan sebuah endpoint, frontend tetap bisa jalan memakai data lokal.
       const r = await Api.try('POST', 'akun/kata-sandi', body, () => DB.changePassword(lama, baru));
     Bila server menjawab 404/405 (route belum dibuat), fungsi lokal yang dipakai dan r.source = 'local'.
     Begitu backend membuat route-nya, pemanggilan yang sama otomatis memakai server tanpa mengubah kode FE.
   ========================================================================== */
(function () {
  const csrf = () => (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  const base = () => document.body.dataset.base || '/';
  const toUrl = (path) => (/^https?:\/\//.test(path) ? path : base() + String(path).replace(/^\//, ''));

  const MSG = {
    0: 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.',
    401: 'Sesi login berakhir. Silakan masuk kembali.',
    403: 'Kamu tidak punya akses untuk tindakan ini.',
    404: 'Data atau alamat yang diminta tidak ditemukan.',
    413: 'Ukuran file terlalu besar.',
    419: 'Sesi halaman sudah kedaluwarsa. Muat ulang halaman, lalu coba lagi.',
    422: 'Periksa kembali isian yang ditandai.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.',
    500: 'Server sedang bermasalah. Coba lagi beberapa saat lagi.',
  };
  const msgFor = (status) => MSG[status] || (status >= 500 ? MSG[500] : 'Permintaan gagal diproses. Coba lagi.');

  /* Ubah error validasi Laravel { email: ['…'] } menjadi { email: '…' } */
  const flatErrors = (e) => { if (!e || typeof e !== 'object') return null; const o = {}; Object.keys(e).forEach((k) => { o[k] = Array.isArray(e[k]) ? e[k][0] : String(e[k]); }); return o; };

  async function request(method, path, body, opts = {}) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf() };
    if (body != null && !isForm) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(toUrl(path), { method, headers, credentials: 'same-origin', body: body == null ? undefined : isForm ? body : JSON.stringify(body) });
    } catch (e) {
      return { ok: false, status: 0, data: null, msg: MSG[0], field: null, errors: null, raw: null, source: 'server', offline: true };
    }
    let raw = null;
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) { try { raw = await res.json(); } catch (e) { raw = null; } }
    const errors = flatErrors(raw && raw.errors);
    const ok = res.ok && !(raw && raw.ok === false);
    const firstErr = errors ? Object.values(errors)[0] : '';
    const msg = ok ? (raw && raw.msg) || '' : (raw && (raw.msg || raw.message)) && res.status !== 419 && res.status < 500 ? (raw.msg || raw.message) : firstErr || msgFor(res.status);
    const out = { ok, status: res.status, data: raw && 'data' in raw ? raw.data : raw, msg, field: (raw && raw.field) || (errors ? Object.keys(errors)[0] : null), errors, raw, source: 'server' };
    if (res.status === 401 && opts.redirectOn401 !== false && !/\/(masuk|daftar)$/.test(location.pathname)) {
      const next = encodeURIComponent(location.pathname.replace(base(), '') + location.search);
      setTimeout(() => { location.href = toUrl('masuk?next=' + next); }, 900);
    }
    return out;
  }

  /* Mode transisi: pakai server bila route sudah ada, pakai fungsi lokal bila belum (404/405). */
  async function tryServer(method, path, body, localFn, opts) {
    const r = await request(method, path, body, Object.assign({ redirectOn401: false }, opts));
    if ((r.status === 404 || r.status === 405) && typeof localFn === 'function') {
      try {
        const v = await localFn();
        const okv = v && typeof v === 'object' && 'ok' in v ? v.ok : !!v;
        return { ok: okv, status: okv ? 200 : 422, data: v && typeof v === 'object' && 'data' in v ? v.data : v, msg: (v && v.msg) || '', field: (v && v.field) || null, errors: null, raw: v, source: 'local' };
      } catch (e) { return { ok: false, status: 500, data: null, msg: 'Terjadi kesalahan di aplikasi. Coba muat ulang halaman.', field: null, errors: null, raw: null, source: 'local' }; }
    }
    return r;
  }

  /* Kunci tombol selama proses berjalan: cegah klik ganda + tampilkan indikator loading. */
  async function busy(btn, work, label) {
    if (!btn) return work();
    if (btn.dataset.busy === '1') return undefined;
    const old = btn.innerHTML; btn.dataset.busy = '1'; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label || 'Memproses…'}`;
    try { return await work(); } finally { btn.innerHTML = old; btn.disabled = false; btn.removeAttribute('aria-busy'); delete btn.dataset.busy; }
  }

  /* Untuk upload: data URL hasil UI.fileToDataURL → Blob, siap dimasukkan ke FormData. */
  function dataURLtoBlob(dataUrl) {
    const [head, b64] = String(dataUrl).split(','); const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* Tandai isian form sesuai error dari server (422 / field), memakai UI.validate yang sudah ada. */
  function showErrors(form, r) {
    if (!form || !window.UI || !UI.validate) return;
    const errs = r.errors || (r.field ? { [r.field]: r.msg } : null);
    if (!errs) return;
    const rules = {}; Object.keys(errs).forEach((k) => { if (form.elements[k]) rules[k] = () => errs[k]; });
    if (Object.keys(rules).length) UI.validate(form, rules);
  }

  /* Ganti kata sandi akun yang sedang masuk.
     Server: POST /akun/kata-sandi { current_password, password, password_confirmation } (kontrak untuk tim backend).
     Selama route itu belum ada → memakai akun lokal (mode transisi). */
  async function changePassword(oldPw, newPw) {
    const r = await tryServer('POST', 'akun/kata-sandi', { current_password: oldPw, password: newPw, password_confirmation: newPw }, () => Ann.DB.changePassword(oldPw, newPw));
    if (r.ok && r.source === 'server') { const s = Ann.DB.session(); if (s && s.mustChangePw) { s.mustChangePw = false; localStorage.setItem('annapurna:session', JSON.stringify(s)); } }
    if (!r.ok && r.source === 'server' && r.errors && r.errors.current_password) r.field = 'old';
    if (!r.ok && r.field === 'current_password') r.field = 'old';
    return r;
  }

  window.Api = {
    changePassword,
    request,
    get: (path, opts) => request('GET', path, null, opts),
    post: (path, body, opts) => request('POST', path, body, opts),
    put: (path, body, opts) => request('PUT', path, body, opts),
    patch: (path, body, opts) => request('PATCH', path, body, opts),
    del: (path, opts) => request('DELETE', path, null, opts),
    upload: (path, formData, opts) => request('POST', path, formData, opts),
    try: tryServer,
    busy,
    dataURLtoBlob,
    showErrors,
    MSG,
  };
})();
