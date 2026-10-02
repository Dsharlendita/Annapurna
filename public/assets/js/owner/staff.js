(function () {
  if (window.Admin.blocked) return;
  const { DB, D } = Ann;
  const { $, esc, toast, modal, confirmBox, validate, isEmail } = UI;
  Admin.init('owner-staff', 'Manajemen Staff');
  const T = D.today(); const monthFrom = T.slice(0, 8) + '01';
  const me = Admin.me;
  const ROLES = [['admin', 'Admin / Staff', 'Mengelola operasional: rental, penjualan, stok, keuangan. Tidak bisa menghapus data dan tidak melihat histori.'], ['owner', 'Owner', 'Akses penuh: dashboard bisnis, histori sistem, manajemen staff, integrasi & pengaturan toko.']];
  const activeOwners = () => DB.staff().filter((u) => u.role === 'owner' && u.status === 'aktif');

  function list() {
    const q = $('#q').value.trim().toLowerCase(), st = $('#fStatus').value, rl = $('#fRole').value;
    return DB.staff().filter((u) => (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)) && (!st || u.status === st) && (!rl || u.role === rl))
      .sort((a, b) => (a.status === 'nonaktif') - (b.status === 'nonaktif') || (a.role === 'owner' ? -1 : 1) - (b.role === 'owner' ? -1 : 1) || a.name.localeCompare(b.name));
  }
  function draw() {
    const S = DB.staff(); const acts = DB.audits().filter((a) => a.type !== 'akses' && D.day(a.at) >= monthFrom);
    const st = (ic, tone, l, v, d) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></div>`;
    $('#stats').innerHTML = st('fa-users', '', 'Total staff', S.length, `${S.filter((u) => u.role === 'owner').length} owner`) + st('fa-user-check', '', 'Aktif', S.filter((u) => u.status === 'aktif').length)
      + st('fa-user-slash', 'red', 'Nonaktif', S.filter((u) => u.status === 'nonaktif').length) + st('fa-signal', 'blue', 'Sedang login', S.filter((u) => Admin.presence(u).key === 'on').length, 'berdasarkan sesi terakhir');
    const L = list();
    $('#rows').innerHTML = L.length ? L.map((u) => {
      const p = Admin.presence(u); const n = acts.filter((a) => a.userId === u.id).length; const self = u.id === me.id; const off = u.status === 'nonaktif';
      const creator = u.createdBy ? DB.user(u.createdBy) : null;
      return `<tr class="${off ? 'row-off' : ''}">
        <td><div class="prod"><span class="av-dot ${p.key}">${esc(u.name.charAt(0))}</span><div><strong>${esc(u.name)}${self ? ' <span class="pill green plain">Kamu</span>' : ''}</strong><small>${esc(u.email)}${u.phone ? ` · ${esc(u.phone)}` : ''}</small>${u.createdAt ? `<small>Dibuat ${D.fmtDate(u.createdAt)}${creator ? ` oleh ${esc(creator.name)}` : ''}</small>` : ''}</div></div></td>
        <td><span class="pill ${u.role === 'owner' ? 'amber' : 'blue'}">${u.role === 'owner' ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(DB.ROLE_LABEL[u.role])}</span></td>
        <td>${off ? '<span class="pill gray">Nonaktif</span>' : '<span class="pill green">Aktif</span>'}${u.mustChangePw && !off ? '<small style="color:#9a6508"><i class="fa-solid fa-key"></i> Belum ganti sandi sementara</small>' : ''}<small>${p.label}</small></td>
        <td>${u.lastLogin ? `${D.fmtDateTime(u.lastLogin)}<small>${Admin.relTime(u.lastLogin)}${u.lastLogout && u.lastLogout > u.lastLogin ? ` · logout ${D.fmtDateTime(u.lastLogout).split(', ')[1]}` : ''}</small>` : '<span class="muted">Belum pernah login</span>'}</td>
        <td class="num">${n}</td>
        <td><div class="acts">
          <a class="btn btn-light btn-xs" href="${Admin.O('histori?staff=' + u.id)}" title="Histori staff"><i class="fa-solid fa-clock-rotate-left"></i> Histori</a>
          <button class="btn btn-light btn-xs" data-edit="${u.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          ${self ? '' : `<button class="btn btn-light btn-xs" data-reset="${u.id}" title="Kirim kata sandi sementara"><i class="fa-solid fa-key"></i></button>
          <button class="btn ${off ? 'btn-primary' : 'btn-light'} btn-xs" data-toggle="${u.id}"><i class="fa-solid ${off ? 'fa-user-check' : 'fa-user-slash'}"></i> ${off ? 'Aktifkan' : 'Nonaktifkan'}</button>`}
        </div></td></tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-solid fa-users"></i></div><h3>Tidak ada staff</h3><p>Coba ubah filter pencarian.</p></div></td></tr>';
  }

  function sentModal(title, u, res) {
    const m = modal({ title, body: `
      <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-envelope-circle-check"></i><div>${res.mail ? `Email informasi akun dikirim ke <strong>${esc(u.email)}</strong>.` : 'Email tidak dikirim (opsi pengiriman dimatikan).'} Staff wajib mengganti kata sandi saat pertama login.</div></div>
      <div class="kv"><span>Email akun</span><strong>${esc(u.email)}</strong></div>
      <div class="kv"><span>Kata sandi sementara</span><span><code class="temp-pw">${esc(res.temp)}</code> <button class="btn btn-light btn-xs" id="cp"><i class="fa-regular fa-copy"></i> Salin</button></span></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Kata sandi sementara hanya ditampilkan sekali di sini. Sistem tidak menyimpan kata sandi dalam bentuk yang bisa dibaca saat backend sudah aktif.</p>`,
      foot: `${res.mail ? '<button class="btn btn-light" id="pv"><i class="fa-regular fa-eye"></i> Lihat email</button>' : ''}<button class="btn btn-primary" data-close>Selesai</button>` });
    m.$('#cp').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(res.temp); toast('Kata sandi sementara disalin.'); });
    const pv = m.$('#pv'); if (pv) pv.addEventListener('click', () => Reports.mailModal(res.mail));
  }

  function form(u) {
    const isNew = !u; u = u || { name: '', email: '', phone: '', role: 'admin', status: 'aktif' };
    const self = u.id === me.id;
    const m = modal({ title: isNew ? 'Tambah staff' : `Edit staff · ${esc(u.name)}`, size: 'lg', body: `<form id="sf" novalidate>
      <div class="grid-2">
        <div class="field"><label>Nama lengkap</label><input class="input" name="sname" value="${esc(u.name)}" placeholder="Contoh: Dita Lestari"></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="semail" value="${esc(u.email)}" placeholder="nama@annapurna.id"><span class="hint">Dipakai untuk login dan menerima email akun.</span></div>
        <div class="field"><label>Nomor HP (opsional)</label><input class="input" name="sphone" value="${esc(u.phone || '')}" inputmode="tel"></div>
        <div class="field"><label>Status</label><select class="select" name="sstatus" ${self ? 'disabled' : ''}><option value="aktif" ${u.status === 'aktif' ? 'selected' : ''}>Aktif — bisa login</option><option value="nonaktif" ${u.status === 'nonaktif' ? 'selected' : ''}>Nonaktif — akses ditutup</option></select></div>
      </div>
      <div class="field"><label>Role</label><div class="role-pick">${ROLES.map(([k, l, d]) => `<label class="radio-card"><input type="radio" name="srole" value="${k}" ${u.role === k ? 'checked' : ''} ${self ? 'disabled' : ''}><span><strong>${l}</strong><small>${d}</small></span></label>`).join('')}</div></div>
      ${isNew ? `<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="smail" checked> Kirim email otomatis berisi nama toko, akun, link website, instruksi login, dan kata sandi sementara</label>` : ''}
      ${self ? '<p class="muted" style="font-size:12.5px;margin-top:8px">Role dan status akunmu sendiri tidak bisa diubah dari sini.</p>' : ''}
      </form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="sSave"><i class="fa-solid ${isNew ? 'fa-user-plus' : 'fa-floppy-disk'}"></i> ${isNew ? 'Tambah staff' : 'Simpan'}</button>` });
    m.$('#sSave').addEventListener('click', async () => {
      const F = m.$('#sf'), E = F.elements;
      if (!validate(F, { sname: (v) => (v.length < 3 ? 'Nama minimal 3 huruf.' : ''), semail: (v) => (!isEmail(v) ? 'Email tidak valid.' : ''), sphone: (v) => (v && !/^[0-9+\s-]{8,16}$/.test(v) ? 'Nomor HP tidak valid.' : '') })) return;
      const role = self ? u.role : (F.querySelector('[name=srole]:checked') || {}).value || 'admin';
      const status = self ? u.status : E.sstatus.value;
      if (!isNew && u.role === 'owner' && u.status === 'aktif' && (role !== 'owner' || status !== 'aktif') && activeOwners().length <= 1) { toast('Minimal harus ada satu Owner aktif.', 'err'); return; }
      if (role === 'owner' && u.role !== 'owner' && !(await confirmBox({ title: 'Jadikan Owner?', text: `${esc(E.sname.value)} akan mendapat akses penuh, termasuk histori sistem dan manajemen staff.`, ok: 'Ya, jadikan Owner' }))) return;
      if (isNew) {
        const r = DB.addStaff({ name: E.sname.value, email: E.semail.value, phone: E.sphone.value.trim(), role, status, sendEmail: E.smail.checked });
        if (!r.ok) { validate(F, { [r.field === 'email' ? 'semail' : 'sname']: () => r.msg }); return; }
        m.close(); draw(); sentModal('Staff ditambahkan', r.user, r);
      } else {
        const r = DB.updateStaff(u.id, { name: E.sname.value.trim(), email: E.semail.value.trim().toLowerCase(), phone: E.sphone.value.trim(), role, status });
        if (!r.ok) { validate(F, { semail: () => r.msg }); return; }
        if (self) DB.set('session', Object.assign(DB.session(), { name: r.user.name, email: r.user.email, phone: r.user.phone }));
        m.close(); toast(r.changes.length ? 'Data staff diperbarui.' : 'Tidak ada perubahan.'); draw();
        if (self && r.changes.length) setTimeout(() => location.reload(), 600);
      }
    });
  }

  $('#add').addEventListener('click', () => form());
  ['#q', '#fStatus', '#fRole'].forEach((s) => $(s).addEventListener('input', draw));
  $('#rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), tg = e.target.closest('[data-toggle]'), rs = e.target.closest('[data-reset]');
    if (ed) form(DB.user(ed.dataset.edit));
    if (tg) {
      const u = DB.user(tg.dataset.toggle); const off = u.status === 'nonaktif';
      if (!off && u.role === 'owner' && activeOwners().length <= 1) { toast('Minimal harus ada satu Owner aktif.', 'err'); return; }
      const ok = await confirmBox(off ? { title: `Aktifkan ${esc(u.name)}?`, text: 'Staff bisa login kembali ke panel.', ok: 'Aktifkan' }
        : { title: `Nonaktifkan ${esc(u.name)}?`, text: 'Staff tidak bisa login lagi dan sesi yang sedang berjalan akan ditutup. Akun dan histori aktivitasnya tetap tersimpan.', ok: 'Nonaktifkan', danger: true });
      if (!ok) return;
      DB.updateStaff(u.id, { status: off ? 'aktif' : 'nonaktif' }); toast(off ? 'Staff diaktifkan.' : 'Staff dinonaktifkan.'); draw();
    }
    if (rs) {
      const u = DB.user(rs.dataset.reset);
      if (!(await confirmBox({ title: `Atur ulang kata sandi ${esc(u.name)}?`, text: `Kata sandi sementara baru dibuat dan dikirim ke ${esc(u.email)}. Kata sandi lama langsung tidak berlaku.`, ok: 'Kirim kata sandi baru' }))) return;
      const r = DB.resetStaffPassword(u.id); draw(); sentModal('Kata sandi diatur ulang', u, r);
    }
  });
  draw();
})();
