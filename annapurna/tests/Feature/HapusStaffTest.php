<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Hapus akun staf: hanya akun yang belum pernah dipakai (belum login & tanpa aktivitas); sisanya tetap Nonaktifkan. */
class HapusStaffTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::create(['name' => 'Pak Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    private function staf(string $email, array $extra = []): User
    {
        return User::create(['name' => 'Tes ' . $email, 'email' => $email, 'role' => 'admin', 'status' => 'aktif', 'password' => 'rahasia123'] + $extra);
    }

    public function test_akun_percobaan_dihapus_dan_emailnya_bisa_dipakai_lagi(): void
    {
        $t = $this->staf('aureliadita900@gmail.com');
        UserNotification::send($t->email, 'Selamat datang', '-', null);

        $list = $this->actingAs($this->owner)->getJson('/api/owner/staff')->assertOk()->json('data');
        $row = collect($list)->firstWhere('email', 'aureliadita900@gmail.com');
        $this->assertTrue($row['canDelete']);
        $this->assertFalse(collect($list)->firstWhere('email', 'owner@annapurna.id')['canDelete']);   // Owner / diri sendiri

        $this->actingAs($this->owner)->deleteJson("/api/owner/staff/u{$t->id}")->assertOk()->assertJsonPath('ok', true);
        $this->assertNull(User::find($t->id));
        $this->assertSame(0, UserNotification::where('user_id', $t->id)->count());
        $this->assertTrue(ActivityLog::where('action', 'like', 'Menghapus akun staf%')->exists());   // tercatat di histori Owner

        // Email bebas lagi: bisa dibuat ulang sebagai staf
        $this->actingAs($this->owner)->postJson('/api/owner/staff', ['name' => 'Dita Tes', 'email' => 'aureliadita900@gmail.com', 'password' => 'Rahasia123', 'password_confirmation' => 'Rahasia123', 'sendEmail' => false])->assertCreated();
    }

    public function test_staf_yang_pernah_dipakai_tidak_bisa_dihapus(): void
    {
        $login = $this->staf('pernah@login.id', ['last_login_at' => now()]);
        $aktif = $this->staf('punya@aktivitas.id');
        Audit::log('booking', 'Mengonfirmasi booking', null, [], $aktif);

        foreach ([$login, $aktif, $this->owner] as $u) {
            $this->actingAs($this->owner)->deleteJson("/api/owner/staff/{$u->id}")->assertStatus(422);
            $this->assertNotNull(User::find($u->id));
        }
        $this->actingAs($this->staf('admin@biasa.id'))->deleteJson("/api/owner/staff/{$aktif->id}")->assertForbidden();   // admin tidak boleh
    }
}
