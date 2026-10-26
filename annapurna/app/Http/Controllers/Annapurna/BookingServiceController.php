<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingService;
use App\Models\Finance;
use App\Models\ServicePayment;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BookingServiceController extends Controller
{
    /**
     * POST /api/admin/booking/{bookingId}/service
     * Menambahkan atau memperbarui layanan tambahan (antar/jemput/pasang tenda) pada booking sewa.
     */
    public function store(Request $request, string $bookingId): JsonResponse
    {
        $booking = is_numeric($bookingId)
            ? Booking::findOrFail($bookingId)
            : Booking::where('booking_code', $bookingId)->orWhere('nota_no', $bookingId)->firstOrFail();

        $validated = $request->validate([
            'service_mode' => 'required|string|in:ambil,antar,jemput,bongkar_pasang,pasang,bongkar',
            'tents_count' => 'nullable|integer|min:0',
            'address' => 'nullable|string',
            'scheduled_date' => 'nullable|date',
            'scheduled_time' => 'nullable|string',
            'back_date' => 'nullable|date',
            'back_time' => 'nullable|string',
            'fee' => 'nullable|integer|min:0',
            'ongkir' => 'nullable|integer|min:0',
            'pay_now' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated, $booking, $request) {
            $user = Auth::user();
            $fee = (int) ($validated['fee'] ?? 0);
            $ongkir = (int) ($validated['ongkir'] ?? 0);
            $totalService = $fee + $ongkir;
            $payNow = (int) ($validated['pay_now'] ?? 0);

            $service = BookingService::updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'service_mode' => $validated['service_mode'],
                    'tents_count' => $validated['tents_count'] ?? 0,
                    'address' => $validated['address'] ?? null,
                    'scheduled_date' => $validated['scheduled_date'] ?? $booking->start_date,
                    'scheduled_time' => $validated['scheduled_time'] ?? null,
                    'back_date' => $validated['back_date'] ?? $booking->end_date,
                    'back_time' => $validated['back_time'] ?? null,
                    'fee' => $fee,
                    'ongkir' => $ongkir,
                    'total_service' => $totalService,
                    'status' => 'dijadwalkan',
                    'notes' => $validated['notes'] ?? null,
                ]
            );

            // Perbarui juga delivery_mode di booking
            $booking->update([
                'delivery_mode' => $validated['service_mode'],
                'customer_address' => $validated['address'] ?? $booking->customer_address,
            ]);

            // Jika ada pembayaran biaya jasa / ongkir
            if ($payNow > 0) {
                $service->payments()->create([
                    'amount' => $payNow,
                    'payment_method' => $validated['payment_method'] ?? 'Tunai',
                    'paid_at' => now(),
                    'received_by' => $user?->id,
                    'notes' => "Pembayaran layanan {$validated['service_mode']}",
                ]);

                // Biaya jasa tenda & ongkir sewa masuk ke keuangan lini Rental
                Finance::create([
                    'finance_code' => Finance::generateCode('income'),
                    'ref' => $booking->nota_no,
                    'type' => 'income',
                    'category' => 'Jasa Layanan',
                    'line' => 'rent',
                    'amount' => $payNow,
                    'transaction_date' => now()->toDateString(),
                    'description' => "Pemasukan layanan {$validated['service_mode']} ({$booking->nota_no})",
                    'status' => 'aktif',
                    'created_by' => $user?->id,
                ]);
            }

            Audit::log('rental', "Layanan {$validated['service_mode']} ditambahkan pada booking {$booking->nota_no} · Total Rp " . number_format($totalService, 0, ',', '.'), $booking);

            return response()->json([
                'ok' => true,
                'msg' => 'Layanan tambahan berhasil disimpan.',
                'service' => $service->load('payments'),
            ]);
        });
    }

    /**
     * POST /api/admin/service/{serviceId}/bayar
     * Mencatat pembayaran pelunasan jasa tenda / ongkir.
     */
    public function addPayment(Request $request, int $serviceId): JsonResponse
    {
        $service = BookingService::with('booking')->findOrFail($serviceId);

        $validated = $request->validate([
            'amount' => 'required|integer|min:1',
            'payment_method' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $user = Auth::user();
        $amount = (int) $validated['amount'];

        $payment = $service->payments()->create([
            'amount' => $amount,
            'payment_method' => $validated['payment_method'],
            'paid_at' => now(),
            'received_by' => $user?->id,
            'notes' => $validated['notes'] ?? 'Pelunasan biaya layanan',
        ]);

        // Catat ke keuangan lini rental
        Finance::create([
            'finance_code' => Finance::generateCode('income'),
            'ref' => $service->booking->nota_no,
            'type' => 'income',
            'category' => 'Jasa Layanan',
            'line' => 'rent',
            'amount' => $amount,
            'transaction_date' => now()->toDateString(),
            'description' => "Pelunasan layanan {$service->service_mode} ({$service->booking->nota_no})",
            'status' => 'aktif',
            'created_by' => $user?->id,
        ]);

        Audit::log('rental', "Pelunasan biaya layanan {$service->service_mode} ({$service->booking->nota_no}): Rp " . number_format($amount, 0, ',', '.'), $service->booking);

        return response()->json([
            'ok' => true,
            'msg' => 'Pembayaran layanan berhasil dicatat.',
            'payment' => $payment,
        ]);
    }
}
