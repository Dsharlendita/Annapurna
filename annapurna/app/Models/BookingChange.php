<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingChange extends Model
{
    protected $fillable = [
        'booking_id',
        'from_product_id',
        'from_product_name',
        'to_product_id',
        'to_product_name',
        'to_size',
        'qty',
        'price_diff',
        'reason',
        'admin_note',
        'source',
        'status',
        'action_by',
        'action_at',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'price_diff' => 'integer',
            'action_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function actionUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'action_by');
    }
}
