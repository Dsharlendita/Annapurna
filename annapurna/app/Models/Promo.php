<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promo extends Model
{
    protected $fillable = [
        'code',
        'discount_type',
        'discount_value',
        'min_order',
        'max_discount',
        'valid_until',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'integer',
            'min_order' => 'integer',
            'max_discount' => 'integer',
            'valid_until' => 'date',
            'is_active' => 'boolean',
        ];
    }
}
