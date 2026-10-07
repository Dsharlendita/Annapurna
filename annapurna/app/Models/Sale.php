<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    protected $fillable = [
        'sale_code',
        'user_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'subtotal',
        'total_amount',
        'payment_method',
        'status',
        'payment_status',
        'delivery_mode',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'total_amount' => 'integer',
        ];
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
}
