<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ukuran / varian barang yang dibeli. Dipakai server untuk mengurangi (dan saat batal mengembalikan) stok
 * per ukuran pesanan online; dulu hanya stok total yang berkurang sehingga stok per ukuran tidak cocok.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->string('size', 100)->nullable()->after('product_name');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('size');
        });
    }
};
