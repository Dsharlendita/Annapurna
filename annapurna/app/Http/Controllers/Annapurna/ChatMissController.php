<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ChatMiss;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatMissController extends Controller
{
    /**
     * Merekam pertanyaan chatbot yang belum terjawab ke database.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'question' => 'required|string|min:3|max:500',
        ]);

        $miss = ChatMiss::record((string) $request->input('question'));
        if (! $miss) {
            return response()->json(['ok' => false, 'msg' => 'Pertanyaan terlalu pendek.']);
        }

        return response()->json([
            'ok' => true,
            'data' => $miss,
        ]);
    }

    /**
     * Mengambil daftar pertanyaan yang belum terjawab untuk ditinjau Owner.
     */
    public function index(Request $request): JsonResponse
    {
        $misses = ChatMiss::whereNull('dismissed_at')
            ->orderByDesc('count')
            ->orderByDesc('last_at')
            ->take(200)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $misses,
        ]);
    }

    /**
     * Mengabaikan/menghapus pertanyaan dari daftar tinjau Owner.
     */
    public function dismiss(int|string $id): JsonResponse
    {
        $miss = is_numeric($id) ? ChatMiss::find($id) : ChatMiss::where('question_norm', $id)->first();

        if ($miss) {
            $miss->update(['dismissed_at' => now()]);
        }

        return response()->json([
            'ok' => true,
            'msg' => 'Pertanyaan berhasil diabaikan.',
        ]);
    }
}
