<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Pencatat histori otomatis. Contoh:
 *   Audit::log('harga', "Mengubah harga {$p->name}", $p, [['field' => 'Harga sewa / hari', 'from' => 'Rp50.000', 'to' => 'Rp55.000']]);
 * Hanya aktivitas Owner/Admin (dan Sistem) yang dicatat.
 */
class Audit
{
    public static function log(string $type, string $action, ?Model $subject = null, array $changes = [], ?User $actor = null, bool $system = false): ?ActivityLog
    {
        $actor ??= Auth::user();
        if (! $system && (! $actor || ! $actor->isStaff())) {
            return null;
        }

        return DB::transaction(function () use ($type, $action, $subject, $changes, $actor, $system) {
            $last = ActivityLog::query()->lockForUpdate()->latest('id')->first();
            $prev = $last?->hash ?? str_repeat('0', 64);
            $attrs = [
                'user_id' => $system ? null : $actor->id,
                'user_name' => $system ? 'Sistem' : $actor->name,
                'role' => $system ? 'system' : $actor->role,
                'type' => $type,
                'action' => $action,
                'subject_type' => $subject ? $subject::class : null,
                'subject_id' => $subject ? (string) $subject->getKey() : null,
                'changes' => $changes,
                'created_at' => now()->toIso8601String(),
            ];
            $log = new ActivityLog($attrs + [
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'prev_hash' => $prev,
                'hash' => ActivityLog::hashFor($attrs, $prev),
            ]);
            $log->created_at = $attrs['created_at'];
            $log->save();

            return $log;
        });
    }

    /** Bandingkan atribut model sebelum & sesudah; kembalikan daftar perubahan untuk kolom yang diberi label. */
    public static function diff(array $before, array $after, array $labels): array
    {
        $out = [];
        foreach ($labels as $key => $label) {
            if (($before[$key] ?? null) != ($after[$key] ?? null)) {
                $out[] = ['field' => $label, 'from' => (string) ($before[$key] ?? ''), 'to' => (string) ($after[$key] ?? '')];
            }
        }

        return $out;
    }
}
