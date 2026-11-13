<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Notifikasi lonceng untuk satu akun. */
class UserNotification extends Model
{
    protected $fillable = ['user_id', 'title', 'body', 'link', 'count', 'read_at'];

    protected function casts(): array
    {
        return [
            'count' => 'integer',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Kirim notifikasi ke akun berdasarkan email. Notifikasi yang sama (judul + tautan)
     * yang belum dibaca digabung menjadi satu, sama seperti perilaku di tampilan.
     */
    public static function send(string $email, string $title, string $body, ?string $link = null): ?self
    {
        $user = User::where('email', $email)->first();
        if (! $user) {
            return null;
        }
        $dup = static::where('user_id', $user->id)->whereNull('read_at')->where('title', $title)->where('link', $link ?: null)->first();
        if ($dup) {
            $dup->update(['body' => $body, 'count' => $dup->count + 1]);
            $dup->touch();

            return $dup;
        }

        return static::create(['user_id' => $user->id, 'title' => $title, 'body' => $body, 'link' => $link ?: null]);
    }
}
