<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Refund;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Pembatalan booking sewa + pencatatan hak refund DP.
 *
 * Aturan (sama dengan FE: Rules.canRefund & Rules.refundAmount):
 *  - Refund bila dibatalkan paling lambat H-{cancelDays} (default 2) dari tanggal ambil.
 *  - Nominal = total pembayaran DP (verified + pending) × refundPercent% (default 100).
 *  - Bila DP dikembalikan, customer wajib memilih metode: transfer (bank, no. rekening, atas nama) atau tunai di toko.
 */
class BookingCancelController extends Controller
{
    private const CANCELLABLE = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'];

    /**
     * POST /api/booking/{id}/batal  (customer login, id = booking_code / nota_no / id)
     * Body: reason, refund_method (transfer|tunai), refund_bank, refund_account_number, refund_account_name
     */
    public function customer(Request $request, string $id): JsonResponse
    {
        $booking = $this->findBooking($id);
        $user = Auth::user();

        $owns = ($booking->user_id && $booking->user_id === $user->id)
            || ($booking->customer_email && strcasecmp($booking->customer_email, (string) $user->email) === 0);
        if (! $owns && ! $user->isStaff()) {
            return response()->json(['ok' => false, 'msg' => 'Booking ini bukan milik akun kamu.'], 403);
        }
        if (! in_array($booking->status, self::CANCELLABLE, true)) {
            return response()->json(['ok' => false, 'msg' => 'Booking ini sudah tidak bisa dibatalkan.'], 409);
        }

        $hasDp = in_array($booking->payment_status, ['dp_verifying', 'dp_paid'], true);
        $refundable = $this->isRefundable($booking);
        $needMethod = $hasDp && $refundable;

        $data = $request->validate($this->rules($needMethod), $this->messages());

        return DB::transaction(function () use ($booking, $data, $hasDp, $refundable) {
            $refund = $this->applyCancel($booking, $data['reason'], $hasDp ? ($refundable ? 'refund' : 'forfeit') : 'none', $data, 'customer');

            return response()->json([
                'ok' => true,
                'msg' => $hasDp && $refundable
                    ? (($data['refund_method'] ?? '') === 'tunai' ? 'Booking dibatalkan. DP bisa diambil tunai di toko.' : 'Booking dibatalkan. Pengembalian DP sedang diproses.')
                    : 'Booking dibatalkan.',
                'data' => ['booking' => $booking->fresh(), 'refund' => $refund],
            ]);
        });
    }

    /**
     * POST /api/admin/booking/{id}/batal  (admin/owner)
     * Body: reason, dp_mode (refund|forfeit|none), refund_* (opsional — bisa dilengkapi saat Proses refund)
     */
    public function admin(Request $request, string $id): JsonResponse
    {
        $booking = $this->findBooking($id);
        if (in_array($booking->status, ['selesai', 'dibatalkan', 'disewa'], true)) {
            return response()->json(['ok' => false, 'msg' => 'Booking ini sudah tidak bisa dibatalkan.'], 409);
        }

        $data = $request->validate(array_merge($this->rules(false), [
            'dp_mode' => 'required|in:refund,forfeit,none',
        ]), $this->messages());

        return DB::transaction(function () use ($booking, $data) {
            $refund = $this->applyCancel($booking, $data['reason'], $data['dp_mode'], $data, 'admin');

            Audit::log('pembatalan', "Membatalkan booking " . ($booking->nota_no ?: $booking->booking_code) . ": {$data['reason']}" . ($data['dp_mode'] === 'refund' ? ' (DP dikembalikan)' : ($data['dp_mode'] === 'forfeit' ? ' (DP hangus)' : '')), $booking);

            return response()->json(['ok' => true, 'msg' => 'Booking dibatalkan.', 'data' => ['booking' => $booking->fresh(), 'refund' => $refund]]);
        });
    }

    /* ------------------------------------------------------------------ */

    private function findBooking(string $id): Booking
    {
        return is_numeric($id)
            ? Booking::findOrFail($id)
            : Booking::where('booking_code', $id)->orWhere('nota_no', $id)->firstOrFail();
    }

    private function isRefundable(Booking $booking): bool
    {
        $days = (int) Setting::get('cancelDays', 2);
        return Carbon::today()->diffInDays(Carbon::parse($booking->start_date)->startOfDay(), false) >= $days;
    }

    private function refundAmount(Booking $booking): int
    {
        $paid = (int) $booking->payments()->whereIn('status', ['verified', 'pending'])->sum('amount');
        $pct = (int) Setting::get('refundPercent', 100);
        return (int) round($paid * max(0, min(100, $pct)) / 100);
    }

    private function rules(bool $needMethod): array
    {
        return [
            'reason' => 'required|string|max:255',
            'refund_method' => ($needMethod ? 'required' : 'nullable') . '|in:transfer,tunai',
            'refund_bank' => 'nullable|required_if:refund_method,transfer|string|max:60',
            'refund_account_number' => ['nullable', 'required_if:refund_method,transfer', 'regex:/^\d{6,30}$/'],
            'refund_account_name' => 'nullable|required_if:refund_method,transfer|string|max:100',
        ];
    }

    private function messages(): array
    {
        return [
            'reason.required' => 'Tulis alasan pembatalan.',
            'refund_method.required' => 'Pilih metode pengembalian DP: transfer atau tunai.',
            'refund_bank.required_if' => 'Isi nama bank / e-wallet tujuan.',
            'refund_account_number.required_if' => 'Isi nomor rekening / HP e-wallet.',
            'refund_account_number.regex' => 'Nomor rekening / HP e-wallet harus 6–30 digit angka.',
            'refund_account_name.required_if' => 'Isi nama pemilik rekening.',
        ];
    }

    /**
     * Ubah status booking & catat baris refund. $mode: refund | forfeit | none
     */
    private function applyCancel(Booking $booking, string $reason, string $mode, array $data, string $by): ?Refund
    {
        $booking->update([
            'status' => 'dibatalkan',
            'cancel_at' => now(),
            'cancel_reason' => $reason,
            'cancel_auto' => false,
            'payment_status' => $mode === 'refund' ? 'refund_pending' : ($mode === 'forfeit' ? 'forfeited' : $booking->payment_status),
        ]);

        $method = $mode === 'refund' ? ($data['refund_method'] ?? null) : null;
        $tf = $method === 'transfer';

        return Refund::updateOrCreate(['booking_id' => $booking->id], [
            'amount' => $mode === 'none' ? 0 : $this->refundAmount($booking),
            'method' => $method,
            'bank_name' => $tf ? ($data['refund_bank'] ?? null) : null,
            'account_number' => $tf ? ($data['refund_account_number'] ?? null) : null,
            'account_name' => $tf ? ($data['refund_account_name'] ?? null) : null,
            'bank_account' => $tf ? Refund::accountSummary($data['refund_bank'] ?? null, $data['refund_account_number'] ?? null, $data['refund_account_name'] ?? null) : null,
            'reason' => $reason,
            'status' => $mode === 'refund' ? 'menunggu' : ($mode === 'forfeit' ? 'hangus' : 'tidak_perlu'),
            'requested_by' => $by,
        ]);
    }
}
