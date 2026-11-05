<?php

namespace App\Services;

use App\Models\Finance;
use App\Models\Payment;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

/**
 * Verifikasi pembayaran (DP / pelunasan / penjualan) + pencatatan pemasukan kas.
 * Dipakai oleh FinanceController::verifyPayment dan OrderController::verifyBooking.
 * Pemanggil wajib membungkus dalam DB::transaction.
 */
class PaymentService
{
    public static function verify(Payment $payment): Finance
    {
        // Kunci baris & cek ulang status di dalam transaksi: klik ganda / dua admin tidak mencatat pemasukan dobel
        $payment = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
        if ($payment->status !== 'pending') {
            throw new \DomainException($payment->status === 'verified'
                ? 'Pembayaran ini sudah diverifikasi sebelumnya.'
                : 'Pembayaran ini sudah ditolak, tidak bisa diverifikasi.');
        }
        $payment->load(['booking', 'sale']);
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

            // Jangan memundurkan status booking yang sudah disewa/selesai/dibatalkan
            if ($payment->payment_type === 'DP' && in_array($booking->status, ['menunggu_pembayaran', 'menunggu_konfirmasi'], true)) {
                $booking->update([
                    'status' => 'dikonfirmasi',
                    'payment_status' => 'dp_paid',
                    'expired_at' => null,
                ]);
            } elseif ($payment->payment_type === 'Pelunasan') {
                $booking->update(['payment_status' => 'lunas']);
            }
        } elseif ($payment->sale) {
            $sale = $payment->sale;
            $line = 'sale';
            $ref = $sale->nota_no ?: $sale->sale_code;

            $sale->update(array_merge(
                ['payment_status' => 'paid', 'expired_at' => null],
                in_array($sale->status, ['menunggu_pembayaran', 'diproses'], true) ? ['status' => 'diproses'] : []
            ));
        }

        $finance = Finance::create([
            'finance_code' => Finance::generateCode('income'),
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

        return $finance;
    }
}
