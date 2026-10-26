<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingChange;
use App\Models\BookingExtension;
use App\Models\Payment;
use App\Models\Refund;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PermintaanController extends Controller
{
    /**
     * Mengambil daftar seluruh permintaan admin (Ganti Barang, Perpanjangan, Refund).
     */
    public function index(Request $request): JsonResponse
    {
        $changes = BookingChange::with(['booking', 'actionUser'])->latest()->get();
        $extensions = BookingExtension::with(['booking', 'actionUser'])->latest()->get();
        $refunds = Refund::with(['booking', 'processor'])->latest()->get();

        return response()->json([
            'ok' => true,
            'data' => [
                'changes' => $changes,
                'extensions' => $extensions,
                'refunds' => $refunds,
                'counts' => [
                    'waiting_changes' => $changes->where('status', 'menunggu')->count(),
                    'waiting_extensions' => $extensions->where('status', 'menunggu')->count(),
                    'waiting_refunds' => $refunds->where('status', 'menunggu')->count(),
                ],
            ],
        ]);
    }

    /**
     * Menyetujui atau menolak permintaan ganti barang.
     */
    public function actionChange(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:setujui,tolak',
            'admin_note' => 'nullable|string|max:255',
        ]);

        $change = BookingChange::with('booking.items')->findOrFail($id);
        $action = $request->input('action');
        $note = $request->input('admin_note');

        return DB::transaction(function () use ($change, $action, $note) {
            $booking = $change->booking;

            if ($action === 'setujui') {
                $change->update([
                    'status' => 'disetujui',
                    'admin_note' => $note,
                    'action_by' => Auth::id(),
                    'action_at' => now(),
                ]);

                // Update item di booking jika ada
                if ($change->from_product_id && $change->to_product_id) {
                    $item = $booking->items()->where('product_id', $change->from_product_id)->first();
                    if ($item) {
                        $item->update([
                            'product_id' => $change->to_product_id,
                            'product_name' => $change->to_product_name ?: $item->product_name,
                            'size' => $change->to_size ?: $item->size,
                        ]);
                    }
                }

                // Perbarui total amount jika ada selisih harga
                if ($change->price_diff != 0) {
                    $booking->total_amount = max(0, $booking->total_amount + $change->price_diff);
                    $booking->save();
                }

                Audit::log(
                    'pergantian',
                    "Menyetujui permintaan ganti barang pada booking #{$booking->booking_code}: {$change->from_product_name} -> {$change->to_product_name}",
                    $booking
                );

                return response()->json([
                    'ok' => true,
                    'msg' => 'Permintaan ganti barang berhasil disetujui.',
                    'change' => $change->fresh(),
                ]);
            } else {
                $change->update([
                    'status' => 'ditolak',
                    'admin_note' => $note,
                    'action_by' => Auth::id(),
                    'action_at' => now(),
                ]);

                Audit::log(
                    'pergantian',
                    "Menolak permintaan ganti barang pada booking #{$booking->booking_code}" . ($note ? ": {$note}" : ""),
                    $booking
                );

                return response()->json([
                    'ok' => true,
                    'msg' => 'Permintaan ganti barang ditolak.',
                    'change' => $change->fresh(),
                ]);
            }
        });
    }

    /**
     * Menyetujui atau menolak perpanjangan sewa.
     */
    public function actionExtend(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:setujui,tolak',
            'is_paid' => 'nullable|boolean',
            'reason' => 'nullable|string|max:255',
        ]);

        $ext = BookingExtension::with('booking')->findOrFail($id);
        $action = $request->input('action');
        $isPaid = $request->boolean('is_paid');

        return DB::transaction(function () use ($ext, $action, $isPaid) {
            $booking = $ext->booking;

            if ($action === 'setujui') {
                $ext->update([
                    'status' => 'disetujui',
                    'action_by' => Auth::id(),
                    'action_at' => now(),
                ]);

                // Perpanjang tanggal booking
                $booking->end_date = $ext->to_date;
                $booking->days += $ext->days;
                $booking->total_amount += $ext->cost;
                $booking->save();

                // Jika sudah dibayar lunas sekarang
                if ($isPaid && $ext->cost > 0) {
                    Payment::create([
                        'booking_id' => $booking->id,
                        'payment_type' => 'Perpanjangan',
                        'amount' => $ext->cost,
                        'status' => 'verified',
                        'paid_at' => now(),
                        'verified_by' => Auth::id(),
                        'verified_at' => now(),
                        'notes' => 'Pembayaran perpanjangan sewa ' . $ext->days . ' hari',
                    ]);
                }

                Audit::log(
                    'perpanjangan',
                    "Menyetujui perpanjangan booking #{$booking->booking_code} sampai {$ext->to_date->format('Y-m-d')} (+{$ext->days} hari)",
                    $booking
                );

                return response()->json([
                    'ok' => true,
                    'msg' => 'Perpanjangan sewa disetujui.',
                    'extension' => $ext->fresh(),
                ]);
            } else {
                $ext->update([
                    'status' => 'ditolak',
                    'action_by' => Auth::id(),
                    'action_at' => now(),
                ]);

                Audit::log(
                    'perpanjangan',
                    "Menolak perpanjangan booking #{$booking->booking_code}",
                    $booking
                );

                return response()->json([
                    'ok' => true,
                    'msg' => 'Perpanjangan sewa ditolak.',
                    'extension' => $ext->fresh(),
                ]);
            }
        });
    }

    /**
     * Memproses pengembalian dana (refund) untuk booking yang dibatalkan.
     */
    public function actionRefund(Request $request, int $bookingId): JsonResponse
    {
        $request->validate([
            'amount' => 'required|integer|min:0',
            'bank_account' => 'nullable|string|max:100',
            'reason' => 'nullable|string',
            'status' => 'required|in:selesai,hangus,tidak_perlu',
        ]);

        $booking = Booking::findOrFail($bookingId);

        return DB::transaction(function () use ($booking, $request) {
            $status = $request->input('status');
            $amount = (int) $request->input('amount');
            $bank = $request->input('bank_account');
            $reason = $request->input('reason');

            $refund = Refund::updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'amount' => $amount,
                    'bank_account' => $bank,
                    'reason' => $reason,
                    'status' => $status,
                    'processed_by' => Auth::id(),
                    'processed_at' => now(),
                ]
            );

            if ($status === 'selesai') {
                $booking->update([
                    'payment_status' => 'refunded',
                ]);
            } elseif ($status === 'hangus') {
                $booking->update([
                    'payment_status' => 'forfeited',
                ]);
            }

            Audit::log(
                'keuangan',
                "Memproses refund pembatalan booking #{$booking->booking_code} sebesar Rp " . number_format($amount, 0, ',', '.') . " ({$status})",
                $booking
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Status refund berhasil diperbarui.',
                'refund' => $refund,
            ]);
        });
    }
}
