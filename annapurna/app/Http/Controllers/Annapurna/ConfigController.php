<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConfigController extends Controller
{
    /**
     * GET /api/owner/konfigurasi
     * Mengambil seluruh pengaturan sistem toko.
     */
    public function index(): JsonResponse
    {
        $all = Setting::all();
        $config = [];

        foreach ($all as $item) {
            $decoded = json_decode($item->value, true);
            $config[$item->key] = (json_last_error() === JSON_ERROR_NONE) ? $decoded : $item->value;
        }

        return response()->json([
            'ok' => true,
            'config' => $config,
        ]);
    }

    /**
     * POST /api/owner/konfigurasi
     * Menyimpan satu bagian konfigurasi sistem dan mencatat audit log.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:100',
            'value' => 'required',
            'action' => 'nullable|string',
            'changes' => 'nullable|array',
        ]);

        $key = $validated['key'];
        $value = $validated['value'];
        $action = $validated['action'] ?? "Mengubah pengaturan {$key}";
        $changes = $validated['changes'] ?? [];

        Setting::set($key, $value);

        Audit::log('konfigurasi', $action, null, $changes);

        return response()->json([
            'ok' => true,
            'msg' => 'Konfigurasi berhasil disimpan.',
            'key' => $key,
            'value' => $value,
        ]);
    }
}
