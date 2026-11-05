<?php

namespace App\Support;

use App\Models\Package;
use App\Models\Product;
use App\Models\Setting;

/**
 * Tarif sewa berjenjang — salinan server dari tierPlan() di public/assets/js/data.js.
 *
 * Tiga tarif resmi: per malam (d1), perkegiatan 3 hari (d3), ekspedisi 5 hari (d5).
 * Mode 'aturan' (default): lama sewa → kombinasi paket sesuai aturan durasi mitra
 *   (2 hari = paket 3, 4 hari = paket 5, 6 = 5+1, 7–8 = 5+3, 9 = 5+3+1, 10 = 5+5, >10 = 5 + aturan sisa).
 * Mode 'termurah': kombinasi tarif paling murah.
 *
 * Harga SELALU dihitung di server dari tabel products/packages — harga kiriman browser diabaikan.
 */
class RentalPricing
{
    public const DUR_DEFAULT = [
        1 => [1], 2 => [3], 3 => [3], 4 => [5], 5 => [5],
        6 => [5, 1], 7 => [5, 3], 8 => [5, 3], 9 => [5, 3, 1], 10 => [5, 5],
    ];

    private const KEY = [1 => 'd1', 3 => 'd3', 5 => 'd5'];

    private static ?array $rules = null;
    private static ?string $mode = null;

    /** Jumlah malam sewa (minimal 1), sama dengan Rules.rentalDays / diffDays di FE. */
    public static function nights(string $start, string $end): int
    {
        $s = new \DateTimeImmutable(substr($start, 0, 10));
        $e = new \DateTimeImmutable(substr($end, 0, 10));

        return max(1, (int) $s->diff($e)->format('%r%a'));
    }

    /** @return array{d1:int,d3:int,d5:int} */
    public static function productTiers(?Product $p): array
    {
        if (!$p) {
            return ['d1' => 0, 'd3' => 0, 'd5' => 0];
        }

        return [
            'd1' => (int) $p->rent_price,
            'd3' => (int) ($p->rent_price_3 ?? 0),
            'd5' => (int) ($p->rent_price_5 ?? 0),
        ];
    }

    /** Tarif paket: harga paket bila diisi, selain itu jumlah tarif isi paket (sama dengan packageTiers di FE). */
    public static function packageTiers(?Package $pk): array
    {
        if (!$pk) {
            return ['d1' => 0, 'd3' => 0, 'd5' => 0];
        }
        $pk->loadMissing('items.product');
        $sum = fn (int $d) => (int) $pk->items->sum(fn ($i) => self::lineTotal(self::productTiers($i->product), $d) * (int) $i->qty);

        return [
            'd1' => (int) $pk->price_per_day,
            'd3' => (int) ($pk->price_3 ?: $sum(3)),
            'd5' => (int) ($pk->price_5 ?: $sum(5)),
        ];
    }

    /** Harga 1 unit untuk lama sewa $days. */
    public static function lineTotal(array $t, int $days): int
    {
        $days = max(1, $days);

        if (self::mode() === 'aturan') {
            $blocks = self::blocks($days);
            $ok = $blocks && array_sum($blocks) >= $days
                && collect($blocks)->every(fn ($b) => (int) ($t[self::KEY[$b]] ?? 0) > 0);
            if ($ok) {
                return (int) array_sum(array_map(fn ($b) => (int) $t[self::KEY[$b]], $blocks));
            }
        }

        // Kombinasi termurah (dynamic programming), urutan blok 5 → 3 → 1 seperti FE
        $best = [0 => 0];
        for ($n = 1; $n <= $days; $n++) {
            $cur = null;
            foreach ([5, 3, 1] as $d) {
                $price = (int) ($t[self::KEY[$d]] ?? 0);
                if (!$price || $n < $d || !array_key_exists($n - $d, $best) || $best[$n - $d] === null) {
                    continue;
                }
                $c = $best[$n - $d] + $price;
                if ($cur === null || $c < $cur) {
                    $cur = $c;
                }
            }
            $best[$n] = $cur;
        }

        if ($best[$days] === null) {
            $per = ((int) ($t['d1'] ?? 0)) ?: (((int) ($t['d3'] ?? 0)) / 3 ?: ((int) ($t['d5'] ?? 0)) / 5);

            return (int) round($per * $days);
        }

        return (int) $best[$days];
    }

    private static function blocks(int $days): array
    {
        $r = self::rules();
        if ($days <= 10) {
            return $r[$days] ?? self::DUR_DEFAULT[$days];
        }

        return array_merge([5], self::blocks($days - 5));
    }

    private static function rules(): array
    {
        if (self::$rules !== null) {
            return self::$rules;
        }
        $raw = Setting::get('dur_rules');
        $out = [];
        for ($n = 1; $n <= 10; $n++) {
            $v = is_array($raw) && isset($raw[$n]) && is_array($raw[$n]) ? array_values(array_filter(array_map('intval', $raw[$n]), fn ($x) => in_array($x, [1, 3, 5], true))) : [];
            $out[$n] = $v ?: self::DUR_DEFAULT[$n];
        }

        return self::$rules = $out;
    }

    private static function mode(): string
    {
        return self::$mode ??= (string) (Setting::get('dur_mode', 'aturan') ?: 'aturan');
    }
}
