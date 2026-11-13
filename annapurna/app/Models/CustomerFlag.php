<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Status pelanggan dari Owner: normal, perlu jaminan tambahan, atau diblokir. */
class CustomerFlag extends Model
{
    protected $fillable = ['email', 'phone', 'flag', 'note', 'updated_by'];

    public static function normPhone(?string $p): string
    {
        return preg_replace('/^62/', '0', preg_replace('/\D/', '', (string) $p));
    }

    /**
     * Apakah email ATAU nomor HP ini diblokir? Nomor HP dicocokkan dengan nomor yang
     * tercatat untuk email yang diblokir (di status, akun, dan booking lama),
     * supaya tidak bisa diakali dengan ganti email/nama.
     */
    public static function isBlocked(?string $email, ?string $phone): bool
    {
        $email = strtolower(trim((string) $email));
        $blocked = static::where('flag', 'blacklist')->get(['email', 'phone']);
        if ($blocked->isEmpty()) {
            return false;
        }
        if ($email !== '' && $blocked->contains(fn ($f) => strtolower($f->email) === $email)) {
            return true;
        }
        $ph = self::normPhone($phone);
        if ($ph === '') {
            return false;
        }
        $emails = $blocked->pluck('email')->map(fn ($e) => strtolower($e))->all();
        $phones = $blocked->pluck('phone')
            ->merge(User::whereIn('email', $emails)->pluck('phone'))
            ->merge(Booking::whereIn('customer_email', $emails)->pluck('customer_phone'))
            ->merge(Sale::whereIn('customer_email', $emails)->pluck('customer_phone'))
            ->map(fn ($p) => self::normPhone($p))
            ->filter();

        return $phones->contains($ph);
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
