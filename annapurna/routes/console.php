<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Rekap;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Jadwalkan pembatalan otomatis pesanan belum bayar setiap 15 menit
Schedule::command('bookings:expire-unpaid')->everyFifteenMinutes();

// Jadwalkan pengecekan cucian laundry unclaimed setiap hari pukul 09.00 WIB
Schedule::command('laundry:remind')->dailyAt('09:00');


// Rekap bulanan dibuat (PDF) oleh perangkat staff yang membuka panel setelah jadwal tiba.
// Bila sampai jam 10.00 WIB belum ada yang membuka panel, Owner diingatkan lewat notifikasi lonceng.
Artisan::command('rekap:ingatkan', function () {
    $period = Rekap::duePeriod();
    if (! $period) {
        $this->info('Tidak ada rekap yang tertunda.');

        return;
    }
    User::where('role', 'owner')->where('status', 'aktif')->each(fn ($u) => UserNotification::send($u->email,
        'Rekap ' . Rekap::monthName($period) . ' belum dibuat',
        'Rekap otomatis dibuat saat panel admin/owner dibuka. Buka halaman Google Drive & Email lalu tekan "Buat rekap" agar laporan tersimpan ke Google Drive.',
        'owner/integrasi'));
    $this->info("Owner diingatkan: rekap {$period}.");
})->purpose('Ingatkan Owner bila rekap bulanan ke Google Drive belum dibuat');
Schedule::command('rekap:ingatkan')->dailyAt('10:00')->timezone(Rekap::TZ);

// Kosongkan semua transaksi & histori (data uji), katalog/pengaturan/akun/Google Drive tetap.
// Dipakai sebelum website dibuka, supaya laporan & dashboard mulai dari 0.
Artisan::command('data:kosongkan {--yes : Tanpa konfirmasi} {--paksa : Izinkan di server online}', function () {
    if (! app()->environment('local', 'testing') && ! $this->option('paksa')) {
        $this->error('Ditolak: ini server online. Tambahkan --paksa bila benar-benar ingin menghapus semua transaksi.');

        return 1;
    }
    $tables = [
        'activity_logs', 'booking_changes', 'booking_extensions', 'booking_items', 'booking_returns', 'booking_services', 'bookings',
        'sale_deliveries', 'sale_items', 'sales', 'laundry_order_items', 'laundry_status_logs', 'laundry_orders',
        'payments', 'refunds', 'restocks', 'finances', 'nota_links', 'document_sequences', 'report_archives',
        'user_notifications', 'email_logs', 'login_codes', 'chat_misses',
    ];
    $tables = array_values(array_filter($tables, fn ($t) => Illuminate\Support\Facades\Schema::hasTable($t)));
    foreach ($tables as $t) {
        $this->line(sprintf('  %-22s %d baris', $t, Illuminate\Support\Facades\DB::table($t)->count()));
    }
    if (! $this->option('yes') && ! $this->confirm('Hapus semua baris di tabel di atas? Katalog, pengaturan, akun, dan Google Drive tidak disentuh.')) {
        return 1;
    }
    Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
    foreach ($tables as $t) {
        Illuminate\Support\Facades\DB::table($t)->truncate();   // histori ikut dikosongkan: rantai hash mulai dari awal
    }
    Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();
    // Unit yang tercatat sedang disewa / promo yang sudah terpakai dikembalikan
    Illuminate\Support\Facades\DB::table('product_units')->whereNotNull('out_ref')->update(['out_ref' => null]);
    Illuminate\Support\Facades\DB::table('product_units')->where('status', 'disewa')->update(['status' => 'tersedia']);
    Illuminate\Support\Facades\DB::table('promos')->update(['used_count' => 0]);
    App\Http\Controllers\Annapurna\BootController::bump();
    $this->info('Transaksi & histori dikosongkan. Muat ulang browser (Ctrl+F5).');

    return 0;
})->purpose('Kosongkan transaksi & histori uji (katalog, pengaturan, akun, Google Drive tetap)');