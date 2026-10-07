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
        'fine_amount',
        'total_amount',
        'dp_amount',
        'payment_method',
        'status',
        'payment_status',
        'delivery_mode',
        'notes',
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
            'fine_amount' => 'integer',
            'total_amount' => 'integer',
            'dp_amount' => 'integer',
        ];
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
}
