(function () {
  if (window.Admin.blocked) return;
  const { DB, D } = Ann;
  const { $, esc, toast, modal, confirmBox, validate, isEmail } = UI;
  Admin.init('owner-staff', 'Manajemen Staff');
  const T = D.today(); const monthFrom = T.slice(0, 8) + '01';
  const me = Admin.me;
  /* Owner hanya bisa membuat akun Admin / Staff. Role tidak bisa diubah dari halaman ini (tidak ada pilihan Owner). */
  const ROLE_INFO = { admin: ['Admin / Staff', 'Mengelola operasional: rental, penjualan, stok, keuangan. Tidak bisa menghapus data dan tidak melihat histori.'], owner: ['Owner', 'Akses penuh: dashboard bisnis, histori sistem, manajemen staff, integrasi & pengaturan toko.'] };
  /* Aturan kata sandi yang dibuat Owner: minimal 8 karakter, ada huruf & angka */
  const pwError = (v) => (v.length < 8 ? 'Kata sandi minimal 8 karakter.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Kata sandi harus berisi huruf dan angka.' : /\s/.test(v) ? 'Kata sandi tidak boleh berisi spasi.' : '');
  
  let staffList = [];
  const getStaff = (id) => staffList.find((u) => u.id === id || String(u.userId) === String(id) || 'u' + u.userId === id) || DB.user(id);
  const activeOwners = () => (staffList.length ? staffList : DB.staff()).filter((u) => u.role === 'owner' && u.status === 'aktif');

  async function fetchStaff() {
    const q = $('#q').value.trim();
    const st = $('#fStatus').value;
    const rl = $('#fRole').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (st) params.set('status', st);
    if (rl) params.set('role', rl);

    const r = await Api.try('GET', 'api/owner/staff' + (params.toString() ? '?' + params.toString() : ''), null, () => ({ ok: true, data: DB.staff() }));
    if (r && r.ok && Array.isArray(r.data)) {
      staffList = r.data;
      draw();
    }
  }

  function list() {
    const q = $('#q').value.trim().toLowerCase(), st = $('#fStatus').value, rl = $('#fRole').value;
    const pool = staffList.length ? staffList : DB.staff();
    return pool.filter((u) => (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)) && (!st || u.status === st) && (!rl || u.role === rl))
      .sort((a, b) => (a.status === 'nonaktif') - (b.status === 'nonaktif') || (a.role === 'owner' ? -1 : 1) - (b.role === 'owner' ? -1 : 1) || a.name.localeCompare(b.name));
  }

  function draw() {
    const S = staffList.length ? staffList : DB.staff();
    const acts = DB.audits().filter((a) => a.type !== 'akses' && D.day(a.at) >= monthFrom);
    const st = (ic, tone, l, v, d) => `<div class="stat"><span class="ic ${tone}"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><strong>${v}</strong>${d ? `<span class="d">${d}</span>` : ''}</div></div>`;
    $('#stats').innerHTML = st('fa-users', '', 'Total staff', S.length, `${S.filter((u) => u.role === 'owner').length} owner`) + st('fa-user-check', '', 'Aktif', S.filter((u) => u.status === 'aktif').length)
      + st('fa-user-slash', 'red', 'Nonaktif', S.filter((u) => u.status === 'nonaktif').length) + st('fa-key', 'amber', 'Belum ganti sandi awal', S.filter((u) => u.mustChangePw && u.status === 'aktif').length, 'perlu login pertama');
    const L = list();
    $('#rows').innerHTML = L.length ? L.map((u) => {
      const p = Admin.presence(u);
      const n = u.activity_count !== undefined ? u.activity_count : acts.filter((a) => a.userId === u.id || a.userId === u.userId).length;
      const self = u.id === me.id || String(u.userId) === String(me.id);
      const off = u.status === 'nonaktif';
      const creator = u.createdBy ? getStaff(u.createdBy) : null;
      return `<tr class="${off ? 'row-off' : ''}">
        <td><div class="prod"><span class="av-dot">${esc(u.name.charAt(0))}</span><div><strong>${esc(u.name)}${self ? ' <span class="pill green plain">Kamu</span>' : ''}</strong><small>${esc(u.email)}${u.phone ? ` · ${esc(u.phone)}` : ''}</small>${u.createdAt ? `<small>Dibuat ${D.fmtDate(u.createdAt)}${creator ? ` oleh ${esc(creator.name)}` : ''}</small>` : ''}</div></div></td>
        <td><span class="pill ${u.role === 'owner' ? 'amber' : 'blue'}">${u.role === 'owner' ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(DB.ROLE_LABEL[u.role] || u.role)}</span></td>
        <td>${off ? '<span class="pill gray">Nonaktif</span>' : '<span class="pill green">Aktif</span>'}${u.mustChangePw && !off ? '<small style="color:#9a6508"><i class="fa-solid fa-key"></i> Belum ganti kata sandi awal</small>' : ''}</td>
        <td>${u.lastLogin ? `${D.fmtDateTime(u.lastLogin)}<small>${Admin.relTime(u.lastLogin)}${u.lastLogout && u.lastLogout > u.lastLogin ? ` · logout ${D.fmtDateTime(u.lastLogout).split(', ')[1]}` : ''}</small>` : '<span class="muted">Belum pernah login</span>'}</td>
        <td class="num">${n}</td>
        <td><div class="acts">
          <a class="btn btn-light btn-xs" href="${Admin.O('histori?staff=' + u.id)}" title="Histori staff"><i class="fa-solid fa-clock-rotate-left"></i> Histori</a>
          <button class="btn btn-light btn-xs" data-edit="${u.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          ${self ? '' : `<button class="btn ${off ? 'btn-primary' : 'btn-light'} btn-xs" data-toggle="${u.id}"><i class="fa-solid ${off ? 'fa-user-check' : 'fa-user-slash'}"></i> ${off ? 'Aktifkan' : 'Nonaktifkan'}</button>`}
        </div></td></tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-solid fa-users"></i></div><h3>Tidak ada staff</h3><p>Coba ubah filter pencarian.</p></div></td></tr>';
  }

  function sentModal(title, u, res) {
    const tempPw = res.temp || res.temp_password || '';
    const m = modal({ title, body: `
      <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-envelope-circle-check"></i><div>${res.mail && res.mail.status !== 'gagal' && res.mail.status !== 'lewati' ? `Email informasi akun dikirim ke <strong>${esc(u.email)}</strong>.` : 'Akun staf berhasil dibuat.'} Staff wajib mengganti kata sandi saat pertama login.</div></div>
      <div class="kv"><span>Email akun</span><strong>${esc(u.email)}</strong></div>
      <div class="kv"><span>Kata sandi sementara</span><span><code class="temp-pw">${esc(tempPw)}</code> <button class="btn btn-light btn-xs" id="cp"><i class="fa-regular fa-copy"></i> Salin</button></span></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Kata sandi sementara hanya ditampilkan sekali di sini. Sistem tidak menyimpan kata sandi dalam bentuk yang bisa dibaca saat backend sudah aktif.</p>`,
      foot: `${res.mail && res.mail.status === 'terkirim' ? '<button class="btn btn-light" id="pv"><i class="fa-regular fa-eye"></i> Lihat email</button>' : ''}<button class="btn btn-primary" data-close>Selesai</button>` });
    m.$('#cp').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(tempPw); toast('Kata sandi sementara disalin.'); });
    const pv = m.$('#pv'); if (pv) pv.addEventListener('click', () => Reports.mailModal(res.mail));
  }

  /* Setelah staff ditambahkan: kata sandi dibuat Owner sendiri, jadi tidak ditampilkan lagi di sini */
  function createdModal(u, res, payload) {
    const mail = res.mail; const sent = mail && mail.status === 'terkirim'; const failed = mail && mail.status === 'gagal';
    const m = modal({ title: 'Staff ditambahkan', body: `
      <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-user-check"></i><div>Akun <strong>${esc(u.name)}</strong> berhasil dibuat sebagai <strong>Admin / Staff</strong>.${sent ? ` Email informasi akun dikirim ke <strong>${esc(u.email)}</strong>.` : ''}</div></div>
      ${failed ? `<div class="notice red" style="margin-bottom:14px"><i class="fa-solid fa-envelope-circle-xmark"></i><div>Email informasi akun gagal dikirim. Sampaikan info login langsung ke staff.</div></div>` : ''}
      <div class="kv"><span>Email login</span><strong>${esc(u.email)}</strong></div>
      <div class="kv"><span>Kata sandi</span><span>Sesuai yang kamu buat tadi</span></div>
      <div class="kv"><span>Ingatkan ganti kata sandi</span><span>${payload.mustChangePw ? 'Ya' : 'Tidak'}</span></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Kirim info login ke WhatsApp pribadi staff (jangan lewat grup chat). Setelah jendela ini ditutup, kata sandi tidak bisa dilihat lagi karena disimpan terenkripsi.</p>`,
      foot: `${sent ? '<button class="btn btn-light" id="pv"><i class="fa-regular fa-eye"></i> Lihat email</button>' : ''}<button class="btn btn-light" data-close>Selesai</button><button class="btn btn-wa" id="waL"><i class="fa-brands fa-whatsapp"></i> Kirim info login ke WhatsApp</button>` });
    const pv = m.$('#pv'); if (pv) pv.addEventListener('click', () => Reports.mailModal(mail));
    m.$('#waL').addEventListener('click', () => { m.close(); setTimeout(() => waLogin(Object.assign({}, payload, u), payload.password, payload.mustChangePw), 230); });
  }

  /* Atur ulang kata sandi (pindah ke jendela Edit staff). Memakai endpoint yang sudah ada: POST api/owner/staff/{id}/reset-password */
  /* Kirim info login (email + kata sandi baru) langsung ke WhatsApp staff — template "staff_pw" bisa diedit Owner */
  function waLogin(u, password, mustChange, title) {
    const nm = (u.name || 'Kak').split(' ')[0];
    UI.waCompose({ title: title || `Kirim info login · ${esc(u.name)}`, phone: u.phone || '', tplKey: 'staff_pw', waLabel: `Kirim ke ${esc(nm)}`,
      note: u.phone ? 'Pesan ini berisi kata sandi. Kirim hanya ke chat pribadi staff.' : 'Nomor HP staff belum diisi. Salin teks pesan lalu kirim manual, atau lengkapi nomor HP di Edit staff.',
      text: DB.waText('staff_pw', { nama_depan: nm, nama: u.name, email_login: u.email, kata_sandi: password, link_login: new URL(UI.url('masuk'), location.href).href,
        wajib_ganti: mustChange ? 'Setelah masuk, ganti kata sandi ini dengan buatanmu sendiri ya (ada pengingat di atas halaman).' : '' }).replace(/\n{3,}/g, '\n\n') });
  }

  /* Atur ulang kata sandi staff: Owner membuat kata sandi baru sendiri (bukan sistem).
     Endpoint yang sama: POST api/owner/staff/{id}/reset-password { password, password_confirmation, mustChangePw, sendEmail } */
  function resetPw(id) {
    const u = getStaff(id); if (!u) return;
    const m = modal({ title: `Atur ulang kata sandi ${esc(u.name)}`, body: `<form id="rpf" novalidate>
      <p class="muted" style="font-size:13px;margin:0 0 12px">Buat kata sandi baru untuk ${esc(u.name)}, lalu berikan langsung ke staff. Kata sandi lama langsung tidak berlaku dan sesi login staff di perangkat lain diakhiri.</p>
      <div class="grid-2">
        <div class="field"><label>Kata sandi baru <span class="req">*</span></label><div class="pw-wrap"><input class="input" type="password" name="rpw" autocomplete="new-password" placeholder="Minimal 8 karakter, huruf & angka"><button type="button" class="pw-eye" data-eye="rpw" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div></div>
        <div class="field"><label>Ulangi kata sandi <span class="req">*</span></label><div class="pw-wrap"><input class="input" type="password" name="rpw2" autocomplete="new-password"><button type="button" class="pw-eye" data-eye="rpw2" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div></div>
      </div>
      <label class="chk-line"><input type="checkbox" name="rmust" checked> <span>Ingatkan staff untuk mengganti kata sandi ini <small class="chk-help">Staff tetap bisa langsung bekerja; pengingat muncul di atas halaman panel sampai kata sandinya diganti.</small></span></label>
      <label class="chk-line"><input type="checkbox" name="rmail"> <span>Kirim email pemberitahuan ke ${esc(u.email)} <small class="chk-help">Kata sandi <b>tidak</b> ikut dikirim.</small></span></label>
      </form>`, foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rpOk"><i class="fa-solid fa-key"></i> Simpan kata sandi baru</button>' });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (!b) return; const inp = m.$(`[name="${b.dataset.eye}"]`); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`; });
    m.$('#rpOk').addEventListener('click', async () => {
      const F = m.$('#rpf'), E = F.elements;
      if (!validate(F, { rpw: () => pwError(E.rpw.value), rpw2: () => (!E.rpw2.value ? 'Ketik ulang kata sandi.' : E.rpw2.value !== E.rpw.value ? 'Kata sandi tidak sama.' : '') })) return;
      const body = { password: E.rpw.value, password_confirmation: E.rpw2.value, mustChangePw: E.rmust.checked, sendEmail: E.rmail.checked };
      const r = await Api.busy(m.$('#rpOk'), () => Api.try('POST', 'api/owner/staff/' + u.id + '/reset-password', body, () => DB.resetStaffPassword(u.id, body)));
      if (r && r.ok) {
        document.querySelectorAll('.modal').forEach((x) => x.remove()); document.body.style.overflow = ''; await fetchStaff();
        const me0 = DB.session();
        DB.notify(u.email, 'Kata sandi akunmu diganti', `${me0 ? me0.name : 'Owner'} mengganti kata sandi akunmu pada ${D.fmtDateTime(D.nowStamp())}.${body.mustChangePw ? ' Ganti dengan kata sandi buatanmu sendiri lewat pengingat di atas halaman.' : ''}`, 'admin/dashboard');
        toast(`Kata sandi ${u.name} sudah diganti.`);
        setTimeout(() => waLogin(u, body.password, body.mustChangePw, `Kirim kata sandi baru · ${esc(u.name)}`), 250); /* langsung ke WhatsApp staff */
      } else if (r) toast(r.msg || 'Gagal mengatur ulang kata sandi.', 'err');
    });
  }

  function form(u) {
    const isNew = !u; u = u || { name: '', email: '', phone: '', role: 'admin', status: 'aktif' };
    const self = u.id === me.id || String(u.userId) === String(me.id);
    const m = modal({ title: isNew ? 'Tambah staff' : `Edit staff · ${esc(u.name)}`, size: 'lg', body: `<form id="sf" novalidate>
      <div class="grid-2">
        <div class="field"><label>Nama lengkap</label><input class="input" name="sname" value="${esc(u.name)}" placeholder="Contoh: Dita Lestari"></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="semail" value="${esc(u.email)}" placeholder="nama@annapurna.id"><span class="hint">Dipakai untuk login dan menerima email akun.</span></div>
        <div class="field"><label>Nomor HP (opsional)</label><input class="input" name="sphone" value="${esc(u.phone || '')}" inputmode="tel"></div>
        <div class="field"><label>Status</label><select class="select" name="sstatus" ${self ? 'disabled' : ''}><option value="aktif" ${u.status === 'aktif' ? 'selected' : ''}>Aktif — bisa login</option><option value="nonaktif" ${u.status === 'nonaktif' ? 'selected' : ''}>Nonaktif — akses ditutup</option></select></div>
      </div>
      <div class="field"><label>Role</label><div class="role-fixed"><span class="pill ${u.role === 'owner' ? 'amber' : 'blue'}">${u.role === 'owner' ? '<i class="fa-solid fa-crown"></i> ' : ''}${ROLE_INFO[u.role === 'owner' ? 'owner' : 'admin'][0]}</span><small>${ROLE_INFO[u.role === 'owner' ? 'owner' : 'admin'][1]}</small></div>
        <span class="hint">${isNew ? 'Akun baru dari halaman ini selalu berperan Admin / Staff.' : 'Role tidak bisa diubah dari halaman ini.'}</span></div>
      ${isNew ? `<div class="sf-pw">
        <div class="grid-2">
          <div class="field"><label>Kata sandi <span class="req" style="color:var(--red)">*</span></label><div class="pw-wrap"><input class="input" type="password" name="spw" autocomplete="new-password" placeholder="Minimal 8 karakter, huruf & angka"><button type="button" class="pw-eye" data-eye="spw" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div><span class="pw-meter" id="pwMeter"><i></i><b></b></span></div>
          <div class="field"><label>Ulangi kata sandi <span class="req" style="color:var(--red)">*</span></label><div class="pw-wrap"><input class="input" type="password" name="spw2" autocomplete="new-password" placeholder="Ketik ulang kata sandi"><button type="button" class="pw-eye" data-eye="spw2" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div></div>
        </div>
        <label class="chk-line"><input type="checkbox" name="smust" checked> <span>Ingatkan staff untuk mengganti kata sandi ini <small class="chk-help">Staff tetap bisa langsung bekerja; pengingat muncul di atas halaman panel sampai kata sandinya diganti.</small></span></label>
        <label class="chk-line"><input type="checkbox" name="smail" checked> <span>Kirim email informasi akun ke staff <small class="chk-help">Berisi nama toko, email akun, link website, dan cara login. Kata sandi <b>tidak</b> ikut dikirim, berikan langsung ke staff.</small></span></label>
      </div>` : ''}
      ${self ? '<p class="muted" style="font-size:12.5px;margin-top:8px">Status akunmu sendiri tidak bisa diubah dari sini.</p>' : ''}
      ${!isNew && !self ? `<div class="sf-reset"><i class="fa-solid fa-key"></i><span>Staff lupa kata sandi? <button type="button" class="link-btn" data-reset="${u.id}">Buat kata sandi baru</button><small>Kata sandi baru dibuat Owner dan diberikan langsung ke staff.</small></span></div>` : ''}
      </form>`,
      foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="sSave"><i class="fa-solid ${isNew ? 'fa-user-plus' : 'fa-floppy-disk'}"></i> ${isNew ? 'Tambah staff' : 'Simpan'}</button>` });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (!b) return; const inp = m.$(`[name="${b.dataset.eye}"]`); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`; b.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'); });
    const pw1 = m.$('[name="spw"]');
    if (pw1) pw1.addEventListener('input', () => { const v = pw1.value; const sc = !v ? 0 : (v.length >= 8) + (/[A-Za-z]/.test(v) && /\d/.test(v)) + (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) + (/[a-z]/.test(v) && /[A-Z]/.test(v));
      const L = [['', ''], ['lemah', 'red'], ['cukup', 'amber'], ['kuat', 'green'], ['sangat kuat', 'green']][sc]; const mt = m.$('#pwMeter'); mt.className = 'pw-meter ' + L[1]; mt.querySelector('i').style.width = (sc * 24) + 'px'; mt.querySelector('b').textContent = v ? 'Kekuatan: ' + L[0] : ''; });
    m.el.addEventListener('click', (e) => { const r = e.target.closest('[data-reset]'); if (r) resetPw(r.dataset.reset); });
    m.$('#sSave').addEventListener('click', async () => {
      const F = m.$('#sf'), E = F.elements;
      const rules = { sname: (v) => (v.length < 3 ? 'Nama minimal 3 huruf.' : ''), semail: (v) => (!isEmail(v) ? 'Email tidak valid.' : ''), sphone: (v) => (v && !/^[0-9+\s-]{8,16}$/.test(v) ? 'Nomor HP tidak valid.' : '') };
      if (isNew) { rules.spw = (v) => pwError(E.spw.value); rules.spw2 = () => (!E.spw2.value ? 'Ketik ulang kata sandi.' : E.spw2.value !== E.spw.value ? 'Kata sandi tidak sama.' : ''); }
      if (!validate(F, rules)) return;
      /* Role selalu tetap: akun baru = admin, akun lama tidak berubah */
      const role = isNew ? 'admin' : u.role;
      const status = self ? u.status : E.sstatus.value;
      if (!isNew && u.role === 'owner' && u.status === 'aktif' && status !== 'aktif' && activeOwners().length <= 1) { toast('Minimal harus ada satu Owner aktif.', 'err'); return; }

      if (isNew) {
        const payload = {
          name: E.sname.value.trim(),
          email: E.semail.value.trim().toLowerCase(),
          phone: E.sphone.value.trim(),
          role: 'admin',
          status,
          password: E.spw.value,
          password_confirmation: E.spw2.value,
          mustChangePw: E.smust.checked,
          sendEmail: E.smail.checked
        };
        const r = await Api.busy(m.$('#sSave'), () => Api.try('POST', 'api/owner/staff', payload, () => DB.addStaff(payload)), 'Menyimpan…');
        if (!r || !r.ok) {
          if (r && r.errors) Api.showErrors(F, r);
          else toast((r && r.msg) || 'Gagal menambahkan staff.', 'err');
          return;
        }
        m.close();
        await fetchStaff();
        /* r.raw = jawaban server ({ ok, user, mail }) atau hasil DB.addStaff saat mode lokal */
        const raw = r.raw || {};
        createdModal(Object.assign({}, payload, raw.user || {}), raw, payload);
      } else {
        const payload = {
          name: E.sname.value.trim(),
          email: E.semail.value.trim().toLowerCase(),
          phone: E.sphone.value.trim(),
          status
        };
        const r = await Api.busy(m.$('#sSave'), () => Api.try('PATCH', 'api/owner/staff/' + u.id, payload, () => DB.updateStaff(u.id, payload)), 'Menyimpan…');
        if (!r || !r.ok) {
          if (r && r.errors) Api.showErrors(F, r);
          else toast((r && r.msg) || 'Gagal memperbarui staff.', 'err');
          return;
        }
        m.close();
        toast((r.changes && r.changes.length) ? 'Data staff diperbarui.' : 'Data staff disimpan.');
        await fetchStaff();
        if (self && r.changes && r.changes.length) setTimeout(() => location.reload(), 600);
      }
    });
  }

  $('#add').addEventListener('click', () => form());
  ['#q', '#fStatus', '#fRole'].forEach((s) => $(s).addEventListener('input', () => { fetchStaff(); }));
  $('#rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), tg = e.target.closest('[data-toggle]'), rs = e.target.closest('[data-reset]');
    if (ed) form(getStaff(ed.dataset.edit));
    if (tg) {
      const u = getStaff(tg.dataset.toggle); const off = u.status === 'nonaktif';
      if (!off && u.role === 'owner' && activeOwners().length <= 1) { toast('Minimal harus ada satu Owner aktif.', 'err'); return; }
      const ok = await confirmBox(off ? { title: `Aktifkan ${esc(u.name)}?`, text: 'Staff bisa login kembali ke panel.', ok: 'Aktifkan' }
        : { title: `Nonaktifkan ${esc(u.name)}?`, text: 'Staff tidak bisa login lagi dan sesi yang sedang berjalan akan ditutup. Akun dan histori aktivitasnya tetap tersimpan.', ok: 'Nonaktifkan', danger: true });
      if (!ok) return;

      const r = await Api.try('POST', 'api/owner/staff/' + u.id + '/toggle', null, () => DB.updateStaff(u.id, { status: off ? 'aktif' : 'nonaktif' }));
      if (r && r.ok) {
        toast(off ? 'Staff diaktifkan.' : 'Staff dinonaktifkan.');
        await fetchStaff();
      } else if (r) {
        toast(r.msg || 'Gagal mengubah status staff.', 'err');
      }
    }
    if (rs) {
      const u = getStaff(rs.dataset.reset);
      if (!(await confirmBox({ title: `Atur ulang kata sandi ${esc(u.name)}?`, text: `Kata sandi sementara baru dibuat dan dikirim ke ${esc(u.email)}. Kata sandi lama langsung tidak berlaku.`, ok: 'Kirim kata sandi baru' }))) return;
      const r = await Api.try('POST', 'api/owner/staff/' + u.id + '/reset-password', null, () => DB.resetStaffPassword(u.id));
      if (r && r.ok) {
        await fetchStaff();
        sentModal('Kata sandi diatur ulang', u, r);
      } else if (r) {
        toast(r.msg || 'Gagal mereset kata sandi.', 'err');
      }
    }
  });

  // Muat data awal dari API
  fetchStaff();
})();
