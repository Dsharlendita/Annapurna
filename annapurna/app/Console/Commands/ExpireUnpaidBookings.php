<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\Sale;
use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class ExpireUnpaidBookings extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bookings:expire-unpaid';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Membatalkan pesanan booking dan penjualan online yang melewati batas waktu pembayaran';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $hours = (int) Setting::get('pay_window_hours', 2);
        $threshold = Carbon::now()->subHours($hours);
        $now = Carbon::now();

        // 1. Batalkan Booking Sewa yang kadaluarsa
        $expiredBookings = Booking::where('channel', 'online')
            ->where('status', 'menunggu_pembayaran')
            ->where('payment_status', 'unpaid')
            ->doesntHave('payments')
            ->where(function ($q) use ($now, $threshold) {
                $q->whereNotNull('expired_at')->where('expired_at', '<=', $now)
                  ->orWhere(function ($sub) use ($threshold) {
                      $sub->whereNull('expired_at')->where('created_at', '<=', $threshold);
                  });
            })
            ->get();

        $bookingCount = 0;
        foreach ($expiredBookings as $b) {
            $b->update([
                'status' => 'dibatalkan',
                'cancel_at' => $now,
                'cancel_reason' => "Melewati batas waktu pembayaran ({$hours} jam)",
                'cancel_auto' => true,
            ]);
            $bookingCount++;
        }

        // 2. Batalkan Penjualan Barang yang kadaluarsa
        $expiredSales = Sale::where('channel', 'online')
            ->where('status', 'menunggu_pembayaran')
            ->where('payment_status', 'unpaid')
            ->doesntHave('payments')
            ->where(function ($q) use ($now, $threshold) {
                $q->whereNotNull('expired_at')->where('expired_at', '<=', $now)
                  ->orWhere(function ($sub) use ($threshold) {
                      $sub->whereNull('expired_at')->where('created_at', '<=', $threshold);
                  });
            })
            ->get();

        $saleCount = 0;
        foreach ($expiredSales as $s) {
            $s->update([
                'status' => 'dibatalkan',
                'cancel_at' => $now,
                'cancel_reason' => "Melewati batas waktu pembayaran ({$hours} jam)",
                'cancel_auto' => true,
            ]);
            $saleCount++;
        }

        $msg = "Pembersihan selesai: {$bookingCount} booking dan {$saleCount} penjualan dibatalkan otomatis.";
        $this->info($msg);
        Log::info("[ExpireUnpaidBookings] " . $msg);

        return self::SUCCESS;
    }
}
