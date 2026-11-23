<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingService;
use App\Models\Finance;
use App\Models\Payment;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BookingServiceController extends Controller
{
    /**
     * Peta mode layanan → leg jadwal yang dihasilkan.
     * `out`  : leg antar (barang / tenda diantar ke lokasi)
     * `back` : leg jemput (barang dijemput / tenda dibongkar lalu dijemput)
     * Nama mode mengikuti frontend (Svc.SPEC di data.js).
     */
    private const MODES = [
        'antar'        => ['out' => 'Antar',          'back' => null,                'tent' => false],
        'jemput'       => ['out' => null,             'back' => 'Jemput',            'tent' => false],
        'pasang'       => ['out' => 'Antar & pasang', 'back' => 'Bongkar & jemput',  'tent' => true],  // bongkar pasang lengkap
        'pasang_saja'  => ['out' => 'Antar & pasang', 'back' => null,                'tent' => true],
        'bongkar_saja' => ['out' => null,             'back' => 'Bongkar & jemput',  'tent' => true],
    ];

    /** Nama lain di skema backend → nama mode frontend. */
    private const ALIAS = ['bongkar_pasang' => 'pasang', 'bongkar' => 'bongkar_saja'];

    /**
     * GET /api/admin/layanan?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Jadwal antar / jemput / bongkar pasang untuk dashboard admin, satu baris per "leg" jadwal.
     * Rentang tanggal dikirim frontend (zona waktu pengguna); bila kosong: hari ini s.d. 7 hari ke depan.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);

        $from = $request->query('from') ?: now()->toDateString();
        $to = $request->query('to') ?: now()->addDays(7)->toDateString();

        $services = BookingService::with(['booking.items', 'payments'])
            ->whereNotIn('status', ['selesai', 'dibatalkan'])
            ->whereHas('booking', fn ($q) => $q->visibleToStaff()->whereNotIn('status', ['selesai', 'dibatalkan']))
            ->get();

        $legs = [];
        foreach ($services as $s) {
            $mode = self::ALIAS[$s->service_mode] ?? $s->service_mode;
            $spec = self::MODES[$mode] ?? null;
            $b = $s->booking;
            if (! $spec || ! $b) {
                continue; // 'ambil' = tanpa layanan
            }

            $total = (int) $s->total_service;
            $paid = (int) $s->payments->sum('amount');
            $common = [
                'service_id' => $s->id,
                'booking_code' => $b->booking_code,
                'nota_no' => $b->nota_no,
                'booking_status' => $b->status,
                'customer_name' => $b->customer_name,
                'customer_phone' => $b->customer_phone,
                'address' => $s->address ?: $b->customer_address,
                'mode' => $mode,
                'tent' => $spec['tent'],
                'tents' => (int) $s->tents_count,
                'items' => $b->items->map(fn ($i) => $i->qty . '× ' . $i->product_name)->implode(', '),
                'fee' => (int) $s->fee,
                'ongkir' => (int) $s->ongkir,
                'ongkir_set' => (int) $s->ongkir > 0,
                'total' => $total,
                'paid' => $paid,
                'due' => max(0, $total - $paid),
            ];

            // Leg antar: tidak ditampilkan lagi setelah barang keluar (status disewa)
            if ($spec['out'] && $b->status !== 'disewa') {
                $date = ($s->scheduled_date ?? $b->start_date)?->toDateString();
                if ($date && $date >= $from && $date <= $to) {
                    $legs[] = $common + ['type' => 'antar', 'kind' => $spec['out'], 'date' => $date, 'time' => $s->scheduled_time];
                }
            }
            if ($spec['back']) {
                $date = ($s->back_date ?? $b->end_date)?->toDateString();
                if ($date && $date >= $from && $date <= $to) {
                    $legs[] = $common + ['type' => 'jemput', 'kind' => $spec['back'], 'date' => $date, 'time' => $s->back_time];
                }
            }
        }

        usort($legs, fn ($a, $b) => strcmp($a['date'] . ($a['time'] ?? ''), $b['date'] . ($b['time'] ?? '')));

        return response()->json([
            'ok' => true,
            'data' => $legs,
            'range' => ['from' => $from, 'to' => $to],
        ]);
    }

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
            // pasang_saja & bongkar_saja = nama mode yang dikirim frontend (Svc.SPEC); sebelumnya ditolak validasi (422)
            'service_mode' => 'required|string|in:ambil,antar,jemput,bongkar_pasang,pasang,bongkar,pasang_saja,bongkar_saja',
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
            $payNow = (int) ($validated['pay_now'] ?? 0);
            $service = BookingService::where('booking_id', $booking->id)->lockForUpdate()->first();

            // Kembali ke "ambil di toko": layanan dihapus (bila belum ada pembayaran layanan)
            if ($validated['service_mode'] === 'ambil') {
                if ($service && ! $service->payments()->exists()) {
                    $service->delete();
                }
                $booking->update(['delivery_mode' => 'ambil']);

                return response()->json(['ok' => true, 'msg' => 'Layanan dihapus. Barang diambil di toko.', 'service' => null]);
            }

            // Hanya kolom yang DIKIRIM yang diubah. Dulu kolom yang tidak dikirim (jumlah tenda, jam antar / jemput)
            // ditimpa 0 / kosong setiap kali ongkir diisi.
            $attrs = ['service_mode' => $validated['service_mode']];
            foreach (['tents_count', 'address', 'scheduled_date', 'scheduled_time', 'back_date', 'back_time', 'fee', 'ongkir', 'notes'] as $k) {
                if ($request->exists($k)) {
                    $attrs[$k] = $validated[$k] ?? null;
                }
            }
            foreach (['tents_count', 'fee', 'ongkir'] as $k) {
                if (array_key_exists($k, $attrs)) {
                    $attrs[$k] = (int) ($attrs[$k] ?? 0);
                }
            }
            if (! $service) {
                $attrs += ['scheduled_date' => $booking->start_date, 'back_date' => $booking->end_date, 'status' => 'menunggu'];
            }
            // Ongkir sudah disepakati & diisi admin → layanan terjadwal (tampilan lain berhenti menampilkan "ongkir belum diinput")
            if ($request->exists('ongkir')) {
                $attrs['status'] = 'dijadwalkan';
            }
            $service = $service ? tap($service)->update($attrs) : BookingService::create($attrs + ['booking_id' => $booking->id]);
            $service->update(['total_service' => (int) $service->fee + (int) $service->ongkir]);

            // Perbarui juga delivery_mode di booking
            $booking->update([
                'delivery_mode' => $validated['service_mode'],
                'customer_address' => $validated['address'] ?? $booking->customer_address,
            ]);

            // Jika ada pembayaran biaya jasa / ongkir
            if ($payNow > 0) {
                $service->payments()->create(Payment::receivedInStore($payNow, 'Layanan', $validated['payment_method'] ?? 'Tunai', $user?->id, "Pembayaran layanan {$validated['service_mode']}"));

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

            Audit::log('rental', "Layanan {$validated['service_mode']} ditambahkan pada booking {$booking->nota_no} · Total Rp " . number_format((int) $service->total_service, 0, ',', '.'), $booking);

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

        $payment = $service->payments()->create(Payment::receivedInStore($amount, 'Layanan', $validated['payment_method'], $user?->id, $validated['notes'] ?? 'Pelunasan biaya layanan'));

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
