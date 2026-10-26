<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\DocumentSequence;
use App\Models\Finance;
use App\Models\LaundryCategory;
use App\Models\LaundryItem;
use App\Models\LaundryOrder;
use App\Models\LaundryPayment;
use App\Models\LaundryStatusLog;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class LaundryController extends Controller
{
    /**
     * GET /api/admin/laundry
     * Daftar pesanan laundry dengan statistik, filter tab, dan pencarian.
     */
    public function index(Request $request): JsonResponse
    {
        $tab = $request->query('tab', 'aktif');
        $q = trim($request->query('q', ''));
        $from = $request->query('from');
        $to = $request->query('to');

        $query = LaundryOrder::with(['items', 'payments', 'logs.creator']);

        if ($q !== '') {
            $query->where(function ($sq) use ($q) {
                $sq->where('nota_no', 'like', "%{$q}%")
                   ->orWhere('order_code', 'like', "%{$q}%")
                   ->orWhere('customer_name', 'like', "%{$q}%")
                   ->orWhere('customer_phone', 'like', "%{$q}%")
                   ->orWhereHas('items', function ($iq) use ($q) {
                       $iq->where('item_name', 'like', "%{$q}%");
                   });
            });
        }

        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        $allOrders = (clone $query)->get();

        // Hitung statistik bulanan
        $currentMonth = now()->format('Y-m');
        $monthlyIncome = LaundryPayment::where('paid_at', 'like', "{$currentMonth}%")->sum('amount');

        $unpaidTotal = LaundryOrder::where('status', '!=', 'dibatalkan')
            ->where('payment_status', '!=', 'paid')
            ->get()
            ->sum(fn ($o) => $o->remaining_due);

        $stats = [
            'diterima' => LaundryOrder::where('status', 'diterima')->count(),
            'dicuci'   => LaundryOrder::where('status', 'dicuci')->count(),
            'siap'     => LaundryOrder::where('status', 'siap')->count(),
            'unpaid'   => $unpaidTotal,
            'income'   => $monthlyIncome,
        ];

        // Saring berdasarkan tab
        $filtered = match ($tab) {
            'aktif' => $query->whereIn('status', ['diterima', 'dicuci', 'siap'])->latest('id')->get(),
            'diterima' => $query->where('status', 'diterima')->latest('id')->get(),
            'dicuci' => $query->where('status', 'dicuci')->latest('id')->get(),
            'siap' => $query->where('status', 'siap')->latest('id')->get(),
            'selesai' => $query->where('status', 'selesai')->latest('id')->get(),
            'dibatalkan' => $query->where('status', 'dibatalkan')->latest('id')->get(),
            default => $query->latest('id')->get(),
        };

        return response()->json([
            'ok' => true,
            'stats' => $stats,
            'data' => $filtered,
            'total' => $filtered->count(),
        ]);
    }

    /**
     * GET /api/admin/laundry/prices
     * Daftar harga laundry resmi dari master data MySQL.
     */
    public function getPrices(): JsonResponse
    {
        $categories = LaundryCategory::where('is_active', true)
            ->with(['items' => function ($q) {
                $q->where('is_active', true);
            }])
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $categories,
        ]);
    }

    /**
     * POST /api/admin/laundry
     * Membuat pesanan laundry baru (dari meja Kasir atau form Admin).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:30',
            'customer_email' => 'nullable|email|max:100',
            'items' => 'required|array|min:1',
            'items.*.name' => 'required|string',
            'items.*.price' => 'required|integer|min:0',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.id' => 'nullable|string',
            'items.*.cat' => 'nullable|string',
            'items.*.custom' => 'nullable|boolean',
            'discount' => 'nullable|integer|min:0',
            'discount_reason' => 'nullable|string',
            'est_done' => 'nullable|date',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'pay_now' => 'nullable|integer|min:0',
            'channel' => 'nullable|string|in:kasir,online',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $user = Auth::user();
            $subtotal = 0;
            $itemsData = [];

            foreach ($validated['items'] as $it) {
                $qty = (int) $it['qty'];
                $price = (int) $it['price'];
                $lineSubtotal = $price * $qty;
                $subtotal += $lineSubtotal;

                $itemsData[] = [
                    'laundry_item_id' => $it['id'] ?? null,
                    'item_name' => trim($it['name']),
                    'category' => $it['cat'] ?? null,
                    'qty' => $qty,
                    'unit_price' => $price,
                    'subtotal' => $lineSubtotal,
                    'is_custom' => !empty($it['custom']),
                ];
            }

            $discount = (int) ($validated['discount'] ?? 0);
            $total = max(0, $subtotal - $discount);
            $payNow = (int) ($validated['pay_now'] ?? 0);

            $paymentStatus = 'unpaid';
            if ($payNow >= $total && $total > 0) {
                $paymentStatus = 'paid';
            } elseif ($payNow > 0) {
                $paymentStatus = 'dp_paid';
            }

            // Generate nomor nota DRY/001/X/2026 dan kode DRY-YYYYMMDD-XXXX
            $notaNo = DocumentSequence::nextNota('laundry');
            $code = 'DRY-' . date('Ymd') . '-' . str_pad((string)(LaundryOrder::count() + 1), 4, '0', STR_PAD_LEFT);
            $estDone = !empty($validated['est_done']) ? $validated['est_done'] : now()->addDays(3)->toDateString();

            $order = LaundryOrder::create([
                'order_code' => $code,
                'nota_no' => $notaNo,
                'user_id' => null,
                'customer_name' => trim($validated['customer_name']),
                'customer_phone' => trim($validated['customer_phone']),
                'customer_email' => $validated['customer_email'] ?? null,
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'total_amount' => $total,
                'payment_method' => $validated['payment_method'] ?? 'Tunai',
                'status' => 'diterima',
                'payment_status' => $paymentStatus,
                'channel' => $validated['channel'] ?? 'kasir',
                'est_done' => $estDone,
                'notes' => $validated['notes'] ?? null,
                'created_by' => $user?->id,
            ]);

            foreach ($itemsData as $itData) {
                $order->items()->create($itData);
            }

            // Catat log status awal
            $creatorName = $user ? $user->name : 'Staff Kasir';
            $order->logs()->create([
                'from_status' => null,
                'to_status' => 'diterima',
                'note' => "Barang diterima di toko dan dicatat di kasir oleh {$creatorName}" . ($payNow ? " · dibayar Rp " . number_format($payNow, 0, ',', '.') : " · dibayar saat diambil"),
                'created_by' => $user?->id,
            ]);

            // Jika ada pembayaran sekarang (DP / Lunas)
            if ($payNow > 0) {
                $payType = $payNow >= $total ? 'Lunas' : 'DP';
                $order->payments()->create([
                    'payment_type' => $payType,
                    'amount' => $payNow,
                    'payment_method' => $validated['payment_method'] ?? 'Tunai',
                    'paid_at' => now(),
                    'received_by' => $user?->id,
                    'notes' => "Pembayaran {$payType} di kasir saat input order",
                ]);

                // Otomatis bukukan ke kas lini umum/laundry
                Finance::create([
                    'finance_code' => Finance::generateCode('income'),
                    'ref' => $notaNo,
                    'type' => 'income',
                    'category' => 'Laundry',
                    'line' => 'umum',
                    'amount' => $payNow,
                    'transaction_date' => now()->toDateString(),
                    'description' => "Pemasukan laundry {$notaNo} ({$order->customer_name}) · {$payType}",
                    'status' => 'aktif',
                    'created_by' => $user?->id,
                ]);
            }

            // Audit Log
            Audit::log(
                'laundry',
                "Kasir: laundry {$notaNo} · {$order->customer_name} · Total Rp " . number_format($total, 0, ',', '.'),
                $order
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Pesanan laundry berhasil dibuat dan tersimpan di database.',
                'order' => $order->load(['items', 'payments', 'logs']),
            ]);
        });
    }

    /**
     * GET /api/admin/laundry/{id}
     * Detail pesanan laundry.
     */
    public function show(string $id): JsonResponse
    {
        $order = LaundryOrder::where('id', $id)
            ->orWhere('order_code', $id)
            ->orWhere('nota_no', $id)
            ->with(['items', 'payments', 'logs.creator'])
            ->first();

        if (!$order) {
            return response()->json(['ok' => false, 'msg' => 'Pesanan laundry tidak ditemukan.'], 404);
        }

        return response()->json(['ok' => true, 'data' => $order]);
    }

    /**
     * POST /api/admin/laundry/{id}/status
     * Memajukan status laundry (diterima -> dicuci -> siap -> selesai / dibatalkan).
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $order = LaundryOrder::where('id', $id)
            ->orWhere('order_code', $id)
            ->orWhere('nota_no', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'status' => 'required|in:diterima,dicuci,siap,selesai,dibatalkan',
            'note' => 'nullable|string',
        ]);

        $oldStatus = $order->status;
        $newStatus = $validated['status'];
        $user = Auth::user();

        if ($oldStatus === $newStatus) {
            return response()->json(['ok' => true, 'msg' => 'Status tidak berubah.', 'order' => $order]);
        }

        $order->status = $newStatus;
        if ($newStatus === 'selesai') {
            $order->picked_at = now();
        }
        if ($newStatus === 'siap') {
            $order->notified_ready = false;
        }

        $order->save();

        $note = $validated['note'] ?? match ($newStatus) {
            'dicuci' => 'Barang mulai dicuci oleh tim laundry.',
            'siap' => 'Barang selesai dicuci dan siap diambil pelanggan.',
            'selesai' => 'Barang sudah diambil oleh pelanggan.',
            'dibatalkan' => 'Pesanan laundry dibatalkan.',
            default => 'Status laundry diperbarui.',
        };

        $order->logs()->create([
            'from_status' => $oldStatus,
            'to_status' => $newStatus,
            'note' => $note,
            'created_by' => $user?->id,
        ]);

        Audit::log('laundry', "Status laundry {$order->nota_no} diubah: {$oldStatus} ➔ {$newStatus}", $order);

        return response()->json([
            'ok' => true,
            'msg' => "Status laundry berhasil diubah menjadi {$newStatus}.",
            'order' => $order->load(['items', 'payments', 'logs']),
        ]);
    }

    /**
     * POST /api/admin/laundry/{id}/bayar
     * Pelunasan sisa tagihan laundry di kasir.
     */
    public function addPayment(Request $request, string $id): JsonResponse
    {
        $order = LaundryOrder::where('id', $id)
            ->orWhere('order_code', $id)
            ->orWhere('nota_no', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'amount' => 'required|integer|min:1',
            'payment_method' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $user = Auth::user();
        $amount = (int) $validated['amount'];

        $payment = $order->payments()->create([
            'payment_type' => 'Pelunasan',
            'amount' => $amount,
            'payment_method' => $validated['payment_method'],
            'paid_at' => now(),
            'received_by' => $user?->id,
            'notes' => $validated['notes'] ?? 'Pelunasan sisa tagihan laundry',
        ]);

        $totalPaid = $order->paid_amount;
        if ($totalPaid >= $order->total_amount) {
            $order->payment_status = 'paid';
        } else {
            $order->payment_status = 'dp_paid';
        }
        $order->save();

        // Catat ke buku kas
        Finance::create([
            'finance_code' => Finance::generateCode('income'),
            'ref' => $order->nota_no,
            'type' => 'income',
            'category' => 'Laundry',
            'line' => 'umum',
            'amount' => $amount,
            'transaction_date' => now()->toDateString(),
            'description' => "Pelunasan laundry {$order->nota_no} ({$order->customer_name})",
            'status' => 'aktif',
            'created_by' => $user?->id,
        ]);

        $order->logs()->create([
            'from_status' => $order->status,
            'to_status' => $order->status,
            'note' => "Pembayaran tercatat Rp " . number_format($amount, 0, ',', '.') . " ({$validated['payment_method']})",
            'created_by' => $user?->id,
        ]);

        Audit::log('laundry', "Pelunasan laundry {$order->nota_no}: Rp " . number_format($amount, 0, ',', '.'), $order);

        return response()->json([
            'ok' => true,
            'msg' => 'Pembayaran laundry berhasil disimpan dan dibukukan ke kas.',
            'order' => $order->load(['items', 'payments', 'logs']),
        ]);
    }

    /**
     * POST /api/admin/laundry/{id}/notify
     * Menandai customer sudah dikabari via WhatsApp.
     */
    public function notifyReady(string $id): JsonResponse
    {
        $order = LaundryOrder::where('id', $id)
            ->orWhere('order_code', $id)
            ->orWhere('nota_no', $id)
            ->firstOrFail();

        $user = Auth::user();
        $order->update([
            'notified_ready' => true,
            'notified_at' => now(),
        ]);

        $order->logs()->create([
            'from_status' => $order->status,
            'to_status' => $order->status,
            'note' => "Pelanggan dikabari via WhatsApp oleh " . ($user ? $user->name : 'Staff'),
            'created_by' => $user?->id,
        ]);

        return response()->json([
            'ok' => true,
            'msg' => 'Status pengingat WhatsApp berhasil dicatat.',
            'order' => $order,
        ]);
    }
}
