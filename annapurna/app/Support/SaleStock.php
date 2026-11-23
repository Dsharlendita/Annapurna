<?php

namespace App\Support;

use App\Models\Product;
use App\Models\Sale;

/**
 * Stok barang jual untuk pesanan ONLINE.
 * Stok sudah dikurangi server saat customer memesan (ApiController::storeSale), jadi saat pesanan dibatalkan
 * (oleh admin atau otomatis karena tidak dibayar) stoknya dikembalikan di sini.
 * Penjualan kasir (channel offline) diurus tampilan kasir lewat sinkronisasi barang, jadi tidak disentuh.
 */
class SaleStock
{
    public static function restore(Sale $sale): void
    {
        if ($sale->channel !== 'online') {
            return;
        }
        foreach ($sale->items()->get(['product_id', 'qty']) as $it) {
            Product::whereKey($it->product_id)->lockForUpdate()->first()?->increment('stock', (int) $it->qty);
        }
    }
}
