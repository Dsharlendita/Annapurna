<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Category;
use App\Models\DocumentSequence;
use App\Models\Package;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Promo;
use App\Models\Sale;
use App\Models\SaleDelivery;
use App\Models\SaleItem;
use App\Models\Setting;
use App\Support\Audit;
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
            'customer_email' => 'nullable|email',
            'customer_address' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string',
            'items.*.qty' => 'required|integer|min:1',
            'payment_method' => 'nullable|string',
            'delivery_mode' => 'nullable|string',
            'notes' => 'nullable|string',
            'promo_code' => 'nullable|string',
            'guarantee_type' => 'nullable|string',
            'is_walk_in' => 'nullable|boolean',
            'channel' => 'nullable|string|in:online,offline',
            'status' => 'nullable|string',
            'payment_status' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $startDate = Carbon::parse($validated['start_date']);
            $endDate = Carbon::parse($validated['end_date']);
            $days = max(1, $startDate->diffInDays($endDate));

            $subtotal = 0;
            $itemsData = [];

            foreach ($validated['items'] as $it) {
                $pid = $it['product_id'];
                $product = Product::find($pid);
                if ($product) {
                    $qty = (int)$it['qty'];
                    $pricePerDay = isset($it['price_per_day']) && is_numeric($it['price_per_day']) ? (int)$it['price_per_day'] : (int)$product->rent_price;
                    $itemSubtotal = $pricePerDay * $qty * $days;
                    $subtotal += $itemSubtotal;

                    $itemsData[] = [
                        'product_id' => $product->id,
                        'product_name' => $it['product_name'] ?? $product->name,
                        'product_img' => $product->img,
                        'size' => $it['size'] ?? null,
                        'qty' => $qty,
                        'price_per_day' => $pricePerDay,
                        'subtotal' => $itemSubtotal,
                    ];
                } else {
                    $pkg = Package::where('id', $pid)->with('items.product')->first();
                    if ($pkg) {
                        $qty = (int)$it['qty'];
                        $pkgPrice = (int)$pkg->price_per_day;
                        $itemSubtotal = $pkgPrice * $qty * $days;
                        $subtotal += $itemSubtotal;

                        if ($pkg->items->isNotEmpty()) {
                            foreach ($pkg->items as $idx => $pki) {
                                if ($pki->product) {
                                    $itemsData[] = [
                                        'product_id' => $pki->product_id,
                                        'product_name' => $pkg->name . ' (' . $pki->product->name . ')',
                                        'product_img' => $pki->product->img ?: $pkg->img,
                                        'size' => null,
                                        'qty' => (int)$pki->qty * $qty,
                                        'price_per_day' => $idx === 0 ? $pkgPrice : 0,
                                        'subtotal' => $idx === 0 ? $itemSubtotal : 0,
                                    ];
                                }
                            }
                        }
                    }
                }
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
            $payWindowHours = (int)Setting::get('pay_window_hours', 2);

            // Generate Booking Code: RNT-YYYYMMDD-XXXX dan Nota Resmi RNTL/xxx/Romawi/Tahun
            $code = 'RNT-' . date('Ymd') . '-' . str_pad((string)(Booking::count() + 1), 4, '0', STR_PAD_LEFT);
            $notaNo = DocumentSequence::nextNota('rent');

            $isWalkIn = $request->boolean('is_walk_in');
            $channel = $validated['channel'] ?? ($isWalkIn ? 'offline' : 'online');
            $status = $validated['status'] ?? ($isWalkIn ? 'dikonfirmasi' : 'menunggu_pembayaran');
            $paymentStatus = $validated['payment_status'] ?? ($isWalkIn ? 'lunas' : 'unpaid');
            $customerEmail = !empty($validated['customer_email']) ? strtolower(trim($validated['customer_email'])) : 'kasir-' . date('YmdHis') . '@annapurna.local';

            $booking = Booking::create([
                'booking_code' => $code,
                'nota_no' => $notaNo,
                'user_id' => Auth::id(),
                'customer_name' => trim($validated['customer_name']),
                'customer_phone' => trim($validated['customer_phone']),
                'customer_email' => $customerEmail,
                'customer_address' => $validated['customer_address'] ?? null,
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
                'days' => $days,
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'discount_reason' => $request->input('discount_reason'),
                'total_amount' => $total,
                'dp_amount' => $dpAmount,
                'payment_method' => $validated['payment_method'] ?? 'Transfer Bank',
                'status' => $status,
                'payment_status' => $paymentStatus,
                'channel' => $channel,
                'delivery_mode' => $validated['delivery_mode'] ?? 'ambil',
                'notes' => $validated['notes'] ?? null,
                'guarantee_type' => $request->input('guarantee_type'),
                'is_walk_in' => $isWalkIn,
                'expired_at' => $isWalkIn ? null : now()->addHours($payWindowHours),
            ]);

            foreach ($itemsData as $item) {
                $booking->items()->create($item);
            }

            return response()->json([
                'ok' => true,
                'msg' => 'Booking berhasil dibuat!',
                'booking' => $booking->load('items'),
                'redirect' => route('pembayaran', ['ids' => $booking->booking_code]),
            ]);
        });
    }

    /**
     * Menyimpan pesanan pembelian barang baru (Checkout Barang Beli).
     */
    public function storeSale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:30',
            'customer_email' => 'nullable|email|max:100',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string',
            'items.*.qty' => 'required|integer|min:1',
            'payment_method' => 'nullable|string',
            'delivery_mode' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_walk_in' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $subtotal = 0;
            $itemsData = [];

            foreach ($validated['items'] as $it) {
                $product = Product::findOrFail($it['product_id']);
                $qty = (int) $it['qty'];
                $price = $product->sale_price ?: 0;
                $lineSubtotal = $price * $qty;
                $subtotal += $lineSubtotal;

                $itemsData[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_img' => $product->img,
                    'qty' => $qty,
                    'unit_price' => $price,
                    'unit_cost' => $product->cost_price ?? null,
                    'subtotal' => $lineSubtotal,
                ];

                // Kurangi stok produk
                $product->decrement('stock', $qty);
            }

            $code = 'ORD-' . date('Ymd') . '-' . str_pad((string) (Sale::count() + 1), 4, '0', STR_PAD_LEFT);
            $notaNo = DocumentSequence::nextNota('sale');
            $payWindowHours = (int) Setting::get('pay_window_hours', 2);

            $isWalkIn = $request->boolean('is_walk_in');
            $discount = (int) $request->input('discount_amount', 0);
            $total = max(0, $subtotal - $discount);

            $sale = Sale::create([
                'sale_code' => $code,
                'nota_no' => $notaNo,
                'user_id' => Auth::id(),
                'customer_name' => $validated['customer_name'] ?? 'Pelanggan Umum',
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_email' => $validated['customer_email'] ?? null,
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'discount_reason' => $request->input('discount_reason'),
                'total_amount' => $total,
                'payment_method' => $validated['payment_method'] ?? 'Transfer Bank',
                'status' => $isWalkIn ? 'selesai' : 'menunggu_pembayaran',
                'payment_status' => $isWalkIn ? 'paid' : 'unpaid',
                'channel' => $isWalkIn ? 'offline' : 'online',
                'is_walk_in' => $isWalkIn,
                'delivery_mode' => $validated['delivery_mode'] ?? 'ambil',
                'notes' => $validated['notes'] ?? null,
                'expired_at' => $isWalkIn ? null : now()->addHours($payWindowHours),
            ]);

            foreach ($itemsData as $item) {
                $sale->items()->create($item);
            }

            if (($validated['delivery_mode'] ?? 'ambil') === 'antar') {
                $sale->delivery()->create([
                    'method' => 'ekspedisi',
                    'address' => $request->input('address') ?: ($validated['notes'] ?? null),
                    'ship_status' => 'siap_dikirim',
                ]);
            }

            return response()->json([
                'ok' => true,
                'msg' => 'Pesanan pembelian berhasil dibuat!',
                'sale' => $sale->load(['items', 'delivery']),
                'redirect' => route('pembayaran', ['ids' => $sale->sale_code]),
            ]);
        });
    }

    /**
     * Upload Bukti Pembayaran (DP / Pelunasan).
     */
    public function uploadPayment(Request $request): JsonResponse
    {
        $request->validate([
            'booking_id' => 'nullable|string',
            'sale_id' => 'nullable|string',
            'payment_type' => 'required|in:DP,Pelunasan,Denda,Penjualan',
            'amount' => 'required|integer|min:1',
            'bank_name' => 'nullable|string',
            'proof_file' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $bInput = $request->input('booking_id');
        $sInput = $request->input('sale_id');

        $booking = null;
        if ($bInput) {
            $booking = is_numeric($bInput) ? Booking::find($bInput) : Booking::where('booking_code', $bInput)->orWhere('nota_no', $bInput)->first();
        }

        $sale = null;
        if ($sInput) {
            $sale = is_numeric($sInput) ? Sale::find($sInput) : Sale::where('sale_code', $sInput)->orWhere('nota_no', $sInput)->first();
        }

        $path = $request->file('proof_file')->store('payments', 'public');

        $payment = Payment::create([
            'booking_id' => $booking?->id,
            'sale_id' => $sale?->id,
            'payment_type' => $request->input('payment_type'),
            'amount' => $request->input('amount'),
            'bank_name' => $request->input('bank_name'),
            'proof_file' => $path,
            'status' => 'pending',
            'paid_at' => now(),
            'notes' => $request->input('notes'),
        ]);

        if ($booking) {
            $booking->update([
                'status' => 'menunggu_konfirmasi',
                'payment_status' => 'dp_verifying',
            ]);
        }

        if ($sale) {
            $sale->update([
                'status' => 'diproses',
                'payment_status' => 'verifying',
            ]);
        }

        return response()->json([
            'ok' => true,
            'msg' => 'Bukti pembayaran berhasil diunggah dan sedang diverifikasi oleh admin.',
            'payment' => $payment,
        ]);
    }

    /**
     * Menyimpan rincian pengiriman penjualan (Kurir toko / Ekspedisi).
     */
    public function saveSaleDelivery(Request $request, string $id): JsonResponse
    {
        $sale = is_numeric($id) ? Sale::find($id) : Sale::where('sale_code', $id)->orWhere('nota_no', $id)->firstOrFail();

        $validated = $request->validate([
            'method' => 'required|in:kurir,ekspedisi',
            'expedition' => 'nullable|string|max:50',
            'tracking_no' => 'nullable|string|max:100',
            'courier_name' => 'nullable|string|max:100',
            'courier_phone' => 'nullable|string|max:30',
            'ongkir' => 'nullable|integer|min:0',
            'address' => 'nullable|string',
            'ship_status' => 'nullable|in:siap_dikirim,dikirim,tiba',
            'ship_date' => 'nullable|date',
        ]);

        $delivery = SaleDelivery::updateOrCreate(
            ['sale_id' => $sale->id],
            [
                'method' => $validated['method'],
                'expedition' => $validated['expedition'] ?? null,
                'tracking_no' => $validated['tracking_no'] ?? null,
                'courier_name' => $validated['courier_name'] ?? null,
                'courier_phone' => $validated['courier_phone'] ?? null,
                'ongkir' => (int)($validated['ongkir'] ?? 0),
                'address' => $validated['address'] ?? null,
                'ship_status' => $validated['ship_status'] ?? 'dikirim',
                'ship_date' => $validated['ship_date'] ?? now()->toDateString(),
            ]
        );

        Audit::log(
            'layanan',
            "Mengatur pengiriman penjualan {$sale->nota_no} via " . ($delivery->method === 'ekspedisi' ? $delivery->expedition . ' (Resi: ' . $delivery->tracking_no . ')' : 'Kurir Toko (' . $delivery->courier_name . ')'),
            $sale
        );

        return response()->json([
            'ok' => true,
            'msg' => 'Rincian pengiriman berhasil disimpan.',
            'data' => $delivery,
        ]);
    }

    /**
     * Pelunasan kasir atau pencatatan piutang sewa.
     */
    public function settleBooking(Request $request, string $id): JsonResponse
    {
        $booking = is_numeric($id) ? Booking::find($id) : Booking::where('booking_code', $id)->orWhere('nota_no', $id)->firstOrFail();

        $validated = $request->validate([
            'settle_disc_amount' => 'nullable|integer|min:0',
            'settle_disc_reason' => 'nullable|string|max:150',
            'settle_later' => 'nullable|boolean',
            'piutang_amount' => 'nullable|integer|min:0',
            'piutang_note' => 'nullable|string',
            'payment_amount' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($booking, $validated) {
            $settleDisc = (int)($validated['settle_disc_amount'] ?? 0);
            $settleLater = !empty($validated['settle_later']);
            $piutangAmt = (int)($validated['piutang_amount'] ?? 0);
            $payAmt = (int)($validated['payment_amount'] ?? 0);

            // Update field diskon pelunasan & piutang
            $booking->update([
                'settle_disc_amount' => $settleDisc,
                'settle_disc_reason' => $validated['settle_disc_reason'] ?? null,
                'settle_later' => $settleLater,
                'piutang_amount' => $settleLater ? $piutangAmt : 0,
                'piutang_note' => $settleLater ? ($validated['piutang_note'] ?? null) : null,
            ]);

            // Jika ada pembayaran yang diterima saat pelunasan
            if ($payAmt > 0) {
                Payment::create([
                    'booking_id' => $booking->id,
                    'payment_type' => 'Pelunasan',
                    'amount' => $payAmt,
                    'bank_name' => $validated['payment_method'] ?? 'Kasir · Tunai',
                    'status' => 'verified',
                    'paid_at' => now(),
                    'verified_by' => Auth::id(),
                    'verified_at' => now(),
                    'notes' => 'Pelunasan di kasir',
                ]);
            }

            // Hitung total terbayar
            $totalPaid = $booking->payments()->where('status', 'verified')->sum('amount');
            $netTotal = max(0, $booking->total_amount - $settleDisc);

            if ($totalPaid >= $netTotal && !$settleLater) {
                $booking->update(['payment_status' => 'lunas']);
            } elseif ($settleLater) {
                $booking->update(['payment_status' => 'dp_paid']);
            }

            Audit::log(
                'keuangan',
                "Memproses pelunasan kasir booking {$booking->nota_no}" . ($settleDisc > 0 ? " (Diskon: Rp " . number_format($settleDisc, 0, ',', '.') . ")" : "") . ($settleLater ? " (Sisa piutang: Rp " . number_format($piutangAmt, 0, ',', '.') . ")" : ""),
                $booking
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Pelunasan booking berhasil diproses.',
                'booking' => $booking->fresh()->load('payments'),
            ]);
        });
    }
}
