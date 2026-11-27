<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Satu baris histori sistem. Append-only: update & delete ditolak di level model.
 * Tambahkan juga hak DB yang hanya mengizinkan INSERT/SELECT pada tabel ini untuk user aplikasi.
 */
class ActivityLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'user_name', 'role', 'type', 'action', 'subject_type', 'subject_id', 'client_ref',
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
            $attrs['subject_id'] ?? null, self::canonical($attrs['changes'] ?? []), $attrs['created_at'],
        ], JSON_UNESCAPED_UNICODE));
    }

    /**
     * Urutkan kunci objek secara abjad (rekursif). Kolom JSON MySQL menyimpan kunci dengan urutan
     * sendiri ({"to","from","field"}), jadi tanpa ini hash yang dihitung ulang tidak cocok.
     */
    private static function canonical(mixed $v): mixed
    {
        if (! is_array($v)) {
            return $v;
        }
        if (! array_is_list($v)) {
            ksort($v);
        }

        return array_map(fn ($x) => self::canonical($x), $v);
    }

    /**
     * Ambil catatan terakhir untuk disambung, sambil memegang KUNCI RANTAI (panggil di dalam transaksi).
     *
     * Dulu cukup `lockForUpdate()->latest('id')`, tetapi di MySQL itu ikut mengunci celah setelah baris terakhir
     * (next-key lock). Dua penulis yang datang bersamaan lalu saling menunggu saat INSERT → "1213 Deadlock" (terjadi di
     * hosting saat beberapa unit ditandai bersih berturut-turut). Sekarang semua penulis antre di SATU baris tetap
     * document_sequences (prefix AUDIT), dikunci lewat kunci unik = kunci baris saja tanpa celah, jadi bergiliran rapi.
     */
    public static function lockHead(): ?self
    {
        $head = fn () => DB::table('document_sequences')->where('prefix', 'AUDIT')->where('year', 0)->where('month', 0)->lockForUpdate()->first();
        if (! $head()) {
            DB::table('document_sequences')->insertOrIgnore(['prefix' => 'AUDIT', 'year' => 0, 'month' => 0, 'last_number' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $head();
        }

        return static::query()->lockForUpdate()->latest('id')->first();
    }

    public static function record(?int $userId, string $type, string $action, ?string $subjectType = null, ?string $subjectId = null, ?array $changes = null): static
    {
        return DB::transaction(fn () => static::recordLocked($userId, $type, $action, $subjectType, $subjectId, $changes), 3);
    }

    private static function recordLocked(?int $userId, string $type, string $action, ?string $subjectType, ?string $subjectId, ?array $changes): static
    {
        $user = $userId ? User::find($userId) : null;
        $prevLog = static::lockHead();
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
            // getAttribute(): di dalam model, $log->changes membaca properti internal Eloquent ($changes),
            // bukan kolom "changes" — dulu membuat setiap catatan berisi rincian perubahan dianggap rusak.
            $attrs['changes'] = $log->getAttribute('changes') ?? [];
            $attrs['created_at'] = $log->created_at->toIso8601String();
            if ($log->prev_hash !== $prev || static::hashFor($attrs, $prev) !== $log->hash) {
                return $log->id;
            }
            $prev = $log->hash;
        }

        return null;
    }
}
