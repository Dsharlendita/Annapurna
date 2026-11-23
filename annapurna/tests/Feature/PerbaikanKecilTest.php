<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingService;
use App\Models\Review;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Perbaikan kecil: balasan ulasan dibaca, konfirmasi layanan via WhatsApp, versi data staf. */
class PerbaikanKecilTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $cust;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert(['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 40000, 'sale_price' => 25000, 'stock' => 5]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    public function test_balasan_ulasan_dibaca_customer_tersimpan_tanpa_menandai_ulasan_baru_bagi_staf(): void
    {
        $sale = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'tnd-4', 'qty' => 1]]])->json('sale.sale_code');
        $rv = ['id' => 'REV-new', 'refId' => $sale, 'type' => 'buy', 'name' => 'Budi', 'rating' => 5, 'text' => 'Bagus'];
        $id = $this->actingAs($this->cust)->postJson('/api/sync/reviews', ['items' => [$rv]])->assertOk()->json('map.REV-new');
        $rv['id'] = $id;
        // Staf membalas dan menandai ulasan sudah dilihat
        $this->actingAs($this->admin)->postJson('/api/sync/reviews', ['items' => [$rv + ['reply' => 'Terima kasih!', 'seen' => true, 'visible' => true, 'email' => 'budi@mail.com']]])->assertOk();
        $r = Review::find((int) substr($id, 4));
        $this->assertNotNull($r->seen_at);
        $js = fn () => $this->actingAs($this->admin)->get('/boot-staff.js?v=' . uniqid())->getContent();
        $this->assertStringContainsString('"replySeen":false', $js(), 'balasan baru = belum dibaca customer');
        // Customer membuka balasan → hanya "sudah dibaca" yang tersimpan
        $this->actingAs($this->cust)->postJson('/api/sync/reviews', ['items' => [$rv + ['replySeen' => true]]])->assertOk();
        $r = $r->fresh();
        $this->assertNotNull($r->reply_seen_at);
        $this->assertNotNull($r->seen_at, 'ulasan tidak kembali menjadi "baru" bagi staf');
        $this->assertStringContainsString('"replySeen":true', $js());
        // Staf mengubah balasan → customer perlu membaca lagi
        $this->travel(2)->seconds();
        $this->actingAs($this->admin)->postJson('/api/sync/reviews', ['items' => [$rv + ['reply' => 'Terima kasih banyak ya!', 'seen' => true, 'visible' => true, 'email' => 'budi@mail.com']]])->assertOk();
        $this->assertStringContainsString('"replySeen":false', $js());
        // Customer mengubah isi ulasannya → staf melihatnya sebagai baru lagi
        $this->actingAs($this->cust)->postJson('/api/sync/reviews', ['items' => [array_merge($rv, ['text' => 'Bagus banget', 'replySeen' => true])]])->assertOk();
        $this->assertNull($r->fresh()->seen_at);
    }

    public function test_customer_mengonfirmasi_layanan_dan_admin_melihat_tandanya(): void
    {
        $code = $this->actingAs($this->cust)->postJson('/api/booking', ['customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->addDays(3)->toDateString(), 'end_date' => now()->addDays(5)->toDateString(), 'delivery_mode' => 'antar', 'customer_address' => 'Jl. Gunung 1',
            'service' => ['address' => 'Jl. Gunung 1'], 'items' => [['product_id' => 'tnd-4', 'qty' => 1]]])->assertOk()->json('booking.booking_code');
        $row = fn () => collect($this->actingAs($this->admin)->getJson('/api/admin/bookings')->json('data'))->firstWhere('id', $code);
        $this->assertArrayNotHasKey('waAt', $row()['deliv']);
        // Orang lain tidak bisa
        $lain = User::create(['name' => 'Lain', 'email' => 'lain@mail.com', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
        $this->actingAs($lain)->postJson("/api/pesanan/{$code}/konfirmasi-layanan")->assertNotFound();
        $this->actingAs($this->cust)->postJson("/api/pesanan/{$code}/konfirmasi-layanan")->assertOk();
        $this->assertArrayHasKey('waAt', $row()['deliv']);
        $this->assertNotNull(BookingService::whereHas('booking', fn ($q) => $q->where('booking_code', $code))->value('customer_wa_at'));
        // Pesanan tanpa layanan → 404 (tidak ada yang dikonfirmasi)
        $tanpa = $this->actingAs($this->cust)->postJson('/api/booking', ['customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->addDays(8)->toDateString(), 'end_date' => now()->addDays(9)->toDateString(), 'items' => [['product_id' => 'tnd-4', 'qty' => 1]]])->json('booking.booking_code');
        $this->actingAs($this->cust)->postJson("/api/pesanan/{$tanpa}/konfirmasi-layanan")->assertNotFound();
    }

    public function test_konfirmasi_ongkir_pesanan_beli_diantar(): void
    {
        $code = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_email' => 'budi@mail.com', 'delivery_mode' => 'antar', 'address' => 'Jl. Gunung 1',
            'items' => [['product_id' => 'tnd-4', 'qty' => 1]]])->assertOk()->json('sale.sale_code');
        $this->actingAs($this->cust)->postJson("/api/pesanan/{$code}/konfirmasi-layanan")->assertOk();
        $row = collect($this->actingAs($this->admin)->getJson('/api/admin/sales')->json('data'))->firstWhere('id', $code);
        $this->assertArrayHasKey('waAt', $row['deliv']);
        $this->assertNotNull(Sale::where('sale_code', $code)->first()->delivery->customer_wa_at);
    }

    public function test_versi_data_staf_berubah_saat_staf_baru_atau_restock(): void
    {
        $v = fn () => \App\Http\Controllers\Annapurna\BootController::version('staff');
        $this->actingAs($this->admin);
        $a = $v();
        $this->travel(2)->seconds();
        User::create(['name' => 'Staf Baru', 'email' => 'baru@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $b = $v();
        $this->assertNotSame($a, $b, 'staf baru mengubah versi');
        $this->travel(2)->seconds();
        $this->postJson('/api/admin/products/tnd-4/restock', ['qty' => 1, 'unit_cost' => 1000, 'kind' => 'sale', 'from_app' => true])->assertCreated();
        $this->assertNotSame($b, $v(), 'restock baru mengubah versi');
    }
}
