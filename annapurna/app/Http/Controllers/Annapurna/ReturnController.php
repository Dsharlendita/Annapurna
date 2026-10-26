<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingReturn;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\ProductUnit;
use App\Support\Audit;
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
     */
    public function pickup(Request $request, int $id): JsonResponse
    {
        $booking = Booking::with(['items.product'])->findOrFail($id);

        if (! in_array($booking->status, ['dikonfirmasi', 'menunggu_konfirmasi'])) {
            return response()->json([
                'ok' => false,
                'msg' => "Booking tidak dalam status siap keluar (status saat ini: {$booking->status}).",
            ], 422);
        }

        $validated = $request->validate([
            'condition' => 'nullable|string',
            'notes' => 'nullable|string',
            'pay_now' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|string',
            'unit_ids' => 'nullable|array', // e.g. [booking_item_id => product_unit_id]
        ]);

        return DB::transaction(function () use ($booking, $validated, $request) {
            $user = Auth::user();
            $payNow = (int) ($validated['pay_now'] ?? 0);

            // Update status booking
            $booking->status = 'disewa';

            // Hubungkan unit fisik jika disediakan dan tandai sebagai 'disewa'
            if (! empty($validated['unit_ids'])) {
                foreach ($validated['unit_ids'] as $itemId => $unitId) {
                    $item = $booking->items()->where('id', $itemId)->first();
                    if ($item && $unitId) {
                        $item->update(['product_unit_id' => $unitId]);
                        ProductUnit::where('id', $unitId)->update(['status' => 'disewa']);
                    }
                }
            } else {
                // Tandai semua unit yang sudah terpasang di booking items menjadi 'disewa'
                foreach ($booking->items as $item) {
                    if ($item->product_unit_id) {
                        ProductUnit::where('id', $item->product_unit_id)->update(['status' => 'disewa']);
                    }
                }
            }

            // Catat pembayaran pelunasan jika ada
            if ($payNow > 0) {
                Payment::create([
                    'booking_id' => $booking->id,
                    'amount' => $payNow,
                    'type' => 'pelunasan',
                    'payment_method' => $validated['payment_method'] ?? 'cash',
                    'status' => 'verified',
                    'verified_by' => $user?->id,
                    'verified_at' => now(),
                    'notes' => 'Pelunasan saat barang keluar / pickup',
                ]);

                // Catat ke buku kas keuangan
                Finance::create([
                    'finance_code' => Finance::generateCode('income'),
                    'ref' => $booking->nota_no,
                    'type' => 'income',
                    'category' => 'Penyewaan Alat',
                    'line' => 'rent',
                    'amount' => $payNow,
                    'transaction_date' => now()->toDateString(),
                    'description' => "Pelunasan barang keluar {$booking->nota_no} ({$booking->customer_name})",
                    'status' => 'aktif',
                    'created_by' => $user?->id,
                ]);

                $totalPaid = $booking->payments()->where('status', 'verified')->sum('amount');
                if ($totalPaid >= $booking->total_amount) {
                    $booking->payment_status = 'paid';
                }
            }

            $booking->save();

            Audit::log(
                'rental',
                "Barang keluar dicatat: {$booking->nota_no} ({$booking->customer_name})",
                $booking
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Barang keluar berhasil dicatat. Status sewa aktif.',
                'booking' => $booking->fresh(['items.product', 'payments']),
            ]);
        });
    }

    /**
     * POST /api/admin/booking/{id}/return
     * Mencatat pengembalian barang, cek denda, dan mengembalikan unit ke status tersedia.
     */
    public function processReturn(Request $request, int $id): JsonResponse
    {
        $booking = Booking::with(['items.product', 'items.unit'])->findOrFail($id);

        if ($booking->status !== 'disewa') {
            return response()->json([
                'ok' => false,
                'msg' => "Booking tidak dalam status disewa (status saat ini: {$booking->status}).",
            ], 422);
        }

        $validated = $request->validate([
            'return_date' => 'nullable|date',
            'condition' => 'nullable|string',
            'late_days' => 'nullable|integer|min:0',
            'late_fee' => 'nullable|integer|min:0',
            'damage_fee' => 'nullable|integer|min:0',
            'total_fine' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'pay_fine' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|string',
            'unit_results' => 'nullable|array', // e.g. [unit_id => ['res' => 'tersedia'|'cuci'|'perbaikan'|'hilang', 'cond' => 'Baik']]
        ]);

        return DB::transaction(function () use ($booking, $validated, $request) {
            $user = Auth::user();

            $returnDate = ! empty($validated['return_date']) ? Carbon::parse($validated['return_date']) : now();
            $condition = $validated['condition'] ?? 'Baik';
            $lateDays = (int) ($validated['late_days'] ?? 0);
            $lateFee = (int) ($validated['late_fee'] ?? 0);
            $damageFee = (int) ($validated['damage_fee'] ?? 0);
            $totalFine = (int) ($validated['total_fine'] ?? ($lateFee + $damageFee));
            $notes = $validated['notes'] ?? null;
            $payFine = (int) ($validated['pay_fine'] ?? 0);
            $unitResults = $validated['unit_results'] ?? [];

            // 1. Simpan rekam jejak BookingReturn
            $bookingReturn = BookingReturn::create([
                'booking_id' => $booking->id,
                'return_date' => $returnDate,
                'condition' => $condition,
                'late_days' => $lateDays,
                'late_fee' => $lateFee,
                'damage_fee' => $damageFee,
                'total_fine' => $totalFine,
                'notes' => $notes,
                'unit_results' => $unitResults,
                'inspected_by' => $user?->id,
            ]);

            // 2. Kembalikan unit fisik ke rak inventaris
            foreach ($booking->items as $item) {
                if ($item->product_unit_id) {
                    $u = ProductUnit::find($item->product_unit_id);
                    if ($u) {
                        $result = $unitResults[$u->id]['res'] ?? 'tersedia';
                        $cond = $unitResults[$u->id]['cond'] ?? 'Baik';

                        $newStatus = match ($result) {
                            'perbaikan' => 'perawatan',
                            'hilang' => 'nonaktif',
                            'cuci' => 'perawatan',
                            default => 'tersedia',
                        };

                        $u->status = $newStatus;
                        $u->condition = $cond;
                        $u->rents_count = ($u->rents_count ?? 0) + 1;
                        $u->since_service = ($u->since_service ?? 0) + 1;
                        $u->save();
                    }
                }
            }

            // 3. Update data booking
            $booking->status = 'selesai';
            if ($totalFine > 0) {
                $booking->fine_amount = ($booking->fine_amount ?? 0) + $totalFine;
                $booking->total_amount = ($booking->total_amount ?? 0) + $totalFine;
            }

            // 4. Catat pembayaran denda jika ada yang dibayarkan sekarang
            if ($payFine > 0) {
                Payment::create([
                    'booking_id' => $booking->id,
                    'amount' => $payFine,
                    'type' => 'denda',
                    'payment_method' => $validated['payment_method'] ?? 'cash',
                    'status' => 'verified',
                    'verified_by' => $user?->id,
                    'verified_at' => now(),
                    'notes' => 'Pembayaran denda & kerusakan',
                ]);

                // Catat kas masuk lini rental
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

            $totalPaid = $booking->payments()->where('status', 'verified')->sum('amount');
            if ($totalPaid >= $booking->total_amount) {
                $booking->payment_status = 'paid';
            }

            $booking->save();

            // 5. Audit log
            $fineText = $totalFine > 0 ? " · Denda Rp " . number_format($totalFine, 0, ',', '.') : '';
            Audit::log(
                'rental',
                "Pengembalian barang {$booking->nota_no} ({$booking->customer_name}) · Kondisi: {$condition}{$fineText}",
                $booking
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Pengembalian barang berhasil dicatat. Status rental selesai.',
                'booking' => $booking->fresh(['items.product', 'returnLog', 'payments']),
                'return' => $bookingReturn,
            ]);
        });
    }
}
