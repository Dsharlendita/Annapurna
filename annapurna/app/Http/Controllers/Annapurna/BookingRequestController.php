<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingChange;
use App\Models\BookingExtension;
use App\Models\Finance;
use App\Models\Payment;
use App\Models\Product;
use App\Support\BookingRequests;
use App\Support\OrderPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Perpanjangan sewa & ganti barang.
 *
 *   Customer (menunggu persetujuan admin):
 *     POST /api/pesanan/{id}/perpanjang  { to_date, reason? }
 *     POST /api/pesanan/{id}/ganti       { from_id, to_id, to_size?, qty, reason? }
 *   Admin mencatat langsung di toko (langsung disetujui):
 *     POST /api/admin/booking/{id}/perpanjang  { to_date, is_paid? }
 *     POST /api/admin/booking/{id}/ganti       { from_id, to_id, to_size?, qty, note?, paid_now? }
 *
 * Biaya perpanjangan & selisih harga selalu dihitung server, angka dari browser diabaikan.
 * Jawaban: { ok, msg, data: booking (bentuk tampilan) }.
 */
class BookingRequestController extends Controller
{
    private function fail(string $msg, int $status = 422): JsonResponse
    {
        return response()->json(['ok' => false, 'msg' => $msg], $status);
    }

    private function done(Booking $b, string $msg): JsonResponse
    {
        return response()->json(['ok' => true, 'msg' => $msg, 'data' => OrderPresenter::booking($b->fresh(OrderPresenter::BOOKING_WITH))]);
    }

    /** Booking yang dikunci untuk diubah; customer hanya booking miliknya. */
    private function lock(string $id, bool $mustOwn): Booking
    {
        $found = Booking::findByRef($id);
        abort_unless($found, 404, 'Booking tidak ditemukan.');
        $b = Booking::with('items')->whereKey($found->id)->lockForUpdate()->firstOrFail();
        if ($mustOwn) {
            $u = Auth::user();
            $owns = ($b->user_id && $b->user_id === $u->id) || strcasecmp((string) $b->customer_email, $u->email) === 0;
            abort_unless($owns, 404, 'Booking tidak ditemukan.');
        }

        return $b;
    }

    // ------------------------------------------------------------------ Perpanjangan

    private function extend(Request $request, string $id, bool $byStore): JsonResponse
    {
        $v = $request->validate([
            'to_date' => 'required|date_format:Y-m-d',
            'reason' => 'nullable|string|max:255',
            'is_paid' => 'nullable|boolean',
        ], ['to_date.required' => 'Pilih tanggal kembali baru.']);

        return DB::transaction(function () use ($request, $v, $id, $byStore) {
            $b = $this->lock($id, ! $byStore);
            if (! $byStore && $b->extensions()->where('status', 'menunggu')->exists()) {
                return $this->fail('Masih ada permintaan perpanjangan yang menunggu persetujuan admin.');
            }
            $q = BookingRequests::extensionQuote($b, $v['to_date']);
            if (! $q['ok']) {
                return $this->fail($q['msg']);
            }
            $ext = BookingExtension::create([
                'booking_id' => $b->id,
                'from_date' => $b->end_date->toDateString(),
                'to_date' => $v['to_date'],
                'days' => $q['days'],
                'cost' => $q['cost'],
                'reason' => $v['reason'] ?? null,
                'source' => $byStore ? 'toko' : 'customer',
                'status' => 'menunggu',
            ]);
            if ($byStore) {
                BookingRequests::approveExtension($ext->setRelation('booking', $b), $request->boolean('is_paid'));

                return $this->done($b, 'Perpanjangan disimpan.');
            }

            return $this->done($b, 'Permintaan perpanjangan terkirim ke admin.');
        });
    }

    public function customerExtend(Request $request, string $id): JsonResponse
    {
        return $this->extend($request, $id, false);
    }

    public function storeExtend(Request $request, string $id): JsonResponse
    {
        return $this->extend($request, $id, true);
    }

    // ------------------------------------------------------------------ Ganti barang

    private function change(Request $request, string $id, bool $byStore): JsonResponse
    {
        $v = $request->validate([
            'from_id' => 'required|string|max:50',
            'to_id' => 'required|string|max:50|different:from_id',
            'to_size' => 'nullable|string|max:50',
            'qty' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:255',
            'note' => 'nullable|string|max:255',
            'paid_now' => 'nullable|boolean',
        ], ['to_id.different' => 'Pilih barang pengganti yang berbeda.']);

        return DB::transaction(function () use ($request, $v, $id, $byStore) {
            $b = $this->lock($id, ! $byStore);
            if (! in_array($b->status, BookingRequests::OPEN, true)) {
                return $this->fail('Barang pada booking ini sudah tidak bisa diganti.');
            }
            $item = $b->items->firstWhere('product_id', $v['from_id']);
            $from = Product::find($v['from_id']);
            $to = Product::where('id', $v['to_id'])->where('is_active', true)->where('rent_price', '>', 0)->first();
            if (! $item || ! $from) {
                return $this->fail('Barang yang ingin diganti tidak ada di booking ini.');
            }
            if (! $to) {
                return $this->fail('Barang pengganti tidak tersedia untuk disewa.');
            }
            if ($v['qty'] > (int) $item->qty) {
                return $this->fail("Jumlah maksimal yang bisa diganti {$item->qty} unit.");
            }
            if (! $byStore && $b->changes()->where('status', 'menunggu')->where('from_product_id', $from->id)->exists()) {
                return $this->fail('Barang ini masih punya permintaan ganti yang menunggu persetujuan admin.');
            }
            $diff = BookingRequests::changeDiff($b, $from, $to, (int) $v['qty']);
            $change = BookingChange::create([
                'booking_id' => $b->id,
                'from_product_id' => $from->id,
                'from_product_name' => $item->product_name,
                'to_product_id' => $to->id,
                'to_product_name' => $to->name . (! empty($v['to_size']) ? " ({$v['to_size']})" : ''),
                'to_size' => $v['to_size'] ?? null,
                'qty' => (int) $v['qty'],
                'price_diff' => $diff,
                'reason' => $v['reason'] ?? null,
                'source' => $byStore ? 'toko' : 'customer',
                'status' => 'menunggu',
            ]);
            if ($byStore) {
                BookingRequests::approveChange($change->setRelation('booking', $b), $v['note'] ?? null);
                if ($request->boolean('paid_now') && $diff > 0) {
                    $b->payments()->create(Payment::receivedInStore($diff, 'Pelunasan', 'Tunai', Auth::id(), 'Selisih ganti barang'));
                    // Uang yang diterima wajib masuk buku kas
                    Finance::create([
                        'finance_code' => Finance::generateCode('income'),
                        'ref' => $b->nota_no,
                        'type' => 'income',
                        'category' => 'Selisih Ganti Barang',
                        'line' => 'rent',
                        'amount' => $diff,
                        'transaction_date' => now()->toDateString(),
                        'description' => "Selisih ganti barang {$b->nota_no} ({$b->customer_name})",
                        'status' => 'aktif',
                        'created_by' => Auth::id(),
                    ]);
                }

                return $this->done($b, 'Ganti barang disimpan.');
            }

            return $this->done($b, 'Permintaan ganti barang terkirim ke admin.');
        });
    }

    public function customerChange(Request $request, string $id): JsonResponse
    {
        return $this->change($request, $id, false);
    }

    public function storeChange(Request $request, string $id): JsonResponse
    {
        return $this->change($request, $id, true);
    }
}
