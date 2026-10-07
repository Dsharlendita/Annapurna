<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * Satu baris histori sistem. Append-only: update & delete ditolak di level model.
 * Tambahkan juga hak DB yang hanya mengizinkan INSERT/SELECT pada tabel ini untuk user aplikasi.
 */
class ActivityLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'user_name', 'role', 'type', 'action', 'subject_type', 'subject_id',
        'changes', 'ip_address', 'user_agent', 'prev_hash', 'hash',
    ];

    protected function casts(): array
    {
        return ['changes' => 'array', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Histori sistem tidak boleh diubah.'));
        static::deleting(fn () => throw new LogicException('Histori sistem tidak boleh dihapus.'));
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function hashFor(array $attrs, string $prev): string
    {
        return hash('sha256', $prev.'|'.json_encode([
            $attrs['user_id'] ?? null, $attrs['user_name'], $attrs['role'], $attrs['type'], $attrs['action'],
            $attrs['subject_id'] ?? null, $attrs['changes'] ?? [], $attrs['created_at'],
        ], JSON_UNESCAPED_UNICODE));
    }

    public static function record(?int $userId, string $type, string $action, ?string $subjectType = null, ?string $subjectId = null, ?array $changes = null): static
    {
        $user = $userId ? User::find($userId) : null;
        $prevLog = static::latest('id')->first();
        $prevHash = $prevLog ? $prevLog->hash : str_repeat('0', 64);

        $attrs = [
            'user_id' => $userId,
            'user_name' => $user ? $user->name : 'Sistem',
            'role' => $user ? $user->role : 'system',
            'type' => $type,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'changes' => $changes,
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
            'prev_hash' => $prevHash,
            'created_at' => now()->toIso8601String(),
        ];

        $attrs['hash'] = static::hashFor($attrs, $prevHash);

        return static::create($attrs);
    }

    /** Periksa rantai hash dari awal. Mengembalikan id baris pertama yang rusak, atau null bila utuh. */
    public static function firstBrokenId(): ?int
    {
        $prev = str_repeat('0', 64);
        foreach (static::orderBy('id')->cursor() as $log) {
            $attrs = $log->getAttributes();
            $attrs['changes'] = $log->changes ?? [];
            $attrs['created_at'] = $log->created_at->toIso8601String();
            if ($log->prev_hash !== $prev || static::hashFor($attrs, $prev) !== $log->hash) {
                return $log->id;
            }
            $prev = $log->hash;
        }

        return null;
    }
}
