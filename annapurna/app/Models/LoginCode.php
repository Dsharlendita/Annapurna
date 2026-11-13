<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;

/**
 * Kode verifikasi 6 digit (dikirim lewat email).
 * Berlaku 10 menit, maksimal 5 kali salah ketik, sekali pakai.
 */
class LoginCode extends Model
{
    public const VALID_MINUTES = 10;
    public const MAX_ATTEMPTS = 5;
    public const RESEND_SECONDS = 60;
    public const MAX_PER_HOUR = 5;

    protected $fillable = ['user_id', 'purpose', 'code_hash', 'sent_to', 'attempts', 'expires_at', 'used_at', 'ip_address'];

    protected $hidden = ['code_hash'];

    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    /** Buat kode baru (kode lama yang belum dipakai otomatis tidak berlaku). Mengembalikan [model, angka kode]. */
    public static function issue(User $user, string $purpose, string $email, ?string $ip): array
    {
        static::where('user_id', $user->id)->where('purpose', $purpose)->whereNull('used_at')->update(['used_at' => now()]);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $row = static::create([
            'user_id' => $user->id,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'sent_to' => $email,
            'expires_at' => now()->addMinutes(self::VALID_MINUTES),
            'ip_address' => $ip,
        ]);

        return [$row, $code];
    }

    /** Kode aktif terakhir untuk akun & keperluan ini (belum dipakai, belum kedaluwarsa, belum terlalu banyak salah). */
    public static function active(User $user, string $purpose): ?self
    {
        return static::where('user_id', $user->id)->where('purpose', $purpose)->whereNull('used_at')
            ->where('expires_at', '>', now())->where('attempts', '<', self::MAX_ATTEMPTS)
            ->latest('id')->first();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
