<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Jadwalkan pembatalan otomatis pesanan belum bayar setiap 15 menit
Schedule::command('bookings:expire-unpaid')->everyFifteenMinutes();

// Jadwalkan pengecekan cucian laundry unclaimed setiap hari pukul 09.00 WIB
Schedule::command('laundry:remind')->dailyAt('09:00');
