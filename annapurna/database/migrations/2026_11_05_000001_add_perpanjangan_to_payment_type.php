<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jenis pembayaran "Perpanjangan" (biaya perpanjangan sewa yang dibayar saat disetujui).
 * Sebelumnya PermintaanController menyimpan 'Perpanjangan' padahal kolom hanya menerima
 * DP / Pelunasan / Denda / Penjualan → MySQL menolak dan perpanjangan berbayar tidak pernah tersimpan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->enum('payment_type', ['DP', 'Pelunasan', 'Denda', 'Penjualan', 'Perpanjangan'])->change();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->enum('payment_type', ['DP', 'Pelunasan', 'Denda', 'Penjualan'])->change();
        });
    }
};
