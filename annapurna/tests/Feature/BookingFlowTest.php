<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Finance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Alur booking sewa: checkout → daftar admin → upload bukti → verifikasi/tolak → batal,
 * semuanya lewat database (bukan localStorage).
 */
class BookingFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $budi;
    private User $sari;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        Storage::fake('public');

        DB::table('categories')->insert(['id' => 'cooking', 'name' => 'Cooking']);
        DB::table('products')->insert([
            ['id' => 'ck-capit', 'name' => 'Capitan', 'category_id' => 'cooking', 'rent_price' => 5000, 'rent_price_3' => 9000, 'rent_price_5' => 13000, 'stock' => 8],
            ['id' => 'tnd-2', 'name' => 'Tenda 2P', 'category_id' => 'cooking', 'rent_price' => 30000, 'rent_price_3' => 0, 'rent_price_5' => 0, 'stock' => 3],
        ]);
        DB::table('packages')->insert(['id' => 'pk-1', 'name' => 'Paket Hemat', 'price_per_day' => 32000, 'price_3' => 60000, 'price_5' => 90000]);
        DB::table('package_items')->insert([
            ['package_id' => 'pk-1', 'product_id' => 'tnd-2', 'qty' => 1],
            ['package_id' => 'pk-1', 'product_id' => 'ck-capit', 'qty' => 2],
        ]);

        $mk = fn ($name, $email, $role) => User::create(['name' => $name, 'email' => $email, 'phone' => '0812', 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
        $this->budi = $mk('Budi', 'budi@mail.com', 'customer');
        $this->sari = $mk('Sari', 'sari@mail.com', 'customer');
    }

    private function checkout(User $u, array $items, array $extra = []): Booking
    {
        $res = $this->actingAs($u)->postJson('/api/booking', array_merge([
            'customer_name' => $u->name, 'customer_phone' => '0812', 'customer_email' => $u->email,
            'start_date' => now()->addDays(10)->toDateString(), 'end_date' => now()->addDays(12)->toDateString(),
            'items' => $items,
        ], $extra));
        $res->assertOk();

        return Booking::where('booking_code', $res->json('booking.booking_code'))->firstOrFail();
    }

    public function test_harga_dihitung_server_dengan_tarif_berjenjang_dan_input_harga_browser_diabaikan(): void
    {
        // 2 malam = paket 3 hari (aturan mitra): 9.000, bukan 2 × 5.000 dan bukan harga kiriman browser
        $b = $this->checkout($this->budi, [['product_id' => 'ck-capit', 'qty' => 2, 'price_per_day' => 1]], [
            'status' => 'dikonfirmasi', 'payment_status' => 'lunas', 'is_walk_in' => true,
        ]);

        $this->assertSame(18000, $b->subtotal);
        $this->assertSame(9000, $b->dp_amount);
        $this->assertSame('menunggu_pembayaran', $b->status);
        $this->assertSame('unpaid', $b->payment_status);
        $this->assertSame('online', $b->channel);
        $this->assertMatchesRegularExpression('/^RNT-\d{8}-\d{4}$/', $b->booking_code);
    }

    public function test_paket_memakai_harga_paket(): void
    {
        $b = $this->checkout($this->budi, [['product_id' => 'pk-1', 'qty' => 1]]);
        $this->assertSame(60000, $b->subtotal); // 2 malam → tarif paket 3 hari
        $this->assertSame(2, $b->items()->count());
    }

    public function test_admin_melihat_booking_dari_database_dalam_bentuk_fe(): void
    {
        $b = $this->checkout($this->budi, [['product_id' => 'ck-capit', 'qty' => 1]]);

        $res = $this->actingAs($this->admin)->getJson('/api/admin/bookings')->assertOk();
        $row = collect($res->json('data'))->firstWhere('id', $b->booking_code);
        $this->assertNotNull($row);
        $this->assertSame('budi@mail.com', $row['customer']['email']);
        $this->assertSame('ck-capit', $row['items'][0]['refId']);
        $this->assertSame(9000, $row['total']);

        $this->actingAs($this->budi)->getJson('/api/admin/bookings')->assertForbidden();
    }

    public function test_upload_bukti_hanya_untuk_pemilik_lalu_admin_verifikasi_sekali(): void
    {
        $b = $this->checkout($this->budi, [['product_id' => 'ck-capit', 'qty' => 1]]);
        $upload = fn (User $u) => $this->actingAs($u)->post('/api/pembayaran/upload', [
            'booking_id' => $b->booking_code, 'payment_type' => 'DP', 'amount' => 4500,
            'proof_file' => UploadedFile::fake()->image('bukti.jpg'),
        ], ['Accept' => 'application/json']);

        $upload($this->sari)->assertForbidden();
        $upload($this->budi)->assertOk();
        $this->assertSame('menunggu_konfirmasi', $b->fresh()->status);

        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/verifikasi", ['action' => 'terima'])
            ->assertOk()->assertJsonPath('data.status', 'dikonfirmasi')->assertJsonPath('data.paymentStatus', 'dp_paid');
        // Klik kedua tidak mencatat pemasukan dobel
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/verifikasi", ['action' => 'terima'])
            ->assertStatus(422);
        $this->assertSame(1, Finance::where('ref', $b->nota_no)->count());
    }

    public function test_tolak_bukti_mengembalikan_ke_menunggu_pembayaran(): void
    {
        $b = $this->checkout($this->budi, [['product_id' => 'ck-capit', 'qty' => 1]]);
        $this->actingAs($this->budi)->post('/api/pembayaran/upload', [
            'booking_id' => $b->booking_code, 'payment_type' => 'DP', 'amount' => 4500,
            'proof_file' => UploadedFile::fake()->image('bukti.jpg'),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/verifikasi", ['action' => 'tolak', 'reason' => 'Nominal kurang'])
            ->assertOk()->assertJsonPath('data.status', 'menunggu_pembayaran')->assertJsonPath('data.proof', null);
        $this->assertNotNull($b->fresh()->expired_at);
    }

    public function test_customer_hanya_bisa_membatalkan_dan_melihat_booking_sendiri(): void
    {
        $b = $this->checkout($this->budi, [['product_id' => 'ck-capit', 'qty' => 1]]);
        $this->checkout($this->sari, [['product_id' => 'ck-capit', 'qty' => 1]]);

        $this->actingAs($this->sari)->postJson("/api/pesanan/{$b->booking_code}/batal", ['reason' => 'iseng'])->assertNotFound();

        $mine = $this->actingAs($this->budi)->getJson('/api/pesanan')->assertOk()->json('data.bookings');
        $this->assertCount(1, $mine);

        $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/batal", ['reason' => 'Jadwal diundur'])
            ->assertOk()->assertJsonPath('data.status', 'dibatalkan');
        $this->actingAs($this->budi)->postJson("/api/pesanan/{$b->booking_code}/batal", ['reason' => 'lagi'])->assertStatus(422);
    }

    public function test_admin_batal_setelah_dp_dibayar_mencatat_refund(): void
    {
        $b = $this->checkout($this->budi, [['product_id' => 'ck-capit', 'qty' => 1]]);
        // "Tandai DP dibayar" tanpa bukti
        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/verifikasi", ['action' => 'terima'])->assertOk();

        $this->actingAs($this->admin)->postJson("/api/admin/booking/{$b->booking_code}/batal", ['reason' => 'Permintaan customer', 'dp_mode' => 'refund'])
            ->assertOk()->assertJsonPath('data.paymentStatus', 'refund_pending')->assertJsonPath('data.cancel.refundStatus', 'menunggu');
        $this->assertSame(4500, $b->refund()->first()->amount);
    }
}
