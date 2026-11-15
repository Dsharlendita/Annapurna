<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductUnit extends Model
{
    protected $fillable = [
        'product_id',
        'unit_code',
        'size',
        'purchase_cost',
        'condition',
        'status',
        'out_ref',
        'care',
        'care_info',
        'rents_count',
        'since_service',
        'last_service',
        'notes',
        'history',
    ];

    protected function casts(): array
    {
        return [
            'purchase_cost' => 'integer',
            'rents_count' => 'integer',
            'since_service' => 'integer',
            'last_service' => 'datetime',
            'care_info' => 'array',
            'history' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}
