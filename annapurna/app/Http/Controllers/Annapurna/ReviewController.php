<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ReviewController extends Controller
{
    /**
     * GET /api/admin/ulasan
     * Mengambil daftar ulasan untuk panel admin / owner dengan tab & statistik.
     */
    public function index(Request $request): JsonResponse
    {
        $tab = $request->input('tab', 'semua');
        $q = $request->input('q');
        $rating = $request->input('rating');

        $query = Review::with(['booking', 'sale', 'product', 'replier']);

        // Filter Tab
        match ($tab) {
            'baru' => $query->where('created_at', '>=', now()->subDays(7)),
            'beranda' => $query->where('is_featured', true)->where('is_visible', true)->orderBy('featured_order'),
            'rendah' => $query->where('rating', '<=', 3),
            'sembunyi' => $query->where('is_visible', false),
            default => $query->latest(),
        };

        // Pencarian
        if (! empty($q)) {
            $query->where(function ($sub) use ($q) {
                $sub->where('customer_name', 'like', "%{$q}%")
                    ->orWhere('comment', 'like', "%{$q}%");
            });
        }

        // Filter Rating spesifik
        if (! empty($rating)) {
            $query->where('rating', (int) $rating);
        }

        $reviews = $query->get();

        // Statistik
        $all = Review::all();
        $visible = $all->where('is_visible', true);
        $avgRating = $visible->count() > 0 ? round($visible->avg('rating'), 1) : 5.0;

        $stats = [
            'avg_rating' => $avgRating,
            'total_reviews' => $all->count(),
            'featured_count' => $all->where('is_featured', true)->where('is_visible', true)->count(),
            'hidden_count' => $all->where('is_visible', false)->count(),
            'tab_counts' => [
                'semua' => $all->count(),
                'baru' => $all->filter(fn ($r) => $r->created_at >= now()->subDays(7))->count(),
                'beranda' => $all->where('is_featured', true)->where('is_visible', true)->count(),
                'rendah' => $all->where('rating', '<=', 3)->count(),
                'sembunyi' => $all->where('is_visible', false)->count(),
            ],
        ];

        return response()->json([
            'ok' => true,
            'stats' => $stats,
            'reviews' => $reviews,
        ]);
    }

    /**
     * POST /api/ulasan (Public / Customer)
     * Mengirimkan ulasan dan rating kepuasan pelanggan.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'booking_id' => 'nullable|exists:bookings,id',
            'sale_id' => 'nullable|exists:sales,id',
            'product_id' => 'nullable|exists:products,id',
            'customer_name' => 'required|string|max:100',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'required|string|max:1000',
        ]);

        $review = Review::create([
            'booking_id' => $validated['booking_id'] ?? null,
            'sale_id' => $validated['sale_id'] ?? null,
            'user_id' => Auth::id(),
            'product_id' => $validated['product_id'] ?? null,
            'customer_name' => $validated['customer_name'],
            'rating' => (int) $validated['rating'],
            'comment' => $validated['comment'],
            'is_featured' => false,
            'is_visible' => true,
        ]);

        return response()->json([
            'ok' => true,
            'msg' => 'Terima kasih! Ulasan Anda berhasil dikirim.',
            'review' => $review,
        ]);
    }

    /**
     * POST /api/admin/ulasan/{id}/toggle-feature
     * Menandai ulasan untuk tampil di Beranda Website (maksimal 6).
     */
    public function toggleFeature(Request $request, int $id): JsonResponse
    {
        $review = Review::findOrFail($id);

        if (! $review->is_featured) {
            $currentFeaturedCount = Review::where('is_featured', true)->where('is_visible', true)->count();
            if ($currentFeaturedCount >= 6) {
                return response()->json([
                    'ok' => false,
                    'msg' => 'Maksimal 6 ulasan di beranda. Hapus salah satu terlebih dahulu.',
                ], 422);
            }
            $review->is_featured = true;
            $review->featured_order = $currentFeaturedCount + 1;
        } else {
            $review->is_featured = false;
        }

        $review->save();

        Audit::log(
            'ulasan',
            ($review->is_featured ? 'Menampilkan' : 'Melepas') . " ulasan {$review->customer_name} pada beranda",
            $review->booking ?? null
        );

        return response()->json([
            'ok' => true,
            'msg' => $review->is_featured ? 'Ulasan ditampilkan di beranda.' : 'Ulasan dilepas dari beranda.',
            'is_featured' => $review->is_featured,
        ]);
    }

    /**
     * POST /api/admin/ulasan/{id}/toggle-visibility
     * Menyembunyikan atau menampilkan kembali ulasan (moderasi).
     */
    public function toggleVisibility(Request $request, int $id): JsonResponse
    {
        $review = Review::findOrFail($id);
        $review->is_visible = ! $review->is_visible;

        if (! $review->is_visible) {
            $review->is_featured = false;
        }

        $review->save();

        Audit::log(
            'ulasan',
            ($review->is_visible ? 'Menampilkan kembali' : 'Menyembunyikan') . " ulasan {$review->customer_name}",
            $review->booking ?? null
        );

        return response()->json([
            'ok' => true,
            'msg' => $review->is_visible ? 'Ulasan ditampilkan kembali.' : 'Ulasan berhasil disembunyikan.',
            'is_visible' => $review->is_visible,
        ]);
    }

    /**
     * POST /api/admin/ulasan/{id}/reply
     * Menyimpan balasan toko terhadap ulasan pelanggan.
     */
    public function reply(Request $request, int $id): JsonResponse
    {
        $review = Review::findOrFail($id);

        $validated = $request->validate([
            'reply' => 'required|string|max:500',
        ]);

        $review->reply = $validated['reply'];
        $review->reply_at = now();
        $review->replied_by = Auth::id();
        $review->save();

        Audit::log(
            'ulasan',
            "Membalas ulasan {$review->customer_name}: \"{$review->reply}\"",
            $review->booking ?? null
        );

        return response()->json([
            'ok' => true,
            'msg' => 'Balasan toko berhasil disimpan.',
            'review' => $review->fresh('replier'),
        ]);
    }

    /**
     * POST /api/admin/ulasan/reorder
     * Mengatur urutan ulasan testimoni di beranda.
     */
    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:reviews,id',
        ]);

        foreach ($validated['ids'] as $order => $id) {
            Review::where('id', $id)->update(['featured_order' => $order + 1]);
        }

        return response()->json([
            'ok' => true,
            'msg' => 'Urutan testimoni beranda berhasil diperbarui.',
        ]);
    }
}
