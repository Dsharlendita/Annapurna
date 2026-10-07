<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingReturn extends Model
{
    protected $fillable = [
        'booking_id',
        'return_date',
        'condition',
        'late_days',
        'late_fee',
        'damage_fee',
        'total_fine',
        'notes',
        'inspected_by',
    ];

    protected function casts(): array
    {
        return [
            'return_date' => 'datetime',
            'late_days' => 'integer',
            'late_fee' => 'integer',
            'damage_fee' => 'integer',
            'total_fine' => 'integer',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function inspector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inspected_by');
    }
}
