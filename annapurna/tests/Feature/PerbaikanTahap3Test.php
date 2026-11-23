<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingService;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Temuan laporan uji (Tahap 3): pelunasan & piutang, layanan antar/tenda, jaminan, stok per ukuran, riwayat restock, hak admin. */
class PerbaikanTahap3Test extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $cust;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert([['id' => 'tenda', 'name' => 'Tenda'], ['id' => 'baju', 'name' => 'Baju']]);
        DB::table('products')->insert([
            ['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 40000, 'sale_price' => 0, 'stock' => 3, 'deposit' => 100000],
            ['id' => 'kaos', 'name' => 'Kaos', 'category_id' => 'baju', 'rent_price' => 0, 'sale_price' => 80000, 'stock' => 5, 'deposit' => 0],
        ]);
        Product::whereKey('kaos')->update(['variant_data' => ['label' => 'Ukuran', 'options' => [['name' => 'M', 'stock' => 2], ['name' => 'L', 'stock' => 3]]]]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    private function booking(array $extra = []): string
    {
        return $this->actingAs($this->cust)->postJson('/api/booking', $extra + [
            'customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->addDays(3)->toDateString(), 'end_date' => now()->addDays(5)->toDateString(),
            'items' => [['product_id' => 'tnd-4', 'qty' => 2]],
        ])->assertOk()->json('booking.booking_code');
    }

    public function test_jaminan_dihitung_server_diterima_dan_dikembalikan(): void
    {
        $code = $this->booking();
        $b = Booking::where('booking_code', $code)->first();
        $this->assertSame(200000, (int) $b->deposit_amount, 'jaminan 2 × 100.000');
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/verifikasi", ['action' => 'terima'])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/pickup", ['deposit_in' => 200000])->assertOk();
        $this->assertSame(200000, $b->fresh()->deposit_in['amount']);
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/return", ['total_fine' => 20000, 'pay_fine' => 20000, 'payment_method' => 'Potong jaminan', 'deposit_back' => 180000, 'deposit_deducted' => 20000])->assertOk();
        $this->assertSame([180000, 20000], [$b->fresh()->deposit_out['amount'], $b->fresh()->deposit_out['deducted']]);
        // Perangkat admin lain melihat jaminannya
        $row = collect($this->actingAs($this->admin)->getJson('/api/admin/bookings')->json('data'))->firstWhere('id', $code);
        $this->assertSame([200000, 200000, 180000], [$row['deposit'], $row['depositIn']['amount'], $row['depositOut']['amount']]);
    }

    public function test_pelunasan_menghapus_piutang_dan_menjadi_lunas(): void
    {
        $code = $this->booking();
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/verifikasi", ['action' => 'terima'])->assertOk();   // DP dicatat
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/pickup", [])->assertOk();
        // Bayar saat kembali: selama disewa bukan piutang
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/settle", ['settle_later' => true, 'piutang_amount' => 999])->assertOk();
        $this->assertSame(0, (int) Booking::where('booking_code', $code)->value('piutang_amount'));
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/return", [])->assertOk();
        // Kembali tanpa dibayar → piutang = sisa sebenarnya (dihitung server)
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/settle", ['settle_later' => true, 'piutang_amount' => 1])->assertOk();
        $b = Booking::where('booking_code', $code)->first();
        $sisa = (int) $b->total_amount - (int) $b->payments()->where('status', 'verified')->sum('amount');
        $this->assertSame($sisa, (int) $b->piutang_amount);
        // Pelunasan piutang (tanda "nanti" masih terkirim) → lunas & piutang hilang
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/settle", ['settle_later' => true, 'payment_amount' => $sisa, 'payment_method' => 'Tunai'])->assertOk();
        $b = $b->fresh();
        $this->assertSame(['lunas', 0, false], [$b->payment_status, (int) $b->piutang_amount, (bool) $b->settle_later]);
    }

    public function test_layanan_dari_checkout_dan_isi_ongkir_tidak_menghapus_jadwal(): void
    {
        $code = $this->booking(['delivery_mode' => 'pasang', 'customer_address' => 'Jl. Gunung 1',
            'service' => ['address' => 'Jl. Gunung 1', 'scheduled_time' => '08:00', 'back_time' => '17:00', 'tents_count' => 2]]);
        $svc = BookingService::whereHas('booking', fn ($q) => $q->where('booking_code', $code))->first();
        $this->assertSame(['menunggu', 2, '08:00'], [$svc->status, (int) $svc->tents_count, $svc->scheduled_time]);
        $row = collect($this->actingAs($this->admin)->getJson('/api/admin/bookings')->json('data'))->firstWhere('id', $code);
        $this->assertArrayNotHasKey('ongkir', $row['deliv'], 'ongkir belum disepakati');
        // Isi ongkir + bayar (tanpa mengirim jadwal & jumlah tenda)
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/service", ['service_mode' => 'pasang', 'fee' => 50000, 'ongkir' => 30000, 'pay_now' => 60000, 'payment_method' => 'Tunai'])->assertOk();
        $svc = $svc->fresh();
        $this->assertSame([2, '08:00', '17:00', 'dijadwalkan'], [(int) $svc->tents_count, $svc->scheduled_time, $svc->back_time, $svc->status]);
        $row = collect($this->actingAs($this->admin)->getJson('/api/admin/bookings')->json('data'))->firstWhere('id', $code);
        $this->assertSame([30000, 50000], [$row['deliv']['ongkir'], $row['deliv']['jasa']]);
        $this->assertSame([['pasang', 50000], ['ongkir', 10000]], array_map(fn ($x) => [$x['kind'], $x['amount']], $row['svc']));
        // Kembali ke ambil di toko (tidak bisa bila sudah ada pembayaran layanan → layanan tetap)
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/service", ['service_mode' => 'ambil'])->assertOk();
        $this->assertSame('ambil', Booking::where('booking_code', $code)->value('delivery_mode'));
    }

    public function test_stok_per_ukuran_berkurang_dan_kembali_saat_batal(): void
    {
        $code = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'kaos', 'qty' => 2, 'size' => 'M']]])->assertOk()->json('sale.sale_code');
        $p = Product::find('kaos');
        $this->assertSame([0, 3], [$p->variant_data['options'][0]['stock'], (int) $p->stock]);
        $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'kaos', 'qty' => 1, 'size' => 'M']]])->assertStatus(422);
        $this->actingAs($this->cust)->postJson("/api/pesanan/beli/{$code}/batal")->assertOk();
        $p = $p->fresh();
        $this->assertSame([2, 5], [$p->variant_data['options'][0]['stock'], (int) $p->stock]);
    }

    public function test_stok_ukuran_dari_perangkat_staf_dikirim_sebagai_selisih(): void
    {
        // Pesanan online mengurangi M di server: 2 → 1
        $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'kaos', 'qty' => 1, 'size' => 'M']]])->assertOk();
        // Staf (data lama: M=2) menambah L: 3 → 5. M tidak boleh kembali ke 2.
        $this->actingAs($this->admin)->postJson('/api/sync/products', ['items' => [['id' => 'kaos', 'name' => 'Kaos', 'cat' => 'baju', 'price' => 80000, 'stock' => 7, '_stockFrom' => 5,
            'variant' => ['label' => 'Ukuran', 'options' => [['name' => 'M', 'stock' => 2], ['name' => 'L', 'stock' => 5]]], '_variantFrom' => ['M' => 2, 'L' => 3]]]])->assertOk();
        $p = Product::find('kaos');
        $this->assertSame([1, 5, 6], [$p->variant_data['options'][0]['stock'], $p->variant_data['options'][1]['stock'], (int) $p->stock]);
    }

    public function test_admin_boleh_menambah_nilai_varian_dan_riwayat_restock_terkirim(): void
    {
        $r = $this->actingAs($this->admin)->postJson('/api/sync/settings', ['items' => ['attributes' => [['id' => 'ukuran', 'name' => 'Ukuran', 'values' => ['S', 'M', 'L', 'XL']]]]])->assertOk();
        $this->assertSame([], $r->json('skipped'));
        $this->actingAs($this->admin)->postJson('/api/admin/products/tnd-4/restock', ['qty' => 1, 'unit_cost' => 500000, 'kind' => 'rent', 'from_app' => true, 'unit_codes' => ['TND-4P-04']])->assertCreated();
        $js = $this->actingAs($this->admin)->get('/boot-staff.js?v=y')->getContent();
        $this->assertStringContainsString('"restocks":[{', $js);
        $this->assertStringContainsString('TND-4P-04', $js);
    }
}
