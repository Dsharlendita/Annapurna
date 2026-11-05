<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Sale;
use App\Models\Setting;
use App\Services\PaymentService;
use App\Support\Audit;
use App\Support\OrderPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Daftar & aksi status booking yang dibaca langsung dari database
 * (menggantikan data booking di localStorage untuk halaman admin/booking dan pesanan).
 */
class OrderController extends Controller
{
    private const ACTIVE = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'];

    /** GET /api/admin/bookings — semua booking (FE sendiri menyembunyikan pesanan online yang belum dibayar). */
    public function adminBookings(): JsonResponse
    {
        $rows = Booking::with(OrderPresenter::BOOKING_WITH)
            ->latest('id')
            ->limit(1000)
            ->get()
            ->map(fn ($b) => OrderPresenter::booking($b));

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    /** GET /api/pesanan — booking & pembelian milik customer yang sedang login. */
    public function myOrders(): JsonResponse
    {
        $user = Auth::user();
        $mine = fn ($q) => $q->where('user_id', $user->id)->orWhere('customer_email', strtolower($user->email));

        return response()->json(['ok' => true, 'data' => [
            'bookings' => Booking::with(OrderPresenter::BOOKING_WITH)->where($mine)->latest('id')->get()->map(fn ($b) => OrderPresenter::booking($b)),
            'sales' => Sale::with(OrderPresenter::SALE_WITH)->where($mine)->latest('id')->get()->map(fn ($s) => OrderPresenter::sale($s)),
        ]]);
    }

    /**
     * POST /api/admin/booking/{id}/verifikasi  { action: terima|tolak, reason? }
     * terima: verifikasi bukti DP yang menunggu, atau (tanpa bukti) catat DP diterima manual.
     * tolak : bukti ditolak, booking kembali menunggu pembayaran dengan batas waktu baru.
     */
    public function verifyBooking(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'action' => 'required|in:terima,tolak',
            'reason' => 'nullable|string|max:255',
        ]);

        return $this->tx(function () use ($id, $v) {
            $b = $this->lockBooking($id);

            if ($v['action'] === 'terima') {
                if (!in_array($b->status, ['menunggu_pembayaran', 'menunggu_konfirmasi'], true)) {
                    throw new \DomainException("Booking berstatus {$b->status}, DP tidak bisa diverifikasi lagi.");
                }
                $pending = $b->payments()->where('status', 'pending')->where('payment_type', 'DP')->latest('id')->first();
                if (!$pending) {
                    // "Tandai DP dibayar": customer transfer/bayar tanpa unggah bukti
                    $pending = Payment::create([
                        'booking_id' => $b->id,
                        'payment_type' => 'DP',
                        'amount' => $b->dp_amount,
                        'bank_name' => 'Dicatat admin',
                        'status' => 'pending',
                        'paid_at' => now(),
                        'notes' => 'DP ditandai dibayar oleh ' . (Auth::user()->name ?? 'admin'),
                    ]);
                }
                PaymentService::verify($pending);
            } else {
                if ($b->status !== 'menunggu_konfirmasi') {
                    throw new \DomainException('Hanya booking yang menunggu konfirmasi yang buktinya bisa ditolak.');
                }
                $b->payments()->where('status', 'pending')->update([
                    'status' => 'rejected',
                    'notes' => 'Ditolak: ' . ($v['reason'] ?? '-'),
                    'verified_by' => Auth::id(),
                    'verified_at' => now(),
                ]);
                $b->update([
                    'status' => 'menunggu_pembayaran',
                    'payment_status' => 'unpaid',
                    // beri waktu unggah ulang; tanpa ini scheduler langsung membatalkan
                    'expired_at' => now()->addHours((int) Setting::get('pay_window_hours', 2)),
                ]);
                Audit::log('rental', "Menolak bukti pembayaran {$this->ref($b)}" . (!empty($v['reason']) ? " ({$v['reason']})" : ''), $b);
            }

            return $this->ok($b);
        });
    }

    /** POST /api/admin/booking/{id}/batal  { reason, dp_mode: refund|forfeit } */
    public function adminCancel(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'reason' => 'required|string|max:255',
            'dp_mode' => 'nullable|in:refund,forfeit',
        ]);

        return $this->tx(function () use ($id, $v) {
            $b = $this->lockBooking($id);
            if (!in_array($b->status, self::ACTIVE, true)) {
                throw new \DomainException("Booking berstatus {$b->status} tidak bisa dibatalkan.");
            }
            $this->cancel($b, $v['reason'], ($v['dp_mode'] ?? 'refund') === 'refund', 'admin');

            return $this->ok($b);
        });
    }

    /** POST /api/pesanan/{id}/batal  { reason } — pembatalan oleh customer, aturan H-n dihitung di server. */
    public function customerCancel(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['reason' => 'required|string|max:255']);
        $user = Auth::user();

        return $this->tx(function () use ($id, $v, $user) {
            $b = $this->lockBooking($id);
            $owns = ($b->user_id && $b->user_id === $user->id) || strtolower((string) $b->customer_email) === strtolower($user->email);
            abort_unless($owns, 404);
            if (!in_array($b->status, self::ACTIVE, true)) {
                throw new \DomainException('Booking ini sudah tidak bisa dibatalkan.');
            }
            $cancelDays = (int) Setting::get('cancel_days', 2);
            $refundable = now()->startOfDay()->diffInDays($b->start_date->copy()->startOfDay(), false) >= $cancelDays;
            $this->cancel($b, $v['reason'], $refundable, 'customer');

            return $this->ok($b);
        });
    }

    private function cancel(Booking $b, string $reason, bool $refund, string $by): void
    {
        $pendingSum = (int) $b->payments()->where('status', 'pending')->sum('amount');
        $paid = (int) $b->payments()->where('status', 'verified')->sum('amount');
        $hasDp = $paid > 0 || in_array($b->payment_status, ['dp_verifying', 'dp_paid', 'lunas'], true);

        $b->payments()->where('status', 'pending')->update(['status' => 'rejected', 'notes' => 'Booking dibatalkan']);
        $b->update(array_merge([
            'status' => 'dibatalkan',
            'cancel_at' => now(),
            'cancel_reason' => $reason,
            'cancel_auto' => false,
            'expired_at' => null,
        ], $hasDp ? ['payment_status' => $refund ? 'refund_pending' : 'forfeited'] : []));

        if ($hasDp) {
            Refund::updateOrCreate(['booking_id' => $b->id], [
                'amount' => $paid + $pendingSum,
                'reason' => $reason,
                'status' => $refund ? 'menunggu' : 'hangus',
            ]);
        }

        Audit::log('rental', ($by === 'admin' ? 'Membatalkan' : 'Customer membatalkan') . " booking {$this->ref($b)}: {$reason}"
            . ($hasDp ? ($refund ? ' (DP dikembalikan)' : ' (DP hangus)') : ''), $b);
    }

    private function lockBooking(string $id): Booking
    {
        $found = Booking::findByRef($id);
        abort_unless($found, 404, 'Booking tidak ditemukan.');

        return Booking::whereKey($found->id)->lockForUpdate()->first();
    }

    private function ref(Booking $b): string
    {
        return $b->nota_no ?: $b->booking_code;
    }

    private function ok(Booking $b): JsonResponse
    {
        $b = $b->fresh(OrderPresenter::BOOKING_WITH);

        return response()->json(['ok' => true, 'data' => OrderPresenter::booking($b)]);
    }

    /** Jalankan dalam transaksi; DomainException = ditolak (rollback) dengan pesan untuk pengguna. */
    private function tx(\Closure $work): JsonResponse
    {
        try {
            return DB::transaction($work);
        } catch (\DomainException $e) {
            return response()->json(['ok' => false, 'msg' => $e->getMessage()], 422);
        }
    }
}
