<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleDelivery extends Model
{
    protected $fillable = [
        'sale_id',
        'method',
        'address',
        'ongkir',
        'courier_name',
        'courier_phone',
        'expedition',
        'tracking_no',
        'ship_status',
        'ship_date',
        'notified_at',
    ];

    protected function casts(): array
    {
        return [
            'ongkir' => 'integer',
            'ship_date' => 'date',
            'notified_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}
