<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\LaundryOrder;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Struktur database yang dirapikan (13 Nov 2026):
 * satu tabel pembayaran, nama pengaturan seragam, dan katalog dari seeder JSON.
 */
class DatabaseRapiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        $mk = fn ($name, $email, $role) => User::create(['name' => $name, 'email' => $email, 'phone' => '0812', 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
        $this->owner = $mk('Pemilik', 'owner@annapurna.id', 'owner');
    }

    public function test_pembayaran_laundry_masuk_tabel_payments(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/laundry', [
            'customer_name' => 'Sari', 'customer_phone' => '0813',
            'items' => [['name' => 'Tenda 2P Single Layer', 'price' => 25000, 'qty' => 2]],
            'pay_now' => 20000, 'payment_method' => 'QRIS',
        ])->assertSuccessful();

        $order = LaundryOrder::first();
        $this->assertSame('dp_paid', $order->payment_status);

        $p = Payment::where('laundry_order_id', $order->id)->sole();
        $this->assertSame(['DP', 20000, 'QRIS', 'verified', $this->admin->id], [$p->payment_type, $p->amount, $p->payment_method, $p->status, $p->verified_by]);
        $this->assertNull($p->booking_id);

        $this->actingAs($this->admin)->postJson("/api/admin/laundry/{$order->id}/bayar", ['amount' => 30000, 'payment_method' => 'Tunai'])->assertSuccessful();
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(50000, $order->fresh()->paid_amount);

        // Ringkasan bulan ini di halaman laundry membaca tabel yang sama
        $this->actingAs($this->admin)->getJson('/api/admin/laundry')->assertOk();
    }

    public function test_pembayaran_layanan_tidak_tercampur_dengan_pembayaran_sewa(): void
    {
        $b = Booking::create([
            'booking_code' => 'RNT-1', 'nota_no' => 'RNTL/001/XI/2026', 'customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'b@mail.com',
            'start_date' => now()->addDays(3)->toDateString(), 'end_date' => now()->addDays(5)->toDateString(), 'days' => 2,
            'subtotal' => 100000, 'total_amount' => 100000, 'dp_amount' => 50000, 'status' => 'dikonfirmasi', 'payment_status' => 'dp_paid',
        ]);
        $b->payments()->create(Payment::receivedInStore(50000, 'DP', 'Tunai', $this->admin->id));

        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-1/service', [
            'service_mode' => 'antar', 'address' => 'Baturraden', 'ongkir' => 40000, 'pay_now' => 40000, 'payment_method' => 'Tunai',
        ])->assertSuccessful();

        $svcPay = Payment::whereNotNull('booking_service_id')->sole();
        $this->assertSame(['Layanan', 40000], [$svcPay->payment_type, $svcPay->amount]);
        // Uang sewa yang tercatat untuk booking tetap 50.000 (ongkir tidak ikut terhitung sebagai DP/pelunasan)
        $this->assertSame(50000, (int) $b->payments()->sum('amount'));
    }

    public function test_pengaturan_owner_camelcase_dipakai_server(): void
    {
        $this->actingAs($this->owner)->postJson('/api/owner/konfigurasi', ['key' => 'cancelDays', 'value' => 5, 'action' => 'Ubah batas batal'])->assertOk();
        $this->actingAs($this->owner)->postJson('/api/owner/konfigurasi', ['key' => 'damageRules', 'value' => []])->assertOk();

        $this->assertSame(5, Setting::get('cancel_days'));
        $this->assertSame(5, Setting::get('cancelDays'));
        $this->assertSame([], Setting::get('damage_rules'));
        $this->assertDatabaseMissing('settings', ['key' => 'cancelDays']);
    }

    public function test_seeder_mengisi_katalog_yang_sama_dengan_tampilan(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(91, Product::count());
        $this->assertNotNull(Product::find('ck-capit'));          // ID produk dari data.js
        $this->assertSame(50, Setting::get('dp_percent'));
        $this->assertSame(1, Payment::count());                    // contoh booking dengan DP
        $this->assertSame(14, \App\Models\Category::where('is_active', true)->count());
    }
}
