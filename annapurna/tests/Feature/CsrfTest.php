<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Semua request POST/PUT/PATCH/DELETE wajib membawa token CSRF (tanpa pengecualian jalur). */
class CsrfTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Laravel melewati pemeriksaan CSRF saat test; di sini dinyalakan agar perilaku produksi yang diuji.
        $this->app->bind(ValidateCsrfToken::class, fn ($app) => new class($app, $app['encrypter']) extends ValidateCsrfToken {
            protected function runningUnitTests() { return false; }
        });
    }

    public function test_post_api_tanpa_token_ditolak_419(): void
    {
        $this->postJson('/api/chat/miss', ['question' => 'halo'])->assertStatus(419);
        $this->postJson('/api/booking', [])->assertStatus(419);
        $this->postJson('/api/kode/kirim', ['identifier' => 'a@b.c', 'purpose' => 'lupa'])->assertStatus(419);
    }

    public function test_aksi_admin_dan_ganti_sandi_tanpa_token_ditolak_419(): void
    {
        $u = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->actingAs($u)->postJson('/api/admin/pengaturan', [])->assertStatus(419);
        $this->actingAs($u)->postJson('/akun/kata-sandi', ['current_password' => 'x', 'password' => 'baru12345', 'password_confirmation' => 'baru12345'])->assertStatus(419);
        $this->actingAs($u)->postJson('/api/admin/booking/RNT-1/batal', [])->assertStatus(419);
    }

    public function test_dengan_token_yang_benar_tidak_ditolak_419(): void
    {
        $res = $this->withSession(['_token' => 'token-uji'])->postJson('/api/chat/miss', ['question' => 'halo'], ['X-CSRF-TOKEN' => 'token-uji']);
        $this->assertNotSame(419, $res->status());
    }

    public function test_token_salah_ditolak(): void
    {
        $this->withSession(['_token' => 'token-uji'])->postJson('/api/chat/miss', ['question' => 'halo'], ['X-CSRF-TOKEN' => 'token-lain'])->assertStatus(419);
    }
}
