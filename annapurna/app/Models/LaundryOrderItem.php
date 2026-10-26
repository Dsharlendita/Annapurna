<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LaundryOrderItem extends Model
{
    protected $fillable = [
        'laundry_order_id',
        'laundry_item_id',
        'item_name',
        'category',
        'qty',
        'unit_price',
        'subtotal',
        'is_custom',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_price' => 'integer',
            'subtotal' => 'integer',
            'is_custom' => 'boolean',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(LaundryOrder::class, 'laundry_order_id');
    }

    public function laundryItem(): BelongsTo
    {
        return $this->belongsTo(LaundryItem::class, 'laundry_item_id', 'id');
    }
}
