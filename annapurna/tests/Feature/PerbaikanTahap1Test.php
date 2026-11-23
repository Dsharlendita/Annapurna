<?php

namespace Tests\Feature;

use App\Models\Finance;
use App\Models\Promo;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Temuan laporan uji 23 Nov 2026 (Tahap 1): kasir, kode keuangan, restock, pesanan beli customer, promo, batas bayar, data publik. */
class PerbaikanTahap1Test extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;
    private User $cust;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert([['id' => 'jual', 'name' => 'Jual'], ['id' => 'tenda', 'name' => 'Tenda']]);
        DB::table('products')->insert([
            ['id' => 'jl-1', 'name' => 'Gas Kaleng', 'category_id' => 'jual', 'rent_price' => 0, 'sale_price' => 25000, 'stock' => 5, 'sku' => 'GAS'],
            ['id' => 'tnd-2', 'name' => 'Tenda 2P', 'category_id' => 'tenda', 'rent_price' => 30000, 'sale_price' => 0, 'stock' => 2, 'sku' => 'TND-2P'],
        ]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->owner = User::create(['name' => 'Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    public function test_penjualan_kasir_mencatat_pembayaran_pemasukan_dan_diskon(): void
    {
        $r = $this->actingAs($this->admin)->postJson('/api/sale', ['customer_name' => 'Umum', 'is_walk_in' => true, 'payment_method' => 'Tunai',
            'discount_amount' => 5000, 'discount_reason' => 'Langganan', 'items' => [['product_id' => 'jl-1', 'qty' => 2]]])->assertOk();
        $sale = Sale::where('sale_code', $r->json('sale.sale_code'))->first();
        $this->assertSame(45000, (int) $sale->total_amount, 'diskon kasir ikut dihitung');
        $this->assertSame(1, $sale->payments()->where('status', 'verified')->count());
        $this->assertSame(45000, (int) $sale->payments()->sum('amount'));
        $this->assertSame(1, Finance::where('type', 'income')->where('ref', $sale->nota_no)->count());
        // Penjualan kasir muncul di daftar admin lengkap dengan pembayaran (dulu kosong → Rp 0 di Keuangan)
        $row = collect($this->actingAs($this->admin)->getJson('/api/admin/sales')->json('data'))->firstWhere('id', $sale->sale_code);
        $this->assertNotEmpty($row['payments']);
    }

    public function test_diskon_manual_hanya_untuk_staf(): void
    {
        $r = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'discount_amount' => 20000, 'items' => [['product_id' => 'jl-1', 'qty' => 1]]])->assertOk();
        $this->assertSame(25000, (int) Sale::where('sale_code', $r->json('sale.sale_code'))->value('total_amount'));
    }

    public function test_kode_pengeluaran_dari_dua_perangkat_tidak_saling_menimpa(): void
    {
        $item = fn ($desc, $amt) => ['id' => 'EXP-1002', 'date' => now()->toDateString(), 'category' => 'Operasional', 'desc' => $desc, 'amount' => $amt, '_new' => true];
        $this->actingAs($this->admin)->postJson('/api/sync/expenses', ['items' => [$item('Bensin (Dita)', 50000)]])->assertOk();
        $r = $this->actingAs($this->owner)->postJson('/api/sync/expenses', ['items' => [$item('Listrik (Owner)', 200000)]])->assertOk();
        $newCode = $r->json('map.EXP-1002');
        $this->assertNotEmpty($newCode, 'catatan owner mendapat kode baru');
        $this->assertSame('Bensin (Dita)', Finance::where('finance_code', 'EXP-1002')->value('description'));
        $this->assertSame('Listrik (Owner)', Finance::where('finance_code', $newCode)->value('description'));
        // Kiriman ulang catatan yang sama dari staf yang sama tidak membuat baris ganda
        $this->actingAs($this->admin)->postJson('/api/sync/expenses', ['items' => [$item('Bensin (Dita)', 50000)]])->assertOk();
        $this->assertSame(2, Finance::where('source', 'manual')->count());
        // Mengubah catatan yang sudah ada (tanpa _new) tetap memperbarui baris yang sama
        $this->actingAs($this->admin)->postJson('/api/sync/expenses', ['items' => [['id' => 'EXP-1002', 'date' => now()->toDateString(), 'category' => 'Operasional', 'desc' => 'Bensin motor', 'amount' => 60000]]])->assertOk();
        $this->assertSame(60000, (int) Finance::where('finance_code', 'EXP-1002')->value('amount'));
    }

    public function test_restock_dari_aplikasi_tidak_membuat_unit_dan_pengeluaran_ganda(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/products/tnd-2/restock', ['qty' => 2, 'unit_cost' => 300000, 'kind' => 'rent',
            'expense_id' => 'EXP-1001', 'from_app' => true, 'unit_codes' => ['TND-2P-03', 'TND-2P-04']])->assertCreated();
        $this->assertSame(0, DB::table('product_units')->where('product_id', 'tnd-2')->count(), 'unit dibuat lewat sinkron barang, bukan di sini');
        $this->assertSame(2, (int) DB::table('products')->where('id', 'tnd-2')->value('stock'), 'stok ikut sinkron barang');
        $this->assertSame(0, Finance::count(), 'pengeluaran ikut sinkron keuangan');
        $this->assertSame(['TND-2P-03', 'TND-2P-04'], json_decode(DB::table('restocks')->value('unit_codes'), true));
    }

    public function test_customer_membatalkan_pesanan_beli_dan_menandai_diterima(): void
    {
        $code = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 2]]])->json('sale.sale_code');
        $this->assertSame(3, (int) DB::table('products')->where('id', 'jl-1')->value('stock'));
        // Orang lain tidak bisa membatalkan
        $lain = User::create(['name' => 'Lain', 'email' => 'lain@mail.com', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
        $this->actingAs($lain)->postJson("/api/pesanan/beli/{$code}/batal")->assertNotFound();
        $this->actingAs($this->cust)->postJson("/api/pesanan/beli/{$code}/batal")->assertOk()->assertJsonPath('data.status', 'dibatalkan');
        $this->assertSame(5, (int) DB::table('products')->where('id', 'jl-1')->value('stock'), 'stok kembali');
        $this->actingAs($this->cust)->postJson("/api/pesanan/beli/{$code}/batal")->assertStatus(422);

        // Diterima: hanya saat siap diambil & lunas
        $c2 = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 1]]])->json('sale.sale_code');
        $this->actingAs($this->cust)->postJson("/api/pesanan/beli/{$c2}/diterima")->assertStatus(422);
        $this->actingAs($this->admin)->postJson("/api/admin/sale/{$c2}/status", ['status' => 'lunas'])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/admin/sale/{$c2}/status", ['status' => 'siap_diambil'])->assertOk();
        $this->actingAs($this->cust)->postJson("/api/pesanan/beli/{$c2}/diterima")->assertOk()->assertJsonPath('data.status', 'selesai');
    }

    public function test_promo_berlaku_untuk_pesanan_beli(): void
    {
        Promo::create(['code' => 'HEMAT10', 'name' => 'Hemat', 'discount_type' => 'persen', 'discount_value' => 10, 'applies_to' => 'buy', 'is_active' => true]);
        $r = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'promo_code' => 'hemat10', 'items' => [['product_id' => 'jl-1', 'qty' => 2]]])->assertOk();
        $this->assertSame(45000, (int) Sale::where('sale_code', $r->json('sale.sale_code'))->value('total_amount'));
        $this->assertSame(1, (int) Promo::where('code', 'HEMAT10')->value('used_count'));
    }

    public function test_batas_bayar_bawaan_satu_jam_sama_dengan_tampilan(): void
    {
        $code = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 1]]])->json('sale.sale_code');
        $s = Sale::where('sale_code', $code)->first();
        $this->assertSame(60, (int) round($s->created_at->diffInMinutes($s->expired_at)));
    }

    public function test_data_publik_tidak_memuat_email_pemberi_ulasan(): void
    {
        DB::table('reviews')->insert(['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'rating' => 5, 'comment' => 'Mantap', 'is_visible' => true, 'created_at' => now(), 'updated_at' => now()]);
        $js = $this->get('/boot.js')->assertOk()->getContent();
        $this->assertStringNotContainsString('budi@mail.com', $js);
        $this->assertStringContainsString('Mantap', $js);
    }
}
