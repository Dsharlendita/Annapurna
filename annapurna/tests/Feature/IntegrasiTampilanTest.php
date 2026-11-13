<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CustomerFlag;
use App\Models\Finance;
use App\Models\Product;
use App\Models\Promo;
use App\Models\Review;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use App\Http\Controllers\Annapurna\BootController;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Tahap 2: data yang dulu hanya di browser sekarang dari / ke server
 * (boot.js, boot-staff.js, POST api/sync/{koleksi}).
 */
class IntegrasiTampilanTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;
    private User $budi;
    private User $sari;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        Storage::fake('public');

        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda', 'is_active' => true]);
        DB::table('products')->insert([
            ['id' => 'tnd-2', 'name' => 'Tenda 2P', 'category_id' => 'tenda', 'rent_price' => 30000, 'sale_price' => 0, 'cost_price' => 500000, 'stock' => 10],
            ['id' => 'gas', 'name' => 'Gas Kaleng', 'category_id' => 'tenda', 'rent_price' => 0, 'sale_price' => 15000, 'cost_price' => 11000, 'stock' => 10],
        ]);
        $mk = fn ($name, $email, $role, $phone = '0812') => User::create(['name' => $name, 'email' => $email, 'phone' => $phone, 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->owner = $mk('Pemilik', 'owner@annapurna.id', 'owner');
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
        $this->budi = $mk('Budi', 'budi@mail.com', 'customer', '081311112222');
        $this->sari = $mk('Sari', 'sari@mail.com', 'customer', '081399998888');
    }

    /** Isi objek yang dikirim boot.js ke DB.applyServer(...) */
    private function boot(string $url): array
    {
        $res = $this->get($url)->assertOk();
        $this->assertStringContainsString('application/javascript', $res->headers->get('Content-Type'));
        $this->assertTrue(preg_match('/applyServer\((.*)\);\s*$/s', $res->getContent(), $m) === 1);

        return json_decode($m[1], true);
    }

    private function sync(User $u, string $col, array $items, array $removed = [])
    {
        return $this->actingAs($u)->postJson("/api/sync/{$col}", ['items' => $items, 'removed' => $removed]);
    }

    private function booking(User $u): Booking
    {
        return Booking::create([
            'booking_code' => 'RNT-' . $u->id, 'user_id' => $u->id, 'customer_name' => $u->name, 'customer_phone' => $u->phone, 'customer_email' => $u->email,
            'start_date' => now()->addDays(3)->toDateString(), 'end_date' => now()->addDays(5)->toDateString(), 'days' => 2,
            'subtotal' => 60000, 'total_amount' => 60000, 'status' => 'selesai', 'payment_status' => 'lunas',
        ]);
    }

    // ------------------------------------------------------------------ boot.js

    public function test_boot_publik_tanpa_harga_modal_dan_pengaturan_rahasia(): void
    {
        Setting::set('dp_percent', 40);
        Setting::set('integration', ['ownerEmail' => 'rahasia@toko.id']);
        Review::create(['customer_name' => 'A', 'rating' => 5, 'comment' => 'Bagus sekali alatnya', 'is_visible' => true, 'product_ids' => ['tnd-2']]);
        Review::create(['customer_name' => 'B', 'rating' => 1, 'comment' => 'Disembunyikan admin', 'is_visible' => false]);

        $snap = $this->boot('/boot.js?v=1');

        $this->assertSame(40, $snap['settings']['dpPercent']);
        $this->assertArrayNotHasKey('integration', $snap['settings']);
        $this->assertArrayNotHasKey('cost', collect($snap['products'])->firstWhere('id', 'gas'));
        $this->assertCount(1, $snap['reviews']);
        $this->assertSame(['tnd-2'], $snap['reviews'][0]['productIds']);
        $this->assertContains('customerMeta', $snap['clear']);
        $this->assertStringContainsString('public', $this->get('/boot.js?v=1')->headers->get('Cache-Control'));
    }

    public function test_boot_staff_hanya_untuk_staff_dan_berisi_data_staff(): void
    {
        $this->actingAs($this->budi)->get('/boot-staff.js')->assertForbidden();

        CustomerFlag::create(['email' => 'nakal@mail.com', 'flag' => 'blacklist', 'note' => 'Barang hilang']);
        Finance::create(['finance_code' => 'EXP-9', 'type' => 'expense', 'category' => 'Listrik', 'amount' => 200000, 'transaction_date' => now(), 'description' => 'Token listrik', 'source' => 'manual']);
        Finance::create(['finance_code' => 'INC-10', 'type' => 'income', 'category' => 'Rental', 'amount' => 50000, 'transaction_date' => now(), 'description' => 'DP otomatis', 'source' => 'otomatis']);
        Setting::set('integration', ['ownerEmail' => 'rahasia@toko.id']);

        $snap = $this->actingAs($this->admin)->boot('/boot-staff.js?v=1');
        $this->assertSame(11000, collect($snap['products'])->firstWhere('id', 'gas')['cost']);
        $this->assertSame('blacklist', $snap['customerMeta']['nakal@mail.com']['flag']);
        $this->assertSame(['EXP-9'], array_column($snap['expenses'], 'id'));
        $this->assertSame([], $snap['incomes']);               // pemasukan otomatis tidak ikut (dihitung dari pesanan)
        $this->assertSame([], $snap['settings']);              // pengaturan rahasia hanya untuk Owner

        $owner = $this->actingAs($this->owner)->boot('/boot-staff.js?v=2');
        $this->assertSame('rahasia@toko.id', $owner['settings']['integration']['ownerEmail']);
    }

    public function test_versi_boot_berubah_saat_data_berubah(): void
    {
        $v1 = BootController::version();
        $this->sync($this->admin, 'products', [['id' => 'tnd-2', 'name' => 'Tenda 2P Baru', 'cat' => 'tenda', 'rent' => 35000, 'stock' => 10]])->assertOk();
        $this->assertNotSame($v1, BootController::version());
    }

    // ------------------------------------------------------------------ Katalog

    public function test_staff_simpan_barang_baru_dengan_foto_customer_ditolak(): void
    {
        $png = 'data:image/png;base64,' . base64_encode(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='));
        $item = ['id' => 'p75', 'name' => 'Kursi Lipat', 'cat' => 'kursi', 'rent' => 10000, 'rent3' => 25000, 'stock' => 4, 'img' => $png, 'active' => true,
            'specs' => ['Ringan'], 'attrs' => ['at-bahan' => 'Aluminium'], 'minStock' => 2, 'serviceEvery' => 5, 'units' => [['code' => 'KRS-01']]];

        $this->sync($this->budi, 'products', [$item])->assertForbidden();
        $this->sync($this->admin, 'products', [$item])->assertOk();

        $p = Product::find('p75');
        $this->assertSame([10000, 25000, 4, 2, 5], [$p->rent_price, $p->rent_price_3, $p->stock, $p->min_stock, $p->service_every]);
        $this->assertSame('Kursi', $p->category->name);            // kategori baru dibuat otomatis
        $this->assertStringStartsWith('storage/products/', $p->img);
        Storage::disk('public')->assertExists(substr($p->img, strlen('storage/')));
    }

    public function test_stok_dikirim_sebagai_selisih_dan_penjualan_kasir_tidak_dikurangi_dua_kali(): void
    {
        // Customer membeli 2 secara online → server mengurangi stok (10 → 8)
        $this->actingAs($this->budi)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_phone' => '0813', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'gas', 'qty' => 2]]])->assertOk();
        $this->assertSame(8, Product::find('gas')->stock);

        // Owner di perangkat lain masih melihat 10, lalu mengoreksi stok -1 (10 → 9): hasilnya 8 − 1 = 7, bukan 9
        $this->sync($this->owner, 'products', [['id' => 'gas', 'name' => 'Gas Kaleng', 'cat' => 'tenda', 'price' => 15000, 'stock' => 9, '_stockFrom' => 10]])->assertOk();
        $this->assertSame(7, Product::find('gas')->stock);

        // Penjualan kasir (staff): server tidak mengurangi, stok ikut dari sinkronisasi barang
        $this->actingAs($this->admin)->postJson('/api/sale', ['customer_name' => 'Umum', 'is_walk_in' => true, 'payment_method' => 'Tunai', 'items' => [['product_id' => 'gas', 'qty' => 1]]])->assertOk();
        $this->assertSame(7, Product::find('gas')->stock);
        $this->sync($this->admin, 'products', [['id' => 'gas', 'name' => 'Gas Kaleng', 'cat' => 'tenda', 'price' => 15000, 'stock' => 6, '_stockFrom' => 7]])->assertOk();
        $this->assertSame(6, Product::find('gas')->stock);
    }

    // ------------------------------------------------------------------ Promo

    public function test_promo_baru_mendapat_id_server_dan_jumlah_pakai_dihitung_server(): void
    {
        $res = $this->sync($this->owner, 'promos', [['id' => 'PR-mhx1abc', 'code' => 'camp20', 'name' => 'Camping 20', 'type' => 'persen', 'value' => 20, 'applies' => 'rent',
            'start' => now()->subDay()->toDateString(), 'end' => now()->addMonth()->toDateString(), 'quota' => 5, 'used' => 99, 'active' => true, 'home' => true]])->assertOk();
        $promo = Promo::where('code', 'CAMP20')->sole();
        $res->assertJsonPath('map.PR-mhx1abc', 'PR-' . $promo->id);
        $this->assertSame(0, $promo->used_count);                  // "used" dari browser diabaikan

        // Booking dengan promo → diskon dari server + kuota terpakai
        $this->actingAs($this->budi)->postJson('/api/booking', [
            'customer_name' => 'Budi', 'customer_phone' => '081311112222', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->addDays(10)->toDateString(), 'end_date' => now()->addDays(12)->toDateString(),
            'items' => [['product_id' => 'tnd-2', 'qty' => 1]], 'promo_code' => 'camp20',
        ])->assertOk();
        $this->assertSame(1, $promo->fresh()->used_count);
        $this->assertGreaterThan(0, Booking::latest('id')->first()->discount_amount);
    }

    // ------------------------------------------------------------------ Ulasan

    public function test_ulasan_customer_untuk_transaksinya_sendiri_dan_moderasi_staff(): void
    {
        $b = $this->booking($this->budi);
        $mine = ['id' => 'REV-1001', 'refId' => $b->booking_code, 'name' => 'Budi', 'rating' => 5, 'text' => 'Tendanya bersih dan kokoh', 'productIds' => ['tnd-2'], 'featured' => true, 'reply' => 'hack'];

        // Sari tidak boleh menulis ulasan untuk booking Budi
        $this->sync($this->sari, 'reviews', [$mine])->assertOk()->assertJsonPath('skipped.0', 'REV-1001');
        $this->assertSame(0, Review::count());

        $res = $this->sync($this->budi, 'reviews', [$mine])->assertOk();
        $r = Review::sole();
        $res->assertJsonPath('map.REV-1001', 'REV-' . $r->id);
        $this->assertSame([$this->budi->id, $b->id, false, null], [$r->user_id, $r->booking_id, $r->is_featured, $r->reply]);   // featured & balasan dari customer diabaikan

        // Admin menampilkan di beranda & membalas
        $this->sync($this->admin, 'reviews', [array_merge($mine, ['id' => 'REV-' . $r->id, 'featured' => true, 'order' => 0, 'reply' => 'Terima kasih Kak!', 'seen' => true])])->assertOk();
        $r->refresh();
        $this->assertTrue($r->is_featured);
        $this->assertSame([$this->admin->id, true], [$r->replied_by, $r->reply_at !== null]);
    }

    // ------------------------------------------------------------------ Keuangan manual

    public function test_pengeluaran_manual_tersimpan_dengan_kode_tampilan_dan_tidak_bentrok(): void
    {
        Finance::create(['finance_code' => 'EXP-1002', 'type' => 'expense', 'category' => 'Refund DP', 'amount' => 1, 'transaction_date' => now(), 'description' => 'otomatis', 'source' => 'otomatis']);

        $res = $this->sync($this->admin, 'expenses', [
            ['id' => 'EXP-1001', 'date' => '2026-11-13', 'category' => 'Listrik', 'desc' => 'Token listrik', 'amount' => 150000, 'line' => 'umum'],
            ['id' => 'EXP-1002', 'date' => '2026-11-13', 'category' => 'Perawatan Alat', 'desc' => 'Jahit tenda', 'amount' => 40000, 'line' => 'rent'],
        ])->assertOk();

        $this->assertSame('manual', Finance::where('finance_code', 'EXP-1001')->value('source'));
        $newCode = $res->json('map.EXP-1002');                   // kode bentrok dengan baris otomatis → kode baru
        $this->assertNotNull($newCode);
        $this->assertSame('Jahit tenda', Finance::where('finance_code', $newCode)->value('description'));

        // Dibatalkan: tercatat siapa & kapan, lalu tidak bisa diaktifkan lagi
        $this->sync($this->admin, 'expenses', [['id' => 'EXP-1001', 'date' => '2026-11-13', 'category' => 'Listrik', 'desc' => 'Token listrik', 'amount' => 150000, 'status' => 'dibatalkan', 'voidReason' => 'Salah input']])->assertOk();
        $this->sync($this->admin, 'expenses', [['id' => 'EXP-1001', 'date' => '2026-11-13', 'category' => 'Listrik', 'desc' => 'Token listrik', 'amount' => 150000, 'status' => 'aktif']])->assertOk();
        $f = Finance::where('finance_code', 'EXP-1001')->first();
        $this->assertSame(['dibatalkan', 'Salah input', $this->admin->id], [$f->status, $f->void_reason, $f->voided_by]);
    }

    public function test_restock_dari_tampilan_tidak_mencatat_pengeluaran_dan_stok_dua_kali(): void
    {
        // Tampilan: pengeluaran EXP-1005 tersinkron + POST restock dengan expense_id yang sama
        $this->sync($this->admin, 'expenses', [['id' => 'EXP-1005', 'date' => '2026-11-13', 'category' => 'Pembelian Barang', 'desc' => 'Restock Gas', 'amount' => 55000, 'line' => 'sale']])->assertOk();
        $this->actingAs($this->admin)->postJson('/api/admin/products/gas/restock', ['qty' => 5, 'unit_cost' => 11000, 'kind' => 'sale', 'expense_id' => 'EXP-1005'])->assertSuccessful();

        $this->assertSame(1, Finance::where('category', 'Pembelian Barang')->count());
        $this->assertSame(10, Product::find('gas')->stock);        // stok ditambah lewat sinkronisasi barang, bukan di sini
        $this->assertSame(Finance::where('finance_code', 'EXP-1005')->value('id'), DB::table('restocks')->value('finance_id'));
    }

    // ------------------------------------------------------------------ Pelanggan diblokir

    public function test_pelanggan_diblokir_owner_tidak_bisa_pesan_online_lewat_email_maupun_nomor_hp(): void
    {
        $this->sync($this->owner, 'customerMeta', ['budi@mail.com' => ['flag' => 'blacklist', 'note' => 'Tenda hilang']])->assertOk();
        $this->assertSame('081311112222', CustomerFlag::where('email', 'budi@mail.com')->value('phone'));

        $order = fn (User $u, string $email, string $phone) => $this->actingAs($u)->postJson('/api/booking', [
            'customer_name' => 'X', 'customer_phone' => $phone, 'customer_email' => $email,
            'start_date' => now()->addDays(10)->toDateString(), 'end_date' => now()->addDays(12)->toDateString(),
            'items' => [['product_id' => 'tnd-2', 'qty' => 1]],
        ]);

        $order($this->budi, 'budi@mail.com', '081311112222')->assertStatus(422)->assertJsonPath('field', 'customer_email');
        $order($this->sari, 'lain@mail.com', '+62 813-1111-2222')->assertStatus(422);     // nomor HP yang sama
        $order($this->sari, 'sari@mail.com', '081399998888')->assertOk();
        $order($this->admin, 'budi@mail.com', '081311112222')->assertOk();               // kasir tetap boleh melayani di toko
    }

    // ------------------------------------------------------------------ Pengaturan

    public function test_admin_hanya_boleh_ubah_profil_toko_owner_boleh_semua(): void
    {
        $this->sync($this->admin, 'settings', ['storeName' => 'Annapurna Purwokerto', 'dpPercent' => 10])->assertOk()->assertJsonPath('skipped.0', 'dpPercent');
        $this->assertSame('Annapurna Purwokerto', Setting::get('store_name'));
        $this->assertNull(Setting::get('dp_percent'));

        $this->sync($this->owner, 'settings', ['dpPercent' => 30, 'cancelDays' => 3])->assertOk();
        $this->assertSame([30, 3], [Setting::get('dp_percent'), Setting::get('cancel_days')]);
    }

    // ------------------------------------------------------------------ Notifikasi

    public function test_notifikasi_lintas_perangkat(): void
    {
        // Customer mengabari staff (bukti DP masuk); tidak boleh mengirim ke customer lain
        $this->sync($this->budi, 'notifications', [
            ['id' => 'n1', 'email' => 'dita@annapurna.id', 'title' => 'Bukti DP masuk', 'text' => 'Budi mengunggah bukti DP', 'link' => 'admin/booking'],
            ['id' => 'n2', 'email' => 'sari@mail.com', 'title' => 'Spam', 'text' => 'x'],
        ])->assertOk()->assertJsonPath('skipped.0', 'n2');
        // Notifikasi sama yang belum dibaca digabung
        $this->sync($this->budi, 'notifications', [['id' => 'n3', 'email' => 'dita@annapurna.id', 'title' => 'Bukti DP masuk', 'text' => 'Budi mengunggah bukti DP lagi', 'link' => 'admin/booking']])->assertOk();

        $n = UserNotification::where('user_id', $this->admin->id)->sole();
        $this->assertSame(2, $n->count);

        // Admin melihatnya di perangkat lain, menandai dibaca, lalu menghapus
        $this->actingAs($this->admin);
        $data = BootController::userData();
        $this->assertSame('N' . $n->id, $data['notifications'][0]['id']);
        $this->sync($this->budi, 'notifications', [['id' => 'N' . $n->id, 'read' => true]])->assertOk();
        $this->assertNull($n->fresh()->read_at);                   // bukan pemiliknya
        $this->sync($this->admin, 'notifications', [['id' => 'N' . $n->id, 'email' => 'dita@annapurna.id', 'read' => true]])->assertOk();
        $this->assertNotNull($n->fresh()->read_at);
        $this->sync($this->admin, 'notifications', [], ['N' . $n->id])->assertOk();
        $this->assertSame(0, UserNotification::count());
    }

    public function test_jenis_data_tidak_dikenal_dan_tamu_ditolak(): void
    {
        $this->postJson('/api/sync/products', ['items' => []])->assertUnauthorized();
        $this->sync($this->owner, 'users', [])->assertNotFound();
    }
}
