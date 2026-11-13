<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Pengaturan toko dalam bentuk key → value (value disimpan sebagai JSON).
 *
 * Nama kunci selalu disimpan dalam snake_case (dp_percent, cancel_days, dur_rules, …).
 * Tampilan mengirim camelCase (dpPercent, cancelDays, durRules); keduanya diterima
 * dan diarahkan ke baris yang sama, supaya pengaturan dari Owner benar-benar dipakai server.
 */
class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    public static function normalizeKey(string $key): string
    {
        return Str::snake($key);
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', self::normalizeKey($key))->first();
        if (!$setting || $setting->value === null) {
            return $default;
        }

        $decoded = json_decode($setting->value, true);
        return (json_last_error() === JSON_ERROR_NONE) ? $decoded : $setting->value;
    }

    public static function set(string $key, mixed $value): void
    {
        $encoded = is_array($value) || is_object($value) ? json_encode($value) : (string) $value;
        static::updateOrCreate(['key' => self::normalizeKey($key)], ['value' => $encoded]);
    }
}
