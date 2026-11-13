<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingReturn;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\ProductUnit;
use App\Support\Audit;
use App\Support\OrderPresenter;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ReturnController extends Controller
{
    /**
     * GET /api/admin/pengembalian
     * Mengambil ringkasan, daftar barang siap keluar, sedang disewa, dan riwayat pengembalian.
     */
    public function index(Request $request): JsonResponse
    {
        $today = now()->toDateString();

        // 1. Barang yang siap keluar (status = dikonfirmasi)
        $readyToPickup = Booking::with(['items.product', 'payments'])
            ->where('status', 'dikonfirmasi')
            ->orderBy('start_date')
            ->get();

        // 2. Unit yang sedang disewa (status = disewa)
        $renting = Booking::with(['items.product', 'items.unit', 'payments'])
            ->where('status', 'disewa')
            ->orderBy('end_date')
            ->get();

        $lateReturns = $renting->filter(fn ($b) => $b->end_date->toDateString() < $today)->count();
        $totalRentingUnits = $renting->reduce(fn ($carry, $b) => $carry + $b->items->sum('qty'), 0);

        // 3. Riwayat Pengembalian & Denda
        $queryLogs = BookingReturn::with(['booking.items.product', 'inspector'])
            ->latest('return_date');

        if ($request->filled('from')) {
            $queryLogs->whereDate('return_date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $queryLogs->whereDate('return_date', '<=', $request->input('to'));
        }

        $logs = $queryLogs->paginate(25);
        $totalFines = (int) BookingReturn::sum('total_fine');

        return response()->json([
            'ok' => true,
            'stats' => [
                'ready_to_pickup' => $readyToPickup->count(),
                'renting_units' => $totalRentingUnits,
                'late_returns' => $lateReturns,
                'total_fines' => $totalFines,
            ],
            'ready_to_pickup' => $readyToPickup,
            'renting' => $renting,
            'logs' => $logs,
        ]);
    }

    /**
     * POST /api/admin/booking/{id}/pickup
     * Mencatat barang keluar (customer mengambil barang sewaan).
     *
     * {id} = kode yang dipakai FE (RNT-…), nomor nota, atau id angka.
     * unit_ids (format FE)  : { "0": [{ "pid": "tnd-4", "code": "TND4-01" }], … }  (kode unit per baris barang)
     * unit_ids (format lama): { booking_item_id: product_unit_id }
     */
    public function pickup(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'condition' => 'nullable|string',
            'notes' => 'nullable|string',
            'pay_now' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|string|max:100',
            'unit_ids' => 'nullable|array',
        ]);

        return $this->tx($id, function (Booking $booking) use ($validated) {
            // Barang hanya boleh keluar setelah DP diverifikasi (status dikonfirmasi)
            if ($booking->status !== 'dikonfirmasi') {
                throw new \DomainException("Barang belum bisa keluar: status booking {$this->statusLabel($booking->status)}.");
            }

            $user = Auth::user();
            $payNow = (int) ($validated['pay_now'] ?? 0);

            $booking->status = 'disewa';
            $this->assignUnits($booking, $validated['unit_ids'] ?? []);

            if ($payNow > 0) {
                $booking->payments()->create(Payment::receivedInStore($payNow, 'Pelunasan', $validated['payment_method'] ?? 'Tunai', $user?->id, 'Pelunasan saat barang keluar / pickup'));

                Finance::create([
                    'finance_code' => Finance::generateCode('income'),
                    'ref' => $booking->nota_no,
                    'type' => 'income',
                    'category' => 'Pelunasan Sewa',
                    'line' => 'rent',
                    'amount' => $payNow,
                    'transaction_date' => now()->toDateString(),
                    'description' => "Pelunasan barang keluar {$booking->nota_no} ({$booking->customer_name})",
                    'status' => 'aktif',
                    'created_by' => $user?->id,
                ]);
            }

            $this->refreshPaymentStatus($booking);
            $booking->save();

            Audit::log('rental', "Barang keluar dicatat: {$booking->nota_no} ({$booking->customer_name})", $booking);

            return $this->ok($booking, 'Barang keluar berhasil dicatat. Status sewa aktif.');
        });
    }

    /**
     * POST /api/admin/booking/{id}/return
     * Mencatat pengembalian barang, denda, dan mengembalikan unit ke rak.
     * unit_results: { "<kode unit atau id unit>": { "res": "siap"|"cuci"|"perbaikan"|"hilang", "issue": "…" } }
     */
    public function processReturn(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'return_date' => 'nullable|date',
            'condition' => 'nullable|string',
            'late_days' => 'nullable|integer|min:0',
            'late_fee' => 'nullable|integer|min:0',
            'damage_fee' => 'nullable|integer|min:0',
            'total_fine' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'pay_fine' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|string|max:100',
            'unit_results' => 'nullable|array',
        ]);

        return $this->tx($id, function (Booking $booking) use ($validated) {
            if ($booking->status !== 'disewa') {
                throw new \DomainException("Booking tidak sedang disewa (status: {$this->statusLabel($booking->status)}).");
            }

            $user = Auth::user();
            $returnDate = ! empty($validated['return_date']) ? Carbon::parse($validated['return_date']) : now();
            $condition = $validated['condition'] ?? 'Baik';
            $lateDays = (int) ($validated['late_days'] ?? 0);
            $lateFee = (int) ($validated['late_fee'] ?? 0);
            $damageFee = (int) ($validated['damage_fee'] ?? 0);
            $totalFine = (int) ($validated['total_fine'] ?? ($lateFee + $damageFee));
            // Uang denda yang dicatat tidak boleh melebihi dendanya (selebihnya kembalian, bukan pemasukan)
            $payFine = min((int) ($validated['pay_fine'] ?? 0), $totalFine);
            $unitResults = $validated['unit_results'] ?? [];

            $bookingReturn = BookingReturn::create([
                'booking_id' => $booking->id,
                'return_date' => $returnDate,
                'condition' => $condition,
                'late_days' => $lateDays,
                'late_fee' => $lateFee,
                'damage_fee' => $damageFee,
                'total_fine' => $totalFine,
                'notes' => $validated['notes'] ?? null,
                'unit_results' => $unitResults,
                'inspected_by' => $user?->id,
            ]);

            // Kembalikan unit fisik ke rak sesuai hasil pemeriksaan (dicari dari kode unit FE, atau id unit)
            foreach ($booking->items as $item) {
                $u = $item->product_unit_id ? ProductUnit::find($item->product_unit_id) : null;
                if (! $u) {
                    continue;
                }
                $r = $unitResults[$u->unit_code] ?? $unitResults[$u->id] ?? [];
                $res = $r['res'] ?? 'siap';
                $u->status = match ($res) {
                    'perbaikan', 'cuci' => 'perawatan',
                    'hilang' => 'nonaktif',
                    default => 'tersedia',
                };
                $u->condition = $r['cond'] ?? match ($res) {
                    'perbaikan' => 'Rusak',
                    'hilang' => 'Hilang',
                    'cuci' => 'Kotor',
                    default => 'Baik',
                };
                if (! empty($r['issue'])) {
                    $u->notes = $r['issue'];
                }
                $u->rents_count = ($u->rents_count ?? 0) + 1;
                $u->since_service = ($u->since_service ?? 0) + 1;
                $u->save();
            }

            $booking->status = 'selesai';
            if ($totalFine > 0) {
                // Nilai denda tersimpan di booking_returns.total_fine; total booking ikut naik
                $booking->total_amount = ($booking->total_amount ?? 0) + $totalFine;
            }

            if ($payFine > 0) {
                $booking->payments()->create(Payment::receivedInStore($payFine, 'Denda', $validated['payment_method'] ?? 'Tunai', $user?->id, 'Pembayaran denda & kerusakan'));

                Finance::create([
                    'finance_code' => Finance::generateCode('income'),
                    'ref' => $booking->nota_no,
                    'type' => 'income',
                    'category' => 'Denda & Kerusakan',
                    'line' => 'rent',
                    'amount' => $payFine,
                    'transaction_date' => now()->toDateString(),
                    'description' => "Pembayaran denda {$booking->nota_no} ({$booking->customer_name})",
                    'status' => 'aktif',
                    'created_by' => $user?->id,
                ]);
            }

            $this->refreshPaymentStatus($booking);
            $booking->save();

            $fineText = $totalFine > 0 ? ' · Denda Rp ' . number_format($totalFine, 0, ',', '.') : '';
            Audit::log('rental', "Pengembalian barang {$booking->nota_no} ({$booking->customer_name}) · Kondisi: {$condition}{$fineText}", $booking);

            return $this->ok($booking, 'Pengembalian barang berhasil dicatat. Status rental selesai.', ['return' => $bookingReturn]);
        });
    }

    /* ------------------------------------------------------------------ */

    /**
     * Cari booking dari kode FE, kunci barisnya (cegah klik ganda / dua admin bersamaan), lalu jalankan $work
     * dalam satu transaksi. DomainException = ditolak dengan pesan untuk admin; semua perubahan dibatalkan.
     */
    private function tx(string $id, \Closure $work): JsonResponse
    {
        $found = Booking::findByRef($id);
        if (! $found) {
            return response()->json(['ok' => false, 'msg' => 'Booking tidak ditemukan di server.'], 404);
        }

        try {
            return DB::transaction(function () use ($found, $work) {
                $booking = Booking::with(['items'])->whereKey($found->id)->lockForUpdate()->firstOrFail();

                return $work($booking);
            });
        } catch (\DomainException $e) {
            return response()->json(['ok' => false, 'msg' => $e->getMessage()], 422);
        }
    }

    /**
     * Pasangkan unit fisik ke barang booking dan tandai 'disewa'.
     * Unit harus milik produk yang sama dan sedang 'tersedia' (cegah satu unit disewa dua orang).
     */
    private function assignUnits(Booking $booking, array $unitIds): void
    {
        $picked = [];
        foreach ($unitIds as $key => $val) {
            if (is_array($val)) {                     // format FE: [{pid, code}, …]
                foreach ($val as $u) {
                    if (is_array($u) && ! empty($u['code'])) {
                        $picked[] = ['pid' => $u['pid'] ?? null, 'code' => (string) $u['code'], 'item' => null];
                    }
                }
            } elseif ($val) {                         // format lama: item_id => unit_id
                $item = $booking->items->firstWhere('id', (int) $key);
                $unit = ProductUnit::find((int) $val);
                if ($item && $unit) {
                    $picked[] = ['pid' => $item->product_id, 'code' => $unit->unit_code, 'item' => $item];
                }
            }
        }

        foreach ($picked as $p) {
            $unit = ProductUnit::where('unit_code', $p['code'])->lockForUpdate()->first();
            if (! $unit) {
                continue; // unit belum terdaftar di database (data unit masih di browser) — dilewati
            }
            if ($p['pid'] && $unit->product_id !== $p['pid']) {
                throw new \DomainException("Unit {$unit->unit_code} bukan milik barang yang disewa.");
            }
            if ($unit->status !== 'tersedia') {
                throw new \DomainException("Unit {$unit->unit_code} sedang {$unit->status}, pilih unit lain.");
            }
            $item = $p['item'] ?? $booking->items->first(fn ($i) => $i->product_id === $unit->product_id && ! $i->product_unit_id);
            if ($item) {
                $item->update(['product_unit_id' => $unit->id]);
            }
            $unit->update(['status' => 'disewa']);
        }
    }

    /** Lunas bila seluruh tagihan (termasuk denda) sudah dibayar. Nilai 'paid' tidak ada di kolom bookings. */
    private function refreshPaymentStatus(Booking $booking): void
    {
        $totalPaid = (int) $booking->payments()->where('status', 'verified')->sum('amount');
        $due = max(0, (int) $booking->total_amount - (int) $booking->settle_disc_amount);
        if ($totalPaid >= $due) {
            $booking->payment_status = 'lunas';
        } elseif ($booking->payment_status === 'lunas') {
            $booking->payment_status = 'dp_paid'; // ada denda baru yang belum dibayar
        }
    }

    private function statusLabel(string $s): string
    {
        return str_replace('_', ' ', $s);
    }

    private function ok(Booking $booking, string $msg, array $extra = []): JsonResponse
    {
        return response()->json(array_merge([
            'ok' => true,
            'msg' => $msg,
            'data' => OrderPresenter::booking($booking->fresh(OrderPresenter::BOOKING_WITH)),
        ], $extra));
    }
}
