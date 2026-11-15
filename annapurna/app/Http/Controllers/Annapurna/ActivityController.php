<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Support\Audit;
use App\Support\Rekap;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/owner/aktivitas?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Histori aktivitas semua perangkat untuk halaman Histori Sistem (Owner).
 *
 * Yang ditampilkan: catatan rinci dari tampilan (aksi staff di panel) + catatan yang hanya dibuat server
 * (masuk / gagal masuk / keluar, dan aksi sistem). Catatan server lain untuk aksi yang sama tetap tersimpan
 * di rantai hash, tetapi tidak ditampilkan dua kali.
 */
class ActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $v = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = $v['from'] ?? now()->subDays(90)->toDateString();
        $to = $v['to'] ?? now()->toDateString();

        $broken = ActivityLog::firstBrokenId();

        return response()->json([
            'ok' => true,
            'data' => [
                'entries' => self::entries($from, $to, 3000),
                'integrity' => ['ok' => $broken === null, 'count' => ActivityLog::count(), 'brokenAt' => $broken ? 'L' . $broken : null],
            ],
        ]);
    }

    private static function entries(string $from, string $to, int $limit)
    {
        return ActivityLog::query()
            ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->where(fn ($q) => $q->where('subject_type', 'tampilan')
                ->orWhereIn('type', ['login', 'login_gagal', 'logout'])
                ->orWhere('role', 'system'))
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn ($l) => Audit::toFe($l))
            ->values();
    }

    /**
     * GET /api/admin/rekap/{period}/aktivitas
     * Aktivitas & login staff satu bulan untuk PDF rekap (dari semua perangkat, bukan isi browser).
     * Owner: bulan mana pun. Admin: hanya bulan yang rekap otomatisnya sedang jatuh tempo.
     */
    public function rekap(Request $request, string $period): JsonResponse
    {
        abort_unless(preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period), 404);
        if ($request->user()->role !== 'owner' && $period !== Rekap::duePeriod()) {
            return response()->json(['message' => 'Rekap bulan ini hanya bisa dibuat Owner.'], 403);
        }
        $start = CarbonImmutable::parse($period . '-01');

        return response()->json(['ok' => true, 'data' => ['entries' => self::entries($start->toDateString(), $start->endOfMonth()->toDateString(), 20000)]]);
    }
}
