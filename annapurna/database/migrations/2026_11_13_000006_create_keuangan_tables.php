<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 07 · KEUANGAN
 * Pemasukan lain & pengeluaran toko (di luar pembayaran customer) dan
 * catatan pembelian stok.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finances', function (Blueprint $table) {
            $table->id();
            $table->string('finance_code', 50)->unique();              // mis. 'INC-1', 'EXP-1'
            $table->string('ref', 100)->nullable();                    // kode transaksi terkait, mis. nota booking
            $table->enum('type', ['income', 'expense']);
            $table->string('category');
            $table->enum('line', ['rent', 'sale', 'umum'])->default('umum'); // lini usaha
            $table->unsignedInteger('amount');
            $table->date('transaction_date');
            $table->text('description');
            $table->string('proof_file')->nullable();
            $table->enum('status', ['aktif', 'dibatalkan'])->default('aktif');
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['type', 'transaction_date']);
        });

        Schema::create('restocks', function (Blueprint $table) {
            $table->id();
            $table->string('product_id', 50);
            $table->enum('kind', ['sale', 'rent'])->default('sale');   // stok jual / unit sewa baru
            $table->string('variant', 50)->nullable();
            $table->unsignedInteger('qty');
            $table->unsignedInteger('unit_cost');
            $table->unsignedInteger('total_cost');
            $table->string('supplier', 100)->nullable();
            $table->text('note')->nullable();
            $table->json('unit_codes')->nullable();                    // kode unit sewa yang dibuat
            $table->date('restock_date');
            $table->foreignId('finance_id')->nullable()->constrained('finances')->nullOnDelete(); // pengeluaran yang tercatat
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restocks');
        Schema::dropIfExists('finances');
    }
};
