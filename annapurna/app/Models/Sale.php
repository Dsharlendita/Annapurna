<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    protected $fillable = [
        'sale_code',
        'nota_no',
        'user_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'subtotal',
        'total_amount',
        'payment_method',
        'status',
        'channel',
        'is_walk_in',
        'cancel_at',
        'cancel_reason',
        'cancel_auto',
        'payment_status',
        'delivery_mode',
        'notes',
        'expired_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'total_amount' => 'integer',
            'is_walk_in' => 'boolean',
            'cancel_auto' => 'boolean',
            'cancel_at' => 'datetime',
            'expired_at' => 'datetime',
        ];
    }

    /**
     * Scope untuk menyaring transaksi penjualan yang layak tampil di panel staf/admin.
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
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }
}
