<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class Promo extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'discount_type',
        'discount_value',
        'applies_to',
        'min_order',
        'max_discount',
        'valid_from',
        'valid_until',
        'quota',
        'used_count',
        'weekday_only',
        'show_on_home',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'integer',
            'min_order' => 'integer',
            'max_discount' => 'integer',
            'quota' => 'integer',
            'used_count' => 'integer',
            'weekday_only' => 'boolean',
            'show_on_home' => 'boolean',
            'valid_from' => 'date',
            'valid_until' => 'date',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Cek validitas promo dan hitung nominal diskon.
     */
    public function calculateDiscount(?int $amount = null, ?string $applies = null, ?string $date = null): array
    {
        if (! $this->is_active) {
            return ['valid' => false, 'message' => 'Kode promo sudah tidak aktif.', 'discount' => 0];
        }

        $now = $date ? Carbon::parse($date) : now();

        if ($this->valid_from && $now->lt(Carbon::parse($this->valid_from)->startOfDay())) {
            return ['valid' => false, 'message' => 'Promo belum mulai berlaku.', 'discount' => 0];
        }

        if ($this->valid_until && $now->gt(Carbon::parse($this->valid_until)->endOfDay())) {
            return ['valid' => false, 'message' => 'Masa berlaku promo sudah habis.', 'discount' => 0];
        }

        if ($this->quota > 0 && $this->used_count >= $this->quota) {
            return ['valid' => false, 'message' => 'Kuota pemakaian promo ini sudah habis.', 'discount' => 0];
        }

        if ($this->weekday_only && ! in_array($now->dayOfWeekIso, [1, 2, 3, 4])) {
            return ['valid' => false, 'message' => 'Promo hanya berlaku untuk hari Senin–Kamis.', 'discount' => 0];
        }

        if ($applies && $this->applies_to !== 'all' && $this->applies_to !== $applies) {
            $label = $this->applies_to === 'rent' ? 'sewa alat' : 'pembelian belanja';
            return ['valid' => false, 'message' => "Promo ini hanya berlaku untuk transaksi {$label}.", 'discount' => 0];
        }

        if ($amount !== null && $this->min_order > 0 && $amount < $this->min_order) {
            return [
                'valid' => false,
                'message' => 'Total transaksi belum memenuhi minimal Rp ' . number_format($this->min_order, 0, ',', '.'),
                'discount' => 0,
            ];
        }

        $discount = 0;
        if ($amount !== null) {
            if ($this->discount_type === 'persen') {
                $discount = (int) round(($amount * $this->discount_value) / 100);
                if ($this->max_discount && $discount > $this->max_discount) {
                    $discount = $this->max_discount;
                }
            } else {
                $discount = min($amount, $this->discount_value);
            }
        }

        return [
            'valid' => true,
            'discount' => $discount,
            'message' => 'Promo berhasil digunakan.',
            'promo' => $this,
        ];
    }
}
