<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Category;
use App\Models\Package;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Promo;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ApiController extends Controller
{
    /**
     * Mengambil daftar kategori aktif.
     */
    public function categories(): JsonResponse
    {
        $categories = Category::where('active', true)->get();
        return response()->json(['ok' => true, 'data' => $categories]);
    }

    /**
     * Mengambil daftar produk (sewa / beli).
     */
    public function products(Request $request): JsonResponse
    {
        $query = Product::where('is_active', true)->with('category');

        if ($request->filled('cat') && $request->input('cat') !== 'all') {
            $query->where('category_id', $request->input('cat'));
        }

        if ($request->filled('mode')) {
            if ($request->input('mode') === 'rent') {
                $query->where('rent_price', '>', 0);
            } elseif ($request->input('mode') === 'buy') {
                $query->where('sale_price', '>', 0);
            }
        }

        if ($request->filled('q')) {
            $searchTerm = '%' . $request->input('q') . '%';
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', $searchTerm)
                  ->orWhere('brand', 'like', $searchTerm)
                  ->orWhere('sku', 'like', $searchTerm);
            });
        }

        $products = $query->get()->map(function ($p) {
            return [
                'id' => $p->id,
                'name' => $p->name,
                'cat' => $p->category_id,
                'brand' => $p->brand,
                'sku' => $p->sku,
                'img' => $p->img,
                'rent' => $p->rent_price,
                'price' => $p->sale_price,
                'stock' => $p->stock,
                'rating' => (float)$p->rating,
                'reviews' => $p->reviews_count,
                'cond' => $p->condition,
                'badge' => $p->badge,
                'featured' => $p->is_featured,
                'active' => $p->is_active,
                'desc' => $p->description,
                'specs' => $p->specs ?? [],
                'attrs' => $p->attrs ?? [],
                'color' => $p->color,
                'material' => $p->material,
                'weight' => $p->weight,
                'dimension' => $p->dimension,
                'includes' => $p->includes,
                'minDays' => $p->min_days,
                'variant' => $p->variant_data,
            ];
        });

        return response()->json(['ok' => true, 'data' => $products]);
    }

    /**
     * Mengambil detail satu produk.
     */
    public function productDetail(string $id): JsonResponse
    {
        $p = Product::where('id', $id)->with(['category', 'reviews'])->first();

        if (!$p) {
            return response()->json(['ok' => false, 'msg' => 'Produk tidak ditemukan.'], 404);
        }

        return response()->json(['ok' => true, 'data' => $p]);
    }

    /**
     * Mengambil daftar paket hemat camping/hiking.
     */
    public function packages(): JsonResponse
    {
        $packages = Package::where('is_active', true)->with('items.product')->get();
        return response()->json(['ok' => true, 'data' => $packages]);
    }

    /**
     * Cek ketersediaan stok sewa berdasarkan rentang tanggal.
     */
    public function checkAvailability(Request $request): JsonResponse
    {
        $request->validate([
            'product_id' => 'required|string|exists:products,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
        ]);

        $productId = $request->input('product_id');
        $start = $request->input('start_date');
        $end = $request->input('end_date');

        // Total unit fisik yang aktif
        $totalUnits = ProductUnit::where('product_id', $productId)
            ->where('status', '!=', 'nonaktif')
            ->count();

        // Jika tidak ada unit fisik spesifik, ambil dari stok tabel products
        if ($totalUnits === 0) {
            $product = Product::find($productId);
            $totalUnits = $product ? $product->stock : 0;
        }

        // Jumlah unit yang sudah dibooking pada rentang tanggal tersebut
        $bookedQty = BookingItem::where('product_id', $productId)
            ->whereHas('booking', function ($q) use ($start, $end) {
                $q->whereNotIn('status', ['selesai', 'dibatalkan'])
                  ->where('start_date', '<=', $end)
                  ->where('end_date', '>=', $start);
            })
            ->sum('qty');

        $available = max(0, $totalUnits - $bookedQty);

        return response()->json([
            'ok' => true,
            'product_id' => $productId,
            'total_units' => $totalUnits,
            'booked_units' => $bookedQty,
            'available' => $available,
        ]);
    }

    /**
     * Simpan Booking Rental Baru (Checkout Rental).
     */
    public function storeBooking(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => 'required|string',
            'customer_phone' => 'required|string',
            'customer_email' => 'required|email',
            'customer_address' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.qty' => 'required|integer|min:1',
            'payment_method' => 'nullable|string',
            'delivery_mode' => 'nullable|string',
            'notes' => 'nullable|string',
            'promo_code' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $startDate = Carbon::parse($validated['start_date']);
            $endDate = Carbon::parse($validated['end_date']);
            $days = max(1, $startDate->diffInDays($endDate));

            $subtotal = 0;
            $itemsData = [];

            foreach ($validated['items'] as $it) {
                $product = Product::findOrFail($it['product_id']);
                $qty = (int)$it['qty'];
                $itemSubtotal = $product->rent_price * $qty * $days;
                $subtotal += $itemSubtotal;

                $itemsData[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_img' => $product->img,
                    'size' => $it['size'] ?? null,
                    'qty' => $qty,
                    'price_per_day' => $product->rent_price,
                    'subtotal' => $itemSubtotal,
                ];
            }

            // Hitung diskon promo jika ada
            $discount = 0;
            if (!empty($validated['promo_code'])) {
                $promo = Promo::where('code', strtoupper($validated['promo_code']))
                    ->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('valid_until')->orWhere('valid_until', '>=', now());
                    })
                    ->first();

                if ($promo && $subtotal >= $promo->min_order) {
                    $discount = $promo->discount_type === 'persen'
                        ? (int)round($subtotal * $promo->discount_value / 100)
                        : min($promo->discount_value, $subtotal);

                    if ($promo->max_discount && $discount > $promo->max_discount) {
                        $discount = $promo->max_discount;
                    }
                }
            }

            $total = max(0, $subtotal - $discount);
            $dpPercent = (int)Setting::get('dp_percent', 50);
            $dpAmount = (int)round($total * $dpPercent / 100);

            // Generate Booking Code: RNT-YYYYMMDD-XXXX
            $code = 'RNT-' . date('Ymd') . '-' . str_pad((string)(Booking::count() + 1), 4, '0', STR_PAD_LEFT);

            $booking = Booking::create([
                'booking_code' => $code,
                'user_id' => Auth::id(),
                'customer_name' => trim($validated['customer_name']),
                'customer_phone' => trim($validated['customer_phone']),
                'customer_email' => strtolower(trim($validated['customer_email'])),
                'customer_address' => $validated['customer_address'] ?? null,
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
                'days' => $days,
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'total_amount' => $total,
                'dp_amount' => $dpAmount,
                'payment_method' => $validated['payment_method'] ?? 'Transfer Bank',
                'status' => 'menunggu_pembayaran',
                'payment_status' => 'unpaid',
                'delivery_mode' => $validated['delivery_mode'] ?? 'ambil',
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($itemsData as $item) {
                $booking->items()->create($item);
            }

            return response()->json([
                'ok' => true,
                'msg' => 'Booking berhasil dibuat!',
                'booking' => $booking->load('items'),
                'redirect' => route('pembayaran', ['id' => $booking->id]),
            ]);
        });
    }

    /**
     * Upload Bukti Pembayaran (DP / Pelunasan).
     */
    public function uploadPayment(Request $request): JsonResponse
    {
        $request->validate([
            'booking_id' => 'nullable|exists:bookings,id',
            'sale_id' => 'nullable|exists:sales,id',
            'payment_type' => 'required|in:DP,Pelunasan,Denda,Penjualan',
            'amount' => 'required|integer|min:1',
            'bank_name' => 'nullable|string',
            'proof_file' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $path = $request->file('proof_file')->store('payments', 'public');

        $payment = Payment::create([
            'booking_id' => $request->input('booking_id'),
            'sale_id' => $request->input('sale_id'),
            'payment_type' => $request->input('payment_type'),
            'amount' => $request->input('amount'),
            'bank_name' => $request->input('bank_name'),
            'proof_file' => $path,
            'status' => 'pending',
            'paid_at' => now(),
            'notes' => $request->input('notes'),
        ]);

        if ($request->filled('booking_id')) {
            $booking = Booking::find($request->input('booking_id'));
            if ($booking) {
                $booking->update([
                    'status' => 'menunggu_konfirmasi',
                    'payment_status' => 'dp_verifying',
                ]);
            }
        }

        return response()->json([
            'ok' => true,
            'msg' => 'Bukti pembayaran berhasil diunggah dan sedang diverifikasi oleh admin.',
            'payment' => $payment,
        ]);
    }
}
