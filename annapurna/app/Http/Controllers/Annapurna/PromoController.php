<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Promo;
use App\Models\Sale;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromoController extends Controller
{
    /**
     * GET /api/owner/promos
     * Mengambil daftar seluruh promo & kode diskon beserta statistik performa.
     */
    public function index(): JsonResponse
    {
        $promos = Promo::latest()->get();

        $today = now()->toDateString();
        $activeCount = $promos->filter(fn ($p) => $p->is_active && (! $p->valid_until || $p->valid_until->toDateString() >= $today))->count();
        $homeCount = $promos->filter(fn ($p) => $p->is_active && $p->show_on_home)->count();

        $totalDiscountRent = (int) Booking::where('status', '!=', 'dibatalkan')->sum('discount_amount');
        $totalDiscountSale = 0; // jika sales memiliki discount

        $stats = [
            'active_count' => $activeCount,
            'total_promos' => $promos->count(),
            'home_count' => $homeCount,
            'total_discount_given' => $totalDiscountRent + $totalDiscountSale,
        ];

        return response()->json([
            'ok' => true,
            'stats' => $stats,
            'promos' => $promos,
        ]);
    }

    /**
     * POST /api/owner/promos
     * Membuat promo baru.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|min:3|max:20|unique:promos,code',
            'name' => 'required|string|max:150',
            'description' => 'nullable|string|max:500',
            'discount_type' => 'required|in:persen,nominal',
            'discount_value' => 'required|integer|min:1',
            'applies_to' => 'required|in:rent,buy,all',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
            'min_order' => 'nullable|integer|min:0',
            'max_discount' => 'nullable|integer|min:0',
            'quota' => 'nullable|integer|min:0',
            'weekday_only' => 'nullable|boolean',
            'show_on_home' => 'nullable|boolean',
        ]);

        $validated['code'] = strtoupper(preg_replace('/\s+/', '', $validated['code']));
        $validated['is_active'] = true;

        $promo = Promo::create($validated);

        Audit::log('promo', "Membuat kode promo {$promo->code} ({$promo->name})", null);

        return response()->json([
            'ok' => true,
            'msg' => 'Promo berhasil dibuat.',
            'promo' => $promo,
        ]);
    }

    /**
     * PUT /api/owner/promos/{id}
     * Memperbarui data promo.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $promo = Promo::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'description' => 'nullable|string|max:500',
            'discount_type' => 'required|in:persen,nominal',
            'discount_value' => 'required|integer|min:1',
            'applies_to' => 'required|in:rent,buy,all',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
            'min_order' => 'nullable|integer|min:0',
            'max_discount' => 'nullable|integer|min:0',
            'quota' => 'nullable|integer|min:0',
            'weekday_only' => 'nullable|boolean',
            'show_on_home' => 'nullable|boolean',
        ]);

        $promo->update($validated);

        Audit::log('promo', "Mengubah data promo {$promo->code}", null);

        return response()->json([
            'ok' => true,
            'msg' => 'Promo berhasil diperbarui.',
            'promo' => $promo,
        ]);
    }

    /**
     * POST /api/owner/promos/{id}/toggle
     * Mengaktifkan atau menonaktifkan kode promo.
     */
    public function toggle(int $id): JsonResponse
    {
        $promo = Promo::findOrFail($id);
        $promo->is_active = ! $promo->is_active;
        $promo->save();

        Audit::log(
            'promo',
            ($promo->is_active ? 'Mengaktifkan' : 'Menonaktifkan') . " promo {$promo->code}",
            null
        );

        return response()->json([
            'ok' => true,
            'msg' => $promo->is_active ? 'Promo diaktifkan.' : 'Promo dinonaktifkan.',
            'is_active' => $promo->is_active,
        ]);
    }

    /**
     * DELETE /api/owner/promos/{id}
     * Menghapus promo.
     */
    public function destroy(int $id): JsonResponse
    {
        $promo = Promo::findOrFail($id);
        $code = $promo->code;
        $promo->delete();

        Audit::log('promo', "Menghapus promo {$code}", null);

        return response()->json([
            'ok' => true,
            'msg' => "Promo {$code} berhasil dihapus.",
        ]);
    }

    /**
     * POST /api/promo/check (Public / Checkout)
     * Validasi kode kupon saat proses checkout pesanan.
     */
    public function check(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string',
            'amount' => 'required|integer|min:0',
            'applies' => 'nullable|in:rent,buy',
            'date' => 'nullable|date',
        ]);

        $code = strtoupper(trim($validated['code']));
        $promo = Promo::where('code', $code)->first();

        if (! $promo) {
            return response()->json([
                'ok' => false,
                'msg' => 'Kode promo tidak ditemukan.',
                'discount' => 0,
            ], 404);
        }

        $result = $promo->calculateDiscount(
            amount: (int) $validated['amount'],
            applies: $validated['applies'] ?? 'rent',
            date: $validated['date'] ?? null
        );

        if (! $result['valid']) {
            return response()->json([
                'ok' => false,
                'msg' => $result['message'],
                'discount' => 0,
            ], 422);
        }

        return response()->json([
            'ok' => true,
            'msg' => 'Promo berhasil diterapkan!',
            'discount' => $result['discount'],
            'promo' => $promo,
        ]);
    }
}
