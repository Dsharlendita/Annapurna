<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Pembaruan otomatis Pesanan Saya (customer): tanda perubahan pesanan & notifikasi milik akun itu saja. */
class PembaruanOtomatisTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $cust;
    private User $lain;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert(['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 40000, 'sale_price' => 0, 'stock' => 5]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
        $this->lain = User::create(['name' => 'Lain', 'email' => 'lain@mail.com', 'phone' => '0813', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    private function sig(User $u): string
    {
        return $this->actingAs($u)->getJson('/api/pesanan/denyut')->assertOk()->json('sig');
    }

    private function booking(User $u): string
    {
        return $this->actingAs($u)->postJson('/api/booking', ['customer_name' => $u->name, 'customer_phone' => '0812', 'customer_email' => $u->email,
            'start_date' => now()->addDays(3)->toDateString(), 'end_date' => now()->addDays(4)->toDateString(), 'items' => [['product_id' => 'tnd-4', 'qty' => 1]]])
            ->assertOk()->json('booking.booking_code');
    }

    public function test_tanda_berubah_saat_admin_memproses_pesanan_dan_hanya_untuk_pemiliknya(): void
    {
        $code = $this->booking($this->cust);
        $awal = $this->sig($this->cust);
        $this->assertSame($awal, $this->sig($this->cust), 'tanpa perubahan, tanda tetap');
        $lainAwal = $this->sig($this->lain);

        // Admin memverifikasi DP → tanda customer berubah (status pesanan + notifikasi)
        $this->travel(2)->seconds();
        $this->actingAs($this->admin)->postJson('/api/sync/notifications', ['items' => [['id' => 'n1', 'email' => 'budi@mail.com', 'title' => 'Booking dikonfirmasi', 'text' => 'ok', 'link' => 'pesanan']]])->assertOk();
        $berikut = $this->sig($this->cust);
        $this->assertNotSame($awal, $berikut, 'notifikasi baru mengubah tanda');
        $this->travel(2)->seconds();
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$code}/verifikasi", ['action' => 'terima'])->assertOk();
        $this->assertNotSame($berikut, $this->sig($this->cust), 'status pesanan berubah mengubah tanda');

        // Customer lain tidak terpengaruh
        $this->assertSame($lainAwal, $this->sig($this->lain));
    }

    public function test_endpoint_hanya_untuk_yang_login_dan_data_akun_berisi_notifikasi(): void
    {
        $this->getJson('/api/pesanan/denyut')->assertUnauthorized();
        $this->getJson('/api/akun/data')->assertUnauthorized();
        $this->actingAs($this->admin)->postJson('/api/sync/notifications', ['items' => [['id' => 'n1', 'email' => 'budi@mail.com', 'title' => 'Halo', 'text' => 'uji', 'link' => 'pesanan']]])->assertOk();
        $res = $this->actingAs($this->cust)->getJson('/api/akun/data')->assertOk();
        $this->assertSame(['Halo'], array_column($res->json('notifications'), 'title'));
    }
}
