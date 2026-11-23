<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Sale;
use Illuminate\Support\Facades\Storage;

/**
 * Mengubah Booking / Sale dari database menjadi bentuk objek yang dipakai frontend
 * (sama dengan bentuk data di public/assets/js/data.js), supaya halaman FE bisa
 * menampilkan data server tanpa mengubah kode tampilan.
 *
 * Field yang hanya ada di FE (riwayat, tarif berjenjang per baris, detail jadwal antar) tidak dikirim;
 * DB.mergeServer() di data.js mempertahankan nilai lokal untuk field tersebut.
 */
class OrderPresenter
{
    public const BOOKING_WITH = ['items', 'payments', 'returnLog', 'refund', 'service', 'extensions.actionUser', 'changes.actionUser'];
    public const SALE_WITH = ['items', 'payments', 'delivery'];

    private static function stamp($dt): ?string
    {
        // Selalu UTC dengan penanda "Z": tanpa penanda, browser membacanya sebagai jam lokal (WIB) sehingga waktu bergeser
        // 7 jam (pesanan baru langsung dianggap lewat batas bayar dan tampil "dibatalkan" di HP customer).
        return $dt ? $dt->copy()->utc()->format('Y-m-d\TH:i:s\Z') : null;
    }

    /** Metode pengembalian DP → { method, bank, account, holder } (null bila belum dipilih). */
    private static function refundMethod(\App\Models\Refund $r): ?array
    {
        if (!$r->method) {
            return null;
        }

        return $r->method === 'tunai'
            ? ['method' => 'tunai']
            : ['method' => 'transfer', 'bank' => $r->bank_name ?? '', 'account' => $r->account_number ?? '', 'holder' => $r->account_name ?? ''];
    }

    private static function payments($payments): array
    {
        return $payments->where('status', 'verified')->sortBy('id')->values()->map(fn (Payment $p) => [
            'srvId' => $p->id,
            'at' => self::stamp($p->verified_at ?? $p->paid_at ?? $p->created_at),
            'amount' => (int) $p->amount,
            'type' => $p->payment_type,
            'via' => $p->bank_name ?: $p->payment_method,
            'verified' => true,
        ])->all();
    }

    /** Bukti bayar yang masih menunggu verifikasi (terbaru). */
    private static function proof($payments): array
    {
        $p = $payments->where('status', 'pending')->sortByDesc('id')->first();
        if (!$p) {
            return ['proof' => null, 'proofMeta' => null];
        }

        return [
            'proof' => $p->proof_file ? Storage::disk('public')->url($p->proof_file) : null,
            'proofMeta' => [
                'srvId' => $p->id,
                'type' => $p->payment_type,
                'amount' => (int) $p->amount,
                'bank' => $p->bank_name,
                'note' => $p->notes,
                'at' => self::stamp($p->paid_at ?? $p->created_at),
            ],
        ];
    }

    public static function booking(Booking $b): array
    {
        $ret = $b->returnLog;
        $fine = (int) ($ret->total_fine ?? 0);
        $settle = (int) $b->settle_disc_amount;
        $refundStatus = match ($b->payment_status) {
            'refund_pending' => 'menunggu',
            'refunded' => 'selesai',
            'forfeited' => 'hangus',
            default => 'tidak_perlu',
        };
        $svc = $b->service;

        return array_merge([
            'id' => $b->booking_code,
            'srvId' => $b->id,
            'no' => $b->nota_no,
            'customer' => [
                'name' => $b->customer_name,
                'phone' => $b->customer_phone,
                'email' => $b->customer_email,
            ],
            'items' => $b->items->map(fn ($it) => array_filter([
                'kind' => 'product',
                'refId' => $it->product_id,
                'name' => $it->product_name,
                'img' => $it->product_img,
                'qty' => (int) $it->qty,
                'pricePerDay' => (int) $it->price_per_day,
                'lineTotal' => (int) $it->subtotal,
                'size' => $it->size,
            ], fn ($v) => $v !== null))->values()->all(),
            'start' => $b->start_date?->toDateString(),
            'end' => $b->end_date?->toDateString(),
            'days' => (int) $b->days,
            'subtotal' => (int) $b->subtotal,
            // Sama dengan Rules.recalc di FE: subtotal − diskon promo − diskon pelunasan + denda.
            // Di server, denda (ReturnController) & biaya perpanjangan/ganti sudah ditambahkan ke total_amount.
            'total' => max(0, (int) $b->total_amount - $settle),
            'dp' => (int) $b->dp_amount,
            'fine' => $fine,
            'discount' => $b->discount_amount > 0 ? ['amount' => (int) $b->discount_amount, 'reason' => $b->discount_reason] : null,
            'settleDisc' => $settle > 0 ? ['amount' => $settle, 'reason' => $b->settle_disc_reason] : null,
            'settleLater' => (bool) $b->settle_later,
            'piutang' => $b->settle_later && (int) $b->piutang_amount > 0 ? ['amount' => (int) $b->piutang_amount, 'note' => $b->piutang_note] : null,
            'status' => $b->status,
            'paymentStatus' => $b->payment_status,
            'method' => $b->payment_method,
            'channel' => $b->channel,
            'createdAt' => self::stamp($b->created_at),
            'expiredAt' => self::stamp($b->expired_at),
            'delivery' => $b->delivery_mode ?: 'ambil',
            'address' => $b->customer_address ?? '',
            'notes' => $b->notes ?? '',
            'idType' => $b->guarantee_type,
            'payments' => self::payments($b->payments),
            'refunds' => $b->refund && $b->refund->status === 'selesai'
                ? [array_filter(array_merge([
                    'at' => self::stamp($b->refund->processed_at ?? $b->refund->updated_at),
                    'amount' => (int) $b->refund->amount,
                    'ref' => $b->refund->transfer_ref,
                    'proof' => $b->refund->proof_url,
                    'waAt' => self::stamp($b->refund->notified_at),
                ], self::refundMethod($b->refund) ?? []), fn ($v) => $v !== null)]
                : [],
            'cancel' => $b->status === 'dibatalkan' ? array_filter([
                'at' => self::stamp($b->cancel_at ?? $b->updated_at),
                'reason' => $b->cancel_reason,
                'auto' => (bool) $b->cancel_auto,
                'refundable' => in_array($b->payment_status, ['refund_pending', 'refunded'], true),
                'refundStatus' => $refundStatus,
                'by' => $b->refund?->requested_by,
                // Metode pengembalian DP pilihan customer/admin (bentuk sama dengan UI.refundRead di FE)
                'refund' => $b->refund ? self::refundMethod($b->refund) : null,
            ], fn ($v) => $v !== null) : null,
            // Permintaan perpanjangan & ganti barang (bentuk sama dengan b.extensions / b.changes di FE).
            // id = id server (angka) → dipakai langsung oleh aksi setujui/tolak admin.
            'extensions' => $b->extensions->sortBy('id')->values()->map(fn ($x) => array_filter([
                'id' => (string) $x->id,
                'at' => self::stamp($x->created_at),
                'from' => $x->from_date?->toDateString(),
                'to' => $x->to_date?->toDateString(),
                'days' => (int) $x->days,
                'cost' => (int) $x->cost,
                'reason' => $x->reason,
                'status' => $x->status,
                'source' => $x->source,
                'by' => $x->actionUser?->name,
                'decidedAt' => self::stamp($x->action_at),
            ], fn ($v) => $v !== null))->all(),
            'changes' => $b->changes->sortBy('id')->values()->map(fn ($c) => array_filter([
                'id' => (string) $c->id,
                'at' => self::stamp($c->created_at),
                'lineIndex' => ($i = $b->items->search(fn ($it) => $it->product_id === ($c->status === 'disetujui' ? $c->to_product_id : $c->from_product_id))) === false ? null : $i,
                'fromId' => $c->from_product_id,
                'fromName' => $c->from_product_name,
                'toId' => $c->to_product_id,
                'toName' => $c->to_product_name,
                'toSize' => $c->to_size,
                'qty' => (int) $c->qty,
                'diff' => (int) $c->price_diff,
                'reason' => $c->reason,
                'note' => $c->admin_note,
                'status' => $c->status,
                'source' => $c->source,
                'by' => $c->actionUser?->name,
                'decidedAt' => self::stamp($c->action_at),
            ], fn ($v) => $v !== null))->all(),
            'ret' => $ret ? [
                'at' => self::stamp($ret->return_date),
                'cond' => $ret->condition,
                'lateDays' => (int) $ret->late_days,
                'damageFee' => (int) $ret->damage_fee,
                'fine' => (int) $ret->total_fine,
                'note' => $ret->notes ?? '',
            ] : null,
            'deliv' => $svc ? array_filter([
                'address' => $svc->address,
                'date' => $svc->scheduled_date?->toDateString(),
                'time' => $svc->scheduled_time,
                'backDate' => $svc->back_date?->toDateString(),
                'backTime' => $svc->back_time,
                'tents' => $svc->tents_count ?: null,
                // Ongkir & jasa yang sudah diisi admin (status "menunggu" = ongkir belum disepakati)
                'ongkir' => $svc->status !== 'menunggu' ? (int) $svc->ongkir : null,
                'jasa' => $svc->status !== 'menunggu' && (int) $svc->fee > 0 ? (int) $svc->fee : null,
            ], fn ($v) => $v !== null && $v !== '') : null,
        ], $svc ? ['svc' => self::servicePayments($svc)] : [],
            // Uang jaminan (hanya bila ada, supaya data lama di browser tidak tertimpa nol)
            (int) $b->deposit_amount > 0 ? ['deposit' => (int) $b->deposit_amount] : [],
            $b->deposit_in ? ['depositIn' => $b->deposit_in] : [],
            $b->deposit_out ? ['depositOut' => $b->deposit_out] : [],
            self::proof($b->payments));
    }

    /**
     * Pembayaran layanan (jasa tenda + ongkir) untuk tampilan: dibagi seperti di kasir, jasa tenda dulu lalu ongkir.
     * Dulu tidak dikirim, sehingga perangkat lain tidak tahu layanan sudah dibayar.
     */
    private static function servicePayments(\App\Models\BookingService $svc): array
    {
        $jasaLeft = (int) $svc->fee;
        $out = [];
        foreach ($svc->payments()->where('status', 'verified')->orderBy('id')->get() as $p) {
            $amt = (int) $p->amount;
            $toJasa = min($amt, $jasaLeft);
            $jasaLeft -= $toJasa;
            $at = $p->paid_at?->copy()->utc()->format('Y-m-d\TH:i:s\Z');
            $via = $p->payment_method ?: 'Tunai';
            if ($toJasa > 0) {
                $out[] = ['id' => 'SVP' . $p->id . 'P', 'kind' => 'pasang', 'amount' => $toJasa, 'at' => $at, 'via' => $via];
            }
            if ($amt - $toJasa > 0) {
                $out[] = ['id' => 'SVP' . $p->id . 'O', 'kind' => 'ongkir', 'amount' => $amt - $toJasa, 'at' => $at, 'via' => $via];
            }
        }

        return $out;
    }

    public static function sale(Sale $s): array
    {
        $d = $s->delivery;

        return array_merge([
            'id' => $s->sale_code,
            'srvId' => $s->id,
            'no' => $s->nota_no,
            'customer' => [
                'name' => $s->customer_name ?? 'Pelanggan Umum',
                'phone' => $s->customer_phone ?? '',
                'email' => $s->customer_email ?? '',
            ],
            'items' => $s->items->map(fn ($it) => array_filter([
                'productId' => $it->product_id,
                'name' => $it->product_name,
                'img' => $it->product_img,
                'qty' => (int) $it->qty,
                'price' => (int) $it->unit_price,
                'cost' => $it->unit_cost !== null ? (int) $it->unit_cost : null,
                'size' => $it->size ?? null,
            ], fn ($v) => $v !== null))->values()->all(),
            'subtotal' => (int) $s->subtotal,
            'total' => (int) $s->total_amount,
            'discount' => $s->discount_amount > 0 ? ['amount' => (int) $s->discount_amount, 'reason' => $s->discount_reason] : null,
            'status' => $s->status,
            'paymentStatus' => $s->payment_status,
            'method' => $s->payment_method,
            'channel' => $s->channel,
            'createdAt' => self::stamp($s->created_at),
            'expiredAt' => self::stamp($s->expired_at),
            'delivery' => $s->delivery_mode ?: 'ambil',
            'deliv' => $d ? array_filter([
                'address' => $d->address,
                'method' => $d->method,
                'expedition' => $d->expedition,
                'resi' => $d->tracking_no,
                'courier' => $d->courier_name,
                'ongkir' => $d->ongkir ? (int) $d->ongkir : null,
                'shipStatus' => $d->ship_status,
                'shipDate' => $d->ship_date ? substr((string) $d->ship_date, 0, 10) : null,
            ], fn ($v) => $v !== null && $v !== '') : null,
            'notes' => $s->notes ?? '',
            'payments' => self::payments($s->payments),
        ], self::proof($s->payments));
    }
}
