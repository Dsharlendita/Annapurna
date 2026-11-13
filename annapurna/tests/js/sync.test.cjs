// Uji lapisan sinkronisasi data.js di Node (browser tiruan).
// Jalankan dari folder annapurna:  node tests/js/sync.test.cjs
const assert = require('assert');
const { makeEnv } = require('./harness.cjs');
const root = require('path').resolve(__dirname, '../..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let responder = () => ({ ok: true, map: {} });
const env = makeEnv(root, {
  fetch: async (url, init) => { const j = responder(url, JSON.parse(init.body)); const status = j.__status || 200; return { ok: status < 400, status, json: async () => j }; },
});
const R = (src) => env.run(src);
const calls = () => env.fetchCalls.filter((c) => String(c.url).includes('api/sync/'));
const reset = () => { env.fetchCalls.length = 0; };
const setSession = (role, email) => R(`localStorage.setItem('annapurna:session', JSON.stringify({ role: '${role}', email: '${email}', name: 'Uji' }))`);
let pass = 0; const ok = (name, fn) => Promise.resolve(fn()).then(() => { pass++; console.log('  âœ“', name); });

(async () => {
  // Kunci sesi: pastikan prefix sama dengan data.js
  const sessKey = R(`(() => { Ann.DB.clearSession && Ann.DB.clearSession(); for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/session/.test(k)) return k; } return 'annapurna:session'; })()`);
  assert.strictEqual(sessKey, 'annapurna:session');

  const localUnitsBefore = R(`(Ann.DB.product('tnd-4') || {}).units ? Ann.DB.product('tnd-4').units.length : 0`);

  // 1. Data server masuk
  R(`Ann.DB.applyServer({ scope: 'public', clear: ['expenses', 'incomes', 'customerMeta'],
      settings: { dpPercent: 40, storeName: 'Toko Uji' },
      categories: [{ id: 'tenda', name: 'Tenda', img: '', active: true }],
      products: [{ id: 'tnd-4', name: 'Tenda 4 Server', cat: 'tenda', img: 'x.jpg', rent: 41000, rent3: 0, rent5: 0, price: 0, stock: 6, rating: 0, reviews: 0, cond: 'Baik', badge: '', featured: false, active: true, minDays: 1, specs: [], attrs: {} }],
      packages: [], promos: [{ id: 'PR-1', code: 'HEMAT', name: 'Hemat', desc: '', type: 'persen', value: 10, applies: 'rent', minTotal: 0, start: '2026-01-01', end: '2099-12-31', weekday: false, quota: 0, used: 3, active: true, home: true }],
      reviews: [] })`);
  await ok('produk, kategori, promo & pengaturan dari server dipakai tampilan', () => {
    assert.deepStrictEqual(R(`Ann.DB.products(true).map(p => p.id)`), ['tnd-4']);
    assert.strictEqual(R(`Ann.DB.product('tnd-4').name`), 'Tenda 4 Server');
    assert.strictEqual(R(`Ann.DB.product('tnd-4').units.length`), localUnitsBefore || 6);   // unit lokal dipertahankan
    assert.strictEqual(R(`Ann.DB.settings().dpPercent`), 40);
    assert.strictEqual(R(`Ann.DB.settings().storeName`), 'Toko Uji');
    assert.deepStrictEqual(R(`Ann.DB.promos().map(p => p.code)`), ['HEMAT']);
    assert.deepStrictEqual(R(`JSON.stringify(Ann.DB.expenses())`), '[]');
  });

  // 2. Tanpa login: tidak ada yang dikirim
  reset();
  R(`Ann.DB.savePromo(Object.assign({}, Ann.DB.promos()[0], { value: 15 }), 'uji', [])`);
  await wait(80);
  await ok('pengunjung tanpa login tidak mengirim apa pun', () => assert.strictEqual(calls().length, 0));

  // 3. Owner: hanya promo yang berubah yang dikirim, "used" dibuang
  setSession('owner', 'owner@annapurna.id'); reset();
  R(`Ann.DB.savePromo(Object.assign({}, Ann.DB.promos()[0], { value: 20 }), 'uji', [])`);
  await wait(80);
  await ok('owner: selisih promo terkirim ke api/sync/promos', () => {
    assert.strictEqual(calls().length, 1);
    const b = calls()[0].body; assert.ok(calls()[0].url.endsWith('api/sync/promos'));
    assert.strictEqual(b.items.length, 1); assert.strictEqual(b.items[0].value, 20); assert.ok(!('used' in b.items[0])); assert.deepStrictEqual(b.removed, []);
    assert.strictEqual(calls()[0].init.headers['X-CSRF-TOKEN'], 'tok');
  });

  // 4. Tidak ada perubahan â†’ tidak dikirim; perubahan unit saja â†’ tidak dikirim
  reset();
  R(`Ann.DB.savePromo(Object.assign({}, Ann.DB.promos()[0]), 'uji', [])`);
  R(`(() => { const all = JSON.parse(localStorage.getItem('annapurna:products')); all[0].units[0].notes = 'catatan unit'; localStorage.setItem('annapurna:products', JSON.stringify(all)); Ann.DB.saveProduct(all[0]); })()`);
  await wait(80);
  await ok('tanpa perubahan / hanya unit fisik berubah â†’ tidak ada kiriman', () => assert.strictEqual(calls().length, 0));

  // 5. Stok dikirim sebagai selisih
  reset();
  R(`Ann.DB.saveProduct(Object.assign({}, Ann.DB.product('tnd-4'), { stock: 8 }))`);
  await wait(80);
  await ok('stok terkirim dengan _stockFrom (selisih), unit fisik tidak ikut', () => {
    const it = calls()[0].body.items[0];
    assert.strictEqual(it._stockFrom, 6); assert.strictEqual(it.stock, 8); assert.ok(!('units' in it));
  });

  // 6. ID lokal diganti ID server
  reset();
  responder = (url) => (url.includes('reviews') ? { ok: true, map: { 'REV-1001': 'REV-37' } } : { ok: true, map: {} });
  R(`Ann.DB.saveReview({ id: 'REV-1001', refId: 'RNT-1', name: 'Budi', email: 'budi@mail.com', rating: 5, text: 'Mantap sekali', productIds: ['tnd-4'], visible: true, createdAt: '2026-11-13T10:00:00' })`);
  await wait(80);
  await ok('ID ulasan lokal diganti ID server', () => {
    assert.strictEqual(R(`!!Ann.DB.review('REV-37')`), true); assert.strictEqual(R(`!!Ann.DB.review('REV-1001')`), false);
  });
  reset(); await wait(80);
  await ok('setelah ganti ID tidak ada kiriman ulang', () => assert.strictEqual(calls().length, 0));

  // 7. Gagal â†’ pesan error & dikirim ulang pada penyimpanan berikutnya
  responder = () => ({ __status: 500, ok: false, msg: 'Server bermasalah' }); reset();
  const warned = []; env.win.UI = { toast: (m, t) => warned.push([m, t]) };
  R(`Ann.DB.savePromo(Object.assign({}, Ann.DB.promos()[0], { value: 25 }), 'uji', [])`);
  await wait(80);
  await ok('gagal kirim â†’ toast error', () => { assert.strictEqual(warned.length, 1); assert.ok(/promo belum tersimpan ke server: Server bermasalah/.test(warned[0][0])); assert.strictEqual(warned[0][1], 'err'); });
  responder = () => ({ ok: true, map: {} }); reset();
  R(`Ann.DB.saveCategory({ id: 'tenda', name: 'Tenda Camping' })`);
  R(`Ann.DB.savePromo(Object.assign({}, Ann.DB.promos()[0]), 'uji', [])`);
  await wait(80);
  await ok('perubahan yang gagal ikut terkirim lagi', () => {
    const promo = calls().find((c) => c.url.endsWith('promos')); assert.ok(promo); assert.strictEqual(promo.body.items[0].value, 25);
  });

  // 8. Customer: data staff tidak dikirim, ulasan & notifikasi dikirim
  setSession('customer', 'budi@mail.com'); reset();
  R(`Ann.DB.saveProduct(Object.assign({}, Ann.DB.product('tnd-4'), { name: 'Coba ubah' }))`);
  R(`Ann.DB.applyServer({ scope: 'user', email: 'budi@mail.com', notifications: [{ id: 'N5', email: 'budi@mail.com', at: '2026-11-13T09:00:00', title: 'Booking dikonfirmasi', text: '-', link: '', read: false }] })`);
  R(`Ann.DB.markRead('budi@mail.com', 'N5')`);
  await wait(80);
  await ok('customer: perubahan barang tidak dikirim, notifikasi dibaca terkirim', () => {
    assert.ok(!calls().some((c) => c.url.endsWith('products')));
    const n = calls().find((c) => c.url.endsWith('notifications')); assert.ok(n); assert.strictEqual(n.body.items[0].id, 'N5'); assert.strictEqual(n.body.items[0].read, true);
  });

  // 9. Data staff demo di browser customer dibersihkan
  await ok('status pelanggan demo di browser customer dikosongkan', () => assert.strictEqual(R(`JSON.stringify(JSON.parse(localStorage.getItem('annapurna:customerMeta')))`), '{}'));

  console.log(`\n${pass} uji lulus`);
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
