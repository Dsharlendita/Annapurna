(function () {
  const { DB, Rules, STATUS, D, rupiah, Svc, Laundry } = window.Ann;
  const { $, $$, esc, asset, url, toast, modal, confirmBox, pill } = window.UI;

  const me = DB.session();
  const rec = me && ((me.email && DB.user(me.email)) || DB.user(me.id) || me);
  const basePath = new URL(UI.BASE || '/', location.href).pathname;
  const here = location.pathname.slice(basePath.length) + location.search;
  if (!me || !DB.isStaff(me) || !rec || !DB.isStaff(rec) || (rec.status && rec.status === 'nonaktif')) {
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
    { id: 'kasir', href: A('kasir'), icon: 'fa-cash-register', label: 'Kasir (offline)' },
    { id: 'booking', href: A('booking'), icon: 'fa-calendar-check', label: 'Booking Rental', cnt: bookingBadge },
    { id: 'pengembalian', href: A('pengembalian'), icon: 'fa-right-left', label: 'Barang Keluar & Kembali', cnt: () => { const q = DB.careQueue(); return DB.bookings().filter((b) => b.status === 'disewa' && b.end <= D.today()).length + q.cuci.length + q.perbaikan.length; } },
    { id: 'barang', href: A('barang'), icon: 'fa-boxes-stacked', label: 'Data Barang' },
    { id: 'penjualan', href: A('penjualan'), icon: 'fa-bag-shopping', label: 'Penjualan', cnt: () => DB.sales().filter((s) => ['diproses', 'dikemas'].includes(s.status) || s.paymentStatus === 'verifying').length },
    { id: 'ulasan', href: A('ulasan'), icon: 'fa-star', label: 'Ulasan & Testimoni', cnt: () => DB.reviews().filter((r) => !r.seen).length },
    { id: 'laundry', href: A('laundry'), icon: 'fa-jug-detergent', label: 'Laundry', cnt: () => DB.laundry().filter((o) => ['diterima', 'dicuci', 'siap'].includes(o.status)).length },
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
    OPS[6],
    { grp: 'Pelanggan & Keuangan' },
    OPS[4],
    { id: 'keuangan', href: A('keuangan'), icon: 'fa-cash-register', label: 'Kas Harian' },
  ];
  /* Halaman yang digabung jadi tab: id halaman → id menu induk */
  const PARENT = { kalender: 'booking', permintaan: 'booking', perawatan: 'pengembalian', 'owner-integrasi': 'laporan', pengaturan: isOwner ? 'owner-konfigurasi' : '', sop: '', ...(isOwner ? { dashboard: 'owner-dashboard' } : {}) };
  const SUBTABS = {
    pengembalian: [['pengembalian', 'Barang keluar & kembali', A('pengembalian'), 'fa-right-left'], ['perawatan', 'Perawatan unit', A('perawatan'), 'fa-soap', () => { const q = DB.careQueue(); return q.cuci.length + q.perbaikan.length; }]],
    booking: [['booking', 'Daftar booking', A('booking'), 'fa-list'], ['kalender', 'Kalender', A('kalender'), 'fa-calendar-days', () => svcSchedule(D.today(), D.addDays(D.today(), 1)).length], ['permintaan', 'Permintaan', A('permintaan'), 'fa-arrows-rotate', () => pendingRequests().length]],
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
  /* ---------- Pengingat ke customer: nota + rincian denda ---------- */
  const fmtTime = () => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); };
  const lateOf = (b) => (b.status === 'disewa' ? Rules.lateDays(b, D.today(), fmtTime()) : 0);
  /* Rincian denda per barang (mengikuti aturan denda Owner: % tarif per malam atau nominal per barang) */
  const fineLines = (b, late) => UI.fineLines(b, late);
  /* Booking lain dari checkout yang sama (pesanan gabungan) yang masih berjalan */
  const groupMates = (b) => (b.group ? DB.bookings().filter((x) => x.group === b.group && x.id !== b.id && !['selesai', 'dibatalkan'].includes(x.status)) : []);
  const paidOf = (b) => (b.payments || []).reduce((a, p) => a + (+p.amount || 0), 0) - (b.refunds || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const approvedChanges = (b) => (b.changes || []).filter((c) => c.status === 'disetujui');
  /* Data pengisi template pesan sewa (nota booking / pengingat / tagih denda) */
  function rentVars(b, withFine) {
    const st = DB.settings(); const bl = UI.billOf(b); const late = bl.late, sisa = bl.sisa, fl = bl.fines, fine = bl.fine;
    const R = [...b.items.map((it) => `• ${it.qty}× ${it.name} — ${rupiah(Rules.lineUnit(it, b.days) * it.qty)}`)];
    approvedChanges(b).forEach((c) => R.push(`• Ganti barang: ${c.fromName} → ${c.toName} (${c.diff >= 0 ? '+' : '−'}${rupiah(Math.abs(c.diff))})`));
    R.push(`Total sewa: ${rupiah(b.total)} · Sudah dibayar: ${rupiah(bl.paid)}${sisa ? ` · Sisa: ${rupiah(sisa)}` : ' · LUNAS'}`);
    if (withFine && late) {
      R.push('', `*Denda keterlambatan (${late} malam)*`, ...fl.map((x) => `• ${x.qty}× ${x.name}: ${rupiah(x.per)} × ${x.qty} × ${late} malam = ${rupiah(x.total)}`));
      R.push(`Total denda: ${rupiah(fine)}`, '', `*Total dibayar saat pengembalian: ${rupiah(sisa + fine)}*`, '_Denda bertambah setiap malam keterlambatan._');
    } else if (withFine && sisa) R.push('', `*Sisa yang dibayar saat pengembalian: ${rupiah(sisa)}*`);
    const mates = groupMates(b);
    if (withFine && mates.length) R.push('', `Barang lain di pesanan yang sama masih bisa dipakai: ${mates.map((x) => `${NO(x)} (${itemsText(x)}) kembali ${D.fmtDate(x.end, true)}`).join('; ')}.`);
    const nm = b.customer.name || 'Kak';
    return { nama: nm, nama_depan: nm.split(' ')[0], no_nota: NO(b), tanggal: D.fmtDate(b.createdAt, true), rincian: R.join('\n'), total: rupiah(b.total), dibayar: rupiah(bl.paid), sisa: rupiah(sisa),
      tgl_sewa: D.fmtRange(b.start, b.end), tgl_ambil: D.fmtDate(b.start, true), tgl_kembali: D.fmtDate(b.end, true), jam_kembali: String(st.returnTime || '22:00').replace(':', '.'), lama: `${b.days} malam`,
      status: `${(STATUS.rental[b.status] || { label: b.status }).label} · ${(STATUS.payment[b.paymentStatus] || { label: b.paymentStatus }).label}`,
      terlambat: late, denda: rupiah(fine), total_bayar: rupiah(sisa + fine), link_nota: Ann.Share.link(b), metode: b.method || '' };
  }
  function reminderText(b) { const late = UI.billOf(b).late; return DB.waText(late ? 'rent_fine' : 'rent_reminder', rentVars(b, true)); }
  /* Kirim pengingat / tagihan: pratinjau NOTA TAGIHAN → Salin gambar (tempel Ctrl+V di WhatsApp) / Buka WhatsApp / Unduh.
     Link wa.me hanya bisa membawa teks, jadi gambar tidak diunduh otomatis lagi — staff memilih sendiri cara melampirkannya. */
  async function remindCustomer(b) {
    if (!b) return;
    b = DB.booking(b.id) || b; await Ann.Share.ensure(b);
    const text = reminderText(b); const bill = UI.billOf(b);
    const cv = await UI.tagihanCanvas(b);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const name = `nota-tagihan-${NO(b).replace(/\//g, '_')}.png`;
    let logged = false;
    const log = (how) => {
      if (logged) return; logged = true;
      const fresh = DB.booking(b.id);
      fresh.reminders = fresh.reminders || []; fresh.reminders.push({ at: D.nowStamp(), by: me.name, late: bill.late, fine: bill.fine });
      fresh.history = fresh.history || []; fresh.history.push({ at: D.nowStamp(), text: bill.late ? `Nota tagihan (terlambat ${bill.late} malam, denda ${rupiah(bill.fine)}) dikirim via WhatsApp${how ? ' · ' + how : ''} (${me.name})` : `Pengingat pengembalian + nota dikirim via WhatsApp${how ? ' · ' + how : ''} (${me.name})` });
      DB.saveBooking(fresh);
      DB.audit({ type: 'rental', action: `Mengirim ${bill.late ? `tagihan keterlambatan (denda ${rupiah(bill.fine)})` : 'pengingat pengembalian'} ${NO(b)} ke ${b.customer.name} via WhatsApp`, ref: b.id });
    };
    UI.waCompose({ title: `${bill.late ? 'Tagih denda' : 'Ingatkan pengembalian'} · ${NO(b)}`, blob, name, text, phone: b.customer.phone, waLabel: `Buka WhatsApp ${esc((b.customer.name || 'customer').split(' ')[0])}`,
      tplKey: bill.late ? 'rent_fine' : 'rent_reminder', onSent: (how) => log(how) });
  }
  /* Tagih sisa pembayaran (piutang / pelunasan via transfer) */
  async function contactDue(b) {
    b = DB.booking(b.id) || b; await Ann.Share.ensure(b);
    const cv = await UI.tagihanCanvas(b, { booking: true, title: 'NOTA TAGIHAN' }); const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const V = rentVars(b, false); V.sisa = rupiah(sisa(b));
    UI.waCompose({ title: `Tagih sisa pembayaran · ${NO(b)}`, blob, name: `tagihan-${NO(b).replace(/\//g, '_')}.png`, text: DB.waText('rent_due', V), phone: b.customer.phone, waLabel: `Tagih ${esc((b.customer.name || 'customer').split(' ')[0])}`, tplKey: 'rent_due',
      onSent: () => { const x = DB.booking(b.id); x.history.push({ at: D.nowStamp(), text: `Sisa pembayaran ${rupiah(sisa(x))} ditagih via WhatsApp (${me.name})` }); x.dueRemindedAt = D.nowStamp(); DB.saveBooking(x); } });
  }
  /* Hubungi customer dari detail booking: gambar nota booking + pesan template (bisa diedit) */
  async function contactBooking(b) {
    b = DB.booking(b.id) || b; await Ann.Share.ensure(b);
    const bill = UI.billOf(b); const pre = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(b.status);
    const cv = await UI.tagihanCanvas(b, { booking: true, title: bill.late ? 'NOTA TAGIHAN' : pre ? 'NOTA BOOKING' : 'NOTA SEWA' });
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const key = bill.late ? 'rent_fine' : 'rent_booking';
    UI.waCompose({ title: `Hubungi customer · ${NO(b)}`, blob, name: `nota-${NO(b).replace(/\//g, '_')}.png`, text: DB.waText(key, rentVars(b, key === 'rent_fine')), phone: b.customer.phone,
      waLabel: `Hubungi ${esc((b.customer.name || 'customer').split(' ')[0])}`, tplKey: key,
      onSent: (how) => { const x = DB.booking(b.id); if (!x) return; x.history = x.history || []; x.history.push({ at: D.nowStamp(), text: `Customer dihubungi via WhatsApp + nota${how ? ' · ' + how : ''} (${me.name})` }); DB.saveBooking(x); } });
  }

  const remindWa = remindCustomer;
  const remindedToday = (b) => (b.reminders || []).some((r) => D.day(r.at) === D.today());
  /* Notifikasi otomatis: rental yang harus kembali hari ini → ingatkan staff menghubungi penyewa. */
  function dueTodayNotices() {
    const T = D.today(); const sent = DB.get('dueNotices');
    DB.bookings().filter((b) => b.status === 'disewa' && b.end === T).forEach((b) => {
      const key = `${b.id}|${T}`; if (sent.includes(key)) return;
      DB.notifyStaff('Pengembalian hari ini', `${NO(b)} · ${b.customer.name} harus mengembalikan ${itemsText(b)} hari ini. Ingatkan penyewa via WhatsApp.`, 'admin/pengembalian?remind=' + b.id);
      sent.push(key);
    });
    DB.set('dueNotices', sent);
    /* Antar / jemput hari ini & besok (layanan antar / jasa tenda) → notifikasi staff, sekali per jadwal */
    svcSchedule(T, D.addDays(T, 1)).forEach((e) => {
      const key = `svc|${e.b.id}|${e.type}|${e.date}`; if (sent.includes(key)) return;
      DB.notifyStaff(`${e.date === T ? 'Hari ini' : 'Besok'}: ${e.kind.toLowerCase()} ${e.time ? 'pukul ' + Svc.fmtT(e.time) : ''}`.trim(), `${NO(e.b)} · ${e.b.customer.name} · ${(e.b.deliv || {}).address || '-'}`, 'admin/kalender');
      sent.push(key);
    });
    DB.set('dueNotices', sent);
  }
  /* Jadwal antar & jemput staff pada rentang tanggal (booking yang sudah dibayar / terlihat admin) */
  function svcSchedule(from, to) {
    const ev = [];
    DB.staffBookings().filter((b) => Svc.has(b) && !['dibatalkan', 'selesai'].includes(b.status)).forEach((b) => {
      const d = b.deliv || {};
      const ad = d.date || b.start; if (Svc.delivers(b) && b.status !== 'disewa' && ad >= from && ad <= to) ev.push({ type: 'antar', date: ad, time: d.time, b, kind: Svc.outLabel(b), ic: 'fa-truck-fast' });
      if (Svc.returnMode(b) === 'jemput') { const bd = d.backDate || b.end; if (bd >= from && bd <= to) ev.push({ type: 'jemput', date: bd, time: d.backTime, b, kind: Svc.backLabel(b), ic: 'fa-rotate-left' }); }
    });
    return ev.sort((a, c) => (a.date + (a.time || '')).localeCompare(c.date + (c.time || '')));
  }

  /* ---------- Scan QR nota ---------- */
  /* Kenali kode dari QR / ketikan: nomor nota (RNTL/028/X/2026, ODR/005/X/2026, rnt/28/x/2026), kode internal (RNT-1028 / ORD-2007), atau link nota (…invoice?id=RNT-1028) */
  function findRef(txt) {
    const raw = String(txt || '').trim(); const up = raw.toUpperCase();
    const no = NOPARSE(up);
    if (no) {
      const b = no.startsWith('RNT') && DB.bookings().find((y) => y.no === no); if (b) return { x: b, kind: 'rent' };
      const s = no.startsWith('ODR') && DB.sales().find((y) => y.no === no); if (s) return { x: s, kind: 'sale' };
      return { miss: no };
    }
    const code = (up.match(/(RNT|ORD)-\d{3,6}/) || [])[0];
    if (code) { const x = code.startsWith('RNT') ? DB.booking(code) : DB.sale(code); return x ? { x, kind: code.startsWith('RNT') ? 'rent' : 'sale' } : { miss: code }; }
    return null;
  }
  function openRef(txt) {
    const r = findRef(txt);
    if (!r) { toast('Kode tidak dikenali. Ketik nomor nota (contoh: RNTL/028/X/2026 atau ODR/005/X/2026) atau scan QR di nota customer.', 'err'); return false; }
    if (r.miss) { toast(`Pesanan ${r.miss} tidak ditemukan.`, 'err'); return false; }
    DB.audit({ type: 'akses', action: `Membuka ${NO(r.x)} lewat scan QR / nomor nota`, ref: r.x.id });
    location.href = A(r.kind === 'rent' ? 'booking?id=' + r.x.id : 'penjualan?id=' + r.x.id); return true;
  }
  async function scanQR() {
    let stream = null, raf = 0, stop = false;
    const m = UI.modal({ title: 'Scan QR nota customer', body: `<div class="scan-box"><video id="qrV" playsinline muted></video><div class="scan-frame"></div><p id="qrMsg" class="muted">Menyalakan kamera…</p></div>
      <div class="field" style="margin-top:14px"><label>Atau ketik nomor booking / pesanan</label><div style="display:flex;gap:8px"><input class="input" id="qrCode" placeholder="Contoh: RNTL/028/X/2026" autocomplete="off"><button class="btn btn-primary" id="qrGo">Buka</button></div></div>`,
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
    DB.staffBookings().filter((b) => hit(b.id, NO(b), b.customer.name, b.customer.email) || phHit(b.customer.phone)).slice(0, 6).forEach((b) => R.push({ g: 'Booking', ic: 'fa-calendar-check', t: `${NO(b)} · ${b.customer.name}`, s: `${D.fmtRange(b.start, b.end)} · ${STATUS.rental[b.status].label}`, href: A('booking?id=' + b.id) }));
    DB.staffSales().filter((x) => hit(x.id, NO(x), x.customer.name, x.customer.email) || phHit(x.customer.phone)).slice(0, 4).forEach((x) => R.push({ g: 'Penjualan', ic: 'fa-bag-shopping', t: `${NO(x)} · ${x.customer.name}`, s: `${rupiah(x.total)} · ${STATUS.sale[x.status].label}`, href: A('penjualan?id=' + x.id) }));
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
        <a href="${url('./')}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat Website</a>
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
          <a href="${url('./')}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat website</a>
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
      UI.serverLogout(url('masuk'));
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
    m.$('#fpwOut').addEventListener('click', () => UI.serverLogout(url('masuk')));
    m.$('#fpwOk').addEventListener('click', async () => {
      const F = m.$('#fpw'), E = F.elements;
      if (!UI.validate(F, { old: (v) => (!v ? 'Wajib diisi.' : ''), npw: (v) => (v.length < 6 ? 'Minimal 6 karakter.' : v === E.old.value ? 'Harus berbeda dari kata sandi sementara.' : ''), npw2: (v) => (v !== E.npw.value ? 'Kata sandi tidak sama.' : '') })) return;
      const r = await Api.busy(m.$('#fpwOk'), () => Api.changePassword(E.old.value, E.npw.value), 'Menyimpan…'); if (!r) return;
      if (!r.ok) { if (r.field === 'old') UI.validate(F, { old: () => r.msg || 'Kata sandi sementara salah.' }); else UI.toast(r.msg, 'err'); return; }
      me.mustChangePw = false; m.close(); toast('Kata sandi baru disimpan. Selamat bekerja!');
    });
  }

  function init(active, title) {
    Admin.active = active;
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
    /* Rekap bulanan berjalan saat panel dibuka siapa pun (admin/owner) pada/di atas tanggal kirim */
    if (window.Reports) Reports.autoMonthly();
    if (isOwner) setTimeout(() => cleanupNotice(active), 900);
    idleWatch();
  }

  /* ---------- Logout otomatis bila staff tidak aktif ----------
     Aktivitas (klik, ketik, gulir) disimpan sebagai "terakhir aktif". Bila lewat batas (default 60 menit, diatur owner),
     sesi diakhiri & tercatat "Logout otomatis" dengan jam = aktivitas terakhir — jadi histori login selalu punya jam keluar. */
  function idleWatch() {
    const min = +(DB.settings().idleLogoutMin ?? 0); if (!min) return;
    const K = 'ann_lastActive_' + me.id;
    const expired = () => { const last = +localStorage.getItem(K) || 0; return last && Date.now() - last > min * 60e3 ? last : 0; };
    const kick = (last) => { DB.logout({ auto: true, idleMin: min, at: new Date(last).toISOString() }); localStorage.removeItem(K); location.href = UI.url('masuk?idle=1'); };
    const last0 = expired(); if (last0) { kick(last0); return; }
    let t = 0; const mark = () => { const n = Date.now(); if (n - t > 15e3) { t = n; localStorage.setItem(K, String(n)); } };
    mark(); ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach((ev) => window.addEventListener(ev, mark, { passive: true }));
    setInterval(() => { const l = expired(); if (l) kick(l); }, 60e3);
  }

  /* ---------- Persetujuan pembersihan data (khusus owner) ----------
     Rekap tetap otomatis; data lama baru dihapus setelah owner menyetujui. */
  const CL_LBL = { bookings: 'pesanan sewa', sales: 'pembelian', logs: 'log aktivitas', notifications: 'notifikasi', emails: 'email', finance: 'catatan kas' };
  function cleanupSum(P) { const c = {}; P.forEach((x) => Object.entries(x.p.counts).forEach(([k, v]) => { c[k] = (c[k] || 0) + v; })); return c; }
  function cleanupNotice(active) {
    if (!window.Reports || DB.cleanupMode() !== 'approve') return;
    const P = DB.cleanupPending(); if (!P.length) return;
    const req = DB.cleanupReq(); const T = D.today();
    const waiting = (req.snoozeUntil && req.snoozeUntil > T) || (req.skipUntil && req.skipUntil > T);
    /* Banner di dashboard owner & halaman Google Drive selama masih menunggu */
    if (['owner-dashboard', 'owner-integrasi', 'dashboard'].includes(active) && !document.getElementById('clBanner')) {
      const warn = P.length >= 2;
      const host = document.querySelector('.content'); if (host) host.insertAdjacentHTML('afterbegin', `<div class="cl-banner ${warn ? 'warn' : ''}" id="clBanner"><i class="fa-solid ${warn ? 'fa-triangle-exclamation' : 'fa-broom'}"></i><div><b>${warn ? `Data ${P.length} bulan belum dibersihkan` : 'Pembersihan data menunggu persetujuanmu'}</b><small>${P.map((x) => Reports.monthName(x.a.period)).join(', ')} sudah aman di Google Drive · ${P.reduce((a, x) => a + x.p.total, 0)} data lama siap dibersihkan${warn ? '. Website bisa makin lambat bila data terus menumpuk.' : ''}${waiting ? ` · ditunda sampai ${D.fmtDate(req.skipUntil > T ? req.skipUntil : req.snoozeUntil, true)}` : ''}</small></div><button class="btn btn-primary btn-sm" type="button" id="clReview">Tinjau</button></div>`);
      const b = document.getElementById('clReview'); if (b) b.addEventListener('click', () => cleanupModal(P));
    }
    if (waiting || sessionStorage.getItem('clPromptShown')) return;
    sessionStorage.setItem('clPromptShown', '1');
    cleanupModal(P);
  }
  function cleanupModal(P) {
    const c = cleanupSum(P); const total = P.reduce((a, x) => a + x.p.total, 0);
    const months = P.map((x) => Reports.monthName(x.a.period)).join(' & ');
    const m = modal({ title: `Rekap ${months} sudah aman di Google Drive`, size: 'lg', body: `
      <div class="clm-ok">${P.map((x) => `<div class="clm-arc"><i class="fa-solid fa-folder-closed"></i><div><b>${esc(Reports.folderName(x.a.period))}</b><small><i class="fa-solid fa-check"></i> ${x.a.files.length} file laporan tersimpan · <i class="fa-solid fa-check"></i> email terkirim ke ${esc(x.a.mailTo || 'owner')}</small></div><a class="btn btn-light btn-xs" href="${O('integrasi?folder=' + x.a.period)}">Lihat folder</a></div>`).join('')}</div>
      <h4 class="clm-h">Data lama yang bisa dibersihkan agar website tetap ringan</h4>
      <ul class="clm-list">${Object.entries(c).filter(([k, v]) => v && CL_LBL[k]).map(([k, v]) => `<li><b>${v}</b> ${CL_LBL[k]}${k === 'bookings' || k === 'sales' ? ' (selesai/dibatalkan)' : ''}</li>`).join('')}</ul>
      <p class="clm-safe"><i class="fa-solid fa-shield-halved"></i> Tetap aman: barang & unit, pesanan aktif/belum lunas, ulasan, ringkasan angka bulanan, dan riwayat pelanggan. Laporan bulan tsb. tetap bisa diunduh dari arsip.</p>
      <div class="clm-later"><span>Belum sekarang?</span>
        <select class="select" id="clSnooze"><option value="1">Ingatkan besok</option><option value="3">Ingatkan 3 hari lagi</option><option value="7">Ingatkan 7 hari lagi</option></select>
        <button class="btn btn-light btn-sm" id="clLater"><i class="fa-regular fa-clock"></i> Ingatkan nanti</button>
        <button class="btn btn-ghost btn-sm" id="clSkip">Jangan hapus bulan ini</button></div>`,
      foot: `<a class="btn btn-light" href="${O('integrasi#bersih')}">Lihat detail dulu</a><button class="btn btn-danger" id="clGo"><i class="fa-solid fa-broom"></i> Bersihkan sekarang (${total} data)</button>` });
    const T = D.today(); const req = DB.cleanupReq();
    m.$('#clLater').addEventListener('click', () => { const n = +m.$('#clSnooze').value; req.snoozeUntil = D.addDays(T, n); DB.setCleanupReq(req); DB.audit({ type: 'laporan', action: `Menunda pembersihan data ${months} (${n} hari)` }); m.close(); toast(`Baik, kami ingatkan lagi ${n === 1 ? 'besok' : n + ' hari lagi'}. Data tidak dihapus.`); const bn = document.getElementById('clBanner'); if (bn) bn.remove(); cleanupNotice(Admin.active); });
    m.$('#clSkip').addEventListener('click', () => { const d = new Date(T + 'T00:00:00'); d.setMonth(d.getMonth() + 1, 1); req.skipUntil = d.toISOString().slice(0, 10); DB.setCleanupReq(req); DB.audit({ type: 'laporan', action: `Memilih tidak membersihkan data ${months} bulan ini` }); m.close(); toast('Data bulan ini tetap disimpan. Bulan depan akan ditawarkan lagi bersama data bulan berikutnya.'); const bn = document.getElementById('clBanner'); if (bn) bn.remove(); cleanupNotice(Admin.active); });
    m.$('#clGo').addEventListener('click', async () => {
      if (!(await confirmBox({ title: 'Hapus data lama sekarang?', text: `${total} data dari ${months} akan dihapus permanen dari website. Semua sudah tersimpan di rekap Google Drive. Tindakan ini tidak bisa dibatalkan.`, ok: 'Ya, bersihkan', danger: true }))) return;
      let n = 0; P.forEach((x) => { Reports.snapshot(x.a.period); const r = DB.cleanupArchived(x.a.period); if (r.ok) n += r.total; });
      DB.setCleanupReq({ snoozeUntil: '', skipUntil: '' });
      m.close(); toast(`${n} data lama dibersihkan. Website kembali ringan.`); const bn = document.getElementById('clBanner'); if (bn) bn.remove();
      if (typeof window.onCleanupDone === 'function') window.onCleanupDone();
    });
  }

  const val = (r) => (typeof r === 'string' && r !== '-' ? r : '');
  const log = (x, text, type, action, changes) => {
    x.history = x.history || []; x.history.push({ at: D.nowStamp(), text: `${text} (${me.name})` });
    DB.audit({ type: type || 'edit', action: action || `${text} — ${x.id}`, ref: x.id, changes });
  };
  const chg = (field, from, to) => [{ field, from, to }];
  const rl = (k) => STATUS.rental[k].label, sl = (k) => STATUS.sale[k].label;
  const sisa = (b) => Math.max(0, b.total - Rules.paidTotal(b));
  /* ===================== Pelunasan sewa (revisi mitra) =====================
     Dipakai di Catat barang keluar, Catat barang kembali & Detail booking (diantar / bayar transfer).
     - Diskon pelunasan (mis. rating Google Maps) SEKALI per booking, maks. sebesar sisa sewa → mengurangi total sewa (pemasukan), bukan pengeluaran
     - Pelunasan baru tercatat di keuangan setelah staff MENERIMA / MEMVERIFIKASI uangnya (tunai / transfer / QRIS + bukti opsional)
     - Boleh ditunda ke saat barang kembali (Konfigurasi → Aturan Rental), atau jadi piutang setelah barang kembali (identitas tetap ditahan) */
  const PAYVIA = [['Tunai', 'fa-money-bill-wave'], ['Transfer', 'fa-building-columns'], ['QRIS', 'fa-qrcode']];
  const shrinkImg = (file) => new Promise((res) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1200 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); }; im.onerror = () => res(''); im.src = r.result; }; r.onerror = () => res(''); r.readAsDataURL(file); });
  function settleBox(m, b, o = {}) {
    const st = DB.settings(); const S = { extra: +o.extra || 0, discOpen: false, dtype: 'rp', mode: 'now', via: o.via || 'Tunai', proof: '' };
    const box = m.$(o.sel || '#stl'); const had = b.settleDisc ? +b.settleDisc.amount || 0 : 0;
    const sewaDue = () => sisa(b); /* sisa sewa sebelum diskon baru (diskon lama sudah ada di total) */
    const discAmt = () => { if (had || !S.discOpen) return 0; const v = +String(S.dval || '').replace(/[^\d.]/g, '') || 0; /* S.dval selalu disinkronkan lewat keep() */ const base = Math.max(0, (b.subtotal || 0) - (b.discount ? +b.discount.amount || 0 : 0)); /* % dihitung dari HARGA SEWA (ketentuan mitra: harga sewa − diskon − DP) */ const a = S.dtype === 'pct' ? (v > 100 ? 0 : Math.round(base * v / 100)) : Math.round(v); return Math.max(0, Math.min(a, sewaDue())); };
    const due = () => Math.max(0, sewaDue() - discAmt() + S.extra);
    const RS = DB.discReasons(); const reasons = RS.map((r) => r.name); const pctOf = (n) => { const r = RS.find((x) => x.name === n); return r && r.pct !== '' ? r.pct : null; };
    const laterOk = o.stage === 'keluar' ? (st.settleWhen || 'keduanya') !== 'ambil' : o.stage === 'kembali';
    const render = () => {
      const D0 = discAmt(); const dd = due(); const promo = b.discount ? +b.discount.amount || 0 : 0;
      box.innerHTML = `<div class="stl">
        <div class="stl-h"><i class="fa-solid fa-cash-register"></i> Pelunasan ${dd ? '' : '<span class="pill green plain">Lunas</span>'}</div>
        <div class="kv"><span>Harga sewa${b.fine ? ' + denda sebelumnya' : ''}</span><span>${rupiah(b.subtotal + (b.fine || 0))}</span></div>
        ${promo ? `<div class="kv"><span>${esc(DB.discLabel(b.discount))}</span><span>− ${rupiah(promo)}</span></div>` : ''}
        ${had ? `<div class="kv stl-disc"><span>Diskon pelunasan · ${esc(b.settleDisc.reason || '')}<small>diberikan ${esc(b.settleDisc.by || '')}</small></span><span>− ${rupiah(had)}</span></div>` : ''}
        <div class="kv"><span>Sudah dibayar (DP${Rules.paidTotal(b) > (b.dp || 0) ? ' & pembayaran lain' : ''})</span><span>− ${rupiah(Rules.paidTotal(b))}</span></div>
        ${S.extra ? `<div class="kv"><span>${esc(o.extraLabel || 'Denda & biaya')}</span><span>+ ${rupiah(S.extra)}</span></div>` : ''}
        ${!had && sewaDue() > 0 ? (S.discOpen ? `<div class="stl-dbox"><div class="stl-drow"><div class="seg sm" data-sd="type"><button type="button" data-t="rp" class="${S.dtype === 'rp' ? 'active' : ''}">Rp</button><button type="button" data-t="pct" class="${S.dtype === 'pct' ? 'active' : ''}">%</button></div>
            <input class="input" data-sd="val" inputmode="numeric" ${S.dtype === 'pct' ? 'data-pct' : 'data-rp'} placeholder="${S.dtype === 'pct' ? 'Contoh: 10' : 'Contoh: 10000'}" value="${esc(S.dval || '')}"><button type="button" class="icon-btn" data-sd="x" title="Batalkan diskon"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="stl-drow"><select class="select" data-sd="reason">${RS.map((r) => `<option value="${esc(r.name)}" ${r.name === S.reason ? 'selected' : ''}>${esc(r.name)}${r.pct !== '' ? ` · ${r.pct}%` : ''}</option>`).join('')}<option value="__lain" ${S.reason === '__lain' ? 'selected' : ''}>Lainnya…</option></select>
            ${S.reason === '__lain' ? `<input class="input" data-sd="rtext" placeholder="Alasan diskon" value="${esc(S.rtext || '')}">` : ''}</div>
            <div class="kv stl-disc"><span>Diskon pelunasan</span><span>− ${rupiah(D0)}</span></div><small class="muted">${S.dtype === 'pct' ? `Persen dihitung dari harga sewa ${rupiah(Math.max(0, (b.subtotal || 0) - (b.discount ? +b.discount.amount || 0 : 0)))}. ` : ''}Maksimal ${rupiah(sewaDue())} (sisa sewa). Diskon hanya bisa diberikan sekali per booking.</small></div>`
          : `<button type="button" class="link-btn stl-add" data-sd="open"><i class="fa-solid fa-tag"></i> + Diskon (mis. rating Google Maps)</button>`) : ''}
        <div class="kv total"><span>Sisa yang harus dibayar</span><span>${rupiah(dd)}</span></div>
        ${dd ? `<div class="stl-pay">
          <label class="radio-line"><input type="radio" name="stlMode" value="now" ${S.mode === 'now' ? 'checked' : ''}> <span><b>${o.stage === 'detail' ? 'Pelunasan sudah diterima' : 'Terima pelunasan sekarang'}</b></span></label>
          ${S.mode === 'now' ? `<div class="stl-via">${PAYVIA.map(([k, ic]) => `<button type="button" data-via="${k}" class="${S.via === k ? 'on' : ''}"><i class="fa-solid ${ic}"></i> ${k}${k === 'Tunai' && o.stage === 'detail' ? ' (di lokasi antar)' : ''}</button>`).join('')}</div>
            ${S.via !== 'Tunai' ? `<label class="stl-proof"><input type="file" accept="image/*" hidden data-sd="proof"><span class="btn btn-light btn-sm"><i class="fa-solid fa-receipt"></i> ${S.proof ? 'Ganti bukti' : 'Lampirkan bukti transfer'}</span> <small class="muted">${S.proof ? '<i class="fa-solid fa-check" style="color:var(--g600)"></i> bukti terlampir' : 'opsional, dari chat WhatsApp customer'}</small></label>
              <label class="chk-line"><input type="checkbox" data-sd="ver"> <span>Sudah dicek: dana <b>${rupiah(dd)}</b> masuk ke rekening / QRIS toko</span></label>` : ''}` : ''}
          ${laterOk ? `<label class="radio-line"><input type="radio" name="stlMode" value="later" ${S.mode === 'later' ? 'checked' : ''}> <span><b>${o.stage === 'kembali' ? 'Belum bisa bayar (piutang)' : 'Bayar saat barang kembali'}</b><small>${o.stage === 'kembali' ? 'Kartu identitas tetap ditahan sampai lunas · muncul di Dashboard untuk ditagih' : 'Kartu identitas ditahan · sisa ditagih saat pengembalian'}</small></span></label>
            ${S.mode === 'later' ? `<input class="input" data-sd="note" placeholder="${o.stage === 'kembali' ? 'Catatan: janji bayar kapan / via apa' : 'Catatan (opsional)'}" value="${esc(S.note || '')}">` : ''}` : ''}
        </div>` : ''}</div>`;
    };
    const keep = () => { const g = (k) => box.querySelector(`[data-sd=${k}]`); if (g('val')) S.dval = g('val').value; if (g('reason')) S.reason = g('reason').value; if (g('rtext')) S.rtext = g('rtext').value; if (g('note')) S.note = g('note').value; if (g('ver')) S.ver = g('ver').checked; };
    box.addEventListener('click', (e) => { const t = e.target.closest('[data-sd],[data-via],[data-t]'); if (!t) return;
      if (t.dataset.sd === 'open') { S.discOpen = true; S.reason = S.reason || reasons[0] || '__lain'; if (pctOf(S.reason) != null && !S.dval) { S.dtype = 'pct'; S.dval = String(pctOf(S.reason)); } render(); box.querySelector('[data-sd=val]').focus(); return; }
      if (t.dataset.sd === 'x') { S.discOpen = false; S.dval = ''; render(); return; }
      if (t.dataset.t) { keep(); S.dtype = t.dataset.t; S.dval = ''; render(); box.querySelector('[data-sd=val]').focus(); return; }
      if (t.dataset.via) { keep(); S.via = t.dataset.via; render(); } });
    box.addEventListener('input', (e) => { if (e.target.dataset.sd === 'val') { keep(); const pos = e.target.selectionStart; render(); const v = box.querySelector('[data-sd=val]'); v.focus(); v.setSelectionRange(pos, pos); } else keep(); });
    box.addEventListener('change', async (e) => { const t = e.target;
      if (t.name === 'stlMode') { keep(); S.mode = t.value; render(); return; }
      if (t.dataset.sd === 'reason') { keep(); if (pctOf(S.reason) != null) { S.dtype = 'pct'; S.dval = String(pctOf(S.reason)); } else { S.dtype = 'rp'; S.dval = ''; } render(); if (S.reason === '__lain') box.querySelector('[data-sd=rtext]').focus(); return; }
      if (t.dataset.sd === 'proof' && t.files[0]) { S.proof = await shrinkImg(t.files[0]); keep(); render(); } });
    render();
    return {
      setExtra(v) { keep(); S.extra = Math.max(0, +v || 0); render(); },
      due, discAmt,
      read() {
        keep(); const d = discAmt(); const dd = due();
        if (S.discOpen && S.dtype === 'pct' && (+S.dval || 0) > 100) { toast('Diskon persen maksimal 100%. Pilih Rp untuk potongan nominal.', 'err'); return null; }
        if (S.discOpen && !had && !d) { toast('Isi nilai diskon, atau batalkan diskon.', 'err'); return null; }
        const reason = S.reason === '__lain' ? String(S.rtext || '').trim() : S.reason;
        if (d && !reason) { toast('Tulis alasan diskon.', 'err'); return null; }
        if (dd && S.mode === 'now' && S.via !== 'Tunai' && !S.ver) { toast(`Centang "sudah dicek" setelah memastikan dana ${rupiah(dd)} masuk.`, 'err'); return null; }
        if (dd && S.mode === 'later' && o.stage === 'kembali' && String(S.note || '').trim().length < 3) { toast('Tulis catatan piutang (mis. janji bayar kapan).', 'err'); return null; }
        if (dd && !laterOk && S.mode !== 'now') return null;
        return { disc: d ? { amount: d, reason, by: me.name, at: D.nowStamp(), stage: o.stage } : null, pay: dd && S.mode === 'now' ? { amount: dd, via: S.via, proof: S.proof } : null, later: !!(dd && S.mode === 'later'), note: String(S.note || '').trim(), due: dd };
      },
    };
  }
  /* Terapkan hasil settleBox ke booking (diskon → total turun; pelunasan → pembayaran tercatat & masuk keuangan) */
  function settleApply(b, r, payType) {
    if (!r) return [];
    const ch = [];
    if (r.disc) { b.settleDisc = r.disc; Rules.recalc(b); b.history = b.history || []; b.history.push({ at: r.disc.at, text: `Diskon pelunasan ${rupiah(r.disc.amount)} (${r.disc.reason}) oleh ${me.name}` }); ch.push({ field: 'Diskon pelunasan', from: '', to: `${rupiah(r.disc.amount)} · ${r.disc.reason}` }); }
    if (r.pay && r.pay.amount > 0) {
      b.payments.push(Object.assign({ at: D.nowStamp(), amount: r.pay.amount, type: payType || 'Pelunasan', via: `${r.pay.via} · ${me.name}`, by: me.name, verified: true }, r.pay.proof ? { proof: r.pay.proof } : {}));
      b.history.push({ at: D.nowStamp(), text: `${payType || 'Pelunasan'} ${rupiah(r.pay.amount)} diterima via ${r.pay.via}${r.pay.proof ? ' (bukti terlampir)' : ''} · diverifikasi ${me.name}` });
      ch.push({ field: payType || 'Pelunasan', from: '', to: `${rupiah(r.pay.amount)} via ${r.pay.via}` });
    }
    return ch;
  }
  /* Pelunasan dari Detail booking (diantar & bayar transfer / tunai di lokasi, atau menagih piutang) */
  function settleModal(id, done) {
    const b = DB.booking(id); if (!b) return;
    const m = modal({ title: `Pelunasan · ${NO(b)}`, body: `<p class="muted" style="font-size:13px;margin:0 0 10px">${esc(b.customer.name)} · ${esc(itemsText(b))} · ${D.fmtRange(b.start, b.end)}${b.piutang ? ' · <b style="color:var(--red)">piutang setelah barang kembali</b>' : ''}</p><div id="stl"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="stlOk"><i class="fa-solid fa-check"></i> Simpan pelunasan</button>' });
    const sb = settleBox(m, b, { stage: 'detail', via: 'Transfer' });
    m.$('#stlOk').addEventListener('click', () => {
      const r = sb.read(); if (!r) return; if (!r.pay && !r.disc) { toast('Belum ada pelunasan / diskon yang dicatat.', 'err'); return; }
      const x = DB.booking(id); const ch = settleApply(x, r, x.piutang ? 'Pelunasan piutang' : 'Pelunasan');
      if (!sisa(x)) { x.paymentStatus = 'lunas'; if (x.piutang) { x.piutang.paidAt = D.nowStamp(); x.history.push({ at: D.nowStamp(), text: 'Piutang lunas · kartu identitas boleh dikembalikan' }); delete x.piutang; } x.settleLater = false; }
      log(x, `Pelunasan dicatat${r.pay ? ` ${rupiah(r.pay.amount)} via ${r.pay.via}` : ''}`, 'pembayaran', `Mencatat pelunasan ${NO(x)}`, ch);
      DB.saveBooking(x); m.close(); toast(sisa(x) ? `Tersimpan. Sisa ${rupiah(sisa(x))}.` : 'Pelunasan tercatat. Booking lunas.'); done && done();
    });
  }
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
    if (f.photo !== 'sembunyi') h += `<div class="field"><label>${k === 'return' ? 'Foto kondisi barang' : 'Foto barang saat keluar'}${f.photo === 'wajib' ? req(f.photo) : ' <span class="opt">(opsional)</span>'}</label><div class="photo-up" data-photo><label class="btn btn-light btn-sm" style="cursor:pointer"><i class="fa-solid fa-camera"></i> ${matchMedia('(pointer: coarse)').matches ? 'Ambil / pilih foto' : 'Pilih foto'}<input type="file" accept="image/*" ${matchMedia('(pointer: coarse)').matches ? 'capture="environment"' : ''} hidden data-photoin></label>${f.photo === 'wajib' ? '' : '<small class="muted photo-skip">Boleh dilewati, tidak wajib.</small>'}<div class="photo-prev"></div></div></div>`;
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
  /* Detail lengkap pencatatan barang keluar / kembali (unit, petugas, kondisi, jaminan, pembayaran, checklist, foto) */
  const RES_LBL = { siap: 'Bersih, siap disewa', cuci: 'Perlu dicuci', rusak: 'Rusak, perlu diperbaiki', hilang: 'Hilang' };
  function outRetHtml(b, kind) {
    const x = b[kind]; const isOut = kind === 'out';
    const units = b.items.map((it) => ({ name: it.name, qty: it.qty, units: (it.units || []).map((u) => u.code) }));
    const res = (code) => { const r = x.units && x.units[code]; if (!r) return ''; const o = typeof r === 'string' ? { res: 'siap', cond: r } : r; return `<span class="pill ${o.res === 'siap' ? 'green' : o.res === 'cuci' ? 'teal' : 'red'} plain">${RES_LBL[o.res] || o.res}</span>${o.note ? `<small class="muted"> ${esc(o.note)}</small>` : ''}`; };
    const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
    const photos = [x.photo ? { label: isOut ? 'Foto saat keluar' : 'Foto saat kembali', src: x.photo } : null, ...(x.extra || []).filter((e) => e.type === 'foto' && e.value).map((e) => ({ label: e.label, src: e.value }))].filter(Boolean);
    const extras = (x.extra || []).filter((e) => e.type !== 'foto' && e.value !== '' && e.value != null);
    return `<div class="mini-sec orx ${kind}"><h4><i class="fa-solid ${isOut ? 'fa-arrow-right-from-bracket' : 'fa-arrow-right-to-bracket'}"></i> ${isOut ? 'Pencatatan barang keluar' : 'Pencatatan barang kembali'}</h4>
      <dl class="orx-grid">
        ${row('Waktu', D.fmtDateTime(x.at))}${row('Petugas', esc(x.by || '-'))}${row('Kondisi umum', esc(x.cond || '-'))}
        ${isOut ? row('Kartu identitas jaminan', esc(x.idCard || b.idType || '-')) : row('Keterlambatan', x.lateDays ? `<b style="color:var(--red)">${x.lateDays} malam</b>` : 'Tepat waktu')}
        ${isOut ? row('Dibayar saat ambil', x.paidAtPickup ? rupiah(x.paidAtPickup) : 'Tidak ada (sudah lunas)') : row('Denda', x.fine ? `${rupiah(x.fine)}${x.lateFee ? ` <small class="muted">(terlambat ${rupiah(x.lateFee)}${x.damageFee ? ` · kerusakan ${rupiah(x.damageFee)}` : ''})</small>` : ''}` : 'Tidak ada')}
        ${isOut && b.depositIn ? row('Jaminan uang', `${rupiah(b.depositIn.amount)} diterima`) : ''}${!isOut && b.depositOut ? row('Jaminan dikembalikan', rupiah(b.depositOut.amount || 0)) : ''}
        ${extras.map((e) => row(esc(e.label), esc(Array.isArray(e.value) ? e.value.join(', ') : e.value === true ? 'Ya' : String(e.value)))).join('')}
      </dl>
      <div class="orx-units"><b>${isOut ? 'Unit yang diserahkan' : 'Hasil pemeriksaan per unit'}</b>${units.map((u) => `<div class="orx-u"><span>${u.qty}× ${esc(u.name)}</span><span>${u.units.length ? u.units.map((c) => `<code>${esc(c)}</code>${!isOut ? ' ' + res(c) : ''}`).join(isOut ? ' ' : '<br>') : '<small class="muted">tanpa kode unit</small>'}</span></div>`).join('')}</div>
      ${x.checklist && x.checklist.length ? `<div class="orx-chk"><b>Checklist</b>${x.checklist.map((c) => `<span><i class="fa-solid fa-check"></i> ${esc(c)}</span>`).join('')}</div>` : ''}
      ${x.note ? `<p class="orx-note"><i class="fa-regular fa-note-sticky"></i> ${esc(x.note)}</p>` : ''}
      ${photos.length ? `<div class="orx-photos">${photos.map((p) => `<a href="${p.src}" target="_blank" rel="noopener"><img src="${p.src}" alt="${esc(p.label)}"><small>${esc(p.label)}</small></a>`).join('')}</div>` : `<p class="muted orx-nophoto"><i class="fa-regular fa-image"></i> Tidak ada foto yang diunggah.</p>`}
    </div>`;
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
      log(b, 'Pembayaran DP diverifikasi, booking dikonfirmasi', 'rental', `Mengonfirmasi booking ${NO(b)} (DP ${rupiah(b.dp)} diverifikasi)`, chg('Status booking', rl(from), rl('dikonfirmasi')));
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Booking dikonfirmasi', `DP ${rupiah(b.dp)} untuk ${NO(b)} diterima. Barang bisa diambil ${D.fmtDate(b.start, true)}.`, `pesanan?id=${b.id}`);
      toast(`${NO(b)} dikonfirmasi.`);
    },
    async rejectProof(b) {
      const r = await confirmBox({ title: `Tolak bukti bayar ${NO(b)}?`, text: 'Customer akan diminta mengunggah ulang bukti pembayaran.', ok: 'Tolak bukti', danger: true, input: { label: 'Alasan penolakan (mis. nominal tidak sesuai)' } });
      if (r === false) return false;
      b.status = 'menunggu_pembayaran'; b.paymentStatus = 'unpaid'; b.proof = null;
      log(b, `Bukti pembayaran ditolak${val(r) ? ': ' + val(r) : ''}`, 'rental', `Menolak bukti pembayaran ${NO(b)}${val(r) ? ` (${val(r)})` : ''}`, chg('Status booking', rl('menunggu_konfirmasi'), rl('menunggu_pembayaran')));
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Bukti pembayaran ditolak', `Bukti DP ${NO(b)} ditolak${val(r) ? ` (${val(r)})` : ''}. Silakan unggah ulang.`, `pembayaran?ids=${b.id}`);
      toast('Bukti pembayaran ditolak.'); return true;
    },
    pickup(b, done) {
      const due = sisa(b); const fc = DB.formCfg('pickup');
      const m = modal({ title: `Catat barang keluar · ${NO(b)}`, size: 'lg', body: `${custFlag(b.customer)}
        <div class="notice green" style="margin-bottom:14px"><i class="fa-solid fa-box-open"></i><div>${esc(b.customer.name)} mengambil <strong>${esc(itemsText(b))}</strong> untuk ${D.fmtRange(b.start, b.end)}.</div></div>
        <div class="grid-2">
          <div class="field"><label>Kondisi barang saat keluar</label><select class="select" id="oCond"><option>Baik</option><option>Sangat Baik</option><option>Baik (ada bekas pemakaian)</option></select></div>
          ${fc.idCard === 'sembunyi' ? '' : UI.idField('oId', b.idType || '', { required: fc.idCard === 'wajib', label: 'Identitas jaminan', hint: b.idType ? `Dipilih customer saat booking: <b>${esc(b.idType)}</b>` : '' })}
        </div>
        ${fc.note === 'sembunyi' ? '' : `<div class="field"><label>Catatan${fc.note === 'wajib' ? ' <span class="req">*</span>' : ''}</label><textarea class="textarea" id="oNote" placeholder="Contoh: frame lengkap, pasak 12 pcs"></textarea></div>`}
        ${unitPicker(b)}
        ${extraFields('pickup')}${sopBox('pickup')}
        <div id="stl"></div>
        ${b.deposit ? `<label class="chk-line dep-line"><input type="checkbox" id="oDep"> <span><b>Jaminan ${rupiah(b.deposit)} sudah diterima</b><small>Dikembalikan saat barang kembali, bisa dipotong denda.</small></span></label>` : ''}
`,
        foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="oSave"><i class="fa-solid fa-check"></i> Simpan &amp; tandai disewa</button>` });
      bindExtras(m); UI.idBind(m.el, 'oId');
      const sb = settleBox(m, b, { stage: 'keluar' });
      m.$('#oSave').addEventListener('click', () => {
        const st0 = sb.read(); if (!st0) return;
        if (b.deposit && !m.$('#oDep').checked) { toast(`Terima jaminan ${rupiah(b.deposit)} dulu sebelum barang keluar.`, 'err'); return; }
        const note = m.$('#oNote') ? m.$('#oNote').value.trim() : '';
        if (fc.note === 'wajib' && !note) { m.$('#oNote').classList.add('err'); toast('Catatan wajib diisi.', 'err'); return; }
        const idc = fc.idCard === 'sembunyi' ? { ok: true, value: '' } : UI.idRead(m.el, 'oId'); if (!idc.ok) return;
        const picks = readUnitPicks(m, b); if (!picks) return;
        const ex = readExtras(m, 'pickup'); if (!ex) return;
        DB.assignUnits(b, picks);
        const stCh = settleApply(b, st0, 'Pelunasan');
        b.out = { at: D.nowStamp(), cond: m.$('#oCond').value, idCard: idc.value, by: me.name, note, photo: ex.photo, extra: ex.extra, paidAtPickup: st0.pay ? st0.pay.amount : 0, payLater: st0.later, payLaterNote: st0.note || '', checklist: [...m.el.querySelectorAll('.sop-chk input:checked, .chk-line input:checked')].map((c) => (c.closest('label') || {}).innerText || '').map((t) => t.trim()).filter(Boolean).slice(0, 8) };
        if (b.deposit) b.depositIn = { at: D.nowStamp(), amount: b.deposit, by: me.name };
        b.paymentStatus = sisa(b) ? 'dp_paid' : 'lunas'; b.settleLater = !!st0.later; b.status = 'disewa';
        if (st0.later) b.history.push({ at: D.nowStamp(), text: `Sisa ${rupiah(sisa(b))} dibayar saat barang kembali${st0.note ? ' · ' + st0.note : ''} (${me.name})` });
        log(b, 'Barang keluar / diambil customer', 'barang_keluar', `Mencatat barang keluar ${NO(b)}: ${itemsText(b)}`, [{ field: 'Status booking', from: rl('dikonfirmasi'), to: rl('disewa') }, { field: 'Kondisi keluar', from: '', to: b.out.cond }, ...stCh, ...(st0.later ? [{ field: 'Pelunasan', from: '', to: `ditunda ke saat kembali (${rupiah(sisa(b))})` }] : [])]);
        DB.saveBooking(b);
        try {
          fetch(url('./api/admin/booking/' + b.id + '/pickup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') || {}).content || '' },
            body: JSON.stringify({
              condition: m.$('#oCond').value,
              notes: note,
              pay_now: st0.pay ? st0.pay.amount : 0,
              payment_method: (st0.pay && st0.pay.method) || 'cash',
              unit_ids: picks || {}
            })
          });
        } catch (_) {}
        DB.notify(b.customer.email, 'Selamat bertualang!', `Barang ${NO(b)} sudah diambil. Harap kembalikan paling lambat ${D.fmtDate(b.end, true)}.`, `pesanan?id=${b.id}`);
        m.close(); toast(st0.later ? `Barang keluar tercatat. Sisa ${rupiah(sisa(b))} ditagih saat kembali.` : 'Barang keluar tercatat. Status: Sedang disewa.'); done && done();
      });
    },
    processReturn(b, done) {
      const fc = DB.formCfg('return'); const stR = DB.settings(); const hasUnits = b.items.some((it) => (it.units || []).length); const nowT = new Date().toTimeString().slice(0, 5);
      const m = modal({ title: `Proses pengembalian · ${NO(b)}`, size: 'lg', body: `
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
        <span id="rPaidWrap" hidden></span>
        ${b.depositIn ? `<div class="dep-box" id="rDepBox"></div>` : ''}
        <div id="stl"></div>`,
        foot: `<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="rSave"><i class="fa-solid fa-check"></i> Selesaikan rental</button>` });
      let sb = null;
      const calc = () => { const r = calc0(); if (sb) sb.setExtra(r.rest != null ? r.rest : r.fine); return r; };
      const calc0 = () => {
        const date = m.$('#rDate').value || D.today();
        const late = Rules.lateDays(b, date, m.$('#rTime').value); const lf = Rules.lateFee(b, late);
        const dmg = Math.max(0, +m.$('#rDmg').value || 0);
        if (/Rusak|Hilang/.test(m.$('#rCond').value) && !dmg) m.$('#rDmg').classList.add('err'); else m.$('#rDmg').classList.remove('err');
        m.$('#rLate').value = late ? `${late} malam (denda ${rupiah(lf)})` : 'Tepat waktu';
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
      sb = settleBox(m, b, { stage: 'kembali', extraLabel: 'Denda & biaya kerusakan' });
      calc(); bindExtras(m); bindUnitResults(m);
      m.$('#rSave').addEventListener('click', () => {
        const r = calc(); const st0 = sb.read(); if (!st0) return;
        const note = m.$('#rNote') ? m.$('#rNote').value.trim() : '';
        if (fc.note === 'wajib' && !note) { m.$('#rNote').classList.add('err'); toast('Catatan pemeriksaan wajib diisi.', 'err'); return; }
        const ex = readExtras(m, 'return'); if (!ex) return;
        const t = m.$('#rTime').value || '12:00';
        const uc = hasUnits ? readUnitResults(m) : {}; if (!uc) return;
        if (hasUnits) { const v = Object.values(uc).map((x) => x.res); m.$('#rCond').value = v.includes('hilang') ? 'Hilang sebagian' : v.includes('perbaikan') ? 'Rusak ringan' : v.includes('cuci') ? 'Kotor (perlu dicuci)' : 'Baik'; }
        DB.releaseUnits(b, uc);
        b.ret = { at: new Date(`${r.date}T${t}:00`).toISOString(), cond: m.$('#rCond').value, lateDays: r.late, lateFee: r.lf, damageFee: r.dmg, fine: r.fine, by: me.name, note, photo: ex.photo, extra: ex.extra, units: uc || null };
        b.fine = (b.fine || 0) + r.fine; Rules.recalc(b);
        if (r.ded) b.payments.push({ at: D.nowStamp(), amount: r.ded, type: 'Denda', note: 'dipotong dari jaminan' });
        const stCh = settleApply(b, st0, r.fine - (r.ded || 0) ? 'Pelunasan & denda' : 'Pelunasan');
        if (b.depositIn) b.depositOut = { at: D.nowStamp(), amount: r.depBack, deducted: r.ded || 0, by: me.name };
        b.paymentStatus = sisa(b) ? 'dp_paid' : 'lunas'; b.settleLater = false;
        /* Belum bisa bayar → piutang: identitas tetap ditahan, muncul di Dashboard untuk ditagih */
        if (sisa(b)) { b.piutang = { at: D.nowStamp(), amount: sisa(b), note: st0.note || '', by: me.name }; b.history.push({ at: D.nowStamp(), text: `Barang kembali, sisa ${rupiah(sisa(b))} belum dibayar (piutang)${st0.note ? ' · ' + st0.note : ''}. Kartu identitas ditahan.` }); }
        b.status = 'selesai';
        log(b, `Barang kembali (${b.ret.cond})${r.late ? `, terlambat ${r.late} hari` : ''}${r.fine ? `, denda ${rupiah(r.fine)}` : ''}`, 'pengembalian', `Mencatat barang kembali ${NO(b)} (kondisi ${b.ret.cond}${r.late ? `, terlambat ${r.late} hari` : ''})`,
          [{ field: 'Status booking', from: rl('disewa'), to: rl('selesai') }, { field: 'Kondisi kembali', from: b.out ? b.out.cond : '', to: b.ret.cond }, ...(r.fine ? [{ field: 'Denda', from: '', to: rupiah(r.fine) }] : []), ...stCh, ...(b.piutang ? [{ field: 'Piutang', from: '', to: rupiah(b.piutang.amount) }] : [])]);
        DB.saveBooking(b);
        try {
          fetch(url('./api/admin/booking/' + b.id + '/return'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') || {}).content || '' },
            body: JSON.stringify({
              return_date: r.date,
              condition: m.$('#rCond').value,
              late_days: r.late,
              late_fee: r.lf,
              damage_fee: r.dmg,
              total_fine: r.fine,
              notes: note,
              pay_fine: r.fine - (r.ded || 0),
              payment_method: 'cash',
              unit_results: uc || {}
            })
          });
        } catch (_) {}
        DB.notify(b.customer.email, 'Rental selesai — beri ulasan yuk!', `Terima kasih! ${NO(b)} sudah dikembalikan${r.fine ? ` dengan denda ${rupiah(r.fine)}` : ''}. Bagikan pengalamanmu dengan memberi bintang & ulasan.`, `pesanan?tab=riwayat&review=${b.id}`);
        m.close(); toast(b.piutang ? `Pengembalian tercatat. Piutang ${rupiah(b.piutang.amount)} muncul di Dashboard.` : 'Pengembalian tercatat. Booking lunas.'); done && done();
        if (hasUnits) setTimeout(() => afterReturnPopup(b, uc), 250);
      });
    },
    adminCancel(b, done) {
      const hasDp = Rules.paidTotal(b) > 0;
      const refundable = Rules.canRefund(b);
      const m = modal({ title: `Batalkan booking ${NO(b)}`, body: `
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
        log(b, `Booking dibatalkan admin: ${reason}`, 'pembatalan', `Membatalkan booking ${NO(b)}: ${reason}`, [{ field: 'Status booking', from: rl(from), to: rl('dibatalkan') }, ...(hasDp ? [{ field: 'Perlakuan DP', from: '', to: mode === 'refund' ? 'Dikembalikan (refund)' : 'Hangus' }] : [])]);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Booking dibatalkan', `${NO(b)} dibatalkan (${reason}).${mode === 'refund' ? ' DP akan dikembalikan maks. 2×24 jam.' : mode === 'forfeit' ? ' DP tidak dapat dikembalikan sesuai kebijakan.' : ''}`, `pesanan?tab=riwayat`);
        m.close(); toast('Booking dibatalkan.'); done && done();
      });
    },
    async refund(b) {
      const amt = Rules.refundAmount(b); const pct = DB.settings().refundPercent ?? 100;
      const r = await confirmBox({ title: `Kembalikan DP ${NO(b)}?`, text: `Transfer ${rupiah(amt)}${pct < 100 ? ` (${pct}% dari DP sesuai aturan refund)` : ''} ke rekening ${b.customer.name}, lalu konfirmasi di sini.${sopBox('cancel') ? '<br><br>' + DB.sops('pembatalan').filter((x) => x.active !== false).map((x) => `<b>SOP:</b> ${esc(x.body)}`).join('<br>') : ''}`, ok: 'Sudah ditransfer', input: { label: 'No. referensi transfer (opsional)' } });
      if (r === false) return false;
      b.refunds = b.refunds || []; b.refunds.push({ at: D.nowStamp(), amount: amt, ref: val(r) });
      b.paymentStatus = 'refunded'; if (b.cancel) b.cancel.refundStatus = 'selesai';
      log(b, `DP ${rupiah(amt)} dikembalikan`, 'refund', `Memproses refund DP ${NO(b)} sebesar ${rupiah(amt)}${val(r) ? ` (ref. ${val(r)})` : ''}`, chg('Status pembayaran', STATUS.payment.refund_pending.label, STATUS.payment.refunded.label));
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'DP sudah dikembalikan', `Refund ${rupiah(amt)} untuk ${NO(b)} sudah ditransfer.`, `pesanan?tab=riwayat`);
      toast('Refund tercatat.'); return true;
    },
    approveChange(b, ch) {
      const res = DB.applyBookingChange(b, ch);
      if (!res.ok) { toast(res.msg, 'err'); return false; }
      const oldTotal = res.oldTotal;
      ch.status = 'disetujui'; ch.decidedAt = D.nowStamp();
      log(b, `Ganti barang disetujui: ${ch.fromName} → ${ch.toName}`, 'pergantian', `Menyetujui pergantian barang ${NO(b)}: ${ch.fromName} → ${ch.toName}`, [{ field: 'Barang', from: `${ch.qty}× ${ch.fromName}`, to: `${ch.qty}× ${ch.toName}` }, { field: 'Total booking', from: rupiah(oldTotal), to: rupiah(b.total) }]);
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Ganti barang disetujui', `${ch.fromName} diganti ${ch.toName} (${NO(b)}). ${ch.diff > 0 ? `Tambahan ${rupiah(ch.diff)} dibayar saat pengambilan.` : ch.diff < 0 ? `Sisa bayar berkurang ${rupiah(-ch.diff)}.` : ''}`, `pesanan?id=${b.id}`);
      toast('Permintaan ganti barang disetujui.'); return true;
    },
    /* Perpanjangan sewa. req = permintaan customer (opsional) */
    extend(b, done, req) {
      const st = DB.settings(); const maxEnd = D.addDays(b.start, st.maxRentDays || 60);
      const m = modal({ title: `${req ? 'Tinjau perpanjangan' : 'Perpanjang sewa'} · ${NO(b)}`, body: `
        <div class="notice" style="margin-bottom:14px"><i class="fa-solid fa-calendar"></i><div>Sewa sekarang <strong>${D.fmtRange(b.start, b.end)}</strong> (${b.days} malam). Barang: ${esc(itemsText(b))}.</div></div>
        <div class="field"><label>Tanggal kembali baru</label><input class="input" type="date" id="exEnd" min="${D.addDays(b.end, 1)}" max="${maxEnd}" value="${req ? req.to : D.addDays(b.end, 1)}" ${req ? 'disabled' : ''}></div>
        <div id="exInfo"></div>
        ${req ? `<p style="font-size:13.5px"><span class="muted">Alasan customer:</span> ${esc(req.reason || '-')}</p>` : ''}
        <label class="chk-line" id="exPaidW"><input type="checkbox" id="exPaid"> Biaya perpanjangan sudah dibayar sekarang</label>`,
        foot: `${req ? '<button class="btn btn-danger" id="exNo">Tolak</button>' : '<button class="btn btn-light" data-close>Batal</button>'}<button class="btn btn-primary" id="exOk"><i class="fa-solid fa-check"></i> ${req ? 'Setujui perpanjangan' : 'Simpan perpanjangan'}</button>` });
      const calc = () => { const r = Rules.extendCheck(b, m.$('#exEnd').value);
        m.$('#exInfo').innerHTML = r.extraDays > 0 ? `<div class="kv"><span>Tambahan</span><span>${r.extraDays} malam (tarif dihitung ulang sesuai durasi baru)</span></div><div class="kv total"><span>Biaya perpanjangan</span><span>${rupiah(r.cost)}</span></div>${r.ok ? '<div class="notice green" style="margin-top:8px"><i class="fa-solid fa-circle-check"></i><div>Semua barang tersedia di tanggal tambahan.</div></div>' : `<div class="notice red" style="margin-top:8px"><i class="fa-solid fa-circle-xmark"></i><div>${esc(r.msg)}</div></div>`}` : `<p class="muted">${esc(r.msg)}</p>`;
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
        log(b, `Sewa diperpanjang sampai ${D.fmtDate(to, true)} (+${r.extraDays} hari)`, 'perpanjangan', `${req ? 'Menyetujui' : 'Mencatat'} perpanjangan ${NO(b)} sampai ${D.fmtDate(to, true)}`, [{ field: 'Tanggal kembali', from: D.fmtDate(oldEnd, true), to: D.fmtDate(to, true) }, { field: 'Total sewa', from: rupiah(oldTotal), to: rupiah(b.total) }]);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Sewa diperpanjang', `${NO(b)} diperpanjang sampai ${D.fmtDate(to, true)}. Tambahan biaya ${rupiah(r.cost)}${m.$('#exPaid').checked ? ' (sudah dibayar)' : ', dibayar saat pengembalian'}.`, `pesanan?id=${b.id}`);
        m.close(); toast('Perpanjangan disimpan.'); done && done();
      });
      const no = m.$('#exNo'); if (no) no.addEventListener('click', async () => {
        const r = await confirmBox({ title: 'Tolak perpanjangan?', text: 'Customer akan diberi tahu.', ok: 'Tolak', danger: true, input: { label: 'Alasan (opsional)' } }); if (r === false) return;
        Object.assign(b.extensions.find((x) => x.id === req.id), { status: 'ditolak', decidedAt: D.nowStamp(), by: me.name, note: val(r) });
        log(b, 'Perpanjangan ditolak', 'perpanjangan', `Menolak perpanjangan ${NO(b)}${val(r) ? `: ${val(r)}` : ''}`); DB.saveBooking(b);
        DB.notify(b.customer.email, 'Perpanjangan ditolak', `Permintaan perpanjangan ${NO(b)} ditolak${val(r) ? `: ${val(r)}` : ''}. Barang tetap dikembalikan ${D.fmtDate(b.end, true)}.`, `pesanan?id=${b.id}`);
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
        log(b, `Ganti barang di toko: ${r.qty}× ${ch.fromName} → ${ch.toName}`, 'pergantian', `Mencatat ganti barang di toko ${NO(b)}: ${r.qty}× ${ch.fromName} → ${ch.toName}`, changes);
        DB.saveBooking(b);
        DB.notify(b.customer.email, 'Barang sewa diganti', `${r.qty}× ${ch.fromName} diganti ${ch.toName} (${NO(b)}). Total sewa sekarang ${rupiah(b.total)}.`, `pesanan?id=${b.id}`);
        toast('Penggantian barang disimpan.'); done && done();
      } });
    },
    async rejectChange(b, ch) {
      const r = await confirmBox({ title: 'Tolak permintaan ganti barang?', text: `${ch.fromName} → ${ch.toName}`, ok: 'Tolak', danger: true, input: { label: 'Alasan (opsional)' } });
      if (r === false) return false;
      ch.status = 'ditolak'; ch.decidedAt = D.nowStamp(); ch.note = val(r);
      log(b, `Ganti barang ditolak: ${ch.fromName} → ${ch.toName}`, 'pergantian', `Menolak pergantian barang ${NO(b)}: ${ch.fromName} → ${ch.toName}${ch.note ? ` (${ch.note})` : ''}`);
      DB.saveBooking(b);
      DB.notify(b.customer.email, 'Ganti barang ditolak', `Permintaan ganti ${ch.fromName} → ${ch.toName} (${NO(b)}) ditolak${ch.note ? `: ${ch.note}` : ''}.`, `pesanan?id=${b.id}`);
      toast('Permintaan ditolak.'); return true;
    },
  };

  /* ====================== Layanan antar & jasa tenda ======================
     Jasa tenda (ketentuan mitra): bongkar pasang · pasang saja · bongkar saja, tarif per tenda di luar ongkir. */
  function svcTag(b, long) {
    const md = Svc.mode(b);
    if (md === 'ambil') return long ? 'Ambil di toko' : '';
    return `<span class="svc-tag ${md}"><i class="fa-solid ${Svc.icon(b)}"></i> ${esc(Svc.short(b))}${Svc.isTent(b) && (b.deliv || {}).tents ? ' ' + b.deliv.tents + ' tenda' : ''}</span>`;
  }
  /* Satu baris untuk daftar: tag + jadwal */
  const svcLine = (b) => (Svc.has(b) ? `<small class="svc-line">${svcTag(b)} ${esc(Svc.brief(b))}</small>` : '');
  function svcSection(b) {
    const md = Svc.mode(b); const d = b.deliv || {}; const live = !['selesai', 'dibatalkan'].includes(b.status);
    /* Booking ambil di toko: tidak ada tombol layanan di sini (membingungkan). Layanan antar / jasa tenda dipilih customer saat checkout
       atau dicatat kasir; bila ada, bagian ini muncul lengkap dengan tombol Ubah layanan & Perbarui nota. */
    if (md === 'ambil') return live && !['disewa'].includes(b.status) ? `<div class="svc-add"><div><b><i class="fa-solid fa-store"></i> Ambil di toko</b><small>Customer berubah pikiran ingin diantar atau dipasangkan tendanya?</small></div><button type="button" class="btn btn-light btn-sm" data-svcact="edit"><i class="fa-solid fa-plus"></i> Tambah layanan</button></div>` : '';
    const rm = Svc.returnMode(b); const paid = Svc.paid(b); const tent = Svc.isTent(b);
    return `<div class="mini-sec"><h4>${esc(Svc.label(b))}</h4><div class="svc-box">
      <div class="r"><i class="fa-solid fa-location-dot"></i><span>${esc(d.address || '-')}</span></div>
      ${Svc.delivers(b) ? `<div class="r"><i class="fa-solid fa-truck-fast"></i><span>${Svc.outLabel(b)}: <b>${D.fmtDate(d.date || b.start, true)} pukul ${esc(Svc.fmtT(d.time) || '-')}</b></span></div>` : `<div class="r"><i class="fa-solid fa-store"></i><span>Customer ambil barang di toko ${D.fmtDate(b.start, true)}</span></div>`}
      <div class="r"><i class="fa-solid fa-rotate-left"></i><span>Pengembalian: ${rm === 'jemput' ? `<b>${tent ? 'dibongkar &amp; dijemput tim' : 'dijemput staff'} ${D.fmtDate(d.backDate || b.end, true)}${d.backTime ? ' pukul ' + esc(Svc.fmtT(d.backTime)) : ''}</b>` : rm === 'toko' ? (tent ? 'customer bongkar sendiri &amp; antar ke toko' : 'diantar customer ke toko') : '<b style="color:#9a6508">belum disepakati</b> — isi setelah chat dengan customer'}</span></div>
      ${tent ? `<div class="r"><i class="fa-solid ${Svc.icon(b)}"></i><span>${esc(Svc.short(b))}: ${d.tents || 1} tenda × ${rupiah(Svc.fee(md))} = <b>${rupiah(Svc.setupTotal(b))}</b> + ${Svc.ongkirText(b)}</span></div>` : ''}
      ${d.courier ? `<div class="r"><i class="fa-solid fa-motorcycle"></i><span>Pengantar: <b>${esc(d.courier)}</b>${d.courierPhone ? ' · ' + esc(d.courierPhone) : ''}</span></div>` : ''}
      <div class="r"><i class="fa-brands fa-whatsapp"></i><span>${d.waAt ? `Customer mengirim konfirmasi ${D.fmtDateTime(d.waAt)}` : 'Customer belum mengirim konfirmasi via WhatsApp'}</span></div>
      ${(() => { const bl = Svc.bill(b); return `<div class="svc-bill">
        ${tent ? `<div class="kv"><span>Jasa ${esc(Svc.short(b).toLowerCase())}</span><span>${rupiah(bl.jasa)}</span></div>` : ''}
        <div class="kv"><span>${Svc.ongkirText(b).replace(/^o/, 'O')}</span><span>${bl.ongkirSet ? rupiah(bl.ongkir) : '<b style="color:#9a6508">belum diinput</b>'}</span></div>
        <div class="kv total"><span>Total layanan</span><span>${rupiah(bl.total)}${bl.ongkirSet ? '' : ' + ongkir'}</span></div>
        <div class="kv hl"><span>Sudah dibayar</span><span>${rupiah(bl.paid)}</span></div>
        ${bl.ongkirSet || bl.due ? `<div class="kv"><span>Sisa layanan</span><strong style="color:${bl.due ? 'var(--orange)' : 'var(--g700)'}">${bl.due ? rupiah(bl.due) : 'Lunas'}</strong></div>` : ''}
      </div>`; })()}
      ${live ? `<div class="acts"><button type="button" class="btn btn-light btn-xs" data-svcact="edit"><i class="fa-solid fa-pen"></i> Ubah layanan</button><button type="button" class="btn btn-primary btn-xs" data-svcact="pay"><i class="fa-solid fa-motorcycle"></i> Atur pengantaran &amp; ongkir</button><a class="btn btn-wa btn-xs" href="${custLink(b.customer)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Chat customer</a></div>` : ''}
    </div></div>`;
  }
  /* Ubah / atur layanan (dipakai juga untuk booking kasir & hasil kesepakatan WhatsApp) */
  function svcEdit(b, done) {
    const d = Object.assign({ address: '', date: b.start, time: '08:00', backDate: b.end, backTime: '16:00', tents: Math.max(1, Svc.tentCount(b.items)), returnMode: '' }, b.deliv || {});
    const H = Svc.hours(); const opt = (v) => `<option value="">—</option>` + H.map((h) => `<option value="${h}" ${h === v ? 'selected' : ''}>${h.replace(':', '.')}</option>`).join('');
    const label = (k) => (Svc.isTent(k) ? `${Svc.spec(k).label} (${rupiah(Svc.fee(k))}/tenda)` : Svc.spec(k).label);
    const adding = Svc.mode(b) === 'ambil'; const startMode = adding ? 'antar' : Svc.mode(b);
    const tentOk = Svc.tentCount(b.items) > 0;
    const m = modal({ title: `${adding ? 'Tambah layanan' : 'Ubah layanan'} · ${NO(b)}`, body: `
      ${adding ? '<p class="muted" style="font-size:13px;margin:-4px 0 12px">Pilih layanan yang diminta customer. Setelah disimpan, isi ongkir lewat <b>Perbarui nota</b> supaya tagihannya masuk ke nota customer.</p>' : ''}
      <div class="field"><label>Layanan</label><select class="select" id="svMode">${Object.keys(Svc.SPEC).filter((k) => !(adding && k === 'ambil') && (tentOk || !Svc.isTent(k) || Svc.mode(b) === k)).map((k) => `<option value="${k}" ${startMode === k ? 'selected' : ''}>${label(k)}</option>`).join('')}</select></div>
      <div id="svBody"></div>`, foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="svOk"><i class="fa-solid fa-check"></i> Simpan</button>' });
    const draw = () => {
      const md = m.$('#svMode').value; const sp = Svc.spec(md);
      if (md === 'ambil') { m.$('#svBody').innerHTML = '<p class="muted" style="font-size:13px">Barang diambil &amp; dikembalikan customer di toko.</p>'; return; }
      const rm = sp.pickup === true ? 'jemput' : sp.pickup === false ? 'toko' : d.returnMode;
      m.$('#svBody').innerHTML = `
        ${sp.desc ? `<p class="muted" style="font-size:12.5px;margin:-4px 0 10px">${sp.desc}</p>` : ''}
        <div class="field"><label>Alamat / lokasi</label><textarea class="textarea" id="svAddr" rows="2">${esc(d.address)}</textarea></div>
        ${sp.tent ? `<div class="field"><label>Jumlah tenda</label><input class="input" type="number" min="1" id="svTents" value="${d.tents || 1}"><small class="muted">${rupiah(Svc.fee(md))} per tenda, di luar ongkir</small></div>` : ''}
        ${sp.deliver ? `<div class="grid-2"><div class="field"><label>Tanggal antar</label><input class="input" type="date" id="svDate" value="${d.date || b.start}"></div><div class="field"><label>Jam antar</label><select class="select" id="svTime">${opt(d.time)}</select></div></div>` : ''}
        ${sp.pickup === null ? `<div class="field"><label>Pengembalian</label><select class="select" id="svRet"><option value="" ${!rm ? 'selected' : ''}>Belum disepakati</option><option value="toko" ${rm === 'toko' ? 'selected' : ''}>Customer antar sendiri ke toko</option><option value="jemput" ${rm === 'jemput' ? 'selected' : ''}>Dijemput staff</option></select></div>` : ''}
        <div class="grid-2" id="svBackRow" ${rm === 'jemput' ? '' : 'hidden'}><div class="field"><label>Tanggal jemput</label><input class="input" type="date" id="svBDate" value="${d.backDate || b.end}"></div><div class="field"><label>Jam jemput</label><select class="select" id="svBack">${opt(d.backTime)}</select></div></div>`;
      const r = m.$('#svRet'); if (r) r.addEventListener('change', () => { d.returnMode = r.value; m.$('#svBackRow').hidden = r.value !== 'jemput'; });
    };
    m.$('#svMode').addEventListener('change', draw); draw();
    m.$('#svOk').addEventListener('click', () => {
      const md = m.$('#svMode').value; const sp = Svc.spec(md); const old = Svc.brief(b) || 'Ambil di toko'; const oldMode = Svc.label(b);
      if (md === 'ambil') { b.delivery = 'ambil'; delete b.deliv; }
      else {
        const v = (id) => (m.$(id) || {}).value || '';
        if (v('#svAddr').trim().length < 5) { toast('Isi alamat / lokasi.', 'err'); return; }
        const rm = sp.pickup === true ? 'jemput' : sp.pickup === false ? 'toko' : v('#svRet');
        b.delivery = md;
        b.deliv = Object.assign({}, b.deliv || {}, { address: v('#svAddr').trim(), date: sp.deliver ? v('#svDate') || b.start : b.start, time: sp.deliver ? v('#svTime') : '', returnMode: rm },
          rm === 'jemput' ? { backDate: v('#svBDate') || b.end, backTime: v('#svBack') } : { backDate: '', backTime: '' }, sp.tent ? { tents: Math.max(1, +v('#svTents') || 1) } : { tents: 0 });
      }
      const now = Svc.brief(b) || 'Ambil di toko';
      if (now === old && oldMode === Svc.label(b)) { m.close(); return; }
      b.history.push({ at: D.nowStamp(), text: `Layanan diubah oleh ${me.name}: ${Svc.label(b)}${Svc.has(b) ? ' · ' + now : ''}` });
      DB.saveBooking(b);
      DB.audit({ type: 'layanan', action: `Mengubah layanan ${NO(b)} (${b.customer.name})`, ref: b.id, changes: [{ field: 'Layanan', from: oldMode, to: Svc.label(b) }, { field: 'Jadwal & lokasi', from: old, to: now }] });
      m.close(); toast('Layanan disimpan.'); done && done();
    });
  }
  /* Perbarui nota layanan setelah kesepakatan WhatsApp: input ongkir (dan penyesuaian jasa), lalu catat pembayaran bila sudah dibayar.
     Nota customer langsung ikut berubah. Pembayaran masuk Keuangan lini Rental. */
  function svcPay(b, done) {
    const tent = Svc.isTent(b); const d = b.deliv || {}; const bl0 = Svc.bill(b);
    const staff = DB.staff().filter((u) => u.status !== 'nonaktif'); const goes = Svc.delivers(b) || Svc.returnMode(b) === 'jemput';
    const m = modal({ title: `Atur pengantaran & ongkir · ${NO(b)}`, body: `
      <p class="muted" style="font-size:13px;margin-bottom:12px">Isi sesuai kesepakatan dengan customer via WhatsApp. Nota customer langsung diperbarui. Pembayaran masuk Keuangan lini <b>Rental</b>.</p>
      ${goes ? `<div class="ship-sec"><i class="fa-solid fa-motorcycle"></i> Staff pengantar <small>tampil di nota customer</small></div>
      <div class="grid-2"><div class="field"><label for="spCour">Nama staff</label><input class="input" id="spCour" list="spStaff" value="${esc(d.courier || '')}" placeholder="Pilih / ketik nama staff"><datalist id="spStaff">${staff.map((u) => `<option value="${esc(u.name)}">`).join('')}</datalist></div>
        <div class="field"><label for="spCPh">No. HP staff</label><input class="input" id="spCPh" inputmode="tel" value="${esc(d.courierPhone || '')}" placeholder="08xxxxxxxxxx"></div></div>
      <div class="ship-auto" style="margin-bottom:12px"><div class="kv"><span>Penerima</span><strong>${esc(b.customer.name)} · ${esc(b.customer.phone || '-')}</strong></div><div class="kv"><span>Alamat</span><strong style="text-align:right">${esc(d.address || '-')}</strong></div></div>` : ''}
      <div class="ship-sec"><i class="fa-solid fa-money-bill-wave"></i> Ongkir${tent ? ' &amp; jasa' : ''}</div>
      <div class="grid-2">
        ${tent ? `<div class="field"><label>Jasa ${esc(Svc.short(b).toLowerCase())} (Rp)</label><input class="input" type="number" id="spFee" min="0" value="${bl0.jasa}"><small class="muted">${d.tents || 1} tenda × ${rupiah(Svc.fee(Svc.mode(b)))}</small></div>` : ''}
        <div class="field"><label>${Svc.ongkirText(b).replace(/^o/, 'O')} disepakati (Rp)</label><input class="input" type="number" id="spOng" min="0" value="${bl0.ongkirSet ? bl0.ongkir : ''}" placeholder="Hasil chat WhatsApp"></div>
      </div>
      <div class="svc-bill" id="spSum"></div>
      <div class="field" style="margin-top:12px"><label>Pembayaran layanan</label>
        <div class="seg" id="spWhen"><button type="button" data-w="nanti" class="active">Belum dibayar</button><button type="button" data-w="now">Dibayar sekarang</button></div></div>
      <div id="spPayBox" hidden><div class="grid-2"><div class="field"><label>Jumlah dibayar (Rp)</label><input class="input" type="number" id="spAmt" min="0"></div>
        <div class="field"><label>Metode</label><select class="select" id="spVia">${['Tunai', 'Transfer', 'QRIS'].map((x) => `<option>${x}</option>`).join('')}</select></div></div></div>
      <div class="field"><label>Catatan <span class="opt">(opsional)</span></label><input class="input" id="spNote" placeholder="Contoh: ongkir pulang-pergi Baturraden"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="spOk"><i class="fa-solid fa-check"></i> Simpan &amp; perbarui nota</button>' });
    const n = (id) => +String((m.$(id) || {}).value || '').replace(/[^\d]/g, '') || 0;
    const has = (id) => String((m.$(id) || {}).value || '').replace(/[^\d]/g, '') !== '';
    let when = 'nanti';
    const calc = () => { const jasa = tent ? n('#spFee') : 0; const ong = n('#spOng'); const total = jasa + ong; return { jasa, ong, total, due: Math.max(0, total - Svc.paid(b)) }; };
    const sum = () => { const c = calc(); m.$('#spSum').innerHTML = `<div class="kv total"><span>Total layanan</span><span>${rupiah(c.total)}</span></div><div class="kv"><span>Sudah dibayar</span><span>${rupiah(Svc.paid(b))}</span></div><div class="kv"><span>Sisa layanan</span><strong>${rupiah(c.due)}</strong></div>`; if (when === 'now' && !m.$('#spAmt').dataset.touched) m.$('#spAmt').value = c.due; };
    m.el.addEventListener('input', (e) => { if (e.target.id === 'spAmt') e.target.dataset.touched = '1'; sum(); });
    m.$('#spWhen').addEventListener('click', (e) => { const x = e.target.closest('[data-w]'); if (!x) return; when = x.dataset.w; m.$$('#spWhen [data-w]').forEach((y) => y.classList.toggle('active', y === x)); m.$('#spPayBox').hidden = when !== 'now'; sum(); });
    if (m.$('#spCour')) m.$('#spCour').addEventListener('change', () => { const u = staff.find((x) => x.name.toLowerCase() === m.$('#spCour').value.trim().toLowerCase()); if (u && u.phone && !m.$('#spCPh').value) m.$('#spCPh').value = u.phone; });
    sum();
    m.$('#spOk').addEventListener('click', () => {
      if (!has('#spOng')) { toast('Isi ongkir yang sudah disepakati (isi 0 bila gratis).', 'err'); m.$('#spOng').focus(); return; }
      if (m.$('#spCPh') && m.$('#spCPh').value.trim() && !UI.isPhone(m.$('#spCPh').value.trim())) { toast('No. HP staff tidak valid.', 'err'); m.$('#spCPh').focus(); return; }
      const c = calc(); const amt = when === 'now' ? n('#spAmt') : 0;
      if (when === 'now' && !amt) { toast('Isi jumlah yang dibayar.', 'err'); return; }
      const at = D.nowStamp(); const note = m.$('#spNote').value.trim(); const via = 'Kasir · ' + m.$('#spVia').value;
      const before = Svc.bill(b);
      b.deliv = Object.assign({}, b.deliv || {}, { ongkir: c.ong, notaAt: at, notaBy: me.name }, tent && c.jasa !== Svc.setupTotal(b) ? { jasa: c.jasa } : { jasa: null },
        m.$('#spCour') ? { courier: m.$('#spCour').value.trim(), courierPhone: m.$('#spCPh').value.trim() } : {});
      const changes = [];
      if (!before.ongkirSet || before.ongkir !== c.ong) changes.push({ field: Svc.ongkirText(b), from: before.ongkirSet ? rupiah(before.ongkir) : '—', to: rupiah(c.ong) });
      if (tent && before.jasa !== c.jasa) changes.push({ field: 'Jasa tenda', from: rupiah(before.jasa), to: rupiah(c.jasa) });
      b.history.push({ at, text: `Nota layanan diperbarui oleh ${me.name}: ${tent ? `jasa ${rupiah(c.jasa)} + ` : ''}${Svc.ongkirText(b)} ${rupiah(c.ong)} = ${rupiah(c.total)}${note ? ' · ' + note : ''}` });
      if (amt) {
        /* Bagi pembayaran: lunasi jasa tenda dulu, sisanya ongkir */
        b.svc = b.svc || []; const nid = (k) => 'SVC-' + Date.now().toString(36).toUpperCase() + k + b.svc.length;
        const jasaDue = Math.max(0, c.jasa - Svc.paid(b, 'pasang')); const toJasa = Math.min(amt, jasaDue); const toOng = amt - toJasa;
        const job = tent ? `${Svc.short(b)} ${(b.deliv || {}).tents || 1} tenda` : '';
        if (toJasa) b.svc.push({ id: nid('P'), kind: 'pasang', amount: toJasa, at, by: me.name, via, note: [job, note].filter(Boolean).join(' · ') });
        if (toOng) b.svc.push({ id: nid('O'), kind: 'ongkir', amount: toOng, at, by: me.name, via, note });
        b.history.push({ at, text: `Pembayaran layanan ${rupiah(amt)} · ${via}` });
        changes.push({ field: 'Dibayar', from: '', to: rupiah(amt) }, { field: 'Lini usaha', from: '', to: 'Rental' });
      }
      Api.try('POST', `api/admin/booking/${b.booking_code || b.id}/service`, {
        service_mode: Svc.mode(b) || 'antar',
        fee: c.jasa,
        ongkir: c.ong,
        pay_now: amt,
        payment_method: m.$('#spVia') ? m.$('#spVia').value : 'Tunai',
        address: (b.deliv && b.deliv.address) || null,
        notes: note || null,
      });
      DB.saveBooking(b);
      DB.audit({ type: amt ? 'keuangan' : 'layanan', action: `Memperbarui nota layanan ${NO(b)} (${b.customer.name})${amt ? ` · dibayar ${rupiah(amt)}` : ''}`, ref: b.id, changes });
      DB.notify(b.customer.email, 'Nota layanan diperbarui', `${Svc.ongkirText(b).replace(/^o/, 'O')} ${NO(b)}: ${rupiah(c.ong)}. Total layanan ${rupiah(c.total)}.`, 'pesanan');
      m.close(); refreshShell();
      svcNotaSent(DB.booking(b.id), done);
    });
  }
  /* Setelah nota diperbarui: kirim ringkasan + link nota ke WhatsApp customer */
  async function svcNotaSent(b, done) {
    await Ann.Share.ensure(b); const bl = Svc.bill(b); const link = Ann.Share.link(b);
    const rin = [`${Svc.label(b)}${Svc.isTent(b) ? ` (${(b.deliv || {}).tents || 1} tenda)` : ''}`,
      ...(Svc.isTent(b) ? [`Jasa: ${rupiah(bl.jasa)}`] : []), `${Svc.ongkirText(b).replace(/^o/, 'O')}: ${rupiah(bl.ongkir)}`, `Total layanan: ${rupiah(bl.total)}${bl.due ? ` · sisa ${rupiah(bl.due)} dibayar ${Svc.delivers(b) ? 'saat barang diantar' : 'ke admin'}` : ' · lunas'}`,
      Svc.brief(b)].filter(Boolean).join('\n');
    const txt = DB.waText('svc_nota', { nama: b.customer.name || 'Kak', nama_depan: (b.customer.name || 'Kak').split(' ')[0], no_nota: NO(b), rincian: rin, link_nota: link });
    const m = modal({ title: `Nota ${NO(b)} diperbarui`, body: `<div class="notice green" style="margin-bottom:12px"><i class="fa-solid fa-circle-check"></i><div>Total layanan <b>${rupiah(bl.total)}</b> · dibayar ${rupiah(bl.paid)}${bl.due ? ` · sisa <b>${rupiah(bl.due)}</b>` : ' · <b>lunas</b>'}</div></div>
      <p class="muted" style="font-size:13px;margin:0">Kabari customer bahwa nota layanannya sudah diperbarui. Isi pesan bisa diperiksa & diedit sebelum dikirim.</p>`,
      foot: `<a class="btn btn-light" href="${url('invoice?id=' + b.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-receipt"></i> Lihat nota</a><button type="button" class="btn btn-wa" id="svcWa"><i class="fa-brands fa-whatsapp"></i> Kirim nota ke customer</button><button class="btn btn-primary" data-close>Selesai</button>` });
    m.$('#svcWa').addEventListener('click', () => UI.waCompose({ title: `Kirim nota layanan · ${NO(b)}`, text: txt, phone: b.customer.phone, waLabel: `Kirim ke ${esc((b.customer.name || 'customer').split(' ')[0])}`, tplKey: 'svc_nota' }));
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) done && done(); });
  }

  /* ====================== Laundry (staff) ====================== */
  const LD_FLOW = Laundry.FLOW;
  const ldItems = (o) => o.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
  /* Struk laundry gaya kasir laundry pada umumnya: tgl terima, estimasi selesai, rincian per item, status bayar,
     ketentuan (diatur Owner), kolom tanggal ambil & paraf. Kertas thermal 58/80 mm. */
  function ldStruk(o, mm) { return UI.ldStruk(o, mm); }
  /* Pesan WhatsApp laundry mengikuti status saat ini, beserta nota (rincian barang, total, status bayar) */
  const hariTgl = (iso) => { const x = new Date(String(iso).slice(0, 10) + 'T00:00:00'); return `${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][x.getDay()]}, ${D.fmtDate(iso, true)}`; };
  function ldNotaText(o) {
    const total = Laundry.total(o), paid = Laundry.paid(o);
    return [`*NOTA LAUNDRY ${o.no}*`, `Tanggal terima: ${D.fmtDate(o.createdAt, true)}`, `Estimasi selesai: ${hariTgl(Laundry.est(o))}`,
      ...o.items.map((i) => `• ${i.qty}× ${i.name} = ${rupiah(i.qty * i.price)}`), ...(o.discount ? [`${o.discountReason ? 'Diskon ' + o.discountReason : 'Diskon'}: −${rupiah(o.discount)}`] : []),
      `*Total: ${rupiah(total)}*`, paid >= total ? 'Status bayar: LUNAS' : paid ? `Dibayar ${rupiah(paid)} · sisa ${rupiah(total - paid)} (dibayar saat ambil)` : `Dibayar saat pengambilan: ${rupiah(total)}`].join('\n');
  }
  /* Pesan laundry dari template per status (Konfigurasi → Template Pesan WhatsApp) */
  function ldVars(o, link) {
    const total = Laundry.total(o), paid = Laundry.paid(o); const nm = o.customer.name || 'Kak';
    return { nama: nm, nama_depan: nm.split(' ')[0], no_nota: o.no, tanggal: D.fmtDate(o.createdAt, true), estimasi: hariTgl(Laundry.est(o)), rincian: ldNotaText(o),
      total: rupiah(total), dibayar: rupiah(paid), sisa: rupiah(Math.max(0, total - paid)), link_nota: link || '' };
  }
  const ldKey = (o) => (DB.WA_TPL.some((x) => x.key === 'ld_' + o.status) ? 'ld_' + o.status : 'ld_diterima');
  function ldWaText(o, link) { return DB.waText(ldKey(o), ldVars(o, link)).replace(/\n?Nota digital: *$/m, ''); }
  async function ldLink(o) { const s = await Laundry.share(o); return s && s.short ? s.short : new URL(url('invoice?id=' + encodeURIComponent(o.id) + '&s=' + s), location.href).href; }
  function ldWa(o) { return UI.waLink(ldWaText(o), o.customer.phone); }
  /* Kabari customer laundry: gambar nota laundry + pesan template (bisa diedit). onSent dipanggil setelah WhatsApp dibuka. */
  async function ldContact(o, opts = {}) {
    if (!o) return;
    const cv = await ldNotaCanvas(o); const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const text = ldWaText(o, await ldLink(o));
    return UI.waCompose({ title: opts.title || `Hubungi customer · ${o.no}`, note: opts.note, blob, name: `nota-laundry-${String(o.no).replace(/\//g, '_')}.png`, text, phone: o.customer.phone,
      waLabel: `Hubungi ${esc((o.customer.name || 'customer').split(' ')[0])}`, tplKey: ldKey(o),
      onSent: (how) => { const x = DB.laundryOrder(o.id); if (x) { x.history = x.history || []; x.history.push({ at: D.nowStamp(), text: `${opts.logText || 'Customer dihubungi via WhatsApp + nota digital'}${how ? ' · ' + how : ''} oleh ${me.name}` }); if (opts.patch) Object.assign(x, opts.patch()); DB.saveLaundry(x); } opts.onSent && opts.onSent(); } });
  }
  /* Laundry SIAP DIAMBIL: staff WAJIB mengabari customer via WhatsApp (pesan + nota). Tidak perlu cetak struk di tahap ini. */
  function ldNotify(o, done) {
    if (o) Api.try('POST', `api/admin/laundry/${o.order_code || o.no || o.id}/notify`, {});
    let sent = false;
    Promise.resolve(ldContact(DB.laundryOrder(o.id), { title: `Kabari siap diambil · ${o.no}`, logText: 'Customer dikabari via WhatsApp (siap diambil)', patch: () => ({ notifiedReady: D.nowStamp() }),
      note: '<b>Cucian sudah selesai.</b> Wajib kabari customer bahwa laundry-nya siap diambil.', onSent: () => { sent = true; } })).then((cm) => {
      if (!cm || !cm.el) { done && done(); return; }
      const obs = new MutationObserver(() => { if (document.body.contains(cm.el)) return; obs.disconnect();
        if (sent) toast('Customer sudah dikabari.'); else toast(`${o.no} belum dikabari. Tetap muncul di Dashboard sampai pesan dikirim.`, 'err');
        done && done(); });
      obs.observe(document.body, { childList: true });
    });
  }
  /* Laundry diambil customer:
     - sudah lunas → langsung selesai, tanpa cetak struk
     - belum lunas → terima pelunasan dulu, lalu WAJIB cetak struk pelunasan */
  function ldPickup(o, done) {
    if (Laundry.paid(o) >= Laundry.total(o)) { ldAdvance(o, 'selesai', done); return; }
    ldPay(o, () => {
      const x = DB.laundryOrder(o.id); if (Laundry.paid(x) < Laundry.total(x)) { toast('Masih ada sisa tagihan. Laundry belum bisa ditandai diambil.', 'err'); done && done(); return; }
      ldAdvance(x, 'selesai'); let printed = false;
      const m = modal({ title: `${x.no}: Lunas & diambil`, locked: true, body: `
        <div class="notice green" style="margin-bottom:12px"><i class="fa-solid fa-circle-check"></i><div>Pelunasan ${rupiah(Laundry.paid(x))} tercatat dan laundry ditandai <b>diambil</b>.</div></div>
        <p style="font-size:13.5px"><b>Wajib cetak struk pelunasan</b> dan berikan ke customer sebagai bukti pembayaran.</p>`,
        foot: `<button class="btn btn-primary" id="lpPrint"><i class="fa-solid fa-print"></i> Cetak struk</button><button class="btn btn-light" id="lpDone" disabled>Selesai</button>` });
      m.$('#lpPrint').addEventListener('click', () => { ldStruk(DB.laundryOrder(x.id)); printed = true; m.$('#lpDone').disabled = false; });
      m.$('#lpDone').addEventListener('click', () => { if (!printed) return; m.close(); done && done(); });
    }, true);
  }
  function ldPay(o, done, pickup) {
    const due = Math.max(0, Laundry.total(o) - Laundry.paid(o));
    const m = modal({ title: `${pickup ? 'Pelunasan saat pengambilan' : 'Terima pembayaran'} · ${o.no}`, body: `<div class="kv"><span>Sisa tagihan</span><strong>${rupiah(due)}</strong></div>
      <div class="field" style="margin-top:10px"><label>Jumlah dibayar (Rp)</label><input class="input" type="number" id="lpAmt" value="${due}"></div>
      <div class="field"><label>Metode</label><select class="select" id="lpVia">${['Tunai', 'Transfer', 'QRIS'].map((x) => `<option>${x}</option>`).join('')}</select></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="lpOk"><i class="fa-solid fa-check"></i> Simpan</button>' });
    m.$('#lpOk').addEventListener('click', () => {
      const amt = +String(m.$('#lpAmt').value).replace(/[^\d]/g, '') || 0; if (!amt) { toast('Isi jumlah pembayaran.', 'err'); return; }
      const via = 'Kasir · ' + m.$('#lpVia').value; const at = D.nowStamp();
      o.payments = o.payments || []; o.payments.push({ at, amount: amt, type: Laundry.paid(o) + amt >= Laundry.total(o) ? 'Lunas' : 'Sebagian', via });
      o.paymentStatus = Laundry.paid(o) >= Laundry.total(o) ? 'paid' : 'unpaid';
      o.history.push({ at, text: `Pembayaran ${rupiah(amt)} (${via}) dicatat oleh ${me.name}` });
      Api.try('POST', `api/admin/laundry/${o.order_code || o.no || o.id}/bayar`, { amount: amt, payment_method: S.method });
      DB.saveLaundry(o);
      DB.audit({ type: 'laundry', action: `Pembayaran laundry ${o.no} (${o.customer.name}) ${rupiah(amt)} · ${via}`, ref: o.id, changes: [{ field: 'Jumlah', from: '', to: rupiah(amt) }, { field: 'Lini usaha', from: '', to: 'Rental' }] });
      m.close(); toast('Pembayaran laundry tercatat di Keuangan (Rental).'); done && done();
    });
  }
  function ldAdvance(o, to, done) {
    const from = o.status; o.status = to; const at = D.nowStamp(); if (to === 'selesai') o.pickedAt = at; if (to === 'siap') o.readyAt = at;
    o.history.push({ at, text: `${(STATUS.laundry[to] || {}).label || to} · ${me.name}` });
    Api.try('POST', `api/admin/laundry/${o.order_code || o.no || o.id}/status`, { status: to });
    DB.saveLaundry(o);
    DB.audit({ type: 'laundry', action: `Status laundry ${o.no} (${o.customer.name}): ${(STATUS.laundry[from] || {}).label} → ${(STATUS.laundry[to] || {}).label}`, ref: o.id, changes: [{ field: 'Status', from: (STATUS.laundry[from] || {}).label, to: (STATUS.laundry[to] || {}).label }] });
    toast(`${o.no}: ${(STATUS.laundry[to] || {}).label}.`); refreshShell();
    if (to === 'siap') ldNotify(DB.laundryOrder(o.id), done); else if (done) done();
  }
  /* Nota digital laundry: pratinjau nota seperti invoice sewa, salin/unduh gambar, lalu kirim pesan WA berisi tautan nota. */
  /* Gambar nota laundry (PNG): gaya sama dengan nota booking / invoice di website (logo, stempel, QR, tabel, ringkasan, riwayat, ketentuan) */
  const ldNotaCanvas = (o) => UI.ldNotaCanvas(o); /* dipindah ke ui.js agar bisa dipakai halaman invoice publik (Unduh PDF) */

  async function ldNota(o) { return ldContact(o); }
  function laundryModal(id, done) {
    const o = DB.laundryOrder(id); if (!o) { toast('Data laundry tidak ditemukan.', 'err'); return; }
    const total = Laundry.total(o), paid = Laundry.paid(o); const nx = LD_FLOW[o.status];
    const live = !['selesai', 'dibatalkan'].includes(o.status);
    const m = modal({ title: `Laundry ${o.no}`, size: 'lg', body: `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pill('laundry', o.status)} ${pill('payment', paid >= total ? 'paid' : 'unpaid')}</div>
      <div class="kv-grid">
        <div class="kv"><span>Customer</span><strong>${esc(o.customer.name)}</strong></div>
        <div class="kv"><span>Telepon</span><a href="${custLink(o.customer)}" target="_blank" rel="noopener noreferrer" style="color:var(--g700);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ${esc(o.customer.phone)}</a></div>
        <div class="kv"><span>Diterima</span><span>${D.fmtDateTime(o.createdAt)} · ${esc(o.by || '-')}</span></div>
        <div class="kv"><span>Estimasi selesai</span><span><b>${D.fmtDate(Laundry.est(o), true)}</b>${o.status !== 'selesai' && o.status !== 'dibatalkan' && Laundry.est(o) < D.today() ? ' <span class="pill red plain">lewat estimasi</span>' : ''}</span></div>
        ${o.pickedAt ? `<div class="kv"><span>Diambil</span><span>${D.fmtDateTime(o.pickedAt)}</span></div>` : ''}
      </div>
      ${o.address ? `<p style="font-size:13.5px;margin-top:6px"><span class="muted">Alamat:</span> ${esc(o.address)}</p>` : ''}
      ${o.notes ? `<p style="font-size:13.5px"><span class="muted">Catatan:</span> ${esc(o.notes)}</p>` : ''}
      <div class="mini-sec"><h4>Barang</h4>${o.items.map((i) => `<div class="kv"><span>${i.qty}× ${esc(i.name)} <small class="muted">(${esc(i.cat || '')})</small></span><span>${rupiah(i.qty * i.price)}</span></div>`).join('')}
        ${o.ongkir ? `<div class="kv"><span>Ongkir</span><span>${rupiah(o.ongkir)}</span></div>` : ''}
        ${o.discount ? `<div class="kv"><span>${esc(o.discountReason ? 'Diskon · ' + o.discountReason : 'Diskon')}</span><span style="color:var(--g700)">− ${rupiah(o.discount)}</span></div>` : ''}
        <div class="kv total"><span>Total</span><span>${rupiah(total)}</span></div>
        <div class="kv hl"><span>Dibayar</span><span>${rupiah(paid)}</span></div>
        ${total - paid > 0 ? `<div class="kv"><span>Sisa</span><strong style="color:var(--orange)">${rupiah(total - paid)}</strong></div>` : ''}</div>
      <details class="mini-sec hist-fold" open><summary><h4>Riwayat (${(o.history || []).length})</h4></summary><ul class="timeline">${(o.history || []).slice().reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul></details>`,
      foot: `<button class="btn btn-light" data-ld="struk"><i class="fa-solid fa-print"></i> Struk</button><a class="btn btn-primary" href="${url('invoice?id=' + encodeURIComponent(o.id))}"><i class="fa-solid fa-file-invoice"></i> Nota</a><button class="btn btn-wa" data-ld="contact"><i class="fa-brands fa-whatsapp"></i> Hubungi customer</button>
        ${live && total - paid > 0 ? '<button class="btn btn-gold" data-ld="pay"><i class="fa-solid fa-cash-register"></i> Terima pembayaran</button>' : ''}
        ${live && nx ? `<button class="btn btn-primary" data-ld="next"><i class="fa-solid ${nx[1]}"></i> ${nx[2]}</button>` : ''}
        ${live && o.status === 'diterima' ? '<button class="btn btn-danger" data-ld="cancel"><i class="fa-solid fa-ban"></i> Batalkan</button>' : ''}` });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ld]'); if (!b) return; const act = b.dataset.ld;
      const again = () => { done && done(); laundryModal(id, done); };
      if (act === 'struk') { ldStruk(DB.laundryOrder(id)); return; }
      if (act === 'contact') { ldNota(DB.laundryOrder(id)); return; }
      m.close();
      if (act === 'pay') ldPay(DB.laundryOrder(id), again);
      if (act === 'next') { /* popup detail ditutup, daftar diperbarui — tidak membuka detail lagi */
        const cur = DB.laundryOrder(id);
        if (nx[0] === 'selesai') ldPickup(cur, done); else ldAdvance(cur, nx[0], done);
      }
      if (act === 'cancel') { const r = await confirmBox({ title: `Batalkan ${o.no}?`, text: 'Laundry dibatalkan dan tidak dihitung lagi.', ok: 'Batalkan', danger: true, input: { label: 'Alasan', required: true, error: 'Tulis alasan.' } }); if (r) { const cur = DB.laundryOrder(id); cur.cancelReason = r; ldAdvance(cur, 'dibatalkan', done); } else again(); }
    });
  }

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
    if (act === 'verify') { if (await confirmBox({ title: `Konfirmasi ${NO(b)}?`, text: `DP ${rupiah(b.dp)} dari ${b.customer.name} sudah masuk ke rekening toko.`, ok: 'Ya, konfirmasi' })) { BK.verifyDP(b); fin(); } }
    if (act === 'reject') { if (await BK.rejectProof(b)) fin(); }
    if (act === 'pickup') BK.pickup(b, fin);
    if (act === 'return') BK.processReturn(b, fin);
    if (act === 'cancel') BK.adminCancel(b, fin);
    if (act === 'refund') { if (await BK.refund(b)) fin(); }
    if (act === 'detail') bookingModal(id, done);
    if (act === 'wa') window.open(custLink(b.customer), '_blank');
    if (act === 'swap') BK.storeChange(b, fin);
    if (act === 'extend') BK.extend(b, fin);
    if (act === 'svcpay') { svcPay(b, fin); return; }
    if (act === 'settle') { settleModal(id, fin); return; }
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
            <div class="rq-item to">${img(c.toId)}<span><small>Diganti menjadi</small><b>${c.qty}× ${esc(c.toName)}</b>${pd ? `<em>${rupiah(pd.rent)}/malam${c.toSize ? ` · ukuran ${esc(String(c.toSize).replace(/\s*\(.*\)/, ''))}` : ''}</em>` : ''}</span></div></div>
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
    const CI = UI.changeInfo(b); const dpPaid = (b.payments || []).filter((p) => p.type === 'DP').reduce((a, p) => a + (+p.amount || 0), 0); const mates = groupMates(b);
    const m = modal({ title: `Booking ${NO(b)}`, size: 'lg', body: `${custFlag(b.customer)}
      ${pendExt.length ? `<div class="notice" style="margin-bottom:12px"><i class="fa-solid fa-calendar-plus"></i><div>Customer mengajukan perpanjangan sampai <strong>${D.fmtDate(pendExt[0].to, true)}</strong> (+${pendExt[0].days} hari, ${rupiah(pendExt[0].cost)}). <a href="${A('permintaan?tab=extend')}" style="font-weight:700;text-decoration:underline">Tinjau</a></div></div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pill('rental', b.status)} ${pill('payment', b.paymentStatus)}${b.group ? `<span class="grp-tag" style="margin:0"><i class="fa-solid fa-link"></i> Pesanan gabungan${mates.length ? ' · terkait ' + mates.map((x) => `${NO(x)} (${esc(itemsText(x))}, kembali ${D.fmtDate(x.end)})`).join(', ') : ''}</span>` : ''}</div>
      <div class="kv-grid">
        <div class="kv"><span>Customer</span><strong>${esc(b.customer.name)}</strong></div>
        <div class="kv"><span>Telepon</span><a href="${custLink(b.customer)}" target="_blank" rel="noopener noreferrer" style="color:var(--g700);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ${esc(b.customer.phone)}</a></div>
        <div class="kv"><span>Periode</span><span>${D.fmtRange(b.start, b.end)} (${b.days} malam)</span></div>
        <div class="kv"><span>Pengambilan</span><span>${svcTag(b, true)}</span></div>
        <div class="kv"><span>Metode bayar</span><span>${esc(b.method || '-')}</span></div>
        <div class="kv"><span>Dibuat</span><span>${D.fmtDateTime(b.createdAt)}</span></div>
      </div>
      ${svcSection(b)}
      
      ${b.notes ? `<p style="font-size:13.5px"><span class="muted">Catatan:</span> ${esc(b.notes)}</p>` : ''}
      <div class="mini-sec"><h4>Barang</h4><div class="adm-items">${b.items.map((i) => `<div class="it"><img src="${asset(i.img)}" alt=""><div class="nm"><strong>${esc(i.name)}</strong><br><small class="muted">${i.qty} × ${rupiah(Rules.lineUnit(i, b.days))} · ${esc(Rules.tierLabel(i.tiers || { d1: i.pricePerDay }, b.days))}</small>${(i.units || []).length ? `<div class="unit-tags">${i.units.map((u) => `<span><i class="fa-solid fa-barcode"></i> ${u.code}</span>`).join('')}</div>` : ''}</div><strong>${rupiah(i.qty * Rules.lineUnit(i, b.days))}</strong></div>`).join('')}</div></div>
      <div class="mini-sec" style="max-width:360px;margin-left:auto">
        ${CI.ok.length ? `<div class="kv"><span>Total awal</span><span>${rupiah(CI.base)}</span></div><div class="kv"><span>Tambahan ganti barang</span><span style="color:#9a6508;font-weight:700">${CI.add >= 0 ? '+' : '−'} ${rupiah(Math.abs(CI.add))}</span></div>` : ''}
        <div class="kv"><span>Subtotal${CI.ok.length ? ' (setelah ganti barang)' : ''}</span><span>${rupiah(b.subtotal)}</span></div>
        ${b.discount ? `<div class="kv"><span>${esc(DB.discLabel(b.discount))}</span><span style="color:var(--g700)">− ${rupiah(b.discount.amount)}</span></div>` : ''}
        ${b.fine ? `<div class="kv"><span>Denda</span><span>${rupiah(b.fine)}</span></div>` : ''}
        <div class="kv total"><span>${CI.ok.length ? 'Total baru' : 'Total'}</span><span>${rupiah(b.total)}</span></div>
        ${dpPaid ? `<div class="kv"><span>DP sudah dibayar</span><span>${rupiah(dpPaid)}</span></div>` : `<div class="kv"><span>DP ${DB.settings().dpPercent}% yang harus dibayar</span><span>${rupiah(b.dp)}</span></div>`}
        <div class="kv hl"><span>Dibayar</span><span>${rupiah(paid)}</span></div>
        ${(b.refunds || []).length ? `<div class="kv"><span>Refund</span><span>− ${rupiah(b.refunds.reduce((s, r) => s + r.amount, 0))}</span></div>` : ''}
        ${b.status !== 'dibatalkan' ? `<div class="kv"><span>Sisa</span><strong>${rupiah(sisa(b))}</strong></div>` : ''}
        ${b.deposit ? `<div class="kv"><span>Jaminan</span><span>${rupiah(b.deposit)} · ${b.depositOut ? `dikembalikan ${rupiah(b.depositOut.amount)}${b.depositOut.deducted ? ` (dipotong ${rupiah(b.depositOut.deducted)})` : ''}` : b.depositIn ? '<b style="color:#9a6508">dipegang toko</b>' : 'dibayar saat ambil'}</span></div>` : ''}
      </div>
      ${b.proof ? `<div class="mini-sec"><h4>Bukti pembayaran</h4><img class="proof-img" src="${asset(b.proof)}" alt="Bukti pembayaran"></div>` : b.status === 'menunggu_konfirmasi' ? '<div class="mini-sec"><h4>Bukti pembayaran</h4><p class="muted" style="font-size:13px">Bukti diunggah customer (contoh data demo tanpa gambar).</p></div>' : ''}
      ${pend.length ? `<div class="notice" style="margin-top:14px"><i class="fa-solid fa-arrows-rotate"></i><div>Ada ${pend.length} permintaan ganti barang menunggu. <a href="permintaan" style="font-weight:700;text-decoration:underline">Tinjau</a></div></div>` : ''}
      ${b.cancel ? `<div class="notice red" style="margin-top:14px"><i class="fa-solid fa-ban"></i><div>Dibatalkan ${D.fmtDateTime(b.cancel.at)} — ${esc(b.cancel.reason)}. Refund: ${({ menunggu: 'menunggu diproses', selesai: 'sudah dikembalikan', hangus: 'DP hangus', tidak_perlu: 'tidak ada' })[b.cancel.refundStatus] || '-'}</div></div>` : ''}
      ${b.out ? outRetHtml(b, 'out') : ''}
      ${b.ret ? outRetHtml(b, 'ret') : ''}
      ${reqSection(b)}
      <details class="mini-sec hist-fold"><summary><h4>Riwayat booking (${(b.history || []).length})</h4></summary><ul class="timeline">${(b.history || []).slice().reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul></details>`,
      foot: `<a class="btn btn-light" href="${url('invoice?id=' + b.id)}"><i class="fa-solid fa-receipt"></i> Nota</a>${sisa(b) && ['dikonfirmasi', 'disewa', 'selesai'].includes(b.status) ? `<button type="button" class="btn btn-primary" data-bsettle><i class="fa-solid fa-cash-register"></i> Pelunasan ${rupiah(sisa(b))}</button><button type="button" class="btn btn-light" data-bdue><i class="fa-brands fa-whatsapp"></i> Tagih sisa</button>` : ''}<button type="button" class="btn btn-light" data-bprint title="Struk thermal ${UI.receiptPaper()} mm"><i class="fa-solid fa-print"></i> Struk</button><button type="button" class="btn btn-wa" data-bcontact><i class="fa-brands fa-whatsapp"></i> Hubungi customer</button>${acts.map(([k, ic, l, c]) => `<button class="btn ${c}" data-bact="${k}"><i class="${/fa-brands/.test(ic) ? ic : 'fa-solid ' + ic}"></i> ${l}</button>`).join('')}` });
    m.$$('[data-bact]').forEach((btn) => btn.addEventListener('click', () => { m.close(); runBooking(btn.dataset.bact, id, done); }));
    m.$('[data-bprint]').addEventListener('click', () => UI.printStruk(DB.booking(id), 'rent'));
    if (m.$('[data-bsettle]')) m.$('[data-bsettle]').addEventListener('click', () => { m.close(); settleModal(id, done); });
    if (m.$('[data-bdue]')) m.$('[data-bdue]').addEventListener('click', () => contactDue(DB.booking(id)));
    m.$('[data-bcontact]').addEventListener('click', async (e) => { const bt = e.currentTarget; bt.disabled = true; try { await contactBooking(DB.booking(id)); } finally { bt.disabled = false; } });
    m.$$('[data-svcact]').forEach((btn) => btn.addEventListener('click', () => { m.close(); (btn.dataset.svcact === 'edit' ? svcEdit : svcPay)(DB.booking(id), () => { refreshShell(); done && done(); bookingModal(id, done); }); }));
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
    if (s.paymentStatus === 'paid' && SALE_FLOW[s.status]) { const f = SALE_FLOW[s.status]; const dl = saleDeliv(s); a.push(['snext', dl && s.status === 'dikemas' ? 'fa-truck-fast' : f[1], dl ? { dikemas: 'Tandai siap diantar', siap_diambil: 'Sudah diterima customer' }[s.status] || f[2] : f[2], 'btn-primary']); }
    if (['menunggu_pembayaran', 'diproses'].includes(s.status)) a.push(['scancel', 'fa-ban', 'Batalkan', 'btn-danger']);
    return a;
  }
  async function runSale(act, id, done) {
    const s = DB.sale(id); if (!s) return;
    const fin = () => { refreshShell(); done && done(); };
    if (act === 'sdetail') return saleModal(id, done);
    if (act === 'sship') return saleShip(s, done);
    if (act === 'spay') {
      if (!(await confirmBox({ title: `Verifikasi pembayaran ${NO(s)}?`, text: `${rupiah(s.total)} dari ${s.customer.name} sudah diterima.`, ok: 'Verifikasi' }))) return;
      const short = s.items.filter((i) => DB.saleableStock(DB.product(i.productId), i.size) < i.qty);
      if (short.length) { toast(`Stok tidak cukup: ${short.map((i) => i.name).join(', ')}. Tambah stok dulu di Data Barang.`, 'err'); return; }
      DB.sellStock(s.items, 1);
      s.payments.push({ at: D.nowStamp(), amount: s.total, type: 'Pembayaran' }); s.paymentStatus = 'paid'; s.status = 'diproses';
      log(s, 'Pembayaran diverifikasi, pesanan diproses', 'penjualan', `Memverifikasi pembayaran ${NO(s)} (${rupiah(s.total)})`, chg('Status pesanan', sl('menunggu_pembayaran'), sl('diproses'))); DB.saveSale(s);
      DB.notify(s.customer.email, 'Pembayaran diterima', `Pesanan ${NO(s)} sedang diproses.`, 'pesanan?tab=beli');
      toast('Pembayaran diverifikasi.'); fin();
    }
    if (act === 'snext') {
      const [next] = SALE_FLOW[s.status];
      const from = s.status; s.status = next;
      const txt = { dikemas: 'Pesanan dikemas', siap_diambil: saleDeliv(s) ? 'Pesanan siap diantar' : 'Pesanan siap diambil di toko', selesai: saleDeliv(s) ? 'Barang sudah diantar, pesanan selesai' : 'Barang sudah diambil, pesanan selesai' }[next];
      log(s, txt, 'penjualan', `Mengubah status pesanan ${NO(s)} menjadi ${sl(next)}`, chg('Status pesanan', sl(from), sl(next))); DB.saveSale(s);
      DB.notify(s.customer.email, txt, `${NO(s)}: ${txt.toLowerCase()}.${next === 'selesai' ? ' Beri ulasan untuk barang yang kamu beli, yuk!' : ''}`, next === 'selesai' ? `pesanan?tab=riwayat&review=${s.id}` : 'pesanan?tab=beli');
      toast(`${NO(s)}: ${STATUS.sale[next].label}.`); fin();
    }
    if (act === 'scancel') {
      const r = await confirmBox({ title: `Batalkan ${NO(s)}?`, text: s.paymentStatus === 'paid' ? 'Pembayaran customer perlu dikembalikan secara manual.' : 'Pesanan akan dibatalkan.', ok: 'Batalkan pesanan', danger: true, input: { label: 'Alasan pembatalan' } });
      if (r === false) return;
      const from = s.status; if (s.paymentStatus === 'paid') DB.sellStock(s.items, -1); s.status = 'dibatalkan'; log(s, `Pesanan dibatalkan admin${val(r) ? ': ' + val(r) : ''}`, 'pembatalan', `Membatalkan pesanan ${NO(s)}${val(r) ? `: ${val(r)}` : ''}`, chg('Status pesanan', sl(from), sl('dibatalkan'))); DB.saveSale(s);
      DB.notify(s.customer.email, 'Pesanan dibatalkan', `${NO(s)} dibatalkan oleh admin.`, 'pesanan?tab=beli');
      toast('Pesanan dibatalkan.'); fin();
    }
  }
  /* ====================== Penjualan: diantar ke tempat ======================
     Alur sama dengan sewa: customer pilih "Diantar ke tempat" saat checkout, admin menghubungi untuk ongkir,
     lalu mengisi ongkir & pembayaran di nota. Ongkir dicatat di s.deliv.ongkir dan s.svc (kind 'ongkir'). */
  const saleDeliv = (s) => Svc.isSaleDeliv(s);
  function saleTag(s) { return saleDeliv(s) ? '<span class="svc-tag antar"><i class="fa-solid fa-truck-fast"></i> Diantar</span>' : ''; }
  /* Satu baris untuk daftar: badge + alamat + status ongkir */
  function saleLine(s) {
    if (!saleDeliv(s)) return '';
    const bl = Svc.bill(s);
    return `<small class="svc-line">${saleTag(s)} ${esc((s.deliv || {}).address || '-')}${bl.ongkirSet ? ` · ongkir ${rupiah(bl.ongkir)}` : ' · <b style="color:#9a6508">ongkir belum diinput</b>'}</small>`;
  }
  /* Sel pengiriman untuk daftar penjualan (gaya sama dengan sel layanan sewa): metode, jadwal/resi, pengantar, status ongkir */
  function saleShipCell(s) {
    if (!saleDeliv(s)) return '';
    const S = Svc, d = s.deliv || {}, bl = S.bill(s), m = S.shipMode(s), live = !['selesai', 'dibatalkan'].includes(s.status);
    const top = m === 'ekspedisi' ? `${esc(d.exp || 'Ekspedisi')}${d.expSvc ? ' · ' + esc(d.expSvc) : ''}` : m === 'kurir' ? 'Kurir toko' : 'Diantar';
    const ic = m === 'ekspedisi' ? 'fa-truck-field' : 'fa-truck-fast';
    const when = m === 'kurir' ? (d.date ? `Antar ${D.fmtDate(d.date).replace(/ \d{4}$/, '')}${d.time ? ' ' + S.fmtT(d.time) : ''}` : 'Jadwal antar belum diatur')
      : m === 'ekspedisi' ? [d.shipDate ? `Kirim ${D.fmtDate(d.shipDate).replace(/ \d{4}$/, '')}` : 'Belum dikirim', d.eta ? `tiba ±${D.fmtDate(d.eta).replace(/ \d{4}$/, '')}` : ''].filter(Boolean).join(' → ') : 'Cara pengiriman belum diatur';
    const who = m === 'kurir' ? (d.courier ? `<small class="sv-who">Pengantar: <b>${esc(d.courier)}</b>${d.vehicle ? ' · ' + esc(d.vehicle) : ''}</small>` : '<small class="sv-who">Pengantar: <b>belum dipilih</b></small>')
      : m === 'ekspedisi' ? `<small class="sv-who">Resi: <b>${d.resi ? esc(d.resi) : 'belum ada'}</b></small>` : '';
    const sh = m ? S.SHIP.STATUS[S.shipStatus(s)] : null;
    const live0 = !['selesai', 'dibatalkan'].includes(s.status) && s.paymentStatus === 'paid';
    const pay = s.status === 'dibatalkan' ? '' : !bl.ongkirSet ? (live0 ? `<button type="button" class="sv-b warn sv-click" data-act="sship" data-id="${s.id}" title="Isi ongkir"><i class="fa-solid fa-hourglass-half"></i> Ongkir belum disepakati · isi</button>` : '<span class="sv-b warn"><i class="fa-solid fa-hourglass-half"></i> Ongkir belum disepakati</span>')
      : bl.due > 0 ? `<span class="sv-b bad"><i class="fa-solid fa-circle-exclamation"></i> Belum dibayar ${rupiah(bl.due)}</span>` : '<span class="sv-b ok"><i class="fa-solid fa-circle-check"></i> Ongkir lunas</span>';
    return `<div class="sv-cell"><div class="sv-top"><span class="sv-k"><i class="fa-solid ${ic}"></i> ${top}</span>${bl.ongkirSet ? `<span class="sv-o">ongkir ${rupiah(bl.ongkir)}</span>` : ''}</div>
      <small class="sv-when">${when}</small>${who}
${pay}
      ${live && s.paymentStatus === 'paid' ? `<button type="button" class="btn btn-light btn-xs" data-act="sship" data-id="${s.id}" style="justify-self:start"><i class="fa-solid fa-truck-ramp-box"></i> ${m ? 'Ubah pengiriman & ongkir' : 'Atur pengiriman & ongkir'}</button>` : ''}</div>`;
  }
  /* Kolom pembayaran penjualan: belanja (total, dibayar, sisa) + ongkir bila diantar */
  function salePayCell(s) {
    if (s.status === 'dibatalkan') return `<div class="kv"><span>Total</span><b>${rupiah(s.total)}</b></div><small>Dibatalkan</small>`;
    const paid = (s.payments || []).reduce((a, p) => a + (+p.amount || 0), 0), sisa = Math.max(0, s.total - paid);
    let h = `<div class="kv"><span>Total belanja</span><b>${rupiah(s.total)}</b></div><div class="kv"><span>Dibayar</span><span>${rupiah(paid)}</span></div><div class="kv ${sisa ? 'due' : ''}"><span>Sisa belanja</span><span>${sisa ? rupiah(sisa) : 'Lunas'}</span></div>`;
    if (saleDeliv(s)) { const bl = Svc.bill(s); h += `<div class="kv lay"><span>Ongkir</span><span>${bl.ongkirSet ? rupiah(bl.ongkir) : 'menunggu admin'}</span></div>`; }
    return h;
  }
  function saleSvcSection(s) {
    if (!saleDeliv(s)) return '';
    const d = s.deliv || {}; const bl = Svc.bill(s); const live = !['selesai', 'dibatalkan'].includes(s.status); const rows = Svc.shipRows(s); const sh = Svc.shipMode(s) ? Svc.SHIP.STATUS[Svc.shipStatus(s)] : null;
    return `<div class="mini-sec"><h4>Diantar ke tempat ${sh ? `<span class="sv-b ${sh[1]}" style="margin-left:6px"><i class="fa-solid ${sh[2]}"></i> ${sh[0]}</span>` : ''}</h4><div class="svc-box">
      <div class="r"><i class="fa-solid fa-location-dot"></i><span>${esc(d.address || '-')}</span></div>
      <div class="r"><i class="fa-brands fa-whatsapp"></i><span>${d.waAt ? `Customer menghubungi admin ${D.fmtDateTime(d.waAt)}` : 'Customer belum menghubungi admin via WhatsApp'}</span></div>
      ${rows.length ? rows.map(([ic, l, v]) => `<div class="r"><i class="fa-solid ${ic}"></i><span><span class="muted">${esc(l)}:</span> <b>${esc(v)}</b></span></div>`).join('') : '<div class="r"><i class="fa-solid fa-truck-ramp-box"></i><span class="muted">Cara pengiriman (kurir toko / ekspedisi), pengantar, dan resi belum diatur.</span></div>'}
      <div class="svc-bill">
        <div class="kv"><span>Ongkir antar</span><span>${bl.ongkirSet ? rupiah(bl.ongkir) : '<b style="color:#9a6508">belum diinput</b>'}</span></div>
        <div class="kv hl"><span>Sudah dibayar</span><span>${rupiah(bl.paid)}</span></div>
        ${bl.ongkirSet ? `<div class="kv"><span>Sisa ongkir</span><strong style="color:${bl.due ? 'var(--orange)' : 'var(--g700)'}">${bl.due ? rupiah(bl.due) : 'Lunas'}</strong></div>` : ''}
      </div>
      ${live ? `<div class="acts"><button type="button" class="btn btn-primary btn-xs" data-ssvc="ship"><i class="fa-solid fa-truck-ramp-box"></i> ${Svc.shipMode(s) ? 'Ubah pengiriman' : 'Atur pengiriman'}</button></div>` : ''}
    </div></div>`;
  }
  /* Atur pengiriman: kurir toko (siapa yang antar) atau ekspedisi (nama, layanan, resi, berat, estimasi tiba, asuransi, penerima) */
  /* Atur pengiriman (revisi mitra): cukup 2 cara.
     - Via ekspedisi: pilih ekspedisi + No. resi
     - Dikirim langsung: nama staff + No. HP staff (ongkirnya pemasukan Penjualan)
     Penerima & tujuan terisi otomatis dari pesanan. Setelah disimpan, jendela WhatsApp ke customer langsung terbuka. */
  function saleShip(s, done) {
    const d = s.deliv || {}; const S = Svc; const H = S.SHIP;
    const staff = DB.staff().filter((u) => u.status !== 'nonaktif');
    let mode = S.shipMode(s) || 'ekspedisi', exp = H.EXPEDISI.includes(d.exp) ? d.exp : '';
    const rec = { name: d.recName || s.customer.name || '', phone: d.recPhone || s.customer.phone || '', addr: d.address || '-' };
    const m = modal({ title: `Atur pengiriman · ${NO(s)}`, body: `
      <div class="field"><label>Cara pengiriman</label><div class="seg seg-2" id="shMode"><button type="button" data-m="ekspedisi"><i class="fa-solid fa-truck-fast"></i> Via ekspedisi</button><button type="button" data-m="kurir"><i class="fa-solid fa-motorcycle"></i> Dikirim langsung (staff toko)</button></div></div>
      <div id="shExp"><div class="field"><label>Ekspedisi <span class="req">*</span></label><div class="exp-pick" id="shExpPick">${H.EXPEDISI.map((x) => `<button type="button" data-exp="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
        <div class="field"><label for="shResi">No. resi <span class="req">*</span></label><input class="input" id="shResi" value="${esc(d.resi || '')}" placeholder="Contoh: JP1234567890" autocomplete="off" style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.03em"></div></div>
      <div id="shKurir" class="grid-2"><div class="field"><label for="shCourier">Nama staff pengantar <span class="req">*</span></label><input class="input" id="shCourier" list="shStaff" value="${esc(d.courier || '')}" placeholder="Pilih / ketik nama staff"><datalist id="shStaff">${staff.map((u) => `<option value="${esc(u.name)}">`).join('')}</datalist></div>
        <div class="field"><label for="shCPhone">No. HP staff <span class="req">*</span></label><input class="input" id="shCPhone" inputmode="tel" value="${esc(d.courierPhone || '')}" placeholder="08xxxxxxxxxx"></div></div>
      <div class="ship-ong"><div class="ship-sec"><i class="fa-solid fa-money-bill-wave"></i> Ongkir <small>hasil kesepakatan dengan customer</small></div>
        <div class="grid-2"><div class="field"><label for="shOng">Ongkir (Rp)</label><input class="input" id="shOng" inputmode="numeric" data-rp value="${Svc.bill(s).ongkirSet ? Svc.bill(s).ongkir : ''}" placeholder="Kosongkan bila belum disepakati"></div>
        <div class="field"><label>Pembayaran ongkir</label><div class="seg" id="shPaid"><button type="button" data-p="0" class="${Svc.bill(s).due > 0 || !Svc.bill(s).ongkirSet ? 'active' : ''}">Belum dibayar</button><button type="button" data-p="1" class="${Svc.bill(s).ongkirSet && !Svc.bill(s).due ? 'active' : ''}">Sudah dibayar</button></div></div></div>
        <div id="shViaRow" class="stl-via" hidden style="margin:0 0 10px">${['Tunai', 'Transfer', 'QRIS'].map((k, i) => `<button type="button" data-shvia="${k}" class="${i === 1 ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      <div class="ship-auto"><div class="ship-sec"><i class="fa-solid fa-id-card"></i> Penerima &amp; tujuan <small>terisi otomatis dari pesanan</small></div>
        <div class="kv"><span>Penerima</span><strong>${esc(rec.name)}${rec.phone ? ' · ' + esc(rec.phone) : ''}</strong></div>
        <div class="kv"><span>Alamat lengkap</span><strong style="text-align:right">${esc(rec.addr)}</strong></div></div>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0"><i class="fa-brands fa-whatsapp" style="color:#25a35a"></i> Setelah disimpan, pesan WhatsApp ke customer langsung disiapkan (bisa diedit sebelum dikirim).</p>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="shOk"><i class="fa-solid fa-paper-plane"></i> Simpan &amp; kabari customer</button>' });
    const v = (id) => String((m.$(id) || {}).value || '').trim();
    let ongPaid = Svc.bill(s).ongkirSet && !Svc.bill(s).due, ongVia = 'Transfer';
    const syncPay = () => { m.$$('#shPaid [data-p]').forEach((b) => b.classList.toggle('active', (b.dataset.p === '1') === ongPaid)); const due = Math.max(0, (+String(m.$('#shOng').value).replace(/[^\d]/g, '') || 0) - Svc.paid(s)); m.$('#shViaRow').hidden = !ongPaid || !due; };
    m.$('#shPaid').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) { ongPaid = b.dataset.p === '1'; syncPay(); } });
    m.$('#shViaRow').addEventListener('click', (e) => { const b = e.target.closest('[data-shvia]'); if (b) { ongVia = b.dataset.shvia; m.$$('#shViaRow [data-shvia]').forEach((x) => x.classList.toggle('on', x === b)); } });
    m.$('#shOng').addEventListener('input', syncPay); syncPay();
    const sync = () => { m.$('#shKurir').hidden = mode !== 'kurir'; m.$('#shExp').hidden = mode !== 'ekspedisi';
      m.$$('#shMode [data-m]').forEach((b) => b.classList.toggle('active', b.dataset.m === mode)); m.$$('#shExpPick [data-exp]').forEach((b) => b.classList.toggle('on', b.dataset.exp === exp)); };
    m.$('#shMode').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; sync(); (mode === 'kurir' ? m.$('#shCourier') : m.$('#shResi')).focus(); } });
    m.$('#shExpPick').addEventListener('click', (e) => { const b = e.target.closest('[data-exp]'); if (b) { exp = b.dataset.exp; sync(); m.$('#shResi').focus(); } });
    /* pilih nama staff → No. HP terisi dari data staff */
    m.$('#shCourier').addEventListener('change', () => { const u = staff.find((x) => x.name.toLowerCase() === v('#shCourier').toLowerCase()); if (u && u.phone && !v('#shCPhone')) m.$('#shCPhone').value = u.phone; });
    sync();
    m.$('#shOk').addEventListener('click', async () => {
      if (mode === 'ekspedisi' && !exp) { toast('Pilih ekspedisi yang dipakai.', 'err'); return; }
      if (mode === 'ekspedisi' && v('#shResi').length < 6) { toast('Isi nomor resi dari ekspedisi.', 'err'); m.$('#shResi').focus(); return; }
      if (mode === 'kurir' && v('#shCourier').length < 2) { toast('Isi nama staff yang mengantar.', 'err'); m.$('#shCourier').focus(); return; }
      if (mode === 'kurir' && !UI.isPhone(v('#shCPhone'))) { toast('No. HP staff tidak valid. Contoh: 081234567890.', 'err'); m.$('#shCPhone').focus(); return; }
      const before = Svc.shipBrief(s); const at = D.nowStamp();
      const nd = { method: mode, ship: 'dikirim', recName: rec.name, recPhone: rec.phone, shipAt: at, shipBy: me.name, shipDate: D.today(), date: D.today(), time: '' };
      /* Ongkir & pembayarannya (satu jendela dengan pengiriman) */
      const ongRaw = String(m.$('#shOng').value).replace(/[^\d]/g, ''); const before0 = Svc.bill(s);
      if (ongRaw !== '') { nd.ongkir = +ongRaw; nd.notaAt = at; nd.notaBy = me.name; }
      const ongDue = ongRaw !== '' ? Math.max(0, +ongRaw - Svc.paid(s)) : 0;
      if (ongPaid && ongDue > 0) { s.svc = s.svc || []; s.svc.push({ id: 'SVC-' + Date.now().toString(36).toUpperCase() + 'O' + s.svc.length, kind: 'ongkir', amount: ongDue, at, by: me.name, via: 'Kasir · ' + ongVia, note: 'Ongkir ' + (mode === 'kurir' ? 'kurir toko' : 'ekspedisi') }); }
      const ongLog = ongRaw !== '' && (!before0.ongkirSet || before0.ongkir !== +ongRaw) ? ` · ongkir ${rupiah(+ongRaw)}` : '';
      if (mode === 'kurir') Object.assign(nd, { courier: v('#shCourier'), courierPhone: v('#shCPhone'), exp: '', resi: '' });
      else Object.assign(nd, { exp, resi: v('#shResi').toUpperCase(), courier: '', courierPhone: '' });
      s.deliv = Object.assign({}, s.deliv || {}, nd);
      const brief = Svc.shipBrief(s);
      s.history = s.history || []; s.history.push({ at, text: `Pengiriman diatur oleh ${me.name}: ${brief}${ongLog}${ongPaid && ongDue > 0 ? ` · ongkir dibayar ${rupiah(ongDue)} (${ongVia})` : ''}` });
      DB.saveSale(s);
      DB.audit({ type: 'layanan', action: `Mengatur pengiriman ${NO(s)} (${s.customer.name}): ${brief}`, ref: s.id, changes: [{ field: 'Pengiriman', from: before || '—', to: brief }] });
      DB.notify(s.customer.email, 'Pesananmu sedang dikirim', `${NO(s)}: ${brief}.`, 'pesanan?tab=beli');
      m.close(); refreshShell(); done && done();
      /* Kabari customer: jendela kirim WhatsApp langsung terbuka dengan template pengiriman */
      const x = DB.sale(s.id); await Ann.Share.ensure(x);
      const key = mode === 'kurir' ? 'ship_kurir' : 'ship_exp';
      const text = DB.waText(key, Object.assign(saleVars(x), { ekspedisi: exp, resi: nd.resi || '', pengantar: nd.courier || '', hp_pengantar: nd.courierPhone || '', penerima: [rec.name, rec.phone].filter(Boolean).join(' · '), alamat: rec.addr }));
      UI.waCompose({ title: `Kabari customer · ${NO(x)} dikirim`, text, phone: x.customer.phone, waLabel: `Kabari ${esc((x.customer.name || 'customer').split(' ')[0])}`, tplKey: key,
        note: `<b>Pengiriman tersimpan.</b> ${esc(brief)}`,
        onSent: () => { const y = DB.sale(s.id); y.history.push({ at: D.nowStamp(), text: `Customer dikabari info pengiriman via WhatsApp oleh ${me.name}` }); y.deliv.notifiedAt = D.nowStamp(); DB.saveSale(y); } });
    });
  }
  /* Isi ongkir hasil kesepakatan WhatsApp + catat pembayaran ongkir. Nota customer ikut berubah. */
  function salePay(s, done) {
    const bl0 = Svc.bill(s);
    const m = modal({ title: `Perbarui nota ongkir · ${NO(s)}`, body: `
      <p class="muted" style="font-size:13px;margin-bottom:12px">Isi sesuai kesepakatan dengan customer via WhatsApp. Ongkir dibayar terpisah dari total belanja, langsung ke admin.</p>
      <div class="field"><label>Ongkir antar disepakati (Rp)</label><input class="input" type="number" id="spOng" min="0" value="${bl0.ongkirSet ? bl0.ongkir : ''}" placeholder="Hasil chat WhatsApp"></div>
      <div class="svc-bill" id="spSum"></div>
      <div class="field" style="margin-top:12px"><label>Pembayaran ongkir</label>
        <div class="seg" id="spWhen"><button type="button" data-w="nanti" class="active">Belum dibayar</button><button type="button" data-w="now">Dibayar sekarang</button></div></div>
      <div id="spPayBox" hidden><div class="grid-2"><div class="field"><label>Jumlah dibayar (Rp)</label><input class="input" type="number" id="spAmt" min="0"></div>
        <div class="field"><label>Metode</label><select class="select" id="spVia">${['Tunai', 'Transfer', 'QRIS'].map((x) => `<option>${x}</option>`).join('')}</select></div></div></div>
      <div class="field"><label>Catatan <span class="opt">(opsional)</span></label><input class="input" id="spNote" placeholder="Contoh: ongkir ke Baturraden"></div>`,
      foot: '<button class="btn btn-light" data-close>Batal</button><button class="btn btn-primary" id="spOk"><i class="fa-solid fa-check"></i> Simpan &amp; perbarui nota</button>' });
    const n = (id) => +String((m.$(id) || {}).value || '').replace(/[^\d]/g, '') || 0;
    const has = (id) => String((m.$(id) || {}).value || '').replace(/[^\d]/g, '') !== '';
    let when = 'nanti';
    const sum = () => { const ong = n('#spOng'); const due = Math.max(0, ong - Svc.paid(s)); m.$('#spSum').innerHTML = `<div class="kv total"><span>Ongkir</span><span>${rupiah(ong)}</span></div><div class="kv"><span>Sudah dibayar</span><span>${rupiah(Svc.paid(s))}</span></div><div class="kv"><span>Sisa ongkir</span><strong>${rupiah(due)}</strong></div>`; if (when === 'now' && !m.$('#spAmt').dataset.touched) m.$('#spAmt').value = due; };
    m.el.addEventListener('input', (e) => { if (e.target.id === 'spAmt') e.target.dataset.touched = '1'; sum(); });
    m.$('#spWhen').addEventListener('click', (e) => { const x = e.target.closest('[data-w]'); if (!x) return; when = x.dataset.w; m.$$('#spWhen [data-w]').forEach((y) => y.classList.toggle('active', y === x)); m.$('#spPayBox').hidden = when !== 'now'; sum(); });
    sum();
    m.$('#spOk').addEventListener('click', () => {
      if (!has('#spOng')) { toast('Isi ongkir yang sudah disepakati (isi 0 bila gratis).', 'err'); m.$('#spOng').focus(); return; }
      const ong = n('#spOng'); const amt = when === 'now' ? n('#spAmt') : 0;
      if (when === 'now' && !amt) { toast('Isi jumlah yang dibayar.', 'err'); return; }
      const at = D.nowStamp(); const note = m.$('#spNote').value.trim(); const via = 'Kasir · ' + m.$('#spVia').value; const before = Svc.bill(s);
      s.deliv = Object.assign({}, s.deliv || {}, { ongkir: ong, notaAt: at, notaBy: me.name });
      const changes = [];
      if (!before.ongkirSet || before.ongkir !== ong) changes.push({ field: 'Ongkir antar', from: before.ongkirSet ? rupiah(before.ongkir) : '—', to: rupiah(ong) });
      s.history = s.history || [];
      s.history.push({ at, text: `Nota ongkir diperbarui oleh ${me.name}: ${rupiah(ong)}${note ? ' · ' + note : ''}` });
      if (amt) {
        s.svc = s.svc || [];
        s.svc.push({ id: 'SVC-' + Date.now().toString(36).toUpperCase() + 'O' + s.svc.length, kind: 'ongkir', amount: amt, at, by: me.name, via, note });
        s.history.push({ at, text: `Pembayaran ongkir ${rupiah(amt)} · ${via}` });
        changes.push({ field: 'Dibayar', from: '', to: rupiah(amt) });
      }
      DB.saveSale(s);
      DB.audit({ type: amt ? 'keuangan' : 'layanan', action: `Memperbarui nota ongkir ${NO(s)} (${s.customer.name})${amt ? ` · dibayar ${rupiah(amt)}` : ''}`, ref: s.id, changes });
      DB.notify(s.customer.email, 'Nota ongkir diperbarui', `Ongkir ${NO(s)}: ${rupiah(ong)}.`, 'pesanan?tab=beli');
      m.close(); refreshShell(); toast('Nota ongkir diperbarui.'); done && done();
    });
  }
  /* Teks WhatsApp penjualan: rincian nota + link nota digital */
  function saleVars(s) {
    const bl = Svc.bill(s); const paid = Rules.paidTotal(s); const deliv = saleDeliv(s);
    const ong = deliv && bl.ongkirSet ? bl.ongkir : 0; const grand = s.total + ong; const allPaid = paid + (deliv ? bl.paid : 0); const sisa = Math.max(0, grand - allPaid);
    const R = [...s.items.map((i) => `• ${i.qty}× ${i.name} = ${rupiah(i.qty * i.price)}`), ...(s.discount && (s.discount.amount || s.discount.fixed) ? [`Diskon${s.discount.code && s.discount.code !== 'KASIR' ? ' ' + s.discount.code : ''}: −${rupiah(s.discount.amount || s.discount.fixed)}`] : [])];
    if (deliv) R.push(`Ongkir antar: ${bl.ongkirSet ? rupiah(ong) : 'menunggu konfirmasi admin'}`);
    R.push(`*Total: ${rupiah(grand)}* · Dibayar: ${rupiah(allPaid)}${sisa ? ` · Sisa: ${rupiah(sisa)}` : ' · LUNAS'}`);
    const P = deliv ? [`Diantar ke: ${(s.deliv || {}).address || '-'}`, ...(Svc.shipMode(s) ? [`Pengiriman: ${Svc.shipBrief(s)}`] : [])].join('\n') : '';
    const nm = (s.customer && !s.customer.walkIn && s.customer.name) || 'Kak';
    return { nama: nm, nama_depan: nm.split(' ')[0], no_nota: NO(s), tanggal: D.fmtDate(s.createdAt, true), rincian: R.join('\n'), total: rupiah(grand), dibayar: rupiah(allPaid), sisa: rupiah(sisa), pengiriman: P, metode: s.method || '', link_nota: Ann.Share.link(s) };
  }
  /* Teks WhatsApp penjualan dari template "Kirim invoice penjualan" */
  function saleWaText(s) { return DB.waText('sale_nota', saleVars(s)); }
  /* Hubungi customer (penjualan): pratinjau INVOICE → Salin gambar → Buka WhatsApp, sama dengan sewa & laundry */
  async function contactSale(s, opts = {}) {
    s = DB.sale(s.id) || s;
    await Ann.Share.ensure(s);
    const cv = await UI.saleCanvas(s);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const key = opts.tplKey || 'sale_nota';
    return UI.waCompose({ title: opts.title || `Hubungi customer · ${NO(s)}`, blob, name: `invoice-${NO(s).replace(/\//g, '_')}.png`, text: DB.waText(key, saleVars(s)), phone: s.customer.phone || '',
      waLabel: s.customer.walkIn ? 'Buka WhatsApp' : `Hubungi ${esc((s.customer.name || 'customer').split(' ')[0])}`, tplKey: key,
      onSent: (how) => { const x = DB.sale(s.id); if (!x) return; x.history = x.history || []; x.history.push({ at: D.nowStamp(), text: `Customer dihubungi via WhatsApp + invoice digital${how ? ' · ' + how : ''} oleh ${me.name}` }); DB.saveSale(x); opts.onSent && opts.onSent(); } });
  }
  function saleModal(id, done) {
    const s = DB.sale(id); if (!s) { toast('Pesanan tidak ditemukan.', 'err'); return; }
    const acts = saleActions(s);
    const m = modal({ title: `Pesanan ${NO(s)}`, size: 'lg', body: `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pill('sale', s.status)} ${pill('payment', s.paymentStatus)}</div>
      <div class="kv-grid">
        <div class="kv"><span>Customer</span><strong>${esc(s.customer.name)}</strong></div>
        <div class="kv"><span>Telepon</span>${s.customer.phone ? `<a href="${custLink(s.customer)}" target="_blank" rel="noopener noreferrer" style="color:var(--g700);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ${esc(s.customer.phone)}</a>` : '<span class="muted">Tidak dicatat (pelanggan umum)</span>'}</div>
        <div class="kv"><span>Pengambilan</span><span>${saleDeliv(s) ? saleTag(s) : 'Ambil di toko'}</span></div>
        <div class="kv"><span>Metode bayar</span><span>${esc(s.method || '-')}</span></div>
        <div class="kv"><span>Dibuat</span><span>${D.fmtDateTime(s.createdAt)}</span></div>
      </div>
      <div class="mini-sec"><h4>Barang</h4><div class="adm-items">${s.items.map((i) => `<div class="it"><img src="${asset(i.img)}" alt=""><div class="nm"><strong>${esc(i.name)}</strong><br><small class="muted">${i.qty} × ${rupiah(i.price)}</small></div><strong>${rupiah(i.qty * i.price)}</strong></div>`).join('')}</div></div>
      ${saleSvcSection(s)}
      <div class="mini-sec" style="max-width:360px;margin-left:auto">
        <div class="kv"><span>Subtotal</span><span>${rupiah(s.subtotal)}</span></div>
        <div class="kv total"><span>Total</span><span>${rupiah(s.total)}</span></div>
      </div>
      ${s.proof ? `<div class="mini-sec"><h4>Bukti pembayaran</h4><img class="proof-img" src="${asset(s.proof)}" alt="Bukti"></div>` : ''}
      <div class="mini-sec"><h4>Riwayat</h4><ul class="timeline">${(s.history || []).slice().reverse().map((h) => `<li>${esc(h.text)}<small>${D.fmtDateTime(h.at)}</small></li>`).join('')}</ul></div>`,
      foot: `${s.paymentStatus === 'paid' || saleDeliv(s) ? `<a class="btn btn-light" href="${url('invoice?id=' + s.id)}"><i class="fa-solid fa-receipt"></i> Nota</a>` : ''}<button class="btn btn-light" data-ssvc="print" title="Struk thermal ${UI.receiptPaper()} mm"><i class="fa-solid fa-print"></i> Struk</button><button class="btn btn-wa" data-ssvc="contact"><i class="fa-brands fa-whatsapp"></i> Hubungi customer</button>${acts.map(([k, ic, l, c]) => `<button class="btn ${c}" data-sact="${k}"><i class="fa-solid ${ic}"></i> ${l}</button>`).join('') || '<button class="btn btn-light" data-close>Tutup</button>'}` });
    m.$$('[data-sact]').forEach((btn) => btn.addEventListener('click', () => { m.close(); runSale(btn.dataset.sact, id, done); }));
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-ssvc]'); if (!b) return; const cur = DB.sale(id);
      if (b.dataset.ssvc === 'contact') { contactSale(cur); return; }
      if (b.dataset.ssvc === 'print') { UI.printStruk(cur, 'sale'); return; }
      if (b.dataset.ssvc === 'pay') { m.close(); salePay(cur, () => { done && done(); saleModal(id, done); }); }
      if (b.dataset.ssvc === 'ship') { m.close(); saleShip(cur, () => { done && done(); saleModal(id, done); }); } });
  }

  function ledger(from, to) {
    const inRange = (iso) => { const d = D.day(iso); return (!from || d >= from) && (!to || d <= to); };
    const income = [], expense = [];
    const RSL = Object.assign({ rentShipLine: 'rent' }, DB.settings().finance || {}).rentShipLine || 'rent';
    DB.bookings().forEach((b) => {
      (b.payments || []).forEach((p) => { if (inRange(p.at)) income.push({ date: p.at, ref: b.id, cat: p.type === 'Denda' ? 'Denda' : 'Rental', desc: `${p.type}${p.via ? ' · ' + p.via : ''} · ${b.customer.name}`, amount: p.amount, offline: b.channel === 'offline' }); });
      /* Refund DP = uang customer yang dikembalikan → MENGURANGI pemasukan Rental (bukan pengeluaran) */
      (b.refunds || []).forEach((r) => { if (inRange(r.at)) income.push({ date: r.at, ref: b.id, cat: 'Refund DP', desc: `Refund DP (pengurang pemasukan) · ${b.customer.name}`, amount: -Math.abs(r.amount), ln: 'rent', auto: true, refund: true }); });
      /* Jasa bongkar pasang & ongkir antar/jemput: dicatat staff, masuk lini Rental */
      (b.svc || []).forEach((x) => { if (inRange(x.at)) income.push({ date: x.at, ref: b.id, cat: x.kind === 'pasang' ? 'Jasa Tenda (Bongkar/Pasang)' : 'Ongkir Antar Jemput', desc: `${x.kind === 'pasang' ? 'Jasa tenda' + (x.note ? ' (' + x.note + ')' : '') : 'Ongkir antar/jemput'}${x.via ? ' · ' + x.via : ''} · ${b.customer.name}`, amount: x.amount, ln: 'rent', lnFix: RSL, offline: true }); });
    });
    /* Laundry: dibayar di kasir, masuk lini Rental */
    DB.laundry().forEach((o) => (o.payments || []).forEach((p) => { if (inRange(p.at)) income.push({ date: p.at, ref: o.id, cat: 'Jasa Laundry', desc: `Laundry ${o.no}${p.via ? ' · ' + p.via : ''} · ${o.customer.name}`, amount: p.amount, ln: 'rent', offline: true }); }));
    /* Modal barang terjual (HPP): harga beli × jumlah, diakui sebanding dengan pembayaran penjualan yang masuk */
    const cogs = []; let missingCost = 0;
    DB.sales().forEach((s) => { if (s.status === 'dibatalkan') return; const tot = +s.total || 0; if (!tot) return;
      const c = Rules.saleCost(s); (s.payments || []).forEach((p) => { if (!inRange(p.at)) return; const part = Math.min(1, (+p.amount || 0) / tot); cogs.push({ date: p.at, ref: s.id, amount: Math.round(c.cost * part) }); if (c.missing) missingCost += 1; }); });
    /* Ongkir penjualan: titipan untuk ekspedisi → bawaan TIDAK dicatat (Konfigurasi → Keuangan & Ongkir) */
    const FIN = Object.assign({ saleShipLedger: false, saleShipKurir: true, saleShipLine: 'sale', rentShipLine: 'rent' }, DB.settings().finance || {});
    /* Ongkir penjualan dikirim LANGSUNG oleh staff toko = penghasilan toko → pemasukan Penjualan (ketentuan mitra) */
    DB.sales().filter((s) => (FIN.saleShipLedger || (FIN.saleShipKurir !== false && Svc.shipMode(s) === 'kurir'))).forEach((s) => (s.svc || []).forEach((x) => { if (inRange(x.at)) income.push({ date: x.at, ref: s.id, cat: 'Ongkir Penjualan', desc: `Ongkir penjualan${x.via ? ' · ' + x.via : ''} · ${s.customer.name}`, amount: x.amount, lnFix: FIN.saleShipLine }); }));
    DB.sales().forEach((s) => (s.payments || []).forEach((p) => { if (inRange(p.at)) income.push({ date: p.at, ref: s.id, cat: 'Penjualan', desc: `Penjualan${p.via ? ' · ' + p.via : ''} · ${s.customer.name}`, amount: p.amount, offline: s.channel === 'offline' }); }));
    const voided = [];
    DB.expenses().forEach((e) => { if (!inRange(e.date)) return; const row = { date: e.date, ref: e.id, cat: e.category, desc: e.desc, amount: e.amount, id: e.id, kind: 'out', ln: e.line, voidReason: e.voidReason, voidBy: e.voidBy }; (e.status === 'dibatalkan' ? voided : expense).push(row); });
    DB.incomes().forEach((e) => { if (!inRange(e.date)) return; const row = { date: e.date, ref: e.id, cat: e.category, desc: e.desc, amount: e.amount, id: e.id, kind: 'in', manual: true, ln: e.line, voidReason: e.voidReason, voidBy: e.voidBy }; (e.status === 'dibatalkan' ? voided : income).push(row); });
    const sort = (a, b) => String(b.date).localeCompare(String(a.date));
    income.sort(sort); expense.sort(sort);
    const sum = (l) => l.reduce((s, x) => s + x.amount, 0);
    voided.sort(sort);
    /* Pemisahan per lini bisnis agar data tidak rancu:
       rent = sewa (pembayaran booking, denda, refund DP, perawatan & perbaikan alat)
       sale = jual (pembayaran pesanan beli, pembelian/restock barang)
       umum = pemasukan/pengeluaran manual lainnya (operasional, promosi, dll.) */
    const lineOf0 = (x, kind) => {
      if (x.lnFix) return x.lnFix; /* lini ongkir dari Konfigurasi → Keuangan & Ongkir */
      /* Laundry, jasa tenda (bongkar/pasang) & ongkir antar jemput SELALU masuk lini Rental (ketentuan mitra) */
      if (/^DRY/.test(String(x.ref)) || (kind === 'in' && /laundry|tenda|bongkar|pasang|ongkir/i.test(x.cat))) return 'rent';
      if (['rent', 'sale', 'umum'].includes(x.ln)) return x.ln; /* lini dipilih manual di form */
      if (/^RNT|^R-/.test(String(x.ref))) return 'rent';
      if (/^ORD|^S-/.test(String(x.ref))) return 'sale';
      if (kind === 'out' && /perawatan|perbaikan|refund/i.test(x.cat)) return 'rent';
      if (kind === 'out' && /pembelian barang|restock|stok/i.test(x.cat)) return 'sale';
      if (/^DRY/.test(String(x.ref))) return 'rent';
      if (kind === 'in' && /cuci|servis|laundry|bongkar|ongkir/i.test(x.cat)) return 'rent';
      return 'umum';
    };
    /* Revisi mitra 21 Okt 2026: lini Rental PUNYA pengeluaran — restock barang sewa, biaya operasional/kebutuhan lain rental,
       serta perawatan & perbaikan alat. Laba Rental = pemasukan Rental − pengeluaran Rental. */
    const lineOf = (x, kind) => lineOf0(x, kind);
    const rentOutKind = (x) => (/restock|pembelian barang/i.test(`${x.cat} ${x.desc}`) ? 'restock' : /perawatan|perbaikan|servis|cuci/i.test(x.cat) ? 'care' : 'ops');
    const by = { rent: { in: 0, out: 0 }, sale: { in: 0, out: 0 }, umum: { in: 0, out: 0 } };
    income.forEach((x) => { x.line = lineOf(x, 'in'); by[x.line].in += x.amount; });
    expense.forEach((x) => { x.line = lineOf(x, 'out'); by[x.line].out += x.amount; });
    /* Laba per lini:
       Rental    = pemasukan Rental (sewa, denda, laundry, jasa tenda, ongkir; refund DP sudah mengurangi)
       Penjualan = pemasukan penjualan − modal barang terjual (belanja/restock stok = arus kas, bukan pengurang laba)
       Umum      = pemasukan lain − pengeluaran operasional
       Laba bersih toko = jumlah ketiganya. totalIn/totalOut tetap arus kas (uang masuk/keluar sebenarnya). */
    const withProfit = (B0) => { B0.sale.cogs = sum(cogs); B0.sale.missingCost = missingCost; B0.rent.profit = B0.rent.in - B0.rent.out;
      B0.rent.outBy = { restock: 0, care: 0, ops: 0 }; expense.filter((x) => x.line === 'rent').forEach((x) => { B0.rent.outBy[rentOutKind(x)] += x.amount; }); B0.sale.profit = B0.sale.in - B0.sale.cogs; B0.umum.profit = B0.umum.in - B0.umum.out; return B0.rent.profit + B0.sale.profit + B0.umum.profit; };
    voided.forEach((x) => { x.line = lineOf(x, x.kind); });
    /* Bulan yang data mentahnya sudah dibersihkan: angka diambil dari ringkasan arsip */
    const per = from && to && from.endsWith('-01') ? from.slice(0, 7) : null;
    const arc = per && DB.archive ? DB.archive(per) : null;
    if (arc && arc.purged && arc.summary && String(to).slice(0, 7) === per) {
      const sm = arc.summary; const bl = sm.byLine || { rent: { in: 0, out: 0 }, sale: { in: 0, out: 0 }, umum: { in: sm.pemasukan || 0, out: sm.pengeluaran || 0 } };
      const BA = { rent: { in: Math.max(by.rent.in, bl.rent.in), out: Math.max(by.rent.out, bl.rent.out) }, sale: { in: Math.max(by.sale.in, bl.sale.in), out: Math.max(by.sale.out, bl.sale.out) }, umum: { in: Math.max(by.umum.in, bl.umum.in), out: Math.max(by.umum.out, bl.umum.out) } }; const pA = withProfit(BA); if (bl.sale && bl.sale.cogs) { BA.sale.cogs = Math.max(BA.sale.cogs, bl.sale.cogs); BA.sale.profit = BA.sale.in - BA.sale.cogs; }
      return { income, expense, voided, cogs, totalIn: Math.max(sum(income), sm.pemasukan || 0), totalOut: Math.max(sum(expense), sm.pengeluaran || 0), by: BA, profit: BA.rent.profit + BA.sale.profit + BA.umum.profit, fromArchive: true };
    }
    const profit = withProfit(by);
    return { income, expense, voided, cogs, totalIn: sum(income), totalOut: sum(expense), by, profit };
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

  /* Semua link WhatsApp berisi pesan otomatis di panel staff: buka jendela kirim dulu supaya isi pesan bisa diperiksa & diedit */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="wa.me/"]'); if (!a || a.dataset.direct || e.defaultPrevented || e.ctrlKey || e.metaKey) return;
    let u; try { u = new URL(a.href); } catch (x) { return; } const t = u.searchParams.get('text'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    UI.waCompose({ title: 'Kirim pesan WhatsApp', text: t, phone: u.pathname.replace(/\D/g, ''), waLabel: 'Buka WhatsApp' });
  }, true);
  window.Admin = { settleModal, contactDue, contactBooking, ldContact, ldLink, rentVars, saleShipCell, salePayCell, saleShip, ldPickup, ldWaText, ldNotaText, ldNotify, svcSchedule, svcTag, svcLine, svcSection, svcEdit, svcPay, svcNotaSent, laundryModal, ldStruk, ldWa, ldPay, ldAdvance, ldItems, cleanupModal, me, isOwner, A, O, scanQR, openRef, init, relTime, presence, remindWa, remindCustomer, fineLines, groupMates, reminderText, remindedToday, refreshShell, pendingRequests, BK, bookingActions, runBooking, bookingModal, saleActions, runSale, saleModal, saleTag, saleLine, salePay, contactSale, saleVars, ledger, sisa, itemsText, custLink };
})();
