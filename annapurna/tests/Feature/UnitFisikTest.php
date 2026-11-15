<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Unit fisik barang sewa tersimpan di server dan sama di semua perangkat admin. */
class UnitFisikTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert([
            ['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 40000, 'stock' => 2],
            ['id' => 'tnd-2', 'name' => 'Tenda 2P', 'category_id' => 'tenda', 'rent_price' => 30000, 'stock' => 1],
        ]);
        DB::table('product_units')->insert(['product_id' => 'tnd-2', 'unit_code' => 'TND2-01', 'status' => 'tersedia', 'condition' => 'Baik']);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
    }

    private function boot(): array
    {
        preg_match('/applyServer\((.*)\);\s*$/s', $this->actingAs($this->admin)->get('/boot-staff.js?v=' . uniqid())->assertOk()->getContent(), $m);

        return json_decode($m[1], true);
    }

    public function test_unit_dari_tampilan_tersimpan_dan_terkirim_ke_perangkat_lain(): void
    {
        $units = [
            ['code' => 'TND4-01', 'cond' => 'Baik', 'status' => 'aktif', 'out' => 'RNT-9', 'rents' => 5, 'log' => [['at' => '2026-11-15T09:00:00', 'text' => 'Keluar untuk RNT-9', 'by' => 'Dita']]],
            ['code' => 'TND4-02', 'cond' => 'Kotor', 'status' => 'aktif', 'care' => 'cuci', 'careInfo' => ['since' => '2026-11-14T16:00:00', 'by' => 'Dita']],
            ['code' => 'TND2-01', 'cond' => 'Baik', 'status' => 'aktif'],          // milik barang lain → dilewati
        ];
        $this->actingAs($this->admin)->postJson('/api/sync/products', ['items' => [['id' => 'tnd-4', 'name' => 'Tenda 4P', 'cat' => 'tenda', 'rent' => 40000, 'stock' => 2, 'units' => $units]]])
            ->assertOk()->assertJsonPath('skipped.0', 'TND2-01');

        $u1 = ProductUnit::where('unit_code', 'TND4-01')->first();
        $u2 = ProductUnit::where('unit_code', 'TND4-02')->first();
        $this->assertSame(['disewa', 'RNT-9', 5], [$u1->status, $u1->out_ref, $u1->rents_count]);
        $this->assertSame(['perawatan', 'cuci', 'Kotor'], [$u2->status, $u2->care, $u2->condition]);
        $this->assertSame('tnd-2', ProductUnit::where('unit_code', 'TND2-01')->value('product_id'));

        // Perangkat admin lain menerima unit yang sama
        $p = collect($this->boot()['products'])->firstWhere('id', 'tnd-4');
        $this->assertSame(['TND4-01', 'TND4-02'], array_column($p['units'], 'code'));
        $this->assertSame(['aktif', 'RNT-9', 'Keluar untuk RNT-9'], [$p['units'][0]['status'], $p['units'][0]['out'], $p['units'][0]['log'][0]['text']]);
        $this->assertSame('cuci', $p['units'][1]['care']);
    }

    public function test_barang_keluar_dan_kembali_mencatat_unit_di_server(): void
    {
        ProductUnit::create(['product_id' => 'tnd-4', 'unit_code' => 'TND4-01', 'status' => 'tersedia', 'condition' => 'Baik']);
        $b = Booking::create([
            'booking_code' => 'RNT-1', 'customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'b@mail.com',
            'start_date' => now()->toDateString(), 'end_date' => now()->addDays(2)->toDateString(), 'days' => 2,
            'subtotal' => 80000, 'total_amount' => 80000, 'dp_amount' => 40000, 'status' => 'dikonfirmasi', 'payment_status' => 'dp_paid',
        ]);
        $b->items()->create(['product_id' => 'tnd-4', 'product_name' => 'Tenda 4P', 'qty' => 1, 'price_per_day' => 40000, 'subtotal' => 80000]);

        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-1/pickup', ['condition' => 'Baik', 'unit_ids' => ['0' => [['pid' => 'tnd-4', 'code' => 'TND4-01']]]])->assertOk();
        $u = ProductUnit::where('unit_code', 'TND4-01')->first();
        $this->assertSame(['disewa', 'RNT-1'], [$u->status, $u->out_ref]);

        // Unit yang sedang keluar tidak bisa dipakai booking lain
        $b2 = Booking::create(['booking_code' => 'RNT-2', 'customer_name' => 'Sari', 'customer_phone' => '0813', 'customer_email' => 's@mail.com',
            'start_date' => now()->toDateString(), 'end_date' => now()->addDay()->toDateString(), 'days' => 1, 'subtotal' => 40000, 'total_amount' => 40000, 'status' => 'dikonfirmasi', 'payment_status' => 'lunas']);
        $b2->items()->create(['product_id' => 'tnd-4', 'product_name' => 'Tenda 4P', 'qty' => 1, 'price_per_day' => 40000, 'subtotal' => 40000]);
        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-2/pickup', ['condition' => 'Baik', 'unit_ids' => ['0' => [['pid' => 'tnd-4', 'code' => 'TND4-01']]]])->assertStatus(422);

        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-1/return', ['condition' => 'Baik', 'unit_results' => ['TND4-01' => ['res' => 'cuci']]])->assertOk();
        $u->refresh();
        $this->assertSame(['perawatan', null, 'cuci'], [$u->status, $u->out_ref, $u->care]);
    }
}
