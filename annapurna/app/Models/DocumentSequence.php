<?php

namespace App\Models;

use Carbon\Carbon;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class DocumentSequence extends Model
{
    protected $fillable = [
        'prefix',
        'year',
        'month',
        'last_number',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'last_number' => 'integer',
        ];
    }

    /**
     * Peta angka bulan ke angka romawi.
     */
    public const ROMAN_MONTHS = [
        1 => 'I',
        2 => 'II',
        3 => 'III',
        4 => 'IV',
        5 => 'V',
        6 => 'VI',
        7 => 'VII',
        8 => 'VIII',
        9 => 'IX',
        10 => 'X',
        11 => 'XI',
        12 => 'XII',
    ];

    /**
     * Mendapatkan nomor nota resmi berikutnya dengan penguncian baris (pessimistic lock)
     * untuk mencegah terjadinya nomor ganda saat banyak kasir / customer bertransaksi serentak.
     *
     * Contoh hasil:
     * - Rental  : RNTL/001/X/2026
     * - Pesanan : ODR/001/X/2026
     * - Laundry : DRY/001/X/2026
     */
    public static function nextNota(string $type, ?DateTimeInterface $date = null): string
    {
        $prefix = match (strtolower(trim($type))) {
            'rent', 'rental', 'rntl' => 'RNTL',
            'sale', 'penjualan', 'order', 'odr' => 'ODR',
            'laundry', 'dry', 'cuci' => 'DRY',
            default => strtoupper(substr(trim($type), 0, 4)),
        };

        $carbon = $date ? Carbon::instance($date)->timezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');
        $year = (int) $carbon->format('Y');
        $month = (int) $carbon->format('n');
        $romanMonth = self::ROMAN_MONTHS[$month] ?? 'I';

        return DB::transaction(function () use ($prefix, $year, $month, $romanMonth) {
            $seq = static::where('prefix', $prefix)
                ->where('year', $year)
                ->where('month', $month)
                ->lockForUpdate()
                ->first();

            if (!$seq) {
                $seq = static::create([
                    'prefix' => $prefix,
                    'year' => $year,
                    'month' => $month,
                    'last_number' => 1,
                ]);
                $number = 1;
            } else {
                $seq->increment('last_number');
                $number = (int) $seq->last_number;
            }

            $padded = str_pad((string) $number, 3, '0', STR_PAD_LEFT);
            return "{$prefix}/{$padded}/{$romanMonth}/{$year}";
        });
    }
}
