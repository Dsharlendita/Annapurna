(function () {
  const VERSION = 'ann-v9';
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
  const CATEGORIES = [
    { id: 'tenda', name: 'Tenda', img: IMG('categories/tenda.jpg') },
    { id: 'sleeping-bag', name: 'Sleeping Bag', img: IMG('categories/sleeping-bag.jpg') },
    { id: 'kursi', name: 'Kursi Camping', img: IMG('categories/kursi.jpg') },
    { id: 'carrier', name: 'Carrier', img: IMG('categories/carrier.jpg') },
    { id: 'kompor', name: 'Kompor & Cooking Set', img: IMG('categories/kompor.jpg') },
    { id: 'lampu', name: 'Lampu', img: IMG('categories/lampu.jpg') },
    { id: 'matras', name: 'Matras', img: IMG('categories/matras.jpg') },
    { id: 'jaket', name: 'Jaket & Pakaian', img: IMG('products/jaket.svg') },
    { id: 'sepatu', name: 'Sepatu & Sandal', img: IMG('products/sepatu.svg') },
  ].map((c) => Object.assign({ active: true }, c));

  const P = (id, name, cat, img, rent, price, stock, rating, reviews, extra = {}) =>
    Object.assign({ id, name, cat, img: IMG(img), rent, price, stock, rating, reviews, cond: 'Sangat Baik', badge: '', featured: false, active: true }, extra);

  /* Varian / ukuran: { label, options: [{ name, stock }] }. Stok total = jumlah stok semua ukuran. */
  const V = (label, pairs, attrId) => ({ attrId, label, options: pairs.map(([name, stock]) => ({ name: String(name), stock })) });
  const PRODUCTS = [
    P('p1', 'Tenda Camping', 'tenda', 'products/tenda.jpg', 75000, 1850000, 6, 4.8, 124, {
      badge: 'Populer', featured: true,
      desc: 'Tenda dome kapasitas 4 orang dengan double layer dan flysheet waterproof 3000mm. Rangka alloy ringan, cepat dipasang dalam 10 menit.',
      specs: ['Kapasitas 4 orang', 'Waterproof 3000mm', 'Berat 3,2 kg', 'Ukuran 210 × 240 × 140 cm'],
      attrs: { 'at-kapasitas': '4 orang', 'at-tipe-tenda': 'Dome' }, brand: 'Consina', sku: 'TND-4P-01', color: 'Hijau army', material: 'Polyester 190T, frame alloy', weight: '3,2 kg', dimension: '210 × 240 × 140 cm', includes: 'Inner, flysheet, 2 frame alloy, 12 pasak, tali, tas', minDays: 1 }),
    P('p2', 'Kursi Camping', 'kursi', 'products/kursi.jpg', 15000, 185000, 12, 4.7, 98, {
      badge: 'Best Seller', featured: true,
      desc: 'Kursi lipat dengan sandaran tinggi dan tempat gelas. Kokoh menahan beban hingga 120 kg, bisa dilipat ringkas ke dalam tas.',
      specs: ['Beban maks. 120 kg', 'Rangka baja', 'Tas penyimpanan', 'Berat 2,1 kg'] }),
    P('p3', 'Sleeping Bag', 'sleeping-bag', 'products/sleeping-bag.jpg', 20000, 275000, 10, 4.6, 87, {
      featured: true,
      desc: 'Sleeping bag polar dengan lapisan dalam lembut, nyaman untuk suhu 10–18°C. Selalu dicuci bersih setelah setiap penyewaan.',
      specs: ['Suhu nyaman 10–18°C', 'Bahan polar', 'Ukuran 190 × 75 cm', 'Bisa dibuka jadi selimut'] }),
    P('p4', 'Kompor Portable', 'kompor', 'products/kompor.jpg', 25000, 320000, 8, 4.8, 76, {
      featured: true,
      desc: 'Kompor gas portable dengan koper, api stabil dan hemat gas. Dilengkapi pengaman tekanan gas otomatis.',
      specs: ['Gas kaleng 230 g', 'Pemantik otomatis', 'Koper pelindung', 'Berat 1,8 kg'] }),
    P('p5', 'Carrier', 'carrier', 'products/carrier.jpg', 35000, 850000, 7, 4.8, 65, {
      featured: true,
      desc: 'Carrier 60 liter dengan backsystem adjustable, rain cover, dan banyak kantong. Cocok untuk pendakian 2–4 hari.',
      specs: ['Kapasitas 60 L', 'Rain cover', 'Backsystem adjustable', 'Hip belt empuk'],
      variant: V('Ukuran punggung', [['S (torso 40–45 cm)', 2], ['M (torso 45–50 cm)', 3], ['L (torso 50–55 cm)', 2]], 'at-punggung'), attrs: { 'at-kapasitas': '60 L' },
      brand: 'Eiger', sku: 'CRR-60-01', color: 'Hitam / abu', material: 'Nylon ripstop 420D', weight: '1,9 kg', dimension: '60 liter', includes: 'Rain cover', minDays: 1 }),
    P('p6', 'Lampu Camping', 'lampu', 'products/lampu.jpg', 15000, 150000, 9, 4.6, 58, {
      featured: true,
      desc: 'Lentera camping dengan cahaya hangat dan tiga mode terang. Baterai isi ulang tahan hingga 12 jam.',
      specs: ['3 mode cahaya', 'Baterai isi ulang', 'Tahan 12 jam', 'Gantungan besi'] }),
    P('p7', 'Tenda Dome 2P Ultralight', 'tenda', 'categories/tenda.jpg', 55000, 1250000, 5, 4.7, 41, {
      desc: 'Tenda ultralight untuk 2 orang, favorit pendaki solo dan berdua. Muat masuk carrier dengan mudah.',
      specs: ['Kapasitas 2 orang', 'Berat 1,9 kg', 'Waterproof 2000mm', 'Frame aluminium'] }),
    P('p8', 'Sleeping Bag Mummy -5°C', 'sleeping-bag', 'categories/sleeping-bag.jpg', 30000, 450000, 6, 4.8, 33, {
      desc: 'Sleeping bag bentuk mummy untuk gunung dengan suhu dingin, lengkap dengan hoodie dan resleting dua arah.',
      specs: ['Suhu ekstrem -5°C', 'Model mummy + hoodie', 'Isian dacron', 'Compression sack'] }),
    P('p9', 'Kursi Camping Director', 'kursi', 'categories/kursi.jpg', 20000, 240000, 6, 4.5, 22, {
      desc: 'Kursi director dengan sandaran tangan, nyaman untuk bersantai lama di area camping ground.',
      specs: ['Sandaran tangan', 'Beban maks. 110 kg', 'Rangka baja', 'Berat 2,8 kg'] }),
    P('p10', 'Carrier Daypack 40L', 'carrier', 'categories/carrier.jpg', 25000, 550000, 6, 4.6, 29, {
      desc: 'Daypack 40 liter untuk tektok dan pendakian satu hari. Ringan dengan ventilasi punggung.',
      specs: ['Kapasitas 40 L', 'Ventilasi punggung', 'Slot hydration', 'Berat 1,1 kg'],
      attrs: { 'at-kapasitas': '40 L' }, brand: 'Consina', sku: 'CRR-40-01', color: 'Biru navy', material: 'Polyester 600D', weight: '1,1 kg', dimension: '40 liter', includes: 'Rain cover', minDays: 1 }),
    P('p11', 'Kompor & Cooking Set', 'kompor', 'categories/kompor.jpg', 30000, 395000, 5, 4.7, 37, {
      desc: 'Paket kompor koper dengan nesting 3 panci, wajan, dan sendok. Praktis untuk masak bareng di camping.',
      specs: ['Kompor koper', 'Nesting 3 panci + wajan', 'Sendok & sutil', 'Tas jaring'] }),
    P('p12', 'Lentera LED Retro', 'lampu', 'categories/lampu.jpg', 12000, 120000, 10, 4.5, 19, {
      desc: 'Lentera LED gaya klasik dengan dimmer. Aman dipakai di dalam tenda.',
      specs: ['Dimmer', '3× baterai AA', 'Tahan 20 jam', 'Tahan cipratan air'] }),
    P('p13', 'Matras Angin Ultralight', 'matras', 'categories/matras.jpg', 15000, 225000, 8, 4.6, 27, {
      desc: 'Matras tiup ringan dengan bantal terintegrasi. Menjaga badan tetap hangat dari tanah.',
      specs: ['Tebal 6 cm', 'Bantal terintegrasi', 'Berat 560 g', 'Pompa kantong'] }),
    P('p14', 'Matras Foam Lipat', 'matras', 'categories/matras.jpg', 8000, 95000, 12, 4.4, 45, {
      desc: 'Matras foam lipat model telur. Tidak perlu ditiup dan tahan tusukan.',
      specs: ['Model egg-crate', 'Tebal 2 cm', 'Lipat 8 bagian', 'Berat 400 g'] }),
    P('p15', 'Tenda Keluarga 6P', 'tenda', 'products/tenda.jpg', 120000, 0, 3, 4.9, 18, {
      desc: 'Tenda besar untuk keluarga dengan dua ruang tidur dan teras. Hanya tersedia untuk disewa.',
      specs: ['Kapasitas 6 orang', '2 kamar + teras', 'Tinggi 190 cm', 'Waterproof 3000mm'] }),
    P('p16', 'Gas Kaleng 230 g', 'kompor', 'categories/kompor.jpg', 0, 18000, 60, 4.8, 112, {
      desc: 'Gas butana kaleng 230 g untuk kompor portable. Hanya tersedia untuk dibeli.',
      specs: ['Isi 230 g', 'Butana', 'Untuk kompor portable', 'Satuan'] }),
    P('p17', 'Jaket Gunung Waterproof', 'jaket', 'products/jaket.svg', 25000, 650000, 9, 4.7, 21, {
      badge: 'Baru', desc: 'Jaket outer 2 lapis anti air dan angin dengan hoodie yang bisa dilepas. Cocok untuk pendakian dan cuaca hujan.',
      specs: ['Waterproof 5000mm', 'Hoodie bisa dilepas', 'Kantong dalam', 'Ventilasi ketiak'],
      variant: V('Ukuran', [['S', 1], ['M', 3], ['L', 3], ['XL', 2]], 'at-ukuran'), attrs: { 'at-gender': 'Unisex' },
      brand: 'Eiger', sku: 'JKT-WP-01', color: 'Oranye', material: 'Nylon taslan coating PU', weight: '650 g', dimension: 'Lingkar dada S 100 · M 106 · L 112 · XL 118 cm', includes: 'Jaket, hoodie, kantong penyimpanan', minDays: 1 }),
    P('p18', 'Jaket Polar Fleece', 'jaket', 'products/jaket-polar.svg', 15000, 225000, 8, 4.6, 14, {
      desc: 'Jaket polar hangat untuk lapisan tengah atau dipakai santai di camping ground saat malam.',
      specs: ['Bahan polar tebal', 'Resleting penuh', '2 kantong samping', 'Ringan & cepat kering'],
      variant: V('Ukuran', [['M', 2], ['L', 3], ['XL', 2], ['XXL', 1]], 'at-ukuran'), attrs: { 'at-gender': 'Unisex' },
      brand: 'Consina', sku: 'JKT-PL-01', color: 'Hijau', material: 'Polar fleece 280 gsm', weight: '420 g', dimension: 'Lingkar dada M 104 · L 110 · XL 116 · XXL 122 cm', includes: 'Jaket', minDays: 1 }),
    P('p19', 'Sepatu Hiking Mid Waterproof', 'sepatu', 'products/sepatu.svg', 35000, 950000, 9, 4.8, 17, {
      desc: 'Sepatu hiking model mid dengan pelindung mata kaki, sol karet bergerigi, dan lapisan anti air. Dicuci & disemprot antibakteri setiap selesai disewa.',
      specs: ['Model mid-cut', 'Sol karet anti slip', 'Lapisan waterproof', 'Toe cap pelindung'],
      variant: V('Ukuran (EU)', [['39', 1], ['40', 2], ['41', 2], ['42', 2], ['43', 1], ['44', 1]], 'at-sepatu'), attrs: { 'at-gender': 'Unisex' },
      brand: 'SNTA', sku: 'SPT-HK-01', color: 'Cokelat', material: 'Suede & mesh, sol rubber', weight: '1,1 kg / pasang', dimension: 'Panjang kaki: 39 = 24,5 cm · 40 = 25 cm · 41 = 26 cm · 42 = 26,5 cm · 43 = 27,5 cm · 44 = 28 cm', includes: 'Sepasang sepatu, tali cadangan', minDays: 1 }),
    P('p20', 'Sandal Gunung', 'sepatu', 'products/sandal.svg', 0, 185000, 10, 4.6, 26, {
      desc: 'Sandal gunung dengan strap kuat dan sol empuk. Nyaman untuk di camping ground atau menyeberang sungai. Hanya dijual.',
      specs: ['Strap webbing + velcro', 'Sol EVA + karet', 'Cepat kering', 'Anti slip'],
      variant: V('Ukuran (EU)', [['39', 2], ['40', 2], ['41', 2], ['42', 2], ['43', 2]], 'at-sepatu'), attrs: { 'at-gender': 'Unisex' },
      brand: 'Eiger', sku: 'SDL-01', color: 'Hitam / hijau', material: 'Webbing nylon, sol karet', weight: '480 g / pasang', dimension: '', includes: 'Sepasang sandal', minDays: 1 }),
  ];

  const PACKAGES = [
    { id: 'pk1', name: 'Paket Solo Hiking', tagline: 'Semua yang kamu butuhkan untuk naik gunung sendiri.', img: IMG('products/carrier.jpg'), price: 120000, people: '1 orang', pMin: 1, pMax: 1, type: 'hiking',
      items: [{ productId: 'p7', qty: 1 }, { productId: 'p8', qty: 1 }, { productId: 'p13', qty: 1 }, { productId: 'p5', qty: 1 }, { productId: 'p6', qty: 1 }] },
    { id: 'pk2', name: 'Paket Camping Berdua', tagline: 'Tenda, alas tidur, dan dapur kecil untuk dua orang.', img: IMG('products/tenda.jpg'), price: 145000, people: '2 orang', pMin: 2, pMax: 2, type: 'camping', popular: true,
      items: [{ productId: 'p1', qty: 1 }, { productId: 'p3', qty: 2 }, { productId: 'p14', qty: 2 }, { productId: 'p4', qty: 1 }, { productId: 'p6', qty: 1 }] },
    { id: 'pk3', name: 'Paket Keluarga', tagline: 'Camping santai bareng keluarga di camping ground.', img: IMG('products/kursi.jpg'), price: 299000, people: '4–6 orang', pMin: 4, pMax: 6, type: 'camping',
      items: [{ productId: 'p15', qty: 1 }, { productId: 'p3', qty: 4 }, { productId: 'p14', qty: 4 }, { productId: 'p2', qty: 4 }, { productId: 'p11', qty: 1 }, { productId: 'p6', qty: 2 }] },
    { id: 'pk4', name: 'Paket Hiking Berdua', tagline: 'Ringan dibawa untuk pendakian dua hari satu malam.', img: IMG('categories/tenda.jpg'), price: 175000, people: '2 orang', pMin: 2, pMax: 2, type: 'hiking',
      items: [{ productId: 'p7', qty: 1 }, { productId: 'p8', qty: 2 }, { productId: 'p13', qty: 2 }, { productId: 'p10', qty: 2 }, { productId: 'p12', qty: 1 }] },
    { id: 'pk5', name: 'Paket Tektok Ringan', tagline: 'Naik dan turun di hari yang sama tanpa menginap.', img: IMG('categories/carrier.jpg'), price: 52000, people: '1 orang', pMin: 1, pMax: 1, type: 'hiking',
      items: [{ productId: 'p10', qty: 1 }, { productId: 'p12', qty: 1 }, { productId: 'p4', qty: 1 }] },
    { id: 'pk6', name: 'Paket Camping Berempat', tagline: 'Dua tenda dan perlengkapan tidur untuk empat orang.', img: IMG('products/sleeping-bag.jpg'), price: 319000, people: '4 orang', pMin: 4, pMax: 4, type: 'camping',
      items: [{ productId: 'p1', qty: 2 }, { productId: 'p3', qty: 4 }, { productId: 'p14', qty: 4 }, { productId: 'p2', qty: 4 }, { productId: 'p4', qty: 1 }, { productId: 'p6', qty: 2 }] },
    { id: 'pk7', name: 'Paket Rombongan', tagline: 'Untuk kemah bersama komunitas atau acara kampus.', img: IMG('categories/kursi.jpg'), price: 419000, people: '6–8 orang', pMin: 6, pMax: 8, type: 'camping',
      items: [{ productId: 'p15', qty: 1 }, { productId: 'p1', qty: 1 }, { productId: 'p3', qty: 8 }, { productId: 'p14', qty: 8 }, { productId: 'p11', qty: 1 }, { productId: 'p6', qty: 3 }] },
    { id: 'pk8', name: 'Paket Dapur Camping', tagline: 'Masak dan ngopi di alam tanpa ribet.', img: IMG('categories/kompor.jpg'), price: 57000, people: '2–4 orang', pMin: 2, pMax: 4, type: 'pelengkap',
      items: [{ productId: 'p11', qty: 1 }, { productId: 'p4', qty: 1 }, { productId: 'p12', qty: 1 }] },
    { id: 'pk9', name: 'Paket Tidur Nyaman', tagline: 'Sleeping bag hangat dan matras angin untuk tidur nyenyak.', img: IMG('categories/sleeping-bag.jpg'), price: 39000, people: '1 orang', pMin: 1, pMax: 1, type: 'pelengkap',
      items: [{ productId: 'p8', qty: 1 }, { productId: 'p13', qty: 1 }] },
  ];

  const SETTINGS = {
    storeName: 'Annapurna Adventure',
    phone: '+62 896 3469 6969',
    whatsapp: '6289634696969',
    email: 'annapurnaadv@gmail.com',
    instagram: '@annapurnaadv',
    address: 'Jl. Kampus No. 8-9 Grendeng, Purwokerto, Jawa Tengah, Indonesia',
    hours: 'Setiap hari, 09.00 – 22.00 WIB',
    dpPercent: 50,
    cancelDays: 2,
    lateFeePercent: 100,
    lateFeeMode: 'persen',
    lateFeeAmount: 20000,
    returnTime: '18:00',
    lateAfterReturnTime: true,
    maxRentDays: 14,
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
    rentalTerms: [
      'Pengambilan dan pengembalian barang dilakukan langsung di toko (tidak ada layanan antar).',
      'Penyewa wajib menyerahkan kartu identitas asli (KTP/KTM/SIM) saat pengambilan barang.',
      'Harga sewa dihitung per hari (24 jam) sejak tanggal pengambilan.',
      'Pembayaran DP 50% diperlukan untuk mengunci booking. Sisa dibayar saat pengambilan barang.',
      'Keterlambatan pengembalian dikenakan denda sebesar harga sewa per hari untuk setiap barang.',
      'Kerusakan atau kehilangan barang menjadi tanggung jawab penyewa sesuai hasil pengecekan.',
    ],
    cancelPolicy: [
      'Pembatalan paling lambat H-2 sebelum tanggal ambil: DP dikembalikan penuh.',
      'Pembatalan kurang dari H-2: DP tidak dapat dikembalikan.',
      'Pengembalian DP diproses admin maksimal 2×24 jam ke rekening penyewa.',
    ],
    /* ---------- Konfigurasi sistem (diatur Owner) ---------- */
    attributes: [
      { id: 'at-ukuran', name: 'Ukuran pakaian', type: 'pilihan', values: ['S', 'M', 'L', 'XL', 'XXL'], variant: true, cats: ['jaket'], required: true, active: true },
      { id: 'at-sepatu', name: 'Ukuran sepatu (EU)', type: 'pilihan', values: ['38', '39', '40', '41', '42', '43', '44', '45'], variant: true, cats: ['sepatu'], required: true, active: true },
      { id: 'at-punggung', name: 'Ukuran punggung', type: 'pilihan', values: ['S (torso 40–45 cm)', 'M (torso 45–50 cm)', 'L (torso 50–55 cm)'], variant: true, cats: ['carrier'], required: false, active: true },
      { id: 'at-kapasitas', name: 'Kapasitas', type: 'pilihan', values: ['1 orang', '2 orang', '4 orang', '6 orang', '40 L', '60 L'], variant: false, cats: ['tenda', 'carrier'], required: false, active: true },
      { id: 'at-tipe-tenda', name: 'Tipe tenda', type: 'pilihan', values: ['Dome', 'Tunnel', 'Ultralight', 'Keluarga'], variant: false, cats: ['tenda'], required: false, active: true },
      { id: 'at-gender', name: 'Gender', type: 'pilihan', values: ['Pria', 'Wanita', 'Unisex'], variant: false, cats: ['jaket', 'sepatu'], required: false, active: true },
      { id: 'at-suhu', name: 'Suhu nyaman', type: 'teks', values: [], variant: false, cats: ['sleeping-bag'], required: false, active: true },
    ],
    conditions: [
      { name: 'Sangat Baik', rentable: true, tone: 'green' },
      { name: 'Baik', rentable: true, tone: 'green' },
      { name: 'Cukup', rentable: true, tone: 'amber' },
      { name: 'Dicuci', rentable: false, tone: 'blue' },
      { name: 'Perlu Perawatan', rentable: false, tone: 'amber' },
      { name: 'Rusak', rentable: false, tone: 'red' },
      { name: 'Hilang', rentable: false, tone: 'red' },
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
      { id: 'sop-2', title: 'Pemeriksaan barang kembali', context: 'pengembalian', pinned: true, body: 'Semua barang yang dikembalikan wajib diperiksa kondisi fisiknya dan difoto sebelum status rental diselesaikan. Barang kotor diberi kondisi "Dicuci" dan tidak disewakan sampai bersih.' },
      { id: 'sop-3', title: 'Pengingat pengembalian', context: 'umum', pinned: false, body: 'Kirim pengingat WhatsApp ke penyewa yang jadwal kembalinya hari ini paling lambat pukul 12.00. Untuk yang terlambat, hubungi setiap hari sampai barang kembali.' },
      { id: 'sop-4', title: 'Pembatalan & refund', context: 'pembatalan', pinned: false, body: 'Cek tanggal pembatalan terhadap batas H-refund. Refund ditransfer maksimal 2×24 jam dan nomor referensi transfer wajib dicatat.' },
    ],
  };

  const USERS = [
    { id: 'u1', name: 'Pak Ikun', email: 'owner@annapurna.id', password: 'owner123', role: 'owner', status: 'aktif', phone: '081200001111', address: SETTINGS.address, createdAt: stampRel(-120, 8) },
    { id: 'u2', name: 'Dimas Saputra', email: 'customer@annapurna.id', password: 'customer123', role: 'customer', status: 'aktif', phone: '081390001122', address: 'Jl. Dr. Soeparno No. 12, Karangwangkal, Purwokerto Utara' },
    { id: 'u3', name: 'Dita', email: 'dita@annapurna.id', password: 'dita123', role: 'admin', status: 'aktif', phone: '085711223344', address: '', createdAt: stampRel(-60, 8), createdBy: 'u1' },
    { id: 'u4', name: 'Shely', email: 'shely@annapurna.id', password: 'shely123', role: 'admin', status: 'aktif', phone: '085722334455', address: '', createdAt: stampRel(-60, 8), createdBy: 'u1' },
    { id: 'u5', name: 'Aji', email: 'aji@annapurna.id', password: 'aji123', role: 'admin', status: 'aktif', phone: '085733445566', address: '', createdAt: stampRel(-45, 9), createdBy: 'u1' },
    { id: 'u6', name: 'Arvan', email: 'arvan@annapurna.id', password: 'arvan123', role: 'admin', status: 'aktif', phone: '085744556677', address: '', createdAt: stampRel(-45, 9), createdBy: 'u1' },
  ];
  /* Jadwal jaga demo: pagi (08.45–16.10) Dita / Shely bergantian, siang (12.50–21.05) Aji / Arvan bergantian. */
  const dayNo = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z') / 864e5);
  const shiftOf = (iso) => { const h = new Date(iso).getHours(); const odd = dayNo(iso) % 2; return h >= 13 ? (odd ? 'u6' : 'u5') : (odd ? 'u4' : 'u3'); };
  const nameOf = (id) => USERS.find((u) => u.id === id).name;
  const STAFF_ROLES = ['admin', 'owner'];
  const isStaff = (u) => !!u && STAFF_ROLES.includes(u.role);
  const hasVariant = (p) => !!(p && p.variant && (p.variant.options || []).length);
  const variantName = (p, size) => (size && hasVariant(p) ? `${p.name} · ${p.variant.label.replace(/\s*\(.*\)/, '')} ${String(size).replace(/\s*\(.*\)/, '')}` : p.name);

  function line(productId, qty, size) {
    const p = PRODUCTS.find((x) => x.id === productId);
    return Object.assign({ kind: 'product', refId: productId, name: variantName(p, size), img: p.img, qty, pricePerDay: p.rent, components: [size ? { productId, qty: 1, size } : { productId, qty: 1 }] }, size ? { size } : {});
  }
  function booking(o) {
    const days = Math.max(1, diffDays(o.start, o.end));
    const subtotal = o.items.reduce((s, it) => s + it.pricePerDay * it.qty, 0) * days;
    const dp = Math.round(subtotal * SETTINGS.dpPercent / 100);
    return Object.assign({ days, subtotal, total: subtotal, dp, fine: 0, payments: [], refunds: [], changes: [], history: [], delivery: 'ambil', address: '', notes: '' }, o, { days, subtotal, total: subtotal + (o.fine || 0), dp });
  }
  const cust = (name, phone, email) => ({ name, phone, email });
  const DIMAS = cust('Dimas Saputra', '081390001122', 'customer@annapurna.id');

  function seedBookings() {
    const B = [];
    B.push(booking({ id: 'RNT-1001', customer: DIMAS, items: [line('p1', 1), line('p3', 2), line('p4', 1)], start: rel(3), end: rel(5),
      status: 'dikonfirmasi', paymentStatus: 'dp_paid', method: 'Transfer BCA', createdAt: stampRel(-2) }));
    B.push(booking({ id: 'RNT-1002', customer: DIMAS, items: [line('p5', 1, 'M (torso 45–50 cm)'), line('p7', 1)], start: rel(-24), end: rel(-21),
      status: 'selesai', paymentStatus: 'lunas', method: 'QRIS', createdAt: stampRel(-28) }));
    B.push(booking({ id: 'RNT-1003', customer: DIMAS, items: [line('p13', 2), line('p6', 1)], start: rel(8), end: rel(10),
      status: 'menunggu_pembayaran', paymentStatus: 'unpaid', method: 'Transfer BRI', createdAt: stampRel(0, 8) }));
    B.push(booking({ id: 'RNT-1004', customer: cust('Rizky Amalia', '082134567788', 'rizky@mail.com'), items: [line('p1', 2), line('p2', 4), line('p11', 1)], start: rel(-1), end: rel(1),
      status: 'disewa', paymentStatus: 'lunas', method: 'Transfer BCA', createdAt: stampRel(-6) }));
    B.push(booking({ id: 'RNT-1005', customer: cust('Andi Pratama', '085712340099', 'andi@mail.com'), items: [line('p7', 1), line('p8', 1), line('p5', 1, 'L (torso 50–55 cm)')], start: rel(-2), end: rel(0),
      status: 'disewa', paymentStatus: 'lunas', method: 'QRIS', createdAt: stampRel(-5) }));
    B.push(booking({ id: 'RNT-1006', customer: cust('Salsabila Nur Aini', '081227773344', 'salsa@mail.com'), items: [line('p3', 1), line('p14', 1)], start: rel(-4), end: rel(-1),
      status: 'disewa', paymentStatus: 'lunas', method: 'Transfer BRI', createdAt: stampRel(-7) }));
    B.push(booking({ id: 'RNT-1007', customer: cust('Bagas Wicaksono', '089612345678', 'bagas@mail.com'), items: [line('p15', 1), line('p2', 4)], start: rel(2), end: rel(4),
      status: 'menunggu_konfirmasi', paymentStatus: 'dp_verifying', method: 'Transfer BCA', createdAt: stampRel(0, 9),
      proof: IMG('demo/bukti-dp-contoh.jpg'), proofMeta: { demo: true, amount: 180000, bank: 'BCA', account: '1234567890', receiver: 'ANNAPURNA ADVENTURE', note: 'DP RNT-1007', at: stampRel(0, 9) } }));
    B.push(booking({ id: 'RNT-1008', customer: cust('Nadia Putri', '081355556677', 'nadia@mail.com'), items: [line('p1', 1), line('p6', 2), line('p17', 2, 'L'), line('p19', 1, '42')], start: rel(0), end: rel(2),
      status: 'dikonfirmasi', paymentStatus: 'dp_paid', method: 'QRIS', createdAt: stampRel(-3) }));
    B.push(booking({ id: 'RNT-1009', customer: cust('Fajar Nugroho', '087811112222', 'fajar@mail.com'), items: [line('p10', 2), line('p12', 2)], start: rel(-10), end: rel(-8),
      status: 'selesai', paymentStatus: 'lunas', method: 'Transfer BCA', createdAt: stampRel(-13), fine: 24000 }));
    B.push(booking({ id: 'RNT-1010', customer: cust('Laras Kusuma', '082244446666', 'laras@mail.com'), items: [line('p9', 2)], start: rel(5), end: rel(6),
      status: 'dibatalkan', paymentStatus: 'refunded', method: 'Transfer BRI', createdAt: stampRel(-4) }));
    B.push(booking({ id: 'RNT-1011', customer: cust('Yoga Pamungkas', '081998887766', 'yoga@mail.com'), items: [line('p1', 1), line('p13', 2), line('p4', 1)], start: rel(4), end: rel(7),
      status: 'dikonfirmasi', paymentStatus: 'dp_paid', method: 'Transfer BCA', createdAt: stampRel(-1) }));

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
        b.ret = { at: addDays(b.end, late) + 'T16:00:00', cond: b.fine ? 'Baik' : 'Baik', lateDays: late, damageFee: 0, fine: b.fine, by: nameOf(shiftOf(addDays(b.end, late) + 'T16:00:00')), note: b.fine ? 'Terlambat 1 hari' : '' };
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
    b11.changes.push({ id: 'CHG-1', at: stampRel(0, 7), lineIndex: 0, fromId: 'p1', fromName: 'Tenda Camping', toId: 'p15', toName: 'Tenda Keluarga 6P', qty: 1,
      diff: (120000 - 75000) * b11.days, reason: 'Ternyata yang ikut jadi 5 orang', status: 'menunggu' });
    return B;
  }

  function sale(o) {
    const subtotal = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    return Object.assign({ payments: [], history: [], notes: '' }, o, { subtotal, total: subtotal, delivery: 'ambil' });
  }
  const si = (id, qty) => { const p = PRODUCTS.find((x) => x.id === id); return { productId: id, name: p.name, img: p.img, qty, price: p.price }; };
  function seedSales() {
    const S = [
      sale({ id: 'ORD-2001', customer: DIMAS, items: [si('p16', 4), si('p12', 1)], delivery: 'ambil', status: 'selesai', paymentStatus: 'paid', method: 'QRIS', createdAt: stampRel(-12) }),
      sale({ id: 'ORD-2002', customer: cust('Rizky Amalia', '082134567788', 'rizky@mail.com'), items: [si('p2', 2)], delivery: 'ambil', status: 'siap_diambil', paymentStatus: 'paid', method: 'Transfer BCA', createdAt: stampRel(-2) }),
      sale({ id: 'ORD-2003', customer: cust('Hendra Wijaya', '081222333444', 'hendra@mail.com'), items: [si('p5', 1), si('p13', 1)], delivery: 'ambil', status: 'dikemas', paymentStatus: 'paid', method: 'Transfer BRI', createdAt: stampRel(-1) }),
      sale({ id: 'ORD-2004', customer: cust('Maya Lestari', '085600001111', 'maya@mail.com'), items: [si('p16', 6)], delivery: 'ambil', status: 'diproses', paymentStatus: 'verifying', method: 'QRIS', createdAt: stampRel(0, 8) }),
      sale({ id: 'ORD-2005', customer: cust('Tegar Prakoso', '087700009999', 'tegar@mail.com'), items: [si('p11', 1)], delivery: 'ambil', status: 'selesai', paymentStatus: 'paid', method: 'Transfer BCA', createdAt: stampRel(0, 10) }),
      sale({ id: 'ORD-2006', customer: cust('Putri Anjani', '081566667777', 'putri@mail.com'), items: [si('p3', 1), si('p6', 1)], delivery: 'ambil', status: 'selesai', paymentStatus: 'paid', method: 'QRIS', createdAt: stampRel(-5) }),
    ];
    S.forEach((s) => {
      s.history.push({ at: s.createdAt, text: 'Pesanan dibuat' });
      if (s.paymentStatus === 'paid') { s.payments.push({ at: s.createdAt, amount: s.total, type: 'Pembayaran' }); s.history.push({ at: s.createdAt, text: 'Pembayaran diverifikasi' }); }
    });
    return S;
  }

  function seedExpenses() {
    return [
      { id: 'EXP-1', date: rel(-20), category: 'Pembelian Barang', desc: 'Tambah 2 unit Matras Angin Ultralight', amount: 380000 },
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
    ext(-20, 11, 20, 'stok', 'Mengubah stok Matras Angin Ultralight', { ref: 'p13', changes: [{ field: 'Stok', from: '6 unit', to: '8 unit' }] });
    ext(-14, 15, 40, 'tambah', 'Menambahkan barang Lentera LED Retro', { ref: 'p12', changes: [{ field: 'Harga sewa / hari', from: '', to: rupiah(12000) }, { field: 'Harga jual', from: '', to: rupiah(120000) }, { field: 'Stok', from: '', to: '10 unit' }] });
    ext(-9, 14, 10, 'harga', 'Mengubah harga Tenda Camping', { ref: 'p1', changes: [{ field: 'Harga sewa / hari', from: rupiah(70000), to: rupiah(75000) }] });
    ext(-6, 10, 5, 'kondisi', 'Mengubah kondisi Kursi Camping Director', { ref: 'p9', changes: [{ field: 'Kondisi', from: 'Perlu Perawatan', to: 'Sangat Baik' }] });
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

  function seedNotifications() {
    return [
      { id: 'n1', email: 'customer@annapurna.id', at: stampRel(-1, 13), title: 'Booking dikonfirmasi', text: 'Booking RNT-1001 sudah dikonfirmasi. Barang bisa diambil sesuai tanggal sewa.', read: false, link: 'pesanan?id=RNT-1001' },
      { id: 'n2', email: 'customer@annapurna.id', at: stampRel(0, 8), title: 'Selesaikan pembayaran DP', text: 'Bayar DP untuk RNT-1003 agar barang tidak diambil penyewa lain.', read: false, link: 'pembayaran?ids=RNT-1003' },
      { id: 'n3', email: 'customer@annapurna.id', at: stampRel(-12), title: 'Pesanan selesai', text: 'Pesanan ORD-2001 sudah selesai. Terima kasih sudah belanja!', read: true, link: 'pesanan?tab=beli' },
      ...USERS.filter(isStaff).map((u) => ({ id: 'n4' + u.id, email: u.email, at: stampRel(0, 9), title: 'Bukti DP masuk', text: 'Bagas Wicaksono mengunggah bukti DP untuk RNT-1007.', read: false, link: 'admin/booking?id=RNT-1007' })),
      ...USERS.filter(isStaff).map((u) => ({ id: 'n5' + u.id, email: u.email, at: stampRel(0, 7), title: 'Permintaan ganti barang', text: 'Yoga Pamungkas ingin mengganti Tenda Camping menjadi Tenda Keluarga 6P (RNT-1011).', read: false, link: 'admin/permintaan' })),
    ];
  }

  function seedReviews() {
    const R = (id, refId, name, email, role, img, rating, text, productIds, daysAgo, extra) => Object.assign({ id, refId, type: refId.startsWith('ORD') ? 'buy' : 'rent', name, email, role, img: img ? IMG(img) : '', rating, text, productIds, createdAt: stampRel(daysAgo, 19), visible: true, featured: false, reply: '', seen: true }, extra || {});
    return [
      R('REV-1', 'RNT-0981', 'Rizky Amalia', 'rizky@mail.com', 'Pendaki, Purwokerto', 'avatar1.jpg', 5, 'Peralatannya lengkap dan masih bagus banget. Proses sewanya juga gampang. Nanti pasti sewa lagi!', ['p1', 'p2'], -40, { featured: true, order: 0 }),
      R('REV-2', 'RNT-0987', 'Andi Pratama', 'andi@mail.com', 'Mahasiswa, UIN', 'avatar2.jpg', 5, 'Harga terjangkau, pelayanannya ramah. Sangat membantu untuk trip camping bareng teman-teman.', ['p2', 'p4'], -33, { featured: true, order: 1 }),
      R('REV-3', 'RNT-0992', 'Salsabila Nur Aini', 'salsa@mail.com', 'Camper, Cilacap', 'avatar3.jpg', 5, 'Tenda dan sleeping bag nya bersih, kualitas oke. Rekomendasi banget buat yang cari rental alat camping di Purwokerto!', ['p1', 'p3'], -27, { featured: true, order: 2, reply: 'Terima kasih Salsabila, ditunggu petualangan berikutnya!', replyAt: stampRel(-26, 9), replySeen: true }),
      R('REV-4', 'RNT-1009', 'Fajar Nugroho', 'fajar@mail.com', 'Penyewa', '', 5, 'Carrier daypack enak dipakai, lentera LED-nya terang dan awet baterainya. Admin fast respon di WhatsApp.', ['p10', 'p12'], -7, { seen: false }),
      R('REV-5', 'ORD-2006', 'Putri Anjani', 'putri@mail.com', 'Pembeli', '', 4, 'Kursi dan lampu sesuai foto. Sempat antre sebentar waktu ambil di toko, tapi pelayanannya ramah.', ['p3', 'p6'], -4, { seen: false, reply: 'Terima kasih masukannya, Kak Putri! Sekarang kami tambah satu petugas di jam ramai supaya pengambilan lebih cepat.', replyAt: stampRel(-3, 10), replySeen: false }),
      R('REV-6', 'ORD-2005', 'Tegar Prakoso', 'tegar@mail.com', 'Pembeli', '', 3, 'Cooking set oke, cuma kotaknya agak penyok. Semoga packing ke depan lebih rapi.', ['p11'], 0, { seen: false }),
    ];
  }

  const read = (k, fb) => { try { const v = localStorage.getItem(KEY(k)); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  const write = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { console.warn('Penyimpanan penuh / tidak tersedia', e); } };

  function seed(force) {
    if (!force && read('version') === VERSION) return;
    write('categories', CATEGORIES);
    write('products', PRODUCTS);
    write('packages', PACKAGES);
    write('settings', SETTINGS);
    const B = seedBookings(), S = seedSales(), E = seedExpenses().map((e) => Object.assign({ status: 'aktif' }, e));
    write('bookings', B);
    write('sales', S);
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
    get: (k) => read(k, []),
    set(k, v) { if (k === 'audit') { console.warn('Histori bersifat append-only dan tidak bisa ditimpa.'); return; } write(k, v); },
    reset() {
      const s = read('session', null); seed(true);
      if (s) { write('session', s); DB.audit({ type: 'pengaturan', action: 'Menyetel ulang data demo' }); }
    },
    settings: () => read('settings', SETTINGS),
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
    lateFeeText() { const st = DB.settings(); return st.lateFeeMode === 'nominal' ? `${rupiah(st.lateFeeAmount)} per barang per hari` : `${st.lateFeePercent}% harga sewa per hari untuk setiap barang`; },
    /* Simpan satu bagian konfigurasi + catat di histori */
    saveConfig(key, value, action, changes) {
      const st = DB.settings(); st[key] = value; write('settings', st);
      DB.audit({ type: 'konfigurasi', action, changes });
    },
    packages: () => read('packages', PACKAGES),
    pkg: (id) => read('packages', PACKAGES).find((p) => p.id === id),
    bookings: () => read('bookings', []),
    booking: (id) => read('bookings', []).find((b) => b.id === id),
    /* Terapkan pergantian barang pada booking (dipakai saat admin menyetujui / mencatat ganti di toko). */
    applyBookingChange(b, ch) {
      const it = b.items[ch.lineIndex]; const p = DB.product(ch.toId);
      if (!p || !it) return { ok: false, msg: 'Data barang tidak ditemukan.' };
      const qty = Math.min(ch.qty || it.qty, it.qty);
      const size = ch.toSize && hasVariant(p) ? ch.toSize : null;
      const avail = Rules.available(p.id, b.start, b.end, b.id, size);
      const same = it.refId === p.id && (it.size || null) === size;
      if (!same && avail < qty) return { ok: false, msg: `${variantName(p, size)} hanya tersedia ${avail} unit pada tanggal sewa ini.` };
      const newLine = Object.assign({ kind: 'product', refId: p.id, name: variantName(p, size), img: p.img, qty, pricePerDay: p.rent, components: [size ? { productId: p.id, qty: 1, size } : { productId: p.id, qty: 1 }] }, size ? { size } : {});
      if (qty >= it.qty) b.items[ch.lineIndex] = newLine; else { it.qty -= qty; b.items.push(newLine); }
      const oldTotal = b.total;
      b.subtotal = b.items.reduce((s, i) => s + i.pricePerDay * i.qty, 0) * b.days;
      b.total = b.subtotal + (b.fine || 0);
      if (!Rules.paidTotal(b)) b.dp = Math.round(b.subtotal * DB.settings().dpPercent / 100);
      return { ok: true, oldTotal, newTotal: b.total, line: newLine };
    },
    saveBooking(b) { const all = read('bookings', []); const i = all.findIndex((x) => x.id === b.id); if (i >= 0) all[i] = b; else all.unshift(b); write('bookings', all); },
    sales: () => read('sales', []),
    sale: (id) => read('sales', []).find((s) => s.id === id),
    saveSale(s) { const all = read('sales', []); const i = all.findIndex((x) => x.id === s.id); if (i >= 0) all[i] = s; else all.unshift(s); write('sales', all); },
    saveProduct(p) {
      const all = read('products', PRODUCTS); const i = all.findIndex((x) => x.id === p.id);
      const old = i >= 0 ? all[i] : null;
      const base = old ? { rating: old.rating, reviews: old.reviews } : { rating: 0, reviews: 0 };
      const clean = Object.assign({ active: true }, p, base);
      if (hasVariant(clean)) clean.stock = clean.variant.options.reduce((a, o) => a + (+o.stock || 0), 0);
      if (i >= 0) all[i] = clean; else all.push(clean); write('products', all);
      if (!old) {
        DB.audit({ type: 'tambah', action: `Menambahkan barang ${clean.name}`, ref: clean.id, changes: [{ field: 'Harga sewa / hari', from: '', to: money(clean.rent) }, { field: 'Harga jual', from: '', to: money(clean.price) }, { field: 'Stok', from: '', to: unit(clean.stock) }] });
        return;
      }
      const groups = [
        ['harga', `Mengubah harga ${clean.name}`, [['rent', 'Harga sewa / hari', money], ['price', 'Harga jual', money]]],
        ['stok', `Mengubah stok ${clean.name}`, [['stock', 'Stok', unit]]],
        ['kondisi', `Mengubah kondisi ${clean.name}`, [['cond', 'Kondisi']]],
        ['status', `${clean.active === false ? 'Menonaktifkan' : 'Mengaktifkan'} barang ${clean.name}`, [['active', 'Status', actv]]],
        ['varian', `Mengubah ukuran / varian ${clean.name}`, [['variant', 'Ukuran & stok', (v) => (v && v.options && v.options.length ? `${v.label}: ` + v.options.map((o) => `${o.name} (${o.stock})`).join(', ') : 'Tanpa ukuran')]]],
        ['edit', `Mengedit data barang ${clean.name}`, [['name', 'Nama'], ['cat', 'Kategori'], ['brand', 'Merek'], ['sku', 'Kode barang'], ['color', 'Warna'], ['material', 'Bahan'], ['weight', 'Berat'], ['dimension', 'Ukuran / kapasitas'], ['includes', 'Kelengkapan'], ['minDays', 'Minimal sewa (hari)'], ['deposit', 'Jaminan / deposit', money], ['attrs', 'Atribut', (v) => Object.entries(v || {}).filter(([, x]) => x !== '' && x != null).map(([k, x]) => `${((read('settings', SETTINGS).attributes || []).find((t) => t.id === k) || { name: k }).name}: ${x}`).join('; ') || '—'], ['badge', 'Label'], ['featured', 'Unggulan beranda', yes], ['desc', 'Deskripsi', (v) => (v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—')], ['specs', 'Spesifikasi', (v) => (v || []).join('; ')]]],
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
    user: (id) => read('users', USERS).find((u) => u.id === id),
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
      const s = { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address, mustChangePw: !!u.mustChangePw, loginAt: nowStamp(), seen: {} };
      write('session', s);
      if (isStaff(u)) { u.lastLogin = s.loginAt; u.lastSeen = s.loginAt; write('users', users); DB.audit({ type: 'login', action: `Login ke panel ${u.role === 'owner' ? 'owner' : 'admin'}` }); }
      return { ok: true, user: s };
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
    logout() {
      const s = DB.session();
      if (isStaff(s)) { DB.audit({ type: 'logout', action: `Logout dari panel ${s.role === 'owner' ? 'owner' : 'admin'}` }); DB.patchUser(s.id, { lastLogout: nowStamp(), lastSeen: nowStamp() }); }
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
      const entry = Object.assign({ id: auditId(list.length + 1), at: nowStamp() }, actor, { type: e.type, action: e.action }, e.ref ? { ref: e.ref } : {}, e.changes && e.changes.length ? { changes: e.changes } : {}, { prev });
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
    notify(email, title, text, link) {
      const all = read('notifications', []);
      all.push({ id: 'n' + Date.now() + Math.random().toString(16).slice(2, 6), email, at: nowStamp(), title, text, read: false, link: link || '' });
      write('notifications', all);
    },
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
    /* size: bila diisi, hanya menghitung unit dengan ukuran tersebut. */
    bookedOn(productId, date, excludeId, size) {
      return DB.bookings().filter((b) => ACTIVE.includes(b.status) && b.id !== excludeId && b.start <= date && date <= b.end)
        .reduce((s, b) => s + b.items.reduce((t, it) => t + it.components.filter((c) => c.productId === productId && (size == null || c.size === size)).reduce((u, c) => u + c.qty * it.qty, 0), 0), 0);
    },
    availableOn(productId, date, excludeId, size) {
      const p = DB.product(productId); if (!p || !DB.isActiveProduct(p) || !condRentable(p.cond)) return 0;
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
    packageAvailable(pkgId, start, end) {
      const pk = DB.pkg(pkgId); if (!pk) return 0;
      return Math.min(...pk.items.map((i) => Math.floor(Rules.available(i.productId, start, end) / i.qty)));
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
      return Math.round(b.items.reduce((s, it) => s + it.pricePerDay * it.qty, 0) * lateDays * (st.lateFeePercent / 100));
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
    konfigurasi: { label: 'Konfigurasi sistem', tone: 'amber', icon: 'fa-sliders', group: 'data' },
    keuangan: { label: 'Keuangan', tone: 'green', icon: 'fa-wallet', group: 'transaksi' },
    ulasan: { label: 'Ulasan', tone: 'gray', icon: 'fa-star', group: 'data' },
    staff: { label: 'Manajemen staff', tone: 'blue', icon: 'fa-user-gear', group: 'data' },
    pengaturan: { label: 'Pengaturan', tone: 'amber', icon: 'fa-gear', group: 'data' },
    laporan: { label: 'Laporan', tone: 'gray', icon: 'fa-file-lines', group: 'lainnya' },
  };

  window.Ann = { DB, Rules, STATUS, AUDIT_TYPES, D: { day, today, addDays, rel, diffDays, toISO, fmtDate, fmtDateTime, fmtRange, nowStamp, BULAN, BULAN_PANJANG, HARI }, rupiah };
})();
