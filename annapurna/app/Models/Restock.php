<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Restock extends Model
{
    protected $fillable = [
        'product_id',
        'kind',
        'variant',
        'qty',
        'unit_cost',
        'total_cost',
        'supplier',
        'note',
        'unit_codes',
        'restock_date',
        'finance_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_cost' => 'integer',
            'total_cost' => 'integer',
            'unit_codes' => 'array',
            'restock_date' => 'date',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function finance(): BelongsTo
    {
        return $this->belongsTo(Finance::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
