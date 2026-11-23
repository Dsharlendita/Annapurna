<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Status pesanan beli disimpan di server (dulu hanya di browser admin), dan stok online tidak terhitung dua kali. */
class StatusPenjualanTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $cust;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'jual', 'name' => 'Jual']);
        DB::table('products')->insert(['id' => 'jl-1', 'name' => 'Gas Kaleng', 'category_id' => 'jual', 'rent_price' => 0, 'sale_price' => 25000, 'stock' => 5]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    private function stock(): int
    {
        return (int) DB::table('products')->where('id', 'jl-1')->value('stock');
    }

    /** Customer membeli 2 barang lalu mengunggah bukti; mengembalikan kode pesanan. */
    private function beliDanUnggah(bool $unggah = true): string
    {
        $code = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 2]]])
            ->assertOk()->json('sale.sale_code');
        if ($unggah) {
            $this->actingAs($this->cust)->post('/api/pembayaran/upload', ['sale_id' => $code, 'payment_type' => 'Penjualan', 'amount' => 50000, 'proof_file' => UploadedFile::fake()->image('bukti.jpg')], ['Accept' => 'application/json'])->assertOk();
        }

        return $code;
    }

    private function aksi(string $code, string $status, array $extra = [])
    {
        return $this->actingAs($this->admin)->postJson("/api/admin/sale/{$code}/status", ['status' => $status] + $extra);
    }

    private function statusCustomer(string $code): ?string
    {
        return collect($this->actingAs($this->cust)->getJson('/api/pesanan')->json('data.sales'))->firstWhere('id', $code)['status'] ?? null;
    }

    public function test_batal_oleh_admin_terlihat_customer_dan_stok_kembali(): void
    {
        $code = $this->beliDanUnggah();
        $this->assertSame(3, $this->stock(), 'stok dikurangi saat memesan');

        $this->aksi($code, 'dibatalkan', ['reason' => 'Stok rusak'])->assertOk()->assertJsonPath('data.status', 'dibatalkan');

        $this->assertSame('dibatalkan', $this->statusCustomer($code));
        $this->assertSame(5, $this->stock(), 'stok dikembalikan');
        $this->assertSame('rejected', Payment::where('sale_id', Sale::where('sale_code', $code)->value('id'))->value('status'));
        $this->assertSame('Stok rusak', Sale::where('sale_code', $code)->value('cancel_reason'));
        $this->assertSame('unpaid', Sale::where('sale_code', $code)->value('payment_status'), 'bukti ditolak → belum dibayar');

        // Sudah batal: tidak bisa diubah lagi, stok tidak dikembalikan dua kali
        $this->aksi($code, 'dibatalkan')->assertStatus(422);
        $this->assertSame(5, $this->stock());
    }

    public function test_verifikasi_lalu_alur_status_sampai_selesai(): void
    {
        $code = $this->beliDanUnggah();
        $this->aksi($code, 'dikemas')->assertStatus(422);                 // belum lunas
        $this->aksi($code, 'lunas')->assertOk()->assertJsonPath('data.status', 'diproses')->assertJsonPath('data.paymentStatus', 'paid');
        $this->assertSame(1, DB::table('finances')->where('ref', Sale::where('sale_code', $code)->value('nota_no'))->count(), 'pemasukan tercatat sekali');
        $this->assertSame(3, $this->stock(), 'verifikasi tidak mengurangi stok lagi');

        $this->aksi($code, 'lunas')->assertStatus(422);                    // tidak dobel
        $this->aksi($code, 'dikemas')->assertOk();
        $this->aksi($code, 'siap_diambil')->assertOk();
        $this->aksi($code, 'dikemas')->assertStatus(422);                 // tidak mundur
        $this->aksi($code, 'selesai')->assertOk();
        $this->assertSame('selesai', $this->statusCustomer($code));
    }

    public function test_tandai_lunas_tanpa_bukti_dan_tolak_bukti(): void
    {
        $tanpa = $this->beliDanUnggah(false);
        $this->aksi($tanpa, 'lunas', ['payment_method' => 'Tunai'])->assertOk()->assertJsonPath('data.paymentStatus', 'paid');
        $this->assertSame('verified', Payment::where('sale_id', Sale::where('sale_code', $tanpa)->value('id'))->value('status'));

        $tolak = $this->beliDanUnggah();
        $this->aksi($tolak, 'tolak_bukti', ['reason' => 'Nominal kurang'])->assertOk()
            ->assertJsonPath('data.status', 'menunggu_pembayaran')->assertJsonPath('data.paymentStatus', 'unpaid');
        $this->assertNotNull(Sale::where('sale_code', $tolak)->value('expired_at'), 'batas bayar baru');
        $this->aksi($tolak, 'tolak_bukti')->assertStatus(422);            // tidak ada bukti lagi
    }

    public function test_customer_tidak_boleh_mengubah_status(): void
    {
        $code = $this->beliDanUnggah();
        $this->actingAs($this->cust)->postJson("/api/admin/sale/{$code}/status", ['status' => 'dibatalkan'])->assertForbidden();
    }

    public function test_batal_otomatis_karena_tidak_dibayar_mengembalikan_stok(): void
    {
        $code = $this->beliDanUnggah(false);
        $this->assertSame(3, $this->stock());
        Sale::where('sale_code', $code)->update(['expired_at' => now()->subMinute()]);
        $this->artisan('bookings:expire-unpaid')->assertSuccessful();
        $this->assertSame('dibatalkan', Sale::where('sale_code', $code)->value('status'));
        $this->assertSame(5, $this->stock());
    }
}
