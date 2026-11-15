<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Histori aktivitas dari semua perangkat tersimpan di server (activity_logs) dan dibaca halaman Histori Owner. */
class AktivitasTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        $mk = fn ($name, $email, $role) => User::create(['name' => $name, 'email' => $email, 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->owner = $mk('Pemilik', 'owner@annapurna.id', 'owner');
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
    }

    public function test_catatan_dari_tampilan_tersimpan_sekali_dan_terbaca_owner(): void
    {
        $entry = ['id' => 'AUD-00042', 'hash' => 'abc123', 'type' => 'perpanjangan', 'action' => 'Menyetujui perpanjangan RNTL/001', 'ref' => 'RNT-1',
            'changes' => [['field' => 'Tanggal kembali', 'from' => '15 Nov', 'to' => '17 Nov']]];

        $this->actingAs($this->admin)->postJson('/api/sync/audit', ['items' => [$entry]])->assertOk()->assertJsonPath('map.AUD-00042', fn ($v) => str_starts_with($v, 'L'));
        $this->actingAs($this->admin)->postJson('/api/sync/audit', ['items' => [$entry]])->assertOk();   // kiriman ulang
        $this->assertSame(1, ActivityLog::where('subject_type', 'tampilan')->count());

        // Catatan server untuk aksi yang sama tetap tersimpan, tapi tidak ditampilkan dua kali
        $this->actingAs($this->admin);
        Audit::log('perpanjangan', 'Menyetujui perpanjangan booking #RNT-1');
        ActivityLog::record($this->admin->id, 'login', 'Login ke panel admin');

        $this->actingAs($this->admin)->getJson('/api/owner/aktivitas')->assertForbidden();
        $res = $this->actingAs($this->owner)->getJson('/api/owner/aktivitas')->assertOk();
        $actions = array_column($res->json('data.entries'), 'action');
        $this->assertSame(['Menyetujui perpanjangan RNTL/001', 'Login ke panel admin'], $actions);
        $res->assertJsonPath('data.entries.0.ref', 'RNT-1')
            ->assertJsonPath('data.entries.0.userName', 'Dita')
            ->assertJsonPath('data.entries.0.changes.0.field', 'Tanggal kembali')
            ->assertJsonPath('data.integrity.ok', true)
            ->assertJsonPath('data.integrity.count', 3);
    }

    public function test_customer_tidak_bisa_menulis_histori(): void
    {
        $budi = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
        $this->actingAs($budi)->postJson('/api/sync/audit', ['items' => [['id' => 'AUD-1', 'type' => 'x', 'action' => 'Palsu']]])->assertForbidden();
        $this->assertSame(0, ActivityLog::count());
    }
}
