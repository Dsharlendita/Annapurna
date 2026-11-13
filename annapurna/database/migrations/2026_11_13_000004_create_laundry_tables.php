<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 05 · LAUNDRY
 * Daftar harga cuci alat (dipakai juga kalkulator estimasi di website) dan
 * pesanan laundry yang dicatat staff di kasir. Pembayarannya ada di tabel payments.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('laundry_categories', function (Blueprint $table) {
            $table->string('id', 50)->primary();                       // mis. 'tenda', 'tas', 'sepatu'
            $table->string('name');
            $table->string('icon')->default('fa-jug-detergent');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('laundry_items', function (Blueprint $table) {
            $table->string('id', 50)->primary();                       // mis. 'ld-t2s'
            $table->string('category_id', 50);
            $table->string('name');
            $table->unsignedInteger('price')->default(0);
            $table->string('img')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('laundry_categories')->cascadeOnDelete();
        });

        Schema::create('laundry_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_code', 50)->unique();
            $table->string('nota_no', 40)->nullable()->unique();       // mis. 'DRY/001/XI/2026'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone', 30);
            $table->string('customer_email')->nullable();

            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->string('discount_reason')->nullable();
            $table->unsignedInteger('total_amount')->default(0);
            $table->string('payment_method')->nullable();

            $table->enum('channel', ['kasir', 'online'])->default('kasir');
            $table->enum('status', ['diterima', 'dicuci', 'siap', 'selesai', 'dibatalkan'])->default('diterima');
            $table->enum('payment_status', ['unpaid', 'dp_paid', 'paid', 'refunded'])->default('unpaid');
            $table->date('est_done')->nullable();
            $table->timestamp('picked_at')->nullable();
            $table->boolean('notified_ready')->default(false);
            $table->timestamp('notified_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('laundry_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laundry_order_id')->constrained('laundry_orders')->cascadeOnDelete();
            $table->string('laundry_item_id', 50)->nullable();         // kosong untuk barang "Lain-lain"
            $table->string('item_name');
            $table->string('category', 50)->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedInteger('unit_price')->default(0);
            $table->unsignedInteger('subtotal')->default(0);
            $table->boolean('is_custom')->default(false);
            $table->string('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('laundry_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laundry_order_id')->constrained('laundry_orders')->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('laundry_status_logs');
        Schema::dropIfExists('laundry_order_items');
        Schema::dropIfExists('laundry_orders');
        Schema::dropIfExists('laundry_items');
        Schema::dropIfExists('laundry_categories');
    }
};
