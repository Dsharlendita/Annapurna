<?php

namespace App\Support;

use App\Models\User;

/** Jawaban JSON setelah berhasil masuk (dipakai login kata sandi & login dengan kode). */
class AuthPayload
{
    public static function user(User $user): array
    {
        return [
            'id' => 'u' . $user->id,
            'userId' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'phone' => $user->phone ?? '',
            'address' => $user->address ?? '',
            'mustChangePw' => (bool) $user->must_change_password,
            // false = akun dari Google yang belum punya kata sandi sendiri (ganti sandi tanpa kata sandi lama)
            'hasPassword' => (bool) ($user->password_set ?? true),
        ];
    }

    /**
     * Tujuan setelah masuk hanya boleh halaman di website ini (mis. "checkout" atau "/pesanan").
     * Alamat situs lain ("https://…", "//…", "\\…", "javascript:…") ditolak supaya tautan masuk
     * tidak bisa dipakai untuk mengarahkan pengguna ke situs palsu (open redirect).
     */
    public static function safeNext(?string $next): ?string
    {
        $next = trim((string) $next);
        if ($next === '' || strlen($next) > 300 || preg_match('/[\x00-\x1f\x7f\\\\]/', $next)
            || preg_match('#^([a-z][a-z0-9+.\-]*:|//)#i', $next)) {
            return null;
        }

        return $next;
    }

    public static function redirect(User $user, ?string $next = null): string
    {
        if ($next = self::safeNext($next)) {
            return $next;
        }

        return match ($user->role) {
            'owner' => route('owner.dashboard'),
            'admin' => route('admin.dashboard'),
            default => route('home'),
        };
    }
}
