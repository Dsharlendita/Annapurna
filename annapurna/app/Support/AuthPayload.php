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

    public static function redirect(User $user, ?string $next = null): string
    {
        if ($next) {
            return $next;
        }

        return match ($user->role) {
            'owner' => route('owner.dashboard'),
            'admin' => route('admin.dashboard'),
            default => route('home'),
        };
    }
}
