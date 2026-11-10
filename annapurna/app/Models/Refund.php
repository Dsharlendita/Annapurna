<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Refund extends Model
{
    protected $fillable = [
        'booking_id',
        'amount',
        'method',          // transfer | tunai
        'bank_name',
        'account_number',
        'account_name',
        'bank_account',    // ringkasan lama: "BCA 1234567890 a.n. Nama"
        'transfer_ref',
        'proof_file',      // foto bukti transfer / serah terima (disk public)
        'reason',
        'status',          // menunggu | selesai | hangus | tidak_perlu
        'requested_by',    // customer | admin
        'processed_by',
        'processed_at',
        'notified_at',     // konfirmasi WhatsApp ke customer
    ];

    protected $appends = ['proof_url'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'processed_at' => 'datetime',
            'notified_at' => 'datetime',
        ];
    }

    public function getProofUrlAttribute(): ?string
    {
        return $this->proof_file ? Storage::disk('public')->url($this->proof_file) : null;
    }

    /** Ringkasan rekening untuk kolom lama `bank_account`. */
    public static function accountSummary(?string $bank, ?string $number, ?string $name): ?string
    {
        $s = trim(implode(' ', array_filter([$bank, $number])) . ($name ? " a.n. {$name}" : ''));
        return $s !== '' ? mb_substr($s, 0, 100) : null;
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
