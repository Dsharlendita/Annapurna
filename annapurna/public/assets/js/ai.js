(function () {
  const { DB, Rules, D, rupiah } = window.Ann;
  const { $, $$, esc, asset, url, toast, modal, Cart } = window.UI;

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (q, words) => words.some((w) => (` ${q} `).includes(` ${w} `) || (w.includes(' ') && q.includes(w)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = (id) => DB.product(id);
  const store = () => DB.settings();

  /* Jawaban layanan tambahan (harga diambil dari pengaturan toko) */
  function svcAnswer(k) {
    const st = store(); const { Svc } = Ann;
    if (k === 'laundry') {
      const L = DB.laundryPrices();
      return `Kami menerima <b>laundry perlengkapan outdoor</b> milik sendiri:<ul>${L.map((c) => `<li>${esc(c.name)}: mulai <b>${rupiah(Math.min(...c.items.map((i) => i.price)))}</b></li>`).join('')}</ul>Barang dibawa langsung ke toko (<b>tidak ada layanan antar jemput laundry</b>). Alamat: ${esc(st.address)}. Lihat harga lengkapnya di <a href="${url('laundry')}">halaman Laundry</a>.`;
    }
    if (k === 'pasang') return `Ada 3 pilihan <b>jasa tenda</b> (harga per tenda, di luar ongkir):<ul>${Svc.TENT_MODES.map((m) => `<li><b>${Svc.spec(m).short} ${rupiah(Svc.fee(m))}</b>: ${Svc.spec(m).desc}</li>`).join('')}</ul>Pilih <b>Jasa tenda</b> saat checkout sewa, isi lokasi dan jamnya. Ongkir sesuai jarak dikonfirmasi admin via WhatsApp setelah DP, dibayar langsung ke admin (tidak masuk DP).`;
    return `Bisa! Saat checkout sewa, pilih <b>Diantar ke lokasi</b> lalu isi alamat dan jam antar. Ongkir dihitung sesuai jarak dan dikonfirmasi admin via WhatsApp setelah DP (tidak masuk DP). Pengembaliannya bisa kamu antar sendiri ke toko atau dijemput, diatur bersama admin.<br>Mau sekalian dipasangkan tendanya? Pilih <b>Jasa tenda</b> (mulai ${rupiah(Math.min(...Svc.TENT_MODES.map((m) => Svc.fee(m))))}/tenda). Catatan: laundry tidak ada antar jemput.`;
  }
  function knowledge() {
    const s = store();
    const banks = s.banks.map((b) => `${b.bank} ${b.number} a.n. ${b.holder}`).join(', ');
    return [
      { id: 'cara', keys: ['cara sewa', 'cara booking', 'gimana sewa', 'bagaimana sewa', 'cara pesan', 'langkah', 'prosedur', 'alur'], title: 'Cara sewa',
        a: `Caranya gampang:<ol><li>Pilih alat atau paket di katalog, lalu tentukan tanggal ambil & kembali.</li><li>Checkout dan bayar DP ${s.dpPercent}% lewat transfer atau QRIS.</li><li>Unggah bukti bayar, admin akan mengonfirmasi.</li><li>Ambil barang di toko dengan nota digital & kartu identitas. Sisa pembayaran dilunasi saat pengambilan.</li></ol>` },
      { id: 'dp', keys: ['dp', 'uang muka', 'bayar', 'pembayaran', 'transfer', 'rekening', 'qris', 'lunas', 'pelunasan'], title: 'Pembayaran & DP',
        a: `Booking dikunci dengan <b>DP ${s.dpPercent}%</b> dari total sewa. Sisanya dibayar saat mengambil barang di toko.<br>Rekening: ${esc(banks)}. Bisa juga lewat QRIS di halaman pembayaran.` },
      { id: 'batal', keys: ['batal', 'cancel', 'refund', 'pembatalan', 'h-2', 'uang kembali', 'reschedule'], title: 'Pembatalan',
        a: `${s.cancelPolicy.map((t) => esc(t)).join('<br>')}<br>Pembatalan diajukan dari halaman <a href="${url('pesanan')}">Pesanan Saya</a>.` },
      { id: 'denda', keys: ['denda', 'telat', 'terlambat', 'rusak', 'hilang', 'lewat', 'molor'], title: 'Denda',
        a: `Barang dikembalikan paling lambat tanggal kembali pukul <b>${esc(String(s.returnTime).replace(':', '.'))} WIB</b> (jam tutup toko). Lewat dari itu dikenakan biaya <b>${esc(DB.lateFeeText())}</b>. Kerusakan atau kehilangan menjadi tanggung jawab penyewa sesuai hasil pengecekan bersama saat pengembalian.` },
      { id: 'jam', keys: ['jam', 'buka', 'tutup', 'operasional', 'libur', 'hari apa'], title: 'Jam buka',
        a: `Toko buka <b>${esc(s.hours)}</b>.` },
      { id: 'lokasi', keys: ['lokasi', 'alamat', 'dimana', 'di mana', 'maps', 'tempat', 'toko', 'arah'], title: 'Lokasi toko',
        a: `Alamat toko: <b>${esc(s.address)}</b>. Lihat peta di <a href="${url('kontak')}#lokasi">halaman Kontak</a>.` },
      { id: 'antar', keys: ['antar', 'diantar', 'kirim', 'dikirim', 'delivery', 'ongkir', 'cod', 'gojek', 'grab'], title: 'Pengantaran',
        a: svcAnswer('antar') },
      { id: 'laundry', keys: ['laundry', 'londri', 'cuci tenda', 'cuci sepatu', 'cuci carrier', 'cuci jaket', 'cuci sleeping bag', 'harga cuci', 'jasa cuci'], title: 'Laundry',
        a: svcAnswer('laundry') },
      { id: 'pasang', keys: ['bongkar pasang', 'pasang tenda', 'pasangin', 'bongkar tenda', 'dirikan tenda', 'setup tenda', 'jasa pasang', 'jasa tenda', 'pasang saja', 'bongkar saja'], title: 'Jasa tenda',
        a: svcAnswer('pasang') },
      { id: 'syarat', keys: ['syarat', 'ktp', 'ktm', 'sim', 'identitas', 'jaminan', 'ketentuan', 'aturan'], title: 'Syarat sewa',
        a: `<ul>${s.rentalTerms.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` },
      { id: 'hitung', keys: ['batas pengembalian', 'batas kembali', 'pengembalian', 'kembali jam', 'kapan kembali', 'hitung', 'durasi', 'lama sewa', 'per hari', 'per malam', 'permalam', 'kegiatan', 'ekspedisi', '24 jam', 'berapa hari', 'hitungan', 'paket hari'], title: 'Durasi sewa',
        a: `Ada 3 pilihan durasi:<ul>${(s.durations || []).map((d) => `<li><b>${esc(d.name)}</b>: ${esc(d.note)}. ${esc(d.example)}</li>`).join('')}</ul>Pengembalian maksimal sampai jam tutup toko pukul ${esc(String(s.returnTime).replace(':', '.'))} WIB. Lama sewa lain dihitung dari kombinasi tarif paling hemat (contoh 4 malam = kegiatan + 1 malam).` },
      { id: 'tektok', keys: ['tektok', 'paket tektok', 'tek tok'], title: 'Paket tektok',
        a: `${DB.packages().filter((p) => p.tektok).map((p) => `${esc(p.name)} ${rupiah(p.price)}`).join(' dan ')} (harga per malam).<ul>${(s.tektokTerms || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul><a href="${url('paket?type=tektok')}">Lihat paket tektok</a>` },
      { id: 'cuci', keys: ['cuci', 'kotor', 'bersih', 'mencuci', 'dicuci'], title: 'Barang kotor',
        a: `Sewa bersih, kembali kotor? Biar kami yang membersihkan. Kamu cukup memakainya dengan happy tanpa harus mencuci.<br>Mau mencuci perlengkapan milikmu sendiri? Lihat <a href="${url('laundry')}">daftar harga laundry</a>.` },
      { id: 'beli', keys: ['beli', 'jual', 'membeli', 'dijual', 'belanja'], title: 'Membeli alat',
        a: `Bisa! Buka halaman <a href="${url('belanja')}">Beli Alat</a>, masukkan ke keranjang, lalu checkout. Barang diambil di toko.` },
      { id: 'ganti', keys: ['ganti barang', 'tukar', 'ubah pesanan', 'ganti alat', 'upgrade'], title: 'Ganti barang',
        a: `Setelah booking, kamu bisa mengajukan ganti barang dari <a href="${url('pesanan')}">Pesanan Saya</a>. Selisih harga dihitung otomatis dan admin yang menyetujui.` },
      { id: 'kontak', keys: ['admin', 'cs', 'whatsapp', 'wa', 'telepon', 'hubungi', 'nomor', 'kontak', 'manusia', 'orang'], title: 'Hubungi admin',
        a: `Kamu bisa langsung chat admin di WhatsApp <b>${esc(s.phone)}</b>.`, wa: true },
    ];
  }

  function matchProduct(q) {
    const products = DB.products();
    let best = null, score = 0;
    products.forEach((p) => {
      /* Kata umum (sewa, beli, paket, …) diabaikan supaya "bisa sewa untuk sekolah?" tidak dianggap menanyakan produk "… (Sewa)" */
      const words = norm(p.name).split(' ').filter((w) => !['sewa', 'jual', 'beli', 'paket', 'set', 'dan', 'untuk', 'isi'].includes(w));
      if (!words.length) return;
      const hit = words.filter((w) => (w.length > 2 || /^\d/.test(w)) && ` ${q} `.includes(` ${w} `)).length;
      const sc = hit + hit / words.length + (q.includes(norm(p.name)) ? 2 : 0);
      if (hit && sc > score) { best = p; score = sc; }
    });
    return best;
  }

  const STATUS_TEXT = {
    menunggu_pembayaran: 'menunggu pembayaran DP', menunggu_konfirmasi: 'bukti bayar sedang dicek admin', dikonfirmasi: 'sudah dikonfirmasi, siap diambil',
    disewa: 'sedang disewa', selesai: 'selesai', dibatalkan: 'dibatalkan', diproses: 'sedang diproses', dikemas: 'sedang dikemas', siap_diambil: 'siap diambil di toko',
  };
  function orderCard(x) {
    const isRent = x.id.startsWith('RNT');
    const next = isRent ? ({ menunggu_pembayaran: 'Selesaikan pembayaran DP agar booking terkunci.', menunggu_konfirmasi: 'Admin biasanya mengonfirmasi dalam 1×24 jam.', dikonfirmasi: `Ambil barang tanggal ${D.fmtDate(x.start, true)} dengan nota digital & KTP.`, disewa: `Kembalikan paling lambat ${D.fmtDate(x.end, true)}.`, selesai: 'Terima kasih! Jangan lupa beri ulasan.' })[x.status] || '' : '';
    return `<div class="ai-order"><div class="ai-order-h"><strong>${NO(x)}</strong><span class="ai-st st-${x.status}">${STATUS_TEXT[x.status] || x.status}</span></div>
      <p>${esc(x.items.map((i) => `${i.qty}× ${i.name}`).join(', '))}</p>
      ${isRent ? `<p class="muted">${D.fmtRange(x.start, x.end)} · Total ${rupiah(x.total)}</p>` : `<p class="muted">Total ${rupiah(x.total)}</p>`}
      ${next ? `<p class="ai-next"><i class="fa-solid fa-circle-info"></i> ${next}</p>` : ''}
      <a class="ai-link" href="${url(isRent ? 'pesanan?id=' + x.id : 'pesanan?tab=beli')}">Lihat detail <i class="fa-solid fa-arrow-right"></i></a></div>`;
  }

  function parsePlan(text) {
    const q = norm(text);
    const plan = { people: null, nights: null, type: null, place: null, own: [], raw: text };
    const num = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };
    const toN = (v) => (num[v] != null ? num[v] : parseInt(v, 10));
    let m = q.match(/(\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*(orang|org|pax|person|anak|teman)/);
    if (m) plan.people = toN(m[1]);
    else if (has(q, ['sendiri', 'solo', 'sendirian'])) plan.people = 1;
    else if (has(q, ['berdua', 'couple', 'pasangan', 'pacar'])) plan.people = 2;
    else if (has(q, ['bertiga'])) plan.people = 3;
    else if (has(q, ['berempat'])) plan.people = 4;
    else if (has(q, ['berlima'])) plan.people = 5;
    else if (has(q, ['keluarga'])) plan.people = 4;
    else if (has(q, ['rombongan', 'komunitas', 'kampus', 'kelas', 'organisasi'])) plan.people = 8;
    m = q.match(/(\d+|satu|dua|tiga|empat|lima)\s*(malam|mlm)/);
    if (m) plan.nights = toN(m[1]);
    else if ((m = q.match(/(\d+|satu|dua|tiga|empat|lima)\s*hari/))) plan.nights = Math.max(0, toN(m[1]) - 1);
    else if (has(q, ['tektok', 'sehari', 'pp', 'tanpa menginap'])) plan.nights = 0;
    const places = { slamet: 'Gunung Slamet', prau: 'Gunung Prau', sindoro: 'Gunung Sindoro', sumbing: 'Gunung Sumbing', baturraden: 'Baturraden', dieng: 'Dieng', 'curug': 'Curug', pantai: 'pantai', 'telaga': 'telaga' };
    Object.keys(places).forEach((k) => { if (!plan.place && q.includes(k)) plan.place = places[k]; });
    if (has(q, ['naik gunung', 'mendaki', 'hiking', 'pendakian', 'muncak', 'summit', 'tektok', 'trekking']) || ['Gunung Slamet', 'Gunung Prau', 'Gunung Sindoro', 'Gunung Sumbing'].includes(plan.place)) plan.type = 'hiking';
    else if (has(q, ['camping', 'kemah', 'berkemah', 'camp', 'glamping', 'piknik', 'camping ground']) || ['Baturraden', 'pantai', 'telaga', 'Dieng', 'Curug'].includes(plan.place)) plan.type = 'camping';
    const own = [['tenda', 'tent'], ['sleeping bag', 'sb', 'kantong tidur'], ['matras'], ['carrier', 'tas', 'ransel'], ['kompor', 'masak'], ['lampu', 'senter', 'headlamp'], ['kursi']];
    if (/(sudah|udah|sdh|punya|bawa sendiri)/.test(q)) own.forEach((ws, i) => { if (ws.some((w) => new RegExp(`(sudah|udah|sdh|punya|bawa)[a-z ]{0,20}${w}`).test(q))) plan.own.push(['tent', 'sleep', 'mat', 'bag', 'cook', 'light', 'chair'][i]); });
    return plan;
  }

  function nextWeekend() {
    const d = new Date(D.today() + 'T00:00:00'); const add = (6 - d.getDay() + 7) % 7 || 7;
    return D.addDays(D.today(), add);
  }

  function recommend(plan, start, end) {
    const people = Math.max(1, plan.people || 2);
    const nights = plan.nights == null ? 1 : plan.nights;
    const type = plan.type || (nights === 0 ? 'hiking' : 'camping');
    const own = new Set(plan.own);
    const lines = [];
    const add = (pid, qty, why, role) => { if (qty > 0 && P(pid)) lines.push({ pid, qty, why, role }); };
    if (!own.has('tent') && nights > 0) {
      /* Pilih kombinasi tenda Annapurna: kapasitas 6, 4-5, 4, dan 2 orang */
      let left = people; const tents = {};
      if (type === 'hiking') { tents['tnd-2'] = Math.ceil(people / 2); left = 0; }
      while (left > 0) { const k = left >= 6 ? 'tnd-6' : left === 5 ? 'tnd-45' : left >= 3 ? 'tnd-4' : 'tnd-2'; tents[k] = (tents[k] || 0) + 1; left -= ({ 'tnd-6': 6, 'tnd-45': 5, 'tnd-4': 4, 'tnd-2': 2 })[k]; }
      Object.entries(tents).forEach(([k, n]) => add(k, n, type === 'hiking' ? 'Tenda 2 orang, ringan dibawa mendaki' : `Tenda double layer, tahan air & angin`, 'tent'));
    }
    if (!own.has('sleep') && nights > 0) add('oe-sb', people, 'Satu sleeping bag per orang', 'sleep');
    if (!own.has('mat') && nights > 0) add('oe-matras', people, 'Alas tidur di dalam tenda', 'mat');
    if (!own.has('bag') && type === 'hiking') add(nights > 0 ? 'crr-60s' : 'tas-hydro', people, nights > 0 ? 'Carrier 60 L untuk bawa semua alat' : 'Hydropack untuk naik-turun sehari', 'bag');
    if (!own.has('cook') && nights > 0) { add(people >= 4 ? 'ck-ds300' : 'ck-ds200', Math.ceil(people / 6), 'Nesting untuk masak dan bikin kopi', 'cook'); add('ck-kompor', Math.ceil(people / 6), 'Kompor kotak camping', 'cook'); }
    if (!own.has('light')) { if (type === 'hiking') add('oe-headlamp', people, 'Penerangan di jalur malam', 'light'); else add('oe-lampu', Math.max(1, Math.ceil(people / 4)), 'Penerangan di dalam tenda', 'light'); }
    if (!own.has('chair') && type === 'camping' && nights > 0) add('oe-kursi', people, 'Santai di camping ground', 'chair');
    const days = Math.max(1, D.diffDays(start, end));
    const priced = lines.map((l) => { const p = P(l.pid); const avail = Rules.available(l.pid, start, end); const unit = Rules.unitPrice(p, days); return { ...l, p, price: unit, sub: unit * l.qty, avail, ok: avail >= l.qty }; });
    const custom = priced.reduce((s, l) => s + l.sub, 0);
    const pkType = nights === 0 ? 'tektok' : 'tenda';
    const pkgs = DB.packages().filter((pk) => pk.type === pkType && (pk.pMin || 1) <= people && (pk.pMax || people) >= people);
    let pkg = null;
    pkgs.forEach((pk) => {
      const covered = pk.items.filter((i) => priced.some((l) => l.pid === i.productId || (P(l.pid) && P(i.productId) && P(l.pid).cat === P(i.productId).cat))).length;
      const avail = Rules.packageAvailable(pk.id, start, end);
      const score = covered / Math.max(1, pk.items.length) + (avail ? 0.5 : 0);
      if (!pkg || score > pkg.score) pkg = { pk, score, avail, total: Rules.unitPrice(pk, days), normal: pk.items.reduce((s, i) => s + Rules.unitPrice(P(i.productId), days) * i.qty, 0) };
    });
    return { people, nights, type, days, start, end, lines: priced, custom, pkg, place: plan.place, own: [...own] };
  }

  /* Jawaban dari aturan tanya jawab (topik bawaan atau buatan Owner di Konfigurasi Sistem → Asisten Trip) */
  const ACT_LINK = { katalog: ['Lihat Sewa Alat', 'katalog'], paket: ['Lihat Paket Sewa', 'paket'], belanja: ['Lihat Beli Alat', 'belanja'], laundry: ['Lihat Laundry', 'laundry'], pesanan: ['Pesanan Saya', 'pesanan'], kontak: ['Halaman Kontak', 'kontak'] };
  function fromRule(r) {
    const base = r.builtin && !String(r.answer || '').trim() ? (knowledge().find((k) => k.id === r.id) || {}).a : DB.chatRender(r.answer);
    const al = ACT_LINK[r.action];
    return { html: base || 'Maaf, jawabannya belum diisi.', wa: r.action === 'wa', chips: r.builtin ? related(r.id) : [], actions: al ? [{ label: al[0], href: url(al[1]) }] : undefined, rule: r.id };
  }
  function answer(text) {
    const q = norm(text);
    const user = DB.session();
    const SP = DB.chatSpecial();
    /* Nomor pesanan: nomor nota (RNTL/028/X/2026, ODR/005/X/2026, rnt/28/x/2026) — yang tertulis di nota customer.
       Kode internal lama (RNT-1003 / ORD-2001) tetap dikenali, tetapi jawaban selalu memakai nomor nota. */
    const UP = String(text).toUpperCase();
    const nota = NOPARSE(UP);
    const code = UP.match(/\b(RNT|ORD)-?\s?(\d{3,5})\b/);
    if (SP.nota && (nota || code)) {
      const key = nota || `${code[1]}-${code[2]}`;
      const x = DB.booking(key) || DB.sale(key);
      if (!x) return { html: `Aku tidak menemukan pesanan <b>${esc(nota ? key : 'dengan nomor itu')}</b>. Coba cek lagi nomor nota di nota digital kamu (contoh: RNTL/028/X/2026 untuk sewa atau ODR/005/X/2026 untuk pembelian), ya.` };
      if (!user || (user.role !== 'admin' && user.role !== 'owner' && x.customer.email !== user.email)) return { html: `Pesanan <b>${esc(NO(x))}</b> ditemukan. Demi keamanan, detailnya hanya bisa dilihat pemiliknya. Silakan <a href="${url('masuk?next=pesanan')}">masuk</a> dulu.` };
      return { html: `Ini status pesanan kamu:${orderCard(x)}` };
    }
    /* Aturan Owner berprioritas tinggi diperiksa sebelum aturan khusus lainnya */
    const hi = DB.chatMatch(text, 'tinggi'); if (hi) return fromRule(hi.rule);
    if (SP.pesanan && has(q, ['pesanan saya', 'pesananku', 'status pesanan', 'cek pesanan', 'booking saya', 'status booking', 'orderan', 'status sewa'])) {
      if (!user) return { html: `Masuk dulu supaya aku bisa melihat pesananmu, atau ketik nomor nota pesananmu (contoh: RNTL/028/X/2026).`, chips: ['Cara sewa'], actions: [{ label: 'Masuk', href: url('masuk?next=pesanan') }] };
      const L = [...DB.bookings(), ...DB.sales()].filter((x) => x.customer.email === user.email && !['selesai', 'dibatalkan'].includes(x.status)).sort((a, b) => String(b.createdAt).localeCompare(a.createdAt)).slice(0, 3);
      return { html: L.length ? `Pesanan aktif kamu:${L.map(orderCard).join('')}` : 'Kamu belum punya pesanan aktif. Mau aku bantu rencanakan trip?', chips: L.length ? [] : ['Rencanakan trip'] };
    }
    /* Layanan tambahan: laundry, bongkar pasang tenda, antar/jemput */
    if (SP.layanan && has(q, ['laundry', 'londri', 'cuci tenda', 'cuci sepatu', 'cuci carrier', 'cuci jaket', 'cuci sleeping', 'jasa cuci', 'harga cuci', 'nyuci'])) return { html: svcAnswer('laundry'), chips: ['Lokasi toko', 'Jam buka'], actions: [{ label: 'Lihat harga laundry', href: url('laundry') }] };
    if (SP.layanan && has(q, ['bongkar pasang', 'pasang tenda', 'pasangin', 'bongkar tenda', 'dirikan tenda', 'setup tenda', 'jasa pasang', 'dipasangin', 'dipasangkan', 'jasa tenda', 'pasang saja', 'bongkar saja'])) return { html: svcAnswer('pasang'), wa: true, chips: ['Pengantaran'], actions: [{ label: 'Sewa tenda', href: url('katalog?cat=tenda') }] };
    if (SP.layanan && has(q, ['antar', 'diantar', 'antarkan', 'kirim', 'dikirim', 'ongkir', 'jemput', 'delivery']) && !has(q, ['komplain', 'keluhan', 'kecewa', 'nego'])) return { html: svcAnswer('antar'), wa: true, chips: ['Jasa tenda', 'Lokasi toko'] };
    /* Urusan yang butuh keputusan admin → serahkan ke WhatsApp admin beserta pertanyaannya */
    if (SP.admin && has(q, ['antar', 'diantar', 'antarkan', 'kirim', 'dikirim', 'ongkir', 'cod', 'jemput', 'nego', 'negosiasi', 'diskon khusus', 'harga khusus', 'komplain', 'keluhan', 'kecewa', 'ganti jadwal', 'ubah jadwal', 'bukti bayar', 'salah transfer'])) {
      return { html: 'Untuk hal ini sebaiknya langsung ke <b>admin</b> ya, supaya bisa dicek dan diputuskan langsung. Tekan tombol di bawah, pertanyaanmu sudah otomatis tertulis di WhatsApp.', wa: true, handoff: true };
    }
    /* Cek kelengkapan isi keranjang sewa */
    if (SP.keranjang && has(q, ['keranjang', 'keranjangku', 'sudah lengkap', 'kurang apa', 'cek kelengkapan', 'lengkap belum'])) return cartCheck();
    /* Ukuran barang yang tersedia */
    const prodSz = SP.produk ? matchProduct(q) : null;
    if (prodSz && has(q, ['ukuran', 'size', 'nomor', 'no sepatu'])) {
      if (!DB.hasVariant(prodSz)) return { html: `<b>${esc(prodSz.name)}</b> tidak punya pilihan ukuran (satu ukuran untuk semua).` };
      const t = DB.trip() || { start: D.rel(1), end: D.rel(2) };
      const list = Rules.sizeAvailability(prodSz.id, t.start, t.end);
      return { html: `Ukuran <b>${esc(prodSz.name)}</b> untuk ${D.fmtRange(t.start, t.end)}:<ul>${list.map((o) => `<li>${esc(o.name.replace(/\s*\(.*\)/, ''))}: ${o.avail ? `<b>tersedia ${o.avail}</b>` : '<span style="color:var(--red)">habis</span>'}</li>`).join('')}</ul>Tanggal lain? Ganti tanggal di halaman barangnya.`, actions: [{ label: 'Lihat barang', href: url('produk?id=' + prodSz.id) }] };
    }
    /* Barang yang biasa disewa bersama */
    if (prodSz && has(q, ['bersama', 'barengan', 'biasa disewa', 'pelengkap', 'cocok dengan'])) {
      const L = alsoRented(prodSz.id, 4);
      return { html: L.length ? `Customer yang menyewa <b>${esc(prodSz.name)}</b> biasanya juga menyewa:<ul>${L.map((x) => `<li>${esc(x.p.name)} · ${rupiah(x.p.rent)}/malam</li>`).join('')}</ul>` : 'Belum ada data barang yang biasa disewa bersama.', actions: L.slice(0, 2).map((x) => ({ label: `Lihat ${x.p.name}`, href: url('produk?id=' + x.p.id) })) };
    }
    /* Bandingkan paket, mis. "beda paket 4P dan 5P" */
    if (SP.produk && has(q, ['beda', 'bedanya', 'banding', 'bandingkan', 'vs'])) {
      const pks = DB.packages().filter((k) => { const id = k.id.replace('pk-', ''); return q.includes(norm(k.name)) || q.split(' ').includes(id) || (id.length <= 3 && q.includes(id)); });
      if (pks.length >= 2) return { html: `Perbandingan paket:<table class="ai-tbl"><tr><th></th>${pks.map((k) => `<th>${esc(k.name)}</th>`).join('')}</tr><tr><td>Untuk</td>${pks.map((k) => `<td>${esc(k.people)}</td>`).join('')}</tr><tr><td>1 malam</td>${pks.map((k) => `<td>${rupiah(Rules.unitPrice(k, 1))}</td>`).join('')}</tr><tr><td>3 hari</td>${pks.map((k) => `<td>${rupiah(Rules.unitPrice(k, 3))}</td>`).join('')}</tr><tr><td>Isi</td>${pks.map((k) => `<td>${k.items.map((i) => `${i.qty}× ${esc((P(i.productId) || {}).name || '')}`).join('<br>')}</td>`).join('')}</tr></table>`, actions: [{ label: 'Lihat semua paket', href: url('paket') }] };
    }
    /* Harga barang tertentu (mis. "harga sepatu hiking mid 3 hari") — dijawab sebelum perencana trip */
    if (prodSz && prodSz.rent && has(q, ['harga', 'berapa', 'tarif', 'biaya', 'sewa'])) {
      const n = +(q.match(/(\d+)\s*(hari|malam|mlm)/) || [])[1] || 0;
      const t = Rules.productTiers(prodSz);
      const rows = Rules.tierRows(t).filter((x) => x.price).map((x) => `<li>${esc(x.name)}: <b>${rupiah(x.price)}</b></li>`).join('');
      return { html: `Tarif sewa <b>${esc(prodSz.name)}</b>:<ul>${rows}</ul>${n ? `Untuk <b>${n} malam</b>: <b>${rupiah(Rules.tierPlan(t, n).total)}</b> (${esc(Rules.tierLabel(t, n))}).` : ''}`, actions: [{ label: 'Lihat barang', href: url('produk?id=' + prodSz.id) }] };
    }
    const tripish = /\d+\s*(orang|org|malam|mlm|hari)/.test(q) || has(q, ['berdua', 'bertiga', 'berempat', 'rombongan', 'keluarga', 'naik gunung', 'mendaki', 'camping', 'kemah', 'tektok', 'slamet', 'prau', 'baturraden', 'rekomendasi', 'rencana', 'trip', 'butuh apa', 'sewa apa', 'perlu apa']);
    if (SP.trip && tripish && !has(q, ['batal', 'denda', 'dp', 'jam', 'alamat'])) {
      const plan = parsePlan(text);
      if (has(q, ['rencanakan trip', 'rencana trip']) && !plan.people && !plan.type) return { html: 'Siap! Ceritakan rencanamu: mau ke mana, berapa orang, dan berapa malam. Contoh: <i>"camping di Baturraden berempat 1 malam"</i>.', planner: true };
      const s = nextWeekend(); const e = D.addDays(s, Math.max(1, plan.nights == null ? 1 : plan.nights));
      const r = recommend(plan, s, e);
      const top = r.pkg && r.pkg.avail ? `Paket yang paling pas: <b>${esc(r.pkg.pk.name)}</b> (${rupiah(r.pkg.total)} untuk ${r.days} malam).` : '';
      return { html: `Untuk <b>${r.type === 'hiking' ? 'pendakian' : 'camping'}</b>${r.place ? ` ke ${esc(r.place)}` : ''}, ${r.people} orang, ${r.nights ? r.nights + ' malam' : 'tanpa menginap'}, kamu butuh sekitar:<ul>${r.lines.map((l) => `<li>${l.qty}× ${esc(l.p.name)}</li>`).join('')}</ul>Perkiraan <b>${rupiah(r.custom)}</b> untuk ${r.days} malam sewa. ${top}`, planner: plan, actions: [{ label: 'Buka perencana trip', plan: text }] };
    }
    const prod = SP.produk ? matchProduct(q) : null;
    if (prod && has(q, ['harga', 'berapa', 'tarif', 'biaya', 'ada', 'tersedia', 'stok', 'sisa', 'kosong', 'ready'])) {
      const t = D.rel(1), a = Rules.availableOn(prod.id, t);
      return { html: `<b>${esc(prod.name)}</b>${prod.rent ? ` disewakan ${esc(UI.tierText(Rules.productTiers(prod)))}` : ''}${prod.price ? `${prod.rent ? ',' : ''} dijual ${rupiah(prod.price)}` : ''}. ${prod.rent ? `Tersedia <b>${a} unit</b> untuk besok (${D.fmtDate(t, true)}).` : ''}`, actions: [{ label: 'Lihat barang', href: url('produk?id=' + prod.id) }] };
    }
    /* Topik bawaan & aturan Owner (prioritas normal): skor kata kunci tertinggi */
    const hit = DB.chatMatch(text, 'normal'); if (hit) return fromRule(hit.rule);
    if (has(q, ['halo', 'hai', 'hi', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'permisi', 'min'])) return { html: 'Halo! Ada yang bisa aku bantu? Kamu bisa tanya soal cara sewa, DP, pembatalan, denda, atau minta rekomendasi alat untuk trip.', chips: ['Cara sewa', 'Rencanakan trip', 'Cek pesanan'] };
    if (has(q, ['terima kasih', 'makasih', 'thanks', 'thx', 'mantap', 'oke', 'ok', 'siap'])) return { html: 'Sama-sama! Semoga petualanganmu seru.' };
    /* ELSE: belum ada aturan yang cocok → dicatat agar Owner bisa menjadikannya aturan baru */
    try { DB.logChatMiss(text); } catch (e) { /* abaikan */ }
    return { html: 'Maaf, aku belum yakin jawabannya. Pertanyaan ini sebaiknya langsung ke admin supaya tidak salah informasi. Pertanyaanmu sudah otomatis tertulis di WhatsApp.', wa: true, handoff: true, chips: ['Cara sewa', 'Pembayaran & DP', 'Pembatalan'] };
  }
  /* Cek kelengkapan keranjang untuk camping / mendaki */
  function cartCheck() {
    const rent = Cart.all().filter((c) => c.type === 'rent');
    if (!rent.length) return { html: 'Keranjang sewamu masih kosong. Mau aku bantu susun daftar alat untuk trip-mu?', chips: ['Rencanakan trip'], actions: [{ label: 'Lihat paket hemat', href: url('paket') }] };
    const pids = new Set(); let cap = 0;
    rent.forEach((c) => { const r = Cart.resolve(c); (r ? r.components : []).forEach((x) => pids.add(x.productId)); if (c.kind === 'product') pids.add(c.refId); });
    rent.forEach((c) => { const r = Cart.resolve(c); (r ? r.components : []).forEach((x) => { const pp = P(x.productId); const m = pp && pp.cat === 'tenda' && String(pp.name).match(/(\d+)(?:-(\d+))?\s*\(|Kapasitas\s+(\d+)(?:-(\d+))?/i); if (m) cap += (+(m[4] || m[3] || m[2] || m[1]) || 0) * x.qty * c.qty; }); });
    const hasCat = (cat, re) => [...pids].some((id) => { const pp = P(id); return pp && (pp.cat === cat || re.test(pp.name)); });
    const hasTent = hasCat('tenda', /tenda/i);
    const need = [];
    if (hasTent || cap) {
      if (![...pids].some((id) => /sleeping bag/i.test((P(id) || {}).name || ''))) need.push(['oe-sb', 'Sleeping bag', 'supaya tidak kedinginan malam hari']);
      if (![...pids].some((id) => /matras/i.test((P(id) || {}).name || ''))) need.push(['oe-matras', 'Matras', 'alas tidur di dalam tenda']);
      if (![...pids].some((id) => /lampu|headlamp/i.test((P(id) || {}).name || ''))) need.push(['oe-lampu', 'Lampu tenda', 'penerangan malam hari']);
      if (![...pids].some((id) => (P(id) || {}).cat === 'cooking')) need.push(['ck-kompor', 'Kompor', 'untuk masak & bikin minuman hangat']);
    } else {
      need.push(['tnd-2', 'Tenda', 'kalau berencana menginap']);
      if (![...pids].some((id) => /headlamp/i.test((P(id) || {}).name || ''))) need.push(['oe-headlamp', 'Headlamp', 'penerangan di jalur saat gelap']);
    }
    const t = rent[0];
    if (!need.length) return { html: `Keranjangmu sudah lengkap untuk kebutuhan dasar${cap ? ` camping sekitar <b>${cap} orang</b>` : ''}. Jangan lupa: kembali paling lambat <b>${D.fmtDate(t.end, true)} pukul ${String(store().returnTime || '22:00').replace(':', '.')} WIB</b>.` };
    return { html: `Dari isi keranjangmu${cap ? ` (tenda untuk sekitar <b>${cap} orang</b>)` : ''}, yang mungkin masih kurang:<ul>${need.map(([, n, why]) => `<li><b>${n}</b>, ${why}</li>`).join('')}</ul>Abaikan kalau kamu sudah punya sendiri.`,
      actions: need.filter(([id]) => P(id)).slice(0, 3).map(([id, n]) => ({ label: `+ ${n}`, add: { id, start: t.start, end: t.end, qty: /sleeping|matras/i.test(n) && cap ? cap : 1 } })) };
  }
  function related(id) {
    return ({ cara: ['Pembayaran & DP', 'Syarat sewa', 'Rencanakan trip'], dp: ['Pembatalan', 'Cara sewa'], batal: ['Pembayaran & DP', 'Denda'], denda: ['Hitungan hari', 'Syarat sewa'], jam: ['Lokasi toko'], lokasi: ['Jam buka', 'Pengantaran'], antar: ['Jasa tenda', 'Lokasi toko'], laundry: ['Lokasi toko', 'Jam buka'], pasang: ['Pengantaran', 'Cara sewa'], syarat: ['Denda', 'Cara sewa'] })[id] || ['Cara sewa', 'Rencanakan trip'];
  }

  function alsoRented(pid, limit) {
    const count = {};
    DB.bookings().filter((b) => b.status !== 'dibatalkan').forEach((b) => {
      const ids = new Set(); b.items.forEach((i) => i.components.forEach((c) => ids.add(c.productId)));
      if (!ids.has(pid)) return;
      ids.forEach((o) => { if (o !== pid) count[o] = (count[o] || 0) + 1; });
    });
    DB.packages().forEach((pk) => { if (pk.items.some((i) => i.productId === pid)) pk.items.forEach((i) => { if (i.productId !== pid) count[i.productId] = (count[i.productId] || 0) + 0.5; }); });
    const me = P(pid);
    return Object.entries(count).map(([id, n]) => ({ p: P(id), n })).filter((x) => x.p && x.p.rent && x.p.cat !== me.cat).sort((a, b) => b.n - a.n).slice(0, limit || 4);
  }

  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  /* =====================================================================
     Asisten Trip + Tanya jawab memakai Gemini (Google) LEWAT SERVER.
     - Kunci API Gemini hanya ada di .env server Laravel, tidak pernah di JavaScript.
     - FE mengirim pertanyaan ke POST /api/chat dan teks rencana ke POST /api/ai/rencana.
     - Harga, stok, dan status pesanan dihitung sistem (server / Rules), bukan ditebak model.
     - Bila endpoint belum ada, server error, kuota habis (429), atau terlalu lama (408),
       asisten otomatis memakai jawaban berbasis aturan di file ini sebagai cadangan.
     Kontrak lengkap: dokumen teknis Bagian 16.
     ===================================================================== */
  const AI_TIMEOUT = 25000;
  const useFallback = (r) => !r || (!r.ok && (r.status === 0 || r.status === 404 || r.status === 405 || r.status === 408 || r.status === 429 || r.status >= 500));
  /* Teks polos dari HTML gelembung chat (untuk riwayat yang dikirim ke server) */
  const plainOf = (html) => { const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html'); return (d.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600); };
  /* Jawaban server berupa TEKS (bukan HTML). Diubah aman: escape dulu, lalu **tebal**, daftar "- ", dan baris baru. */
  function mdLite(t) {
    const lines = String(t || '').replace(/\r/g, '').split('\n');
    let html = '', inList = false;
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    lines.forEach((ln) => {
      const m = ln.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(m[1])}</li>`; return; }
      if (inList) { html += '</ul>'; inList = false; }
      html += ln.trim() ? `${inline(ln)}<br>` : '<br>';
    });
    if (inList) html += '</ul>';
    return html.replace(/(<br>)+$/, '').replace(/^(<br>)+/, '');
  }
  /* Hanya alamat internal situs (tanpa "//", "javascript:", atau domain lain) */
  const safeHref = (h) => { h = String(h || '').trim().replace(/^\//, ''); return /^[a-z0-9][a-z0-9/_.?=&%+-]*$/i.test(h) && !h.includes('//') ? url(h) : null; };
  const validDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : null);
  /* Tombol aksi dari server divalidasi terhadap data yang ada; yang tidak dikenal dibuang */
  function serverActions(list) {
    const trip = DB.trip() || {};
    return (Array.isArray(list) ? list : []).slice(0, 4).map((a) => {
      if (!a || typeof a !== 'object') return null;
      const label = String(a.label || '').slice(0, 60); if (!label) return null;
      const jenis = a.jenis || a.type;
      if (jenis === 'link') { const href = safeHref(a.href); return href ? { label, href } : null; }
      if (jenis === 'rencana') return { label, plan: String(a.teks || a.text || '').slice(0, 200) };
      if (jenis === 'keranjang') {
        const qty = Math.min(20, Math.max(1, parseInt(a.qty, 10) || 1));
        const start = validDate(a.mulai) || trip.start || nextWeekend();
        const end = validDate(a.selesai) && a.selesai > start ? a.selesai : (trip.end > start ? trip.end : D.addDays(start, 1));
        if ((a.kind || a.tipe) === 'package') { const pk = DB.packages().find((k) => k.id === a.id); return pk ? { label, addPkg: { id: pk.id, qty, start, end } } : null; }
        return P(a.id) ? { label, add: { id: a.id, qty, start, end } } : null;
      }
      return null;
    }).filter(Boolean);
  }
  /* Konteks yang dikirim: halaman, tanggal trip, isi keranjang. TANPA data pribadi (nama, HP, alamat, identitas). */
  function aiContext() {
    const page = pageKind();
    return {
      halaman: page,
      produk: page === 'produk' ? new URLSearchParams(location.search).get('id') : null,
      trip: DB.trip() || null,
      keranjang: Cart.all().slice(0, 20).map((c) => ({ tipe: c.type, jenis: c.kind, id: c.refId, qty: c.qty, ukuran: c.size || null, mulai: c.start || null, selesai: c.end || null })),
    };
  }
  async function serverAnswer(text, history) {
    if (!window.Api) return null;
    const r = await Api.post('api/chat', { pesan: String(text).slice(0, 500), riwayat: history, konteks: aiContext() }, { timeout: AI_TIMEOUT, redirectOn401: false });
    if (useFallback(r)) return null;
    if (!r.ok) return { html: esc(r.msg || 'Maaf, asisten belum bisa menjawab pertanyaan ini.'), wa: true, src: 'gemini' };
    const d = r.data || {};
    const html = mdLite(d.teks || d.text || '');
    if (!html) return null;
    return { html, actions: serverActions(d.aksi || d.actions), chips: (Array.isArray(d.saran) ? d.saran : []).filter((x) => typeof x === 'string').map((x) => x.slice(0, 60)).slice(0, 4), wa: !!(d.wa || d.handoff), handoff: !!d.handoff, src: 'gemini' };
  }
  /* Rencana trip: Gemini hanya MEMAHAMI cerita (jumlah orang, malam, jenis, tempat, alat yang sudah dimiliki).
     Daftar alat, stok, dan harga tetap dihitung recommend() dengan aturan toko. */
  async function understandPlan(text, start, end) {
    const base = parsePlan(text);
    if (!window.Api) return base;
    const r = await Api.post('api/ai/rencana', { teks: String(text).slice(0, 500), mulai: start || null, selesai: end || null }, { timeout: AI_TIMEOUT, redirectOn401: false });
    if (!r.ok || !r.data || typeof r.data !== 'object') return base;
    const d = r.data; const int = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
    const OWN = ['tent', 'sleep', 'mat', 'bag', 'cook', 'light', 'chair'];
    const people = int(d.orang, 1, 50), nights = int(d.malam, 0, 14);
    return {
      people: people != null ? people : base.people,
      nights: nights != null ? nights : base.nights,
      type: ['hiking', 'camping'].includes(d.jenis) ? d.jenis : base.type,
      place: typeof d.tempat === 'string' && d.tempat.trim() ? d.tempat.trim().slice(0, 60) : base.place,
      own: Array.isArray(d.sudah_punya) ? d.sudah_punya.filter((x) => OWN.includes(x)) : base.own,
      raw: text, src: 'gemini',
    };
  }

  function mdIcon() { return '<i class="fa-solid fa-wand-magic-sparkles"></i>'; }

  /* Saran pertanyaan sesuai halaman yang sedang dibuka */
  const CTX_PAGES = ['produk', 'paket', 'keranjang', 'pesanan', 'invoice', 'checkout', 'pembayaran'];
  const COMPACT_PAGES = ['checkout', 'pembayaran'];
  /* Nama halaman dari alamat URL (data-page tidak selalu unik, mis. halaman produk memakai "katalog") */
  const pageKind = () => (location.pathname.replace(/\/+$/, '').split('/').pop() || 'beranda').replace(/\.html$/, '');
  function contextChips() {
    const page = pageKind();
    if (page === 'produk') {
      const p = P(new URLSearchParams(location.search).get('id'));
      if (p) return [`Harga ${p.name} 3 hari`, ...(DB.hasVariant(p) ? [`Ukuran ${p.name} yang tersedia`] : []), `Barang yang biasa disewa bersama ${p.name}`, 'Batas pengembalian'];
    }
    if (page === 'paket') return ['Paket untuk 5 orang camping 1 malam', 'Beda paket 4P dan 5P', 'Bisa tukar item paket tektok?', 'Paket BBQ isinya apa'];
    if (page === 'keranjang' || page === 'checkout') return ['Apakah keranjangku sudah lengkap?', 'Batas pengembalian', 'Denda kalau telat', 'Pembayaran & DP'];
    if (page === 'pesanan' || page === 'invoice' || page === 'pembayaran') return ['Cek pesanan', 'Batas pengembalian', 'Denda kalau telat', 'Pembatalan'];
    return ['Cara sewa', 'Pembayaran & DP', 'Pembatalan', 'Cek pesanan', 'Rencanakan trip'];
  }
  function isCustomerPage() { return !document.querySelector('.admin') && !document.body.dataset.base?.includes('..') && !/^admin/.test(document.body.dataset.page || ''); }

  function chatWidget() {
    if (!isCustomerPage() || document.getElementById('aiChat')) return;
    const KEY = 'annapurna:ai-chat';
    let log = []; try { log = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { log = []; }
    const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(log.slice(-40))); } catch (e) {} };
    const wrap = document.createElement('div'); wrap.id = 'aiChat';
    const s0 = nextWeekend();
    wrap.innerHTML = `<button class="ai-fab" id="aiFab" aria-label="Buka Asisten Trip" aria-expanded="false"><span class="ai-fab-ic">${mdIcon()}</span><span class="ai-fab-t">Asisten Trip</span></button>
      <section class="ai-panel" id="aiPanel" role="dialog" aria-label="Asisten Trip" hidden>
        <header class="ai-head"><span class="ai-av">${mdIcon()}</span><div><strong>Asisten Trip</strong><small><i class="fa-solid fa-circle"></i> Rencanakan trip &amp; tanya seputar sewa</small></div>
          <button class="ai-x" id="aiReset" title="Mulai ulang percakapan"><i class="fa-solid fa-rotate-right"></i></button><button class="ai-x" id="aiClose" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></header>
        <div class="ai-tabs" role="tablist">
          <button type="button" role="tab" data-t="plan" class="active"><i class="fa-solid fa-route"></i> Rencanakan Trip</button>
          <button type="button" role="tab" data-t="chat"><i class="fa-regular fa-comments"></i> Tanya Jawab</button>
        </div>
        <div class="ai-pane ai-plan" data-pane="plan">
          <p class="ai-plan-intro">Ceritakan rencanamu, asisten menyusun daftar alat, jumlah, dan total biayanya sekaligus cek stok.</p>
          <label class="ai-lbl" for="aiPlanText">Rencana trip</label>
          <textarea class="textarea" id="aiPlanText" rows="3" placeholder="Contoh: camping di Baturraden berempat 1 malam, sudah punya tenda"></textarea>
          <div class="ai-ex">${['Camping berempat 1 malam', 'Naik Slamet berdua 2 malam', 'Tektok Prau sendirian'].map((t) => `<button type="button">${t}</button>`).join('')}</div>
          <div class="ai-dates"><label>Ambil<input type="date" class="input" id="aiStart" value="${s0}" min="${D.today()}"></label><label>Kembali<input type="date" class="input" id="aiEnd" value="${D.addDays(s0, 1)}"></label></div>
          <button type="button" class="btn btn-primary btn-block" id="aiPlanGo"><i class="fa-solid fa-wand-magic-sparkles"></i> Buat rencana</button>
          <button type="button" class="ai-switch" data-go="chat">Pertanyaan soal sewa atau pesanan? <b>Buka Tanya Jawab</b></button>
        </div>
        <div class="ai-pane" data-pane="chat" hidden>
          <div class="ai-body" id="aiBody"></div>
          <div class="ai-chips" id="aiChips"></div>
          <form class="ai-form" id="aiForm"><input id="aiInput" placeholder="Tulis pertanyaan… (contoh: status RNTL/028/X/2026)" autocomplete="off" aria-label="Pesan"><button aria-label="Kirim"><i class="fa-solid fa-paper-plane"></i></button></form>
        </div>
        <a class="ai-admin" id="aiWaLink" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i><span>Butuh jawaban pasti? <b>Chat admin via WhatsApp</b></span><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
      </section>`;
    document.body.appendChild(wrap);
    document.body.classList.add('has-ai');
    const body = $('#aiBody'), chips = $('#aiChips'), input = $('#aiInput');
    $('#aiWaLink').href = UI.waLink('Halo Annapurna, saya butuh bantuan admin.');
    const bubble = (who, html, extra) => {
      const el = document.createElement('div'); el.className = `ai-msg ${who}`;
      el.innerHTML = `<div class="ai-bub">${html}</div>${extra || ''}`; body.appendChild(el); body.scrollTop = body.scrollHeight; requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; }); return el;
    };
    const actionsHtml = (r, q) => {
      const a = (r.actions || []).map((x, i) => `<button class="ai-act" data-i="${i}">${esc(x.label)}</button>`).join('');
      const waText = q ? `Halo admin ${store().storeName}, saya mau tanya: "${q}"` : `Halo admin ${store().storeName}, saya mau bertanya.`;
      const wa = r.wa ? `<a class="ai-act wa" href="${UI.waLink(waText)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> ${r.handoff ? 'Lanjut chat admin' : 'Chat admin'}</a>` : '';
      return a || wa ? `<div class="ai-acts">${a}${wa}</div>` : '';
    };
    const setChips = (list) => { chips.innerHTML = (list || []).map((c) => `<button type="button">${esc(c)}</button>`).join(''); };
    const render = () => {
      body.innerHTML = '';
      if (!log.length) {
        const u = DB.session();
        bubble('bot', `Halo${u ? ' ' + esc(u.name.split(' ')[0]) : ''}! Aku Asisten Trip Annapurna Adventure. Ini yang bisa aku bantu:<ul class="ai-can">
          <li><b>Rencanakan trip:</b> rekomendasi alat &amp; paket sesuai jumlah orang dan lama perjalanan, beserta perkiraan biaya</li>
          <li><b>Harga &amp; durasi sewa:</b> tarif per malam, kegiatan 3 hari, dan ekspedisi 5 hari</li>
          <li><b>Stok &amp; ukuran:</b> ketersediaan barang serta ukuran sepatu/jaket di tanggalmu</li>
          <li><b>Cek keranjang:</b> apakah perlengkapanmu sudah lengkap</li>
          <li><b>Info paket:</b> isi paket, perbandingan paket, tukar/upgrade item tektok</li>
          <li><b>Aturan sewa:</b> DP, pembatalan, batas pengembalian 22.00, denda, syarat identitas</li>
          <li><b>Status pesanan:</b> ketik nomor notanya, misal <b>RNTL/028/X/2026</b> (sewa) atau <b>ODR/005/X/2026</b> (pembelian)</li></ul>
          Butuh informasi pasti atau keputusan admin, misalnya soal pengantaran, harga khusus, keluhan, atau ubah jadwal? Hubungi admin lewat tombol <b>Chat admin via WhatsApp</b> di bawah.`);
        setChips(contextChips());
      } else { log.forEach((m) => bubble(m.who, m.html, m.extra)); setChips(contextChips()); }
    };
    const ask = async (text) => {
      text = String(text || '').trim(); if (!text) return;
      if (text === 'Rencanakan trip') { tab('plan'); return; }
      const map = { 'Cek pesanan': 'status pesanan saya', 'Rencanakan trip': 'rencanakan trip', 'Pembayaran & DP': 'pembayaran dp', 'Pembatalan': 'pembatalan', 'Syarat sewa': 'syarat sewa', 'Hitungan hari': 'hitungan hari', 'Lokasi toko': 'lokasi toko', 'Jam buka': 'jam buka', 'Pengantaran': 'diantar', 'Jasa tenda': 'jasa tenda bongkar pasang', 'Laundry': 'laundry', 'Denda': 'denda', 'Cara sewa': 'cara sewa' };
      const history = log.slice(-8).map((m) => ({ peran: m.who === 'me' ? 'user' : 'model', teks: plainOf(m.html) }));
      log.push({ who: 'me', html: esc(text) }); bubble('me', esc(text)); setChips([]); input.value = ''; input.disabled = true;
      const typing = bubble('bot', '<span class="ai-dots"><i></i><i></i><i></i></span>');
      /* Gemini lewat server dulu; bila tidak tersedia → jawaban berbasis aturan (cadangan) */
      let r = await serverAnswer(map[text] || text, history);
      if (!r) { await wait(350 + Math.random() * 350); r = answer(map[text] || text); }
      typing.remove(); input.disabled = false; input.focus();
      const extra = actionsHtml(r, text);
      const el = bubble('bot', r.html, extra); log.push({ who: 'bot', html: r.html, extra }); save();
      el.querySelectorAll('.ai-act[data-i]').forEach((b) => b.addEventListener('click', () => {
        const act = r.actions[+b.dataset.i];
        if (act.href) location.href = act.href;
        if (act.addPkg) { Cart.add({ type: 'rent', kind: 'package', refId: act.addPkg.id, qty: act.addPkg.qty || 1, start: act.addPkg.start, end: act.addPkg.end }); toast('Paket masuk ke keranjang.'); return; }
        if (act.plan != null) openPlanner(act.plan);
        if (act.add) { const pp = P(act.add.id); if (!pp) return; if (DB.hasVariant(pp)) { UI.quickRent('product', pp.id); return; } Cart.add({ type: 'rent', kind: 'product', refId: pp.id, qty: act.add.qty || 1, start: act.add.start, end: act.add.end }); b.disabled = true; b.textContent = `✓ ${pp.name} ditambahkan`; toast(`${esc(pp.name)} masuk keranjang.`); if (pageKind() === 'keranjang') setTimeout(() => location.reload(), 700); }
      }));
      if (r.planner === true) setChips(['Camping berempat 1 malam', 'Naik Slamet berdua 2 malam', 'Tektok sendiri']);
      else setChips(r.chips || []);
    };
    let cur = log.length || CTX_PAGES.includes(pageKind()) ? 'chat' : 'plan';
    const tab = (t) => {
      cur = t;
      wrap.querySelectorAll('.ai-tabs button').forEach((b) => { const on = b.dataset.t === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
      wrap.querySelectorAll('.ai-pane').forEach((p) => { p.hidden = p.dataset.pane !== t; });
      if (t === 'chat') { if (!body.children.length) render(); setTimeout(() => { body.scrollTop = body.scrollHeight; input.focus(); }, 60); }
      else setTimeout(() => $('#aiPlanText').focus(), 60);
    };
    const open = (t) => {
      $('#aiPanel').hidden = false; requestAnimationFrame(() => $('#aiPanel').classList.add('open'));
      $('#aiFab').classList.add('on'); $('#aiFab').setAttribute('aria-expanded', 'true'); document.body.classList.add('ai-open');
      tab(typeof t === 'string' ? t : cur);
    };
    const close = () => { $('#aiPanel').classList.remove('open'); $('#aiFab').classList.remove('on'); $('#aiFab').setAttribute('aria-expanded', 'false'); document.body.classList.remove('ai-open'); setTimeout(() => { $('#aiPanel').hidden = true; }, 220); };
    wrap.querySelector('.ai-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) tab(b.dataset.t); });
    wrap.querySelector('[data-go=chat]').addEventListener('click', () => tab('chat'));
    const planGo = () => {
      const text = $('#aiPlanText').value.trim();
      if (!text) { $('#aiPlanText').classList.add('err'); $('#aiPlanText').focus(); return; }
      /* Tanggal kembali bawaan (+1 hari) hanya dipakai bila diubah sendiri; selain itu lama trip diambil dari cerita ("2 malam") */
      close(); openPlanner(text, { start: $('#aiStart').value, end: $('#aiEnd').dataset.touched ? $('#aiEnd').value : '' });
    };
    $('#aiPlanGo').addEventListener('click', planGo);
    $('#aiPlanText').addEventListener('input', () => $('#aiPlanText').classList.remove('err'));
    $('#aiPlanText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); planGo(); } });
    wrap.querySelectorAll('.ai-ex button').forEach((b) => b.addEventListener('click', () => { $('#aiPlanText').value = b.textContent; $('#aiPlanText').classList.remove('err'); $('#aiPlanText').focus(); }));
    UI.dateGuard && UI.dateGuard($('#aiStart'), $('#aiEnd'));
    $('#aiEnd').addEventListener('change', () => { $('#aiEnd').dataset.touched = '1'; });
    $('#aiFab').addEventListener('click', () => ($('#aiPanel').hidden ? open() : close()));
    $('#aiClose').addEventListener('click', close);
    $('#aiReset').addEventListener('click', () => { log = []; save(); render(); $('#aiPlanText').value = ''; });
    $('#aiForm').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
    chips.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#aiPanel').hidden) close(); });
    /* Klik di luar jendela Asisten Trip menutup jendela (kecuali klik tombol pembukanya, modal, atau toast) */
    document.addEventListener('pointerdown', (e) => {
      const pn = $('#aiPanel'); if (!pn || pn.hidden || !pn.classList.contains('open')) return;
      if (e.target.closest('#aiPanel, #aiFab, .modal, .toast, .toasts, [data-ai-open]')) return;
      close();
    });
    /* Tombol "Tanya Asisten Trip" di halaman mana pun: <button data-ai-open data-ai-q="pertanyaan (opsional)"> */
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-ai-open]'); if (!b) return; e.preventDefault(); open('chat'); if (b.dataset.aiQ) setTimeout(() => ask(b.dataset.aiQ), 250); });
    if (COMPACT_PAGES.includes(pageKind())) wrap.classList.add('ai-compact');
    window.AIChat = { open, close, ask, tab };
  }

  function planResultHtml(r) {
    const role = { tent: 'fa-campground', sleep: 'fa-bed', mat: 'fa-rug', bag: 'fa-person-hiking', cook: 'fa-fire-burner', light: 'fa-lightbulb', chair: 'fa-chair' };
    const allOk = r.lines.every((l) => l.ok);
    const pk = r.pkg;
    return `<div class="tp-sum">
        <span><i class="fa-solid ${r.type === 'hiking' ? 'fa-mountain' : 'fa-campground'}"></i> ${r.type === 'hiking' ? 'Pendakian' : 'Camping'}${r.place ? ' · ' + esc(r.place) : ''}</span>
        <span><i class="fa-solid fa-user-group"></i> ${r.people} orang</span>
        <span><i class="fa-regular fa-moon"></i> ${r.nights ? r.nights + ' malam' : 'Tanpa menginap'}</span>
        <span><i class="fa-regular fa-calendar"></i> ${D.fmtRange(r.start, r.end)} · ${r.days} malam</span>
        ${r.own.length ? `<span><i class="fa-solid fa-check"></i> Sudah punya ${r.own.length} jenis alat</span>` : ''}
      </div>
      <div class="tp-grid">
        <div class="tp-opt">
          <div class="tp-opt-h"><strong>Rakit sendiri</strong><span>Sesuai kebutuhanmu</span></div>
          <ul class="tp-lines">${r.lines.map((l) => `<li><span class="tp-ic"><i class="fa-solid ${role[l.role] || 'fa-box'}"></i></span><img loading="lazy" decoding="async" src="${asset(l.p.img)}" alt=""><div><a href="${url('produk?id=' + l.pid)}"><b>${l.qty}× ${esc(l.p.name)}</b></a><small>${esc(l.why)}</small></div><span class="tp-av ${l.ok ? '' : 'no'}">${l.ok ? `${l.avail} tersedia` : `sisa ${l.avail}`}</span><strong>${rupiah(l.sub)}</strong></li>`).join('')}</ul>
          <div class="tp-total"><span>Total ${r.days} malam</span><strong>${rupiah(r.custom)}</strong></div>
          ${allOk ? '' : '<p class="tp-warn"><i class="fa-solid fa-triangle-exclamation"></i> Ada alat yang stoknya kurang di tanggal ini. Coba geser tanggal atau kurangi jumlah.</p>'}
          <button class="btn btn-primary btn-block" id="tpAddCustom" ${r.lines.length ? '' : 'disabled'}><i class="fa-solid fa-cart-plus"></i> Masukkan semua ke keranjang</button>
        </div>
        ${pk ? `<div class="tp-opt pk-opt">
          <div class="tp-opt-h"><strong>Atau pakai paket</strong><span class="tp-badge">Lebih praktis</span></div>
          <div class="tp-pk"><img loading="lazy" decoding="async" src="${asset(pk.pk.img)}" alt=""><div><b>${esc(pk.pk.name)}</b><small>${esc(pk.pk.tagline || '')}</small><small>${pk.pk.items.map((i) => `${i.qty}× ${esc(P(i.productId).name)}`).join(', ')}</small></div></div>
          <div class="tp-total"><span>${esc(Rules.tierLabel(Rules.packageTiers(pk.pk), r.days))}</span><strong>${rupiah(pk.total)}</strong></div>
          <p class="tp-note">${pk.avail ? `<i class="fa-solid fa-circle-check"></i> ${pk.avail} paket tersedia di tanggal ini` : '<i class="fa-solid fa-circle-xmark"></i> Paket penuh di tanggal ini'}${pk.normal > pk.total ? ` · hemat ${rupiah(pk.normal - pk.total)} dibanding sewa satuan isi paket` : ''}</p>
          <button class="btn btn-light btn-block" id="tpAddPkg" ${pk.avail ? '' : 'disabled'}><i class="fa-solid fa-box-open"></i> Sewa paket ini</button>
        </div>` : ''}
      </div>
      <p class="tp-disc"><i class="fa-solid fa-wand-magic-sparkles"></i> Rekomendasi dibuat otomatis dari rencanamu, stok, dan harga saat ini. Kamu tetap bisa mengubah jumlah di keranjang.</p>`;
  }

  function openPlanner(prefill, dates) {
    const s0 = (dates && dates.start) || nextWeekend();
    const m = modal({ title: `<span class="tp-title">${mdIcon()} Rencanakan Tripmu</span>`, size: 'lg', body: `
      <p class="muted" style="font-size:13.5px;margin-bottom:12px">Ceritakan rencanamu dengan bahasa sehari-hari. Asisten akan menyusun daftar alat, jumlah, dan biayanya.</p>
      <div class="tp-input"><textarea class="textarea" id="tpText" rows="2" placeholder="Contoh: mau camping di Baturraden berempat 1 malam, sudah punya tenda"></textarea></div>
      <div class="tp-ex">${['Camping di Baturraden berempat 1 malam', 'Naik Gunung Slamet berdua 2 malam', 'Tektok Prau sendirian', 'Kemah rombongan kampus 8 orang, sudah punya tenda'].map((t) => `<button type="button">${t}</button>`).join('')}</div>
      <div class="tp-dates"><label>Ambil<input type="date" class="input" id="tpStart" value="${s0}" min="${D.today()}"></label><label>Kembali<input type="date" class="input" id="tpEnd" value="${(dates && dates.end > s0 && dates.end) || D.addDays(s0, 1)}"></label><button class="btn btn-primary" id="tpGo"><i class="fa-solid fa-wand-magic-sparkles"></i> Buat rekomendasi</button></div>
      <div id="tpOut"></div>` });
    let last = null;
    const run = async (auto) => {
      const text = m.$('#tpText').value.trim();
      if (!text) { m.$('#tpText').classList.add('err'); m.$('#tpText').focus(); return; }
      m.$('#tpOut').innerHTML = '<div class="tp-loading"><span class="ai-dots"><i></i><i></i><i></i></span> Memahami rencanamu…</div>';
      const plan = await understandPlan(text, m.$('#tpStart').value || s0, m.$('#tpEnd').value);
      let s = m.$('#tpStart').value || s0, e = m.$('#tpEnd').value;
      if (auto && plan.nights != null) { e = D.addDays(s, Math.max(1, plan.nights)); m.$('#tpEnd').value = e; }
      if (!e || e <= s) { e = D.addDays(s, 1); m.$('#tpEnd').value = e; }
      m.$('#tpOut').innerHTML = '<div class="tp-loading"><span class="ai-dots"><i></i><i></i><i></i></span> Menyusun rekomendasi…</div>';
      if (plan.src !== 'gemini') await wait(450);
      last = recommend(plan, s, e);
      const missing = [];
      if (!plan.people) missing.push('jumlah orang (dianggap 2)');
      if (!plan.type) missing.push('jenis kegiatan');
      m.$('#tpOut').innerHTML = (missing.length ? `<p class="tp-hint"><i class="fa-regular fa-lightbulb"></i> Aku belum menemukan ${missing.join(' dan ')} di ceritamu, jadi pakai perkiraan. Tambahkan detailnya untuk hasil lebih pas.</p>` : '') + planResultHtml(last);
      const addAll = m.$('#tpAddCustom');
      if (addAll) addAll.addEventListener('click', () => { last.lines.forEach((l) => Cart.add({ type: 'rent', kind: 'product', refId: l.pid, qty: l.qty, start: last.start, end: last.end })); m.close(); toast(`${last.lines.length} alat masuk ke keranjang.`); setTimeout(() => (location.href = url('keranjang')), 700); });
      const addPk = m.$('#tpAddPkg');
      if (addPk) addPk.addEventListener('click', () => { Cart.add({ type: 'rent', kind: 'package', refId: last.pkg.pk.id, qty: 1, start: last.start, end: last.end }); m.close(); toast(`${last.pkg.pk.name} masuk ke keranjang.`); setTimeout(() => (location.href = url('keranjang')), 700); });
    };
    m.$('#tpGo').addEventListener('click', () => run(false));
    m.$('#tpText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(true); } });
    m.$('#tpText').addEventListener('input', () => m.$('#tpText').classList.remove('err'));
    m.$$('.tp-ex button').forEach((b) => b.addEventListener('click', () => { m.$('#tpText').value = b.textContent; run(true); }));
    UI.dateGuard && UI.dateGuard(m.$('#tpStart'), m.$('#tpEnd'));
    if (prefill) { m.$('#tpText').value = prefill; run(!(dates && dates.end)); }
    return m;
  }

  function reviewInsights(list) {
    const themes = {
      pos: { 'Alat bersih & terawat': ['bersih', 'terawat', 'wangi', 'bagus', 'mulus', 'oke', 'mantap'], 'Pelayanan ramah & cepat': ['ramah', 'fast respon', 'responsif', 'membantu', 'sigap'], 'Harga terjangkau': ['murah', 'terjangkau', 'hemat', 'bersahabat'], 'Proses mudah': ['gampang', 'mudah', 'praktis', 'cepat'] },
      neg: { 'Antre saat pengambilan': ['antre', 'antri', 'lama', 'menunggu', 'nunggu'], 'Kondisi barang kurang baik': ['penyok', 'kotor', 'rusak', 'sobek', 'bau', 'kendor', 'bocor', 'patah'], 'Packing kurang rapi': ['packing', 'kemasan', 'kotaknya'], 'Stok tidak tersedia': ['kosong', 'habis', 'penuh'] },
    };
    const vis = list.filter((r) => r.visible !== false);
    const count = (dict) => Object.entries(dict).map(([name, words]) => {
      const hits = vis.filter((r) => words.some((w) => norm(r.text).includes(w)));
      return { name, n: hits.length, ex: hits[0] };
    }).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const pos = count(themes.pos), neg = count(themes.neg);
    const avg = vis.length ? vis.reduce((s, r) => s + r.rating, 0) / vis.length : 0;
    const good = vis.filter((r) => r.rating >= 4).length;
    const pct = vis.length ? Math.round((good / vis.length) * 100) : 0;
    const actions = [];
    neg.forEach((t) => {
      if (t.name.startsWith('Antre')) actions.push('Tambah petugas atau jadwalkan jam ambil di akhir pekan.');
      if (t.name.startsWith('Kondisi')) actions.push('Perketat pengecekan & pembersihan sebelum barang keluar.');
      if (t.name.startsWith('Packing')) actions.push('Gunakan pelindung tambahan untuk barang yang mudah penyok.');
      if (t.name.startsWith('Stok')) actions.push('Cek prediksi permintaan di dashboard untuk menambah unit.');
    });
    const headline = !vis.length ? 'Belum ada ulasan untuk dianalisis.' : `${pct}% pelanggan puas (rating 4–5) dengan rata-rata ${avg.toFixed(1).replace('.', ',')} dari ${vis.length} ulasan. ${pos[0] ? `Paling sering dipuji: ${pos[0].name.toLowerCase()}.` : ''} ${neg[0] ? `Keluhan utama: ${neg[0].name.toLowerCase()}.` : 'Belum ada keluhan yang berulang.'}`;
    return { headline, pos, neg, actions: [...new Set(actions)], pct, avg, total: vis.length };
  }

  function replyDraft(r, tone) {
    const first = String(r.name || 'Kak').split(' ')[0];
    const t = norm(r.text);
    const neg = [];
    if (/(antre|antri|lama|menunggu|nunggu)/.test(t)) neg.push({ s: 'antrean saat pengambilan', fix: 'kami sudah menambah petugas di jam ramai supaya pengambilan lebih cepat' });
    if (/(penyok|kotor|rusak|sobek|bau|kendor|bocor|patah)/.test(t)) neg.push({ s: 'kondisi barang yang kurang baik', fix: 'barang tersebut sudah kami cek ulang dan perbaiki, serta pengecekan sebelum keluar kami perketat' });
    if (/(packing|kemasan|kotak)/.test(t)) neg.push({ s: 'packing yang kurang rapi', fix: 'ke depan packing akan kami beri pelindung tambahan' });
    const pos = [];
    if (/(bersih|terawat|wangi|bagus|mulus)/.test(t)) pos.push('kondisi alatnya');
    if (/(ramah|fast respon|responsif|membantu)/.test(t)) pos.push('pelayanan tim kami');
    if (/(murah|terjangkau|hemat)/.test(t)) pos.push('harganya');
    if (/(gampang|mudah|praktis)/.test(t)) pos.push('proses sewanya');
    const posTxt = pos.length ? pos.slice(0, 2).join(' dan ') : 'pengalamannya';
    if (tone === 'singkat') {
      return r.rating >= 4 ? `Terima kasih, Kak ${first}! Senang ${posTxt} memuaskan. Ditunggu petualangan berikutnya!`
        : `Terima kasih masukannya, Kak ${first}. Maaf atas ${neg[0] ? neg[0].s : 'ketidaknyamanannya'}, akan segera kami perbaiki.`;
    }
    if (tone === 'formal') {
      if (r.rating >= 4) return `Terima kasih, ${r.name}, atas ulasan dan kepercayaan Anda kepada Annapurna Adventure. Kami senang ${posTxt} sesuai harapan. Kami tunggu kunjungan Anda berikutnya.`;
      return `Terima kasih atas masukan Anda, ${r.name}. Kami mohon maaf atas ${neg.length ? neg.map((n) => n.s).join(' dan ') : 'ketidaknyamanan yang terjadi'}. ${neg.length ? neg.map((n) => n.fix.charAt(0).toUpperCase() + n.fix.slice(1)).join('. ') + '.' : 'Masukan ini akan kami tindak lanjuti.'} Semoga kami dapat melayani Anda lebih baik di kesempatan berikutnya.`;
    }
    if (r.rating >= 4 && !neg.length) return `Makasih banyak, Kak ${first}! Senang banget ${posTxt} bikin trip-nya lancar. Semoga petualangannya seru, ditunggu sewa berikutnya di Annapurna ya!`;
    if (r.rating >= 4) return `Makasih ulasannya, Kak ${first}! Senang ${posTxt} memuaskan. Soal ${neg.map((n) => n.s).join(' dan ')}, ${neg.map((n) => n.fix).join(', ')}. Ditunggu sewa berikutnya ya!`;
    return `Halo Kak ${first}, terima kasih sudah jujur berbagi pengalaman. Mohon maaf atas ${neg.length ? neg.map((n) => n.s).join(' dan ') : 'ketidaknyamanannya'}. ${neg.length ? neg.map((n) => n.fix.charAt(0).toUpperCase() + n.fix.slice(1)).join('. ') + '.' : 'Masukan ini langsung kami bahas bersama tim.'} Semoga di kesempatan berikutnya kami bisa memberi pengalaman yang jauh lebih baik.`;
  }

  function reportInsights(from, to) {
    const L = window.Admin ? Admin.ledger(from, to) : { income: [], expense: [], totalIn: 0, totalOut: 0 };
    const len = Math.max(1, D.diffDays(from, to) + 1);
    const pFrom = D.addDays(from, -len), pTo = D.addDays(from, -1);
    const P2 = window.Admin ? Admin.ledger(pFrom, pTo) : { totalIn: 0, totalOut: 0, income: [] };
    const inR = (d) => { const x = D.day(d); return x >= from && x <= to; };
    const B = DB.bookings().filter((b) => inR(b.createdAt));
    const S = DB.sales().filter((s) => inR(s.createdAt));
    const units = {}; B.filter((b) => b.status !== 'dibatalkan').forEach((b) => b.items.forEach((i) => { const k = i.kind === 'package' ? 'pkg:' + i.refId : i.refId; units[k] = (units[k] || 0) + i.qty; }));
    const top = Object.entries(units).sort((a, b) => b[1] - a[1])[0];
    const topName = top ? (top[0].startsWith('pkg:') ? (DB.pkg(top[0].slice(4)) || {}).name : (P(top[0]) || {}).name) : null;
    const cancels = B.filter((b) => b.status === 'dibatalkan').length;
    const fines = L.income.filter((x) => x.cat === 'Denda').reduce((s, x) => s + x.amount, 0);
    const byCat = {}; L.income.forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + x.amount));
    const mainCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const expCat = {}; L.expense.forEach((x) => (expCat[x.cat] = (expCat[x.cat] || 0) + x.amount));
    const topExp = Object.entries(expCat).sort((a, b) => b[1] - a[1])[0];
    const change = P2.totalIn ? Math.round(((L.totalIn - P2.totalIn) / P2.totalIn) * 100) : null;
    const net = L.totalIn - L.totalOut;
    const pts = [];
    pts.push({ ic: 'fa-chart-line', t: change == null ? `Pemasukan ${rupiah(L.totalIn)} di periode ini.` : `Pemasukan ${rupiah(L.totalIn)}, ${change >= 0 ? 'naik' : 'turun'} ${Math.abs(change)}% dibanding ${len} hari sebelumnya.`, tone: change == null || change >= 0 ? 'ok' : 'warn' });
    if (mainCat) pts.push({ ic: 'fa-coins', t: `Sumber pemasukan terbesar: ${mainCat[0].toLowerCase()} (${Math.round((mainCat[1] / Math.max(1, L.totalIn)) * 100)}%).` });
    if (topName) pts.push({ ic: 'fa-fire', t: `Paling laris: ${topName} (${top[1]}× disewa).` });
    pts.push({ ic: 'fa-scale-balanced', t: `${net >= 0 ? 'Laba' : 'Rugi'} bersih ${rupiah(Math.abs(net))} setelah pengeluaran ${rupiah(L.totalOut)}${topExp ? `, terbanyak untuk ${topExp[0].toLowerCase()}` : ''}.`, tone: net >= 0 ? 'ok' : 'warn' });
    if (cancels) pts.push({ ic: 'fa-ban', t: `${cancels} booking dibatalkan dari ${B.length} booking masuk.`, tone: cancels / Math.max(1, B.length) > 0.2 ? 'warn' : '' });
    if (fines) pts.push({ ic: 'fa-clock', t: `Denda terkumpul ${rupiah(fines)}. Ingatkan jadwal kembali lewat WhatsApp H-1 untuk menekan keterlambatan.`, tone: 'warn' });
    if (S.length) pts.push({ ic: 'fa-bag-shopping', t: `${S.length} pesanan pembelian masuk di periode ini.` });
    const headline = `${L.totalIn >= P2.totalIn ? 'Performa membaik' : 'Performa menurun'}: ${B.length} booking dan ${S.length} pembelian, laba bersih ${rupiah(net)}.`;
    return { headline, pts };
  }
  function insightCard(res, sub) {
    return `<div class="ai-card"><div class="ai-card-h"><span class="ai-tag">${mdIcon()} Ringkasan AI</span><small>${esc(sub || '')}</small></div>
      <p class="ai-card-t">${esc(res.headline)}</p>
      <ul class="ai-pts">${res.pts.map((p) => `<li class="${p.tone || ''}"><i class="fa-solid ${p.ic}"></i><span>${esc(p.t)}</span></li>`).join('')}</ul></div>`;
  }

  function isWeekend(iso) { const d = new Date(iso + 'T00:00:00').getDay(); return d === 0 || d === 5 || d === 6; }
  function forecast(days) {
    days = days || 14;
    const today = D.today();
    const range = [...Array(days)].map((_, i) => D.addDays(today, i + 1));
    const hist = DB.bookings().filter((b) => b.status !== 'dibatalkan' && D.diffDays(b.start, today) <= 60 && b.start <= today);
    return DB.products().filter((p) => p.rent > 0).map((p) => {
      const units = hist.reduce((s, b) => s + b.items.reduce((t, i) => t + i.components.filter((c) => c.productId === p.id).reduce((u, c) => u + c.qty * i.qty, 0), 0), 0);
      const rate = units / 60 * 2.2;
      let peak = { n: 0, date: range[0], booked: 0 };
      range.forEach((d) => {
        const booked = p.stock - Rules.availableOn(p.id, d);
        const extra = Math.round(rate * (isWeekend(d) ? 2.4 : 0.8));
        const need = booked + extra;
        if (need > peak.n) peak = { n: need, date: d, booked };
      });
      const gap = peak.n - p.stock;
      const util = p.stock ? peak.n / p.stock : 0;
      return { p, stock: p.stock, need: peak.n, booked: peak.booked, date: peak.date, gap, util, level: gap > 0 ? 'kurang' : util >= 0.75 ? 'waspada' : 'aman' };
    }).sort((a, b) => b.util - a.util);
  }
  function forecastPanel(limit) {
    const F = forecast(14);
    const risky = F.filter((x) => x.level !== 'aman');
    const lbl = { kurang: 'Kurang', waspada: 'Waspada', aman: 'Aman' };
    const busy = [...Array(14)].map((_, i) => D.addDays(D.today(), i + 1)).filter((d) => new Date(d + 'T00:00:00').getDay() === 6);
    return `<div class="ai-fc-h"><span class="ai-tag">${mdIcon()} Prediksi AI · 14 hari</span><small>Hari ramai: ${busy.map((d) => D.fmtDate(d).replace(/ \d{4}$/, '')).join(', ')}</small></div>
      <p class="ai-card-t">${risky.length ? `${risky.filter((x) => x.level === 'kurang').length} barang diperkirakan kurang dan ${risky.filter((x) => x.level === 'waspada').length} hampir penuh. Pertimbangkan tambah unit atau naikkan harga akhir pekan.` : 'Stok aman untuk 14 hari ke depan.'}</p>
      <div class="table-wrap"><table class="table ai-fc"><thead><tr><th>Barang</th><th class="num">Stok</th><th class="num">Perkiraan butuh</th><th>Puncak</th><th>Status</th></tr></thead><tbody>
      ${F.slice(0, limit || 6).map((x) => `<tr><td><div class="prod"><img loading="lazy" decoding="async" src="${asset(x.p.img)}" alt=""><strong>${esc(x.p.name)}</strong></div></td><td class="num">${x.stock}</td><td class="num">${x.need}${x.booked ? `<small>${x.booked} sudah dibooking</small>` : ''}</td><td>${DAY_NAMES[new Date(x.date + 'T00:00:00').getDay()]}, ${D.fmtDate(x.date).replace(/ \d{4}$/, '')}</td><td><span class="ai-lv ${x.level}">${lbl[x.level]}${x.gap > 0 ? ` · −${x.gap}` : ''}</span></td></tr>`).join('')}
      </tbody></table></div>
      <p class="ai-proof-n">Perkiraan dari booking yang sudah masuk dan pola sewa 60 hari terakhir. Makin banyak data transaksi, makin akurat.</p>`;
  }

  function alsoRentedHtml(pid) {
    const L = alsoRented(pid, 4);
    if (!L.length) return '';
    return `<div class="ai-also"><div class="ai-also-h"><span class="ai-tag">${mdIcon()} Sering disewa bersama</span><small>Berdasarkan pesanan penyewa lain</small></div>
      <div class="ai-also-list">${L.map((x) => `<div class="ai-also-it"><a href="${url('produk?id=' + x.p.id)}"><img loading="lazy" decoding="async" src="${asset(x.p.img)}" alt=""></a><div><a href="${url('produk?id=' + x.p.id)}"><b>${esc(x.p.name)}</b></a><small>${rupiah(x.p.rent)}/malam</small></div><button class="btn btn-light btn-xs" data-rent="${x.p.id}" aria-label="Sewa ${esc(x.p.name)}"><i class="fa-solid fa-plus"></i></button></div>`).join('')}</div></div>`;
  }

  window.AI = { answer, parsePlan, recommend, openPlanner, alsoRented, alsoRentedHtml, reviewInsights, replyDraft, reportInsights, insightCard, forecast, forecastPanel };
  const boot = () => chatWidget();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
