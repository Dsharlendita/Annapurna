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

    /**
     * Catatan histori yang dibuat tampilan (DB.audit di data.js). Disimpan dengan subject_type 'tampilan'
     * dan subject_id = kode yang dirujuk (mis. nota booking). Kiriman ulang dengan client_ref sama diabaikan.
     */
    public static function fromClient(array $e, User $actor): ?ActivityLog
    {
        if (! $actor->isStaff() || empty($e['action'])) {
            return null;
        }
        $ref = $actor->id . ':' . mb_substr((string) ($e['hash'] ?? $e['id'] ?? ''), 0, 100);
        if ($found = ActivityLog::where('client_ref', $ref)->first()) {
            return $found;
        }
        $changes = array_values(array_filter((array) ($e['changes'] ?? []), 'is_array'));

        return DB::transaction(function () use ($e, $actor, $ref, $changes) {
            $last = ActivityLog::query()->lockForUpdate()->latest('id')->first();
            $prev = $last?->hash ?? str_repeat('0', 64);
            $attrs = [
                'user_id' => $actor->id,
                'user_name' => $actor->name,
                'role' => $actor->role,
                'type' => mb_substr((string) ($e['type'] ?? 'lainnya'), 0, 30),
                'action' => mb_substr((string) $e['action'], 0, 500),
                'subject_type' => 'tampilan',
                'subject_id' => isset($e['ref']) ? mb_substr((string) $e['ref'], 0, 191) : null,
                'changes' => array_slice($changes, 0, 30),
                'created_at' => now()->toIso8601String(),
            ];
            $log = new ActivityLog($attrs + [
                'client_ref' => $ref,
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

    /** Catatan histori dalam bentuk tampilan (sama dengan isi DB.audits()). */
    public static function toFe(ActivityLog $l): array
    {
        return array_filter([
            'id' => 'L' . $l->id,
            'at' => $l->created_at?->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            'userId' => $l->user_id ? 'u' . $l->user_id : 'system',
            'userName' => $l->user_name,
            'role' => $l->role,
            'type' => $l->type,
            'action' => $l->action,
            'ref' => $l->subject_type === 'tampilan' ? $l->subject_id : null,
            'changes' => $l->getAttribute('changes') ?: null,
            'hash' => $l->hash,
        ], fn ($v) => $v !== null);
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
