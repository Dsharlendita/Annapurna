<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Restock;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinanceController extends Controller
{
    /**
     * GET /api/admin/keuangan/ringkasan atau /api/owner/keuangan/ringkasan
     * Menghitung ringkasan keuangan, arus kas, HPP, dan laba per lini usaha.
     */
    public function summary(Request $request): JsonResponse
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $from = $request->input('from', Carbon::now('Asia/Jakarta')->startOfMonth()->toDateString());
        $to = $request->input('to', $today);
        $lineFilter = $request->input('line', 'all');

        // Query transaksi keuangan aktif di rentang tanggal
        $finances = Finance::where('status', 'aktif')
            ->whereBetween('transaction_date', [$from, $to])
            ->get();

        // Query penjualan untuk menghitung HPP (modal barang terjual)
        $sales = Sale::where('status', '!=', 'dibatalkan')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to])
            ->with('items')
            ->get();

        $cogs = 0; // HPP (modal barang jual)
        $missingCostCount = 0;
        foreach ($sales as $sale) {
            foreach ($sale->items as $item) {
                if ($item->unit_cost !== null && $item->unit_cost > 0) {
                    $cogs += (int) ($item->unit_cost * $item->qty);
                } else {
                    $missingCostCount++;
                }
            }
        }

        // Hitung per lini usaha
        $rentIn = $finances->where('line', 'rent')->where('type', 'income')->sum('amount');
        $rentOut = $finances->where('line', 'rent')->where('type', 'expense')->sum('amount');
        $rentProfit = $rentIn - $rentOut;

        $saleIn = $finances->where('line', 'sale')->where('type', 'income')->sum('amount');
        $saleOut = $finances->where('line', 'sale')->where('type', 'expense')->sum('amount');
        $saleProfit = $saleIn - $cogs; // Laba kotor penjualan = Pemasukan - HPP

        $umumIn = $finances->where('line', 'umum')->where('type', 'income')->sum('amount');
        $umumOut = $finances->where('line', 'umum')->where('type', 'expense')->sum('amount');
        $umumProfit = $umumIn - $umumOut;

        $totalIn = $rentIn + $saleIn + $umumIn;
        $totalOut = $rentOut + $saleOut + $umumOut;
        $cashFlow = $totalIn - $totalOut;
        $netProfit = $rentProfit + $saleProfit + $umumProfit;

        $by = [
            'rent' => [
                'in' => (int) $rentIn,
                'out' => (int) $rentOut,
                'profit' => (int) $rentProfit,
            ],
            'sale' => [
                'in' => (int) $saleIn,
                'out' => (int) $saleOut,
                'cogs' => (int) $cogs,
                'profit' => (int) $saleProfit,
                'missingCost' => $missingCostCount,
            ],
            'umum' => [
                'in' => (int) $umumIn,
                'out' => (int) $umumOut,
                'profit' => (int) $umumProfit,
            ],
        ];

        return response()->json([
            'ok' => true,
            'data' => [
                'from' => $from,
                'to' => $to,
                'totalIn' => (int) $totalIn,
                'totalOut' => (int) $totalOut,
                'cogs' => (int) $cogs,
                'cashFlow' => (int) $cashFlow,
                'profit' => (int) $netProfit,
                'by' => $by,
            ],
        ]);
    }

    /**
     * GET /api/admin/keuangan/transaksi
     * Daftar seluruh riwayat transaksi kas & keuangan.
     */
    public function transactions(Request $request): JsonResponse
    {
        $query = Finance::query()->with('creator:id,name,role');

        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('transaction_date', [$request->input('from'), $request->input('to')]);
        }

        if ($request->filled('type') && in_array($request->input('type'), ['income', 'expense'])) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('line') && in_array($request->input('line'), ['rent', 'sale', 'umum'])) {
            $query->where('line', $request->input('line'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('q')) {
            $q = strtolower(trim($request->input('q')));
            $query->where(function ($sub) use ($q) {
                $sub->whereRaw('LOWER(finance_code) LIKE ?', ["%{$q}%"])
                    ->orWhereRaw('LOWER(category) LIKE ?', ["%{$q}%"])
                    ->orWhereRaw('LOWER(description) LIKE ?', ["%{$q}%"])
                    ->orWhereRaw('LOWER(ref) LIKE ?', ["%{$q}%"]);
            });
        }

        $list = $query->orderBy('transaction_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate(15);

        return response()->json([
            'ok' => true,
            'data' => $list,
        ]);
    }

    /**
     * POST /api/admin/keuangan
     * Menambahkan transaksi kas manual (pemasukan lain / pengeluaran).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['income', 'expense'])],
            'category' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'integer', 'min:1'],
            'transaction_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:500'],
            'line' => ['nullable', Rule::in(['rent', 'sale', 'umum'])],
            'ref' => ['nullable', 'string', 'max:100'],
        ]);

        $line = $validated['line'] ?? 'umum';

        // Aturan mitra (B.7): Pengeluaran operasional manual tidak boleh 'rent', dipaksa ke 'umum'
        if ($validated['type'] === 'expense' && $line === 'rent' && !str_starts_with($validated['ref'] ?? '', 'RESTOCK')) {
            $line = 'umum';
        }

        $code = Finance::generateCode($validated['type']);

        $finance = Finance::create([
            'finance_code' => $code,
            'ref' => $validated['ref'] ?? null,
            'type' => $validated['type'],
            'category' => trim($validated['category']),
            'line' => $line,
            'amount' => (int) $validated['amount'],
            'transaction_date' => $validated['transaction_date'],
            'description' => trim($validated['description']),
            'status' => 'aktif',
            'created_by' => Auth::id(),
        ]);

        Audit::log(
            'keuangan',
            "Mencatat {$validated['type']} {$code}: {$validated['category']} Rp" . number_format($validated['amount']),
            $finance
        );

        return response()->json([
            'ok' => true,
            'msg' => 'Transaksi keuangan berhasil dicatat.',
            'data' => $finance,
        ], 201);
    }

    /**
     * POST /api/admin/keuangan/{id}/batal
     * Membatalkan transaksi keuangan (void).
     */
    public function voidTransaction(Request $request, int $id): JsonResponse
    {
        $finance = Finance::findOrFail($id);

        if ($finance->status === 'dibatalkan') {
            return response()->json(['ok' => false, 'msg' => 'Transaksi sudah dibatalkan sebelumnya.'], 422);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $finance->status = 'dibatalkan';
        $finance->void_reason = trim($validated['reason']);
        $finance->save();

        Audit::log(
            'keuangan',
            "Membatalkan transaksi {$finance->finance_code}: {$finance->void_reason}",
            $finance
        );

        return response()->json([
            'ok' => true,
            'msg' => 'Transaksi berhasil dibatalkan.',
            'data' => $finance,
        ]);
    }

    /**
     * POST /api/admin/products/{id}/restock
     * Menambah stok barang (kulakan distributor) dan mencatat pengeluaran keuangan otomatis.
     */
    public function restock(Request $request, string $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'qty' => ['required', 'integer', 'min:1', 'max:200'],
            'unit_cost' => ['nullable', 'integer', 'min:0'],
            'cost' => ['nullable', 'integer', 'min:0'], // alias unit_cost
            'kind' => ['nullable', Rule::in(['sale', 'rent'])],
            'variant' => ['nullable', 'string', 'max:50'],
            'size' => ['nullable', 'string', 'max:50'], // alias variant
            'supplier' => ['nullable', 'string', 'max:100'],
            'restock_date' => ['nullable', 'date'],
            'date' => ['nullable', 'date'], // alias restock_date
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $qty = (int) $validated['qty'];
        $unitCost = (int) ($validated['unit_cost'] ?? $validated['cost'] ?? $product->cost_price ?? 0);
        $totalCost = $qty * $unitCost;
        $kind = $validated['kind'] ?? ($product->sale_price > 0 && $product->rent_price == 0 ? 'sale' : 'rent');
        $variant = $validated['variant'] ?? $validated['size'] ?? null;
        $restockDate = $validated['restock_date'] ?? $validated['date'] ?? Carbon::now('Asia/Jakarta')->toDateString();
        $supplier = $validated['supplier'] ?? null;
        $note = $validated['note'] ?? null;

        return DB::transaction(function () use ($product, $qty, $unitCost, $totalCost, $kind, $variant, $restockDate, $supplier, $note) {
            $user = Auth::user();
            $generatedUnits = [];

            // 1. Jika barang sewa (rent), buat unit fisik baru di product_units
            if ($kind === 'rent') {
                $existingCount = ProductUnit::where('product_id', $product->id)->count();
                $prefix = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $product->sku ?: $product->id), 0, 6));
                if (!$prefix) {
                    $prefix = 'UNT';
                }

                for ($i = 1; $i <= $qty; $i++) {
                    $unitNumber = str_pad((string) ($existingCount + $i), 2, '0', STR_PAD_LEFT);
                    $unitCode = "{$prefix}-{$unitNumber}";

                    $unit = ProductUnit::create([
                        'product_id' => $product->id,
                        'unit_code' => $unitCode,
                        'size' => $variant,
                        'purchase_cost' => $unitCost,
                        'condition' => 'Baik',
                        'status' => 'tersedia',
                    ]);

                    $generatedUnits[] = $unit->unit_code;
                }
            }

            // 2. Tambah stok produk dan perbarui cost_price
            $product->stock += $qty;
            if ($unitCost > 0) {
                $product->cost_price = $unitCost;
            }
            $product->save();

            // 3. Catat pengeluaran keuangan otomatis (Pembelian Barang)
            $financeCode = Finance::generateCode('expense');
            $financeLine = ($kind === 'rent') ? 'rent' : 'sale';

            $finance = Finance::create([
                'finance_code' => $financeCode,
                'ref' => "RESTOCK-{$product->id}-" . time(),
                'type' => 'expense',
                'category' => 'Pembelian Barang',
                'line' => $financeLine,
                'amount' => $totalCost,
                'transaction_date' => $restockDate,
                'description' => "Restock {$kind}: {$product->name} x{$qty} @ Rp" . number_format($unitCost),
                'status' => 'aktif',
                'created_by' => $user?->id,
            ]);

            // 4. Catat riwayat di tabel restocks
            $restock = Restock::create([
                'product_id' => $product->id,
                'kind' => $kind,
                'variant' => $variant,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'supplier' => $supplier,
                'note' => $note,
                'unit_codes' => $generatedUnits,
                'restock_date' => $restockDate,
                'finance_id' => $finance->id,
                'created_by' => $user?->id,
            ]);

            Audit::log(
                'restock',
                "Restock {$kind} {$product->name}: +{$qty} unit @ Rp" . number_format($unitCost),
                $product
            );

            return response()->json([
                'ok' => true,
                'msg' => "Restock {$product->name} berhasil dicatat.",
                'product' => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'stock' => $product->stock,
                    'cost_price' => $product->cost_price,
                ],
                'restock' => $restock,
                'finance' => $finance,
                'unit_codes' => $generatedUnits,
            ], 201);
        });
    }

    /**
     * POST /api/admin/pembayaran/{id}/verifikasi
     * Memverifikasi bukti pembayaran customer, mengupdate status pesanan,
     * dan otomatis mencatat pemasukan kas ke buku keuangan (finances).
     */
    public function verifyPayment(Request $request, int $id): JsonResponse
    {
        $payment = Payment::with(['booking', 'sale'])->findOrFail($id);

        if ($payment->status === 'verified') {
            return response()->json(['ok' => false, 'msg' => 'Pembayaran ini sudah diverifikasi sebelumnya.'], 422);
        }

        return DB::transaction(function () use ($payment, $request) {
            $user = Auth::user();
            $payment->status = 'verified';
            $payment->verified_by = $user?->id;
            $payment->verified_at = Carbon::now('Asia/Jakarta');
            $payment->save();

            $line = 'umum';
            $ref = null;

            if ($payment->booking) {
                $booking = $payment->booking;
                $line = 'rent';
                $ref = $booking->nota_no ?: $booking->booking_code;

                if ($payment->payment_type === 'DP') {
                    $booking->update([
                        'status' => 'dikonfirmasi',
                        'payment_status' => 'dp_paid',
                    ]);
                } elseif ($payment->payment_type === 'Pelunasan') {
                    $booking->update([
                        'payment_status' => 'lunas',
                    ]);
                }
            } elseif ($payment->sale) {
                $sale = $payment->sale;
                $line = 'sale';
                $ref = $sale->nota_no ?: $sale->sale_code;

                $sale->update([
                    'status' => 'diproses',
                    'payment_status' => 'paid',
                ]);
            }

            // Catat pemasukan otomatis ke tabel finances
            $financeCode = Finance::generateCode('income');
            $finance = Finance::create([
                'finance_code' => $financeCode,
                'ref' => $ref,
                'type' => 'income',
                'category' => $payment->payment_type . ' ' . ($payment->booking ? 'Sewa' : 'Penjualan'),
                'line' => $line,
                'amount' => $payment->amount,
                'transaction_date' => Carbon::now('Asia/Jakarta')->toDateString(),
                'description' => "Pembayaran {$payment->payment_type} untuk {$ref} via {$payment->bank_name}",
                'status' => 'aktif',
                'created_by' => $user?->id,
            ]);

            Audit::log(
                'keuangan',
                "Verifikasi pembayaran {$payment->payment_type} {$ref} Rp" . number_format($payment->amount),
                $payment
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Pembayaran berhasil diverifikasi dan pemasukan telah dicatat di buku kas.',
                'payment' => $payment,
                'finance' => $finance,
            ]);
        });
    }
}
