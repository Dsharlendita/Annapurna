(function () {
  const VERSION = 'ann-v18';
  const KEY = (k) => `annapurna:${k}`;

  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toISO(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d); };
  const rel = (n) => addDays(today(), n);
  const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const nowStamp = () => new Date().toISOString();
  const day = (iso) => { const v = String(iso || ''); return v.length <= 10 ? v : toISO(new Date(v)); };
  const stampRel = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 15, 0, 0); return d.toISOString(); };

  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const fmtDate = (iso, long) => {
    if (!iso) return '-';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return `${d.getDate()} ${(long ? BULAN_PANJANG : BULAN)[d.getMonth()]} ${d.getFullYear()}`;
  };
  const fmtDateTime = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${fmtDate(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fmtRange = (a, b) => {
    const A = new Date(a + 'T00:00:00'), B = new Date(b + 'T00:00:00');
    if (A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear())
      return `${A.getDate()}–${B.getDate()} ${BULAN[B.getMonth()]} ${B.getFullYear()}`;
    return `${fmtDate(a)} – ${fmtDate(b)}`;
  };
  const rupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');

  const IMG = (p) => `assets/img/${p}`;
  /* Alasan unit sewa dinonaktifkan (barang sewa tidak dijual, jadi tidak ada alasan "dijual") */
  /* ---------- Nomor nota: 001/X/2026 (urut per bulan, bulan romawi, satu urutan untuk sewa & beli, mulai 001 tiap bulan) ----------
     Kode internal (RNT-…/ORD-…) tetap dipakai untuk link, QR & data; nomor ini yang ditampilkan ke customer & staff. */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  let numbering = false;
  function ensureNos() {
    if (numbering) return; numbering = true;
    try {
      const B = read('bookings', []), S = read('sales', []);
      const all = [...B, ...S];
      const todo = all.filter((x) => !x.no);
      if (todo.length) {
        const seq = {};
        all.filter((x) => x.no).forEach((x) => { const m = String(x.no).match(/^(\d+)\/([IVX]+)\/(\d{4})$/); if (m) { const k = m[3] + '-' + (ROMAN.indexOf(m[2]) + 1); seq[k] = Math.max(seq[k] || 0, +m[1]); } });
        /* Format waktu dibuat bisa "2026-10-07T11:15" atau "2026-10-07 10:15" — disamakan dulu agar urutan kronologis */
        const ts = (x) => Date.parse(String(x.createdAt || '').replace(' ', 'T')) || Date.now();
        todo.sort((a, b) => ts(a) - ts(b)).forEach((x) => {
          const d = new Date(ts(x)); const k = d.getFullYear() + '-' + (d.getMonth() + 1);
          seq[k] = (seq[k] || 0) + 1;
          x.no = `${String(seq[k]).padStart(3, '0')}/${ROMAN[d.getMonth()]}/${d.getFullYear()}`;
        });
        write('bookings', B); write('sales', S);
      }
    } finally { numbering = false; }
  }
  /* Nomor yang ditampilkan untuk pesanan (sewa/beli) */
  window.NO = (x) => (x ? (x.no || (ensureNos(), ((read('bookings', []).concat(read('sales', []))).find((y) => y.id === x.id) || {}).no) || x.id) : '');
  const OFF_REASON = { hilang: 'Hilang', rusak: 'Rusak total', lainnya: 'Nonaktif' };
  /* Kategori mengikuti price list resmi Annapurna Adventure (WhatsApp). */
  const CATEGORIES = [
    { id: 'tenda', name: 'Tenda', img: IMG('wa/cat-tenda.jpg') },
    { id: 'tas', name: 'Tas Backpack / Rucksack', img: IMG('wa/cat-tas.jpg') },
    { id: 'footwear', name: 'Footwear', img: IMG('wa/cat-footwear.jpg') },
    { id: 'fashion', name: 'Fashion', img: IMG('wa/cat-fashion.jpg') },
    { id: 'outdoor', name: 'Outdoor Equipment', img: IMG('wa/cat-outdoor.jpg') },
    { id: 'cooking', name: 'Cooking Equipment', img: IMG('wa/cat-cooking.jpg') },
  ].map((c) => Object.assign({ active: true }, c));

  /* rent = tarif per malam, rent3 = tarif perkegiatan (3 hari 3 malam), rent5 = tarif ekspedisi (5 hari 5 malam). price = harga jual (0 = tidak dijual). */
  const P = (id, name, cat, img, rent, price, stock, rating, reviews, extra = {}) =>
    Object.assign({ id, name, cat, img: IMG(img), rent, rent3: 0, rent5: 0, price, stock, rating, reviews, cond: 'Sangat Baik', badge: '', featured: false, active: true, minDays: 1 }, extra);
  /* Barang sewa: R(id, nama, kategori, gambar, [per malam, perkegiatan 3 hari, ekspedisi 5 hari], stok, extra) */
  const R = (id, name, cat, img, [r1, r3, r5], stock, extra = {}) => P(id, name, cat, img, r1, 0, stock, 0, 0, Object.assign({ rent3: r3, rent5: r5 }, extra));

  /* Varian / ukuran: { label, options: [{ name, stock }] }. Stok total = jumlah stok semua ukuran. */
  const V = (label, pairs, attrId) => ({ attrId, label, options: pairs.map(([name, stock]) => ({ name: String(name), stock })) });
  const SHOE = (n) => V('Ukuran sepatu (EU)', [['39', n], ['40', n], ['41', n], ['42', n], ['43', n]], 'at-sepatu');
  const SIZE = (n) => V('Ukuran pakaian', [['M', n], ['L', n], ['XL', n]], 'at-ukuran');
  const TENT = (cap) => ({ specs: [`Kapasitas ${cap} orang`, 'Double layer (lapisan ganda)', 'Tahan air dan angin', 'Sirkulasi udara baik & nyaman', 'Mudah dipasang dan dibawa'],
    desc: `Tenda kapasitas ${cap} orang dengan double layer (lapisan ganda). Tahan air dan angin, sirkulasi udara baik sehingga nyaman dipakai, serta mudah dipasang dan dibawa.`,
    attrs: { 'at-kapasitas': `${cap} orang`, 'at-tipe-tenda': 'Double layer' } });

  const PRODUCTS = [
    /* ---------- Kategori Tenda ---------- */
    R('tnd-2', 'Tenda Kapasitas 2 (Double Layer)', 'tenda', 'wa/tnd-2.jpg', [35000, 60000, 100000], 4, Object.assign(TENT('2'), { badge: '', featured: true, sku: 'TND-2P' })),
    R('tnd-4', 'Tenda Kapasitas 4 (Double Layer)', 'tenda', 'wa/tnd-4.jpg', [40000, 70000, 110000], 6, Object.assign(TENT('4'), { badge: '', featured: true, sku: 'TND-4P' })),
    R('tnd-45', 'Tenda Kapasitas 4-5 (Double Layer)', 'tenda', 'wa/tnd-45.jpg', [45000, 80000, 120000], 3, Object.assign(TENT('4-5'), { sku: 'TND-45P' })),
    R('tnd-6', 'Tenda Kapasitas 6 (Double Layer)', 'tenda', 'wa/tnd-6.jpg', [80000, 150000, 200000], 2, Object.assign(TENT('6'), { featured: true, sku: 'TND-6P' })),

    /* ---------- Kategori Tas Backpack / Rucksack ---------- */
    R('tas-hydro', 'Hydropack', 'tas', 'wa/tas-hydro.jpg', [15000, 27000, 38000], 8, { sku: 'TAS-HYD',
      desc: 'Tas hydropack ringan & ergonomis untuk tektok dan trail running, menjaga cairan tetap tersedia di setiap perjalanan.', specs: ['Ringan & ergonomis', 'Slot kantong air', 'Cocok untuk tektok'] }),
    R('tas-day', 'Daypack', 'tas', 'wa/tas-day.jpg', [15000, 27000, 38000], 6, { sku: 'TAS-DAY',
      desc: 'Daypack untuk perjalanan singkat atau pendakian tanpa menginap.', specs: ['Ringan', 'Cocok untuk perjalanan sehari'] }),
    R('crr-4050s', 'Carrier 40-50 L (Standar)', 'tas', 'wa/crr-4050s.jpg', [20000, 35000, 50000], 4, { sku: 'CRR-4050S', attrs: { 'at-kapasitas': '40-50 L' },
      desc: 'Carrier kelas standar kapasitas 40-50 liter untuk pendakian singkat.', specs: ['Kapasitas 40-50 L', 'Kelas standar'] }),
    R('crr-60s', 'Carrier 60 L (Standar)', 'tas', 'wa/crr-60s.jpg', [25000, 45000, 65000], 5, { sku: 'CRR-60S', featured: true, attrs: { 'at-kapasitas': '60 L' },
      desc: 'Carrier kelas standar kapasitas 60 liter, pas untuk pendakian 2–3 hari.', specs: ['Kapasitas 60 L', 'Kelas standar'] }),
    R('crr-7080s', 'Carrier 70-80 L (Standar)', 'tas', 'wa/crr-7080s.jpg', [30000, 55000, 80000], 3, { sku: 'CRR-7080S', attrs: { 'at-kapasitas': '70-80 L' },
      desc: 'Carrier kelas standar kapasitas 70-80 liter untuk perjalanan panjang / ekspedisi.', specs: ['Kapasitas 70-80 L', 'Kelas standar'] }),
    R('crr-4050m', 'Carrier 40-50 L (Medium)', 'tas', 'wa/crr-4050m.jpg', [30000, 55000, 80000], 3, { sku: 'CRR-4050M', attrs: { 'at-kapasitas': '40-50 L' },
      desc: 'Carrier kelas medium kapasitas 40-50 liter dengan backsystem lebih nyaman.', specs: ['Kapasitas 40-50 L', 'Kelas medium'] }),
    R('crr-60m', 'Carrier 60 L (Medium)', 'tas', 'wa/crr-60m.jpg', [35000, 60000, 100000], 3, { sku: 'CRR-60M', attrs: { 'at-kapasitas': '60 L' },
      desc: 'Carrier kelas medium kapasitas 60 liter dengan backsystem lebih nyaman.', specs: ['Kapasitas 60 L', 'Kelas medium'] }),
    R('crr-osprey', 'Carrier Premium Osprey', 'tas', 'wa/crr-osprey.jpg', [100000, 180000, 250000], 2, { sku: 'CRR-OSP', brand: 'Osprey', badge: 'Premium',
      desc: 'Carrier premium merek Osprey untuk kenyamanan maksimal di perjalanan panjang.', specs: ['Merek Osprey', 'Kelas premium'] }),
    R('tas-cover', 'Coverbag', 'tas', 'wa/tas-cover.jpg', [5000, 9000, 13000], 10, { sku: 'TAS-CVR',
      desc: 'Cover bag / rain cover untuk melindungi tas dari hujan.', specs: ['Pelindung tas dari hujan'] }),

    /* ---------- Kategori Footwear ---------- */
    R('fw-sandal', 'Sandal Gunung', 'footwear', 'wa/fw-sandal.jpg', [10000, 18000, 25000], 10, { sku: 'FW-SDL', variant: SHOE(2),
      desc: 'Sandal gunung dengan strap kuat dan sol anti slip, nyaman di camping ground.', specs: ['Strap kuat', 'Sol anti slip'] }),
    R('fw-std', 'Sepatu (Standar)', 'footwear', 'wa/fw-std.jpg', [25000, 45000, 65000], 10, { sku: 'FW-STD', variant: SHOE(2),
      desc: 'Sepatu hiking standar yang nyaman dipakai, sol kuat anti selip, siap menemani setiap langkah petualanganmu.', specs: ['Sol kuat anti selip', 'Nyaman dipakai'] }),
    R('fw-low', 'Sepatu Trekking Low', 'footwear', 'wa/fw-low.jpg', [35000, 60000, 100000], 5, { sku: 'FW-LOW', variant: SHOE(1),
      desc: 'Sepatu trekking model low-cut, ringan untuk jalur trekking.', specs: ['Model low-cut', 'Ringan'] }),
    R('fw-mid', 'Sepatu Hiking Mid', 'footwear', 'wa/fw-mid.jpg', [40000, 70000, 110000], 5, { sku: 'FW-MID', featured: true, variant: SHOE(1),
      desc: 'Sepatu hiking model mid-cut dengan pelindung mata kaki untuk jalur berbatu.', specs: ['Model mid-cut', 'Melindungi mata kaki'] }),
    R('fw-trail', 'Sepatu Trail Premium (Salomon / Hoka)', 'footwear', 'wa/fw-trail.jpg', [50000, 90000, 130000], 5, { sku: 'FW-TRL', brand: 'Salomon / Hoka', badge: 'Premium', variant: SHOE(1),
      desc: 'Sepatu trail premium Salomon / Hoka: ringan, nyaman & kuat. Cocok untuk semua medan, anti slip & cepat kering.', specs: ['Ringan, nyaman & kuat', 'Anti slip', 'Cepat kering'] }),

    /* ---------- Kategori Fashion ---------- */
    R('fs-jkt', 'Jaket Standar', 'fashion', 'wa/fs-jkt.jpg', [10000, 18000, 25000], 9, { sku: 'FS-JKT', variant: SIZE(3),
      desc: 'Jaket gunung standar, melindungi dari angin & hujan. Bahan ringan, hangat, dan tahan cuaca.', specs: ['Melindungi dari angin & hujan', 'Ringan & hangat'] }),
    R('fs-wind', 'Jaket Windbreaker Standar', 'fashion', 'wa/fs-wind.jpg', [15000, 27000, 38000], 6, { sku: 'FS-WND', variant: SIZE(2),
      desc: 'Jaket windbreaker ringan untuk menahan angin di jalur pendakian.', specs: ['Menahan angin', 'Ringan'] }),
    R('fs-uv', 'Jaket Anti UV', 'fashion', 'wa/fs-uv.jpg', [15000, 27000, 38000], 6, { sku: 'FS-UV', variant: SIZE(2),
      desc: 'Jaket anti UV untuk melindungi kulit dari sinar matahari.', specs: ['Perlindungan sinar UV'] }),
    R('fs-puffer', 'Jaket Puffer Gembung (Standar)', 'fashion', 'wa/fs-puffer.jpg', [20000, 35000, 50000], 6, { sku: 'FS-PUF', variant: SIZE(2),
      desc: 'Jaket puffer gembung standar, hangat untuk suhu dingin di gunung.', specs: ['Hangat', 'Model puffer'] }),
    R('fs-puffer-anak', 'Jaket Puffer Anak', 'fashion', 'wa/fs-puffer-anak.jpg', [20000, 35000, 50000], 4, { sku: 'FS-PFA',
      desc: 'Jaket puffer hangat untuk anak-anak.', specs: ['Ukuran anak', 'Hangat'] }),
    R('fs-insulated', 'Jaket Insulated', 'fashion', 'wa/fs-insulated.jpg', [20000, 35000, 50000], 6, { sku: 'FS-INS', variant: SIZE(2),
      desc: 'Jaket insulated untuk menahan dingin.', specs: ['Lapisan insulasi', 'Hangat'] }),
    R('fs-gorpcore', 'Jaket Gorpcore', 'fashion', 'wa/fs-gorpcore.jpg', [25000, 45000, 65000], 6, { sku: 'FS-GRP', variant: SIZE(2),
      desc: 'Jaket gorpcore: melindungi dari angin & hujan, bahan ringan, hangat, dan tahan cuaca.', specs: ['Melindungi dari angin & hujan', 'Ringan, hangat, tahan cuaca'] }),
    R('fs-puffer-prem', 'Jaket Puffer Gembung Premium', 'fashion', 'wa/fs-puffer-prem.jpg', [25000, 45000, 65000], 6, { sku: 'FS-PFP', variant: SIZE(2),
      desc: 'Jaket puffer gembung kelas premium, sangat hangat untuk suhu dingin.', specs: ['Kelas premium', 'Sangat hangat'] }),
    R('fs-glove', 'Sarung Tangan', 'fashion', 'wa/fs-glove.jpg', [10000, 18000, 25000], 10, { sku: 'FS-GLV',
      desc: 'Sarung tangan untuk menjaga tangan tetap hangat.', specs: ['Menjaga tangan tetap hangat'] }),
    R('fs-cargo', 'Celana Cargo', 'fashion', 'wa/fs-cargo.jpg', [10000, 18000, 25000], 8, { sku: 'FS-CRG',
      desc: 'Celana cargo outdoor dengan banyak kantong.', specs: ['Banyak kantong'] }),
    R('fs-kcm', 'Kacamata (Standar)', 'fashion', 'wa/fs-kcm.jpg', [5000, 9000, 13000], 10, { sku: 'FS-KCM',
      desc: 'Kacamata sport standar: melindungi mata dari sinar UV, debu, & angin. Jarak pandang lebih jernih & nyaman.', specs: ['Melindungi dari UV, debu & angin'] }),
    R('fs-kcm-gorp', 'Kacamata Gorpcore', 'fashion', 'wa/fs-kcm-gorp.jpg', [10000, 18000, 25000], 6, { sku: 'FS-KCG',
      desc: 'Kacamata gorpcore: melindungi mata dari sinar UV, debu, & angin. Jarak pandang lebih jernih & nyaman.', specs: ['Melindungi dari UV, debu & angin'] }),
    R('fs-topi', 'Topi', 'fashion', 'wa/fs-topi.jpg', [10000, 18000, 25000], 8, { sku: 'FS-TOP',
      desc: 'Topi outdoor untuk melindungi kepala dari panas.', specs: ['Melindungi dari panas'] }),

    /* ---------- Kategori Outdoor Equipment ---------- */
    R('oe-sb', 'Sleeping Bag', 'outdoor', 'wa/oe-sb.jpg', [10000, 18000, 25000], 24, { sku: 'OE-SB', featured: true,
      desc: 'Sleeping bag hangat dan selalu dicuci bersih setelah disewa.', specs: ['Hangat', 'Selalu dicuci bersih'] }),
    R('oe-tp', 'Trekking Pole (Standar)', 'outdoor', 'wa/oe-tp.jpg', [15000, 27000, 38000], 10, { sku: 'OE-TP',
      desc: 'Trekking pole standar: bantu jaga keseimbangan, mengurangi beban lutut, lebih stabil di medan terjal.', specs: ['Jaga keseimbangan', 'Mengurangi beban lutut'] }),
    R('oe-tpz', 'Trekking Pole Z (Ultralight)', 'outdoor', 'wa/oe-tpz.jpg', [20000, 35000, 50000], 6, { sku: 'OE-TPZ',
      desc: 'Trekking pole model Z ultralight: ringan, bisa dilipat ringkas, lebih stabil di medan terjal.', specs: ['Ultralight', 'Model lipat Z'] }),
    R('oe-matras', 'Matras', 'outdoor', 'wa/oe-matras.jpg', [5000, 9000, 13000], 24, { sku: 'OE-MTR',
      desc: 'Matras alas tidur di dalam tenda.', specs: ['Alas tidur'] }),
    R('oe-headlamp', 'Headlamp', 'outdoor', 'wa/oe-headlamp.jpg', [5000, 9000, 13000], 15, { sku: 'OE-HDL',
      desc: 'Headlamp: penerangan maksimal saat malam, praktis & hemat energi.', specs: ['Praktis', 'Hemat energi'] }),
    R('oe-lampu', 'Lampu Tenda', 'outdoor', 'wa/oe-lampu.jpg', [5000, 9000, 13000], 12, { sku: 'OE-LMP',
      desc: 'Lampu gantung untuk penerangan di dalam tenda.', specs: ['Bisa digantung di tenda'] }),
    R('oe-fly23', 'Flysheet 2 x 3', 'outdoor', 'wa/oe-fly23.jpg', [10000, 18000, 25000], 4, { sku: 'OE-F23', desc: 'Flysheet ukuran 2 × 3 meter untuk naungan / pelindung hujan.', specs: ['Ukuran 2 × 3 m'] }),
    R('oe-fly33', 'Flysheet 3 x 3', 'outdoor', 'wa/oe-fly33.jpg', [15000, 27000, 38000], 4, { sku: 'OE-F33', desc: 'Flysheet ukuran 3 × 3 meter untuk naungan / pelindung hujan.', specs: ['Ukuran 3 × 3 m'] }),
    R('oe-hammock', 'Hammock', 'outdoor', 'wa/oe-hammock.jpg', [10000, 18000, 25000], 5, { sku: 'OE-HMK', desc: 'Hammock untuk bersantai di area camping.', specs: ['Untuk bersantai'] }),
    R('oe-kursi', 'Kursi Lipat', 'outdoor', 'wa/oe-kursi.jpg', [15000, 27000, 38000], 12, { sku: 'OE-KRS', desc: 'Kursi lipat camping yang ringkas dibawa.', specs: ['Bisa dilipat'] }),
    R('oe-meja', 'Meja Lipat', 'outdoor', 'wa/oe-meja.jpg', [15000, 27000, 38000], 5, { sku: 'OE-MJA', desc: 'Meja lipat camping yang ringkas dibawa.', specs: ['Bisa dilipat'] }),
    R('oe-tripod', 'Tripod', 'outdoor', 'wa/oe-tripod.jpg', [10000, 18000, 25000], 3, { sku: 'OE-TRP', desc: 'Tripod untuk dokumentasi foto & video.', specs: ['Untuk kamera / HP'] }),
    R('oe-pb10', 'Powerbank 10.000 mAh', 'outdoor', 'wa/oe-pb10.jpg', [15000, 27000, 38000], 5, { sku: 'OE-PB10', desc: 'Powerbank kapasitas 10.000 mAh.', specs: ['Kapasitas 10.000 mAh'] }),
    R('oe-pb20', 'Powerbank 20.000 mAh', 'outdoor', 'wa/oe-pb20.jpg', [25000, 45000, 65000], 4, { sku: 'OE-PB20', desc: 'Powerbank kapasitas 20.000 mAh.', specs: ['Kapasitas 20.000 mAh'] }),

    /* ---------- Kategori Cooking Equipment ---------- */
    R('ck-ds200', 'Cooking Set DS200', 'cooking', 'wa/ck-ds200.jpg', [10000, 18000, 25000], 6, { sku: 'CK-DS200', desc: 'Cooking set / nesting DS200 untuk masak di camping.', specs: ['Nesting DS200'] }),
    R('ck-ds300', 'Nesting TNI / Cooking Set DS300', 'cooking', 'wa/ck-ds300.jpg', [15000, 27000, 38000], 6, { sku: 'CK-DS300', desc: 'Nesting TNI / cooking set DS300, muat untuk masak rombongan.', specs: ['Nesting TNI / DS300'] }),
    R('ck-grill-s', 'Grillpan Kecil', 'cooking', 'wa/ck-grill-s.jpg', [10000, 18000, 25000], 5, { sku: 'CK-GPS', desc: 'Grill pan ukuran kecil untuk BBQ.', specs: ['Ukuran kecil'] }),
    R('ck-grill-m', 'Grillpan Sedang', 'cooking', 'wa/ck-grill-m.jpg', [15000, 27000, 38000], 4, { sku: 'CK-GPM', desc: 'Grill pan ukuran sedang untuk BBQ.', specs: ['Ukuran sedang'] }),
    R('ck-grill-l', 'Grillpan Besar', 'cooking', 'wa/ck-grill-l.jpg', [20000, 35000, 50000], 3, { sku: 'CK-GPL', desc: 'Grill pan ukuran besar untuk BBQ rombongan.', specs: ['Ukuran besar'] }),
    R('ck-kompor', 'Kompor Kotak Camping', 'cooking', 'wa/ck-kompor.jpg', [15000, 27000, 38000], 8, { sku: 'CK-KMP', desc: 'Kompor kotak camping portable yang ringkas.', specs: ['Portable', 'Ringkas'] }),
    R('ck-koper', 'Kompor Koper Grill', 'cooking', 'wa/ck-koper.jpg', [25000, 45000, 65000], 5, { sku: 'CK-KPR', featured: true, desc: 'Kompor koper grill (BBQ) gratis koper pelindung. Cocok untuk BBQ dan masak di camping.', specs: ['Gratis koper', 'Bisa untuk BBQ'], includes: 'Kompor + koper' }),
    R('ck-capit', 'Capitan Daging', 'cooking', 'wa/ck-capit.jpg', [5000, 9000, 13000], 6, { sku: 'CK-CPT', desc: 'Capitan / jepitan daging untuk BBQ.', specs: ['Untuk BBQ'] }),

    /* ---------- Barang JUAL (data dummy, bukan dari price list WhatsApp). Hanya dijual, tidak disewakan. ---------- */
    P('jl-1', 'Tenda Camping Consina 4P', 'tenda', 'wa/jl-1.jpg', 0, 1850000, 6, 4.8, 124, {
      desc: 'Tenda dome kapasitas 4 orang dengan double layer dan flysheet waterproof 3000mm. Rangka alloy ringan, cepat dipasang dalam 10 menit.',
      specs: ['Kapasitas 4 orang', 'Waterproof 3000mm', 'Berat 3,2 kg', 'Ukuran 210 × 240 × 140 cm'],
      attrs: { 'at-kapasitas': '4 orang', 'at-tipe-tenda': 'Dome' }, brand: 'Consina', sku: 'JL-TND-4P-01', color: 'Hijau army', material: 'Polyester 190T, frame alloy', weight: '3,2 kg', dimension: '210 × 240 × 140 cm', includes: 'Inner, flysheet, 2 frame alloy, 12 pasak, tali, tas' }),
    P('jl-7', 'Tenda Dome 2P Ultralight', 'tenda', 'wa/jl-7.jpg', 0, 1250000, 5, 4.7, 41, {
      desc: 'Tenda ultralight untuk 2 orang, favorit pendaki solo dan berdua. Muat masuk carrier dengan mudah.',
      specs: ['Kapasitas 2 orang', 'Berat 1,9 kg', 'Waterproof 2000mm', 'Frame aluminium'] }),
    P('jl-21', 'Tenda Eiger Kaliandra 4P', 'tenda', 'wa/jl-21.jpg', 0, 2450000, 4, 4.8, 38, {
      desc: 'Tenda 4 orang merek Eiger dengan double layer, frame aluminium, dan vestibule luas untuk menyimpan carrier.',
      specs: ['Kapasitas 4 orang', 'Waterproof 5000mm', 'Frame aluminium', 'Vestibule depan'],
      attrs: { 'at-kapasitas': '4 orang', 'at-tipe-tenda': 'Dome' }, brand: 'Eiger', sku: 'JL-TND-EGR-4P', color: 'Abu-abu / oranye', material: 'Polyester 210T PU 5000mm, frame aluminium 7001', weight: '3,6 kg', dimension: '220 × 240 × 135 cm', includes: 'Inner, flysheet, 3 frame aluminium, 14 pasak, tali, tas' }),
    P('jl-5', 'Carrier Eiger 60L', 'tas', 'wa/jl-5.jpg', 0, 850000, 7, 4.8, 65, {
      desc: 'Carrier 60 liter dengan backsystem adjustable, rain cover, dan banyak kantong. Cocok untuk pendakian 2–4 hari.',
      specs: ['Kapasitas 60 L', 'Rain cover', 'Backsystem adjustable', 'Hip belt empuk'],
      attrs: { 'at-kapasitas': '60 L' },
      brand: 'Eiger', sku: 'JL-CRR-60-01', color: 'Hitam / abu', material: 'Nylon ripstop 420D', weight: '1,9 kg', dimension: '60 liter', includes: 'Rain cover' }),
    P('jl-10', 'Carrier Daypack 40L', 'tas', 'wa/jl-10.jpg', 0, 550000, 6, 4.6, 29, {
      desc: 'Daypack 40 liter untuk tektok dan pendakian satu hari. Ringan dengan ventilasi punggung.',
      specs: ['Kapasitas 40 L', 'Ventilasi punggung', 'Slot hydration', 'Berat 1,1 kg'],
      attrs: { 'at-kapasitas': '40 L' }, brand: 'Consina', sku: 'JL-CRR-40-01', color: 'Biru navy', material: 'Polyester 600D', weight: '1,1 kg', dimension: '40 liter', includes: 'Rain cover' }),
    P('jl-19', 'Sepatu Hiking Mid Waterproof', 'footwear', 'wa/jl-19.jpg', 0, 950000, 9, 4.8, 17, {
      desc: 'Sepatu hiking model mid dengan pelindung mata kaki, sol karet bergerigi, dan lapisan anti air.',
      specs: ['Model mid-cut', 'Sol karet anti slip', 'Lapisan waterproof', 'Toe cap pelindung'],
      variant: V('Ukuran (EU)', [['39', 1], ['40', 2], ['41', 2], ['42', 2], ['43', 1], ['44', 1]], 'at-sepatu'), attrs: { 'at-gender': 'Unisex' },
      brand: 'SNTA', sku: 'JL-SPT-HK-01', color: 'Cokelat', material: 'Suede & mesh, sol rubber', weight: '1,1 kg / pasang', dimension: 'Panjang kaki: 39 = 24,5 cm · 40 = 25 cm · 41 = 26 cm · 42 = 26,5 cm · 43 = 27,5 cm · 44 = 28 cm', includes: 'Sepasang sepatu, tali cadangan' }),
    P('jl-20', 'Sandal Gunung Eiger', 'footwear', 'wa/jl-20.jpg', 0, 185000, 10, 4.6, 26, {
      desc: 'Sandal gunung dengan strap kuat dan sol empuk. Nyaman untuk di camping ground atau menyeberang sungai.',
      specs: ['Strap webbing + velcro', 'Sol EVA + karet', 'Cepat kering', 'Anti slip'],
      variant: V('Ukuran (EU)', [['39', 2], ['40', 2], ['41', 2], ['42', 2], ['43', 2]], 'at-sepatu'), attrs: { 'at-gender': 'Unisex' },
      brand: 'Eiger', sku: 'JL-SDL-01', color: 'Hitam / hijau', material: 'Webbing nylon, sol karet', weight: '480 g / pasang', dimension: '', includes: 'Sepasang sandal' }),
    P('jl-17', 'Jaket Gunung Waterproof', 'fashion', 'wa/jl-17.jpg', 0, 650000, 9, 4.7, 21, {
      badge: 'Baru', desc: 'Jaket outer 2 lapis anti air dan angin dengan hoodie yang bisa dilepas. Cocok untuk pendakian dan cuaca hujan.',
      specs: ['Waterproof 5000mm', 'Hoodie bisa dilepas', 'Kantong dalam', 'Ventilasi ketiak'],
      variant: V('Ukuran', [['S', 1], ['M', 3], ['L', 3], ['XL', 2]], 'at-ukuran'), attrs: { 'at-gender': 'Unisex' },
      brand: 'Eiger', sku: 'JL-JKT-WP-01', color: 'Oranye', material: 'Nylon taslan coating PU', weight: '650 g', dimension: 'Lingkar dada S 100 · M 106 · L 112 · XL 118 cm', includes: 'Jaket, hoodie, kantong penyimpanan' }),
    P('jl-18', 'Jaket Polar Fleece', 'fashion', 'wa/jl-18.jpg', 0, 225000, 8, 4.6, 14, {
      desc: 'Jaket polar hangat untuk lapisan tengah atau dipakai santai di camping ground saat malam.',
      specs: ['Bahan polar tebal', 'Resleting penuh', '2 kantong samping', 'Ringan & cepat kering'],
      variant: V('Ukuran', [['M', 2], ['L', 3], ['XL', 2], ['XXL', 1]], 'at-ukuran'), attrs: { 'at-gender': 'Unisex' },
      brand: 'Consina', sku: 'JL-JKT-PL-01', color: 'Hijau', material: 'Polar fleece 280 gsm', weight: '420 g', dimension: 'Lingkar dada M 104 · L 110 · XL 116 · XXL 122 cm', includes: 'Jaket' }),
    P('jl-3', 'Sleeping Bag Polar', 'outdoor', 'wa/jl-3.jpg', 0, 275000, 10, 4.6, 87, {
      desc: 'Sleeping bag polar dengan lapisan dalam lembut, nyaman untuk suhu 10–18°C.',
      specs: ['Suhu nyaman 10–18°C', 'Bahan polar', 'Ukuran 190 × 75 cm', 'Bisa dibuka jadi selimut'] }),
    P('jl-8', 'Sleeping Bag Mummy -5°C', 'outdoor', 'wa/jl-8.jpg', 0, 450000, 6, 4.8, 33, {
      desc: 'Sleeping bag bentuk mummy untuk gunung dengan suhu dingin, lengkap dengan hoodie dan resleting dua arah.',
      specs: ['Suhu ekstrem -5°C', 'Model mummy + hoodie', 'Isian dacron', 'Compression sack'] }),
    P('jl-13', 'Matras Angin Ultralight', 'outdoor', 'wa/jl-13.jpg', 0, 225000, 8, 4.6, 27, {
      desc: 'Matras tiup ringan dengan bantal terintegrasi. Menjaga badan tetap hangat dari tanah.',
      specs: ['Tebal 6 cm', 'Bantal terintegrasi', 'Berat 560 g', 'Pompa kantong'] }),
    P('jl-14', 'Matras Foam Lipat', 'outdoor', 'wa/jl-14.jpg', 0, 95000, 12, 4.4, 45, {
      desc: 'Matras foam lipat model telur. Tidak perlu ditiup dan tahan tusukan.',
      specs: ['Model egg-crate', 'Tebal 2 cm', 'Lipat 8 bagian', 'Berat 400 g'] }),
    P('jl-2', 'Kursi Camping', 'outdoor', 'wa/jl-2.jpg', 0, 185000, 12, 4.7, 98, {
      desc: 'Kursi lipat dengan sandaran tinggi dan tempat gelas. Kokoh menahan beban hingga 120 kg, bisa dilipat ringkas ke dalam tas.',
      specs: ['Beban maks. 120 kg', 'Rangka baja', 'Tas penyimpanan', 'Berat 2,1 kg'] }),
    P('jl-9', 'Kursi Camping Director', 'outdoor', 'wa/jl-9.jpg', 0, 240000, 6, 4.5, 22, {
      desc: 'Kursi director dengan sandaran tangan, nyaman untuk bersantai lama di area camping ground.',
      specs: ['Sandaran tangan', 'Beban maks. 110 kg', 'Rangka baja', 'Berat 2,8 kg'] }),
    P('jl-6', 'Lampu Camping', 'outdoor', 'wa/jl-6.jpg', 0, 150000, 9, 4.6, 58, {
      desc: 'Lentera camping dengan cahaya hangat dan tiga mode terang. Baterai isi ulang tahan hingga 12 jam.',
      specs: ['3 mode cahaya', 'Baterai isi ulang', 'Tahan 12 jam', 'Gantungan besi'] }),
    P('jl-12', 'Lentera LED Retro', 'outdoor', 'wa/jl-12.jpg', 0, 120000, 10, 4.5, 19, {
      desc: 'Lentera LED gaya klasik dengan dimmer. Aman dipakai di dalam tenda.',
      specs: ['Dimmer', '3× baterai AA', 'Tahan 20 jam', 'Tahan cipratan air'] }),
    P('jl-4', 'Kompor Portable', 'cooking', 'wa/jl-4.jpg', 0, 320000, 8, 4.8, 76, {
      desc: 'Kompor gas portable dengan koper, api stabil dan hemat gas. Dilengkapi pengaman tekanan gas otomatis.',
      specs: ['Gas kaleng 230 g', 'Pemantik otomatis', 'Koper pelindung', 'Berat 1,8 kg'] }),
    P('jl-11', 'Kompor & Cooking Set', 'cooking', 'wa/jl-11.jpg', 0, 395000, 5, 4.7, 37, {
      desc: 'Paket kompor koper dengan nesting 3 panci, wajan, dan sendok. Praktis untuk masak bareng di camping.',
      specs: ['Kompor koper', 'Nesting 3 panci + wajan', 'Sendok & sutil', 'Tas jaring'] }),
    /* ---------- Barang habis pakai (isi Paket BBQ). Harga jual belum ada di price list WhatsApp — sesuaikan di Kelola Barang. ---------- */
    P('gas', 'Gas Kaleng', 'cooking', 'wa/gas.jpg', 0, 18000, 40, 0, 0, { sku: 'GAS-KLG', desc: 'Gas kaleng untuk kompor portable / kompor koper grill. Dijual satuan.', specs: ['Untuk kompor portable', 'Satuan'] }),
    /* Gas kaleng versi sewa (stok terpisah dari gas yang dijual). Tarif 3 & 5 hari mengikuti kombinasi tarif per malam. */
    R('gas-sewa', 'Gas Kaleng (Sewa)', 'cooking', 'wa/gas.jpg', [10000, 0, 0], 10, { sku: 'GAS-SWA', desc: 'Gas kaleng untuk kompor portable / kompor koper grill, disewakan per malam. Termasuk dalam Paket BBQ 2 & 3.', specs: ['Untuk kompor portable', 'Per malam'] }),
  ];

  /* Paket sesuai price list. price = per malam, price3 = perkegiatan (3 hari), price5 = ekspedisi (5 hari).
     Paket Tektok hanya punya harga 1 malam; untuk kegiatan / ekspedisi dihitung dari harga satuan isinya (price3/price5 kosong). */
  const PACKAGES = [
    { id: 'pk-2p', name: 'Paket 2P', tagline: 'Tenda kapasitas 2, 2 matras, 2 sleeping bag, dan 1 lampu tenda.', img: IMG('wa/pk-2p.jpg'), price: 65000, price3: 125000, price5: 185000, people: '2 orang', pMin: 1, pMax: 2, type: 'tenda', popular: true,
      items: [{ productId: 'tnd-2', qty: 1 }, { productId: 'oe-matras', qty: 2 }, { productId: 'oe-sb', qty: 2 }, { productId: 'oe-lampu', qty: 1 }] },
    { id: 'pk-4p', name: 'Paket 4P', tagline: 'Tenda kapasitas 4, 4 matras, 4 sleeping bag, dan 1 lampu tenda.', img: IMG('wa/pk-4p.jpg'), price: 90000, price3: 170000, price5: 250000, people: '3–4 orang', pMin: 3, pMax: 4, type: 'tenda',
      items: [{ productId: 'tnd-4', qty: 1 }, { productId: 'oe-matras', qty: 4 }, { productId: 'oe-sb', qty: 4 }, { productId: 'oe-lampu', qty: 1 }] },
    { id: 'pk-5p', name: 'Paket 5P', tagline: 'Tenda kapasitas 4-5, 5 matras, 5 sleeping bag, dan 1 lampu tenda.', img: IMG('wa/pk-5p.jpg'), price: 100000, price3: 190000, price5: 290000, people: '5 orang', pMin: 5, pMax: 5, type: 'tenda',
      items: [{ productId: 'tnd-45', qty: 1 }, { productId: 'oe-matras', qty: 5 }, { productId: 'oe-sb', qty: 5 }, { productId: 'oe-lampu', qty: 1 }] },
    { id: 'pk-6p', name: 'Paket 6P', tagline: 'Tenda kapasitas 6, 6 matras, 6 sleeping bag, dan 1 lampu tenda.', img: IMG('wa/pk-6p.jpg'), price: 150000, price3: 290000, price5: 400000, people: '6 orang', pMin: 6, pMax: 6, type: 'tenda',
      items: [{ productId: 'tnd-6', qty: 1 }, { productId: 'oe-matras', qty: 6 }, { productId: 'oe-sb', qty: 6 }, { productId: 'oe-lampu', qty: 1 }] },
    { id: 'pk-bbq1', name: 'Paket BBQ 1', tagline: 'Kompor BBQ dan grill pan. BBQ seru, momen berkesan!', img: IMG('wa/pk-bbq1.jpg'), price: 35000, price3: 60000, price5: 100000, people: 'Bebas', pMin: 1, pMax: 20, type: 'bbq',
      items: [{ productId: 'ck-koper', qty: 1 }, { productId: 'ck-grill-s', qty: 1 }] },
    { id: 'pk-bbq2', name: 'Paket BBQ 2', tagline: 'Kompor BBQ, grill pan, dan gas kaleng.', img: IMG('wa/pk-bbq2.jpg'), price: 45000, price3: 80000, price5: 120000, people: 'Bebas', pMin: 1, pMax: 20, type: 'bbq', popular: true,
      items: [{ productId: 'ck-koper', qty: 1 }, { productId: 'ck-grill-s', qty: 1 }, { productId: 'gas-sewa', qty: 1 }] },
    { id: 'pk-bbq3', name: 'Paket BBQ 3', tagline: 'Kompor BBQ, grill pan, gas kaleng, dan jepitan daging.', img: IMG('wa/pk-bbq3.jpg'), price: 50000, price3: 90000, price5: 130000, people: 'Bebas', pMin: 1, pMax: 20, type: 'bbq',
      items: [{ productId: 'ck-koper', qty: 1 }, { productId: 'ck-grill-s', qty: 1 }, { productId: 'gas-sewa', qty: 1 }, { productId: 'ck-capit', qty: 1 }] },
    { id: 'pk-tektok', name: 'Paket Tektok Standar', tagline: 'Perlengkapan lengkap naik-turun gunung tanpa menginap. Hemat Rp15.000.', img: IMG('wa/pk-tektok.jpg'), price: 60000, people: '1 orang', pMin: 1, pMax: 1, type: 'tektok', tektok: true,
      items: [{ productId: 'fw-std', qty: 1 }, { productId: 'tas-hydro', qty: 1 }, { productId: 'fs-jkt', qty: 1 }, { productId: 'oe-tp', qty: 1 }, { productId: 'oe-headlamp', qty: 1 }, { productId: 'fs-kcm', qty: 1 }] },
    { id: 'pk-tektok-prem', name: 'Paket Tektok Premium', tagline: 'Sepatu Salomon / Hoka, jaket gorpcore, trekking pole Z ultralight, dan lainnya. Hemat Rp15.000.', img: IMG('wa/pk-tektok-prem.jpg'), price: 110000, people: '1 orang', pMin: 1, pMax: 1, type: 'tektok', tektok: true,
      items: [{ productId: 'fw-trail', qty: 1 }, { productId: 'tas-hydro', qty: 1 }, { productId: 'fs-gorpcore', qty: 1 }, { productId: 'oe-tpz', qty: 1 }, { productId: 'oe-headlamp', qty: 1 }, { productId: 'fs-kcm-gorp', qty: 1 }] },
  ];
  const TEKTOK_TERMS = [
    'Harga paket tektok khusus untuk harga 1 malam. Jika mau harga kegiatan / ekspedisi, ambil harga satuan.',
    'Paket tektok bisa di-upgrade produknya dengan menambah harga sesuai selisih.',
    'Item dalam paket tektok bisa ditukar dengan item lain dengan harga yang sama.',
  ];

  const SETTINGS = {
    storeName: 'Annapurna Adventure',
    phone: '+62 896 3469 6969',
    whatsapp: '6289634696969',
    email: 'annapurnaadv@gmail.com',
    instagram: '@annapurna_adv',
    tiktok: '@annapurna_adv',
    address: 'Jl. Kampus No. 8-9, Kelurahan Grendeng, Kec. Purwokerto Utara, Kab. Banyumas',
    hours: 'Setiap hari, 09.00 – 22.00 WIB',
    dpPercent: 50,
    /* Batas waktu membayar DP setelah booking dibuat (jam). Lewat batas → booking dibatalkan otomatis agar stok kembali tersedia. */
    payWindowHours: 1,
    /* Logout otomatis staff bila tidak ada aktivitas (menit, 0 = mati) */
    idleLogoutMin: 60,
    /* Pembersihan data setelah rekap bulanan tersimpan di Google Drive (data bulan yang sudah diarsipkan) */
    cleanup: { mode: 'approve' },
    /* Tata cara di beranda (bisa diubah owner di Konfigurasi → Tampilan Beranda) */
    howto: {
      sewa: [
        { icon: 'fa-calendar-days', title: 'Pilih Produk', text: 'Lihat katalog dan tentukan perlengkapan yang kamu butuhkan.' },
        { icon: 'fa-clipboard', title: 'Isi Form Sewa', text: 'Lengkapi data diri dan pilih tanggal ambil & kembali.' },
        { icon: 'fa-credit-card', title: 'Lakukan Pembayaran', text: 'Bayar DP lewat transfer atau QRIS, lalu unggah bukti.' },
        { icon: 'fa-store', title: 'Ambil di Toko', text: 'Tunjukkan nota digital & kartu identitas, barang siap dipakai!' },
      ],
      beli: [
        { icon: 'fa-bag-shopping', title: 'Pilih Barang', text: 'Buka halaman Beli Alat, pilih perlengkapan baru yang kamu inginkan.' },
        { icon: 'fa-cart-shopping', title: 'Checkout', text: 'Masukkan ke keranjang, isi data diri, dan pilih metode pembayaran.' },
        { icon: 'fa-credit-card', title: 'Bayar Penuh', text: 'Transfer atau QRIS, lalu unggah bukti. Admin memverifikasi pembayaranmu.' },
        { icon: 'fa-store', title: 'Ambil di Toko', text: 'Barang dikemas, kamu dapat notifikasi saat siap diambil.' },
      ],
    },
    /* Struk kasir: ukuran kertas printer thermal & pesan penutup */
    receipt: { paper: 58, footerRent: 'Bawa struk ini & kartu identitas saat mengembalikan barang. Sewa bersih, kembali kotor? Biar kami yang membersihkan.', footerSale: 'Barang yang sudah dibeli tidak dapat ditukar kecuali cacat produksi.' }, // approve = minta persetujuan owner · auto = langsung · off = nonaktif
    /* Section "Produk Rental Terlaris" di beranda: sumber data (otomatis | manual | gabungan), periode hitung (hari, 0 = semua), jumlah barang */
    homeBest: { mode: 'gabungan', days: 90, count: 6, onlyAvailable: true },
    cancelDays: 2,
    /* Terlambat dari jam tutup toko (22.00) = dihitung tambah sewa per malam untuk setiap malam keterlambatan. */
    lateFeePercent: 100,
    lateFeeMode: 'persen',
    lateFeeAmount: 0,
    returnTime: '22:00',
    lateAfterReturnTime: true,
    maxRentDays: 14,
    serviceEvery: 10,
    refundPercent: 100,
    damageRules: [
      'Kerusakan ringan (sobek kecil, resleting macet): biaya perbaikan sesuai nota servis.',
      'Kerusakan berat atau hilang: mengganti 100% harga barang baru.',
    ],
    integration: {
      driveConnected: true,
      driveAccount: 'annapurnaadv@gmail.com',
      driveRoot: 'ANNAPURNA ADVENTURE',
      autoMonthly: true,
      sendDay: 1,
      sendTime: '06:00',
      ownerEmail: 'owner@annapurna.id',
      ccEmails: '',
    },
    banks: [
      { bank: 'BCA', number: '1234567890', holder: 'Annapurna Adventure' },
      { bank: 'BRI', number: '0987 6543 2100 123', holder: 'Annapurna Adventure' },
    ],
    /* Durasi peminjaman sesuai syarat & ketentuan Annapurna Adventure */
    durations: [
      { days: 1, name: 'Per malam', note: 'Pengembalian esok hari', example: 'Ambil Kamis 01/08 pukul 09.00 WIB, kembali Jumat 02/08 maksimal pukul 22.00 WIB.' },
      { days: 3, name: 'Kegiatan (3 hari 3 malam)', note: 'Sewa 3 hari 3 malam', example: 'Ambil Kamis 01/08 pukul 09.00 WIB, kembali Minggu 04/08 maksimal pukul 22.00 WIB.' },
      { days: 5, name: 'Ekspedisi (5 hari 5 malam)', note: 'Sewa 5 hari 5 malam', example: 'Ambil Kamis 01/08 pukul 09.00 WIB, kembali Selasa 06/08 maksimal pukul 22.00 WIB.' },
    ],
    tektokTerms: TEKTOK_TERMS,
    rentalTerms: [
      'Pengambilan dan pengembalian barang dilakukan langsung di toko Annapurna Adventure, Jl. Kampus No. 8-9 Grendeng, Purwokerto Utara.',
      'Penyewa wajib menyerahkan kartu identitas asli (KTP/KTM/SIM) saat pengambilan barang.',
      'Durasi sewa: Per malam (pengembalian esok hari), Kegiatan 3 hari 3 malam, atau Ekspedisi 5 hari 5 malam, dihitung sejak tanggal pengambilan.',
      'Pengembalian paling lambat pada tanggal kembali, sampai jam operasional toko berakhir pukul 22.00 WIB.',
      'Pembayaran DP 50% diperlukan untuk mengunci booking. Sisa dibayar saat pengambilan barang.',
      'Lewat dari pukul 22.00 WIB pada tanggal kembali dihitung terlambat dan dikenakan biaya sewa per malam untuk setiap barang, setiap malam keterlambatan.',
      'Sewa bersih, kembali kotor? Biar kami yang membersihkan — penyewa cukup memakainya dengan happy tanpa harus mencuci.',
      'Kerusakan atau kehilangan barang menjadi tanggung jawab penyewa sesuai hasil pengecekan.',
    ],
    cancelPolicy: [
      'Pembatalan paling lambat H-2 sebelum tanggal ambil: DP dikembalikan penuh.',
      'Pembatalan kurang dari H-2: DP tidak dapat dikembalikan.',
      'Pengembalian DP diproses admin maksimal 2×24 jam ke rekening penyewa.',
    ],
    /* ---------- Konfigurasi sistem (diatur Owner) ---------- */
    /* Kategori yang unitnya wajib dicuci / dibersihkan setiap selesai disewa ("sewa bersih, kembali kotor biar kami yang membersihkan") */
    washCats: ['tenda', 'tas', 'footwear', 'fashion', 'outdoor', 'cooking'],
    attributes: [
      { id: 'at-ukuran', name: 'Ukuran pakaian', type: 'pilihan', values: ['S', 'M', 'L', 'XL', 'XXL'], variant: true, cats: ['fashion'], required: false, active: true },
      { id: 'at-sepatu', name: 'Ukuran sepatu (EU)', type: 'pilihan', values: ['38', '39', '40', '41', '42', '43', '44', '45'], variant: true, cats: ['footwear'], required: false, active: true },
      { id: 'at-kapasitas', name: 'Kapasitas', type: 'pilihan', values: ['2 orang', '4 orang', '4-5 orang', '6 orang', '40-50 L', '60 L', '70-80 L'], variant: false, cats: ['tenda', 'tas'], required: false, active: true },
      { id: 'at-tipe-tenda', name: 'Tipe tenda', type: 'pilihan', values: ['Double layer', 'Single layer'], variant: false, cats: ['tenda'], required: false, active: true },
      { id: 'at-gender', name: 'Gender', type: 'pilihan', values: ['Pria', 'Wanita', 'Unisex', 'Anak'], variant: false, cats: ['fashion', 'footwear'], required: false, active: true },
    ],
    conditions: [
      { name: 'Sangat Baik', rentable: true, tone: 'green' },
      { name: 'Baik', rentable: true, tone: 'green' },
      { name: 'Cukup', rentable: true, tone: 'amber' },
      { name: 'Tidak layak pakai', rentable: false, tone: 'red' },
    ],
    financeCats: {
      in: ['Pendapatan Lainnya', 'Jasa Cuci / Servis Alat', 'Sewa Lapak / Event'],
      out: ['Pembelian Barang', 'Perawatan Alat', 'Perbaikan Barang', 'Operasional', 'Promosi', 'Keperluan Usaha Lainnya'],
    },
    forms: {
      pickup: { note: 'opsional', photo: 'opsional', idCard: 'wajib', custom: [{ id: 'f-kelengkapan', label: 'Kelengkapan sudah dicek bersama customer', type: 'centang', required: true }] },
      return: { note: 'opsional', photo: 'wajib', custom: [] },
    },
    sops: [
      { id: 'sop-1', title: 'Pemeriksaan barang keluar', context: 'barang_keluar', pinned: true, body: 'Periksa kelengkapan barang bersama customer sebelum diserahkan (frame, pasak, flysheet, tas). Minta kartu identitas asli sebagai jaminan dan pastikan sisa pembayaran sudah lunas.' },
      { id: 'sop-2', title: 'Pemeriksaan barang kembali', context: 'pengembalian', pinned: true, body: 'Semua barang yang dikembalikan wajib diperiksa kondisi fisiknya dan difoto sebelum status rental diselesaikan. Pilih hasil pemeriksaan per unit: kotor → "Perlu dicuci", rusak → "Rusak — perlu diperbaiki" dengan keterangan. Unit baru bisa disewakan lagi setelah ditandai bersih / selesai diperbaiki di menu Perawatan Unit.' },
      { id: 'sop-3', title: 'Pengingat pengembalian', context: 'umum', pinned: false, body: 'Kirim pengingat WhatsApp ke penyewa yang jadwal kembalinya hari ini paling lambat pukul 12.00. Untuk yang terlambat, hubungi setiap hari sampai barang kembali.' },
      { id: 'sop-4', title: 'Pembatalan & refund', context: 'pembatalan', pinned: false, body: 'Cek tanggal pembatalan terhadap batas H-refund. Refund ditransfer maksimal 2×24 jam dan nomor referensi transfer wajib dicatat.' },
    ],
  };

  const USERS = [
    { id: 'u1', name: 'Pak Ikun', email: 'owner@annapurna.id', password: 'owner123', role: 'owner', status: 'aktif', phone: '081200001111', address: SETTINGS.address, createdAt: stampRel(-120, 8) },
    { id: 'u2', name: 'Dimas Saputra', email: 'customer@annapurna.id', password: 'customer123', role: 'customer', status: 'aktif', phone: '081390001122', address: 'Jl. Dr. Soeparno No. 12, Karangwangkal, Purwokerto Utara' },
    { id: 'u3', name: 'Dita', email: 'dita@annapurna.id', password: 'dita123', role: 'admin', status: 'aktif', phone: '085711223344', address: '', createdAt: stampRel(-60, 8), createdBy: 'u1' },
  ];
  /* Data contoh: semua aktivitas staff dilakukan oleh Dita (satu-satunya staff). */
  const dayNo = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z') / 864e5);
  const shiftOf = () => 'u3';
  const nameOf = (id) => USERS.find((u) => u.id === id).name;
  const STAFF_ROLES = ['admin', 'owner'];
  const isStaff = (u) => !!u && STAFF_ROLES.includes(u.role);
  const hasVariant = (p) => !!(p && p.variant && (p.variant.options || []).length);
  const variantName = (p, size) => (size && hasVariant(p) ? `${p.name} · ${p.variant.label.replace(/\s*\(.*\)/, '')} ${String(size).replace(/\s*\(.*\)/, '')}` : p.name);

  /* ---------- Tarif sewa (price list Annapurna Adventure) ----------
     Tiga tarif resmi: per malam (d1), perkegiatan 3 hari 3 malam (d3), ekspedisi 5 hari 5 malam (d5).
     Lama sewa di luar 1 / 3 / 5 malam dihitung dari kombinasi tarif yang paling murah,
     contoh: 4 malam = perkegiatan + 1 malam, 6 malam = ekspedisi + 1 malam. */
  const TIER_BLOCKS = [[5, 'd5', 'Ekspedisi (5 hari)'], [3, 'd3', 'Perkegiatan (3 hari)'], [1, 'd1', 'Per malam']];
  function productTiers(p) { return p ? { d1: +p.rent || 0, d3: +p.rent3 || 0, d5: +p.rent5 || 0 } : { d1: 0, d3: 0, d5: 0 }; }
  function tierPlan(t, days) {
    days = Math.max(1, Math.round(+days || 1)); t = t || {};
    const best = [{ cost: 0, from: -1, b: 0 }];
    for (let n = 1; n <= days; n++) {
      let cur = null;
      TIER_BLOCKS.forEach(([d, k]) => { const price = +t[k] || 0; if (!price || n < d || !best[n - d]) return; const c = best[n - d].cost + price; if (!cur || c < cur.cost) cur = { cost: c, from: n - d, b: d }; });
      best[n] = cur;
    }
    if (!best[days]) { const per = (+t.d1 || 0) || (+t.d3 || 0) / 3 || (+t.d5 || 0) / 5; return { total: Math.round(per * days), parts: [] }; }
    const count = {}; for (let n = days; n > 0; n = best[n].from) count[best[n].b] = (count[best[n].b] || 0) + 1;
    const parts = TIER_BLOCKS.filter(([d]) => count[d]).map(([d, k, name]) => ({ days: d, key: k, name, n: count[d], price: +t[k] || 0 }));
    return { total: best[days].cost, parts };
  }
  /* Label tarif yang dipakai, contoh "Perkegiatan (3 hari)" atau "Ekspedisi (5 hari) + 1 malam" */
  function tierLabel(t, days) {
    const pl = tierPlan(t, days);
    if (!pl.parts.length) return `${days} malam`;
    return pl.parts.map((x) => (x.days === 1 ? `${x.n} malam` : x.n > 1 ? `${x.n}× ${x.name}` : x.name)).join(' + ');
  }
  function packageTiers(pk, find) {
    if (!pk) return { d1: 0, d3: 0, d5: 0 };
    const sum = (d) => (pk.items || []).reduce((s, i) => s + tierPlan(productTiers(find(i.productId)), d).total * i.qty, 0);
    return { d1: +pk.price || 0, d3: +pk.price3 || sum(3), d5: +pk.price5 || sum(5) };
  }
  const lineTiers = (it) => it.tiers || { d1: +it.pricePerDay || 0 };
  const lineUnit = (it, days) => tierPlan(lineTiers(it), days).total;
  const itemsSubtotal = (items, days) => (items || []).reduce((s, it) => s + lineUnit(it, days) * it.qty, 0);

  function line(productId, qty, size) {
    const p = PRODUCTS.find((x) => x.id === productId);
    return Object.assign({ kind: 'product', refId: productId, name: variantName(p, size), img: p.img, qty, pricePerDay: p.rent, tiers: productTiers(p), components: [size ? { productId, qty: 1, size } : { productId, qty: 1 }] }, size ? { size } : {});
  }
  function pkgLine(pkgId, qty) {
    const pk = PACKAGES.find((x) => x.id === pkgId);
    return { kind: 'package', refId: pkgId, name: pk.name, img: pk.img, qty, pricePerDay: pk.price, tiers: packageTiers(pk, (id) => PRODUCTS.find((x) => x.id === id)), components: pk.items.map((i) => ({ productId: i.productId, qty: i.qty })) };
  }
  function booking(o) {
    const days = Math.max(1, diffDays(o.start, o.end));
    const subtotal = itemsSubtotal(o.items, days);
    const dp = Math.round(subtotal * SETTINGS.dpPercent / 100);
    return Object.assign({ days, subtotal, total: subtotal, dp, fine: 0, payments: [], refunds: [], changes: [], history: [], delivery: 'ambil', address: '', notes: '' }, o, { days, subtotal, total: subtotal + (o.fine || 0), dp });
  }
  const cust = (name, phone, email) => ({ name, phone, email });
  const DIMAS = cust('Dimas Saputra', '081390001122', 'customer@annapurna.id');

  function seedBookings() {
    const B = [];
    B.push(booking({ id: 'RNT-1001', customer: DIMAS, items: [line('tnd-4', 1), line('oe-sb', 2), line('ck-kompor', 1)], start: rel(3), end: rel(6),
      status: 'dikonfirmasi', paymentStatus: 'dp_paid', method: 'Transfer BCA', createdAt: stampRel(-2) }));
    B.push(booking({ id: 'RNT-1002', customer: DIMAS, items: [line('crr-60s', 1), line('tnd-2', 1)], start: rel(-24), end: rel(-21),
      status: 'selesai', paymentStatus: 'lunas', method: 'QRIS', createdAt: stampRel(-28) }));
    B.push(booking({ id: 'RNT-1003', customer: DIMAS, items: [line('oe-matras', 2), line('oe-lampu', 1)], start: rel(8), end: rel(9),
      status: 'menunggu_pembayaran', paymentStatus: 'unpaid', method: 'Transfer BRI', createdAt: stampRel(0, 8) }));
    B.push(booking({ id: 'RNT-1004', customer: cust('Rizky Amalia', '082134567788', 'rizky@mail.com'), items: [line('tnd-4', 2), line('oe-kursi', 4), line('ck-ds300', 1)], start: rel(-1), end: rel(2),
      status: 'disewa', paymentStatus: 'lunas', method: 'Transfer BCA', createdAt: stampRel(-6) }));
    B.push(booking({ id: 'RNT-1005', customer: cust('Andi Pratama', '085712340099', 'andi@mail.com'), items: [line('tnd-2', 1), line('oe-sb', 1), line('crr-60m', 1)], start: rel(-1), end: rel(0),
      status: 'disewa', paymentStatus: 'lunas', method: 'QRIS', createdAt: stampRel(-5) }));
    B.push(booking({ id: 'RNT-1006', customer: cust('Salsabila Nur Aini', '081227773344', 'salsa@mail.com'), items: [line('oe-sb', 1), line('oe-matras', 1)], start: rel(-4), end: rel(-1),
      status: 'disewa', paymentStatus: 'lunas', method: 'Transfer BRI', createdAt: stampRel(-7) }));
    B.push(booking({ id: 'RNT-1007', customer: cust('Bagas Wicaksono', '089612345678', 'bagas@mail.com'), items: [line('tnd-6', 1), line('oe-kursi', 4)], start: rel(2), end: rel(5),
      status: 'menunggu_konfirmasi', paymentStatus: 'dp_verifying', method: 'Transfer BCA', createdAt: stampRel(0, 9),
      proof: IMG('demo/bukti-dp-contoh.jpg'), proofMeta: { demo: true, amount: 129000, bank: 'BCA', account: '1234567890', receiver: 'ANNAPURNA ADVENTURE', note: 'DP RNT-1007', at: stampRel(0, 9) } }));
    B.push(booking({ id: 'RNT-1008', customer: cust('Nadia Putri', '081355556677', 'nadia@mail.com'), items: [line('tnd-4', 1), line('oe-lampu', 2), line('fs-gorpcore', 2, 'L'), line('fw-mid', 1, '42')], start: rel(0), end: rel(1),
      status: 'dikonfirmasi', paymentStatus: 'dp_paid', method: 'QRIS', createdAt: stampRel(-3) }));
    B.push(booking({ id: 'RNT-1009', customer: cust('Fajar Nugroho', '087811112222', 'fajar@mail.com'), items: [line('tas-day', 2), line('oe-headlamp', 2)], start: rel(-10), end: rel(-9),
      status: 'selesai', paymentStatus: 'lunas', method: 'Transfer BCA', createdAt: stampRel(-13), fine: 40000 }));
    B.push(booking({ id: 'RNT-1010', customer: cust('Laras Kusuma', '082244446666', 'laras@mail.com'), items: [line('oe-kursi', 2)], start: rel(5), end: rel(6),
      status: 'dibatalkan', paymentStatus: 'refunded', method: 'Transfer BRI', createdAt: stampRel(-4) }));
    B.push(booking({ id: 'RNT-1011', customer: cust('Yoga Pamungkas', '081998887766', 'yoga@mail.com'), items: [line('tnd-4', 1), line('oe-matras', 2), line('ck-kompor', 1)], start: rel(4), end: rel(9),
      status: 'dikonfirmasi', paymentStatus: 'dp_paid', method: 'Transfer BCA', createdAt: stampRel(-1) }));
    B.push(booking({ id: 'RNT-1012', customer: cust('Wahyu Hidayat', '085799990000', 'wahyu@mail.com'), items: [pkgLine('pk-2p', 1), pkgLine('pk-bbq1', 1)], start: rel(-16), end: rel(-15),
      status: 'selesai', paymentStatus: 'lunas', method: 'QRIS', createdAt: stampRel(-19) }));

    B.forEach((b) => {
      b.history.push({ at: b.createdAt, text: 'Booking dibuat' });
      const dpAt = new Date(new Date(b.createdAt).getTime() + 3600e3).toISOString();
      if (['dp_verifying'].includes(b.paymentStatus)) b.history.push({ at: dpAt, text: 'Bukti pembayaran DP diunggah' });
      if (['dp_paid', 'lunas', 'refunded'].includes(b.paymentStatus)) {
        b.payments.push({ at: dpAt, amount: b.dp, type: 'DP' });
        b.history.push({ at: dpAt, text: 'Pembayaran DP diverifikasi' });
      }
      if (['disewa', 'selesai'].includes(b.status)) {
        b.out = { at: b.start + 'T09:00:00', cond: 'Baik', by: nameOf(shiftOf(b.start + 'T09:00:00')), note: '' };
        b.payments.push({ at: b.start + 'T09:05:00', amount: b.subtotal - b.dp, type: 'Pelunasan' });
        b.history.push({ at: b.start + 'T09:00:00', text: 'Barang diambil customer' });
      }
      if (b.status === 'selesai') {
        const late = b.fine ? 1 : 0;
        b.ret = { at: addDays(b.end, late) + 'T16:00:00', cond: 'Baik', lateDays: late, damageFee: 0, fine: b.fine, by: nameOf(shiftOf(addDays(b.end, late) + 'T16:00:00')), note: b.fine ? 'Terlambat 1 malam (lewat pukul 22.00)' : '' };
        if (b.fine) b.payments.push({ at: b.ret.at, amount: b.fine, type: 'Denda' });
        b.history.push({ at: b.ret.at, text: 'Barang dikembalikan, booking selesai' });
      }
      if (b.status === 'dibatalkan') {
        b.cancel = { at: stampRel(-3), reason: 'Jadwal pendakian diundur', refundable: true, refundStatus: 'selesai' };
        b.refunds.push({ at: stampRel(-2), amount: b.dp });
        b.history.push({ at: stampRel(-3), text: 'Customer membatalkan booking' });
        b.history.push({ at: stampRel(-2), text: 'DP dikembalikan ke customer' });
      }
    });
    const b11 = B.find((b) => b.id === 'RNT-1011');
    const T4 = PRODUCTS.find((p) => p.id === 'tnd-4'), T6 = PRODUCTS.find((p) => p.id === 'tnd-6');
    b11.changes.push({ id: 'CHG-1', at: stampRel(0, 7), lineIndex: 0, fromId: 'tnd-4', fromName: T4.name, toId: 'tnd-6', toName: T6.name, qty: 1,
      diff: tierPlan(productTiers(T6), b11.days).total - tierPlan(productTiers(T4), b11.days).total, reason: 'Ternyata yang ikut jadi 5 orang', status: 'menunggu' });
    return B;
  }

  function sale(o) {
    const subtotal = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    return Object.assign({ payments: [], history: [], notes: '' }, o, { subtotal, total: subtotal, delivery: 'ambil' });
  }
  const si = (id, qty) => { const p = PRODUCTS.find((x) => x.id === id); return { productId: id, name: p.name, img: p.img, qty, price: p.price }; };
  function seedSales() {
    const S = [
      sale({ id: 'ORD-2001', customer: DIMAS, items: [si('gas', 4), si('jl-12', 1)], delivery: 'ambil', status: 'selesai', paymentStatus: 'paid', method: 'QRIS', createdAt: stampRel(-12) }),
      sale({ id: 'ORD-2002', customer: cust('Rizky Amalia', '082134567788', 'rizky@mail.com'), items: [si('jl-2', 2)], delivery: 'ambil', status: 'siap_diambil', paymentStatus: 'paid', method: 'Transfer BCA', createdAt: stampRel(-2) }),
      sale({ id: 'ORD-2003', customer: cust('Hendra Wijaya', '081222333444', 'hendra@mail.com'), items: [si('jl-5', 1), si('jl-13', 1)], delivery: 'ambil', status: 'dikemas', paymentStatus: 'paid', method: 'Transfer BRI', createdAt: stampRel(-1) }),
      sale({ id: 'ORD-2004', customer: cust('Maya Lestari', '085600001111', 'maya@mail.com'), items: [si('gas', 6)], delivery: 'ambil', status: 'diproses', paymentStatus: 'verifying', method: 'QRIS', createdAt: stampRel(0, 8) }),
      sale({ id: 'ORD-2005', customer: cust('Tegar Prakoso', '087700009999', 'tegar@mail.com'), items: [si('jl-11', 1)], delivery: 'ambil', status: 'selesai', paymentStatus: 'paid', method: 'Transfer BCA', createdAt: stampRel(0, 10) }),
      sale({ id: 'ORD-2006', customer: cust('Putri Anjani', '081566667777', 'putri@mail.com'), items: [si('jl-3', 1), si('jl-6', 1)], delivery: 'ambil', status: 'selesai', paymentStatus: 'paid', method: 'QRIS', createdAt: stampRel(-5) }),
    ];
    S.forEach((s) => {
      s.history.push({ at: s.createdAt, text: 'Pesanan dibuat' });
      if (s.paymentStatus === 'paid') { s.payments.push({ at: s.createdAt, amount: s.total, type: 'Pembayaran' }); s.history.push({ at: s.createdAt, text: 'Pembayaran diverifikasi' }); }
    });
    return S;
  }

  function seedExpenses() {
    return [
      { id: 'EXP-1', date: rel(-20), category: 'Pembelian Barang', desc: 'Tambah 4 unit Matras', amount: 200000 },
      { id: 'EXP-2', date: rel(-14), category: 'Perawatan Alat', desc: 'Cuci sleeping bag (10 unit)', amount: 150000 },
      { id: 'EXP-3', date: rel(-9), category: 'Operasional', desc: 'Listrik & internet toko', amount: 425000 },
      { id: 'EXP-4', date: rel(-6), category: 'Perawatan Alat', desc: 'Ganti frame tenda patah', amount: 175000 },
      { id: 'EXP-5', date: rel(-3), category: 'Pembelian Barang', desc: 'Restock gas kaleng (48 pcs)', amount: 576000 },
      { id: 'EXP-6', date: rel(-1), category: 'Operasional', desc: 'Plastik kemasan & label', amount: 85000 },
      { id: 'EXP-7', date: rel(0), category: 'Lainnya', desc: 'Air galon & perlengkapan kebersihan toko', amount: 60000 },
    ];
  }

  function seedIncomes() {
    return [
      { id: 'INC-1', date: rel(-8), category: 'Pendapatan Lainnya', desc: 'Jasa cuci tenda milik customer (2 unit)', amount: 50000, status: 'aktif' },
      { id: 'INC-2', date: rel(-2), category: 'Pendapatan Lainnya', desc: 'Sewa lapak stand saat acara kampus', amount: 150000, status: 'aktif' },
    ];
  }

  /* ---------- Histori sistem (audit trail, append-only + rantai hash) ---------- */
  const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); };
  const auditBody = (e) => JSON.stringify([e.id, e.at, e.userId, e.userName, e.role, e.type, e.action, e.ref || '', e.changes || []]);
  const auditHash = (e, prev) => { const x = prev + '|' + auditBody(e); return fnv(x) + fnv(x + '#'); };
  const auditId = (n) => 'AUD-' + String(n).padStart(5, '0');
  function chain(list) {
    let prev = 'GENESIS';
    return list.map((e, i) => { const x = Object.assign({}, e, { id: auditId(i + 1), prev }); x.hash = auditHash(x, prev); prev = x.hash; return x; });
  }

  function seedAudit(B, S, E, users) {
    const U = Object.fromEntries(users.filter(isStaff).map((u) => [u.id, u]));
    const ev = [];
    const add = (uid, at, type, action, extra) => ev.push(Object.assign({ userId: uid, userName: U[uid].name, role: U[uid].role, at, type, action }, extra || {}));
    const at = (off, h, m) => { const d = new Date(); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const plus = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString();
    const by = shiftOf;
    for (let i = -30; i <= 0; i++) {
      const morning = shiftOf(at(i, 9, 0)), noon = shiftOf(at(i, 14, 0)), k = (i + 30) % 5;
      add(morning, at(i, 8, 45 + k), 'login', 'Login ke panel admin'); if (i < 0) add(morning, at(i, 16, 2 + k), 'logout', 'Logout dari panel admin');
      add(noon, at(i, 12, 50 + k), 'login', 'Login ke panel admin'); if (i < 0) add(noon, at(i, 21, 1 + k), 'logout', 'Logout dari panel admin');
      if ((i + 30) % 3 === 0 && i < 0) { add('u1', at(i, 19, 30), 'login', 'Login ke panel owner'); add('u1', at(i, 20, 5), 'logout', 'Logout dari panel owner'); }
    }
    const items = (b) => b.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
    B.forEach((b) => {
      (b.payments || []).forEach((p) => {
        if (p.type === 'DP') add(by(p.at), p.at, 'rental', `Mengonfirmasi booking ${b.id} (DP ${rupiah(p.amount)} diverifikasi)`, { ref: b.id, changes: [{ field: 'Status booking', from: 'Menunggu Konfirmasi', to: 'Booking Dikonfirmasi' }] });
        if (p.type === 'Pelunasan') add(by(p.at), plus(p.at, 1), 'rental', `Menerima pelunasan ${rupiah(p.amount)} untuk ${b.id}`, { ref: b.id });
        if (p.type === 'Denda') add(by(p.at), plus(p.at, 2), 'keuangan', `Menerima denda ${rupiah(p.amount)} dari ${b.id}`, { ref: b.id });
      });
      if (b.out) add(by(b.out.at), b.out.at, 'barang_keluar', `Mencatat barang keluar ${b.id}: ${items(b)}`, { ref: b.id, changes: [{ field: 'Status booking', from: 'Booking Dikonfirmasi', to: 'Sedang Disewa' }] });
      if (b.ret) add(by(b.ret.at), b.ret.at, 'pengembalian', `Mencatat barang kembali ${b.id} (kondisi ${b.ret.cond}${b.ret.lateDays ? `, terlambat ${b.ret.lateDays} hari` : ''})`, { ref: b.id, changes: [{ field: 'Status booking', from: 'Sedang Disewa', to: 'Selesai' }] });
      (b.refunds || []).forEach((r) => add(by(r.at), r.at, 'refund', `Memproses refund DP ${b.id} sebesar ${rupiah(r.amount)}`, { ref: b.id, changes: [{ field: 'Status pembayaran', from: 'Menunggu Refund', to: 'DP Dikembalikan' }] }));
    });
    S.forEach((s) => {
      if (s.paymentStatus === 'paid') add(by(plus(s.createdAt, 25)), plus(s.createdAt, 25), 'penjualan', `Memverifikasi pembayaran ${s.id} (${rupiah(s.total)})`, { ref: s.id, changes: [{ field: 'Status pesanan', from: 'Menunggu Pembayaran', to: 'Diproses' }] });
      const flow = ['dikemas', 'siap_diambil', 'selesai']; const lbl = { dikemas: 'Dikemas', siap_diambil: 'Siap Diambil di Toko', selesai: 'Selesai' };
      const last = flow.indexOf(s.status);
      flow.slice(0, last + 1).forEach((st, k) => { const t = plus(s.createdAt, 60 + k * 90); add(by(t), t, 'penjualan', `Mengubah status pesanan ${s.id} menjadi ${lbl[st]}`, { ref: s.id, changes: [{ field: 'Status pesanan', from: k ? lbl[flow[k - 1]] : 'Diproses', to: lbl[st] }] }); });
    });
    E.forEach((e) => { const t = new Date(e.date + 'T11:10:00').toISOString(); add(by(t), t, 'keuangan', `Mencatat pengeluaran ${e.category}: ${e.desc}`, { ref: e.id, changes: [{ field: 'Jumlah', from: '', to: rupiah(e.amount) }] }); });
    const ext = (off, h, m, type, action, extra) => { const t = at(off, h, m); add(by(t), t, type, action, extra); };
    ext(-8, 11, 30, 'keuangan', 'Mencatat pemasukan lainnya: Jasa cuci tenda milik customer (2 unit)', { ref: 'INC-1', changes: [{ field: 'Jumlah', from: '', to: rupiah(50000) }] });
    ext(-2, 15, 5, 'keuangan', 'Mencatat pemasukan lainnya: Sewa lapak stand saat acara kampus', { ref: 'INC-2', changes: [{ field: 'Jumlah', from: '', to: rupiah(150000) }] });
    ext(-20, 11, 20, 'stok', 'Mengubah stok Matras', { ref: 'oe-matras', changes: [{ field: 'Stok', from: '20 unit', to: '24 unit' }] });
    ext(-14, 15, 40, 'tambah', 'Menambahkan barang Powerbank 20.000 mAh', { ref: 'oe-pb20', changes: [{ field: 'Harga sewa / malam', from: '', to: rupiah(25000) }, { field: 'Perkegiatan (3 hari)', from: '', to: rupiah(45000) }, { field: 'Ekspedisi (5 hari)', from: '', to: rupiah(65000) }, { field: 'Stok', from: '', to: '4 unit' }] });
    ext(-9, 14, 10, 'harga', 'Mengubah harga Tenda Kapasitas 4 (Double Layer) sesuai price list baru', { ref: 'tnd-4', changes: [{ field: 'Perkegiatan (3 hari)', from: rupiah(75000), to: rupiah(70000) }] });
    ext(-6, 10, 5, 'kondisi', 'Mengubah kondisi Meja Lipat', { ref: 'oe-meja', changes: [{ field: 'Kondisi', from: 'Perlu Perawatan', to: 'Sangat Baik' }] });
    ext(-3, 16, 20, 'ulasan', 'Membalas ulasan Putri Anjani (ORD-2006)', { ref: 'REV-5' });
    ext(-11, 9, 40, 'login_gagal', 'Percobaan login gagal: kata sandi salah');
    add('u1', at(-12, 19, 45), 'pengaturan', 'Mengubah pengaturan toko', { changes: [{ field: 'Jam operasional', from: 'Setiap hari, 09.00 – 21.00 WIB', to: 'Setiap hari, 09.00 – 22.00 WIB' }] });
    const now = Date.now();
    const list = ev.filter((e) => new Date(e.at).getTime() <= now).sort((a, b) => a.at.localeCompare(b.at));
    list.forEach((e) => { const u = users.find((x) => x.id === e.userId); if (e.type === 'login') u.lastLogin = e.at; if (e.type === 'logout') u.lastLogout = e.at; });
    return chain(list);
  }

  function seedOutbox(users) {
    return users.filter((u) => u.role === 'admin').map((u, i) => ({ id: 'MAIL-' + (i + 1), at: u.createdAt, kind: 'staff_invite', to: u.email, subject: 'Anda telah ditambahkan sebagai Staff Annapurna Adventure Shop',
      data: { name: u.name, email: u.email, role: u.role, tempPassword: u.password, by: 'Pak Ikun' }, status: 'terkirim' }));
  }

  /* ---------- Unit fisik (nomor inventaris) ---------- */
  const unitPrefix = (p) => String(p.sku || p.id).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-?0*1$/, '').replace(/-$/, '') || p.id.toUpperCase();
  const tracked = (p) => !!(p && p.rent > 0);
  function newUnit(p, size, n) {
    return Object.assign({ code: `${unitPrefix(p)}-${String(n).padStart(2, '0')}`, cond: 'Baik', status: 'aktif', rents: 0, sinceService: 0, lastService: null, notes: '', out: null, log: [] }, size ? { size } : {});
  }
  /* Samakan jumlah unit dengan stok (menambah unit baru bila stok naik). */
  function syncUnits(p) {
    if (!tracked(p)) { delete p.units; return p; }
    p.units = p.units || [];
    let n = p.units.reduce((m, u) => Math.max(m, parseInt(u.code.split('-').pop(), 10) || 0), 0);
    const live = (size) => p.units.filter((u) => u.status !== 'terjual' && u.status !== 'nonaktif' && (size == null || u.size === size)).length;
    if (hasVariant(p)) p.variant.options.forEach((o) => { while (live(o.name) < o.stock) p.units.push(newUnit(p, o.name, ++n)); });
    else while (live(null) < p.stock) p.units.push(newUnit(p, null, ++n));
    if (hasVariant(p)) { p.variant.options.forEach((o) => { o.stock = live(o.name); }); p.stock = p.variant.options.reduce((a, o) => a + o.stock, 0); }
    else p.stock = live(null);
    return p;
  }
  function seedUnits(products, bookings) {
    products.forEach((p) => { syncUnits(p); (p.units || []).forEach((u, i) => { u.rents = 4 + ((i * 3) % 9); u.sinceService = (i * 3) % 8; u.lastService = stampRel(-40 + i, 10); }); });
    const P = Object.fromEntries(products.map((p) => [p.id, p]));
    const t1 = P['tnd-4'].units; t1[5].care = 'perbaikan'; t1[5].careInfo = { issue: 'Frame patah satu ruas, menunggu suku cadang', since: stampRel(-4, 16), by: 'Dita' }; t1[5].log.push({ at: stampRel(-4, 16), text: 'Dilaporkan rusak: Frame patah satu ruas — masuk perbaikan', by: 'Dita' });
    t1[0].sinceService = 11; P['oe-sb'].units[2].care = 'cuci'; P['oe-sb'].units[2].careInfo = { since: stampRel(-1, 16), by: 'Dita' }; P['oe-sb'].units[2].log.push({ at: stampRel(-1, 16), text: 'Masuk antrian cuci', by: 'Dita' });
    bookings.forEach((b) => {
      if (!b.out) return;
      b.items.forEach((it) => { it.units = [];
        it.components.forEach((c) => { const p = P[c.productId]; if (!p || !p.units) return;
          for (let k = 0; k < c.qty * it.qty; k++) {
            const u = p.units.find((x) => x.status === 'aktif' && !x.out && (!c.size || x.size === c.size) && !x.care && !it.units.some((y) => y.code === x.code) && !(b.status === 'selesai' ? false : x.out));
            if (!u) break;
            it.units.push({ pid: p.id, code: u.code });
            if (b.status === 'disewa') u.out = b.id;
            u.log.push({ at: b.out.at, text: `Keluar untuk ${b.id}`, by: b.out.by });
            if (b.ret) u.log.push({ at: b.ret.at, text: `Kembali dari ${b.id} (Baik)`, by: b.ret.by });
          } }); });
    });
  }

  function seedPromos() {
    return [
      { id: 'PR-1', code: 'WEEKDAY15', name: 'Hemat Hari Kerja', desc: 'Diskon 15% sewa alat bila tanggal ambil Senin–Kamis.', type: 'persen', value: 15, applies: 'rent', minTotal: 0, start: rel(-10), end: rel(60), weekday: true, quota: 100, used: 7, active: true, home: true },
      { id: 'PR-2', code: 'ANNAPURNA10', name: 'Diskon Petualang', desc: 'Potongan 10% untuk sewa & belanja minimal Rp200.000.', type: 'persen', value: 10, applies: 'all', minTotal: 200000, start: rel(-30), end: rel(30), weekday: false, quota: 50, used: 12, active: true, home: true },
      { id: 'PR-3', code: 'GASKEUN', name: 'Potongan Belanja', desc: 'Potongan Rp10.000 untuk belanja alat minimal Rp100.000.', type: 'nominal', value: 10000, applies: 'buy', minTotal: 100000, start: rel(-5), end: rel(25), weekday: false, quota: 30, used: 3, active: true, home: false },
    ];
  }

  function seedNotifications() {
    return [
      { id: 'n1', email: 'customer@annapurna.id', at: stampRel(-1, 13), title: 'Booking dikonfirmasi', text: 'Booking RNT-1001 sudah dikonfirmasi. Barang bisa diambil sesuai tanggal sewa.', read: false, link: 'pesanan?id=RNT-1001' },
      { id: 'n2', email: 'customer@annapurna.id', at: stampRel(0, 8), title: 'Selesaikan pembayaran DP', text: 'Bayar DP untuk RNT-1003 agar barang tidak diambil penyewa lain.', read: false, link: 'pembayaran?ids=RNT-1003' },
      { id: 'n3', email: 'customer@annapurna.id', at: stampRel(-12), title: 'Pesanan selesai', text: 'Pesanan ORD-2001 sudah selesai. Terima kasih sudah belanja!', read: true, link: 'pesanan?tab=beli' },
      ...USERS.filter(isStaff).map((u) => ({ id: 'n4' + u.id, email: u.email, at: stampRel(0, 9), title: 'Bukti DP masuk', text: 'Bagas Wicaksono mengunggah bukti DP untuk RNT-1007.', read: false, link: 'admin/booking?id=RNT-1007' })),
      ...USERS.filter(isStaff).map((u) => ({ id: 'n5' + u.id, email: u.email, at: stampRel(0, 7), title: 'Permintaan ganti barang', text: 'Yoga Pamungkas ingin mengganti Tenda Kapasitas 4 menjadi Tenda Kapasitas 6 (RNT-1011).', read: false, link: 'admin/permintaan' })),
    ];
  }

  function seedReviews() {
    const R = (id, refId, name, email, role, img, rating, text, productIds, daysAgo, extra) => Object.assign({ id, refId, type: refId.startsWith('ORD') ? 'buy' : 'rent', name, email, role, img: img ? IMG(img) : '', rating, text, productIds, createdAt: stampRel(daysAgo, 19), visible: true, featured: false, reply: '', seen: true }, extra || {});
    return [
      R('REV-1', 'RNT-0981', 'Rizky Amalia', 'rizky@mail.com', 'Pendaki, Purwokerto', 'avatar1.jpg', 5, 'Peralatannya lengkap dan masih bagus banget. Proses sewanya juga gampang. Nanti pasti sewa lagi!', ['tnd-4', 'oe-kursi'], -40, { featured: true, order: 0 }),
      R('REV-2', 'RNT-0987', 'Andi Pratama', 'andi@mail.com', 'Mahasiswa, UIN', 'avatar2.jpg', 5, 'Harga terjangkau, pelayanannya ramah. Sangat membantu untuk trip camping bareng teman-teman.', ['oe-kursi', 'ck-kompor'], -33, { featured: true, order: 1 }),
      R('REV-3', 'RNT-0992', 'Salsabila Nur Aini', 'salsa@mail.com', 'Camper, Cilacap', 'avatar3.jpg', 5, 'Tenda dan sleeping bag nya bersih, kualitas oke. Rekomendasi banget buat yang cari rental alat camping di Purwokerto!', ['tnd-2', 'oe-sb'], -27, { featured: true, order: 2, reply: 'Terima kasih Salsabila, ditunggu petualangan berikutnya!', replyAt: stampRel(-26, 9), replySeen: true }),
      R('REV-4', 'RNT-1009', 'Fajar Nugroho', 'fajar@mail.com', 'Penyewa', '', 5, 'Daypack enak dipakai, headlamp-nya terang dan awet baterainya. Admin fast respon di WhatsApp.', ['tas-day', 'oe-headlamp'], -7, { seen: false }),
      R('REV-5', 'ORD-2006', 'Putri Anjani', 'putri@mail.com', 'Pembeli', '', 4, 'Sleeping bag dan lampu sesuai foto. Sempat antre sebentar waktu ambil di toko, tapi pelayanannya ramah.', ['jl-3', 'jl-6'], -4, { seen: false, reply: 'Terima kasih masukannya, Kak Putri! Sekarang kami tambah satu petugas di jam ramai supaya pengambilan lebih cepat.', replyAt: stampRel(-3, 10), replySeen: false }),
      R('REV-6', 'ORD-2005', 'Tegar Prakoso', 'tegar@mail.com', 'Pembeli', '', 3, 'Kompor & cooking set oke, cuma kotaknya agak penyok. Semoga packing ke depan lebih rapi.', ['jl-11'], 0, { seen: false }),
    ];
  }

  const read = (k, fb) => { try { const v = localStorage.getItem(KEY(k)); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  const write = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { console.warn('Penyimpanan penuh / tidak tersedia', e); } };

  function seed(force) {
    if (!force && read('version') === VERSION) return;
    write('categories', CATEGORIES);
    const PR = JSON.parse(JSON.stringify(PRODUCTS));
    write('packages', PACKAGES);
    write('settings', SETTINGS);
    const B = seedBookings(), S = seedSales(), E = seedExpenses().map((e) => Object.assign({ status: 'aktif' }, e));
    seedUnits(PR, B);
    PR.find((p) => p.id === 'gas').minStock = 10; PR.forEach((p) => { if (p.price && p.minStock == null) p.minStock = 2; });
    write('products', PR);
    write('bookings', B);
    write('sales', S);
    write('promos', seedPromos());
    write('customerMeta', { 'fajar@mail.com': { flag: 'normal', note: 'Pernah terlambat 1 hari, tapi kooperatif.' }, 'laras@mail.com': { flag: 'jaminan', note: 'Sering batal mendadak. Minta jaminan KTP + KTM.' } });
    const users = USERS.map((u) => Object.assign({}, u));
    write('expenses', E);
    write('incomes', seedIncomes());
    write('audit', seedAudit(B, S, E, users));
    write('users', users);
    write('outbox', seedOutbox(users));
    write('archives', []);
    write('notifications', seedNotifications());
    write('reviews', seedReviews());
    write('cart', []);
    write('version', VERSION);
  }
  seed(false);
  /* Kualitas per unit tidak dipakai lagi: unit lama yang "Tidak layak pakai" dipindah ke status Dalam perbaikan
     (tetap tidak bisa disewa), dan semua unit kualitasnya disamakan "Baik". */
  /* Pembaruan data tersimpan: Carrier Eiger 60L tanpa ukuran punggung, Gas Kaleng versi sewa, paket BBQ memakai gas sewa */
  (function migrateCatalog() {
    const all = read('products', PRODUCTS); let ch = false;
    const crr = all.find((x) => x.id === 'jl-5');
    if (crr && crr.variant && /punggung/i.test(crr.variant.label || '')) { crr.stock = crr.variant.options.reduce((a, o) => a + (+o.stock || 0), 0); delete crr.variant; ch = true; }
    if (!all.some((x) => x.id === 'gas-sewa')) { const g = JSON.parse(JSON.stringify(PRODUCTS.find((x) => x.id === 'gas-sewa'))); all.push(syncUnits(g)); ch = true; }
    if (ch) write('products', all);
    const pk = read('packages', PACKAGES); let pc = false;
    pk.forEach((k) => (k.items || []).forEach((i) => { if (k.type === 'bbq' && i.productId === 'gas') { i.productId = 'gas-sewa'; pc = true; } }));
    if (pc) write('packages', pk);
    const st = read('settings', SETTINGS);
    if ((st.attributes || []).some((x) => x.id === 'at-punggung')) { st.attributes = st.attributes.filter((x) => x.id !== 'at-punggung'); write('settings', st); }
  })();
  (function migrateUnitCond() {
    const all = read('products', PRODUCTS); let changed = false;
    all.forEach((p) => (p.units || []).forEach((u) => {
      if (u.cond && u.cond !== 'Baik') {
        if (/tidak layak/i.test(u.cond) && u.status === 'aktif' && !u.care) { u.care = 'perbaikan'; u.careInfo = { since: nowStamp(), by: 'Sistem', issue: 'Sebelumnya ditandai "Tidak layak pakai"' }; }
        u.cond = 'Baik'; changed = true;
      }
    }));
    if (changed) write('products', all);
  })();

  function withRating(list) {
    const rv = read('reviews', []).filter((r) => r.visible);
    return list.map((p) => {
      const mine = rv.filter((r) => r.productIds.includes(p.id));
      const n = (p.reviews || 0) + mine.length;
      const sum = (p.rating || 0) * (p.reviews || 0) + mine.reduce((a, r) => a + r.rating, 0);
      return Object.assign({}, p, { rating: n ? Math.round((sum / n) * 10) / 10 : 0, reviews: n });
    });
  }

  const ROLE_LABEL = { owner: 'Owner', admin: 'Admin / Staff', customer: 'Customer', system: 'Sistem' };
  const condList = () => (read('settings', SETTINGS).conditions || SETTINGS.conditions);
  const condRentable = (name) => { const c = condList().find((x) => x.name === name); return c ? c.rentable !== false : true; };
  const catActive = () => { const m = {}; read('categories', CATEGORIES).forEach((c) => { m[c.id] = c.active !== false; }); return m; };
  const isActiveProduct = (p, cm) => p.active !== false && (cm || catActive())[p.cat] !== false;
  const diff = (a, b, fields) => fields.filter(([k]) => JSON.stringify(a[k] ?? '') !== JSON.stringify(b[k] ?? '')).map(([k, label, f]) => ({ field: label, from: f ? f(a[k]) : String(a[k] ?? ''), to: f ? f(b[k]) : String(b[k] ?? '') }));
  const money = (v) => (v ? rupiah(v) : '—');
  const unit = (v) => `${v ?? 0} unit`;
  const yes = (v) => (v ? 'Ya' : 'Tidak');
  const actv = (v) => (v === false ? 'Tidak Aktif' : 'Aktif');

  function actorOf(u) { return u ? { userId: u.id, userName: u.name, role: u.role } : null; }

  const DB = {
    get: (k) => { if (k === 'bookings' || k === 'sales') ensureNos(); return read(k, []); },
    set(k, v) { if (k === 'audit') { console.warn('Histori bersifat append-only dan tidak bisa ditimpa.'); return; } write(k, v); },
    reset() {
      const s = read('session', null); seed(true);
      if (s) { write('session', s); DB.audit({ type: 'pengaturan', action: 'Menyetel ulang data demo' }); }
    },
    settings: () => Object.assign({}, SETTINGS, read('settings', SETTINGS)), // kunci baru (mis. howto, receipt) otomatis terisi nilai bawaan
    saveSettings(next) {
      const old = DB.settings();
      const ch = diff(old, next, [['storeName', 'Nama toko'], ['hours', 'Jam operasional'], ['phone', 'Telepon'], ['whatsapp', 'WhatsApp'], ['email', 'Email toko'], ['instagram', 'Instagram'], ['address', 'Alamat'],
        ['dpPercent', 'DP (%)'], ['cancelDays', 'Batas refund (H-)'], ['lateFeePercent', 'Denda telat (%)']]);
      if (JSON.stringify(old.banks) !== JSON.stringify(next.banks)) ch.push({ field: 'Rekening pembayaran', from: old.banks.map((b) => `${b.bank} ${b.number}`).join(', '), to: next.banks.map((b) => `${b.bank} ${b.number}`).join(', ') });
      if (JSON.stringify(old.rentalTerms) !== JSON.stringify(next.rentalTerms)) ch.push({ field: 'Ketentuan rental', from: `${old.rentalTerms.length} poin`, to: `${next.rentalTerms.length} poin (diperbarui)` });
      if (JSON.stringify(old.cancelPolicy) !== JSON.stringify(next.cancelPolicy)) ch.push({ field: 'Kebijakan pembatalan', from: `${old.cancelPolicy.length} poin`, to: `${next.cancelPolicy.length} poin (diperbarui)` });
      const oi = old.integration || {}, ni = next.integration || {};
      ch.push(...diff(oi, ni, [['driveRoot', 'Folder Google Drive'], ['autoMonthly', 'Rekap otomatis', yes], ['sendDay', 'Tanggal kirim rekap'], ['sendTime', 'Jam kirim rekap'], ['ownerEmail', 'Email penerima laporan'], ['ccEmails', 'CC laporan']]));
      write('settings', next);
      if (ch.length) DB.audit({ type: 'pengaturan', action: JSON.stringify(oi) !== JSON.stringify(ni) && ch.every((c) => /rekap|Drive|laporan/i.test(c.field)) ? 'Mengubah pengaturan integrasi Google Drive & Email' : 'Mengubah pengaturan toko', changes: ch });
      return ch.length;
    },
    categories: (all) => read('categories', CATEGORIES).filter((c) => all || c.active !== false),
    saveCategory(c) {
      const list = read('categories', CATEGORIES); const i = list.findIndex((x) => x.id === c.id);
      if (i < 0) { list.push(Object.assign({ active: true }, c)); write('categories', list); DB.audit({ type: 'tambah', action: `Menambahkan kategori ${c.name}`, ref: c.id }); return; }
      const ch = diff(list[i], c, [['name', 'Nama kategori'], ['active', 'Status', actv]]);
      if (list[i].img !== c.img) ch.push({ field: 'Gambar', from: 'gambar lama', to: 'gambar baru' });
      list[i] = Object.assign({}, list[i], c); write('categories', list);
      if (!ch.length) return;
      const st = ch.length === 1 && ch[0].field === 'Status';
      DB.audit({ type: st ? 'status' : 'edit', action: st ? `${c.active === false ? 'Menonaktifkan' : 'Mengaktifkan'} kategori ${c.name}` : `Mengedit kategori ${c.name}`, ref: c.id, changes: ch });
    },
    products: (all) => { const cm = catActive(); return withRating(read('products', PRODUCTS).filter((p) => all || isActiveProduct(p, cm))); },
    product: (id) => withRating(read('products', PRODUCTS)).find((p) => p.id === id),
    isActiveProduct: (p) => !!p && isActiveProduct(p),
    hasVariant,
    variantName,
    sizeStock: (p, size) => { if (!hasVariant(p)) return p ? p.stock : 0; const o = p.variant.options.find((x) => x.name === size); return o ? o.stock : 0; },
    get COND_LIST() { return condList().map((c) => c.name); },
    conditions: condList,
    condRentable,
    condTone: (name) => (condList().find((x) => x.name === name) || { tone: 'gray' }).tone,
    attributes: (all) => (read('settings', SETTINGS).attributes || []).filter((a) => all || a.active !== false),
    attrsForCat: (cat) => (read('settings', SETTINGS).attributes || []).filter((a) => a.active !== false && (!(a.cats || []).length || a.cats.includes(cat))),
    financeCats: (kind) => ((read('settings', SETTINGS).financeCats || SETTINGS.financeCats)[kind] || []),
    formCfg: (k) => Object.assign({ note: 'opsional', photo: 'opsional', custom: [] }, ((read('settings', SETTINGS).forms || {})[k]) || {}),
    sops: (ctx) => (read('settings', SETTINGS).sops || []).filter((x) => !ctx || x.context === ctx),
    lateFeeText() { const st = DB.settings(); return st.lateFeeMode === 'nominal' ? `${rupiah(st.lateFeeAmount)} per barang per malam keterlambatan` : st.lateFeePercent === 100 ? 'sebesar harga sewa per malam untuk setiap barang, setiap malam keterlambatan' : `${st.lateFeePercent}% harga sewa per malam untuk setiap barang, setiap malam keterlambatan`; },
    /* Simpan satu bagian konfigurasi + catat di histori */
    saveConfig(key, value, action, changes) {
      const st = DB.settings(); st[key] = value; write('settings', st);
      DB.audit({ type: 'konfigurasi', action, changes });
    },
    packages: () => read('packages', PACKAGES),
    pkg: (id) => read('packages', PACKAGES).find((p) => p.id === id),
    bookings: () => (ensureNos(), read('bookings', [])),
    booking: (id) => (ensureNos(), read('bookings', []).find((b) => b.id === id || b.no === id)),
    /* ---------- Unit ---------- */
    tracked,
    units: (pid) => ((read('products', PRODUCTS).find((p) => p.id === pid) || {}).units || []),
    /* Unit yang dihitung untuk ketersediaan. Unit "perlu dicuci" tetap dihitung (siap dalam hitungan jam),
       unit "dalam perbaikan" tidak dihitung sampai selesai diperbaiki. */
    rentableUnits(p, size) { return (p.units || []).filter((u) => u.status === 'aktif' && u.care !== 'perbaikan' && condRentable(u.cond) && (size == null || u.size === size)); },
    /* Unit yang benar-benar bisa diserahkan ke customer sekarang */
    unitReady: (u) => u.status === 'aktif' && !u.out && !u.care && condRentable(u.cond),
    unitState(u) {
      if (u.status === 'terjual') return { k: 'off', l: 'Terjual', tone: 'gray' };
      if (u.status !== 'aktif') return { k: 'off', l: OFF_REASON[u.offReason] || 'Nonaktif', tone: u.offReason === 'hilang' || u.offReason === 'rusak' ? 'red' : 'gray', reason: u.offReason || 'lainnya' };
      if (u.out) {
        /* Status sewa ikut tanggal kembali: Kembali hari ini (batas jam tutup toko) → Terlambat X malam */
        const b = DB.booking(u.out); const now = new Date(); const t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const late = b && b.status === 'disewa' ? Rules.lateDays(b, today(), t) : 0;
        if (late) return { k: 'out', due: 'late', late, l: `Terlambat ${late} malam · ${u.out}`, tone: 'red', booking: u.out };
        if (b && b.status === 'disewa' && b.end === today()) return { k: 'out', due: 'today', l: `Kembali hari ini · ${u.out}`, tone: 'amber', booking: u.out };
        return { k: 'out', l: `Disewa · ${u.out}`, tone: 'blue', booking: u.out };
      }
      if (u.care === 'cuci') return { k: 'cuci', l: 'Perlu dicuci', tone: 'teal' };
      if (u.care === 'perbaikan') return { k: 'perbaikan', l: 'Dalam perbaikan', tone: 'red' };
      if (!condRentable(u.cond)) return { k: 'bad', l: u.cond, tone: 'red' };
      return { k: 'siap', l: 'Siap disewa', tone: 'green' };
    },
    washCats: () => (read('settings', SETTINGS).washCats ?? SETTINGS.washCats),
    needsWash: (p) => !!p && DB.washCats().includes(p.cat),
    setCare(pid, code, care, info) {
      const me = DB.session();
      const txt = care === 'cuci' ? 'Masuk antrian cuci' : `Dilaporkan rusak: ${info && info.issue ? info.issue : '-'} — masuk perbaikan`;
      return DB.updateUnit(pid, code, { care, careInfo: Object.assign({ since: nowStamp(), by: me ? me.name : '' }, info || {}) }, txt);
    },
    finishCare(pid, code, opts) {
      opts = opts || {}; const all = read('products', PRODUCTS); const p = all.find((x) => x.id === pid); const u = p && p.units.find((x) => x.code === code); if (!u) return null;
      const was = u.care; const patch = { care: null, careInfo: null };
      if (opts.cond) patch.cond = opts.cond;
      const txt = was === 'cuci' ? 'Selesai dicuci — siap disewa' : `Selesai diperbaiki${opts.note ? ': ' + opts.note : ''}`;
      const ex = opts.cost ? [{ field: 'Biaya perbaikan', from: '', to: rupiah(opts.cost) }] : [];
      DB.updateUnit(pid, code, patch, txt, ex);
      if (opts.cost) DB.saveFinance('out', { id: DB.nextId('EXP', DB.expenses()), date: today(), category: DB.financeCats('out').find((c) => /perbaikan/i.test(c)) || 'Perbaikan Barang', desc: `Perbaikan ${code} (${p.name})${opts.note ? ': ' + opts.note : ''}`, amount: opts.cost });
      return true;
    },
    careQueue() {
      const out = { cuci: [], perbaikan: [], berkala: [] };
      DB.products(true).forEach((p) => (p.units || []).forEach((u) => {
        if (u.status !== 'aktif') return;
        if (u.care === 'cuci') out.cuci.push({ p, u });
        else if (u.care === 'perbaikan') out.perbaikan.push({ p, u });
        if (DB.serviceDue(p, u)) out.berkala.push({ p, u });
      }));
      return out;
    },
    serviceDue(p, u) { const n = p.serviceEvery || DB.settings().serviceEvery || 10; return u.status === 'aktif' && u.sinceService >= n; },
    updateUnit(pid, code, patch, action, extraChanges) {
      const all = read('products', PRODUCTS); const p = all.find((x) => x.id === pid); if (!p) return null;
      const u = (p.units || []).find((x) => x.code === code); if (!u) return null;
      const ch = [['cond', 'Kondisi'], ['status', 'Status'], ['notes', 'Catatan']].filter(([k]) => k in patch && (u[k] ?? '') !== (patch[k] ?? '')).map(([k, l]) => ({ field: l, from: String(u[k] ?? ''), to: String(patch[k] ?? '') }));
      const me = DB.session();
      Object.assign(u, patch);
      if (action) u.log.push({ at: nowStamp(), text: action, by: me ? me.name : 'Sistem' });
      syncUnits(p); write('products', all);
      if (action) DB.audit({ type: 'unit', action: `${action} — unit ${code} (${p.name})`, ref: pid, changes: [...ch, ...(extraChanges || [])] });
      return u;
    },
    /* Pasang unit ke baris booking saat barang keluar. picks: { lineIndex: [{pid, code}] } */
    assignUnits(b, picks) {
      const all = read('products', PRODUCTS); const me = DB.session();
      b.items.forEach((it, i) => { it.units = picks[i] || [];
        it.units.forEach(({ pid, code }) => { const u = (all.find((p) => p.id === pid).units || []).find((x) => x.code === code); if (u) { u.out = b.id; u.log.push({ at: nowStamp(), text: `Keluar untuk ${b.id}`, by: me ? me.name : '' }); } }); });
      write('products', all);
    },
    releaseUnits(b, conds) {
      const all = read('products', PRODUCTS); const me = DB.session();
      b.items.forEach((it) => (it.units || []).forEach(({ pid, code }) => {
        const p = all.find((x) => x.id === pid); const u = p && (p.units || []).find((x) => x.code === code); if (!u) return;
        const r = (conds && conds[code]) || { res: 'siap' }; const res = typeof r === 'string' ? { res: 'siap', cond: r } : r;
        u.out = null; u.rents += 1; u.sinceService += 1; if (res.cond) u.cond = res.cond;
        const by = me ? me.name : '';
        if (res.res === 'cuci') { u.care = 'cuci'; u.careInfo = { since: nowStamp(), by, booking: b.id }; u.log.push({ at: nowStamp(), text: `Kembali dari ${b.id} — masuk antrian cuci`, by }); }
        else if (res.res === 'perbaikan') { u.care = 'perbaikan'; u.careInfo = { since: nowStamp(), by, booking: b.id, issue: res.issue || '-' }; u.log.push({ at: nowStamp(), text: `Kembali dari ${b.id} — rusak: ${res.issue || '-'} (masuk perbaikan)`, by }); }
        else if (res.res === 'hilang') { u.status = 'nonaktif'; u.offReason = 'hilang'; u.notes = `Hilang saat disewa ${b.id}`; u.log.push({ at: nowStamp(), text: `Dilaporkan hilang saat disewa ${b.id} — unit dinonaktifkan`, by }); }
        else { u.care = null; u.careInfo = null; u.log.push({ at: nowStamp(), text: `Kembali dari ${b.id} — bersih, siap disewa`, by }); }
      }));
      all.forEach(syncUnits); write('products', all);
    },
    /* Unit yang dijual → status terjual. Barang tanpa unit (khusus jual) → stok berkurang. */
    sellStock(items, sign) {
      const all = read('products', PRODUCTS); const taken = [];
      items.forEach((it) => { const p = all.find((x) => x.id === it.productId); if (!p) return;
        if (tracked(p)) {
          if (sign < 0) { (it.soldUnits || []).forEach((code) => { const u = p.units.find((x) => x.code === code); if (u) { u.status = 'aktif'; u.log.push({ at: nowStamp(), text: 'Penjualan dibatalkan, unit kembali ke stok' }); } }); it.soldUnits = []; }
          else { it.soldUnits = [];
            const cand = p.units.filter((u) => u.status === 'aktif' && !u.out && (!it.size || u.size === it.size)).sort((a, b) => a.rents - b.rents);
            for (let k = 0; k < it.qty && cand[k]; k++) { cand[k].status = 'terjual'; cand[k].log.push({ at: nowStamp(), text: 'Terjual' }); it.soldUnits.push(cand[k].code); } }
          syncUnits(p);
        } else {
          const d = sign < 0 ? it.qty : -it.qty;
          if (hasVariant(p) && it.size) { const o = p.variant.options.find((x) => x.name === it.size); if (o) o.stock = Math.max(0, o.stock + d); p.stock = p.variant.options.reduce((a, o) => a + o.stock, 0); }
          else p.stock = Math.max(0, p.stock + d);
        }
        taken.push(p);
      });
      write('products', all); return taken;
    },
    lowStock() { return withRating(read('products', PRODUCTS)).filter((p) => p.active !== false && p.price > 0 && p.minStock != null && (tracked(p) ? DB.rentableUnits(p).filter((u) => !u.out).length : p.stock) <= p.minStock); },
    saleableStock(p, size) { if (!p) return 0; if (!tracked(p)) return DB.sizeStock(p, size); return (p.units || []).filter((u) => u.status === 'aktif' && !u.out && !u.care && condRentable(u.cond) && (!size || u.size === size)).length; },

    /* ---------- Promo ---------- */
    promos: () => read('promos', []),
    savePromo(x, action, changes) { const all = read('promos', []); const i = all.findIndex((y) => y.id === x.id); if (i >= 0) all[i] = x; else all.push(x); write('promos', all); DB.audit({ type: 'promo', action, ref: x.code, changes }); },
    /* ctx: { rent, buy, start } → { ok, promo, rent, buy, msg } */
    checkPromo(code, ctx) {
      const pr = read('promos', []).find((x) => x.code.toUpperCase() === String(code || '').trim().toUpperCase());
      if (!pr || !pr.active) return { ok: false, msg: 'Kode promo tidak ditemukan.' };
      const t = today(); if (t < pr.start || t > pr.end) return { ok: false, msg: 'Promo sudah berakhir atau belum dimulai.' };
      if (pr.quota && pr.used >= pr.quota) return { ok: false, msg: 'Kuota promo sudah habis.' };
      const baseR = pr.applies === 'buy' ? 0 : ctx.rent || 0, baseB = pr.applies === 'rent' ? 0 : ctx.buy || 0;
      if (!(baseR + baseB)) return { ok: false, msg: pr.applies === 'rent' ? 'Promo ini hanya untuk sewa alat.' : pr.applies === 'buy' ? 'Promo ini hanya untuk pembelian.' : 'Keranjang masih kosong.' };
      if (pr.weekday && baseR) { const bad = (ctx.starts || []).some((d) => { const w = new Date(d + 'T00:00:00').getDay(); return w === 0 || w >= 5; }); if (bad) return { ok: false, msg: 'Promo ini hanya berlaku untuk tanggal ambil Senin–Kamis.' }; }
      if (pr.minTotal && baseR + baseB < pr.minTotal) return { ok: false, msg: `Minimal transaksi ${rupiah(pr.minTotal)}.` };
      const cut = (base) => (pr.type === 'persen' ? Math.round(base * pr.value / 100) : 0);
      let rent = cut(baseR), buy = cut(baseB);
      if (pr.type === 'nominal') { const tot = baseR + baseB; const v = Math.min(pr.value, tot); rent = Math.round(v * baseR / tot); buy = v - rent; }
      return { ok: true, promo: pr, rent, buy, msg: `Promo ${pr.name} dipakai.` };
    },
    usePromo(code) { const all = read('promos', []); const x = all.find((y) => y.code === code); if (x) { x.used = (x.used || 0) + 1; write('promos', all); } },

    /* ---------- Pelanggan ---------- */
    customerMeta: (email) => (read('customerMeta', {})[String(email || '').toLowerCase()] || { flag: 'normal', note: '' }),
    saveCustomerMeta(email, meta, name) {
      const all = read('customerMeta', {}); const k = String(email).toLowerCase(); const old = all[k] || { flag: 'normal', note: '' };
      all[k] = Object.assign({}, old, meta); write('customerMeta', all);
      const FL = { normal: 'Normal', jaminan: 'Perlu jaminan tambahan', blacklist: 'Diblokir' };
      DB.audit({ type: 'pelanggan', action: `Mengubah catatan pelanggan ${name || email}`, ref: email, changes: [['flag', 'Status'], ['note', 'Catatan']].filter(([f]) => (old[f] || '') !== (all[k][f] || '')).map(([f, l]) => ({ field: l, from: f === 'flag' ? FL[old.flag || 'normal'] : old[f] || '', to: f === 'flag' ? FL[all[k].flag] : all[k][f] })) });
    },
    customers() {
      const map = {};
      const key = (c) => String(c.email || c.phone || c.name).toLowerCase();
      const get = (c) => { const k = key(c); return map[k] || (map[k] = { key: k, name: c.name, email: c.email || '', phone: c.phone || '', rentals: [], sales: [], total: 0, late: 0, cancel: 0, last: '' }); };
      read('users', USERS).filter((u) => u.role === 'customer').forEach((u) => { const x = get(u); x.registered = true; });
      read('bookings', []).forEach((b) => { const x = get(b.customer); x.rentals.push(b); if (b.status !== 'dibatalkan') x.total += Rules.paidTotal(b); else x.cancel++; if ((b.ret && b.ret.lateDays) || (b.status === 'disewa' && b.end < today())) x.late++; if (String(b.createdAt) > x.last) x.last = b.createdAt; });
      read('sales', []).forEach((s) => { const x = get(s.customer); x.sales.push(s); if (s.status !== 'dibatalkan') x.total += Rules.paidTotal(s); else x.cancel++; if (String(s.createdAt) > x.last) x.last = s.createdAt; });
      /* Riwayat pelanggan dari data yang sudah dibersihkan (setelah rekap bulanan) tetap dihitung */
      Object.values(read('customerArchive', {})).forEach((a) => { const x = get(a); x.arcRent = a.rent || 0; x.arcSale = a.sale || 0; x.total += a.total || 0; x.late += a.late || 0; x.cancel += a.cancel || 0; if (String(a.last) > x.last) x.last = a.last; });
      return Object.values(map).map((x) => Object.assign(x, { meta: DB.customerMeta(x.email), count: x.rentals.length + x.sales.length + (x.arcRent || 0) + (x.arcSale || 0) }));
    },

    /* Terapkan pergantian barang pada booking (dipakai saat admin menyetujui / mencatat ganti di toko). */
    applyBookingChange(b, ch) {
      const it = b.items[ch.lineIndex]; const p = DB.product(ch.toId);
      if (!p || !it) return { ok: false, msg: 'Data barang tidak ditemukan.' };
      const qty = Math.min(ch.qty || it.qty, it.qty);
      const size = ch.toSize && hasVariant(p) ? ch.toSize : null;
      const avail = Rules.available(p.id, b.start, b.end, b.id, size);
      const same = it.refId === p.id && (it.size || null) === size;
      if (!same && avail < qty) return { ok: false, msg: `${variantName(p, size)} hanya tersedia ${avail} unit pada tanggal sewa ini.` };
      const newLine = Object.assign({ kind: 'product', refId: p.id, name: variantName(p, size), img: p.img, qty, pricePerDay: p.rent, tiers: productTiers(p), components: [size ? { productId: p.id, qty: 1, size } : { productId: p.id, qty: 1 }] }, size ? { size } : {});
      if (qty >= it.qty) b.items[ch.lineIndex] = newLine; else { it.qty -= qty; b.items.push(newLine); }
      const oldTotal = b.total;
      Rules.recalc(b);
      return { ok: true, oldTotal, newTotal: b.total, line: newLine };
    },
    saveBooking(b) { ensureNos(); const all = read('bookings', []); const i = all.findIndex((x) => x.id === b.id); if (i >= 0) all[i] = b; else all.unshift(b); write('bookings', all); },
    sales: () => (ensureNos(), read('sales', [])),
    sale: (id) => (ensureNos(), read('sales', []).find((s) => s.id === id || s.no === id)),
    saveSale(s) { ensureNos(); const all = read('sales', []); const i = all.findIndex((x) => x.id === s.id); if (i >= 0) all[i] = s; else all.unshift(s); write('sales', all); },
    saveProduct(p) {
      const all = read('products', PRODUCTS); const i = all.findIndex((x) => x.id === p.id);
      const old = i >= 0 ? all[i] : null;
      const base = old ? { rating: old.rating, reviews: old.reviews } : { rating: 0, reviews: 0 };
      const clean = Object.assign({ active: true }, p, base);
      if (hasVariant(clean)) clean.stock = clean.variant.options.reduce((a, o) => a + (+o.stock || 0), 0);
      if (old && old.units && !clean.units) clean.units = old.units;
      syncUnits(clean);
      if (i >= 0) all[i] = clean; else all.push(clean); write('products', all);
      if (!old) {
        DB.audit({ type: 'tambah', action: `Menambahkan barang ${clean.name}`, ref: clean.id, changes: [{ field: 'Harga sewa / malam', from: '', to: money(clean.rent) }, { field: 'Perkegiatan (3 hari)', from: '', to: money(clean.rent3) }, { field: 'Ekspedisi (5 hari)', from: '', to: money(clean.rent5) }, { field: 'Harga jual', from: '', to: money(clean.price) }, { field: 'Stok', from: '', to: unit(clean.stock) }] });
        return;
      }
      const groups = [
        ['harga', `Mengubah harga ${clean.name}`, [['rent', 'Harga sewa / malam', money], ['rent3', 'Perkegiatan (3 hari)', money], ['rent5', 'Ekspedisi (5 hari)', money], ['price', 'Harga jual', money]]],
        ['stok', `Mengubah stok ${clean.name}`, [['stock', 'Stok', unit]]],
        ['kondisi', `Mengubah kondisi ${clean.name}`, [['cond', 'Kondisi']]],
        ['status', `${clean.active === false ? 'Menonaktifkan' : 'Mengaktifkan'} barang ${clean.name}`, [['active', 'Status', actv]]],
        ['varian', `Mengubah ukuran / varian ${clean.name}`, [['variant', 'Ukuran & stok', (v) => (v && v.options && v.options.length ? `${v.label}: ` + v.options.map((o) => `${o.name} (${o.stock})`).join(', ') : 'Tanpa ukuran')]]],
        ['edit', `Mengedit data barang ${clean.name}`, [['name', 'Nama'], ['cat', 'Kategori'], ['brand', 'Merek'], ['sku', 'Kode barang'], ['color', 'Warna'], ['material', 'Bahan'], ['weight', 'Berat'], ['dimension', 'Ukuran / kapasitas'], ['includes', 'Kelengkapan'], ['minDays', 'Minimal sewa (malam)'], ['deposit', 'Jaminan / deposit', money], ['attrs', 'Atribut', (v) => Object.entries(v || {}).filter(([, x]) => x !== '' && x != null).map(([k, x]) => `${((read('settings', SETTINGS).attributes || []).find((t) => t.id === k) || { name: k }).name}: ${x}`).join('; ') || '—'], ['badge', 'Label'], ['featured', 'Unggulan beranda', yes], ['desc', 'Deskripsi', (v) => (v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—')], ['specs', 'Spesifikasi', (v) => (v || []).join('; ')]]],
      ];
      groups.forEach(([type, action, fields]) => {
        const ch = diff(old, clean, fields);
        if (type === 'edit' && old.img !== clean.img) ch.push({ field: 'Foto', from: 'foto lama', to: 'foto baru diunggah' });
        if (ch.length) DB.audit({ type, action, ref: clean.id, changes: ch });
      });
    },
    expenses: () => read('expenses', []),
    incomes: () => read('incomes', []),
    saveFinance(kind, obj) {
      const key = kind === 'in' ? 'incomes' : 'expenses'; const all = read(key, []); const i = all.findIndex((x) => x.id === obj.id);
      const label = kind === 'in' ? 'pemasukan lainnya' : 'pengeluaran';
      if (i < 0) { all.unshift(Object.assign({ status: 'aktif' }, obj)); write(key, all); DB.audit({ type: 'keuangan', action: `Mencatat ${label} ${obj.category}: ${obj.desc}`, ref: obj.id, changes: [{ field: 'Jumlah', from: '', to: rupiah(obj.amount) }] }); return; }
      const ch = diff(all[i], obj, [['date', 'Tanggal'], ['category', 'Kategori'], ['desc', 'Keterangan'], ['amount', 'Jumlah', rupiah]]);
      all[i] = Object.assign({}, all[i], obj); write(key, all);
      if (ch.length) DB.audit({ type: 'keuangan', action: `Mengedit ${label} ${obj.id}`, ref: obj.id, changes: ch });
    },
    voidFinance(kind, id, reason) {
      const key = kind === 'in' ? 'incomes' : 'expenses'; const all = read(key, []); const x = all.find((e) => e.id === id); if (!x) return;
      const s = DB.session();
      Object.assign(x, { status: 'dibatalkan', voidReason: reason, voidAt: nowStamp(), voidBy: s ? s.name : '-' }); write(key, all);
      DB.audit({ type: 'keuangan', action: `Membatalkan ${kind === 'in' ? 'pemasukan' : 'pengeluaran'} ${x.id} (${x.desc})`, ref: x.id, changes: [{ field: 'Status', from: 'Aktif', to: 'Dibatalkan' }, { field: 'Alasan', from: '', to: reason }] });
    },
    reviews: () => read('reviews', []),
    review: (id) => read('reviews', []).find((r) => r.id === id),
    reviewFor: (refId) => read('reviews', []).find((r) => r.refId === refId),
    saveReview(r) { const all = read('reviews', []); const i = all.findIndex((x) => x.id === r.id); if (i >= 0) all[i] = r; else all.unshift(r); write('reviews', all); },
    productReviews: (pid) => read('reviews', []).filter((r) => r.visible && r.productIds.includes(pid)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    testimonials: () => read('reviews', []).filter((r) => r.visible && r.featured).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || b.createdAt.localeCompare(a.createdAt)),
    ratingSummary() {
      const v = read('reviews', []).filter((r) => r.visible);
      const base = read('products', PRODUCTS).reduce((a, p) => ({ sum: a.sum + (p.rating || 0) * (p.reviews || 0), n: a.n + (p.reviews || 0) }), { sum: 0, n: 0 });
      const n = base.n + v.length; const avg = n ? (base.sum + v.reduce((a, r) => a + r.rating, 0)) / n : 0;
      return { avg: Math.round(avg * 10) / 10, count: n };
    },

    /* ---------- Pengguna, staff & sesi ---------- */
    ROLE_LABEL,
    isStaff,
    panelHome: (u) => (u && u.role === 'owner' ? 'owner/dashboard' : 'admin/dashboard'),
    users: () => read('users', USERS),
    user: (id) => read('users', USERS).find((u) => u.id === id || String(u.id) === String(id) || u.id === ('u' + id) || (typeof id === 'string' && String(u.id).replace(/^u/, '') === String(id).replace(/^u/, '')) || (u.email && String(u.email).toLowerCase() === String(id).toLowerCase())),
    staff: () => read('users', USERS).filter(isStaff),
    patchUser(id, patch) { const all = read('users', USERS); const u = all.find((x) => x.id === id); if (!u) return null; Object.assign(u, patch); write('users', all); return u; },
    session: () => read('session', null),
    login(email, password) {
      const users = read('users', USERS);
      const u = users.find((x) => x.email.toLowerCase() === String(email).toLowerCase().trim());
      if (!u) return { ok: false, field: 'email', msg: 'Email belum terdaftar. Periksa lagi atau daftar akun baru.' };
      if (u.password !== password) {
        if (isStaff(u)) DB.audit({ actor: u, type: 'login_gagal', action: 'Percobaan login gagal: kata sandi salah' });
        return { ok: false, field: 'password', msg: 'Kata sandi salah. Coba lagi.' };
      }
      if (u.status === 'nonaktif') {
        if (isStaff(u)) DB.audit({ actor: u, type: 'login_gagal', action: 'Login ditolak: akun nonaktif' });
        return { ok: false, field: 'email', msg: 'Akun ini sedang dinonaktifkan. Hubungi Owner Annapurna Adventure.' };
      }
      const s = { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address, mustChangePw: !!u.mustChangePw, needsPassword: !!u.needsPassword, loginAt: nowStamp(), seen: {} };
      write('session', s);
      if (isStaff(u)) { u.lastLogin = s.loginAt; u.lastSeen = s.loginAt; write('users', users); DB.audit({ type: 'login', action: `Login ke panel ${u.role === 'owner' ? 'owner' : 'admin'}` }); }
      return { ok: true, user: s };
    },
    /* ---------- Tanggal trip (dipilih sekali, dipakai di seluruh website) ---------- */
    trip() { const t = read('trip', null); if (!t || !t.start || t.end <= t.start || t.start < today()) return null; return t; },
    setTrip(start, end) { if (!start || !end || end <= start) { localStorage.removeItem(KEY('trip')); return; } write('trip', { start, end }); document.dispatchEvent(new CustomEvent('trip:change')); },
    normPhone: (p) => String(p || '').replace(/\D/g, '').replace(/^62/, '0'),
    /* Status blokir dicek dari email ATAU nomor HP, supaya tidak bisa diakali dengan ganti nama. */
    blockedContact(email, phone) {
      const meta = read('customerMeta', {}); const ph = DB.normPhone(phone);
      if ((meta[String(email || '').toLowerCase()] || {}).flag === 'blacklist') return true;
      const emails = Object.keys(meta).filter((k) => meta[k].flag === 'blacklist');
      if (!ph || !emails.length) return false;
      const phonesOf = (em) => [...DB.bookings().filter((b) => b.customer.email.toLowerCase() === em).map((b) => b.customer.phone), ...DB.sales().filter((x) => x.customer.email.toLowerCase() === em).map((x) => x.customer.phone), ...read('users', USERS).filter((u) => u.email.toLowerCase() === em).map((u) => u.phone)];
      return emails.some((em) => phonesOf(em).some((x) => DB.normPhone(x) === ph));
    },
    /* Checkout tanpa daftar: cari akun berdasarkan email / nomor HP, buat otomatis bila belum ada. */
    quickAccount({ name, phone, email }) {
      const users = read('users', USERS); const em = email.trim().toLowerCase(); const ph = DB.normPhone(phone);
      if (DB.blockedContact(em, ph)) return { status: 'blocked' };
      const byEmail = users.find((u) => u.email.toLowerCase() === em);
      const byPhone = !byEmail && ph ? users.find((u) => DB.normPhone(u.phone) === ph) : null;
      const ex = byEmail || byPhone;
      if (ex) { if (isStaff(ex)) return { status: 'staff' }; return { status: 'exists', user: ex, by: byEmail ? 'email' : 'phone' }; }
      const pw = Math.random().toString(36).slice(2, 10) + 'A1';
      const u = { id: 'u' + Date.now(), role: 'customer', status: 'aktif', name: name.trim(), phone: phone.trim(), email: em, address: '', password: pw, autoCreated: true, needsPassword: true, createdAt: nowStamp() };
      users.push(u); write('users', users);
      const r = DB.login(u.email, pw);
      return { status: 'created', user: r.user };
    },
    /* Masuk dengan kode verifikasi (OTP). Di frontend kode ditampilkan langsung; di backend dikirim via WhatsApp/email. */
    sendLoginCode(identifier) {
      const users = read('users', USERS); const id = String(identifier || '').trim().toLowerCase(); const ph = DB.normPhone(id);
      const u = users.find((x) => x.email.toLowerCase() === id || (ph.length >= 9 && DB.normPhone(x.phone) === ph));
      if (!u) return { ok: false, msg: 'Email atau nomor WhatsApp belum terdaftar.' };
      if (isStaff(u)) return { ok: false, msg: 'Akun staff: minta Owner mengatur ulang kata sandi lewat Manajemen Staff.' };
      if (u.status === 'nonaktif') return { ok: false, msg: 'Akun ini sedang dinonaktifkan.' };
      const code = String(Math.floor(100000 + Math.random() * 900000));
      write('loginCode', { uid: u.id, code, exp: Date.now() + 5 * 60000 });
      const dest = /@/.test(id) ? u.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2') : 'WhatsApp ••••' + String(u.phone).slice(-4);
      return { ok: true, code, dest, name: u.name };
    },
    verifyLoginCode(code) {
      const c = read('loginCode', null); if (!c || Date.now() > c.exp) return { ok: false, msg: 'Kode sudah kedaluwarsa. Kirim ulang kode.' };
      if (String(code).trim() !== c.code) return { ok: false, msg: 'Kode tidak cocok.' };
      const u = read('users', USERS).find((x) => x.id === c.uid); localStorage.removeItem(KEY('loginCode'));
      const sess = { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address, needsPassword: !!u.needsPassword, loginAt: nowStamp(), seen: {} };
      write('session', sess); return { ok: true, user: sess };
    },
    setOwnPassword(pw) {
      const s = DB.session(); const users = read('users', USERS); const u = users.find((x) => x.id === s.id); if (!u) return false;
      Object.assign(u, { password: pw, needsPassword: false }); write('users', users); write('session', Object.assign(s, { needsPassword: false })); return true;
    },
    /* Cek pesanan tanpa login: nomor pesanan + nomor HP */
    lookupOrder(id, phone) {
      /* Terima nomor nota (028/X/2026, 28/x/2026) maupun kode lama (RNT-1028) */
      let code = String(id || '').toUpperCase().replace(/\s/g, ''); const ph = DB.normPhone(phone);
      const mm = code.match(/^(\d{1,4})\/([IVX]{1,4})\/(\d{4})$/); if (mm) code = `${String(+mm[1]).padStart(3, '0')}/${mm[2]}/${mm[3]}`;
      const x = DB.booking(code) || DB.sale(code);
      if (!x || DB.normPhone(x.customer.phone) !== ph) return null;
      return x;
    },
    register(data) {
      const users = read('users', USERS);
      if (users.some((x) => x.email.toLowerCase() === data.email.toLowerCase())) return { ok: false, field: 'email', msg: 'Email sudah terdaftar. Silakan masuk.' };
      const u = { id: 'u' + Date.now(), role: 'customer', status: 'aktif', address: '', ...data };
      users.push(u); write('users', users);
      return DB.login(u.email, u.password);
    },
    updateProfile(data) {
      const s = DB.session(); if (!s) return;
      const users = read('users', USERS); const u = users.find((x) => x.id === s.id);
      const ch = diff(u, Object.assign({}, u, data), [['name', 'Nama'], ['phone', 'Nomor HP'], ['address', 'Alamat']]);
      Object.assign(u, data); write('users', users);
      write('session', Object.assign(s, { name: u.name, phone: u.phone, address: u.address }));
      if (ch.length) DB.audit({ type: 'edit', action: 'Memperbarui profil akun sendiri', ref: u.id, changes: ch });
    },
    changePassword(oldPw, newPw) {
      const s = DB.session(); const users = read('users', USERS); const u = users.find((x) => x.id === s.id);
      if (u.password !== oldPw) return false;
      u.password = newPw; const first = !!u.mustChangePw; u.mustChangePw = false; write('users', users);
      write('session', Object.assign(s, { mustChangePw: false }));
      DB.audit({ type: 'edit', action: first ? 'Mengganti kata sandi sementara (login pertama)' : 'Mengganti kata sandi akun', ref: u.id });
      return true;
    },
    touch() {
      const s = DB.session(); if (!isStaff(s)) return;
      DB.patchUser(s.id, { lastSeen: nowStamp() });
    },
    /* Pakai data user dari server (Laravel). Dicocokkan lewat email karena ID database (1, 2, 3, …)
       tidak sama dengan ID data demo (u1, u2, …). Tanpa ini, login sebagai admin bisa terbaca sebagai customer
       sehingga dashboard tidak mau terbuka. */
    adoptSession(su) {
      if (!su || !su.email) return null;
      const email = String(su.email).toLowerCase().trim();
      const users = read('users', USERS);
      let u = users.find((x) => String(x.email).toLowerCase() === email);
      if (!u) { u = { id: 'srv' + (su.userId || Date.now()), name: su.name, email, password: '', role: su.role, status: su.status || 'aktif', phone: su.phone || '', address: su.address || '', createdAt: nowStamp() }; users.push(u); }
      else Object.assign(u, { name: su.name || u.name, role: su.role || u.role, status: su.status || u.status, phone: su.phone || u.phone, address: su.address || u.address });
      write('users', users);
      const prev = DB.session(); const same = prev && String(prev.email).toLowerCase() === email;
      const s = { id: u.id, userId: su.userId, name: u.name, email: u.email, role: u.role, status: u.status, phone: u.phone, address: u.address, mustChangePw: !!su.mustChangePw,
        loginAt: (same && prev.loginAt) || su.loginAt || nowStamp(), seen: (same && prev.seen) || {} };
      write('session', s);
      return s;
    },
    clearSession() { localStorage.removeItem(KEY('session')); },
    /* opts.auto: logout otomatis karena tidak aktif; jam logout = jam aktivitas terakhir */
    logout(opts = {}) {
      const s = DB.session();
      if (isStaff(s)) {
        const at = opts.at || nowStamp();
        DB.audit(opts.auto ? { type: 'logout', at, meta: { auto: true, idleMin: opts.idleMin }, action: `Logout otomatis setelah tidak aktif ${opts.idleMin} menit` } : { type: 'logout', action: `Logout dari panel ${s.role === 'owner' ? 'owner' : 'admin'}` });
        DB.patchUser(s.id, { lastLogout: at, lastSeen: at });
      }
      localStorage.removeItem(KEY('session'));
    },
    tempPassword() { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let p = ''; for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)]; return 'Ann-' + p; },
    addStaff(data) {
      const users = read('users', USERS);
      const email = data.email.trim().toLowerCase();
      const dup = users.find((x) => x.email.toLowerCase() === email);
      if (dup) return { ok: false, field: 'email', msg: isStaff(dup) ? 'Email ini sudah terdaftar sebagai staff.' : 'Email ini sudah dipakai akun customer. Gunakan email lain.' };
      const me = DB.session(); const temp = DB.tempPassword();
      const u = { id: 'u' + Date.now(), name: data.name.trim(), email, phone: data.phone || '', address: '', role: data.role, status: data.status, password: temp, mustChangePw: true, createdAt: nowStamp(), createdBy: me ? me.id : '' };
      users.push(u); write('users', users);
      DB.audit({ type: 'staff', action: `Menambahkan staff ${u.name} (${ROLE_LABEL[u.role]})`, ref: u.id, changes: [{ field: 'Email', from: '', to: u.email }, { field: 'Role', from: '', to: ROLE_LABEL[u.role] }, { field: 'Status', from: '', to: u.status === 'aktif' ? 'Aktif' : 'Nonaktif' }] });
      let mail = null;
      if (data.sendEmail) mail = DB.sendMail({ kind: 'staff_invite', to: u.email, subject: 'Anda telah ditambahkan sebagai Staff Annapurna Adventure Shop', data: { name: u.name, email: u.email, role: u.role, tempPassword: temp, by: me ? me.name : 'Owner' } });
      return { ok: true, user: u, temp, mail };
    },
    updateStaff(id, patch) {
      const users = read('users', USERS); const u = users.find((x) => x.id === id); if (!u) return { ok: false };
      if (patch.email && patch.email.toLowerCase() !== u.email.toLowerCase() && users.some((x) => x.id !== id && x.email.toLowerCase() === patch.email.toLowerCase())) return { ok: false, field: 'email', msg: 'Email sudah dipakai akun lain.' };
      const next = Object.assign({}, u, patch);
      const ch = diff(u, next, [['name', 'Nama'], ['email', 'Email'], ['phone', 'Nomor HP'], ['role', 'Role', (v) => ROLE_LABEL[v] || v], ['status', 'Status', (v) => (v === 'aktif' ? 'Aktif' : 'Nonaktif')]]);
      Object.assign(u, patch); write('users', users);
      if (ch.length) {
        const onlyStatus = ch.length === 1 && ch[0].field === 'Status';
        DB.audit({ type: onlyStatus ? 'status' : 'staff', action: onlyStatus ? `${u.status === 'aktif' ? 'Mengaktifkan' : 'Menonaktifkan'} staff ${u.name}` : `Mengubah data staff ${u.name}`, ref: u.id, changes: ch });
      }
      return { ok: true, user: u, changes: ch };
    },
    resetStaffPassword(id) {
      const users = read('users', USERS); const u = users.find((x) => x.id === id); if (!u) return null;
      const temp = DB.tempPassword(); u.password = temp; u.mustChangePw = true; write('users', users);
      const me = DB.session();
      DB.audit({ type: 'staff', action: `Mengatur ulang kata sandi staff ${u.name}`, ref: u.id });
      const mail = DB.sendMail({ kind: 'password_reset', to: u.email, subject: 'Kata sandi sementara akun Staff Annapurna Adventure', data: { name: u.name, email: u.email, role: u.role, tempPassword: temp, by: me ? me.name : 'Owner' } });
      return { temp, mail };
    },

    /* ---------- Histori (append-only) ---------- */
    audits: () => read('audit', []),
    audit(e) {
      const actor = actorOf(e.actor) || (e.system ? { userId: 'system', userName: 'Sistem', role: 'system' } : null) || (isStaff(DB.session()) ? actorOf(DB.session()) : null);
      if (!actor) return null;
      const list = read('audit', []);
      const prev = list.length ? list[list.length - 1].hash : 'GENESIS';
      const entry = Object.assign({ id: auditId(list.length + 1), at: e.at || nowStamp() }, actor, e.meta || {}, { type: e.type, action: e.action }, e.ref ? { ref: e.ref } : {}, e.changes && e.changes.length ? { changes: e.changes } : {}, { prev });
      entry.hash = auditHash(entry, prev);
      list.push(entry); write('audit', list);
      return entry;
    },
    verifyAudit() {
      const list = read('audit', []); let prev = 'GENESIS';
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.prev !== prev || auditHash(e, prev) !== e.hash) return { ok: false, count: list.length, brokenAt: e.id, index: i };
        prev = e.hash;
      }
      return { ok: true, count: list.length };
    },

    /* ---------- Email keluar & arsip Google Drive (simulasi frontend) ---------- */
    outbox: () => read('outbox', []).slice().sort((a, b) => b.at.localeCompare(a.at)),
    sendMail(m) {
      const all = read('outbox', []);
      const mail = Object.assign({ id: 'MAIL-' + (all.length + 1), at: nowStamp(), status: 'terkirim' }, m);
      all.push(mail); write('outbox', all); return mail;
    },
    archives: () => read('archives', []).slice().sort((a, b) => b.period.localeCompare(a.period)),
    archive: (period) => read('archives', []).find((a) => a.period === period),
    saveArchive(a) { const all = read('archives', []); const i = all.findIndex((x) => x.period === a.period); if (i >= 0) all[i] = a; else all.push(a); write('archives', all); },

    notifications(email) { return read('notifications', []).filter((n) => n.email === email).sort((a, b) => b.at.localeCompare(a.at)); },
    /* Notifikasi yang sama (judul + tautan) yang belum dibaca digabung jadi satu, bukan ditumpuk.
       Notifikasi lama dibersihkan otomatis: yang sudah dibaca > 30 hari dan maksimal 150 per akun. */
    notify(email, title, text, link) {
      let all = read('notifications', []);
      const dup = all.find((n) => n.email === email && !n.read && n.title === title && (n.link || '') === (link || ''));
      if (dup) Object.assign(dup, { text, at: nowStamp(), count: (dup.count || 1) + 1 });
      else all.push({ id: 'n' + Date.now() + Math.random().toString(16).slice(2, 6), email, at: nowStamp(), title, text, read: false, link: link || '' });
      const cut = new Date(Date.now() - 30 * 864e5).toISOString();
      all = all.filter((n) => !(n.read && n.at < cut));
      const mine = all.filter((n) => n.email === email).sort((a, b) => b.at.localeCompare(a.at));
      if (mine.length > 150) { const drop = new Set(mine.slice(150).map((n) => n.id)); all = all.filter((n) => !drop.has(n.id)); }
      write('notifications', all);
    },
    clearRead(email) { write('notifications', read('notifications', []).filter((n) => !(n.email === email && n.read))); },
    notifyStaff(title, text, link) { DB.staff().filter((u) => u.status !== 'nonaktif').forEach((u) => DB.notify(u.email, title, text, link)); },
    markRead(email, id) { const all = read('notifications', []); all.forEach((n) => { if (n.email === email && (!id || n.id === id)) n.read = true; }); write('notifications', all); },

    cart: () => read('cart', []),
    setCart: (c) => { write('cart', c); document.dispatchEvent(new CustomEvent('cart:change')); },

    nextId(prefix, list) {
      const nums = list.map((x) => parseInt(String(x.id).split('-')[1], 10)).filter(Boolean);
      return `${prefix}-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
    },
  };

  const ACTIVE = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'];
  const Rules = {
    rentalDays: (start, end) => Math.max(1, diffDays(start, end)),
    /* ---------- Tarif sewa: per malam / perkegiatan (3 hari) / ekspedisi (5 hari) ---------- */
    TIERS: TIER_BLOCKS.slice().reverse().map(([days, key, name]) => ({ days, key, name })),
    productTiers,
    packageTiers: (pk) => packageTiers(typeof pk === 'string' ? DB.pkg(pk) : pk, (id) => DB.product(id)),
    tierPlan,
    tierLabel,
    /* Harga 1 unit untuk lama sewa tertentu. src: produk, paket, atau baris booking. */
    unitPrice(src, days) {
      if (!src) return 0;
      const t = src.kind ? lineTiers(src) : src.items ? Rules.packageTiers(src) : productTiers(src);
      return tierPlan(t, days).total;
    },
    lineUnit,
    itemsSubtotal,
    /* Ringkasan tarif untuk ditampilkan: [{ days, name, price }] */
    tierRows(t) { return Rules.TIERS.map((x) => ({ days: x.days, name: x.name, price: tierPlan(t, x.days).total, own: !!t[x.key] })); },
    /* Tanggal terdekat (setelah `from`) saat barang tersedia lagi untuk lama sewa yang sama */
    nextAvailable(productId, qty, start, end, size) {
      const days = Math.max(1, diffDays(start, end));
      for (let i = 1; i <= 60; i++) { const s = addDays(start, i); if (Rules.available(productId, s, addDays(s, days), null, size || null) >= (qty || 1)) return s; }
      return null;
    },
    /* Pesan ketersediaan yang ramah */
    availMsg(p, qty, start, end, size, avail) {
      const h = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); const nm = DB.variantName(p, size); const rng = fmtRange(start, end);
      if (avail >= qty) return '';
      const cap = size && DB.hasVariant(p) ? DB.sizeStock(p, size) : (p.units ? DB.rentableUnits(p).length : p.stock);
      if (qty > cap) return `Stok ${h(nm)} kami maksimal <b>${cap} unit</b>. Kurangi jumlahnya${size ? ' atau pilih ukuran lain' : ''}.`;
      const nx = Rules.nextAvailable(p.id, qty, start, end, size);
      const nxt = nx ? ` Tersedia lagi mulai <b>${fmtDate(nx, true)}</b> untuk ${Math.max(1, diffDays(start, end))} hari.` : ' Coba hubungi admin via WhatsApp.';
      return avail > 0 ? `${h(nm)} hanya tersisa <b>${avail} unit</b> untuk ${rng}. Kurangi jumlah, pilih ukuran lain, atau geser tanggal.${nxt}` : `${h(nm)} sudah habis untuk ${rng}.${nxt}`;
    },
    /* size: bila diisi, hanya menghitung unit dengan ukuran tersebut. */
    bookedOn(productId, date, excludeId, size) {
      const T = today();
      return DB.bookings().filter((b) => ACTIVE.includes(b.status) && b.id !== excludeId && ((b.start <= date && date <= b.end) || (b.status === 'disewa' && b.end < T && date >= T)))
        .reduce((s, b) => s + b.items.reduce((t, it) => t + it.components.filter((c) => c.productId === productId && (size == null || c.size === size)).reduce((u, c) => u + c.qty * it.qty, 0), 0), 0);
    },
    availableOn(productId, date, excludeId, size) {
      const p = DB.product(productId); if (!p || !DB.isActiveProduct(p)) return 0;
      if (tracked(p) && p.units) {
        const total = Math.max(0, DB.rentableUnits(p).length - Rules.bookedOn(productId, date, excludeId));
        if (size == null || !DB.hasVariant(p)) return total;
        return Math.min(total, Math.max(0, DB.rentableUnits(p, size).length - Rules.bookedOn(productId, date, excludeId, size)));
      }
      if (!condRentable(p.cond)) return 0;
      const total = Math.max(0, p.stock - Rules.bookedOn(productId, date, excludeId));
      if (size == null || !DB.hasVariant(p)) return total;
      return Math.min(total, Math.max(0, DB.sizeStock(p, size) - Rules.bookedOn(productId, date, excludeId, size)));
    },
    available(productId, start, end, excludeId, size) {
      let min = Infinity;
      for (let d = start; d <= end; d = addDays(d, 1)) min = Math.min(min, Rules.availableOn(productId, d, excludeId, size));
      return min === Infinity ? 0 : min;
    },
    /* Stok per ukuran untuk rentang tanggal → [{ name, stock, avail }] */
    sizeAvailability(productId, start, end, excludeId) {
      const p = DB.product(productId); if (!DB.hasVariant(p)) return [];
      return p.variant.options.map((o) => ({ name: o.name, stock: o.stock, avail: start ? Rules.available(productId, start, end, excludeId, o.name) : o.stock }));
    },
    packageAvailable(pkgId, start, end, swaps, sizes) {
      const pk = DB.pkg(pkgId); if (!pk) return 0;
      const items = swaps ? Rules.customPackage(pk, swaps).items : pk.items;
      return Math.min(...items.map((i, k) => Math.floor(Rules.available(i.productId, start, end, null, (sizes && sizes[k]) || null) / i.qty)));
    },
    /* Isi paket yang punya ukuran (sepatu, jaket, …): [{ k, productId, qty, product }] */
    packageSized(pk, swaps) {
      if (!pk) return [];
      const items = swaps && Object.keys(swaps).length ? Rules.customPackage(pk, swaps).items : pk.items;
      return items.map((i, k) => ({ k, productId: i.productId, qty: i.qty, product: DB.product(i.productId) })).filter((x) => x.product && DB.hasVariant(x.product));
    },
    /* ---------- Paket tektok: tukar item (harga sama) / upgrade item (tambah selisih) ----------
       Syarat Annapurna: item paket tektok bisa ditukar dengan item lain yang harganya sama, atau di-upgrade
       dengan menambah selisih harga. Harga paket khusus 1 malam; kegiatan / ekspedisi pakai harga satuan. */
    swapOptions(pk, idx) {
      const base = pk && pk.items[idx] && DB.product(pk.items[idx].productId); if (!base) return [];
      return DB.products().filter((x) => x.id !== base.id && x.cat === base.cat && x.rent > 0 && x.rent >= base.rent && x.active !== false)
        .sort((a, b) => a.rent - b.rent || a.name.localeCompare(b.name));
    },
    customPackage(pk, swaps) {
      swaps = swaps || {};
      const items = pk.items.map((i, k) => ({ productId: swaps[k] || i.productId, qty: i.qty }));
      const changed = pk.items.map((i, k) => ({ k, from: DB.product(i.productId), to: DB.product(swaps[k] || i.productId), qty: i.qty })).filter((x) => x.from && x.to && x.from.id !== x.to.id);
      const upgrade = changed.reduce((a, x) => a + Math.max(0, x.to.rent - x.from.rent) * x.qty, 0);
      const satuan = (d) => items.reduce((a, i) => a + Rules.unitPrice(DB.product(i.productId), d) * i.qty, 0);
      const tiers = { d1: pk.price + upgrade, d3: pk.tektok ? satuan(3) : (pk.price3 || satuan(3)), d5: pk.tektok ? satuan(5) : (pk.price5 || satuan(5)) };
      const note = changed.map((x) => `${x.from.name} → ${x.to.name}`).join(', ');
      return { items, tiers, upgrade, changed, name: changed.length ? `${pk.name} (tukar: ${note})` : pk.name };
    },
    rentedNow(productId) {
      return DB.bookings().filter((b) => b.status === 'disewa')
        .reduce((s, b) => s + b.items.reduce((t, it) => t + it.components.filter((c) => c.productId === productId).reduce((u, c) => u + c.qty * it.qty, 0), 0), 0);
    },
    canRefund(b) { return diffDays(today(), b.start) >= DB.settings().cancelDays; },
    paidTotal: (x) => (x.payments || []).reduce((s, p) => s + p.amount, 0),
    /* time: jam kembali (HH:MM). Bila aturan aktif, kembali lewat jam batas di hari terakhir dihitung terlambat 1 hari. */
    lateDays(b, returnDate, time) {
      const d = returnDate || today(); let n = Math.max(0, diffDays(b.end, d));
      const st = DB.settings();
      if (!n && st.lateAfterReturnTime && time && d === b.end && time > (st.returnTime || '23:59')) n = 1;
      return n;
    },
    lateFee(b, lateDays) {
      const st = DB.settings();
      if (st.lateFeeMode === 'nominal') return Math.round((st.lateFeeAmount || 0) * b.items.reduce((s, it) => s + it.qty, 0) * lateDays);
      return Math.round(b.items.reduce((s, it) => s + lineTiers(it).d1 * it.qty, 0) * lateDays * (st.lateFeePercent / 100));
    },
    /* Hitung ulang subtotal, diskon promo, total, DP. */
    recalc(b) {
      b.days = Math.max(1, diffDays(b.start, b.end));
      b.subtotal = itemsSubtotal(b.items, b.days);
      if (b.discount) b.discount.amount = b.discount.type === 'persen' ? Math.round(b.subtotal * b.discount.value / 100) : Math.min(b.discount.fixed || b.discount.amount, b.subtotal);
      b.total = b.subtotal - (b.discount ? b.discount.amount : 0) + (b.fine || 0);
      if (!Rules.paidTotal(b)) b.dp = Math.round((b.total - (b.fine || 0)) * DB.settings().dpPercent / 100);
      return b;
    },
    /* Cek perpanjangan sampai newEnd → { ok, extraDays, cost, short: [nama] } */
    extendCheck(b, newEnd) {
      const extra = diffDays(b.end, newEnd); if (extra <= 0) return { ok: false, extraDays: 0, cost: 0, short: [], msg: 'Tanggal baru harus setelah tanggal kembali sekarang.' };
      const from = addDays(b.end, 1); const need = {};
      b.items.forEach((it) => it.components.forEach((c) => { const k = c.productId + '|' + (c.size || ''); need[k] = (need[k] || 0) + c.qty * it.qty; }));
      const short = Object.entries(need).filter(([k, n]) => { const [pid, size] = k.split('|'); return Rules.available(pid, from, newEnd, b.id, size || null) < n; }).map(([k]) => { const [pid, size] = k.split('|'); return variantName(DB.product(pid), size || null); });
      const maxD = DB.settings().maxRentDays || 60; const total = diffDays(b.start, newEnd);
      if (total > maxD) return { ok: false, extraDays: extra, cost: 0, short, msg: `Total lama sewa maksimal ${maxD} hari.` };
      const cost = itemsSubtotal(b.items, total) - itemsSubtotal(b.items, Math.max(1, diffDays(b.start, b.end)));
      return { ok: !short.length, extraDays: extra, cost, short, msg: short.length ? `Tidak tersedia di tanggal tambahan: ${short.join(', ')}.` : '' };
    },
    refundAmount(b) { const pct = (DB.settings().refundPercent ?? 100) / 100; return Math.round((Rules.paidTotal(b) - (b.refunds || []).reduce((s, r) => s + r.amount, 0)) * pct); },
  };

  const STATUS = {
    rental: {
      menunggu_pembayaran: { label: 'Menunggu Pembayaran', tone: 'amber' },
      menunggu_konfirmasi: { label: 'Menunggu Konfirmasi', tone: 'blue' },
      dikonfirmasi: { label: 'Booking Dikonfirmasi', tone: 'green' },
      disewa: { label: 'Sedang Disewa', tone: 'teal' },
      selesai: { label: 'Selesai', tone: 'gray' },
      dibatalkan: { label: 'Dibatalkan', tone: 'red' },
    },
    sale: {
      menunggu_pembayaran: { label: 'Menunggu Pembayaran', tone: 'amber' },
      diproses: { label: 'Diproses', tone: 'blue' },
      dikemas: { label: 'Dikemas', tone: 'teal' },
      siap_diambil: { label: 'Siap Diambil di Toko', tone: 'green' },
      selesai: { label: 'Selesai', tone: 'gray' },
      dibatalkan: { label: 'Dibatalkan', tone: 'red' },
    },
    payment: {
      unpaid: { label: 'Belum Bayar', tone: 'amber' },
      dp_verifying: { label: 'DP Sedang Diverifikasi', tone: 'blue' },
      dp_paid: { label: 'DP Lunas', tone: 'green' },
      lunas: { label: 'Lunas', tone: 'green' },
      refunded: { label: 'DP Dikembalikan', tone: 'gray' },
      forfeited: { label: 'DP Hangus', tone: 'red' },
      refund_pending: { label: 'Menunggu Refund', tone: 'amber' },
      verifying: { label: 'Menunggu Verifikasi', tone: 'blue' },
      paid: { label: 'Lunas', tone: 'green' },
    },
  };

  const AUDIT_TYPES = {
    login: { label: 'Login', tone: 'green', icon: 'fa-right-to-bracket', group: 'akses' },
    logout: { label: 'Logout', tone: 'gray', icon: 'fa-right-from-bracket', group: 'akses' },
    login_gagal: { label: 'Login gagal', tone: 'red', icon: 'fa-user-lock', group: 'akses' },
    akses: { label: 'Membuka halaman', tone: 'gray', icon: 'fa-eye', group: 'akses' },
    tambah: { label: 'Tambah data', tone: 'blue', icon: 'fa-plus', group: 'data' },
    edit: { label: 'Edit data', tone: 'blue', icon: 'fa-pen', group: 'data' },
    harga: { label: 'Perubahan harga', tone: 'amber', icon: 'fa-tag', group: 'data' },
    stok: { label: 'Perubahan stok', tone: 'amber', icon: 'fa-boxes-stacked', group: 'data' },
    kondisi: { label: 'Kondisi barang', tone: 'amber', icon: 'fa-screwdriver-wrench', group: 'data' },
    status: { label: 'Ubah status', tone: 'amber', icon: 'fa-toggle-on', group: 'data' },
    rental: { label: 'Booking rental', tone: 'green', icon: 'fa-calendar-check', group: 'transaksi' },
    barang_keluar: { label: 'Barang keluar', tone: 'teal', icon: 'fa-box-open', group: 'transaksi' },
    pengembalian: { label: 'Pengembalian', tone: 'teal', icon: 'fa-rotate-left', group: 'transaksi' },
    pembatalan: { label: 'Pembatalan', tone: 'red', icon: 'fa-ban', group: 'transaksi' },
    refund: { label: 'Refund', tone: 'red', icon: 'fa-hand-holding-dollar', group: 'transaksi' },
    pergantian: { label: 'Pergantian barang', tone: 'blue', icon: 'fa-arrows-rotate', group: 'transaksi' },
    penjualan: { label: 'Penjualan', tone: 'blue', icon: 'fa-bag-shopping', group: 'transaksi' },
    varian: { label: 'Ukuran / varian', tone: 'amber', icon: 'fa-ruler', group: 'data' },
    unit: { label: 'Unit barang', tone: 'teal', icon: 'fa-barcode', group: 'data' },
    perpanjangan: { label: 'Perpanjangan sewa', tone: 'blue', icon: 'fa-calendar-plus', group: 'transaksi' },
    promo: { label: 'Promo', tone: 'amber', icon: 'fa-ticket', group: 'data' },
    pelanggan: { label: 'Data pelanggan', tone: 'gray', icon: 'fa-address-book', group: 'data' },
    konfigurasi: { label: 'Konfigurasi sistem', tone: 'amber', icon: 'fa-sliders', group: 'data' },
    keuangan: { label: 'Keuangan', tone: 'green', icon: 'fa-wallet', group: 'transaksi' },
    ulasan: { label: 'Ulasan', tone: 'gray', icon: 'fa-star', group: 'data' },
    staff: { label: 'Manajemen staff', tone: 'blue', icon: 'fa-user-gear', group: 'data' },
    pengaturan: { label: 'Pengaturan', tone: 'amber', icon: 'fa-gear', group: 'data' },
    laporan: { label: 'Laporan', tone: 'gray', icon: 'fa-file-lines', group: 'lainnya' },
  };

  /* Batalkan otomatis pesanan yang belum dibayar melewati batas waktu pembayaran */
  DB.expireUnpaid = function () {
    const hrs = +DB.settings().payWindowHours || 1, now = Date.now(); let changed = 0;
    const exp = (x) => x.paymentStatus === 'unpaid' && x.status === 'menunggu_pembayaran' && now > new Date(x.createdAt).getTime() + hrs * 3600e3;
    ensureNos(); const B = read('bookings', []); B.forEach((b) => { if (!exp(b)) return; b.status = 'dibatalkan'; b.cancel = { at: nowStamp(), reason: `Melewati batas waktu pembayaran (${hrs} jam)`, auto: true, refundable: false };
      (b.history = b.history || []).push({ at: nowStamp(), text: `Dibatalkan otomatis: DP tidak dibayar dalam ${hrs} jam` }); DB.notify(b.customer.email, 'Booking dibatalkan otomatis', `${window.NO(b)} dibatalkan karena DP tidak dibayar dalam ${hrs} jam. Silakan buat booking baru bila masih ingin menyewa.`, 'pesanan'); changed++; });
    if (changed) write('bookings', B);
    const S = read('sales', []); let sc = 0; S.forEach((o) => { if (!exp(o)) return; o.status = 'dibatalkan'; (o.history = o.history || []).push({ at: nowStamp(), text: `Dibatalkan otomatis: belum dibayar dalam ${hrs} jam` }); DB.notify(o.customer.email, 'Pesanan dibatalkan otomatis', `${window.NO(o)} dibatalkan karena belum dibayar dalam ${hrs} jam.`, 'pesanan'); sc++; });
    if (sc) write('sales', S);
    return changed + sc;
  };
  /* Jumlah unit yang disewa per barang (booking tidak dibatalkan, isi paket ikut dihitung) dalam N hari terakhir (0 = semua).
     Dipakai di beranda ("Produk Rental Terlaris") dan dashboard admin ("Barang paling sering disewa") agar konsisten. */
  DB.rentCounts = function (days) {
    const from = days ? addDays(today(), -days) : '';
    const cnt = {};
    read('bookings', []).filter((b) => b.status !== 'dibatalkan' && (!from || b.start >= from)).forEach((b) => b.items.forEach((i) => (i.components || [{ productId: i.refId, qty: 1 }]).forEach((c) => { cnt[c.productId] = (cnt[c.productId] || 0) + c.qty * i.qty; })));
    return cnt;
  };
  /* Daftar barang untuk section beranda sesuai pengaturan owner. Hasil: [{ p, n (jumlah disewa), rank (urutan laris, 0 = tidak dihitung), pinned }] */
  DB.homeBest = function () {
    const cfg = Object.assign({ mode: 'gabungan', days: 90, count: 6, onlyAvailable: true }, DB.settings().homeBest || {});
    const T = today();
    const ok = (p) => p.active !== false && p.rent > 0 && (!cfg.onlyAvailable || Rules.availableOn(p.id, T) > 0);
    const prods = DB.products().filter(ok);
    const cnt = DB.rentCounts(+cfg.days || 0);
    const ranked = prods.filter((p) => cnt[p.id]).sort((a, b) => cnt[b.id] - cnt[a.id] || (b.rating || 0) - (a.rating || 0));
    const rankOf = new Map(ranked.map((p, i) => [p.id, i + 1]));
    /* Barang tersemat diurutkan dari yang paling sering disewa; di mode gabungan maksimal setengah dari jumlah tampil */
    const pinned = prods.filter((p) => p.featured).sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0));
    let list;
    if (cfg.mode === 'manual') list = pinned;
    else if (cfg.mode === 'otomatis') list = ranked;
    else { const pin = pinned.slice(0, Math.floor(cfg.count / 2)); list = [...pin, ...ranked.filter((p) => !pin.includes(p))]; }
    /* Cadangan bila data sewa masih sedikit: barang rating tertinggi */
    if (cfg.mode !== 'manual' && list.length < cfg.count) list = [...list, ...prods.filter((p) => !list.includes(p)).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0))];
    return { cfg, items: list.slice(0, cfg.count).map((p) => ({ p, n: cnt[p.id] || 0, rank: rankOf.get(p.id) || 0, pinned: !!p.featured })) };
  };
  /* ---------- Label kartu produk ----------
     Label pilihan admin (informasi/promosi, bukan klaim data): */
  DB.ADMIN_BADGES = ['Baru', 'Premium', 'Rekomendasi', 'Promo'];
  /* Label otomatis dari data (maks. 1 per kartu, prioritas: Terlaris → Hampir habis → Rating Tertinggi) */
  let topCache = null;
  DB.topRented = function () {
    if (topCache) return topCache;
    const days = +((DB.settings().homeBest || {}).days ?? 90);
    const cnt = DB.rentCounts(days);
    const ids = DB.products().filter((p) => p.rent > 0 && p.active !== false && cnt[p.id]).sort((a, b) => cnt[b.id] - cnt[a.id]).slice(0, 3).map((p) => p.id);
    topCache = { ids, cnt, days }; setTimeout(() => { topCache = null; }, 0);
    return topCache;
  };
  /* Ketersediaan barang sewa dengan SATU acuan tanggal (dipakai label kartu & teks stok):
     tanggal trip yang dipilih customer, atau hari ini bila belum memilih. */
  DB.stockState = function (p) {
    const trip = DB.trip();
    const left = trip ? Rules.available(p.id, trip.start, trip.end) : Rules.availableOn(p.id, today());
    const total = Math.max(1, +p.stock || 0);
    return { left, total, trip, when: trip ? fmtRange(trip.start, trip.end) : 'hari ini',
      /* Hampir habis: sisa 1–2 unit DAN sudah ada yang tersewa (sisa ≤ 50% dari total) — barang yang memang hanya punya 2 unit & belum disewa tidak dianggap hampir habis */
      hampir: left > 0 && left <= 2 && left < total && left / total <= 0.5, penuh: left <= 0 };
  };
  DB.autoBadge = function (p, mode) {
    if (!p) return null;
    mode = mode || (p.rent ? 'rent' : 'buy');
    if (mode === 'rent') {
      const ss = DB.stockState(p);
      if (ss.penuh) return { key: 'penuh', label: ss.trip ? 'Penuh di tanggal ini' : 'Sedang disewa semua', title: `Tidak ada unit tersedia ${ss.when}` };
      const t = DB.topRented();
      if (t.ids.includes(p.id)) return { key: 'terlaris', label: 'Terlaris', title: `${t.cnt[p.id]}× disewa ${t.days ? `dalam ${t.days} hari terakhir` : 'sepanjang waktu'}` };
      if (ss.hampir) return { key: 'hampir', label: 'Hampir habis', title: `Sisa ${ss.left} dari ${ss.total} unit ${ss.when}` };
    } else {
      const left = DB.sizeStock ? DB.sizeStock(p) : p.stock;
      if (left > 0 && left <= 2 && left < (+p.stock || 0) + 1 && left <= Math.max(2, (p.minStock || 0))) return { key: 'hampir', label: 'Hampir habis', title: `Sisa stok ${left}` };
    }
    /* Rating Tertinggi: hanya 3 barang dengan rating terbaik (≥ 4,8 dan minimal 5 ulasan) di mode yang sama */
    const topRated = DB.products().filter((x) => x.active !== false && (mode === 'rent' ? x.rent > 0 : x.price > 0) && (x.rating || 0) >= 4.8 && (x.reviews || 0) >= 5)
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews).slice(0, 3).map((x) => x.id);
    if (topRated.includes(p.id)) return { key: 'rating', label: 'Rating Tertinggi', title: `Rating ${String(p.rating).replace('.', ',')} dari ${p.reviews} ulasan` };
    return null;
  };
  /* Label lama yang berupa klaim (Best Seller, Populer, Terlaris) dikosongkan; label admin di luar daftar juga dikosongkan */
  (function migrateBadges() {
    const all = read('products', PRODUCTS); let ch = false;
    all.forEach((p) => { if (p.badge && !DB.ADMIN_BADGES.includes(p.badge)) { p.badge = ''; ch = true; } });
    if (ch) write('products', all);
  })();
  /* ---------- Pembersihan data setelah rekap bulanan ----------
     Syarat: rekap bulan tsb sudah tersimpan di Google Drive & email terkirim (ada arsip + snapshot laporan).
     DIHAPUS (bertanggal ≤ akhir bulan arsip): pesanan sewa/beli yang SELESAI/DIBATALKAN & tanpa tunggakan,
       log aktivitas & login, notifikasi, email keluar (kecuali email rekap), catatan kas manual.
     TIDAK PERNAH DIHAPUS: barang, unit, kategori, paket, pengguna/staff, promo, pengaturan, ulasan,
       pesanan aktif / belum lunas / ada denda, arsip rekap. Ringkasan angka & riwayat pelanggan disimpan. */
  /* Mode pembersihan & permintaan persetujuan owner */
  DB.cleanupMode = () => { const c = DB.settings().cleanup || {}; return c.mode || (c.enabled === false ? 'off' : 'approve'); };
  DB.cleanupReq = () => read('cleanupReq', { snoozeUntil: '', skipUntil: '' });
  DB.setCleanupReq = (r) => write('cleanupReq', r);
  /* Bulan yang sudah direkap (arsip + email) tapi datanya belum dibersihkan dan masih ada yang bisa dihapus */
  DB.cleanupPending = () => read('archives', []).filter((a) => a.mailId && !a.purged).map((a) => ({ a, p: DB.cleanupArchived(a.period, true) })).filter((x) => x.p.ok && x.p.total).sort((x, y) => x.a.period.localeCompare(y.a.period));
  DB.cleanupArchived = function (period, dry) {
    const arc = read('archives', []).find((a) => a.period === period);
    if (!arc || !arc.mailId) return { ok: false, reason: 'Rekap bulan ini belum tersimpan di Google Drive / email belum terkirim. Pembersihan dibatalkan.' };
    if (!arc.snap && !dry) return { ok: false, reason: 'Isi laporan bulan ini belum disalin ke arsip. Buat ulang rekap dulu.' };
    const [y, m] = period.split('-').map(Number);
    const endD = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const day = (iso) => String(iso || '').replace(' ', 'T').slice(0, 10);
    const old = (iso) => { const d = day(iso); return d && d <= endD; };
    const B = read('bookings', []), S = read('sales', []);
    const bDone = (b) => (b.status === 'dibatalkan' || (b.status === 'selesai' && Rules.paidTotal(b) >= (b.total || 0))) && old((b.ret && b.ret.at) || (b.cancel && b.cancel.at) || b.end || b.createdAt);
    const sDone = (s) => (s.status === 'dibatalkan' || (s.status === 'selesai' && s.paymentStatus === 'paid')) && old(s.createdAt);
    const rmB = B.filter(bDone), rmS = S.filter(sDone);
    const A = read('audit', []), N = read('notifications', []), O = read('outbox', []), E = read('expenses', []), I = read('incomes', []);
    const rmA = A.filter((a) => old(a.at)), rmN = N.filter((n) => old(n.at)), rmO = O.filter((o) => o.kind !== 'monthly_report' && old(o.at || o.sentAt)), rmE = E.filter((e) => old(e.date)), rmI = I.filter((e) => old(e.date));
    const photos = [...rmB, ...rmS].filter((x) => x.proof || (x.out && x.out.photo) || (x.ret && x.ret.photo)).length;
    const counts = { bookings: rmB.length, sales: rmS.length, logs: rmA.length, notifications: rmN.length, emails: rmO.length, finance: rmE.length + rmI.length, photos };
    const total = counts.bookings + counts.sales + counts.logs + counts.notifications + counts.emails + counts.finance;
    if (dry) return { ok: true, period, counts, total, endD };
    /* Simpan riwayat pelanggan sebelum pesanannya dihapus */
    const CA = read('customerArchive', {}); const key = (c) => String(c.email || c.phone || c.name).toLowerCase();
    const acc = (c) => (CA[key(c)] = CA[key(c)] || { name: c.name, email: c.email || '', phone: c.phone || '', rent: 0, sale: 0, total: 0, late: 0, cancel: 0, last: '' });
    rmB.forEach((b) => { const x = acc(b.customer); x.rent++; if (b.status === 'dibatalkan') x.cancel++; else x.total += Rules.paidTotal(b); if (b.ret && b.ret.lateDays) x.late++; if (String(b.createdAt) > x.last) x.last = b.createdAt; });
    rmS.forEach((s) => { const x = acc(s.customer); x.sale++; if (s.status === 'dibatalkan') x.cancel++; else x.total += Rules.paidTotal(s); if (String(s.createdAt) > x.last) x.last = s.createdAt; });
    write('customerArchive', CA);
    const keep = (L, rm) => { const set = new Set(rm); return L.filter((x) => !set.has(x)); };
    write('bookings', keep(B, rmB)); write('sales', keep(S, rmS)); write('audit', keep(A, rmA)); write('notifications', keep(N, rmN));
    write('outbox', keep(O, rmO)); write('expenses', keep(E, rmE)); write('incomes', keep(I, rmI));
    arc.purged = { at: nowStamp(), counts, total, by: (DB.session() || {}).name || 'Sistem (terjadwal)' };
    const all = read('archives', []); const i = all.findIndex((a) => a.period === period); all[i] = arc; write('archives', all);
    DB.audit({ type: 'laporan', system: !DB.session(), action: `Pembersihan data bulan ${period} setelah rekap tersimpan di Google Drive: ${counts.bookings} sewa, ${counts.sales} pembelian, ${counts.logs} log, ${counts.notifications} notifikasi, ${counts.emails} email, ${counts.finance} catatan kas`, ref: period });
    return { ok: true, period, counts, total, endD };
  };
  DB.payDeadline = (x) => new Date(new Date(x.createdAt).getTime() + (+DB.settings().payWindowHours || 1) * 3600e3);
  /* Revisi mitra: batas bayar DP menjadi 1 jam (pengaturan lama 2 jam ikut diperbarui sekali) */
  (function migratePayWindow() { const st = read('settings', SETTINGS); if (!st.payWindowV2) { st.payWindowHours = 1; st.payWindowV2 = true; write('settings', st); } })();
  try { DB.expireUnpaid(); } catch (e) { /* abaikan */ }
  window.Ann = { DEFAULT_SETTINGS: SETTINGS, DB, Rules, STATUS, AUDIT_TYPES, D: { day, today, addDays, rel, diffDays, toISO, fmtDate, fmtDateTime, fmtRange, nowStamp, BULAN, BULAN_PANJANG, HARI }, rupiah };
})();
