(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, STATUS, D, rupiah } = Ann;
  const { $, $$, esc, asset, url, param, toast, modal, confirmBox, pill, downloadCSV, bindExport, validate, fileToDataURL } = UI;
  const owner = Admin.isOwner;
  Admin.init('pengaturan', owner ? 'Pengaturan' : 'Profil Saya');
  let S;
  const F = $('#sf'), E = F.elements;
  const FIELDS = ['storeName', 'hours', 'phone', 'whatsapp', 'email', 'instagram', 'address'];
  const lineRow = (v) => `<div class="row"><textarea class="textarea" rows="2">${esc(v)}</textarea><button type="button" class="btn btn-danger btn-xs" data-rmline aria-label="Hapus"><i class="fa-regular fa-trash-can"></i></button></div>`;
  const bankRow = (b) => `<div class="bank-row"><input class="input" placeholder="Bank" value="${esc(b.bank)}" data-k="bank"><input class="input" placeholder="No. rekening" value="${esc(b.number)}" data-k="number"><input class="input" placeholder="Atas nama" value="${esc(b.holder)}" data-k="holder"><button type="button" class="btn btn-danger btn-xs" data-rmbank aria-label="Hapus"><i class="fa-regular fa-trash-can"></i></button></div>`;
  function load() {
    S = DB.settings();
    FIELDS.forEach((k) => (E[k].value = S[k]));
    $('#banks').innerHTML = S.banks.map(bankRow).join('');
  }
  function show(t) {
    $$('#tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    $$('[data-pane]').forEach((s) => (s.hidden = s.dataset.pane !== t));
    $('#saveBar').style.display = t === 'akun' ? 'none' : 'flex';
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) show(b.dataset.tab); });
  document.querySelector('.content').addEventListener('click', (e) => {
    if (e.target.closest('[data-rmline]')) e.target.closest('.row').remove();
    if (e.target.closest('[data-rmbank]')) { if ($$('.bank-row').length <= 1) { toast('Minimal satu rekening pembayaran.', 'err'); return; } e.target.closest('.bank-row').remove(); }
    const al = e.target.closest('[data-addline]'); if (al) { $('#' + al.dataset.addline).insertAdjacentHTML('beforeend', lineRow('')); $('#' + al.dataset.addline).lastElementChild.querySelector('textarea').focus(); }
  });
  $('#addBank').addEventListener('click', () => $('#banks').insertAdjacentHTML('beforeend', bankRow({ bank: '', number: '', holder: S.storeName })));
  $('#revert').addEventListener('click', () => { load(); toast('Perubahan dibatalkan.'); });
  F.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = validate(F, { storeName: (v) => (!v ? 'Wajib diisi.' : ''), whatsapp: (v) => (!/^62\d{8,13}$/.test(v) ? 'Gunakan format 628xxxxxxxxx.' : ''), email: (v) => (!UI.isEmail(v) ? 'Email tidak valid.' : '') });
    if (!ok) { const bad = F.querySelector('.err'); const pane = bad && bad.closest('[data-pane]'); if (pane) show(pane.dataset.pane); return; }
    const banks = $$('.bank-row').map((r) => ({ bank: r.querySelector('[data-k=bank]').value.trim(), number: r.querySelector('[data-k=number]').value.trim(), holder: r.querySelector('[data-k=holder]').value.trim() })).filter((b) => b.bank && b.number);
    if (!banks.length) { show('bayar'); toast('Isi minimal satu rekening yang lengkap.', 'err'); return; }
    const lines = (id) => $$(`#${id} textarea`).map((t) => t.value.trim()).filter(Boolean);
    const next = Object.assign({}, S, { banks });
    FIELDS.forEach((k) => (next[k] = E[k].value.trim()));
    const n = DB.saveSettings(next); load(); toast(n ? 'Pengaturan disimpan dan tercatat di histori.' : 'Tidak ada perubahan.');
  });
  const A = $('#af'); A.elements.aname.value = Admin.me.name; A.elements.aphone.value = Admin.me.phone || '';
  A.addEventListener('submit', (e) => { e.preventDefault(); if (!validate(A, { aname: (v) => (v.length < 3 ? 'Minimal 3 huruf.' : '') })) return; DB.updateProfile({ name: A.elements.aname.value.trim(), phone: A.elements.aphone.value.trim() }); toast('Profil disimpan.'); setTimeout(() => location.reload(), 600); });
  const P = $('#pf');
  P.addEventListener('submit', async (e) => { e.preventDefault(); if (!validate(P, { old: (v) => (!v ? 'Wajib diisi.' : ''), npw: (v) => (v.length < 6 ? 'Minimal 6 karakter.' : '') })) return;
    const r = await Api.busy(P.querySelector('[type="submit"]'), () => Api.changePassword(P.elements.old.value, P.elements.npw.value), 'Menyimpan…'); if (!r) return;
    if (!r.ok) { if (r.field === 'old') validate(P, { old: () => r.msg || 'Kata sandi lama salah.' }); else toast(r.msg, 'err'); return; } P.reset(); toast('Kata sandi diganti.'); });
  $('#reset').addEventListener('click', async () => { if (!(await confirmBox({ title: 'Setel ulang data demo?', text: 'Semua data kembali ke contoh awal, termasuk histori sistem demo. Kamu tetap masuk sebagai owner.', ok: 'Setel ulang', danger: true }))) return; DB.reset(); toast('Data demo dipulihkan.'); setTimeout(() => location.reload(), 700); });
  if (owner) { load(); if (param('tab')) show(param('tab')); }
  else {
    $('#tabs').hidden = true; $('#demoPanel').remove(); show('akun');
    $('.page-sub').textContent = 'Ubah nama, nomor HP, dan kata sandi akunmu. Pengaturan toko hanya dapat diubah oleh Owner.';
    $('#akunHead').textContent = 'Profil staff';
  }
})();

