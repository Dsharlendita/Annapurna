<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Finance extends Model
{
    protected $fillable = [
        'finance_code',
        'ref',
        'type',
        'category',
        'line',
        'amount',
        'transaction_date',
        'description',
        'proof_file',
        'status',
        'void_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'transaction_date' => 'date',
        ];
    }

    public static function generateCode(string $type): string
    {
        $prefix = strtolower($type) === 'income' ? 'INC' : 'EXP';
        $count = static::where('type', $type)->count() + 1;
        return "{$prefix}-{$count}";
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
