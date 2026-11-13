<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;
use Mockery;
use Tests\TestCase;

/** Masuk / daftar dengan Google (Socialite ditiru, tanpa menghubungi Google sungguhan). */
class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        config(['services.google.client_id' => 'id-uji', 'services.google.client_secret' => 'rahasia-uji']);
    }

    /** Google "mengembalikan" akun ini saat callback. */
    private function fakeGoogle(string $email, string $name = 'Sari Dewi', bool $verified = true, string $id = 'g-123'): void
    {
        $g = (new GoogleUser())->setRaw(['email_verified' => $verified])->map(['id' => $id, 'name' => $name, 'email' => $email]);
        $provider = Mockery::mock(\Laravel\Socialite\Two\GoogleProvider::class);
        $provider->shouldReceive('with')->andReturnSelf();
        $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth?uji=1'));
        $provider->shouldReceive('user')->andReturn($g);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
    }

    public function test_belum_diatur_tombol_mengarah_kembali_ke_masuk(): void
    {
        config(['services.google.client_id' => null]);
        $this->get('/auth/google')->assertRedirect(route('masuk', ['google' => 'belum-aktif']));
        $this->get('/masuk')->assertOk()->assertDontSee('Masuk dengan Google');
    }

    public function test_tombol_tampil_dan_mengarah_ke_google(): void
    {
        $this->fakeGoogle('sari@gmail.com');
        $this->get('/masuk')->assertOk()->assertSee('Masuk dengan Google');
        $this->get('/daftar')->assertOk()->assertSee('Daftar dengan Google');
        $this->get('/auth/google')->assertRedirect('https://accounts.google.com/o/oauth2/auth?uji=1');
    }

    public function test_email_baru_dibuatkan_akun_customer_tanpa_kata_sandi(): void
    {
        $this->fakeGoogle('Sari@Gmail.com');
        $this->get('/auth/google/callback?code=abc')->assertRedirect(route('home'));

        $u = User::where('email', 'sari@gmail.com')->sole();
        $this->assertAuthenticatedAs($u);
        $this->assertSame(['customer', 'g-123', false], [$u->role, $u->google_id, $u->password_set]);
        $this->assertNotNull($u->email_verified_at);

        // Mencoba masuk dengan kata sandi → diarahkan ke tombol Google, bukan "kata sandi salah"
        auth()->logout();
        $this->postJson('/masuk', ['email' => 'sari@gmail.com', 'password' => 'tebak123'])
            ->assertStatus(422)->assertJsonPath('field', 'password')->assertSee('Masuk dengan Google');
        $this->actingAs($u);

        // Membuat kata sandi pertama kali tanpa kata sandi lama, setelah itu kata sandi lama wajib
        $this->postJson('/akun/kata-sandi', ['password' => 'baru123', 'password_confirmation' => 'baru123'])->assertOk();
        $this->assertTrue($u->fresh()->password_set);
        $this->assertTrue(Hash::check('baru123', $u->fresh()->password));
        $this->postJson('/akun/kata-sandi', ['password' => 'lagi456', 'password_confirmation' => 'lagi456'])->assertStatus(422);
    }

    public function test_email_terdaftar_masuk_ke_akun_yang_sama_dan_tersambung(): void
    {
        $budi = User::create(['name' => 'Budi', 'email' => 'budi@gmail.com', 'role' => 'customer', 'status' => 'aktif', 'password' => 'lama123']);
        $this->fakeGoogle('budi@gmail.com', 'Budi G', true, 'g-budi');

        $this->get('/auth/google/callback?code=abc')->assertRedirect(route('home'));
        $this->assertAuthenticatedAs($budi);
        $this->assertSame(1, User::count());
        $this->assertSame('g-budi', $budi->fresh()->google_id);
        $this->assertTrue($budi->fresh()->password_set);                     // kata sandi lama tetap berlaku
    }

    public function test_akun_nonaktif_batal_dan_email_belum_terverifikasi_ditolak(): void
    {
        User::create(['name' => 'Off', 'email' => 'off@gmail.com', 'role' => 'customer', 'status' => 'nonaktif', 'password' => 'x123456']);
        $this->fakeGoogle('off@gmail.com');
        $this->get('/auth/google/callback?code=abc')->assertRedirect(route('masuk', ['nonaktif' => 1]));
        $this->assertGuest();

        $this->get('/auth/google/callback?error=access_denied')->assertRedirect(route('masuk', ['google' => 'batal']));
    }

    public function test_email_google_belum_terverifikasi(): void
    {
        $this->fakeGoogle('baru@contoh.com', 'X', false);
        $this->get('/auth/google/callback?code=abc')->assertRedirect(route('masuk', ['google' => 'email']));
        $this->assertSame(0, User::count());
    }

    public function test_kembali_ke_halaman_asal_tapi_tidak_ke_situs_luar(): void
    {
        $this->fakeGoogle('sari@gmail.com');
        $this->get('/auth/google?next=checkout');
        $this->get('/auth/google/callback?code=abc')->assertRedirect('checkout');

        auth()->logout();
        $this->get('/auth/google?next=//situs-palsu.com');
        $this->get('/auth/google/callback?code=abc')->assertRedirect(route('home'));
    }
}
