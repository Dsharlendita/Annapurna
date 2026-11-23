<?php

namespace App\Support;

use App\Models\Product;
use App\Models\Sale;

/**
 * Stok barang jual untuk pesanan ONLINE.
 * Stok sudah dikurangi server saat customer memesan (ApiController::storeSale), jadi saat pesanan dibatalkan
 * (oleh admin, customer, atau otomatis karena tidak dibayar) stoknya dikembalikan di sini, termasuk stok per ukuran.
 * Penjualan kasir (channel offline) diurus tampilan kasir lewat sinkronisasi barang, jadi tidak disentuh.
 */
class SaleStock
{
    public static function restore(Sale $sale): void
    {
        if ($sale->channel !== 'online') {
            return;
        }
        foreach ($sale->items()->get(['product_id', 'qty', 'size']) as $it) {
            $p = Product::whereKey($it->product_id)->lockForUpdate()->first();
            if (! $p) {
                continue;
            }
            $qty = (int) $it->qty;
            $vd = $p->variant_data;
            if ($it->size && is_array($vd) && ! empty($vd['options'])) {
                foreach ($vd['options'] as $i => $o) {
                    if (($o['name'] ?? null) === $it->size) {
                        $vd['options'][$i]['stock'] = (int) ($o['stock'] ?? 0) + $qty;
                        $p->variant_data = $vd;
                        break;
                    }
                }
            }
            $p->stock = (int) $p->stock + $qty;
            $p->save();
        }
    }
}
