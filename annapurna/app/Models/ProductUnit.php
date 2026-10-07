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
        'condition',
        'status',
        'rents_count',
        'since_service',
        'last_service',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'rents_count' => 'integer',
            'since_service' => 'integer',
            'last_service' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}
