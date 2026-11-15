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