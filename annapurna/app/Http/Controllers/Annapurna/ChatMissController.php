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

        $raw = trim($request->input('question'));
        $norm = strtolower(preg_replace('/[^a-z0-9 ]+/i', ' ', $raw));
        $norm = trim(preg_replace('/\s+/', ' ', $norm));
        $norm = substr($norm, 0, 255);

        if (strlen($norm) < 3) {
            return response()->json(['ok' => false, 'msg' => 'Pertanyaan terlalu pendek.']);
        }

        $miss = ChatMiss::where('question_norm', $norm)->first();

        if ($miss) {
            $miss->increment('count');
            $miss->update(['last_at' => now()]);
        } else {
            $miss = ChatMiss::create([
                'question_norm' => $norm,
                'question_text' => mb_substr($raw, 0, 255),
                'count' => 1,
                'first_at' => now(),
                'last_at' => now(),
            ]);
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
