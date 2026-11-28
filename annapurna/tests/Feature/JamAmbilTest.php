<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\PickupWindow;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Tanggal ambil online: tidak boleh lewat; setelah toko tutup (returnTime 22:00 WIB) paling cepat besok. Kasir bebas. */
class JamAmbilTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function at(string $wib): void
    {
        $t = Carbon::parse($wib, PickupWindow::TZ);
        Carbon::setTestNow($t);
        CarbonImmutable::setTestNow($t);
    }

    public function test_batas_tanggal_ambil_mengikuti_jam_tutup(): void
    {
        $this->at('2026-11-28 21:30');
        $this->assertSame('2026-11-28', PickupWindow::earliest());           // 20.00–22.00: hari ini masih boleh
        $this->assertNull(PickupWindow::reject('2026-11-28'));

        $this->at('2026-11-28 22:00');
        $this->assertSame('2026-11-29', PickupWindow::earliest());           // toko tutup: hari ini dikunci
        $this->assertStringContainsString('paling cepat besok', PickupWindow::reject('2026-11-28'));
        $this->assertNull(PickupWindow::reject('2026-11-29'));

        $this->at('2026-11-29 08:00');
        $this->assertStringContainsString('sebelum hari ini', PickupWindow::reject('2026-11-28'));

        \App\Models\Setting::set('returnTime', '21:00');                    // jam tutup ikut pengaturan toko
        $this->at('2026-11-29 21:15');
        $this->assertSame('2026-11-30', PickupWindow::earliest());
    }

    public function test_customer_ditolak_pesan_hari_ini_setelah_tutup_kasir_tidak(): void
    {
        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert(['id' => 'tnd-2', 'name' => 'Tenda 2P', 'category_id' => 'tenda', 'rent_price' => 30000, 'rent_price_3' => 0, 'rent_price_5' => 0, 'sale_price' => 0, 'stock' => 5, 'is_active' => true]);
        $budi = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
        $kasir = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'phone' => '0813', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $body = fn ($s, $e) => ['customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com', 'start_date' => $s, 'end_date' => $e, 'items' => [['product_id' => 'tnd-2', 'qty' => 1]]];

        $this->at('2026-11-28 22:30');
        $this->actingAs($budi)->postJson('/api/booking', $body('2026-11-28', '2026-11-29'))->assertStatus(422)->assertJsonPath('errors.start_date.0', fn ($m) => str_contains($m, 'paling cepat besok'));
        $this->actingAs($budi)->postJson('/api/booking', $body('2026-11-27', '2026-11-29'))->assertStatus(422);
        $this->actingAs($budi)->postJson('/api/booking', $body('2026-11-29', '2026-11-30'))->assertOk();
        $this->actingAs($kasir)->postJson('/api/booking', $body('2026-11-28', '2026-11-29') + ['is_walk_in' => true, 'payment_method' => 'Tunai'])->assertOk();   // kasir di toko
    }
}
