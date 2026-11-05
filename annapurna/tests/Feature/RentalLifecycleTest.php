<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingExtension;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Siklus sewa setelah DP: barang keluar → pelunasan → kembali (denda) → perpanjangan → refund.
 * Setiap tes di sini GAGAL pada kode sebelum perbaikan 5 Nov 2026 (error 500 / data tidak tersimpan).
 */
class RentalLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);

        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert(['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 50000, 'stock' => 2]);
        DB::table('product_units')->insert([
            ['product_id' => 'tnd-4', 'unit_code' => 'TND4-01', 'status' => 'tersedia'],
            ['product_id' => 'tnd-4', 'unit_code' => 'TND4-02', 'status' => 'disewa'],
        ]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'phone' => '0812', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
    }

    /** Booking 2 malam Rp100.000, DP Rp50.000 sudah diverifikasi. */
    private function booking(string $status = 'dikonfirmasi', string $code = 'RNT-20261105-0001'): Booking
    {
        $b = Booking::create([
            'booking_code' => $code, 'nota_no' => 'RNTL/001/XI/2026', 'customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->toDateString(), 'end_date' => now()->addDays(2)->toDateString(), 'days' => 2,
            'subtotal' => 100000, 'total_amount' => 100000, 'dp_amount' => 50000, 'status' => $status, 'payment_status' => 'dp_paid',
        ]);
        $b->items()->create(['product_id' => 'tnd-4', 'product_name' => 'Tenda 4P', 'qty' => 1, 'price_per_day' => 50000, 'subtotal' => 100000]);
        Payment::create(['booking_id' => $b->id, 'payment_type' => 'DP', 'amount' => 50000, 'status' => 'verified']);

        return $b;
    }

    private function adminPost(string $url, array $body = [])
    {
        return $this->actingAs($this->admin)->postJson($url, $body);
    }

    // ---- Masalah 4: FE mengirim kode RNT-…, dulu server hanya terima angka → error 500 ----

    public function test_barang_keluar_memakai_kode_booking_dan_format_unit_dari_frontend(): void
    {
        $this->booking();

        $this->adminPost('/api/admin/booking/RNT-20261105-0001/pickup', [
            'condition' => 'Baik',
            'unit_ids' => ['0' => [['pid' => 'tnd-4', 'code' => 'TND4-01']]],
        ])->assertOk()->assertJsonPath('data.status', 'disewa');

        $this->assertSame('disewa', ProductUnit::where('unit_code', 'TND4-01')->value('status'));
    }

    public function test_unit_yang_sedang_disewa_orang_lain_ditolak_dan_tidak_ada_yang_berubah(): void
    {
        $b = $this->booking();

        $this->adminPost('/api/admin/booking/RNT-20261105-0001/pickup', [
            'unit_ids' => ['0' => [['pid' => 'tnd-4', 'code' => 'TND4-02']]],
        ])->assertStatus(422);

        $this->assertSame('dikonfirmasi', $b->fresh()->status);
    }

    public function test_barang_tidak_boleh_keluar_sebelum_dp_diverifikasi(): void
    {
        $this->booking('menunggu_konfirmasi');
        $this->adminPost('/api/admin/booking/RNT-20261105-0001/pickup')->assertStatus(422);
    }

    // ---- Masalah 2: Payment::create memakai nama kolom yang salah → error 500 ----

    public function test_pelunasan_di_kasir_tercatat_sebagai_pembayaran_dan_pemasukan_kas(): void
    {
        $this->booking();

        $this->adminPost('/api/admin/booking/RNT-20261105-0001/settle', ['payment_amount' => 50000, 'payment_method' => 'Tunai'])->assertOk();

        $this->assertSame(1, Payment::where('payment_type', 'Pelunasan')->where('amount', 50000)->count());
        $this->assertSame(50000, (int) Finance::where('type', 'income')->sum('amount'));
    }

    // ---- Masalah 1: status 'paid' tidak dikenal kolom bookings → pengembalian booking lunas selalu gagal ----

    public function test_pengembalian_booking_lunas_berhasil_dan_tetap_lunas(): void
    {
        $b = $this->booking('disewa');
        Payment::create(['booking_id' => $b->id, 'payment_type' => 'Pelunasan', 'amount' => 50000, 'status' => 'verified']);

        $this->adminPost('/api/admin/booking/RNT-20261105-0001/return', ['condition' => 'Baik'])
            ->assertOk()->assertJsonPath('data.status', 'selesai')->assertJsonPath('data.paymentStatus', 'lunas');
    }

    public function test_denda_dipotong_dari_jaminan_tercatat_dan_unit_rusak_masuk_perawatan(): void
    {
        $b = $this->booking('disewa');
        Payment::create(['booking_id' => $b->id, 'payment_type' => 'Pelunasan', 'amount' => 50000, 'status' => 'verified']);
        $unit = ProductUnit::where('unit_code', 'TND4-02')->first();
        $b->items()->first()->update(['product_unit_id' => $unit->id]);

        $this->adminPost('/api/admin/booking/RNT-20261105-0001/return', [
            'late_days' => 1, 'late_fee' => 25000, 'total_fine' => 25000,
            'pay_fine' => 25000, 'payment_method' => 'Potong jaminan',
            'unit_results' => ['TND4-02' => ['res' => 'perbaikan', 'issue' => 'Frame patah']],
        ])->assertOk()->assertJsonPath('data.paymentStatus', 'lunas')->assertJsonPath('data.total', 125000);

        $this->assertSame(1, Payment::where('payment_type', 'Denda')->count());
        $unit->refresh();
        $this->assertSame('perawatan', $unit->status);
        $this->assertSame('Frame patah', $unit->notes);
    }

    public function test_denda_belum_dibayar_membuat_status_tidak_lunas(): void
    {
        $b = $this->booking('disewa');
        Payment::create(['booking_id' => $b->id, 'payment_type' => 'Pelunasan', 'amount' => 50000, 'status' => 'verified']);

        $this->adminPost('/api/admin/booking/RNT-20261105-0001/return', ['total_fine' => 25000])
            ->assertOk()->assertJsonPath('data.paymentStatus', 'dp_paid');
    }

    public function test_pengembalian_tidak_bisa_diproses_dua_kali(): void
    {
        $this->booking('disewa');
        $this->adminPost('/api/admin/booking/RNT-20261105-0001/return')->assertOk();
        $this->adminPost('/api/admin/booking/RNT-20261105-0001/return')->assertStatus(422);
    }

    // ---- Masalah 3: jenis pembayaran 'Perpanjangan' tidak dikenal → perpanjangan berbayar gagal ----

    public function test_perpanjangan_berbayar_tersimpan_masuk_kas_dan_tidak_bisa_disetujui_dua_kali(): void
    {
        $b = $this->booking('disewa');
        $ext = BookingExtension::create(['booking_id' => $b->id, 'from_date' => $b->end_date, 'to_date' => now()->addDays(3)->toDateString(), 'days' => 1, 'cost' => 50000]);

        $this->adminPost("/api/admin/permintaan/extend/{$ext->id}/action", ['action' => 'setujui', 'is_paid' => true])->assertOk();
        $this->assertSame(1, Payment::where('payment_type', 'Perpanjangan')->count());
        $this->assertSame(50000, (int) Finance::where('category', 'Perpanjangan Sewa')->sum('amount'));
        $this->assertSame(150000, $b->fresh()->total_amount);

        // Klik kedua: ditolak, total tidak bertambah lagi
        $this->adminPost("/api/admin/permintaan/extend/{$ext->id}/action", ['action' => 'setujui', 'is_paid' => true])->assertStatus(422);
        $this->assertSame(150000, $b->fresh()->total_amount);
    }

    public function test_permintaan_dengan_id_lokal_frontend_mendapat_404_bukan_error_500(): void
    {
        $this->adminPost('/api/admin/permintaan/extend/EXT-1730790000/action', ['action' => 'setujui'])->assertNotFound();
        $this->adminPost('/api/admin/permintaan/change/CHG-1730790000/action', ['action' => 'setujui'])->assertNotFound();
    }

    // ---- Refund: kode booking, tidak boleh ganda / melebihi uang masuk, tercatat sebagai pengeluaran ----

    public function test_refund_memakai_kode_booking_dan_mencatat_pengeluaran_sekali(): void
    {
        $b = $this->booking();
        $b->update(['status' => 'dibatalkan', 'payment_status' => 'refund_pending']);

        $this->adminPost('/api/admin/permintaan/refund/RNT-20261105-0001', ['amount' => 60000, 'status' => 'selesai'])->assertStatus(422);
        $this->adminPost('/api/admin/permintaan/refund/RNT-20261105-0001', ['amount' => 50000, 'status' => 'selesai'])->assertOk();
        $this->adminPost('/api/admin/permintaan/refund/RNT-20261105-0001', ['amount' => 50000, 'status' => 'selesai'])->assertStatus(422);

        $this->assertSame(50000, (int) Finance::where('type', 'expense')->sum('amount'));
        $this->assertSame('refunded', $b->fresh()->payment_status);
    }
}
