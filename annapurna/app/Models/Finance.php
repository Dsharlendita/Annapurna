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
        'source',
        'status',
        'void_reason',
        'voided_by',
        'voided_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'transaction_date' => 'date',
            'voided_at' => 'datetime',
        ];
    }

    /**
     * Kode baru INC-n / EXP-n. Nomor diambil dari id terakhir (bukan jumlah baris),
     * jadi tidak bentrok dengan kode yang dibuat tampilan maupun baris yang dibatalkan.
     */
    public static function generateCode(string $type): string
    {
        $prefix = strtolower($type) === 'income' ? 'INC' : 'EXP';
        $n = (int) static::max('id') + 1;
        while (static::where('finance_code', "{$prefix}-{$n}")->exists()) {
            $n++;
        }

        return "{$prefix}-{$n}";
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }
}
