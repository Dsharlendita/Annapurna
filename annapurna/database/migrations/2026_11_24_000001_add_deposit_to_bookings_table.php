<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Uang jaminan sewa disimpan di server. Dulu hanya tercatat di browser admin yang menerimanya,
 * sehingga perangkat lain tidak tahu jaminan sudah diterima / dikembalikan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedInteger('deposit_amount')->default(0)->after('dp_amount');   // jaminan yang wajib dititipkan
            $table->json('deposit_in')->nullable()->after('deposit_amount');               // {amount, at, by} saat barang keluar
            $table->json('deposit_out')->nullable()->after('deposit_in');                  // {amount, deducted, at, by} saat kembali
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['deposit_amount', 'deposit_in', 'deposit_out']);
        });
    }
};
