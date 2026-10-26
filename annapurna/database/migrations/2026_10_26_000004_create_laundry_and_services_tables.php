<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Kategori Laundry
        Schema::create('laundry_categories', function (Blueprint $table) {
            $table->string('id', 50)->primary(); // e.g. 'tenda', 'tas', 'sepatu'
            $table->string('name');
            $table->string('icon')->default('fa-jug-detergent');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Daftar Barang Laundry (Price List Bawaan)
        Schema::create('laundry_items', function (Blueprint $table) {
            $table->string('id', 50)->primary(); // e.g. 'ld-t2s', 'ld-sb'
            $table->string('category_id', 50);
            $table->string('name');
            $table->unsignedInteger('price')->default(0);
            $table->string('img')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('laundry_categories')->cascadeOnDelete();
        });

        // 3. Pesanan Laundry (Nota DRY/xxx/Romawi/Tahun)
        Schema::create('laundry_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_code', 50)->unique(); // e.g. 'DRY-1001'
            $table->string('nota_no', 40)->nullable()->unique(); // e.g. 'DRY/001/X/2026'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone', 30);
            $table->string('customer_email')->nullable();
            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->string('discount_reason')->nullable();
            $table->unsignedInteger('total_amount')->default(0);
            $table->string('payment_method')->nullable();
            $table->enum('status', ['diterima', 'dicuci', 'siap', 'selesai', 'dibatalkan'])->default('diterima');
            $table->enum('payment_status', ['unpaid', 'dp_paid', 'paid', 'refunded'])->default('unpaid');
            $table->enum('channel', ['kasir', 'online'])->default('kasir');
            $table->date('est_done')->nullable();
            $table->timestamp('picked_at')->nullable();
            $table->boolean('notified_ready')->default(false);
            $table->timestamp('notified_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 4. Rincian Barang yang Dicuci dalam Pesanan Laundry
        Schema::create('laundry_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laundry_order_id')->constrained('laundry_orders')->cascadeOnDelete();
            $table->string('laundry_item_id', 50)->nullable();
            $table->string('item_name');
            $table->string('category', 50)->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedInteger('unit_price')->default(0);
            $table->unsignedInteger('subtotal')->default(0);
            $table->boolean('is_custom')->default(false); // Revisi C.1: mendukung item "Lain-lain"
            $table->string('notes')->nullable();
            $table->timestamps();
        });

        // 5. Linimasa / Log Status Laundry
        Schema::create('laundry_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laundry_order_id')->constrained('laundry_orders')->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 6. Riwayat Pembayaran Laundry
        Schema::create('laundry_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laundry_order_id')->constrained('laundry_orders')->cascadeOnDelete();
            $table->string('payment_type', 50)->default('Lunas'); // DP, Lunas, Pelunasan
            $table->unsignedInteger('amount')->default(0);
            $table->string('payment_method')->default('Tunai');
            $table->timestamp('paid_at');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 7. Layanan Tambahan Sewa Alat (Antar-Jemput & Jasa Pasang Tenda)
        Schema::create('booking_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('service_mode')->default('ambil'); // ambil, antar, jemput, bongkar_pasang, pasang, bongkar
            $table->unsignedInteger('tents_count')->default(0);
            $table->text('address')->nullable();
            $table->date('scheduled_date')->nullable();
            $table->string('scheduled_time', 20)->nullable();
            $table->date('back_date')->nullable();
            $table->string('back_time', 20)->nullable();
            $table->unsignedInteger('fee')->default(0); // Biaya jasa pasang/bongkar tenda
            $table->unsignedInteger('ongkir')->default(0); // Biaya antar/jemput
            $table->unsignedInteger('total_service')->default(0);
            $table->enum('status', ['menunggu', 'dijadwalkan', 'selesai', 'dibatalkan'])->default('menunggu');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 8. Pembayaran Khusus Layanan Tambahan
        Schema::create('service_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->unsignedInteger('amount')->default(0);
            $table->string('payment_method')->default('Tunai');
            $table->timestamp('paid_at');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_payments');
        Schema::dropIfExists('booking_services');
        Schema::dropIfExists('laundry_payments');
        Schema::dropIfExists('laundry_status_logs');
        Schema::dropIfExists('laundry_order_items');
        Schema::dropIfExists('laundry_orders');
        Schema::dropIfExists('laundry_items');
        Schema::dropIfExists('laundry_categories');
    }
};
