<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingExtension;
use App\Models\Finance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Daftar penjualan untuk admin, perpanjangan sewa & ganti barang
 * (customer mengajukan → admin menyetujui, atau admin mencatat langsung di toko).
 */
class PermintaanPesananTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $budi;
    private User $sari;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert([
            ['id' => 'tnd-2', 'name' => 'Tenda 2P', 'category_id' => 'tenda', 'rent_price' => 30000, 'rent_price_3' => 0, 'rent_price_5' => 0, 'sale_price' => 0, 'stock' => 5, 'is_active' => true],
            ['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 40000, 'rent_price_3' => 0, 'rent_price_5' => 0, 'sale_price' => 0, 'stock' => 5, 'is_active' => true],
            ['id' => 'matras', 'name' => 'Matras', 'category_id' => 'tenda', 'rent_price' => 5000, 'rent_price_3' => 0, 'rent_price_5' => 0, 'sale_price' => 0, 'stock' => 20, 'is_active' => true],
            ['id' => 'gas', 'name' => 'Gas', 'category_id' => 'tenda', 'rent_price' => 0, 'rent_price_3' => 0, 'rent_price_5' => 0, 'sale_price' => 15000, 'stock' => 10, 'is_active' => true],
        ]);
        DB::table('packages')->insert(['id' => 'pk-2p', 'name' => 'Paket 2P', 'price_per_day' => 50000, 'price_3' => 0, 'price_5' => 0]);
        DB::table('package_items')->insert([['package_id' => 'pk-2p', 'product_id' => 'tnd-2', 'qty' => 1], ['package_id' => 'pk-2p', 'product_id' => 'matras', 'qty' => 2]]);

        $mk = fn ($name, $email, $role) => User::create(['name' => $name, 'email' => $email, 'phone' => '0812', 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
        $this->budi = $mk('Budi', 'budi@mail.com', 'customer');
        $this->sari = $mk('Sari', 'sari@mail.com', 'customer');
    }

    /** Booking 2 malam yang sudah dikonfirmasi. */
    private function booking(array $items): Booking
    {
        $res = $this->actingAs($this->budi)->postJson('/api/booking', [
            'customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->addDays(5)->toDateString(), 'end_date' => now()->addDays(7)->toDateString(), 'items' => $items,
        ])->assertOk();
        $b = Booking::where('booking_code', $res->json('booking.booking_code'))->firstOrFail();
        $b->update(['status' => 'dikonfirmasi', 'payment_status' => 'dp_paid']);

        return $b->fresh();
    }

    public function test_admin_melihat_semua_penjualan_dari_server(): void
    {
        $this->actingAs($this->budi)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_phone' => '0813', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'gas', 'qty' => 1]]])->assertOk();
        $this->actingAs($this->admin)->postJson('/api/sale', ['customer_name' => 'Umum', 'is_walk_in' => true, 'payment_method' => 'Tunai', 'items' => [['product_id' => 'gas', 'qty' => 2]]])->assertOk();

        $this->actingAs($this->budi)->getJson('/api/admin/sales')->assertForbidden();
        $rows = $this->actingAs($this->admin)->getJson('/api/admin/sales')->assertOk()->json('data');
        $this->assertCount(2, $rows);
        $this->assertEqualsCanonicalizing(['online', 'offline'], array_column($rows, 'channel'));
    }

    public function test_customer_ajukan_perpanjangan_lalu_admin_setujui(): void
    {
        $b = $this->booking([['product_id' => 'tnd-4', 'qty' => 1]]);
        $to = now()->addDays(9)->toDateString();

        $this->actingAs($this->sari)->postJson("/api/pesanan/{$b->booking_code}/perpanjang", ['to_date' => $to])->assertNotFound();
        $res = $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/perpanjang", ['to_date' => $to, 'reason' => 'Cuaca buruk', 'cost' => 1])->assertOk();
        $ext = $res->json('data.extensions.0');
        $this->assertSame(['menunggu', 2, 80000, 'customer'], [$ext['status'], $ext['days'], $ext['cost'], $ext['source']]);   // biaya dihitung server
        $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/perpanjang", ['to_date' => $to])->assertStatus(422);   // masih ada yang menunggu

        $res = $this->actingAs($this->admin)->postJson("/api/admin/permintaan/extend/{$ext['id']}/action", ['action' => 'setujui'])->assertOk();
        $res->assertJsonPath('data.end', $to)->assertJsonPath('data.extensions.0.status', 'disetujui');
        $this->assertSame((int) $b->total_amount + 80000, (int) $b->fresh()->total_amount);
    }

    public function test_perpanjangan_di_toko_langsung_disetujui_dan_dibayar(): void
    {
        $b = $this->booking([['product_id' => 'tnd-4', 'qty' => 1]]);
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/perpanjang", ['to_date' => now()->addDays(8)->toDateString(), 'is_paid' => true])
            ->assertOk()->assertJsonPath('data.extensions.0.source', 'toko')->assertJsonPath('data.extensions.0.status', 'disetujui');
        $this->assertSame(1, $b->payments()->where('payment_type', 'Perpanjangan')->where('amount', 40000)->count());
        $this->assertSame(1, Finance::where('category', 'Perpanjangan Sewa')->count());
    }

    public function test_biaya_perpanjangan_paket_dihitung_sekali_bukan_per_komponen(): void
    {
        $b = $this->booking([['product_id' => 'pk-2p', 'qty' => 1]]);
        $this->assertSame(2, $b->items()->count());                       // paket disimpan sebagai baris per komponen (tenda + matras)
        // 2 malam → 5 malam. Catatan: aturan toko menghitung 2 malam sebagai paket 3 hari, jadi +1 malam bisa gratis.
        $res = $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/perpanjang", ['to_date' => now()->addDays(10)->toDateString()])->assertOk();
        $t = \App\Support\RentalPricing::packageTiers(\App\Models\Package::find('pk-2p'));
        $expected = \App\Support\RentalPricing::lineTotal($t, 5) - \App\Support\RentalPricing::lineTotal($t, 2);
        $this->assertGreaterThan(0, $expected);
        $this->assertSame($expected, $res->json('data.extensions.0.cost'));  // tarif paket, dihitung sekali (bukan per komponen)
    }

    public function test_ganti_barang_customer_lalu_disetujui_dan_ganti_di_toko(): void
    {
        $b = $this->booking([['product_id' => 'tnd-2', 'qty' => 1], ['product_id' => 'matras', 'qty' => 2]]);

        $res = $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/ganti", ['from_id' => 'tnd-2', 'to_id' => 'tnd-4', 'qty' => 1, 'reason' => 'Ikut 4 orang'])->assertOk();
        $c = $res->json('data.changes.0');
        $this->assertSame(['menunggu', 20000, 'tnd-2', 0], [$c['status'], $c['diff'], $c['fromId'], $c['lineIndex']]);   // (40.000 − 30.000) × 2 malam

        $this->actingAs($this->admin)->postJson("/api/admin/permintaan/change/{$c['id']}/action", ['action' => 'setujui'])->assertOk()
            ->assertJsonPath('data.changes.0.status', 'disetujui');
        $this->assertTrue($b->items()->where('product_id', 'tnd-4')->exists());
        $this->assertSame((int) $b->total_amount + 20000, (int) $b->fresh()->total_amount);

        // Ganti di toko: langsung disetujui + selisih dibayar
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/ganti", ['from_id' => 'matras', 'to_id' => 'tnd-2', 'qty' => 2, 'paid_now' => true])
            ->assertOk()->assertJsonPath('data.changes.1.source', 'toko');
        $this->assertSame(1, Finance::where('category', 'Selisih Ganti Barang')->count());

        // Barang yang tidak ada di booking / barang jual ditolak
        $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/ganti", ['from_id' => 'gas', 'to_id' => 'tnd-4', 'qty' => 1])->assertStatus(422);
        $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/ganti", ['from_id' => 'tnd-2', 'to_id' => 'gas', 'qty' => 1])->assertStatus(422);
    }

    public function test_permintaan_ditolak_dan_booking_selesai_tidak_bisa_diperpanjang(): void
    {
        $b = $this->booking([['product_id' => 'tnd-4', 'qty' => 1]]);
        $ext = $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/perpanjang", ['to_date' => now()->addDays(8)->toDateString()])->json('data.extensions.0');
        $this->actingAs($this->admin)->postJson("/api/admin/permintaan/extend/{$ext['id']}/action", ['action' => 'tolak', 'reason' => 'Unit dipakai'])
            ->assertOk()->assertJsonPath('data.extensions.0.status', 'ditolak');
        $this->assertSame($b->end_date->toDateString(), $b->fresh()->end_date->toDateString());

        $b->update(['status' => 'selesai']);
        $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/perpanjang", ['to_date' => now()->addDays(9)->toDateString()])->assertStatus(422);
        $this->assertSame(1, BookingExtension::count());
    }
}
