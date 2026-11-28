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

    public function test_lupa_sandi_staff_ke_owner_customer_tidak(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);   // test ini memanggil > 5x/menit
        $owner = User::create(['name' => 'Pak Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia1']);
        User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'password' => 'rahasia1']);
        User::create(['name' => 'Off', 'email' => 'off@annapurna.id', 'role' => 'admin', 'status' => 'nonaktif', 'password' => 'rahasia1']);
        $ask = fn ($id) => $this->postJson('/api/lupa-sandi', ['identifier' => $id]);

        // Customer, Owner, dan email tak dikenal: jawaban sama, tanpa nomor Owner
        foreach (['budi@mail.com', '0813-1111-2222', 'owner@annapurna.id', 'tidakada@mail.com'] as $id) {
            $r = $ask($id)->assertOk()->assertJsonPath('kind', 'customer');
            $this->assertArrayNotHasKey('wa', $r->json());
            $this->assertStringNotContainsString('6285742202043', $r->getContent());
        }
        $this->assertSame(0, \App\Models\UserNotification::where('user_id', $owner->id)->count());

        // Staff: WhatsApp ke nomor Owner (bukan nomor toko) + notifikasi di lonceng Owner menuju Manajemen Staff
        $r = $ask('dita@annapurna.id')->assertOk()->assertJsonPath('kind', 'staff');
        $this->assertStringStartsWith('https://wa.me/6285742202043?text=', $r->json('wa'));
        $n = \App\Models\UserNotification::where('user_id', $owner->id)->sole();
        $this->assertSame('Dita lupa kata sandi', $n->title);
        $this->assertSame('owner/staff', $n->link);
        $ask('dita@annapurna.id')->assertOk();                                   // diminta lagi: digabung, tidak menumpuk
        $this->assertSame(2, $n->fresh()->count);
        $this->assertSame(1, \App\Models\UserNotification::where('user_id', $owner->id)->count());

        $ask('off@annapurna.id')->assertStatus(403);                              // staff nonaktif tidak bisa minta
        $ask('')->assertStatus(422);

        // Nomor HP di profil Owner dipakai untuk tombol WhatsApp (08xx → 628xx)
        $owner->update(['phone' => '0857-4220-2043']);
        $this->assertStringStartsWith('https://wa.me/6285742202043?text=', $ask('dita@annapurna.id')->json('wa'));
        $owner->update(['phone' => '081200001111']);
        $this->assertStringStartsWith('https://wa.me/6281200001111?text=', $ask('dita@annapurna.id')->json('wa'));
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

    /** "Lupa kata sandi lama?" di Profil: admin yang sedang masuk boleh atur ulang sandinya SENDIRI lewat kode email */
    public function test_admin_yang_sedang_masuk_bisa_atur_ulang_sandinya_sendiri(): void
    {
        Mail::fake();
        $dita = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'password' => 'rahasia1']);
        $aji = User::create(['name' => 'Aji', 'email' => 'aji@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'password' => 'rahasia1']);
        $send = fn ($id) => $this->postJson('/api/kode/kirim', ['identifier' => $id, 'purpose' => 'reset']);

        $send('dita@annapurna.id')->assertStatus(422);                           // belum masuk: tetap minta Owner
        $this->actingAs($aji);
        $send('dita@annapurna.id')->assertStatus(422);                           // akun staff lain: ditolak
        $this->actingAs($dita);
        $send('dita@annapurna.id')->assertOk();                                  // akunnya sendiri: kode dikirim
        Mail::assertSent(\App\Mail\LoginCodeMail::class, fn ($m) => $m->hasTo('dita@annapurna.id'));
    }

    public function test_email_gagal_terkirim_kode_tidak_berlaku(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP gagal'));
        $this->postJson('/api/kode/kirim', ['identifier' => 'budi@mail.com', 'purpose' => 'login'])->assertStatus(503);
        $this->assertNotNull(LoginCode::first()->used_at);
        $this->assertDatabaseHas('email_logs', ['to' => 'budi@mail.com', 'status' => 'gagal']);
    }
}
