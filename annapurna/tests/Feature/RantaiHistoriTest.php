<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Penulis histori antre di satu baris kunci (document_sequences prefix AUDIT), bukan mengunci baris terakhir
 * activity_logs (yang di MySQL membuat deadlock 1213 saat dua histori disimpan bersamaan).
 */
class RantaiHistoriTest extends TestCase
{
    use RefreshDatabase;

    public function test_baris_kunci_ada_dan_rantai_tetap_utuh_dari_semua_jalur(): void
    {
        $this->assertSame(1, DB::table('document_sequences')->where('prefix', 'AUDIT')->count());   // dibuat migrasi

        $o = User::create(['name' => 'Pak Ikun', 'email' => 'o@x.id', 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia123']);
        $this->actingAs($o);
        Audit::log('unit', 'Selesai dicuci — unit TND-4P-02');
        Audit::fromClient(['id' => 'A9', 'type' => 'unit', 'action' => 'Selesai dicuci — unit TND-2P-02'], $o);
        ActivityLog::record($o->id, 'login', 'Login ke panel owner dengan akun Google');
        Audit::log('unit', 'Dari tampilan lagi', null, [], null, true);

        $this->assertSame(4, ActivityLog::count());
        $this->assertNull(ActivityLog::firstBrokenId());
        $this->assertSame(4, ActivityLog::distinct()->count('prev_hash'));   // tidak bercabang
    }

    public function test_baris_kunci_dibuat_ulang_bila_terhapus(): void
    {
        DB::table('document_sequences')->where('prefix', 'AUDIT')->delete();
        $o = User::create(['name' => 'Pak Ikun', 'email' => 'o@x.id', 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia123']);
        Audit::fromClient(['id' => 'A1', 'type' => 'unit', 'action' => 'Uji'], $o);
        $this->assertSame(1, DB::table('document_sequences')->where('prefix', 'AUDIT')->count());
        $this->assertSame(1, ActivityLog::count());
    }

    public function test_sinkronisasi_histori_dari_tampilan_tetap_jalan(): void
    {
        $o = User::create(['name' => 'Pak Ikun', 'email' => 'o@x.id', 'role' => 'owner', 'status' => 'aktif', 'password' => 'rahasia123']);
        $r = $this->actingAs($o)->postJson('/api/sync/audit', ['items' => [
            ['id' => 'A1', 'type' => 'unit', 'action' => 'Selesai dicuci — unit A', 'hash' => 'h1'],
            ['id' => 'A2', 'type' => 'unit', 'action' => 'Selesai dicuci — unit B', 'hash' => 'h2'],
        ]])->assertOk();
        $this->assertCount(2, (array) $r->json('map'));
        $this->assertNull(ActivityLog::firstBrokenId());
    }
}
