<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BookingService extends Model
{
    protected $fillable = [
        'booking_id',
        'service_mode',
        'tents_count',
        'address',
        'scheduled_date',
        'scheduled_time',
        'back_date',
        'back_time',
        'fee',
        'ongkir',
        'total_service',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'tents_count' => 'integer',
            'fee' => 'integer',
            'ongkir' => 'integer',
            'total_service' => 'integer',
            'scheduled_date' => 'date',
            'back_date' => 'date',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ServicePayment::class);
    }
}
