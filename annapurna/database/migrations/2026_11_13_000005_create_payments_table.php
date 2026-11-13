<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 06 · PEMBAYARAN
 * Satu tabel untuk semua uang masuk dari customer. Setiap baris milik tepat
 * satu transaksi: booking sewa, penjualan, pesanan laundry, atau layanan antar/pasang.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            // Pemilik pembayaran: isi salah satu
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->cascadeOnDelete();
            $table->foreignId('laundry_order_id')->nullable()->constrained('laundry_orders')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->nullable()->constrained('booking_services')->cascadeOnDelete();

            $table->enum('payment_type', ['DP', 'Pelunasan', 'Lunas', 'Denda', 'Perpanjangan', 'Penjualan', 'Layanan']);
            $table->unsignedInteger('amount');
            $table->string('payment_method', 30)->nullable();          // Tunai, Transfer, QRIS
            $table->string('bank_name')->nullable();                   // bank tujuan / asal transfer
            $table->string('proof_file')->nullable();                  // foto bukti transfer

            // Transfer online menunggu dicek admin; bayar di toko langsung 'verified'
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete(); // staff yang menerima / memverifikasi
            $table->timestamp('verified_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
