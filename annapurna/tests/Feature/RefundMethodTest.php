<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Gabungan branch revisi-alur-fe (Dita) dengan booking dari database:
 * metode pengembalian DP saat batal, foto bukti refund, kata sandi staff dari Owner.
 */
class RefundMethodTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;
    private User $budi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        Storage::fake('public');

        $mk = fn ($name, $email, $role) => User::create(['name' => $name, 'email' => $email, 'phone' => '0812', 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
        $this->owner = $mk('Pemilik', 'owner@annapurna.id', 'owner');
        $this->budi = $mk('Budi', 'budi@mail.com', 'customer');
    }

    /** Booking milik Budi, DP Rp50.000 sudah diverifikasi, ambil 10 hari lagi (masih ≥ H-2). */
    private function booking(int $startInDays = 10): Booking
    {
        $b = Booking::create([
            'booking_code' => 'RNT-20261113-0001', 'nota_no' => 'RNTL/001/XI/2026', 'user_id' => $this->budi->id,
            'customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com',
            'start_date' => now()->addDays($startInDays)->toDateString(), 'end_date' => now()->addDays($startInDays + 2)->toDateString(), 'days' => 2,
            'subtotal' => 100000, 'total_amount' => 100000, 'dp_amount' => 50000, 'status' => 'dikonfirmasi', 'payment_status' => 'dp_paid',
        ]);
        Payment::create(['booking_id' => $b->id, 'payment_type' => 'DP', 'amount' => 50000, 'status' => 'verified']);

        return $b;
    }

    public function test_customer_wajib_memilih_metode_bila_dp_dikembalikan(): void
    {
        $b = $this->booking();

        $this->actingAs($this->budi)->postJson('/api/pesanan/RNT-20261113-0001/batal', ['reason' => 'Jadwal diundur'])
            ->assertStatus(422)->assertJsonPath('msg', 'Pilih metode pengembalian DP: transfer atau tunai.');
        $this->assertSame('dikonfirmasi', $b->fresh()->status);

        $this->actingAs($this->budi)->postJson('/api/pesanan/RNT-20261113-0001/batal', [
            'reason' => 'Jadwal diundur', 'refund_method' => 'transfer', 'refund_bank' => 'BCA', 'refund_account_number' => '12',
        ])->assertStatus(422)->assertJsonValidationErrors(['refund_account_number', 'refund_account_name']);
    }

    public function test_customer_batal_dengan_transfer_tersimpan_dan_terlihat_admin(): void
    {
        $this->booking();

        $this->actingAs($this->budi)->postJson('/api/pesanan/RNT-20261113-0001/batal', [
            'reason' => 'Jadwal diundur', 'refund_method' => 'transfer',
            'refund_bank' => 'BCA', 'refund_account_number' => '1234567890', 'refund_account_name' => 'Budi Santoso',
        ])->assertOk()
            ->assertJsonPath('data.paymentStatus', 'refund_pending')
            ->assertJsonPath('data.cancel.refund.method', 'transfer')
            ->assertJsonPath('data.cancel.refund.account', '1234567890');

        $r = Refund::first();
        $this->assertSame(50000, $r->amount);
        $this->assertSame('customer', $r->requested_by);
        $this->assertSame('BCA 1234567890 a.n. Budi Santoso', $r->bank_account);

        // Admin di perangkat lain mendapat metode yang sama dari daftar booking
        $list = $this->actingAs($this->admin)->getJson('/api/admin/bookings')->assertOk()->json('data');
        $this->assertSame('Budi Santoso', $list[0]['cancel']['refund']['holder']);
    }

    public function test_batal_kurang_dari_h2_tidak_perlu_metode_dan_dp_hangus(): void
    {
        $this->booking(1);

        $this->actingAs($this->budi)->postJson('/api/pesanan/RNT-20261113-0001/batal', ['reason' => 'Sakit'])
            ->assertOk()->assertJsonPath('data.paymentStatus', 'forfeited');
        $this->assertSame('hangus', Refund::first()->status);
    }

    public function test_persen_refund_dari_pengaturan_server(): void
    {
        \App\Models\Setting::set('refund_percent', 50);
        $this->booking();

        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-20261113-0001/batal', ['reason' => 'Permintaan customer', 'dp_mode' => 'refund'])
            ->assertOk();
        $this->assertSame(25000, Refund::first()->amount);
        $this->assertNull(Refund::first()->method); // metode boleh dilengkapi saat Proses refund
    }

    public function test_refund_transfer_wajib_foto_bukti_dan_pengeluaran_tercatat_sekali(): void
    {
        $b = $this->booking();
        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-20261113-0001/batal', ['reason' => 'Permintaan customer', 'dp_mode' => 'refund'])->assertOk();

        $form = ['amount' => 50000, 'status' => 'selesai', 'refund_method' => 'transfer', 'refund_bank' => 'BRI', 'refund_account_number' => '9876543210', 'refund_account_name' => 'Budi'];
        $this->actingAs($this->admin)->post('/api/admin/permintaan/refund/RNT-20261113-0001', $form, ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('proof_file');

        $form['proof_file'] = UploadedFile::fake()->image('bukti.jpg');
        $form['transfer_ref'] = '2611131234';
        $this->actingAs($this->admin)->post('/api/admin/permintaan/refund/RNT-20261113-0001', $form, ['Accept' => 'application/json'])->assertOk();
        // Klik kedua ditolak, pengeluaran tidak dobel
        $this->actingAs($this->admin)->post('/api/admin/permintaan/refund/RNT-20261113-0001', $form, ['Accept' => 'application/json'])->assertStatus(422);

        $r = Refund::first();
        Storage::disk('public')->assertExists($r->proof_file);
        $this->assertSame(50000, (int) Finance::where('type', 'expense')->sum('amount'));
        $this->assertSame('refunded', $b->fresh()->payment_status);

        $this->actingAs($this->admin)->postJson('/api/admin/permintaan/refund/RNT-20261113-0001/notified')->assertOk();
        $this->assertNotNull($r->fresh()->notified_at);
    }

    public function test_refund_tunai_tanpa_foto_boleh(): void
    {
        $this->booking();
        $this->actingAs($this->admin)->postJson('/api/admin/booking/RNT-20261113-0001/batal', ['reason' => 'x', 'dp_mode' => 'refund', 'refund_method' => 'tunai'])->assertOk();

        $this->actingAs($this->admin)->postJson('/api/admin/permintaan/refund/RNT-20261113-0001', ['amount' => 50000, 'status' => 'selesai'])
            ->assertOk();
        $this->assertSame('tunai', Refund::first()->method);
    }

    public function test_owner_membuat_staff_dengan_kata_sandi_sendiri_dan_tidak_bisa_membuat_owner(): void
    {
        Mail::fake();

        $this->actingAs($this->owner)->postJson('/api/owner/staff', [
            'name' => 'Rina', 'email' => 'rina@annapurna.id', 'phone' => '0813', 'role' => 'owner',
            'password' => 'rahasia123', 'password_confirmation' => 'rahasia123',
        ])->assertStatus(422);

        $res = $this->actingAs($this->owner)->postJson('/api/owner/staff', [
            'name' => 'Rina', 'email' => 'rina@annapurna.id', 'phone' => '0813',
            'password' => 'rahasia123', 'password_confirmation' => 'rahasia123', 'mustChangePw' => false,
        ])->assertCreated();
        $this->assertArrayNotHasKey('temp_password', $res->json());

        $rina = User::where('email', 'rina@annapurna.id')->first();
        $this->assertSame('admin', $rina->role);
        $this->assertFalse((bool) $rina->must_change_password);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('rahasia123', $rina->password));
    }
}
