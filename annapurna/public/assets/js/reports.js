/* Laporan bersama (halaman Laporan, arsip bulanan Google Drive, email Owner). */
(function () {
  if (!window.Admin || window.Admin.blocked) return;
  const { DB, Rules, STATUS, AUDIT_TYPES, D, rupiah } = Ann;
  const { esc, url, toast } = UI;
  const T = () => D.today();
  const inR = (iso, f, t) => { const d = D.day(iso || ''); return d && d >= f && d <= t; };
  const typeLabel = (k) => (AUDIT_TYPES[k] || { label: k }).label;
  const roleLabel = (r) => DB.ROLE_LABEL[r] || r;
  const durasi = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} jam ${m % 60} mnt`; };

  const R = {
    rental(f, t) {
      const L = DB.bookings().filter((b) => inR(b.start, f, t)).sort((a, b) => a.start.localeCompare(b.start));
      const ok = L.filter((b) => b.status !== 'dibatalkan');
      return { title: 'Laporan Rental', note: 'Berdasarkan tanggal mulai sewa.',
        sum: [['Jumlah booking', L.length], ['Dibatalkan', L.length - ok.length], ['Nilai sewa (tidak termasuk batal)', rupiah(ok.reduce((s, b) => s + b.total, 0))]],
        cols: ['No.', 'Customer', 'Barang', 'Periode', 'Hari', 'Total', 'Dibayar', 'Status'], num: [4, 5, 6], money: [5, 6],
        rows: L.map((b) => [b.id, b.customer.name, Admin.itemsText(b), D.fmtRange(b.start, b.end), b.days, b.total, Rules.paidTotal(b), STATUS.rental[b.status].label]),
        foot: ['Total', '', '', '', ok.reduce((s, b) => s + b.days, 0), ok.reduce((s, b) => s + b.total, 0), L.reduce((s, b) => s + Rules.paidTotal(b), 0), ''] };
    },
    penjualan(f, t) {
      const L = DB.sales().filter((s) => inR(s.createdAt, f, t)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const ok = L.filter((s) => s.status !== 'dibatalkan');
      const qty = ok.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
      return { title: 'Laporan Penjualan', note: 'Berdasarkan tanggal pesanan.',
        sum: [['Jumlah pesanan', L.length], ['Barang terjual', qty + ' unit'], ['Omzet', rupiah(ok.filter((s) => s.paymentStatus === 'paid').reduce((a, s) => a + s.total, 0))]],
        cols: ['No.', 'Tanggal', 'Customer', 'Barang', 'Qty', 'Total', 'Status'], num: [4, 5], money: [5],
        rows: L.map((s) => [s.id, D.fmtDate(s.createdAt), s.customer.name, s.items.map((i) => `${i.qty}× ${i.name}`).join(', '), s.items.reduce((a, i) => a + i.qty, 0), s.total, STATUS.sale[s.status].label]),
        foot: ['Total', '', '', '', qty, ok.reduce((a, s) => a + s.total, 0), ''] };
    },
    stok(f, t) {
      const P = DB.products(true); const cats = DB.categories(true);
      const times = (id) => DB.bookings().filter((b) => b.status !== 'dibatalkan' && inR(b.start, f, t) && b.items.some((i) => i.components.some((c) => c.productId === id))).length;
      const sold = (id) => DB.sales().filter((s) => s.status !== 'dibatalkan' && inR(s.createdAt, f, t)).reduce((a, s) => a + s.items.filter((i) => i.productId === id).reduce((x, i) => x + i.qty, 0), 0);
      return { title: 'Laporan Stok Barang', note: `Posisi stok per ${D.fmtDate(T(), true)}; frekuensi sewa & penjualan sesuai periode.`,
        sum: [['Jenis barang', P.length], ['Total unit', P.reduce((s, p) => s + p.stock, 0)], ['Sedang disewa', P.reduce((s, p) => s + Rules.rentedNow(p.id), 0) + ' unit']],
        cols: ['ID', 'Barang', 'Kategori', 'Kondisi', 'Status', 'Stok', 'Tersedia', 'Disewa', 'Kali disewa', 'Terjual'], num: [5, 6, 7, 8, 9], money: [],
        rows: P.map((p) => [p.id, p.name, (cats.find((c) => c.id === p.cat) || {}).name || p.cat, p.cond, p.active === false ? 'Tidak Aktif' : 'Aktif', p.stock, Rules.availableOn(p.id, T()), Rules.rentedNow(p.id), times(p.id), sold(p.id)]) };
    },
    pengembalian(f, t) {
      const L = DB.bookings().filter((b) => b.ret && inR(b.ret.at, f, t)).sort((a, b) => a.ret.at.localeCompare(b.ret.at));
      return { title: 'Laporan Pengembalian', note: 'Berdasarkan tanggal barang kembali.',
        sum: [['Pengembalian', L.length], ['Terlambat', L.filter((b) => b.ret.lateDays > 0).length], ['Kondisi bermasalah', L.filter((b) => /Rusak|Hilang/.test(b.ret.cond)).length]],
        cols: ['No.', 'Customer', 'Barang', 'Jadwal kembali', 'Tanggal kembali', 'Terlambat', 'Kondisi', 'Petugas'], num: [5], money: [],
        rows: L.map((b) => [b.id, b.customer.name, Admin.itemsText(b), D.fmtDate(b.end), D.fmtDateTime(b.ret.at), b.ret.lateDays + ' hari', b.ret.cond, b.ret.by]) };
    },
    denda(f, t) {
      const L = DB.bookings().filter((b) => b.ret && b.ret.fine && inR(b.ret.at, f, t));
      const lateOf = (b) => (b.ret.lateFee != null ? b.ret.lateFee : b.ret.fine - (b.ret.damageFee || 0));
      const late = L.reduce((s, b) => s + lateOf(b), 0), dmg = L.reduce((s, b) => s + (b.ret.damageFee || 0), 0);
      return { title: 'Laporan Kerusakan & Denda', note: 'Denda keterlambatan dan biaya kerusakan dari pengembalian barang.',
        sum: [['Kasus', L.length], ['Denda keterlambatan', rupiah(late)], ['Biaya kerusakan', rupiah(dmg)]],
        cols: ['No.', 'Tanggal', 'Customer', 'Kondisi', 'Terlambat', 'Denda telat', 'Biaya rusak', 'Total', 'Catatan'], num: [4, 5, 6, 7], money: [5, 6, 7],
        rows: L.map((b) => [b.id, D.fmtDate(b.ret.at), b.customer.name, b.ret.cond, b.ret.lateDays + ' hari', lateOf(b), b.ret.damageFee || 0, b.ret.fine, b.ret.note || '-']),
        foot: ['Total', '', '', '', '', late, dmg, late + dmg, ''] };
    },
    keuangan(f, t) {
      const L = Admin.ledger(f, t);
      const when = (x) => (String(x.date).length > 10 ? D.fmtDateTime(x.date) : D.fmtDate(x.date));
      const rows = [...L.income.map((x) => [x.date, when(x), 'Pemasukan', x.cat, x.ref, x.desc, x.amount, '']), ...L.expense.map((x) => [x.date, when(x), 'Pengeluaran', x.cat, x.ref, x.desc, '', x.amount])]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map((r) => r.slice(1));
      return { title: 'Laporan Keuangan', note: 'Rekap pemasukan dan pengeluaran. Transaksi yang dibatalkan tidak dihitung.',
        sum: [['Pemasukan', rupiah(L.totalIn)], ['Pengeluaran', rupiah(L.totalOut)], ['Selisih', rupiah(L.totalIn - L.totalOut)]],
        cols: ['Tanggal', 'Jenis', 'Kategori', 'Ref', 'Keterangan', 'Masuk', 'Keluar'], num: [5, 6],
        rows, foot: ['Total', '', '', '', '', L.totalIn, L.totalOut] };
    },
    aktivitas(f, t) {
      const L = DB.audits().filter((a) => a.type !== 'akses' && inR(a.at, f, t));
      const people = new Set(L.filter((a) => a.role !== 'system').map((a) => a.userId));
      return { title: 'Laporan Aktivitas Staff', note: 'Dicatat otomatis oleh sistem (tanpa input manual). Tidak termasuk riwayat membuka halaman.',
        sum: [['Total aktivitas', L.length], ['Staff terlibat', people.size], ['Perubahan data', L.filter((a) => (AUDIT_TYPES[a.type] || {}).group === 'data').length], ['Aktivitas transaksi', L.filter((a) => (AUDIT_TYPES[a.type] || {}).group === 'transaksi').length]],
        cols: ['Waktu', 'Staff', 'Role', 'Jenis', 'Aktivitas', 'Data', 'Perubahan'], num: [], money: [],
        rows: L.map((a) => [D.fmtDateTime(a.at), a.userName, roleLabel(a.role), typeLabel(a.type), a.action, a.ref || '-', (a.changes || []).map((c) => `${c.field}: ${c.from || '—'} → ${c.to || '—'}`).join('; ') || '-']) };
    },
    login(f, t) {
      const all = DB.audits().filter((a) => ['login', 'logout', 'login_gagal'].includes(a.type));
      const rows = [];
      all.forEach((a, i) => {
        if (!inR(a.at, f, t)) return;
        if (a.type === 'login') {
          const out = all.slice(i + 1).find((x) => x.userId === a.userId && ['login', 'logout'].includes(x.type));
          const lo = out && out.type === 'logout' ? out : null;
          rows.push({ at: a.at, r: [a.userName, roleLabel(a.role), D.fmtDateTime(a.at), lo ? D.fmtDateTime(lo.at) : '-', lo ? durasi(new Date(lo.at) - new Date(a.at)) : '-', lo ? 'Logout normal' : out ? 'Tidak logout (sesi ditimpa login berikutnya)' : 'Sesi masih berjalan'], dur: lo ? new Date(lo.at) - new Date(a.at) : 0 });
        }
        if (a.type === 'login_gagal') rows.push({ at: a.at, r: [a.userName, roleLabel(a.role), D.fmtDateTime(a.at), '-', '-', a.action], fail: 1 });
      });
      const ok = rows.filter((x) => !x.fail), withDur = ok.filter((x) => x.dur);
      return { title: 'Histori Login Staff', note: 'Pasangan login–logout setiap staff beserta durasi sesi dan percobaan login yang gagal.',
        sum: [['Jumlah login', ok.length], ['Login gagal / ditolak', rows.length - ok.length], ['Rata-rata durasi sesi', withDur.length ? durasi(withDur.reduce((s, x) => s + x.dur, 0) / withDur.length) : '-']],
        cols: ['Staff', 'Role', 'Login', 'Logout', 'Durasi', 'Keterangan'], num: [], money: [],
        rows: rows.map((x) => x.r) };
    },
  };
  const TYPES = [
    ['rental', 'Laporan Rental'], ['penjualan', 'Laporan Penjualan'], ['stok', 'Laporan Stok Barang'], ['pengembalian', 'Laporan Pengembalian'],
    ['denda', 'Laporan Kerusakan & Denda'], ['keuangan', 'Laporan Keuangan'], ['aktivitas', 'Laporan Aktivitas Staff', true], ['login', 'Histori Login Staff', true],
  ];

  function toSpec(cur, filename, subtitle) {
    const money = cur.money || cur.num;
    return { filename, title: cur.title, subtitle, orientation: cur.cols.length > 6 ? 'landscape' : 'portrait',
      summary: cur.sum.map(([l, v]) => [l, String(v)]),
      columns: cur.cols.map((h, i) => ({ header: h, type: money.includes(i) ? 'money' : cur.num.includes(i) ? 'number' : 'text', width: /Aktivitas|Perubahan|Barang|Keterangan/.test(h) ? 36 : undefined })),
      rows: cur.rows, foot: cur.foot || null };
  }

  /* ---------- Rekap bulanan → Google Drive + email Owner ---------- */
  const MONTHLY = [['rental', 'Laporan Rental'], ['penjualan', 'Laporan Penjualan'], ['keuangan', 'Laporan Keuangan'], ['stok', 'Laporan Stok'], ['pengembalian', 'Laporan Pengembalian'], ['aktivitas', 'Laporan Aktivitas Staff'], ['login', 'Histori Login Staff']];
  const pad = (n) => String(n).padStart(2, '0');
  const monthName = (period) => { const [y, m] = period.split('-').map(Number); return `${D.BULAN_PANJANG[m - 1]} ${y}`; };
  const monthRange = (period) => { const [y, m] = period.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return [`${period}-01`, `${period}-${pad(last)}`]; };
  const prevPeriod = (iso) => { const d = new Date((iso || T()) + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const folderName = (period) => `REKAP LAPORAN BULAN ${monthName(period).toUpperCase()}`;
  const fileName = (label, period) => `${label} ${monthName(period)}.pdf`;
  const integ = () => DB.settings().integration || {};

  function monthSummary(period) {
    const [f, t] = monthRange(period);
    const B = DB.bookings(), S = DB.sales(), L = Admin.ledger(f, t);
    const acts = DB.audits().filter((a) => a.type !== 'akses' && a.role !== 'system' && inR(a.at, f, t));
    const per = {}; acts.forEach((a) => { per[a.userName] = (per[a.userName] || 0) + 1; });
    return {
      rental: B.filter((b) => inR(b.start, f, t) && b.status !== 'dibatalkan').length,
      penjualan: S.filter((s) => inR(s.createdAt, f, t) && s.status !== 'dibatalkan').length,
      pemasukan: L.totalIn, pengeluaran: L.totalOut,
      keluar: B.filter((b) => b.out && inR(b.out.at, f, t)).length,
      kembali: B.filter((b) => b.ret && inR(b.ret.at, f, t)).length,
      batal: B.filter((b) => b.cancel && inR(b.cancel.at, f, t)).length + S.filter((s) => s.status === 'dibatalkan' && inR(s.createdAt, f, t)).length,
      ganti: B.reduce((n, b) => n + (b.changes || []).filter((c) => inR(c.at, f, t)).length, 0),
      aktivitas: acts.length,
      perStaff: Object.entries(per).sort((a, b) => b[1] - a[1]),
    };
  }

  function generateMonthly(period, opts) {
    opts = opts || {};
    const ig = integ(); const old = DB.archive(period); const me = DB.session();
    const summary = monthSummary(period);
    const to = [ig.ownerEmail, ...String(ig.ccEmails || '').split(',').map((x) => x.trim()).filter(Boolean)].filter(Boolean);
    const mail = DB.sendMail({ kind: 'monthly_report', to: to.join(', '), subject: `Rekap Laporan Annapurna Adventure – ${monthName(period)}`, data: { period, summary, folder: folderName(period), files: MONTHLY.map(([, l]) => fileName(l, period)) } });
    const a = { period, createdAt: D.nowStamp(), by: opts.auto ? 'Sistem (terjadwal)' : me.name, auto: !!opts.auto, version: old ? (old.version || 1) + 1 : 1,
      path: [ig.driveRoot || 'ANNAPURNA ADVENTURE', `TAHUN ${period.slice(0, 4)}`, folderName(period)], files: MONTHLY.map(([k, l]) => ({ type: k, name: fileName(l, period) })), summary, mailId: mail.id, mailTo: mail.to };
    DB.saveArchive(a);
    DB.audit(Object.assign(opts.auto ? { system: true } : {}, { type: 'laporan', action: `${old ? 'Memperbarui' : 'Membuat'} rekap laporan ${monthName(period)}, disimpan ke Google Drive & dikirim ke ${mail.to}`, ref: period, changes: [{ field: 'Folder', from: '', to: a.path.join(' / ') }, { field: 'File', from: '', to: `${a.files.length} PDF` }] }));
    return a;
  }

  function autoMonthly() {
    const ig = integ(); if (!ig.autoMonthly || !ig.driveConnected) return;
    const now = new Date(); const day = now.getDate(); const [h, m] = String(ig.sendTime || '06:00').split(':').map(Number);
    if (day < (ig.sendDay || 1) || (day === (ig.sendDay || 1) && now.getHours() * 60 + now.getMinutes() < h * 60 + m)) return;
    const period = prevPeriod();
    if (DB.archive(period)) return;
    generateMonthly(period, { auto: true });
    setTimeout(() => toast(`Rekap laporan ${monthName(period)} dibuat otomatis, disimpan ke Google Drive, dan dikirim ke ${ig.ownerEmail}.`), 600);
  }

  async function downloadArchiveFile(period, type) {
    const [f, t] = monthRange(period);
    const item = MONTHLY.find((x) => x[0] === type);
    const cur = R[type](f, t);
    const spec = toSpec(cur, fileName(item[1], period).replace(/\.pdf$/, ''), `Periode ${D.fmtDate(f, true)} – ${D.fmtDate(t, true)} · ${cur.note}`);
    await UI.exportPDF(spec);
    DB.audit({ type: 'laporan', action: `Mengunduh ${fileName(item[1], period)} dari arsip Google Drive`, ref: period });
  }

  /* ---------- Template email ---------- */
  function mailHtml(m) {
    const st = DB.settings(); const d = m.data || {};
    const shell = (inner) => `<div class="mail">
      <div class="mail-meta"><div><span>Dari</span> ${esc(st.storeName)} &lt;no-reply@annapurna.id&gt;</div><div><span>Kepada</span> ${esc(m.to)}</div><div><span>Subjek</span> <strong>${esc(m.subject)}</strong></div><div><span>Waktu</span> ${D.fmtDateTime(m.at)}</div></div>
      <div class="mail-body"><div class="mail-brand"><img src="${url('assets/img/logo.png')}" alt=""></div>${inner}
      <p class="mail-foot">Email ini dikirim otomatis oleh sistem ${esc(st.storeName)} · ${esc(st.address)}</p></div></div>`;
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    if (m.kind === 'staff_invite' || m.kind === 'password_reset') {
      const invite = m.kind === 'staff_invite';
      return shell(`<p>Halo <strong>${esc(d.name)}</strong>,</p>
        <p>${invite ? `Akun staff Anda di <strong>${esc(st.storeName)}</strong> telah dibuat oleh Owner (<strong>${esc(d.by)}</strong>).` : `Owner (<strong>${esc(d.by)}</strong>) telah mengatur ulang kata sandi akun staff Anda.`}</p>
        <table class="mail-tbl">${row('Nama toko', esc(st.storeName))}${row('Nama akun', esc(d.name))}${row('Email akun', esc(d.email))}${row('Role', esc(roleLabel(d.role)))}${row('Kata sandi sementara', `<code>${esc(d.tempPassword)}</code>`)}${row('Link website', `<a href="${url('masuk')}">${esc(url('masuk'))}</a>`)}</table>
        <p><strong>Cara masuk:</strong></p>
        <ol><li>Buka link website di atas.</li><li>Masuk dengan email akun dan kata sandi sementara.</li><li>Sistem akan meminta Anda membuat kata sandi baru saat pertama login.</li><li>Jangan bagikan kata sandi kepada siapa pun.</li></ol>
        <p class="mail-note">Akun ini dibuat oleh Owner ${esc(st.storeName)}. Semua aktivitas di panel admin tercatat otomatis di histori sistem.</p>
        <p><a class="mail-btn" href="${url('masuk')}">Masuk ke panel</a></p>`);
    }
    if (m.kind === 'monthly_report') {
      const s = d.summary || {};
      return shell(`<p>Halo Owner,</p>
        <p>Rekap laporan operasional bulan <strong>${esc(monthName(d.period))}</strong> telah dibuat dan disimpan pada Google Drive.</p>
        <table class="mail-tbl">${row('Total transaksi rental', s.rental)}${row('Total penjualan', s.penjualan)}${row('Total pemasukan', rupiah(s.pemasukan))}${row('Total pengeluaran', rupiah(s.pengeluaran))}${row('Selisih', rupiah((s.pemasukan || 0) - (s.pengeluaran || 0)))}${row('Total barang keluar', s.keluar)}${row('Total barang kembali', s.kembali)}${row('Jumlah pembatalan', s.batal)}${row('Jumlah pergantian barang', s.ganti)}${row('Aktivitas staff', `${s.aktivitas} aktivitas${(s.perStaff || []).length ? '<br><small>' + s.perStaff.map(([n, c]) => `${esc(n)}: ${c}`).join(' · ') + '</small>' : ''}`)}</table>
        <p><strong>File di folder:</strong></p><ul>${(d.files || []).map((f) => `<li><i class="fa-regular fa-file-pdf" style="color:#c0392b"></i> ${esc(f)}</li>`).join('')}</ul>
        <p><a class="mail-btn" href="${url('owner/integrasi?folder=' + d.period)}"><i class="fa-brands fa-google-drive"></i> ${esc(d.folder)}</a></p>`);
    }
    return shell(`<p>${esc(m.subject)}</p>`);
  }
  function mailText(m) {
    const st = DB.settings(); const d = m.data || {};
    if (m.kind === 'monthly_report') { const s = d.summary || {};
      return `Rekap laporan operasional bulan ${monthName(d.period)} telah dibuat dan disimpan pada Google Drive.\n\nTotal transaksi rental: ${s.rental}\nTotal penjualan: ${s.penjualan}\nTotal pemasukan: ${rupiah(s.pemasukan)}\nTotal pengeluaran: ${rupiah(s.pengeluaran)}\nBarang keluar: ${s.keluar}\nBarang kembali: ${s.kembali}\nPembatalan: ${s.batal}\nPergantian barang: ${s.ganti}\nAktivitas staff: ${s.aktivitas}\n\nFolder: ${d.folder}\n${url('owner/integrasi?folder=' + d.period)}`; }
    return `Halo ${d.name},\n\n${m.kind === 'staff_invite' ? `Akun staff Anda di ${st.storeName} telah dibuat oleh Owner (${d.by}).` : `Kata sandi akun staff Anda telah diatur ulang oleh Owner (${d.by}).`}\n\nNama toko: ${st.storeName}\nNama akun: ${d.name}\nEmail akun: ${d.email}\nRole: ${roleLabel(d.role)}\nKata sandi sementara: ${d.tempPassword}\nLink website: ${url('masuk')}\n\nCara masuk:\n1. Buka link website di atas.\n2. Masuk dengan email dan kata sandi sementara.\n3. Buat kata sandi baru saat pertama login.\n\nAkun ini dibuat oleh Owner ${st.storeName}.`;
  }
  function mailModal(m) {
    const mailto = `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(mailText(m))}`;
    UI.modal({ title: 'Pratinjau email', size: 'lg', body: mailHtml(m), foot: `<a class="btn btn-light" href="${mailto}"><i class="fa-regular fa-envelope"></i> Buka di aplikasi email</a><button class="btn btn-primary" data-close>Tutup</button>` });
  }

  window.Reports = { R, TYPES, build: (type, f, t) => R[type](f, t), toSpec, MONTHLY, monthName, monthRange, prevPeriod, folderName, fileName, monthSummary, generateMonthly, autoMonthly, downloadArchiveFile, mailHtml, mailText, mailModal };
})();
