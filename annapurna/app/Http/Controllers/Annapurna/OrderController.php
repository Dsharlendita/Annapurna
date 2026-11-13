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

    /**
     * POST /api/admin/booking/{id}/batal
     * { reason, dp_mode: refund|forfeit, refund_method?, refund_bank?, refund_account_number?, refund_account_name? }
     * Metode pengembalian boleh dikosongkan admin dan dilengkapi saat Proses refund.
     */
    public function adminCancel(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(array_merge([
            'reason' => 'required|string|max:255',
            'dp_mode' => 'nullable|in:refund,forfeit,none',
        ], self::refundRules()), self::refundMessages());

        return $this->tx(function () use ($id, $v) {
            $b = $this->lockBooking($id);
            if (!in_array($b->status, self::ACTIVE, true)) {
                throw new \DomainException("Booking berstatus {$b->status} tidak bisa dibatalkan.");
            }
            $this->cancel($b, $v['reason'], ($v['dp_mode'] ?? 'refund') !== 'forfeit', 'admin', $v);

            return $this->ok($b);
        });
    }

    /**
     * POST /api/pesanan/{id}/batal — pembatalan oleh customer, aturan H-n dihitung di server.
     * { reason, refund_method (wajib bila DP dikembalikan): transfer|tunai, refund_bank, refund_account_number, refund_account_name }
     */
    public function customerCancel(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(array_merge(['reason' => 'required|string|max:255'], self::refundRules()), self::refundMessages());
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
            if ($refundable && $this->hasDp($b) && empty($v['refund_method'])) {
                throw new \DomainException('Pilih metode pengembalian DP: transfer atau tunai.');
            }
            $this->cancel($b, $v['reason'], $refundable, 'customer', $v);

            return $this->ok($b);
        });
    }

    private function hasDp(Booking $b): bool
    {
        return $b->payments()->whereIn('status', ['verified', 'pending'])->exists()
            || in_array($b->payment_status, ['dp_verifying', 'dp_paid', 'lunas'], true);
    }

    private function cancel(Booking $b, string $reason, bool $refund, string $by, array $v = []): void
    {
        // Hak refund = uang masuk (terverifikasi + bukti yang belum sempat dicek) × persen refund
        $received = (int) $b->payments()->whereIn('status', ['verified', 'pending'])->sum('amount');
        $pct = max(0, min(100, (int) Setting::get('refund_percent', 100)));
        $hasDp = $this->hasDp($b);

        $b->payments()->where('status', 'pending')->update(['status' => 'rejected', 'notes' => 'Booking dibatalkan']);
        $b->update(array_merge([
            'status' => 'dibatalkan',
            'cancel_at' => now(),
            'cancel_reason' => $reason,
            'cancel_auto' => false,
            'expired_at' => null,
        ], $hasDp ? ['payment_status' => $refund ? 'refund_pending' : 'forfeited'] : []));

        if ($hasDp) {
            $method = $refund ? ($v['refund_method'] ?? null) : null;
            $tf = $method === 'transfer';
            Refund::updateOrCreate(['booking_id' => $b->id], [
                'amount' => $refund ? (int) round($received * $pct / 100) : $received,
                'method' => $method,
                'bank_name' => $tf ? $v['refund_bank'] : null,
                'account_number' => $tf ? $v['refund_account_number'] : null,
                'account_name' => $tf ? $v['refund_account_name'] : null,
                'bank_account' => $tf ? Refund::accountSummary($v['refund_bank'], $v['refund_account_number'], $v['refund_account_name']) : null,
                'reason' => $reason,
                'status' => $refund ? 'menunggu' : 'hangus',
                'requested_by' => $by,
            ]);
        }

        $how = $hasDp ? ($refund ? ' (DP dikembalikan' . (!empty($v['refund_method']) ? ", {$v['refund_method']}" : '') . ')' : ' (DP hangus)') : '';
        Audit::log('rental', ($by === 'admin' ? 'Membatalkan' : 'Customer membatalkan') . " booking {$this->ref($b)}: {$reason}{$how}", $b);
    }

    /** Isian metode pengembalian DP (sama dengan form FE UI.refundFields). */
    private static function refundRules(): array
    {
        return [
            'refund_method' => 'nullable|in:transfer,tunai',
            'refund_bank' => 'nullable|required_if:refund_method,transfer|string|max:60',
            'refund_account_number' => ['nullable', 'required_if:refund_method,transfer', 'regex:/^\d{6,30}$/'],
            'refund_account_name' => 'nullable|required_if:refund_method,transfer|string|max:100',
        ];
    }

    private static function refundMessages(): array
    {
        return [
            'reason.required' => 'Tulis alasan pembatalan.',
            'refund_bank.required_if' => 'Isi nama bank / e-wallet tujuan.',
            'refund_account_number.required_if' => 'Isi nomor rekening / HP e-wallet.',
            'refund_account_number.regex' => 'Nomor rekening / HP e-wallet harus 6–30 digit angka.',
            'refund_account_name.required_if' => 'Isi nama pemilik rekening.',
        ];
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
