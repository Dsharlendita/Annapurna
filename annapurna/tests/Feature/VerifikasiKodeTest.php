<?php

namespace Tests\Feature;

use App\Mail\LoginCodeMail;
use App\Models\LoginCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Kode verifikasi lewat email: masuk dengan kode & lupa kata sandi.
 * Kode dibuat dan dicek server, tidak pernah dikirim ke browser.
 */
class VerifikasiKodeTest extends TestCase
{
    use RefreshDatabase;

    private User $budi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        Mail::fake();
        $this->budi = User::create(['name' => 'Budi Santoso', 'email' => 'budi@mail.com', 'phone' => '0813-1111-2222', 'role' => 'customer', 'status' => 'aktif', 'password' => 'lama123']);
    }

    /** Minta kode lalu ambil angkanya dari email yang "terkirim". */
    private function requestCode(string $identifier, string $purpose): string
    {
        $res = $this->postJson('/api/kode/kirim', ['identifier' => $identifier, 'purpose' => $purpose])->assertOk();
        $this->assertArrayNotHasKey('code', $res->json());          // kode tidak pernah dikirim ke browser
        $code = null;
        Mail::assertSent(LoginCodeMail::class, function (LoginCodeMail $m) use (&$code, $purpose) {
            $code = $m->code;
            return $m->hasTo('budi@mail.com') && $m->purpose === $purpose;
        });

        return $code;
    }

    public function test_masuk_dengan_kode_lewat_email_atau_nomor_hp(): void
    {
        $code = $this->requestCode('+62 813 1111 2222', 'login');    // nomor HP → kode tetap ke email akun
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertNotSame($code, LoginCode::first()->code_hash);  // tersimpan teracak

        $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'login', 'code' => $code])
            ->assertOk()->assertJsonPath('user.email', 'budi@mail.com');
        $this->assertAuthenticatedAs($this->budi);

        // Sekali pakai
        $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'login', 'code' => $code])->assertStatus(422);
    }

    public function test_salah_lima_kali_kode_hangus_dan_kedaluwarsa_ditolak(): void
    {
        $code = $this->requestCode('budi@mail.com', 'login');
        $wrong = $code === '000000' ? '111111' : '000000';
        for ($i = 4; $i >= 1; $i--) {
            $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'login', 'code' => $wrong])
                ->assertStatus(422)->assertJsonPath('msg', "Kode tidak cocok. Sisa {$i} kali percobaan.");
        }
        $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'login', 'code' => $wrong])->assertStatus(422);
        // Kode benar pun tidak berlaku lagi
        $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'login', 'code' => $code])->assertStatus(422);
        $this->assertGuest();

        $this->travel(2)->minutes();
        $code2 = $this->requestCode('budi@mail.com', 'login');
        $this->travel(11)->minutes();
        $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'login', 'code' => $code2])
            ->assertStatus(422)->assertJsonPath('field', 'code');
    }

    public function test_kirim_ulang_dibatasi(): void
    {
        $this->requestCode('budi@mail.com', 'login');
        $this->postJson('/api/kode/kirim', ['identifier' => 'budi@mail.com', 'purpose' => 'login'])->assertStatus(429);
        $this->travel(61)->seconds();
        $this->postJson('/api/kode/kirim', ['identifier' => 'budi@mail.com', 'purpose' => 'login'])->assertOk();
    }

    public function test_lupa_kata_sandi_lalu_langsung_masuk_dan_sesi_lama_keluar(): void
    {
        $code = $this->requestCode('budi@mail.com', 'reset');

        // Tanpa verifikasi kode tidak bisa mengganti kata sandi
        $this->postJson('/api/kode/sandi-baru', ['password' => 'baru123', 'password_confirmation' => 'baru123'])->assertStatus(422);

        $this->postJson('/api/kode/cek', ['identifier' => 'budi@mail.com', 'purpose' => 'reset', 'code' => $code])
            ->assertOk()->assertJsonPath('step', 'password');
        $this->assertGuest();                                          // belum masuk sebelum kata sandi baru dibuat

        $this->postJson('/api/kode/sandi-baru', ['password' => 'baru123', 'password_confirmation' => 'beda'])->assertStatus(422);
        $this->postJson('/api/kode/sandi-baru', ['password' => 'baru123', 'password_confirmation' => 'baru123'])
            ->assertOk()->assertJsonPath('user.email', 'budi@mail.com');
        $this->assertAuthenticatedAs($this->budi);
        $this->assertTrue(Hash::check('baru123', $this->budi->fresh()->password));
    }

    public function test_aturan_akun(): void
    {
        $mk = fn ($email, $role, $extra = []) => User::create(array_merge(['name' => 'X', 'email' => $email, 'role' => $role, 'status' => 'aktif', 'password' => 'rahasia1'], $extra));
        $mk('dita@annapurna.id', 'admin');
        $mk('owner@annapurna.id', 'owner');
        $mk('kasir-20261113@annapurna.local', 'customer', ['phone' => '0899000111']);
        $mk('off@mail.com', 'customer', ['status' => 'nonaktif']);

        $send = fn ($id, $p) => $this->postJson('/api/kode/kirim', ['identifier' => $id, 'purpose' => $p]);
        $send('tidakada@mail.com', 'login')->assertStatus(422);
        $send('dita@annapurna.id', 'login')->assertStatus(422)->assertJsonPath('msg', 'Akun staff masuk memakai email dan kata sandi.');
        $send('dita@annapurna.id', 'reset')->assertStatus(422);                 // admin minta Owner
        $send('owner@annapurna.id', 'reset')->assertOk();                        // Owner boleh atur ulang sendiri
        $send('0899000111', 'login')->assertStatus(422);                         // akun kasir tanpa email asli
        $send('off@mail.com', 'login')->assertStatus(403);
    }

    public function test_email_gagal_terkirim_kode_tidak_berlaku(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP gagal'));
        $this->postJson('/api/kode/kirim', ['identifier' => 'budi@mail.com', 'purpose' => 'login'])->assertStatus(503);
        $this->assertNotNull(LoginCode::first()->used_at);
        $this->assertDatabaseHas('email_logs', ['to' => 'budi@mail.com', 'status' => 'gagal']);
    }
}
