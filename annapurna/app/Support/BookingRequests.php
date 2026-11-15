<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\BookingChange;
use App\Models\BookingExtension;
use App\Models\BookingItem;
use App\Models\Finance;
use App\Models\Package;
use App\Models\Payment;
use App\Models\Product;
use Illuminate\Support\Facades\Auth;

/**
 * Permintaan perpanjangan sewa & ganti barang:
 * hitung biaya (selalu oleh server), setujui, tolak.
 * Dipakai customer (mengajukan), admin (setujui/tolak), dan admin di toko (catat langsung).
 */
class BookingRequests
{
    /** Status booking yang masih boleh diperpanjang / diganti barangnya. */
    public const OPEN = ['menunggu_konfirmasi', 'dikonfirmasi', 'disewa'];

    /**
     * Tarif per unit untuk satu baris booking.
     * Barang paket disimpan sebagai beberapa baris komponen ("Paket 2P (Tenda …)"); harga paket ada di baris
     * pertama, baris lain bernilai 0 → baris lain tidak ikut dihitung supaya tidak dobel.
     *
     * @return array{0: array, 1: int}|null  [tarif, jumlah unit]
     */
    private static function lineTiers(BookingItem $it): ?array
    {
        if ((int) $it->subtotal === 0 && (int) $it->price_per_day === 0) {
            return null;                                   // komponen paket (bukan baris harga)
        }
        if (preg_match('/^(.+) \(.+\)$/', (string) $it->product_name, $m)) {
            $pkg = Package::where('name', $m[1])->with('items')->first();
            if ($pkg) {
                $per = (int) ($pkg->items->firstWhere('product_id', $it->product_id)?->qty ?: 1);

                return [RentalPricing::packageTiers($pkg), max(1, intdiv((int) $it->qty, $per))];
            }
        }

        return [RentalPricing::productTiers(Product::find($it->product_id)), (int) $it->qty];
    }

    /** Biaya perpanjangan sampai $to. ['ok', 'msg', 'days', 'cost'] */
    public static function extensionQuote(Booking $b, string $to): array
    {
        if (! in_array($b->status, self::OPEN, true)) {
            return ['ok' => false, 'msg' => 'Booking ini sudah tidak bisa diperpanjang.'];
        }
        $end = $b->end_date->toDateString();
        if ($to <= $end) {
            return ['ok' => false, 'msg' => 'Tanggal kembali baru harus setelah ' . $b->end_date->format('d/m/Y') . '.'];
        }
        $start = $b->start_date->toDateString();
        $oldN = RentalPricing::nights($start, $end);
        $newN = RentalPricing::nights($start, $to);
        $cost = 0;
        foreach ($b->items as $it) {
            if ($t = self::lineTiers($it)) {
                $cost += (RentalPricing::lineTotal($t[0], $newN) - RentalPricing::lineTotal($t[0], $oldN)) * $t[1];
            }
        }

        return ['ok' => true, 'days' => $newN - $oldN, 'cost' => max(0, $cost)];
    }

    /** Selisih harga ganti $qty unit barang $fromId → $toId selama masa sewa. */
    public static function changeDiff(Booking $b, Product $from, Product $to, int $qty): int
    {
        $n = RentalPricing::nights($b->start_date->toDateString(), $b->end_date->toDateString());

        return (RentalPricing::lineTotal(RentalPricing::productTiers($to), $n) - RentalPricing::lineTotal(RentalPricing::productTiers($from), $n)) * $qty;
    }

    public static function approveExtension(BookingExtension $ext, bool $isPaid): void
    {
        $booking = $ext->booking;
        $ext->update(['status' => 'disetujui', 'action_by' => Auth::id(), 'action_at' => now()]);
        $booking->end_date = $ext->to_date;
        $booking->days += $ext->days;
        $booking->total_amount += $ext->cost;
        $booking->save();

        if ($isPaid && $ext->cost > 0) {
            $booking->payments()->create(Payment::receivedInStore($ext->cost, 'Perpanjangan', 'Tunai', Auth::id(), 'Pembayaran perpanjangan sewa ' . $ext->days . ' hari'));
            Finance::create([
                'finance_code' => Finance::generateCode('income'),
                'ref' => $booking->nota_no,
                'type' => 'income',
                'category' => 'Perpanjangan Sewa',
                'line' => 'rent',
                'amount' => $ext->cost,
                'transaction_date' => now()->toDateString(),
                'description' => "Perpanjangan {$booking->nota_no} +{$ext->days} hari ({$booking->customer_name})",
                'status' => 'aktif',
                'created_by' => Auth::id(),
            ]);
        }
        Audit::log('perpanjangan', "Menyetujui perpanjangan booking #{$booking->booking_code} sampai {$ext->to_date->format('Y-m-d')} (+{$ext->days} hari)", $booking);
    }

    public static function rejectExtension(BookingExtension $ext, ?string $reason): void
    {
        $ext->update(['status' => 'ditolak', 'action_by' => Auth::id(), 'action_at' => now()] + ($reason ? ['reason' => trim(($ext->reason ? $ext->reason . ' · ' : '') . 'Ditolak: ' . $reason)] : []));
        Audit::log('perpanjangan', "Menolak perpanjangan booking #{$ext->booking->booking_code}" . ($reason ? ": {$reason}" : ''), $ext->booking);
    }

    public static function approveChange(BookingChange $change, ?string $note): void
    {
        $booking = $change->booking;
        $change->update(['status' => 'disetujui', 'admin_note' => $note, 'action_by' => Auth::id(), 'action_at' => now()]);

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
        if ($change->price_diff != 0) {
            $booking->total_amount = max(0, $booking->total_amount + $change->price_diff);
            $booking->save();
        }
        Audit::log('pergantian', "Menyetujui ganti barang pada booking #{$booking->booking_code}: {$change->from_product_name} -> {$change->to_product_name}", $booking);
    }

    public static function rejectChange(BookingChange $change, ?string $note): void
    {
        $change->update(['status' => 'ditolak', 'admin_note' => $note, 'action_by' => Auth::id(), 'action_at' => now()]);
        Audit::log('pergantian', "Menolak ganti barang pada booking #{$change->booking->booking_code}" . ($note ? ": {$note}" : ''), $change->booking);
    }
}
