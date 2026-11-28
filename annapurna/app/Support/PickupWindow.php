<?php

namespace App\Support;

use App\Models\Setting;
use Carbon\CarbonImmutable;

/**
 * Tanggal ambil paling awal untuk pesanan online (sama dengan Rules.pickupMin di data.js).
 * Toko tutup pada jam "batas kembali" (returnTime, bawaan 22:00 WIB). Lewat jam itu, tanggal hari ini dikunci:
 * paling cepat besok. Jam pesan malam (lateOrderTime 20:00) hanya mengubah tanggal BAWAAN di tampilan, bukan aturan.
 * Kasir (pesanan langsung di toko) tidak memakai aturan ini.
 */
class PickupWindow
{
    public const TZ = 'Asia/Jakarta';

    public static function closeTime(): string
    {
        $t = (string) (Setting::get('returnTime', '22:00') ?: '22:00');

        return preg_match('/^\d{1,2}[:.]\d{2}$/', $t) ? str_replace('.', ':', $t) : '22:00';
    }

    public static function earliest(?CarbonImmutable $now = null): string
    {
        $now ??= CarbonImmutable::now(self::TZ);
        [$h, $m] = array_map('intval', explode(':', self::closeTime()));
        $close = $now->setTime($h, $m);

        return ($now->gte($close) ? $now->addDay() : $now)->toDateString();
    }

    /** Pesan penolakan bila tanggal ambil lebih awal dari yang boleh, atau null bila boleh. */
    public static function reject(string $startDate, ?CarbonImmutable $now = null): ?string
    {
        $min = self::earliest($now);
        if ($startDate >= $min) {
            return null;
        }
        $today = ($now ?? CarbonImmutable::now(self::TZ))->toDateString();

        return $min > $today
            ? 'Toko sudah tutup pukul ' . str_replace(':', '.', self::closeTime()) . ' WIB. Tanggal ambil paling cepat besok.'
            : 'Tanggal ambil tidak boleh sebelum hari ini.';
    }
}
