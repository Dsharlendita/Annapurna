<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Semua pembayaran customer. Setiap baris milik tepat satu transaksi:
 * booking_id (sewa), sale_id (penjualan), laundry_order_id (laundry),
 * atau booking_service_id (antar/pasang tenda).
 */
class Payment extends Model
{
    protected $fillable = [
        'booking_id',
        'sale_id',
        'laundry_order_id',
        'booking_service_id',
        'payment_type',
        'amount',
        'payment_method',
        'bank_name',
        'proof_file',
        'status',
        'paid_at',
        'verified_by',
        'verified_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'paid_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    /** Atribut bawaan untuk uang yang diterima langsung oleh staff di toko. */
    public static function receivedInStore(int $amount, string $type, ?string $method, ?int $staffId, ?string $notes = null): array
    {
        return [
            'payment_type' => $type,
            'amount' => $amount,
            'payment_method' => $method ?: 'Tunai',
            'status' => 'verified',
            'paid_at' => now(),
            'verified_by' => $staffId,
            'verified_at' => now(),
            'notes' => $notes,
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function laundryOrder(): BelongsTo
    {
        return $this->belongsTo(LaundryOrder::class);
    }

    public function bookingService(): BelongsTo
    {
        return $this->belongsTo(BookingService::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
