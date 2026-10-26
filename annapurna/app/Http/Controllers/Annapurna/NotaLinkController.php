<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\NotaLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class NotaLinkController extends Controller
{
    /**
     * Membuat tautan nota pendek untuk dibagikan ke WhatsApp.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'kind' => 'required|string|in:rent,sale,laundry',
            'id' => 'required|string',
            'payload' => 'required|string',
        ]);

        $kind = $request->input('kind');
        $refId = $request->input('id');
        $payload = $request->input('payload');

        // Cek apakah sudah pernah dibuat link untuk transaksi & isi payload yang sama
        $existing = NotaLink::where('kind', $kind)
            ->where('ref_id', $refId)
            ->where('payload', $payload)
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => true,
                'data' => [
                    'token' => $existing->token,
                    'url' => url('/n/' . $existing->token),
                ]
            ]);
        }

        // Generate token unik 8 karakter alphanumeric
        do {
            $token = Str::random(8);
        } while (NotaLink::where('token', $token)->exists());

        $notaLink = NotaLink::create([
            'token' => $token,
            'kind' => $kind,
            'ref_id' => $refId,
            'payload' => $payload,
            'created_by' => Auth::id(),
            'expires_at' => now()->addDays(90),
        ]);

        return response()->json([
            'ok' => true,
            'data' => [
                'token' => $notaLink->token,
                'url' => url('/n/' . $notaLink->token),
            ]
        ]);
    }

    /**
     * Mengakses tautan nota pendek dan mengarahkan ke halaman invoice dengan snapshot asli.
     */
    public function show(string $token): RedirectResponse
    {
        $link = NotaLink::where('token', $token)->first();

        if (!$link) {
            return redirect()->route('home')->with('error', 'Nota digital tidak ditemukan.');
        }

        // Redirect langsung ke invoice dengan parameter id dan snapshot payload
        return redirect()->route('invoice', [
            'id' => $link->ref_id,
            's' => $link->payload,
        ]);
    }
}
