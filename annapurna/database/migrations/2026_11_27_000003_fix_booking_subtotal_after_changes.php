<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Perbaikan data: sebelum 27 Nov 2026, menyetujui ganti barang / perpanjangan hanya menambah total_amount,
 * subtotal booking tetap harga awal. Subtotal dipakai nota, "Harga sewa" saat pelunasan & dasar diskon persen.
 * Semua selisih ganti barang & biaya perpanjangan yang sudah disetujui ditambahkan ke subtotal (sekali).
 */
return new class extends Migration
{
    public function up(): void
    {
        $chg = DB::table('booking_changes')->where('status', 'disetujui')->groupBy('booking_id')->selectRaw('booking_id, SUM(price_diff) as s')->pluck('s', 'booking_id');
        $ext = DB::table('booking_extensions')->where('status', 'disetujui')->groupBy('booking_id')->selectRaw('booking_id, SUM(cost) as s')->pluck('s', 'booking_id');
        foreach ($chg->keys()->merge($ext->keys())->unique() as $id) {
            $add = (int) ($chg[$id] ?? 0) + (int) ($ext[$id] ?? 0);
            if ($add === 0) {
                continue;
            }
            $sub = (int) DB::table('bookings')->where('id', $id)->value('subtotal');
            DB::table('bookings')->where('id', $id)->update(['subtotal' => max(0, $sub + $add)]);
        }
    }

    public function down(): void
    {
        // Tidak dikembalikan: subtotal lama memang salah.
    }
};
