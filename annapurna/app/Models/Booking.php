<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    protected $fillable = [
        'booking_code',
        'nota_no',
        'user_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'start_date',
        'end_date',
        'days',
        'subtotal',
        'discount_amount',
        'discount_reason',
        'settle_disc_amount',
        'settle_disc_reason',
        'fine_amount',
        'total_amount',
        'dp_amount',
        'payment_method',
        'status',
        'channel',
        'is_walk_in',
        'cancel_at',
        'cancel_reason',
        'cancel_auto',
        'payment_status',
        'settle_later',
        'piutang_amount',
        'piutang_note',
        'delivery_mode',
        'notes',
        'expired_at',
        'guarantee_type',
        'guarantee_file',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'days' => 'integer',
            'subtotal' => 'integer',
            'discount_amount' => 'integer',
            'settle_disc_amount' => 'integer',
            'fine_amount' => 'integer',
            'total_amount' => 'integer',
            'dp_amount' => 'integer',
            'settle_later' => 'boolean',
            'piutang_amount' => 'integer',
            'is_walk_in' => 'boolean',
            'cancel_auto' => 'boolean',
            'cancel_at' => 'datetime',
            'expired_at' => 'datetime',
        ];
    }

    /**
     * Scope untuk menyaring booking yang layak tampil di panel staf/admin.
     * Menyembunyikan booking online yang belum bayar DP dan belum pernah mengunggah bukti bayar.
     */
    public function scopeVisibleToStaff($query)
    {
        return $query->where(function ($q) {
            $q->where('channel', 'offline')
                ->orWhere('is_walk_in', true)
                ->orWhere(function ($sub) {
                    $sub->where('channel', 'online')
                        ->where(function ($inner) {
                            $inner->whereNotIn('status', ['menunggu_pembayaran', 'dibatalkan'])
                                ->orWhere('payment_status', '!=', 'unpaid')
                                ->orWhereHas('payments');
                        });
                });
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function returnLog(): HasOne
    {
        return $this->hasOne(BookingReturn::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function changes(): HasMany
    {
        return $this->hasMany(BookingChange::class);
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(BookingExtension::class);
    }

    public function refund(): HasOne
    {
        return $this->hasOne(Refund::class);
    }
}
