<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Finance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** php artisan data:kosongkan: transaksi & histori uji dihapus, katalog/akun/pengaturan tetap. */
class KosongkanDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_transaksi_dikosongkan_katalog_dan_akun_tetap(): void
    {
        $this->seed();   // katalog + contoh transaksi (lingkungan testing)
        $owner = User::where('role', 'owner')->first();
        ActivityLog::record($owner->id, 'login', 'Login ke panel owner');
        Finance::create(['finance_code' => 'FIN-UJI-1', 'type' => 'expense', 'source' => 'manual', 'category' => 'Wifi / Internet', 'amount' => 199000, 'description' => 'bayar wifi', 'transaction_date' => now(), 'created_by' => $owner->id]);
        $products = \App\Models\Product::count();
        $users = User::count();

        $this->artisan('data:kosongkan', ['--yes' => true])->assertExitCode(0);

        $this->assertSame([0, 0, 0, 0], [\App\Models\Booking::count(), Finance::count(), \App\Models\Payment::count(), ActivityLog::count()]);
        $this->assertSame([$products, $users], [\App\Models\Product::count(), User::count()]);
        $this->assertGreaterThan(0, $products);
        $this->assertNull(ActivityLog::firstBrokenId());   // histori baru mulai dari awal rantai
    }

    public function test_ditolak_di_server_online_tanpa_paksa(): void
    {
        $this->app['env'] = 'production';
        $this->artisan('data:kosongkan', ['--yes' => true])->assertExitCode(1);
    }
}
