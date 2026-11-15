<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingChange;
use App\Models\BookingExtension;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\Refund;
use App\Support\Audit;
use App\Support\BookingRequests;
use App\Support\OrderPresenter;
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

    /** Data booking terbaru (bentuk tampilan) untuk digabung FE setelah aksi. */
    private function bookingData(Booking $b): array
    {
        return OrderPresenter::booking($b->fresh(OrderPresenter::BOOKING_WITH));
    }

    /**
     * Menyetujui atau menolak permintaan ganti barang.
     * POST /api/admin/permintaan/change/{id}/action { action: setujui|tolak, admin_note? }
     */
    public function actionChange(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:setujui,tolak',
            'admin_note' => 'nullable|string|max:255',
        ]);

        // FE masih memakai id lokal (CHG-…) untuk permintaan yang belum tersimpan di server → 404 yang jelas, bukan error 500
        if (! ctype_digit($id) || ! BookingChange::whereKey((int) $id)->exists()) {
            return response()->json(['ok' => false, 'msg' => 'Permintaan ganti barang tidak ditemukan di server.'], 404);
        }

        return DB::transaction(function () use ($request, $id) {
            // Kunci & cek ulang: permintaan yang sudah diputuskan tidak boleh diproses dua kali (selisih harga dobel)
            $change = BookingChange::with('booking.items')->whereKey((int) $id)->lockForUpdate()->firstOrFail();
            if ($change->status !== 'menunggu') {
                return response()->json(['ok' => false, 'msg' => "Permintaan ini sudah {$change->status}."], 422);
            }
            $ok = $request->input('action') === 'setujui';
            $ok ? BookingRequests::approveChange($change, $request->input('admin_note'))
                : BookingRequests::rejectChange($change, $request->input('admin_note'));

            return response()->json([
                'ok' => true,
                'msg' => $ok ? 'Permintaan ganti barang berhasil disetujui.' : 'Permintaan ganti barang ditolak.',
                'change' => $change->fresh(),
                'data' => $this->bookingData($change->booking),
            ]);
        });
    }

    /**
     * Menyetujui atau menolak perpanjangan sewa.
     * POST /api/admin/permintaan/extend/{id}/action { action: setujui|tolak, is_paid?, reason? }
     */
    public function actionExtend(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:setujui,tolak',
            'is_paid' => 'nullable|boolean',
            'reason' => 'nullable|string|max:255',
        ]);

        // FE masih memakai id lokal (EXT-…) untuk permintaan yang belum tersimpan di server → 404 yang jelas, bukan error 500
        if (! ctype_digit($id) || ! BookingExtension::whereKey((int) $id)->exists()) {
            return response()->json(['ok' => false, 'msg' => 'Permintaan perpanjangan tidak ditemukan di server.'], 404);
        }

        return DB::transaction(function () use ($request, $id) {
            // Kunci & cek ulang: klik "setujui" dua kali tidak boleh menambah hari & biaya dua kali
            $ext = BookingExtension::with('booking')->whereKey((int) $id)->lockForUpdate()->firstOrFail();
            if ($ext->status !== 'menunggu') {
                return response()->json(['ok' => false, 'msg' => "Permintaan ini sudah {$ext->status}."], 422);
            }
            $ok = $request->input('action') === 'setujui';
            $ok ? BookingRequests::approveExtension($ext, $request->boolean('is_paid'))
                : BookingRequests::rejectExtension($ext, $request->input('reason'));

            return response()->json([
                'ok' => true,
                'msg' => $ok ? 'Perpanjangan sewa disetujui.' : 'Perpanjangan sewa ditolak.',
                'extension' => $ext->fresh(),
                'data' => $this->bookingData($ext->booking),
            ]);
        });
    }

    /**
     * Memproses pengembalian dana (refund) untuk booking yang dibatalkan.
     * POST /api/admin/permintaan/refund/{bookingId}   (bookingId = id / booking_code / nota_no)
     * multipart/form-data:
     *   amount, status (selesai|hangus|tidak_perlu), reason (opsional),
     *   refund_method (transfer|tunai), refund_bank, refund_account_number, refund_account_name,
     *   transfer_ref (opsional), proof_file (foto bukti; wajib untuk transfer yang diselesaikan)
     */
    public function actionRefund(Request $request, string $bookingId): JsonResponse
    {
        $booking = $this->findBooking($bookingId);
        $existing = Refund::where('booking_id', $booking->id)->first();
        $isDoneTransfer = $request->input('status') === 'selesai' && $request->input('refund_method', $existing?->method) === 'transfer';

        $request->validate([
            'amount' => 'required|integer|min:0',
            'status' => 'required|in:selesai,hangus,tidak_perlu',
            'reason' => 'nullable|string',
            'refund_method' => 'nullable|in:transfer,tunai',
            'refund_bank' => 'nullable|required_if:refund_method,transfer|string|max:60',
            'refund_account_number' => ['nullable', 'required_if:refund_method,transfer', 'regex:/^\d{6,30}$/'],
            'refund_account_name' => 'nullable|required_if:refund_method,transfer|string|max:100',
            'transfer_ref' => 'nullable|string|max:100',
            'proof_file' => [($isDoneTransfer && ! $existing?->proof_file) ? 'required' : 'nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120'],
        ], [
            'proof_file.required' => 'Upload foto bukti transfer.',
            'refund_account_number.regex' => 'Nomor rekening / HP e-wallet harus 6–30 digit angka.',
        ]);

        return DB::transaction(function () use ($booking, $request, $existing) {
            // Kunci baris supaya dua klik "Proses refund" tidak mencatat pengeluaran dua kali
            $booking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            $status = $request->input('status');
            $amount = (int) $request->input('amount');

            if ($booking->status !== 'dibatalkan') {
                return response()->json(['ok' => false, 'msg' => 'Refund hanya untuk booking yang sudah dibatalkan.'], 422);
            }
            if ($booking->payment_status === 'refunded') {
                return response()->json(['ok' => false, 'msg' => 'DP booking ini sudah dikembalikan sebelumnya.'], 422);
            }
            // Batas = uang terverifikasi, atau hak refund yang dihitung server saat pembatalan
            // (termasuk DP yang buktinya belum sempat diverifikasi ketika booking dibatalkan)
            $max = max((int) $booking->payments()->where('status', 'verified')->sum('amount'), (int) $existing?->amount);
            if ($amount > $max) {
                return response()->json(['ok' => false, 'msg' => 'Nominal refund melebihi uang yang sudah diterima (Rp ' . number_format($max, 0, ',', '.') . ').'], 422);
            }

            $method = $request->input('refund_method', $existing?->method);
            $tf = $method === 'transfer';

            $bank = $tf ? $request->input('refund_bank', $existing?->bank_name) : null;
            $number = $tf ? $request->input('refund_account_number', $existing?->account_number) : null;
            $holder = $tf ? $request->input('refund_account_name', $existing?->account_name) : null;

            $proof = $existing?->proof_file;
            if ($request->hasFile('proof_file')) {
                $proof = $request->file('proof_file')->store('refunds', 'public');
            }

            $refund = Refund::updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'amount' => $amount,
                    'method' => $method,
                    'bank_name' => $bank,
                    'account_number' => $number,
                    'account_name' => $holder,
                    'transfer_ref' => $request->input('transfer_ref', $existing?->transfer_ref),
                    'proof_file' => $proof,
                    'reason' => $request->input('reason', $existing?->reason),
                    'status' => $status,
                    'processed_by' => Auth::id(),
                    'processed_at' => now(),
                ]
            );

            if ($status === 'selesai') {
                $booking->update(['payment_status' => 'refunded']);
                // Uang yang ditransfer balik ke customer = pengeluaran kas
                if ($amount > 0) {
                    Finance::create([
                        'finance_code' => Finance::generateCode('expense'),
                        'ref' => $booking->nota_no,
                        'type' => 'expense',
                        'category' => 'Refund DP',
                        'line' => 'rent',
                        'amount' => $amount,
                        'transaction_date' => now()->toDateString(),
                        'description' => "Refund DP {$booking->nota_no} ({$booking->customer_name})",
                        'status' => 'aktif',
                        'created_by' => Auth::id(),
                    ]);
                }
            } elseif ($status === 'hangus') {
                $booking->update(['payment_status' => 'forfeited']);
            }

            $how = $method === 'tunai' ? 'tunai di toko' : ($tf ? "transfer ke {$refund->bank_account}" : 'metode tidak dicatat');
            Audit::log(
                'keuangan',
                "Memproses refund pembatalan booking #{$booking->booking_code} sebesar Rp " . number_format($amount, 0, ',', '.') . " ({$status}, {$how})",
                $booking
            );

            return response()->json([
                'ok' => true,
                'msg' => 'Status refund berhasil diperbarui.',
                'refund' => $refund,
            ]);
        });
    }

    /**
     * Menandai konfirmasi refund (foto bukti + pesan) sudah dikirim ke WhatsApp customer.
     * POST /api/admin/permintaan/refund/{bookingId}/notified
     */
    public function notifyRefund(string $bookingId): JsonResponse
    {
        $booking = $this->findBooking($bookingId);
        $refund = Refund::where('booking_id', $booking->id)->firstOrFail();
        $refund->update(['notified_at' => now()]);

        Audit::log('keuangan', "Mengirim konfirmasi refund booking #{$booking->booking_code} ke WhatsApp customer", $booking);

        return response()->json(['ok' => true, 'msg' => 'Konfirmasi refund tercatat terkirim.', 'refund' => $refund]);
    }

    private function findBooking(string $id): Booking
    {
        $booking = Booking::findByRef($id);
        abort_unless($booking, 404, 'Booking tidak ditemukan di server.');

        return $booking;
    }
}
