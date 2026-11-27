<?php

namespace Tests\Feature;

use App\Mail\StaffAccountCreated;
use App\Mail\StaffPasswordReset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** Permintaan toko (27 Nov 2026): kata sandi buatan Owner tercantum di email staff; panel tidak menerima kata sandinya lagi. */
class KataSandiDiEmailTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::create(['name' => 'Pak Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia123']);
        config(['mail.default' => 'array']);
    }

    public function test_email_staff_baru_berisi_kata_sandi(): void
    {
        Mail::fake();
        $r = $this->actingAs($this->owner)->postJson('/api/owner/staff', [
            'name' => 'Feb', 'email' => 'feb@mail.com', 'password' => 'Rahasia123', 'password_confirmation' => 'Rahasia123',
            'sendEmail' => true, 'mustChangePw' => false,
        ])->assertCreated();

        Mail::assertSent(StaffAccountCreated::class, function (StaffAccountCreated $m) {
            $m->assertSeeInText('Kata sandi: Rahasia123');
            $m->assertSeeInHtml('Rahasia123');
            $m->assertDontSeeInText('Buat kata sandi baru saat pertama login');   // tidak diwajibkan ganti
            $m->assertSeeInText('sebaiknya hapus email ini');

            return $m->hasTo('feb@mail.com');
        });
        $this->assertStringNotContainsString('Rahasia123', $r->getContent());          // tidak dikembalikan ke panel
        $this->assertTrue($r->json('mail.data.pwInMail'));
    }

    public function test_wajib_ganti_memberi_label_sementara(): void
    {
        $staff = new User(['name' => 'Feb', 'email' => 'feb@mail.com', 'role' => 'admin']);
        $m = new StaffAccountCreated($staff, $this->owner, 'Rahasia123', true);
        $m->assertSeeInText('Kata sandi sementara: Rahasia123');
        $m->assertSeeInText('Buat kata sandi baru saat pertama login');
    }

    public function test_atur_ulang_kata_sandi_buatan_owner_ikut_email(): void
    {
        Mail::fake();
        $staff = User::create(['name' => 'Feb', 'email' => 'feb@mail.com', 'role' => 'admin', 'status' => 'aktif', 'password' => 'lama12345']);
        $r = $this->actingAs($this->owner)->postJson("/api/owner/staff/{$staff->id}/reset-password", [
            'password' => 'Baru12345', 'password_confirmation' => 'Baru12345', 'sendEmail' => true, 'mustChangePw' => false,
        ])->assertOk();

        Mail::assertSent(StaffPasswordReset::class, function (StaffPasswordReset $m) {
            $m->assertSeeInText('Kata sandi baru: Baru12345');
            $m->assertDontSeeInText('wajib membuat kata sandi baru');

            return $m->hasTo('feb@mail.com');
        });
        $this->assertStringNotContainsString('Baru12345', $r->getContent());
    }
}
