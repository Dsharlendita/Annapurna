<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 04 · PENJUALAN
 * Pembelian barang di toko / online beserta pengirimannya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('sale_code', 50)->unique();
            $table->string('nota_no', 40)->nullable()->unique();       // mis. 'ODR/001/XI/2026'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            // Boleh kosong: pembeli umum di kasir
            $table->string('customer_name')->nullable();
            $table->string('customer_phone', 30)->nullable();
            $table->string('customer_email')->nullable();

            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->string('discount_reason', 150)->nullable();
            $table->unsignedInteger('total_amount')->default(0);
            $table->string('payment_method')->nullable();

            $table->enum('channel', ['online', 'offline'])->default('online');
            $table->enum('status', [
                'menunggu_pembayaran', 'diproses', 'dikemas', 'siap_diambil', 'selesai', 'dibatalkan',
            ])->default('menunggu_pembayaran');
            $table->enum('payment_status', ['unpaid', 'verifying', 'paid', 'refunded'])->default('unpaid');
            $table->string('delivery_mode')->default('ambil');
            $table->timestamp('expired_at')->nullable();

            $table->timestamp('cancel_at')->nullable();
            $table->string('cancel_reason', 255)->nullable();
            $table->boolean('cancel_auto')->default(false);

            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->string('product_id', 50);
            $table->string('product_name');
            $table->string('product_img')->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedInteger('unit_price')->default(0);
            $table->unsignedInteger('unit_cost')->nullable();          // modal per unit saat terjual (HPP)
            $table->unsignedInteger('subtotal')->default(0);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        Schema::create('sale_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->enum('method', ['kurir', 'ekspedisi'])->default('ekspedisi');
            $table->text('address')->nullable();
            $table->unsignedInteger('ongkir')->default(0);
            $table->string('courier_name', 100)->nullable();
            $table->string('courier_phone', 30)->nullable();
            $table->string('expedition', 50)->nullable();
            $table->string('tracking_no', 100)->nullable();
            $table->enum('ship_status', ['siap_dikirim', 'dikirim', 'tiba'])->default('siap_dikirim');
            $table->date('ship_date')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_deliveries');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
