(function () {
  const { DB, Rules, STATUS, D, rupiah } = window.Ann;
  const { $, $$, esc, asset, url, toast, modal, confirmBox, pill } = window.UI;

  const me = DB.session();
  const rec = me && DB.user(me.id);
  const basePath = new URL(UI.BASE || '/', location.href).pathname;
  const here = location.pathname.slice(basePath.length) + location.search;
  if (!me || !DB.isStaff(me) || !rec || !DB.isStaff(rec) || rec.status === 'nonaktif') {
    const blockedAcc = me && rec && rec.status === 'nonaktif';
    if (blockedAcc) DB.logout();
    location.replace(url('masuk?next=' + encodeURIComponent(here) + (blockedAcc ? '&nonaktif=1' : '')));
    window.Admin = { blocked: true };
    return;
  }
  if (me.role !== rec.role || me.name !== rec.name) { Object.assign(me, { role: rec.role, name: rec.name }); DB.set('session', me); }
  const isOwner = me.role === 'owner';
  if (document.body.dataset.ownerOnly === '1' && !isOwner) {
    location.replace(url('admin/dashboard'));
    window.Admin = { blocked: true };
    return;
  }
  const A = (p) => url('admin/' + p), O = (p) => url('owner/' + p);

  const bookingBadge = () => DB.bookings().filter((b) => b.status === 'menunggu_konfirmasi').length + pendingRequests().length;
  const OPS = [
    { id: 'booking', href: A('booking'), icon: 'fa-calendar-check', label: 'Booking Rental', cnt: bookingBadge },
    { id: 'pengembalian', href: A('pengembalian'), icon: 'fa-right-left', label: 'Barang Keluar & Kembali', cnt: () => { const q = DB.careQueue(); return DB.bookings().filter((b) => b.status === 'disewa' && b.end <= D.today()).length + q.cuci.length + q.perbaikan.length; } },
    { id: 'barang', href: A('barang'), icon: 'fa-boxes-stacked', label: 'Data Barang' },
    { id: 'penjualan', href: A('penjualan'), icon: 'fa-bag-shopping', label: 'Penjualan', cnt: () => DB.sales().filter((s) => ['diproses', 'dikemas'].includes(s.status) || s.paymentStatus === 'verifying').length },
    { id: 'ulasan', href: A('ulasan'), icon: 'fa-star', label: 'Ulasan & Testimoni', cnt: () => DB.reviews().filter((r) => !r.seen).length },
  ];
  const MENU = isOwner ? [
    { id: 'owner-dashboard', href: O('dashboard'), icon: 'fa-gauge-high', label: 'Dashboard' },
    { fold: 'ops', label: 'Operasional', icon: 'fa-store', items: OPS },
    { id: 'keuangan', href: A('keuangan'), icon: 'fa-wallet', label: 'Keuangan' },
    { id: 'laporan', href: A('laporan'), icon: 'fa-file-lines', label: 'Laporan' },
    { grp: 'Bisnis' },
    { id: 'owner-pelanggan', href: O('pelanggan'), icon: 'fa-address-book', label: 'Data Pelanggan' },
    { id: 'owner-promo', href: O('promo'), icon: 'fa-ticket', label: 'Promo & Diskon' },
    { grp: 'Pengawasan' },
    { id: 'owner-histori', href: O('histori'), icon: 'fa-clock-rotate-left', label: 'Histori Sistem' },
    { id: 'owner-staff', href: O('staff'), icon: 'fa-users-gear', label: 'Manajemen Staff', cnt: () => DB.staff().filter((u) => u.mustChangePw && u.status === 'aktif').length },
    { id: 'owner-konfigurasi', href: O('konfigurasi'), icon: 'fa-sliders', label: 'Konfigurasi Sistem' },
  ] : [
    { id: 'dashboard', href: A('dashboard'), icon: 'fa-gauge-high', label: 'Dashboard' },
    { grp: 'Operasional' },
    ...OPS.slice(0, 4),
    { grp: 'Pelanggan & Keuangan' },
    OPS[4],
    { id: 'keuangan', href: A('keuangan'), icon: 'fa-cash-register', label: 'Kas Harian' },
  ];
  /* Halaman yang digabung jadi tab: id halaman → id menu induk */
  const PARENT = { kalender: 'booking', permintaan: 'booking', perawatan: 'pengembalian', 'owner-integrasi': 'laporan', pengaturan: isOwner ? 'owner-konfigurasi' : '', sop: '', ...(isOwner ? { dashboard: 'owner-dashboard' } : {}) };
  const SUBTABS = {
    pengembalian: [['pengembalian', 'Barang keluar & kembali', A('pengembalian'), 'fa-right-left'], ['perawatan', 'Perawatan unit', A('perawatan'), 'fa-soap', () => { const q = DB.careQueue(); return q.cuci.length + q.perbaikan.length; }]],
    booking: [['booking', 'Daftar booking', A('booking'), 'fa-list'], ['kalender', 'Kalender', A('kalender'), 'fa-calendar-days'], ['permintaan', 'Permintaan', A('permintaan'), 'fa-arrows-rotate', () => pendingRequests().length]],
    ...(isOwner ? {
      'owner-dashboard': [['owner-dashboard', 'Ringkasan bisnis', O('dashboard'), 'fa-chart-line'], ['dashboard', 'Operasional hari ini', A('dashboard'), 'fa-sun']],
      laporan: [['laporan', 'Laporan', A('laporan'), 'fa-file-lines'], ['owner-integrasi', 'Rekap otomatis (Drive & Email)', O('integrasi'), 'fa-cloud-arrow-up']],
      'owner-konfigurasi': [['owner-konfigurasi', 'Konfigurasi sistem', O('konfigurasi'), 'fa-sliders'], ['pengaturan', 'Profil toko & rekening', A('pengaturan'), 'fa-store']],
    } : {}),
  };
  const menuOf = (active) => (active in PARENT ? PARENT[active] : active);
  function subTabs(active) {
    const g = SUBTABS[menuOf(active)]; const box = document.querySelector('.content');
    const old = document.getElementById('subTabs'); if (old) old.remove();
    if (!g || !box) return;
    box.insertAdjacentHTML('afterbegin', `<nav class="sub-tabs" id="subTabs">${g.map(([id, l, href, ic, cnt]) => { const c = cnt ? cnt() : 0; return `<a href="${href}" class="${id === active ? 'on' : ''}"><i class="fa-solid ${ic}"></i> ${l}${c ? `<span class="cnt">${c}</span>` : ''}</a>`; }).join('')}</nav>`);
  }

  const waNum = (c) => String(c.phone).replace(/\D/g, '').replace(/^0/, '62');
  function reminderText(b) {
    const st = DB.settings(); const late = D.diffDays(b.end, D.today());
    const first = b.customer.name.split(' ')[0];
    return late > 0
      ? `Halo Kak ${first}, kami dari ${st.storeName}. Sewa ${b.id} (${itemsText(b)}) seharusnya dikembalikan ${D.fmtDate(b.end, true)} dan sekarang sudah terlambat ${late} hari. Mohon segera dikembalikan ke toko ya (${st.hours}). Denda keterlambatan berlaku sesuai ketentuan. Terima kasih!`
      : `Halo Kak ${first}, kami dari ${st.storeName} 👋 Mengingatkan bahwa sewa ${b.id} (${itemsText(b)}) jadwal pengembaliannya *hari ini, ${D.fmtDate(b.end, true)}*. Barang bisa dikembalikan ke toko ${st.hours}. Terima kasih sudah menyewa di Annapurna!`;
  }
  function remindWa(b) {
    window.open(`https://wa.me/${waNum(b.customer)}?text=${encodeURIComponent(reminderText(b))}`, '_blank');
    const fresh = DB.booking(b.id);
    fresh.reminders = fresh.reminders || []; fresh.reminders.push({ at: D.nowStamp(), by: me.name });
    fresh.history = fresh.history || []; fresh.history.push({ at: D.nowStamp(), text: `Pengingat pengembalian dikirim via WhatsApp (${me.name})` });
    DB.saveBooking(fresh);
    DB.audit({ type: 'rental', action: `Mengirim pengingat pengembalian ${b.id} ke ${b.customer.name} via WhatsApp`, ref: b.id });
  }
  const remindedToday = (b) => (b.reminders || []).some((r) => D.day(r.at) === D.today());
  /* Notifikasi otomatis: rental yang harus kembali hari ini → ingatkan staff menghubungi penyewa. */
  function dueTodayNotices() {
    const T = D.today(); const sent = DB.get('dueNotices');
    DB.bookings().filter((b) => b.status === 'disewa' && b.end === T).forEach((b) => {
      const key = `${b.id}|${T}`; if (sent.includes(key)) return;
      DB.notifyStaff('Pengembalian hari ini', `${b.id} · ${b.customer.name} harus mengembalikan ${itemsText(b)} hari ini. Ingatkan penyewa via WhatsApp.`, 'admin/pengembalian?remind=' + b.id);
      sent.push(key);
    });
    DB.set('dueNotices', sent);
  }

  /* ---------- Scan QR nota ---------- */
  function openRef(txt) {
    const id = (String(txt).toUpperCase().match(/(RNT|ORD)-\d{3,6}/) || [])[0];
    if (!id) { toast('QR / kode tidak dikenali.', 'err'); return false; }
    if (id.startsWith('RNT') ? !DB.booking(id) : !DB.sale(id)) { toast(`${id} tidak ditemukan.`, 'err'); return false; }
    DB.audit({ type: 'akses', action: `Membuka ${id} lewat scan QR nota`, ref: id });
    location.href = A(id.startsWith('RNT') ? 'booking?id=' + id : 'penjualan?id=' + id); return true;
  }
  async function scanQR() {
    let stream = null, raf = 0, stop = false;
    const m = UI.modal({ title: 'Scan QR nota customer', body: `<div class="scan-box"><video id="qrV" playsinline muted></video><div class="scan-frame"></div><p id="qrMsg" class="muted">Menyalakan kamera…</p></div>
      <div class="field" style="margin-top:14px"><label>Atau ketik nomor booking / pesanan</label><div style="display:flex;gap:8px"><input class="input" id="qrCode" placeholder="RNT-1008"><button class="btn btn-primary" id="qrGo">Buka</button></div></div>`,
      foot: '<button class="btn btn-light" data-close>Tutup</button>' });
    const end = () => { stop = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
    new MutationObserver((mu, ob) => { if (!document.body.contains(m.el)) { end(); ob.disconnect(); } }).observe(document.body, { childList: true });
    m.$('#qrGo').addEventListener('click', () => { if (openRef(m.$('#qrCode').value)) { end(); m.close(); } });
    m.$('#qrCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') m.$('#qrGo').click(); });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = m.$('#qrV'); v.srcObject = stream; await v.play(); m.$('#qrMsg').textContent = 'Arahkan kamera ke QR code di nota customer.';
      const det = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      if (!det) await UI.loadScript(url('assets/vendor/qr/jsQR.js'));
      const c = document.createElement('canvas'); const g = c.getContext('2d', { willReadFrequently: true });
      const tick = async () => { if (stop) return;
        if (v.readyState >= 2) { let txt = null;
          if (det) { const r = await det.detect(v).catch(() => []); if (r[0]) txt = r[0].rawValue; }
          else { c.width = v.videoWidth; c.height = v.videoHeight; g.drawImage(v, 0, 0); const img = g.getImageData(0, 0, c.width, c.height); const r = window.jsQR(img.data, c.width, c.height); if (r) txt = r.data; }
          if (txt && openRef(txt)) { end(); m.close(); return; } }
        raf = requestAnimationFrame(tick); };
      tick();
    } catch (e) { m.$('#qrMsg').textContent = 'Kamera tidak bisa dibuka di perangkat ini. Ketik nomor booking di bawah.'; m.$('#qrV').style.display = 'none'; }
  }
  /* Notifikasi otomatis stok menipis & jadwal perawatan unit (sekali per hari). */
  function stockNotices() {
    const T = D.today(); const sent = DB.get('stockNotices');
    DB.lowStock().forEach((p) => { const k = `low|${p.id}|${T}`; if (sent.includes(k)) return; DB.notifyStaff('Stok menipis', `${p.name} tersisa ${DB.saleableStock(p)} unit (minimum ${p.minStock}). Segera restock.`, 'admin/barang?low=1'); sent.push(k); });
    const q = DB.careQueue(); const k = `care|${T}`;
    if ((q.cuci.length || q.perbaikan.length || q.berkala.length) && !sent.includes(k)) {
      const parts = [q.cuci.length && `${q.cuci.length} unit perlu dicuci`, q.perbaikan.length && `${q.perbaikan.length} unit dalam perbaikan`, q.berkala.length && `${q.berkala.length} unit jatuh tempo perawatan berkala`].filter(Boolean);
      DB.notifyStaff('Perawatan unit hari ini', parts.join(', ') + '.', 'admin/perawatan');
      sent.push(k);
    }
    DB.set('stockNotices', sent);
  }

  /* ---------- Pencarian cepat di topbar ---------- */
  function searchAll(q) {
    const n = q.toLowerCase().trim(); const ph = n.replace(/\D/g, '');
    if (n.length < 2) return [];
    const hit = (...xs) => xs.some((x) => String(x || '').toLowerCase().includes(n));
    const phHit = (p) => ph.length >= 4 && DB.normPhone(p).includes(ph.replace(/^62/, '0'));
    const R = [];
    DB.bookings().filter((b) => hit(b.id, b.customer.name, b.customer.email) || phHit(b.customer.phone)).slice(0, 6).forEach((b) => R.push({ g: 'Booking', ic: 'fa-calendar-check', t: `${b.id} · ${b.customer.name}`, s: `${D.fmtRange(b.start, b.end)} · ${STATUS.rental[b.status].label}`, href: A('booking?id=' + b.id) }));
    DB.sales().filter((x) => hit(x.id, x.customer.name, x.customer.email) || phHit(x.customer.phone)).slice(0, 4).forEach((x) => R.push({ g: 'Penjualan', ic: 'fa-bag-shopping', t: `${x.id} · ${x.customer.name}`, s: `${rupiah(x.total)} · ${STATUS.sale[x.status].label}`, href: A('penjualan?id=' + x.id) }));
    DB.products(true).filter((p) => hit(p.name, p.sku, p.brand)).slice(0, 5).forEach((p) => R.push({ g: 'Barang', ic: 'fa-box', t: p.name, s: `${p.sku || p.id}${p.brand ? ' · ' + p.brand : ''} · stok ${p.stock}`, href: A('barang?q=' + encodeURIComponent(p.name)) }));
    DB.products(true).forEach((p) => (p.units || []).filter((u) => u.code.toLowerCase().includes(n)).slice(0, 3).forEach((u) => R.push({ g: 'Unit', ic: 'fa-barcode', t: `${u.code} · ${p.name}`, s: `Kondisi ${u.cond}`, href: A('barang?unit=' + p.id) })));
    if (isOwner && DB.customers) DB.customers().filter((c) => hit(c.name, c.email) || phHit(c.phone)).slice(0, 4).forEach((c) => R.push({ g: 'Pelanggan', ic: 'fa-user', t: c.name, s: `${c.phone || ''} · ${c.count} transaksi`, href: O('pelanggan?q=' + encodeURIComponent(c.email)) }));
    return R.slice(0, 14);
  }
  function bindSearch() {
    const inp = $('#gsIn'), res = $('#gsRes'); if (!inp) return; let sel = -1, L = [];
    const draw = () => {
      L = searchAll(inp.value); sel = L.length ? 0 : -1;
      if (inp.value.trim().length < 2) { res.classList.remove('open'); return; }
      let last = '';
      res.innerHTML = L.length ? L.map((r, i) => { const h = r.g !== last ? `<div class="gs-g">${r.g}</div>` : ''; last = r.g; return `${h}<a href="${r.href}" class="${i === sel ? 'on' : ''}" data-i="${i}"><i class="fa-solid ${r.ic}"></i><span><b>${esc(r.t)}</b><small>${esc(r.s)}</small></span></a>`; }).join('') : `<div class="gs-empty">Tidak ada hasil untuk “${esc(inp.value)}”.</div>`;
      res.classList.add('open');
    };
    const mark = () => res.querySelectorAll('a').forEach((a) => a.classList.toggle('on', +a.dataset.i === sel));
    inp.addEventListener('input', draw);
    inp.addEventListener('focus', () => { if (inp.value.trim().length >= 2) draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(L.length - 1, sel + 1); mark(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      if (e.key === 'Enter' && L[sel]) { e.preventDefault(); location.href = L[sel].href; }
      if (e.key === 'Escape') { res.classList.remove('open'); inp.blur(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#gs')) res.classList.remove('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !document.querySelector('.modal')) { e.preventDefault(); inp.focus(); } });
  }

  function pendingRequests() {
    const out = [];
    DB.bookings().forEach((b) => {
      if (b.paymentStatus === 'refund_pending') out.push({ type: 'refund', b });
      (b.changes || []).forEach((c) => { if (c.status === 'menunggu') out.push({ type: 'change', b, c }); });
      (b.extensions || []).forEach((x) => { if (x.status === 'menunggu') out.push({ type: 'extend', b, x }); });
    });
    return out;
  }

  function renderShell(active, title) {
    const side = $('#side'), top = $('#topbar');
    side.innerHTML = `
      <div class="sb"><a href="${url(DB.panelHome(me))}"><img src="${url('assets/img/logo-white.png')}" alt="Annapurna Adventure"></a></div>
      <nav>${(() => { const cur = menuOf(active); const link = (m) => { const c = m.cnt ? m.cnt() : 0; return `<a href="${m.href}" class="${m.id === cur ? 'active' : ''}"><i class="fa-solid ${m.icon}"></i>${m.label}${c ? `<span class="cnt">${c}</span>` : ''}</a>`; };
        return MENU.map((m) => {
          if (m.grp) return `<div class="grp">${m.grp}</div>`;
          if (m.fold) { const inside = m.items.some((x) => x.id === cur); let open; try { open = inside || localStorage.getItem('ann-fold-' + m.fold) !== '0'; } catch (e) { open = inside; }
            const c = m.items.reduce((a, x) => a + (x.cnt ? x.cnt() : 0), 0);
            return `<details class="fold" data-fold="${m.fold}" ${open ? 'open' : ''}><summary><i class="fa-solid ${m.icon}"></i>${m.label}${c ? `<span class="cnt">${c}</span>` : ''}<i class="fa-solid fa-chevron-down chev"></i></summary><div class="fold-in">${m.items.map(link).join('')}</div></details>`; }
          return link(m);
        }).join(''); })()}</nav>
      <div class="sf">
        <a href="${url('./')}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat Website</a>
        <a href="#" id="admLogout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</a>
      </div>`;
    const notifs = DB.notifications(me.email);
    const unread = notifs.filter((n) => !n.read).length;
    top.innerHTML = `
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Buka menu"><i class="fa-solid fa-bars"></i></button>
      <h1>${esc(title)}</h1>
      <div class="sp"></div>
      <div class="gsearch" id="gs"><i class="fa-solid fa-magnifying-glass"></i><input id="gsIn" placeholder="Cari booking, customer, no. HP, barang…" autocomplete="off" aria-label="Pencarian cepat"><kbd>/</kbd><div class="gs-res" id="gsRes" role="listbox"></div></div>
      <button class="btn btn-light btn-sm scan-btn" id="scanBtn" title="Scan QR nota customer"><i class="fa-solid fa-qrcode"></i><span> Scan QR</span></button>
      <span class="date"><i class="fa-regular fa-calendar"></i> ${D.HARI[new Date().getDay()]}, ${D.fmtDate(D.today(), true)}</span>
      <div class="dropdown">
        <button class="icon-btn" data-dd aria-label="Notifikasi"><i class="fa-regular fa-bell"></i>${unread ? `<span class="dot">${unread > 99 ? "99+" : unread}</span>` : ''}</button>
        <div class="dropdown-menu notif-menu nx-menu" style="right:0" id="admNx"></div>
      </div>
      <div class="dropdown" id="whoDd"><button class="who" data-dd aria-label="Menu akun"><span class="av">${esc(me.name.charAt(0))}</span><span>${esc(me.name)}<small>${isOwner ? '<i class="fa-solid fa-crown" style="color:var(--gold)"></i> Owner' : 'Admin / Staff'}</small></span><i class="fa-solid fa-chevron-down" style="font-size:10px;color:var(--muted)"></i></button>
        <div class="dropdown-menu who-menu" style="right:0">
          <div class="wm-h"><strong>${esc(me.name)}</strong><small>${esc(me.email)}</small></div>
          <a href="${A('pengaturan?tab=akun')}"><i class="fa-solid fa-user-pen"></i> Akun saya</a>
          <a href="${A('sop')}"><i class="fa-solid fa-clipboard-list"></i> SOP & Peraturan</a>
          ${isOwner ? `<a href="${A('pengaturan')}"><i class="fa-solid fa-store"></i> Profil toko & rekening</a>` : ''}
          <a href="${url('./')}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat website</a>
          <a href="#" id="whoLogout" class="danger"><i class="fa-solid fa-right-from-bracket"></i> Keluar</a>
        </div></div>`;
    subTabs(active);
    $('#scanBtn').addEventListener('click', scanQR);
    bindSearch();
    $('#menuBtn').addEventListener('click', () => { side.classList.add('open'); $('#sideBg').classList.add('open'); });
    $('#sideBg').addEventListener('click', () => { side.classList.remove('open'); $('#sideBg').classList.remove('open'); });
    top.querySelectorAll('.dropdown').forEach((dd) => dd.querySelector('[data-dd]').addEventListener('click', (e) => { e.stopPropagation(); top.querySelectorAll('.dropdown.open').forEach((o) => { if (o !== dd) o.classList.remove('open'); }); dd.classList.toggle('open'); }));
    side.querySelectorAll('details.fold').forEach((d) => d.addEventListener('toggle', () => { try { localStorage.setItem('ann-fold-' + d.dataset.fold, d.open ? '1' : '0'); } catch (e) { /* abaikan */ } }));
    $('#whoLogout').addEventListener('click', (e) => { e.preventDefault(); $('#admLogout').click(); });
    UI.notifMenu($('#admNx'), me.email, () => renderShell(shellState.active, shellState.title));
    const ra = $('#admReadAll'); if (ra) ra.addEventListener('click', (e) => { e.stopPropagation(); DB.markRead(me.email); refreshShell(); });
    $('#admLogout').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!(await confirmBox({ title: `Keluar dari panel ${isOwner ? 'owner' : 'admin'}?`, text: 'Sesi akan diakhiri dan waktu logout tercatat di histori.', ok: 'Keluar' }))) return;
      DB.logout(); location.href = url('masuk');
    });
  }
  let shellState = null;
  function refreshShell() { if (shellState) renderShell(shellState.active, shellState.title); }
  document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) $$('.dropdown.open').forEach((o) => o.classList.remove('open')); });

  function forcePassword() {
    const m = UI.modal({ locked: true, title: 'Buat kata sandi baru', body: `
      <div class="notice" style="margin-bottom:14px"><i class="fa-solid fa-key"></i><div>Akun kamu dibuat oleh Owner dengan <strong>kata sandi sementara</strong>. Demi keamanan, ganti kata sandi sebelum mulai bekerja.</div></div>
      <form id="fpw" novalidate>
        <div class="field"><label>Kata sandi sementara</label><input class="input" type="password" name="old" autocomplete="current-password"></div>
        <div class="field"><label>Kata sandi baru</label><input class="input" type="password" name="npw" autocomplete="new-password"><span class="hint">Minimal 6 karakter.</span></div>
        <div class="field"><label>Ulangi kata sandi baru</label><input class="input" type="password" name="npw2" autocomplete="new-password"></div>
      </form>`,
      foot: `<button class="btn btn-light" id="fpwOut">Keluar</button><button class="btn btn-primary" id="fpwOk"><i class="fa-solid fa-check"></i> Simpan kata sandi</button>` });
    m.$('#fpwOut').addEventListener('click', () => { DB.logout(); location.href = url('masuk'); });
    m.$('#fpwOk').addEventListener('click', () => {
      const F = m.$('#fpw'), E = F.elements;
      if (!UI.validate(F, { old: (v) => (!v ? 'Wajib diisi.' : ''), npw: (v) => (v.length < 6 ? 'Minimal 6 karakter.' : v === E.old.value ? 'Harus berbeda dari kata sandi sementara.' : ''), npw2: (v) => (v !== E.npw.value ? 'Kata sandi tidak sama.' : '') })) return;
      if (!DB.changePassword(E.old.value, E.npw.value)) { UI.validate(F, { old: () => 'Kata sandi sementara salah.' }); return; }
      me.mustChangePw = false; m.close(); toast('Kata sandi baru disimpan. Selamat bekerja!');
    });
  }

  function init(active, title) {
    dueTodayNotices(); stockNotices();
    shellState = { active, title }; renderShell(active, title);
    document.title = `${title} — ${isOwner ? 'Owner' : 'Admin'} Annapurna`;
    DB.touch();
    const s = DB.session(); s.seen = s.seen || {};
    const key = location.pathname;
    if (!s.seen[key] || Date.now() - new Date(s.seen[key]).getTime() > 30 * 60000) {
      DB.audit({ type: 'akses', action: `Membuka halaman ${title}` });
      const s2 = DB.session(); s2.seen = Object.assign(s2.seen || {}, { [key]: D.nowStamp() }); DB.set('session', s2);
    }
    if (me.mustChangePw) forcePassword();
    if (isOwner && window.Reports) Reports.autoMonthly();
  }

  const val = (r) => (typeof r === 'string' && r !== '-' ? r : '');
  const log = (x, text, type, action, changes) => {
    x.history = x.history || []; x.history.push({ at: D.nowStamp(), text: `${text} (${me.name})` });
    DB.audit({ type: type || 'edit', action: action || `${text} — ${x.id}`, ref: x.id, changes });
  };
  const chg = (field, from, to) => [{ field, from, to }];
  const rl = (k) => STATUS.rental[k].label, sl = (k) => STATUS.sale[k].label;
  const sisa = (b) => Math.max(0, b.total - Rules.paidTotal(b));
  const itemsText = (b) => b.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
  const custLink = (c) => `https://wa.me/${String(c.phone).replace(/\D/g, '').replace(/^0/, '62')}`;

  /* ---------- Form & SOP yang diatur Owner (Konfigurasi → Form & Field, SOP) ---------- */
  const SOP_CTX = { pickup: 'barang_keluar', return: 'pengembalian', cancel: 'pembatalan' };
  function sopBox(k) {
    const L = DB.sops(SOP_CTX[k]).filter((x) => x.active !== false);
    if (!L.length) return '';
    return `<div class="sop-inline"><div class="si-h"><i class="fa-solid fa-clipboard-list"></i> SOP yang berlaku</div>${L.map((x) => `<details ${L.length === 1 ? 'open' : ''}><summary>${esc(x.title)}</summary><p>${esc(x.body)}</p></details>`).join('')}
      <label class="chk-line"><input type="checkbox" data-sopok> Saya sudah mengikuti SOP di atas</label></div>`;
  }
  function extraFields(k) {
    const f = DB.formCfg(k); const req = (mode) => (mode === 'wajib' ? ' <span class="req">*</span>' : '');
    let h = '';
    if (f.photo !== 'sembunyi') h += `<div class="field"><label>${k === 'return' ? 'Foto kondisi barang' : 'Foto barang saat keluar'}${req(f.photo)}</label><div class="photo-up" data-photo><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-camera"></i> Ambil / pilih foto<input type="file" accept="image/*" capture="environment" hidden data-photoin></label><div class="photo-prev"></div></div></div>`;
    (f.custom || []).forEach((c) => {
      const lbl = `${esc(c.label)}${c.required ? ' <span class="req">*</span>' : ''}`;
      if (c.type === 'centang') h += `<label class="chk-line"><input type="checkbox" data-cx="${c.id}"> ${lbl}</label>`;
      else if (c.type === 'pilihan') h += `<div class="field"><label>${lbl}</label><select class="select" data-cx="${c.id}"><option value="">— Pilih —</option>${(c.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
      else if (c.type === 'foto') h += `<div class="field"><label>${lbl}</label><div class="photo-up" data-photo data-cx="${c.id}"><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-camera"></i> Pilih foto<input type="file" accept="image/*" hidden data-photoin></label><div class="photo-prev"></div></div></div>`;
      else h += `<div class="field"><label>${lbl}</label><input class="input" data-cx="${c.id}" ${c.type === 'angka' ? 'type="number"' : ''}></div>`;
    });
    return h;
  }
  function bindExtras(m) {
    m.$$('[data-photoin]').forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return; if (f.size > 8e6) { toast('Ukuran foto maksimal 8 MB.', 'err'); return; }
      const box = inp.closest('[data-photo]'); box.dataset.val = await UI.fileToDataURL(f, 640); box.classList.remove('err');
      box.querySelector('.photo-prev').innerHTML = `<img src="${box.dataset.val}" alt="Foto">`;
    }));
  }
  function readExtras(m, k) {
    const f = DB.formCfg(k); const errs = [];
    const sopOk = m.$('[data-sopok]'); if (sopOk && !sopOk.checked) errs.push('konfirmasi SOP');
    const main = m.$('[data-photo]:not([data-cx])'); const photo = main ? main.dataset.val || '' : '';
    if (main && f.photo === 'wajib' && !photo) { errs.push('foto'); main.classList.add('err'); }
    const extra = [];
    (f.custom || []).forEach((c) => {
      const el = m.$(`[data-cx="${c.id}"]`); if (!el) return;
      const v = c.type === 'centang' ? (el.checked ? 'Ya' : '') : c.type === 'foto' ? el.dataset.val || '' : el.value.trim();
      if (c.required && !v) { errs.push(c.label); el.classList.add('err'); }
      if (v) extra.push({ label: c.label, value: v, type: c.type });
    });
    if (errs.length) { toast(`Lengkapi dulu: ${errs.join(', ')}.`, 'err'); return null; }
    return { photo, extra };
  }
  const extrasHtml = (x) => [x.photo ? `<img class="proof-img" style="max-width:180px;margin-top:6px" src="${x.photo}" alt="Foto">` : '', ...(x.extra || []).map((e) => e.type === 'foto' ? `<br><span class="muted">${esc(e.label)}:</span><br><img class="proof-img" style="max-width:160px" src="${e.value}" alt="">` : `<br><span class="muted">${esc(e.label)}:</span> ${esc(e.value)}`)].join('');

  /* ---------- Unit fisik saat barang keluar / kembali ---------- */
  function unitNeeds(b) {
    const out = [];
    b.items.forEach((it, i) => it.components.forEach((c) => { const p = DB.product(c.productId); if (!p || !DB.tracked(p)) return; out.push({ i, p, size: c.size || null, n: c.qty * it.qty, label: DB.variantName(p, c.size || null) }); }));
    return out;
  }
  function unitPicker(b) {
    const needs = unitNeeds(b); if (!needs.length) return '';
    return `<div class="mini-sec"><h4>Unit yang diserahkan</h4><p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Centang nomor unit fisik yang diberikan ke customer. Unit yang belum dicuci, sedang diperbaiki, atau sedang disewa tidak bisa dipilih.</p>${needs.map((x, k) => {
      const cand = (x.p.units || []).filter((u) => u.status === 'aktif' && (!x.size || u.size === x.size));
      const free = cand.filter((u) => DB.unitReady(u)).sort((a, c) => a.sinceService - c.sinceService);
      const pre = new Set(free.slice(0, x.n).map((u) => u.code));
      return `<div class="unit-pick" data-need="${k}" data-n="${x.n}"><div class="up-h"><b>${esc(x.label)}</b><span class="muted">pilih ${x.n} unit</span></div><div class="up-grid">${cand.map((u) => { const ok = DB.unitReady(u); const due = DB.serviceDue(x.p, u); const st = DB.unitState(u);
        return `<label class="up-u ${ok ? '' : 'no'}" title="${esc(u.notes || '')}"><input type="checkbox" value="${u.code}" data-pid="${x.p.id}" ${pre.has(u.code) ? 'checked' : ''} ${ok ? '' : 'disabled'}><span><b>${u.code}</b><small>${ok ? esc(u.cond) : esc(st.l)}${due && ok ? ' · jatuh tempo perawatan' : ''}</small></span></label>`; }).join('')}</div></div>`;
    }).join('')}</div>`;
  }
  function readUnitPicks(m, b) {
    const needs = unitNeeds(b); const picks = {};
    for (let k = 0; k < needs.length; k++) {
      const box = m.$(`[data-need="${k}"]`); const sel = [...box.querySelectorAll('input:checked')];
      if (sel.length !== needs[k].n) { box.classList.add('err'); toast(`Pilih tepat ${needs[k].n} unit untuk ${needs[k].label}.`, 'err'); return null; }
      box.classList.remove('err');
      (picks[needs[k].i] = picks[needs[k].i] || []).push(...sel.map((x) => ({ pid: x.dataset.pid, code: x.value })));
    }
    return picks;
  }
  const RES = [['siap', 'Bersih, siap disewa lagi'], ['cuci', 'Perlu dicuci / dibersihkan'], ['perbaikan', 'Rusak — perlu diperbaiki'], ['hilang', 'Hilang / tidak kembali']];
  function unitReturnRows(b) {
    const L = b.items.flatMap((it) => (it.units || []).map((u) => ({ ...u, name: it.name })));
    if (!L.length) return '';
    return `<div class="mini-sec"><h4>Hasil pemeriksaan per unit</h4><p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Barang yang wajib dicuci sudah dipilih otomatis sesuai aturan Owner. Pilih <b>Rusak</b> bila ada yang sobek / patah agar masuk daftar perbaikan.</p><div class="ur-list">${L.map((u) => { const p = DB.product(u.pid); const wash = DB.needsWash(p); const def = wash ? 'cuci' : 'siap';
      return `<div class="ur-row" data-urow="${u.code}"><span class="ur-name"><b>${u.code}</b><small>${esc(u.name)}${wash ? ' · <i class="fa-solid fa-soap"></i> wajib dicuci' : ''}</small></span>
        <div class="ur-res">${RES.map(([k, l]) => `<label class="ur-opt ${k}"><input type="radio" name="ur-${u.code}" value="${k}" ${k === def ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <input class="input ur-issue" data-uissue="${u.code}" placeholder="Jelaskan kerusakannya, contoh: flysheet sobek 5 cm di sisi kiri" hidden></div>`; }).join('')}</div></div>`;
  }
  function readUnitResults(m) {
    const out = {}; let bad = null;
    m.$$('[data-urow]').forEach((row) => { const code = row.dataset.urow; const v = (row.querySelector('input[type=radio]:checked') || {}).value || 'siap'; const iss = row.querySelector('[data-uissue]').value.trim();
      if (v === 'perbaikan' && !iss) { row.querySelector('[data-uissue]').classList.add('err'); bad = bad || row; }
      out[code] = { res: v, issue: iss }; });
    if (bad) { toast('Jelaskan kerusakan unit yang dipilih "Rusak".', 'err'); bad.scrollIntoView({ behavior: 'smooth', block: 'center' }); return null; }
    return out;
  }
  function bindUnitResults(m, onChange) {
    m.$$('[data-urow]').forEach((row) => row.addEventListener('change', () => { const v = (row.querySelector('input[type=radio]:checked') || {}).value; const iss = row.querySelector('[data-uissue]'); iss.hidden = v !== 'perbaikan'; if (!iss.hidden) iss.focus(); onChange && onChange(); }));
  }
  /* Pop-up setelah pengembalian: pengingat cuci & perbaikan */
  function afterReturnPopup(b, res) {
    const L = Object.entries(res || {}); const cuci = L.filter(([, r]) => r.res === 'cuci').map(([c]) => c); const fix = L.filter(([, r]) => r.res === 'perbaikan'); const lost = L.filter(([, r]) => r.res === 'hilang').map(([c]) => c);
    if (!cuci.length && !fix.length && !lost.length) return;
    modal({ title: 'Jangan lupa ditindaklanjuti', body: `<div class="care-pop">
      ${cuci.length ? `<div class="cp-row cuci"><span class="cp-ic"><i class="fa-solid fa-soap"></i></span><div><b>${cuci.length} unit perlu dicuci / dibersihkan</b><small>${cuci.join(', ')}</small><p>Unit ini tidak bisa diserahkan ke customer sampai ditandai <b>sudah bersih</b>.</p></div></div>` : ''}
      ${fix.length ? `<div class="cp-row fix"><span class="cp-ic"><i class="fa-solid fa-screwdriver-wrench"></i></span><div><b>${fix.length} unit masuk daftar perbaikan</b><small>${fix.map(([c, r]) => `${c}: ${esc(r.issue)}`).join(' · ')}</small><p>Tidak dihitung dalam stok sampai ditandai <b>selesai diperbaiki</b>.</p></div></div>` : ''}
      ${lost.length ? `<div class="cp-row lost"><span class="cp-ic"><i class="fa-solid fa-circle-question"></i></span><div><b>${lost.length} unit hilang</b><small>${lost.join(', ')}</small><p>Unit dinonaktifkan dan tidak dihitung dalam stok. Pastikan biaya penggantian sudah dicatat.</p></div></div>` : ''}</div>`,
      foot: `<button class="btn btn-light" data-close>Nanti</button><a class="btn btn-primary" href="${A('perawatan')}"><i class="fa-solid fa-list-check"></i> Buka Perawatan Unit</a>` });
  }

  const custFlag = (c) => { const m = DB.customerMeta(c.email); return m.flag === 'normal' || !m.flag ? '' : `<div class="notice ${m.flag === 'blacklist' ? 'red' : ''}" style="margin-bottom:12px"><i class="fa-solid fa-user-shield"></i><div><strong>${m.flag === 'blacklist' ? 'Pelanggan diblokir' : 'Perlu jaminan tambahan'}.</strong> ${esc(m.note || '')}</div></div>`; };

  const BK = {
    verifyDP(b) {
      if (!b.payments.some((p) => p.type === 'DP')) b.payments.push({ at: D.nowStamp(), amount: b.dp, type: 'DP' });
      const from = b.status; b.paymentStatus = 'dp_paid'; b.status = 'dikonfirmasi';
      log(b, 'Pembayaran DP diverifikasi, booking dikonfirmasi', 'rental', `Mengonfirmasi booking ${b.id} (DP ${rupiah(b.dp)} diverifikasi)`, chg('Status booking', rl(from), rl('dikonfirmasi')));
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Booking dikonfirmasi', `DP ${rupiah(b.dp)} untuk ${b.id} diterima. Barang bisa diambil ${D.fmtDate(b.start, true)}.`, `pesanan?id=${b.id}`);
      toast(`${b.id} dikonfirmasi.`);
    },
    async rejectProof(b) {
      const r = await confirmBox({ title: `Tolak bukti bayar ${b.id}?`, text: 'Customer akan diminta mengunggah ulang bukti pembayaran.', ok: 'Tolak bukti', danger: true, input: { label: 'Alasan penolakan (mis. nominal tidak sesuai)' } });
      if (r === false) return false;
      b.status = 'menunggu_pembayaran'; b.paymentStatus = 'unpaid'; b.proof = null;
      log(b, `Bukti pembayaran ditolak${val(r) ? ': ' + val(r) : ''}`, 'rental', `Menolak bukti pembayaran ${b.id}${val(r) ? ` (${val(r)})` : ''}`, chg('Status booking', rl('menunggu_konfirmasi'), rl('menunggu_pembayaran')));
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Bukti pembayaran ditolak', `Bukti DP ${b.id} ditolak${val(r) ? ` (${val(r)})` : ''}. Silakan unggah ulang.`, `pembayaran?ids=${b.id}`);
      toast('Bukti pembayaran ditolak.'); return true;
    },
    pickup(b, done) {
      const due = sisa(b); const fc = DB.formCfg('pickup');
      const m = modal({ title: `Catat barang keluar · ${b.id}`, size: 'lg', body: `${custFlag(b.customer)}
        <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-box-open"></i><div>${esc(b.customer.name)} mengambil <strong>${esc(itemsText(b))}</strong> untuk ${D.fmtRange(b.start, b.end)}.</div></div>
        <div class="grid-2">
          <div class="field"><label>Kondisi barang saat keluar</label><select class="select" id="oCond"><option>Baik</option><option>Sangat Baik</option><option>Baik (ada bekas pemakaian)</option></select></div>
          ${fc.idCard === 'sembunyi' ? '' : `<div class="field"><label>Identitas jaminan${fc.idCard === 'wajib' ? ' <span class="req">*</span>' : ''}</label><select class="select" id="oId">${fc.idCard === 'wajib' ? '' : '<option value="">Tidak ada</option>'}<option>KTP</option><option>KTM</option><option>SIM</option><option>Kartu Pelajar</option></select></div>`}
        </div>
        ${fc.note === 'sembunyi' ? '' : `<div class="field"><label>Catatan${fc.note === 'wajib' ? ' <span class="req">*</span>' : ''}</label><textarea class="textarea" id="oNote" placeholder="Contoh: frame lengkap, pasak 12 pcs"></textarea></div>`}
        ${unitPicker(b)}
        ${extraFields('pickup')}${sopBox('pickup')}
        <div class="kv"><span>Total sewa</span><span>${rupiah(b.total)}</span></div>
        <div class="kv"><span>Sudah dibayar</span><span>${rupiah(Rules.paidTotal(b))}</span></div>
        <div class="kv total"><span>Sisa yang dibayar sekarang</span><span>${rupiah(due)}</span></div>
        ${b.deposit ? `<label class="chk-line dep-line"><input type="checkbox" id="oDep"> <span><b>Jaminan ${rupiah(b.deposit)} sudah diterima</b><small>Dikembalikan saat barang kembali, bisa dipotong denda.</small></span></label>` : ''}
        ${due ? `<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:14px"><input type="checkbox" id="oPaid" checked> Sisa pembayaran ${rupiah(due)} sudah diterima</label>` : ''}`,
        foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="oSave"><i class="fa-solid fa-check"></i> Simpan &amp; tandai disewa</button>` });
      bindExtras(m);
      m.$('#oSave').addEventListener('click', () => {
        if (due && !m.$('#oPaid').checked) { toast('Pelunasan wajib diterima sebelum barang keluar.', 'err'); return; }
        if (b.deposit && !m.$('#oDep').checked) { toast(`Terima jaminan ${rupiah(b.deposit)} dulu sebelum barang keluar.`, 'err'); return; }
        const note = m.$('#oNote') ? m.$('#oNote').value.trim() : '';
        if (fc.note === 'wajib' && !note) { m.$('#oNote').classList.add('err'); toast('Catatan wajib diisi.', 'err'); return; }
        const picks = readUnitPicks(m, b); if (!picks) return;
        const ex = readExtras(m, 'pickup'); if (!ex) return;
        DB.assignUnits(b, picks);
        b.out = { at: D.nowStamp(), cond: m.$('#oCond').value, idCard: m.$('#oId') ? m.$('#oId').value : '', by: me.name, note, photo: ex.photo, extra: ex.extra };
        if (due) b.payments.push({ at: D.nowStamp(), amount: due, type: 'Pelunasan' });
        if (b.deposit) b.depositIn = { at: D.nowStamp(), amount: b.deposit, by: me.name };
        b.paymentStatus = 'lunas'; b.status = 'disewa';
        log(b, 'Barang keluar / diambil customer', 'barang_keluar', `Mencatat barang keluar ${b.id}: ${itemsText(b)}`, [{ field: 'Status booking', from: rl('dikonfirmasi'), to: rl('disewa') }, { field: 'Kondisi keluar', from: '', to: b.out.cond }, ...(due ? [{ field: 'Pelunasan diterima', from: '', to: rupiah(due) }] : [])]);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Selamat bertualang!', `Barang ${b.id} sudah diambil. Harap kembalikan paling lambat ${D.fmtDate(b.end, true)}.`, `pesanan?id=${b.id}`);
        m.close(); toast('Barang keluar tercatat. Status: Sedang disewa.'); done && done();
      });
    },
    processReturn(b, done) {
      const fc = DB.formCfg('return'); const stR = DB.settings(); const hasUnits = b.items.some((it) => (it.units || []).length); const nowT = new Date().toTimeString().slice(0, 5);
      const m = modal({ title: `Proses pengembalian · ${b.id}`, size: 'lg', body: `
        <div class="notice" style="margin-bottom:14px"><i class="fa-solid fa-rotate-left"></i><div>Jadwal kembali <strong>${D.fmtDate(b.end, true)}</strong>${stR.lateAfterReturnTime ? `, paling lambat pukul <strong>${esc(stR.returnTime)}</strong>` : ''}. Barang: ${esc(itemsText(b))}. Denda: ${esc(DB.lateFeeText())}.</div></div>
        <div class="grid-3">
          <div class="field"><label>Tanggal kembali</label><input class="input" type="date" id="rDate" value="${D.today()}" min="${b.start}"></div>
          <div class="field"><label>Jam kembali</label><input class="input" type="time" id="rTime" value="${nowT}"></div>
          <div class="field" ${hasUnits ? 'hidden' : ''}><label>Kondisi setelah kembali</label><select class="select" id="rCond"><option>Baik</option><option>Kotor (perlu dicuci)</option><option>Rusak ringan</option><option>Rusak berat</option><option>Hilang sebagian</option></select></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Keterlambatan</label><input class="input" id="rLate" disabled></div>
          <div class="field"><label>Biaya kerusakan / kehilangan (Rp)</label><input class="input" type="number" min="0" step="1000" id="rDmg" value="0"></div>
        </div>
        ${fc.note === 'sembunyi' ? '' : `<div class="field"><label>Catatan pemeriksaan${fc.note === 'wajib' ? ' <span class="req">*</span>' : ''}</label><textarea class="textarea" id="rNote" placeholder="Contoh: flysheet sobek 5 cm di sisi kiri"></textarea></div>`}
        ${extraFields('return')}${(stR.damageRules || []).length ? `<details class="rule-box"><summary><i class="fa-solid fa-gavel"></i> Aturan kerusakan & kehilangan</summary><ul>${stR.damageRules.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
        ${unitReturnRows(b)}
        ${sopBox('return')}
        <div id="rSum"></div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:14px" id="rPaidWrap"><input type="checkbox" id="rPaid" checked> Denda sudah dibayar customer</label>
        ${b.depositIn ? `<div class="dep-box" id="rDepBox"></div>` : ''}`,
        foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rSave"><i class="fa-solid fa-check"></i> Selesaikan rental</button>` });
      const calc = () => {
        const date = m.$('#rDate').value || D.today();
        const late = Rules.lateDays(b, date, m.$('#rTime').value); const lf = Rules.lateFee(b, late);
        const dmg = Math.max(0, +m.$('#rDmg').value || 0);
        if (/Rusak|Hilang/.test(m.$('#rCond').value) && !dmg) m.$('#rDmg').classList.add('err'); else m.$('#rDmg').classList.remove('err');
        m.$('#rLate').value = late ? `${late} hari (denda ${rupiah(lf)})` : 'Tepat waktu';
        m.$('#rSum').innerHTML = `<div class="kv"><span>Denda keterlambatan</span><span>${rupiah(lf)}</span></div><div class="kv"><span>Biaya kerusakan</span><span>${rupiah(dmg)}</span></div><div class="kv total"><span>Total denda</span><span>${rupiah(lf + dmg)}</span></div>`;
        const dep = b.depositIn ? b.depositIn.amount : 0;
        if (dep) {
          const cut = m.$('#rCut') ? m.$('#rCut').checked : true; const fine0 = lf + dmg; const ded = cut ? Math.min(dep, fine0) : 0;
          m.$('#rDepBox').innerHTML = `<div class="kv"><span>Jaminan dipegang toko</span><span>${rupiah(dep)}</span></div>${fine0 ? `<label class="chk-line" style="margin:6px 0"><input type="checkbox" id="rCut" ${cut ? 'checked' : ''}> Potong denda dari jaminan</label>` : ''}${ded ? `<div class="kv"><span>Dipotong untuk denda</span><span>− ${rupiah(ded)}</span></div>` : ''}<div class="kv total"><span>Jaminan dikembalikan</span><span>${rupiah(dep - ded)}</span></div>`;
          const c = m.$('#rCut'); if (c) c.onchange = calc;
          if (ded >= fine0) m.$('#rPaidWrap').style.display = 'none';
          return { date, late, lf, dmg, fine: lf + dmg, ded, depBack: dep - ded, rest: fine0 - ded, _sd: m.$('#rPaidWrap').style.display = fine0 - ded ? 'flex' : 'none' };
        }
        m.$('#rPaidWrap').style.display = lf + dmg ? 'flex' : 'none';
        return { date, late, lf, dmg, fine: lf + dmg };
      };
      ['#rDate', '#rTime', '#rCond', '#rDmg'].forEach((s) => { m.$(s).addEventListener('input', calc); m.$(s).addEventListener('change', calc); });
      calc(); bindExtras(m); bindUnitResults(m);
      m.$('#rSave').addEventListener('click', () => {
        const r = calc();
        const note = m.$('#rNote') ? m.$('#rNote').value.trim() : '';
        if (fc.note === 'wajib' && !note) { m.$('#rNote').classList.add('err'); toast('Catatan pemeriksaan wajib diisi.', 'err'); return; }
        const ex = readExtras(m, 'return'); if (!ex) return;
        const t = m.$('#rTime').value || '12:00';
        const uc = hasUnits ? readUnitResults(m) : {}; if (!uc) return;
        if (hasUnits) { const v = Object.values(uc).map((x) => x.res); m.$('#rCond').value = v.includes('hilang') ? 'Hilang sebagian' : v.includes('perbaikan') ? 'Rusak ringan' : v.includes('cuci') ? 'Kotor (perlu dicuci)' : 'Baik'; }
        DB.releaseUnits(b, uc);
        b.ret = { at: new Date(`${r.date}T${t}:00`).toISOString(), cond: m.$('#rCond').value, lateDays: r.late, lateFee: r.lf, damageFee: r.dmg, fine: r.fine, by: me.name, note, photo: ex.photo, extra: ex.extra };
        b.fine = (b.fine || 0) + r.fine; Rules.recalc(b);
        if (r.ded) b.payments.push({ at: D.nowStamp(), amount: r.ded, type: 'Denda', note: 'dipotong dari jaminan' });
        const restFine = r.fine - (r.ded || 0);
        if (restFine && m.$('#rPaid').checked) b.payments.push({ at: D.nowStamp(), amount: restFine, type: 'Denda' });
        if (b.depositIn) b.depositOut = { at: D.nowStamp(), amount: r.depBack, deducted: r.ded || 0, by: me.name };
        b.paymentStatus = sisa(b) ? 'dp_paid' : 'lunas';
        b.status = 'selesai';
        log(b, `Barang kembali (${b.ret.cond})${r.late ? `, terlambat ${r.late} hari` : ''}${r.fine ? `, denda ${rupiah(r.fine)}` : ''}`, 'pengembalian', `Mencatat barang kembali ${b.id} (kondisi ${b.ret.cond}${r.late ? `, terlambat ${r.late} hari` : ''})`,
          [{ field: 'Status booking', from: rl('disewa'), to: rl('selesai') }, { field: 'Kondisi kembali', from: b.out ? b.out.cond : '', to: b.ret.cond }, ...(r.fine ? [{ field: 'Denda', from: '', to: rupiah(r.fine) }] : [])]);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Rental selesai — beri ulasan yuk!', `Terima kasih! ${b.id} sudah dikembalikan${r.fine ? ` dengan denda ${rupiah(r.fine)}` : ''}. Bagikan pengalamanmu dengan memberi bintang & ulasan.`, `pesanan?tab=riwayat&review=${b.id}`);
        m.close(); toast('Pengembalian tercatat.'); done && done();
        if (hasUnits) setTimeout(() => afterReturnPopup(b, uc), 250);
      });
    },
    adminCancel(b, done) {
      const hasDp = Rules.paidTotal(b) > 0;
      const refundable = Rules.canRefund(b);
      const m = modal({ title: `Batalkan booking ${b.id}`, body: `
        <div class="field"><label>Alasan pembatalan</label><textarea class="textarea" id="cReason" placeholder="Contoh: permintaan customer via WhatsApp"></textarea></div>
        ${hasDp ? `<div class="notice ${refundable ? 'green' : 'red'}" style="margin-bottom:12px"><i class="fa-solid fa-circle-info"></i><div>Tanggal ambil ${D.fmtDate(b.start, true)} (${D.diffDays(D.today(), b.start)} hari lagi). Sesuai kebijakan H-${DB.settings().cancelDays}, DP <strong>${refundable ? 'dapat dikembalikan' : 'hangus'}</strong>.</div></div>
        <div class="field"><label>Perlakuan DP (${rupiah(Rules.paidTotal(b))})</label><select class="select" id="cDp"><option value="refund" ${refundable ? 'selected' : ''}>Kembalikan DP (refund)</option><option value="forfeit" ${refundable ? '' : 'selected'}>DP hangus</option></select></div>` : ''}`,
        foot: `<button class="btn btn-light" data-close>Kembali</button><button class="btn btn-danger" id="cOk">Batalkan booking</button>` });
      m.$('#cOk').addEventListener('click', () => {
        const reason = m.$('#cReason').value.trim(); if (!reason) { m.$('#cReason').classList.add('err'); m.$('#cReason').focus(); return; }
        const mode = hasDp ? m.$('#cDp').value : 'none';
        const from = b.status; b.status = 'dibatalkan';
        b.cancel = { at: D.nowStamp(), reason, by: 'admin', refundable: mode === 'refund', refundStatus: mode === 'refund' ? 'menunggu' : mode === 'forfeit' ? 'hangus' : 'tidak_perlu' };
        if (hasDp) b.paymentStatus = mode === 'refund' ? 'refund_pending' : 'forfeited';
        log(b, `Booking dibatalkan admin: ${reason}`, 'pembatalan', `Membatalkan booking ${b.id}: ${reason}`, [{ field: 'Status booking', from: rl(from), to: rl('dibatalkan') }, ...(hasDp ? [{ field: 'Perlakuan DP', from: '', to: mode === 'refund' ? 'Dikembalikan (refund)' : 'Hangus' }] : [])]);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Booking dibatalkan', `${b.id} dibatalkan (${reason}).${mode === 'refund' ? ' DP akan dikembalikan maks. 2×24 jam.' : mode === 'forfeit' ? ' DP tidak dapat dikembalikan sesuai kebijakan.' : ''}`, `pesanan?tab=riwayat`);
        m.close(); toast('Booking dibatalkan.'); done && done();
      });
    },
    async refund(b) {
      const amt = Rules.refundAmount(b); const pct = DB.settings().refundPercent ?? 100;
      const r = await confirmBox({ title: `Kembalikan DP ${b.id}?`, text: `Transfer ${rupiah(amt)}${pct < 100 ? ` (${pct}% dari DP sesuai aturan refund)` : ''} ke rekening ${b.customer.name}, lalu konfirmasi di sini.${sopBox('cancel') ? '<br><br>' + DB.sops('pembatalan').filter((x) => x.active !== false).map((x) => `<b>SOP:</b> ${esc(x.body)}`).join('<br>') : ''}`, ok: 'Sudah ditransfer', input: { label: 'No. referensi transfer (opsional)' } });
      if (r === false) return false;
      b.refunds = b.refunds || []; b.refunds.push({ at: D.nowStamp(), amount: amt, ref: val(r) });
      b.paymentStatus = 'refunded'; if (b.cancel) b.cancel.refundStatus = 'selesai';
      log(b, `DP ${rupiah(amt)} dikembalikan`, 'refund', `Memproses refund DP ${b.id} sebesar ${rupiah(amt)}${val(r) ? ` (ref. ${val(r)})` : ''}`, chg('Status pembayaran', STATUS.payment.refund_pending.label, STATUS.payment.refunded.label));
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'DP sudah dikembalikan', `Refund ${rupiah(amt)} untuk ${b.id} sudah ditransfer.`, `pesanan?tab=riwayat`);
      toast('Refund tercatat.'); return true;
    },
    approveChange(b, ch) {
      const res = DB.applyBookingChange(b, ch);
      if (!res.ok) { toast(res.msg, 'err'); return false; }
      const oldTotal = res.oldTotal;
      ch.status = 'disetujui'; ch.decidedAt = D.nowStamp();
      log(b, `Ganti barang disetujui: ${ch.fromName} → ${ch.toName}`, 'pergantian', `Menyetujui pergantian barang ${b.id}: ${ch.fromName} → ${ch.toName}`, [{ field: 'Barang', from: `${ch.qty}× ${ch.fromName}`, to: `${ch.qty}× ${ch.toName}` }, { field: 'Total booking', from: rupiah(oldTotal), to: rupiah(b.total) }]);
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Ganti barang disetujui', `${ch.fromName} diganti ${ch.toName} (${b.id}). ${ch.diff > 0 ? `Tambahan ${rupiah(ch.diff)} dibayar saat pengambilan.` : ch.diff < 0 ? `Sisa bayar berkurang ${rupiah(-ch.diff)}.` : ''}`, `pesanan?id=${b.id}`);
      toast('Permintaan ganti barang disetujui.'); return true;
    },
    /* Perpanjangan sewa. req = permintaan customer (opsional) */
    extend(b, done, req) {
      const st = DB.settings(); const maxEnd = D.addDays(b.start, st.maxRentDays || 60);
      const m = modal({ title: `${req ? 'Tinjau perpanjangan' : 'Perpanjang sewa'} · ${b.id}`, body: `
        <div class="notice" style="margin-bottom:14px"><i class="fa-solid fa-calendar"></i><div>Sewa sekarang <strong>${D.fmtRange(b.start, b.end)}</strong> (${b.days} hari). Barang: ${esc(itemsText(b))}.</div></div>
        <div class="field"><label>Tanggal kembali baru</label><input class="input" type="date" id="exEnd" min="${D.addDays(b.end, 1)}" max="${maxEnd}" value="${req ? req.to : D.addDays(b.end, 1)}" ${req ? 'disabled' : ''}></div>
        <div id="exInfo"></div>
        ${req ? `<p style="font-size:13.5px"><span class="muted">Alasan customer:</span> ${esc(req.reason || '-')}</p>` : ''}
        <label class="chk-line" id="exPaidW"><input type="checkbox" id="exPaid"> Biaya perpanjangan sudah dibayar sekarang</label>`,
        foot: `${req ? '<button class="btn btn-danger" id="exNo">Tolak</button>' : '<button class="btn btn-light" data-close>Batal</button>'}<button class="btn btn-primary" id="exOk"><i class="fa-solid fa-check"></i> ${req ? 'Setujui perpanjangan' : 'Simpan perpanjangan'}</button>` });
      const calc = () => { const r = Rules.extendCheck(b, m.$('#exEnd').value);
        m.$('#exInfo').innerHTML = r.extraDays > 0 ? `<div class="kv"><span>Tambahan</span><span>${r.extraDays} hari</span></div><div class="kv total"><span>Biaya perpanjangan</span><span>${rupiah(r.cost)}</span></div>${r.ok ? '<div class="notice green" style="margin-top:8px"><i class="fa-solid fa-circle-check"></i><div>Semua barang tersedia di tanggal tambahan.</div></div>' : `<div class="notice red" style="margin-top:8px"><i class="fa-solid fa-circle-xmark"></i><div>${esc(r.msg)}</div></div>`}` : `<p class="muted">${esc(r.msg)}</p>`;
        m.$('#exOk').disabled = !r.ok; m.$('#exPaidW').style.display = r.ok && b.status === 'disewa' ? 'flex' : 'none'; return r; };
      m.$('#exEnd').addEventListener('change', calc); calc();
      m.$('#exOk').addEventListener('click', () => {
        const r = calc(); if (!r.ok) return; const to = m.$('#exEnd').value; const oldEnd = b.end; const oldTotal = b.total;
        b.end = to; Rules.recalc(b);
        if (m.$('#exPaid').checked && m.$('#exPaidW').style.display !== 'none') b.payments.push({ at: D.nowStamp(), amount: r.cost, type: 'Perpanjangan' });
        if (b.status === 'disewa') b.paymentStatus = sisa(b) > 0 ? 'dp_paid' : 'lunas';
        b.extensions = b.extensions || [];
        if (req) Object.assign(b.extensions.find((x) => x.id === req.id), { status: 'disetujui', decidedAt: D.nowStamp(), by: me.name });
        else b.extensions.push({ id: 'EXT-' + Date.now(), at: D.nowStamp(), from: oldEnd, to, days: r.extraDays, cost: r.cost, status: 'disetujui', source: 'toko', by: me.name });
        log(b, `Sewa diperpanjang sampai ${D.fmtDate(to, true)} (+${r.extraDays} hari)`, 'perpanjangan', `${req ? 'Menyetujui' : 'Mencatat'} perpanjangan ${b.id} sampai ${D.fmtDate(to, true)}`, [{ field: 'Tanggal kembali', from: D.fmtDate(oldEnd, true), to: D.fmtDate(to, true) }, { field: 'Total sewa', from: rupiah(oldTotal), to: rupiah(b.total) }]);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Sewa diperpanjang', `${b.id} diperpanjang sampai ${D.fmtDate(to, true)}. Tambahan biaya ${rupiah(r.cost)}${m.$('#exPaid').checked ? ' (sudah dibayar)' : ', dibayar saat pengembalian'}.`, `pesanan?id=${b.id}`);
        m.close(); toast('Perpanjangan disimpan.'); done && done();
      });
      const no = m.$('#exNo'); if (no) no.addEventListener('click', async () => {
        const r = await confirmBox({ title: 'Tolak perpanjangan?', text: 'Customer akan diberi tahu.', ok: 'Tolak', danger: true, input: { label: 'Alasan (opsional)' } }); if (r === false) return;
        Object.assign(b.extensions.find((x) => x.id === req.id), { status: 'ditolak', decidedAt: D.nowStamp(), by: me.name, note: val(r) });
        log(b, 'Perpanjangan ditolak', 'perpanjangan', `Menolak perpanjangan ${b.id}${val(r) ? `: ${val(r)}` : ''}`); DB.saveBooking(b);
        DB.notify(b.customer.email, 'Perpanjangan ditolak', `Permintaan perpanjangan ${b.id} ditolak${val(r) ? `: ${val(r)}` : ''}. Barang tetap dikembalikan ${D.fmtDate(b.end, true)}.`, `pesanan?id=${b.id}`);
        m.close(); toast('Perpanjangan ditolak.'); done && done();
      });
    },
    /* Ganti barang langsung di toko (dicatat staff, langsung berlaku). */
    storeChange(b, done) {
      UI.changeModal(b, { mode: 'staff', onSubmit: (r) => {
        const ch = { id: 'CHG-' + Date.now(), at: D.nowStamp(), lineIndex: r.lineIndex, fromId: r.line.refId, fromName: r.line.name, toId: r.p.id, toName: r.toName, toSize: r.size || null, qty: r.qty, diff: r.diff, reason: r.reason, source: 'toko', by: me.name };
        const res = DB.applyBookingChange(b, ch);
        if (!res.ok) { toast(res.msg, 'err'); return false; }
        Object.assign(ch, { status: 'disetujui', decidedAt: D.nowStamp(), oldCond: r.oldCond || '' });
        b.changes = b.changes || []; b.changes.push(ch);
        const changes = [{ field: 'Barang', from: `${r.qty}× ${ch.fromName}`, to: `${r.qty}× ${ch.toName}` }, { field: 'Total booking', from: rupiah(res.oldTotal), to: rupiah(b.total) }];
        if (r.oldCond) changes.push({ field: 'Kondisi barang lama', from: '', to: r.oldCond });
        if (r.paidNow && r.diff > 0) { b.payments.push({ at: D.nowStamp(), amount: r.diff, type: 'Selisih ganti barang' }); changes.push({ field: 'Selisih dibayar', from: '', to: rupiah(r.diff) }); }
        const over = Rules.paidTotal(b) - (b.refunds || []).reduce((a, x) => a + x.amount, 0) - b.total;
        if (r.refundNow && over > 0) { b.refunds = b.refunds || []; b.refunds.push({ at: D.nowStamp(), amount: over, ref: 'Kelebihan bayar ganti barang' }); changes.push({ field: 'Kelebihan dikembalikan', from: '', to: rupiah(over) }); }
        if (b.status === 'disewa') b.paymentStatus = sisa(b) > 0 ? 'dp_paid' : 'lunas';
        log(b, `Ganti barang di toko: ${r.qty}× ${ch.fromName} → ${ch.toName}`, 'pergantian', `Mencatat ganti barang di toko ${b.id}: ${r.qty}× ${ch.fromName} → ${ch.toName}`, changes);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Barang sewa diganti', `${r.qty}× ${ch.fromName} diganti ${ch.toName} (${b.id}). Total sewa sekarang ${rupiah(b.total)}.`, `pesanan?id=${b.id}`);
        toast('Penggantian barang disimpan.'); done && done();
      } });
    },
    async rejectChange(b, ch) {
      const r = await confirmBox({ title: 'Tolak permintaan ganti barang?', text: `${ch.fromName} → ${ch.toName}`, ok: 'Tolak', danger: true, input: { label: 'Alasan (opsional)' } });
      if (r === false) return false;
      ch.status = 'ditolak'; ch.decidedAt = D.nowStamp(); ch.note = val(r);
      log(b, `Ganti barang ditolak: ${ch.fromName} → ${ch.toName}`, 'pergantian', `Menolak pergantian barang ${b.id}: ${ch.fromName} → ${ch.toName}${ch.note ? ` (${ch.note})` : ''}`);
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Ganti barang ditolak', `Permintaan ganti ${ch.fromName} → ${ch.toName} (${b.id}) ditolak${ch.note ? `: ${ch.note}` : ''}.`, `pesanan?id=${b.id}`);
      toast('Permintaan ditolak.'); return true;
    },
  };

  function bookingActions(b) {
    const a = [];
    if (b.status === 'menunggu_konfirmasi') { a.push(['verify', 'fa-circle-check', 'Verifikasi DP', 'btn-primary']); a.push(['reject', 'fa-xmark', 'Tolak bukti', 'btn-danger']); }
    if (b.status === 'menunggu_pembayaran') a.push(['verify', 'fa-money-bill', 'Tandai DP dibayar', 'btn-primary']);
    if (b.status === 'dikonfirmasi') a.push(['pickup', 'fa-box-open', 'Catat barang keluar', 'btn-primary']);
    if (b.status === 'disewa') a.push(['return', 'fa-rotate-left', 'Proses pengembalian', 'btn-primary']);
    if (b.paymentStatus === 'refund_pending') a.push(['refund', 'fa-hand-holding-dollar', 'Proses refund', 'btn-gold']);
    if (['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'].includes(b.status) && b.items.some((i) => i.kind === 'product')) a.push(['swap', 'fa-arrows-rotate', 'Ganti barang', 'btn-light']);
    if (['dikonfirmasi', 'disewa'].includes(b.status)) a.push(['extend', 'fa-calendar-plus', 'Perpanjang', 'btn-light']);
    if (b.status === 'disewa' && b.end <= D.today()) a.push(['remind', 'fa-brands fa-whatsapp', 'Ingatkan via WA', 'btn-light']);
    if (['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(b.status)) a.push(['cancel', 'fa-ban', 'Batalkan', 'btn-danger']);
    return a;
  }
  async function runBooking(act, id, done) {
    const b = DB.booking(id); if (!b) return;
    const fin = () => { refreshShell(); done && done(); };
    if (act === 'verify') { if (await confirmBox({ title: `Konfirmasi ${b.id}?`, text: `DP ${rupiah(b.dp)} dari ${b.customer.name} sudah masuk ke rekening toko.`, ok: 'Ya, konfirmasi' })) { BK.verifyDP(b); fin(); } }
    if (act === 'reject') { if (await BK.rejectProof(b)) fin(); }
    if (act === 'pickup') BK.pickup(b, fin);
    if (act === 'return') BK.processReturn(b, fin);
    if (act === 'cancel') BK.adminCancel(b, fin);
    if (act === 'refund') { if (await BK.refund(b)) fin(); }
    if (act === 'detail') bookingModal(id, done);
    if (act === 'wa') window.open(custLink(b.customer), '_blank');
    if (act === 'swap') BK.storeChange(b, fin);
    if (act === 'extend') BK.extend(b, fin);
    if (act === 'remind') { remindWa(b); fin(); }
  }

  const REQ_ST = { menunggu: ['amber', 'Menunggu'], disetujui: ['green', 'Disetujui'], ditolak: ['red', 'Ditolak'] };
  /* Rincian permintaan ganti barang & perpanjangan di detail booking */
  function reqSection(b) {
    const C = (b.changes || []).slice().reverse(), X = (b.extensions || []).slice().reverse();
    if (!C.length && !X.length) return '';
    const img = (id) => { const p = DB.product(id); return p ? `<img src="${asset(p.img)}" alt="">` : '<span class="ph-x"><i class="fa-solid fa-box"></i></span>'; };
    return `<div class="mini-sec" id="reqSec"><h4>Permintaan ganti barang & perpanjangan</h4>
      ${C.map((c) => { const [tone, lbl] = REQ_ST[c.status] || ['gray', c.status]; const pd = DB.product(c.toId);
        return `<div class="req-card ${c.status === 'menunggu' ? 'pending' : ''}"><div class="rq-top"><span class="pill ${tone} plain">${lbl}</span><small>${c.source === 'toko' ? `<i class="fa-solid fa-store"></i> Di toko oleh ${esc(c.by || '-')}` : '<i class="fa-solid fa-mobile-screen"></i> Diajukan customer'} · ${D.fmtDateTime(c.at)}</small></div>
          <div class="rq-swap"><div class="rq-item">${img(c.fromId)}<span><small>Barang lama</small><b>${c.qty}× ${esc(c.fromName)}</b></span></div><i class="fa-solid fa-arrow-right-long"></i>
            <div class="rq-item to">${img(c.toId)}<span><small>Diganti menjadi</small><b>${c.qty}× ${esc(c.toName)}</b>${pd ? `<em>${rupiah(pd.rent)}/hari${c.toSize ? ` · ukuran ${esc(String(c.toSize).replace(/\s*\(.*\)/, ''))}` : ''}</em>` : ''}</span></div></div>
          <div class="rq-meta"><span>Selisih: <b style="color:${c.diff > 0 ? '#9a6508' : c.diff < 0 ? 'var(--g700)' : 'inherit'}">${c.diff > 0 ? '+' : c.diff < 0 ? '−' : ''}${rupiah(Math.abs(c.diff || 0))}</b></span>${c.reason ? `<span>Alasan: ${esc(c.reason)}</span>` : ''}${c.note ? `<span>Catatan admin: ${esc(c.note)}</span>` : ''}${c.status === 'menunggu' ? `<span>Stok pengganti: <b>${Rules.available(c.toId, b.start, b.end, b.id, c.toSize || null)} unit</b></span>` : ''}</div>
          ${c.status === 'menunggu' ? `<div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn btn-primary btn-xs" data-rqok="${c.id}"><i class="fa-solid fa-check"></i> Setujui</button><button class="btn btn-danger btn-xs" data-rqno="${c.id}"><i class="fa-solid fa-xmark"></i> Tolak</button></div>` : ''}</div>`; }).join('')}
      ${X.map((x) => { const [tone, lbl] = REQ_ST[x.status] || ['gray', x.status];
        return `<div class="req-card ${x.status === 'menunggu' ? 'pending' : ''}"><div class="rq-top"><span class="pill ${tone} plain">${lbl}</span><small><i class="fa-solid fa-calendar-plus"></i> Perpanjangan ${x.source === 'toko' ? `di toko oleh ${esc(x.by || '-')}` : 'diajukan customer'} · ${D.fmtDateTime(x.at)}</small></div>
          <div class="rq-meta"><span>Tanggal kembali: <b>${D.fmtDate(x.from, true)} → ${D.fmtDate(x.to, true)}</b> (+${x.days} hari)</span><span>Biaya: <b>${rupiah(x.cost)}</b></span>${x.reason ? `<span>Alasan: ${esc(x.reason)}</span>` : ''}</div>
          ${x.status === 'menunggu' ? `<div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn btn-primary btn-xs" data-rqext="${x.id}"><i class="fa-solid fa-magnifying-glass"></i> Tinjau perpanjangan</button></div>` : ''}</div>`; }).join('')}</div>`;
  }
  function bookingModal(id, done, opts) {
    const b = DB.booking(id); if (!b) { toast('Booking tidak ditemukan.', 'err'); return; }
    const paid = Rules.paidTotal(b);
    const acts = bookingActions(b);
    const pend = (b.changes || []).filter((c) => c.status === 'menunggu');
    const pendExt = (b.extensions || []).filter((x) => x.status === 'menunggu');
    const m = modal({ title: `Booking ${b.id}`, size: 'lg', body: `${custFlag(b.customer)}
      ${pendExt.length ? `<div class="notice" style="margin-bottom:12px"><i class="fa-solid fa-calendar-plus"></i><div>Customer mengajukan perpanjangan sampai <strong>${D.fmtDate(pendExt[0].to, true)}</strong> (+${pendExt[0].days} hari, ${rupiah(pendExt[0].cost)}). <a href="${A('permintaan?tab=extend')}" style="font-weight:700;text-decoration:underline">Tinjau</a></div></div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pill('rental', b.status)} ${pill('payment', b.paymentStatus)}</div>
      <div class="kv-grid">
        <div class="kv"><span>Customer</span><strong>${esc(b.customer.name)}</strong></div>
        <div class="kv"><span>Telepon</span><a href="${custLink(b.customer)}" target="_blank" style="color:var(--g700);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ${esc(b.customer.phone)}</a></div>
        <div class="kv"><span>Periode</span><span>${D.fmtRange(b.start, b.end)} (${b.days} hari)</span></div>
        <div class="kv"><span>Pengambilan</span><span>Ambil di toko</span></div>
        <div class="kv"><span>Metode bayar</span><span>${esc(b.method || '-')}</span></div>
        <div class="kv"><span>Dibuat</span><span>${D.fmtDateTime(b.createdAt)}</span></div>
      </div>
      
      ${b.notes ? `<p style="font-size:13.5px"><span class="muted">Catatan:</span> ${esc(b.notes)}</p>` : ''}
      <div class="mini-sec"><h4>Barang</h4><div class="adm-items">${b.items.map((i) => `<div class="it"><img src="${asset(i.img)}" alt=""><div class="nm"><strong>${esc(i.name)}</strong><br><small class="muted">${i.qty} × ${rupiah(i.pricePerDay)}/hari</small>${(i.units || []).length ? `<div class="unit-tags">${i.units.map((u) => `<span><i class="fa-solid fa-barcode"></i> ${u.code}</span>`).join('')}</div>` : ''}</div><strong>${rupiah(i.qty * i.pricePerDay * b.days)}</strong></div>`).join('')}</div></div>
      <div class="mini-sec" style="max-width:360px;margin-left:auto">
        <div class="kv"><span>Subtotal</span><span>${rupiah(b.subtotal)}</span></div>
        ${b.discount ? `<div class="kv"><span>Promo ${esc(b.discount.code)}</span><span style="color:var(--g700)">− ${rupiah(b.discount.amount)}</span></div>` : ''}
        ${b.fine ? `<div class="kv"><span>Denda</span><span>${rupiah(b.fine)}</span></div>` : ''}
        <div class="kv total"><span>Total</span><span>${rupiah(b.total)}</span></div>
        <div class="kv"><span>DP ${DB.settings().dpPercent}%</span><span>${rupiah(b.dp)}</span></div>
        <div class="kv hl"><span>Dibayar</span><span>${rupiah(paid)}</span></div>
        ${(b.refunds || []).length ? `<div class="kv"><span>Refund</span><span>− ${rupiah(b.refunds.reduce((s, r) => s + r.amount, 0))}</span></div>` : ''}
        ${b.status !== 'dibatalkan' ? `<div class="kv"><span>Sisa</span><strong>${rupiah(sisa(b))}</strong></div>` : ''}
        ${b.deposit ? `<div class="kv"><span>Jaminan</span><span>${rupiah(b.deposit)} · ${b.depositOut ? `dikembalikan ${rupiah(b.depositOut.amount)}${b.depositOut.deducted ? ` (dipotong ${rupiah(b.depositOut.deducted)})` : ''}` : b.depositIn ? '<b style="color:#9a6508">dipegang toko</b>' : 'dibayar saat ambil'}</span></div>` : ''}
      </div>
      ${b.proof ? `<div class="mini-sec"><h4>Bukti pembayaran</h4><img class="proof-img" src="${asset(b.proof)}" alt="Bukti pembayaran"></div>` : b.status === 'menunggu_konfirmasi' ? '<div class="mini-sec"><h4>Bukti pembayaran</h4><p class="muted" style="font-size:13px">Bukti diunggah customer (contoh data demo tanpa gambar).</p></div>' : ''}
      ${pend.length ? `<div class="notice" style="margin-top:14px"><i class="fa-solid fa-arrows-rotate"></i><div>Ada ${pend.length} permintaan ganti barang menunggu. <a href="permintaan" style="font-weight:700;text-decoration:underline">Tinjau</a></div></div>` : ''}
      ${b.cancel ? `<div class="notice red" style="margin-top:14px"><i class="fa-solid fa-ban"></i><div>Dibatalkan ${D.fmtDateTime(b.cancel.at)} — ${esc(b.cancel.reason)}. Refund: ${({ menunggu: 'menunggu diproses', selesai: 'sudah dikembalikan', hangus: 'DP hangus', tidak_perlu: 'tidak ada' })[b.cancel.refundStatus] || '-'}</div></div>` : ''}
      ${b.out ? `<div class="mini-sec"><h4>Barang keluar</h4><p style="font-size:13.5px">${D.fmtDateTime(b.out.at)} · Kondisi ${esc(b.out.cond)}${b.out.idCard ? ` · Jaminan ${esc(b.out.idCard)}` : ''} · oleh ${esc(b.out.by)}${b.out.note ? `<br><span class="muted">${esc(b.out.note)}</span>` : ''}${extrasHtml(b.out)}</p></div>` : ''}
      ${b.ret ? `<div class="mini-sec"><h4>Barang kembali</h4><p style="font-size:13.5px">${D.fmtDateTime(b.ret.at)} · Kondisi ${esc(b.ret.cond)} · Terlambat ${b.ret.lateDays} hari · Denda ${rupiah(b.ret.fine)}${b.ret.note ? `<br><span class="muted">${esc(b.ret.note)}</span>` : ''}${extrasHtml(b.ret)}</p></div>` : ''}
      ${reqSection(b)}
      <details class="mini-sec hist-fold"><summary><h4>Riwayat booking (${(b.history || []).length})</h4></summary><ul class="timeline">${(b.history || []).slice().reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul></details>`,
      foot: `<a class="btn btn-light" href="${url('invoice?id=' + b.id)}"><i class="fa-solid fa-receipt"></i> Nota</a>${acts.map(([k, ic, l, c]) => `<button class="btn ${c}" data-bact="${k}"><i class="${/fa-brands/.test(ic) ? ic : 'fa-solid ' + ic}"></i> ${l}</button>`).join('')}` });
    m.$$('[data-bact]').forEach((btn) => btn.addEventListener('click', () => { m.close(); runBooking(btn.dataset.bact, id, done); }));
    const fin2 = () => { refreshShell(); done && done(); };
    m.$$('[data-rqok]').forEach((x) => x.addEventListener('click', () => { const ch = b.changes.find((c) => c.id === x.dataset.rqok); if (BK.approveChange(b, ch)) { m.close(); fin2(); } }));
    m.$$('[data-rqno]').forEach((x) => x.addEventListener('click', async () => { const ch = b.changes.find((c) => c.id === x.dataset.rqno); m.close(); if (await BK.rejectChange(b, ch)) fin2(); }));
    m.$$('[data-rqext]').forEach((x) => x.addEventListener('click', () => { const r = b.extensions.find((y) => y.id === x.dataset.rqext); m.close(); BK.extend(b, fin2, r); }));
    if ((opts && opts.focusReq || UI.param('req')) && m.$('#reqSec')) setTimeout(() => m.$('#reqSec').scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  }

  const SALE_FLOW = { diproses: ['dikemas', 'fa-box', 'Tandai dikemas'], dikemas: ['siap_diambil', 'fa-store', 'Tandai siap diambil'], siap_diambil: ['selesai', 'fa-circle-check', 'Sudah diambil customer'] };
  function saleActions(s) {
    const a = [];
    if (s.paymentStatus === 'verifying') a.push(['spay', 'fa-circle-check', 'Verifikasi pembayaran', 'btn-primary']);
    if (s.status === 'menunggu_pembayaran' && s.paymentStatus === 'unpaid') a.push(['spay', 'fa-money-bill', 'Tandai sudah dibayar', 'btn-primary']);
    if (s.paymentStatus === 'paid' && SALE_FLOW[s.status]) a.push(['snext', SALE_FLOW[s.status][1], SALE_FLOW[s.status][2], 'btn-primary']);
    if (['menunggu_pembayaran', 'diproses'].includes(s.status)) a.push(['scancel', 'fa-ban', 'Batalkan', 'btn-danger']);
    return a;
  }
  async function runSale(act, id, done) {
    const s = DB.sale(id); if (!s) return;
    const fin = () => { refreshShell(); done && done(); };
    if (act === 'sdetail') return saleModal(id, done);
    if (act === 'spay') {
      if (!(await confirmBox({ title: `Verifikasi pembayaran ${s.id}?`, text: `${rupiah(s.total)} dari ${s.customer.name} sudah diterima.`, ok: 'Verifikasi' }))) return;
      const short = s.items.filter((i) => DB.saleableStock(DB.product(i.productId), i.size) < i.qty);
      if (short.length) { toast(`Stok tidak cukup: ${short.map((i) => i.name).join(', ')}. Tambah stok dulu di Data Barang.`, 'err'); return; }
      DB.sellStock(s.items, 1);
      s.payments.push({ at: D.nowStamp(), amount: s.total, type: 'Pembayaran' }); s.paymentStatus = 'paid'; s.status = 'diproses';
      log(s, 'Pembayaran diverifikasi, pesanan diproses', 'penjualan', `Memverifikasi pembayaran ${s.id} (${rupiah(s.total)})`, chg('Status pesanan', sl('menunggu_pembayaran'), sl('diproses'))); DB.saveSale(s);
      DB.notify(s.customer.email, 'Pembayaran diterima', `Pesanan ${s.id} sedang diproses.`, 'pesanan?tab=beli');
      toast('Pembayaran diverifikasi.'); fin();
    }
    if (act === 'snext') {
      const [next] = SALE_FLOW[s.status];
      const from = s.status; s.status = next;
      const txt = { dikemas: 'Pesanan dikemas', siap_diambil: 'Pesanan siap diambil di toko', selesai: 'Barang sudah diambil, pesanan selesai' }[next];
      log(s, txt, 'penjualan', `Mengubah status pesanan ${s.id} menjadi ${sl(next)}`, chg('Status pesanan', sl(from), sl(next))); DB.saveSale(s);
      DB.notify(s.customer.email, txt, `${s.id}: ${txt.toLowerCase()}.${next === 'selesai' ? ' Beri ulasan untuk barang yang kamu beli, yuk!' : ''}`, next === 'selesai' ? `pesanan?tab=riwayat&review=${s.id}` : 'pesanan?tab=beli');
      toast(`${s.id}: ${STATUS.sale[next].label}.`); fin();
    }
    if (act === 'scancel') {
      const r = await confirmBox({ title: `Batalkan ${s.id}?`, text: s.paymentStatus === 'paid' ? 'Pembayaran customer perlu dikembalikan secara manual.' : 'Pesanan akan dibatalkan.', ok: 'Batalkan pesanan', danger: true, input: { label: 'Alasan pembatalan' } });
      if (r === false) return;
      const from = s.status; if (s.paymentStatus === 'paid') DB.sellStock(s.items, -1); s.status = 'dibatalkan'; log(s, `Pesanan dibatalkan admin${val(r) ? ': ' + val(r) : ''}`, 'pembatalan', `Membatalkan pesanan ${s.id}${val(r) ? `: ${val(r)}` : ''}`, chg('Status pesanan', sl(from), sl('dibatalkan'))); DB.saveSale(s);
      DB.notify(s.customer.email, 'Pesanan dibatalkan', `${s.id} dibatalkan oleh admin.`, 'pesanan?tab=beli');
      toast('Pesanan dibatalkan.'); fin();
    }
  }
  function saleModal(id, done) {
    const s = DB.sale(id); if (!s) { toast('Pesanan tidak ditemukan.', 'err'); return; }
    const acts = saleActions(s);
    const m = modal({ title: `Pesanan ${s.id}`, size: 'lg', body: `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pill('sale', s.status)} ${pill('payment', s.paymentStatus)}</div>
      <div class="kv-grid">
        <div class="kv"><span>Customer</span><strong>${esc(s.customer.name)}</strong></div>
        <div class="kv"><span>Telepon</span><a href="${custLink(s.customer)}" target="_blank" style="color:var(--g700);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ${esc(s.customer.phone)}</a></div>
        <div class="kv"><span>Pengambilan</span><span>Ambil di toko</span></div>
        <div class="kv"><span>Metode bayar</span><span>${esc(s.method || '-')}</span></div>
        <div class="kv"><span>Dibuat</span><span>${D.fmtDateTime(s.createdAt)}</span></div>
      </div>
      <div class="mini-sec"><h4>Barang</h4><div class="adm-items">${s.items.map((i) => `<div class="it"><img src="${asset(i.img)}" alt=""><div class="nm"><strong>${esc(i.name)}</strong><br><small class="muted">${i.qty} × ${rupiah(i.price)}</small></div><strong>${rupiah(i.qty * i.price)}</strong></div>`).join('')}</div></div>
      <div class="mini-sec" style="max-width:360px;margin-left:auto">
        <div class="kv"><span>Subtotal</span><span>${rupiah(s.subtotal)}</span></div>
        <div class="kv total"><span>Total</span><span>${rupiah(s.total)}</span></div>
      </div>
      ${s.proof ? `<div class="mini-sec"><h4>Bukti pembayaran</h4><img class="proof-img" src="${asset(s.proof)}" alt="Bukti"></div>` : ''}
      <div class="mini-sec"><h4>Riwayat</h4><ul class="timeline">${(s.history || []).slice().reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul></div>`,
      foot: `${s.paymentStatus === 'paid' ? `<a class="btn btn-light" href="${url('invoice?id=' + s.id)}"><i class="fa-solid fa-receipt"></i> Nota</a>` : ''}${acts.map(([k, ic, l, c]) => `<button class="btn ${c}" data-sact="${k}"><i class="fa-solid ${ic}"></i> ${l}</button>`).join('') || '<button class="btn btn-light" data-close>Tutup</button>'}` });
    m.$$('[data-sact]').forEach((btn) => btn.addEventListener('click', () => { m.close(); runSale(btn.dataset.sact, id, done); }));
  }

  function ledger(from, to) {
    const inRange = (iso) => { const d = D.day(iso); return (!from || d >= from) && (!to || d <= to); };
    const income = [], expense = [];
    DB.bookings().forEach((b) => {
      (b.payments || []).forEach((p) => { if (inRange(p.at)) income.push({ date: p.at, ref: b.id, cat: p.type === 'Denda' ? 'Denda' : 'Rental', desc: `${p.type} · ${b.customer.name}`, amount: p.amount }); });
      (b.refunds || []).forEach((r) => { if (inRange(r.at)) expense.push({ date: r.at, ref: b.id, cat: 'Refund DP', desc: `Refund DP · ${b.customer.name}`, amount: r.amount, auto: true }); });
    });
    DB.sales().forEach((s) => (s.payments || []).forEach((p) => { if (inRange(p.at)) income.push({ date: p.at, ref: s.id, cat: 'Penjualan', desc: `Penjualan · ${s.customer.name}`, amount: p.amount }); }));
    const voided = [];
    DB.expenses().forEach((e) => { if (!inRange(e.date)) return; const row = { date: e.date, ref: e.id, cat: e.category, desc: e.desc, amount: e.amount, id: e.id, kind: 'out', voidReason: e.voidReason, voidBy: e.voidBy }; (e.status === 'dibatalkan' ? voided : expense).push(row); });
    DB.incomes().forEach((e) => { if (!inRange(e.date)) return; const row = { date: e.date, ref: e.id, cat: e.category, desc: e.desc, amount: e.amount, id: e.id, kind: 'in', manual: true, voidReason: e.voidReason, voidBy: e.voidBy }; (e.status === 'dibatalkan' ? voided : income).push(row); });
    const sort = (a, b) => String(b.date).localeCompare(String(a.date));
    income.sort(sort); expense.sort(sort);
    const sum = (l) => l.reduce((s, x) => s + x.amount, 0);
    voided.sort(sort);
    return { income, expense, voided, totalIn: sum(income), totalOut: sum(expense) };
  }

  function relTime(iso) {
    if (!iso) return '-';
    const ms = Date.now() - new Date(iso).getTime(); const m = Math.round(ms / 60000);
    if (m < 1) return 'baru saja'; if (m < 60) return `${m} mnt lalu`;
    const h = Math.round(m / 60); if (h < 24) return `${h} jam lalu`;
    const d = Math.round(h / 24); if (d === 1) return 'kemarin'; if (d < 7) return `${d} hari lalu`;
    return D.fmtDate(iso);
  }
  function presence(u) {
    if (u.status === 'nonaktif') return { key: 'off', label: 'Nonaktif', tone: 'gray' };
    const s = DB.session();
    if (s && s.id === u.id) return { key: 'on', label: 'Sedang aktif (kamu)', tone: 'green' };
    const inSession = u.lastLogin && (!u.lastLogout || u.lastLogin > u.lastLogout);
    const last = u.lastSeen && u.lastSeen > (u.lastLogin || '') ? u.lastSeen : u.lastLogin;
    if (inSession && last && Date.now() - new Date(last).getTime() < 10 * 3600e3) return { key: 'on', label: 'Sedang login', tone: 'green' };
    return { key: 'idle', label: 'Offline', tone: 'gray' };
  }

  window.Admin = { me, isOwner, A, O, scanQR, openRef, init, relTime, presence, remindWa, reminderText, remindedToday, refreshShell, pendingRequests, BK, bookingActions, runBooking, bookingModal, saleActions, runSale, saleModal, ledger, sisa, itemsText, custLink };
})();
