<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/** Akun yang dibuat otomatis saat checkout (tanpa daftar) dan pengaman tujuan setelah masuk. */
class AkunCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    private function checkout(array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/daftar', ['name' => 'Rina Ayu', 'email' => 'rina@mail.com', 'phone' => '081311112222', 'auto_created' => true] + $extra);
    }

    public function test_akun_dari_checkout_belum_punya_kata_sandi_lalu_bisa_membuatnya(): void
    {
        // Akun dibuat tanpa kata sandi dari tampilan, langsung masuk
        $this->checkout()->assertOk()->assertJsonPath('user.hasPassword', false);
        $u = User::where('email', 'rina@mail.com')->first();
        $this->assertFalse($u->password_set);
        $this->assertTrue($u->auto_created);
        $this->assertAuthenticatedAs($u);

        // Buat kata sandi tanpa kata sandi lama (kartu di Pesanan Saya)
        $this->postJson('/akun/kata-sandi', ['current_password' => '', 'password' => 'rahasia9', 'password_confirmation' => 'rahasia9'])->assertOk();
        $this->assertTrue($u->fresh()->password_set);

        // Setelah keluar, bisa masuk lagi dengan kata sandi itu
        Auth::logout();
        $this->postJson('/masuk', ['email' => 'rina@mail.com', 'password' => 'rahasia9'])->assertOk()->assertJsonPath('user.hasPassword', true);
    }

    public function test_masuk_dengan_kata_sandi_sebelum_dibuat_diberi_petunjuk(): void
    {
        $this->checkout();
        Auth::logout();
        $r = $this->postJson('/masuk', ['email' => 'rina@mail.com', 'password' => 'tebak123'])->assertStatus(422);
        $this->assertStringContainsString('dibuat otomatis saat checkout', $r->json('msg'));
        $this->assertStringContainsString('Lupa kata sandi', $r->json('msg'));
        $this->assertGuest();
    }

    public function test_kata_sandi_dari_tampilan_diabaikan_untuk_akun_checkout(): void
    {
        // Kata sandi acak lama dari tampilan tidak dipakai: tidak ada yang tahu kata sandinya
        $this->checkout(['password' => 'Xy12abcdAa1']);
        Auth::logout();
        $this->postJson('/masuk', ['email' => 'rina@mail.com', 'password' => 'Xy12abcdAa1'])->assertStatus(422);
    }

    public function test_daftar_biasa_tetap_wajib_kata_sandi(): void
    {
        $this->postJson('/daftar', ['name' => 'Rina Ayu', 'email' => 'rina@mail.com', 'phone' => '081311112222'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/daftar', ['name' => 'Rina Ayu', 'email' => 'rina@mail.com', 'phone' => '081311112222', 'password' => 'rahasia9'])
            ->assertOk()->assertJsonPath('user.hasPassword', true);
        $this->assertTrue(User::where('email', 'rina@mail.com')->value('password_set'));
    }

    public function test_tujuan_setelah_masuk_tidak_boleh_situs_lain(): void
    {
        User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'lama1234']);
        foreach (['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)'] as $next) {
            $r = $this->postJson('/masuk', ['email' => 'budi@mail.com', 'password' => 'lama1234', 'next' => $next])->assertOk();
            $this->assertStringNotContainsString('evil', (string) $r->json('redirect'), $next);
            $this->assertStringNotContainsString('javascript', (string) $r->json('redirect'), $next);
            Auth::logout();
        }
        $this->postJson('/masuk', ['email' => 'budi@mail.com', 'password' => 'lama1234', 'next' => 'checkout'])->assertJsonPath('redirect', 'checkout');
    }
}
