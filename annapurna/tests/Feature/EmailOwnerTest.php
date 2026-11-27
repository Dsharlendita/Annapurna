<?php

namespace Tests\Feature;

use App\Console\Commands\TestMail;
use App\Models\ActivityLog;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** php artisan owner:email (email akun Owner + penerima rekap) dan pengecekan SMTP Gmail di mail:tes */
class EmailOwnerTest extends TestCase
{
    use RefreshDatabase;

    private function owner(string $email = 'owner@annapurna.id'): User
    {
        return User::create(['name' => 'Pak Ikun', 'email' => $email, 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    public function test_mengganti_email_akun_owner_dan_penerima_rekap_sekaligus(): void
    {
        $o = $this->owner();
        Setting::set('integration', ['driveRoot' => 'ANNAPURNA ADVENTURE', 'autoMonthly' => true, 'ownerEmail' => '']);

        $this->artisan('owner:email', ['email' => 'Pemilik.Toko@Gmail.com'])->assertSuccessful();

        $o->refresh();
        $this->assertSame('pemilik.toko@gmail.com', $o->email);
        $this->assertTrue(Hash::check('rahasia123', $o->password));                  // kata sandi tidak berubah
        $s = Setting::get('integration');
        $this->assertSame('pemilik.toko@gmail.com', $s['ownerEmail']);
        $this->assertTrue($s['autoMonthly']);                                        // pengaturan lain tetap
        $this->assertSame(2, ActivityLog::where('user_name', 'Sistem')->count());     // tercatat di histori

        // Masuk dengan email baru
        $this->postJson('/masuk', ['email' => 'pemilik.toko@gmail.com', 'password' => 'rahasia123'])->assertOk();
    }

    public function test_ditolak_bila_email_dipakai_akun_lain_atau_tidak_valid(): void
    {
        $o = $this->owner();
        User::create(['name' => 'Budi', 'email' => 'budi@gmail.com', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);

        $this->artisan('owner:email', ['email' => 'budi@gmail.com'])->assertFailed();
        $this->artisan('owner:email', ['email' => 'bukan-email'])->assertFailed();
        $this->assertSame('owner@annapurna.id', $o->fresh()->email);
    }

    public function test_owner_lebih_dari_satu_harus_memilih(): void
    {
        $this->owner();
        $b = $this->owner('owner2@annapurna.id');

        $this->artisan('owner:email', ['email' => 'baru@gmail.com'])->assertFailed();
        $this->artisan('owner:email', ['email' => 'baru@gmail.com', '--dari' => 'owner2@annapurna.id'])->assertSuccessful();
        $this->assertSame('baru@gmail.com', $b->fresh()->email);
        $this->assertSame(1, User::where('email', 'owner@annapurna.id')->count());
    }

    public function test_mail_tes_memeriksa_pengaturan_gmail(): void
    {
        $ok = ['host' => 'smtp.gmail.com', 'port' => 587, 'scheme' => 'smtp', 'username' => 'sistem@gmail.com', 'password' => 'abcdefghijklmnop'];
        $this->assertSame([], TestMail::gmailProblems($ok, 'sistem@gmail.com'));
        $this->assertSame([], TestMail::gmailProblems(['host' => 'mail.toko.id', 'password' => 'x'], 'lain@toko.id'));   // bukan Gmail: tidak diperiksa

        $p = implode(' | ', TestMail::gmailProblems(['password' => 'abcd efgh ijkl mnop', 'port' => 587, 'scheme' => 'smtps'] + $ok, 'no-reply@toko.id'));
        $this->assertStringContainsString('MAIL_FROM_ADDRESS', $p);
        $this->assertStringContainsString('spasi', $p);
        $this->assertStringContainsString('Port 587', $p);

        $this->assertStringContainsString('16 huruf', implode(' ', TestMail::gmailProblems(['password' => 'annapurna123'] + $ok, 'sistem@gmail.com')));
        $this->assertStringContainsString('Port 465', implode(' ', TestMail::gmailProblems(['port' => 465, 'scheme' => 'smtp'] + $ok, 'sistem@gmail.com')));
    }
}
