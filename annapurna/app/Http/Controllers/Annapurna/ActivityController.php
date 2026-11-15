<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Support\Audit;
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

        $rows = ActivityLog::query()
            ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->where(fn ($q) => $q->where('subject_type', 'tampilan')
                ->orWhereIn('type', ['login', 'login_gagal', 'logout'])
                ->orWhere('role', 'system'))
            ->orderBy('id')
            ->limit(3000)
            ->get();

        $broken = ActivityLog::firstBrokenId();

        return response()->json([
            'ok' => true,
            'data' => [
                'entries' => $rows->map(fn ($l) => Audit::toFe($l))->values(),
                'integrity' => ['ok' => $broken === null, 'count' => ActivityLog::count(), 'brokenAt' => $broken ? 'L' . $broken : null],
            ],
        ]);
    }
}
