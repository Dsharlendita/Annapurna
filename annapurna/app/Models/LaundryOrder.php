<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LaundryOrder extends Model
{
    protected $fillable = [
        'order_code',
        'nota_no',
        'user_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'subtotal',
        'discount_amount',
        'discount_reason',
        'total_amount',
        'payment_method',
        'status',
        'payment_status',
        'channel',
        'est_done',
        'picked_at',
        'notified_ready',
        'notified_at',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount_amount' => 'integer',
            'total_amount' => 'integer',
            'est_done' => 'date',
            'picked_at' => 'datetime',
            'notified_ready' => 'boolean',
            'notified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(LaundryOrderItem::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(LaundryStatusLog::class)->orderBy('id', 'asc');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(LaundryPayment::class)->orderBy('id', 'asc');
    }

    public function getPaidAmountAttribute(): int
    {
        return (int) $this->payments()->sum('amount');
    }

    public function getRemainingDueAttribute(): int
    {
        return max(0, $this->total_amount - $this->paid_amount);
    }
}
