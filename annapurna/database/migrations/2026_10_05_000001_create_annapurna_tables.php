<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Kategori Produk
        Schema::create('categories', function (Blueprint $table) {
            $table->string('id', 50)->primary(); // e.g. 'tenda', 'carrier'
            $table->string('name');
            $table->string('img')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // 2. Produk / Alat Outdoor
        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 50)->primary(); // e.g. 'p1', 'p2'
            $table->string('name');
            $table->string('category_id', 50);
            $table->string('brand')->nullable();
            $table->string('sku')->nullable();
            $table->string('img')->nullable();
            $table->unsignedInteger('rent_price')->default(0); // sewa per hari
            $table->unsignedInteger('sale_price')->nullable(); // harga jual baru jika tersedia
            $table->integer('stock')->default(0);
            $table->decimal('rating', 3, 1)->default(5.0);
            $table->unsignedInteger('reviews_count')->default(0);
            $table->string('condition')->default('Sangat Baik');
            $table->string('badge')->nullable(); // 'Populer', 'Best Seller'
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->json('specs')->nullable();
            $table->json('attrs')->nullable();
            $table->string('color')->nullable();
            $table->string('material')->nullable();
            $table->string('weight')->nullable();
            $table->string('dimension')->nullable();
            $table->text('includes')->nullable();
            $table->unsignedInteger('min_days')->default(1);
            $table->boolean('has_variant')->default(false);
            $table->json('variant_data')->nullable(); // ukuran, label, options
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
        });

        // 3. Unit Fisik Barang (Inventaris Barcode/Kode Unit)
        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->string('product_id', 50);
            $table->string('unit_code', 50)->unique(); // e.g. 'TND-4P-01'
            $table->string('size')->nullable(); // e.g. 'M', 'L', '42'
            $table->string('condition')->default('Baik');
            $table->enum('status', ['tersedia', 'disewa', 'perawatan', 'rusak', 'nonaktif'])->default('tersedia');
            $table->unsignedInteger('rents_count')->default(0);
            $table->unsignedInteger('since_service')->default(0);
            $table->timestamp('last_service')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // 4. Paket Hemat Outdoor
        Schema::create('packages', function (Blueprint $table) {
            $table->string('id', 50)->primary(); // e.g. 'pk1'
            $table->string('name');
            $table->text('tagline')->nullable();
            $table->string('img')->nullable();
            $table->unsignedInteger('price_per_day')->default(0);
            $table->string('people')->nullable(); // e.g. '2–3 orang'
            $table->unsignedInteger('people_min')->nullable();
            $table->unsignedInteger('people_max')->nullable();
            $table->string('type')->default('camping');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('package_items', function (Blueprint $table) {
            $table->id();
            $table->string('package_id', 50);
            $table->string('product_id', 50);
            $table->unsignedInteger('qty')->default(1);
            $table->timestamps();

            $table->foreign('package_id')->references('id')->on('packages')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // 5. Promo / Voucher Diskon
        Schema::create('promos', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->enum('discount_type', ['persen', 'nominal'])->default('persen');
            $table->unsignedInteger('discount_value');
            $table->unsignedInteger('min_order')->default(0);
            $table->unsignedInteger('max_discount')->nullable();
            $table->date('valid_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 6. Transaksi Booking Rental
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_code', 50)->unique(); // e.g. 'RNT-1001'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone', 30);
            $table->string('customer_email');
            $table->text('customer_address')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('days')->default(1);
            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->unsignedInteger('fine_amount')->default(0);
            $table->unsignedInteger('total_amount')->default(0);
            $table->unsignedInteger('dp_amount')->default(0);
            $table->string('payment_method')->nullable();
            $table->enum('status', [
                'menunggu_pembayaran',
                'menunggu_konfirmasi',
                'dikonfirmasi',
                'disewa',
                'selesai',
                'dibatalkan'
            ])->default('menunggu_pembayaran');
            $table->enum('payment_status', [
                'unpaid',
                'dp_verifying',
                'dp_paid',
                'lunas',
                'refunded',
                'forfeited',
                'refund_pending'
            ])->default('unpaid');
            $table->string('delivery_mode')->default('ambil');
            $table->text('notes')->nullable();
            $table->string('guarantee_type')->nullable(); // KTP, KTM, SIM
            $table->string('guarantee_file')->nullable();
            $table->timestamps();
        });

        Schema::create('booking_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('product_id', 50);
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->nullOnDelete();
            $table->string('product_name');
            $table->string('product_img')->nullable();
            $table->string('size')->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedInteger('price_per_day')->default(0);
            $table->unsignedInteger('subtotal')->default(0);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // 7. Transaksi Penjualan Alat (Toko)
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('sale_code', 50)->unique(); // e.g. 'ORD-2001'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone', 30);
            $table->string('customer_email');
            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('total_amount')->default(0);
            $table->string('payment_method')->nullable();
            $table->enum('status', [
                'menunggu_pembayaran',
                'diproses',
                'dikemas',
                'siap_diambil',
                'selesai',
                'dibatalkan'
            ])->default('menunggu_pembayaran');
            $table->enum('payment_status', [
                'unpaid',
                'verifying',
                'paid',
                'refunded'
            ])->default('unpaid');
            $table->string('delivery_mode')->default('ambil');
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
            $table->unsignedInteger('subtotal')->default(0);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // 8. Pembayaran & Bukti Transfer
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->cascadeOnDelete();
            $table->enum('payment_type', ['DP', 'Pelunasan', 'Denda', 'Penjualan']);
            $table->unsignedInteger('amount');
            $table->string('bank_name')->nullable();
            $table->string('proof_file')->nullable();
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 9. Pengembalian & Denda Rental
        Schema::create('booking_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->timestamp('return_date');
            $table->string('condition')->default('Baik');
            $table->unsignedInteger('late_days')->default(0);
            $table->unsignedInteger('late_fee')->default(0);
            $table->unsignedInteger('damage_fee')->default(0);
            $table->unsignedInteger('total_fine')->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('inspected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 10. Keuangan (Pemasukan & Pengeluaran)
        Schema::create('finances', function (Blueprint $table) {
            $table->id();
            $table->string('finance_code', 50)->unique(); // e.g. 'INC-1', 'EXP-1'
            $table->enum('type', ['income', 'expense']);
            $table->string('category');
            $table->unsignedInteger('amount');
            $table->date('transaction_date');
            $table->text('description');
            $table->string('proof_file')->nullable();
            $table->enum('status', ['aktif', 'dibatalkan'])->default('aktif');
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 11. Ulasan / Review Produk & Pelayanan
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('product_id', 50)->nullable();
            $table->string('customer_name');
            $table->unsignedTinyInteger('rating')->default(5);
            $table->text('comment');
            $table->text('reply')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_visible')->default(true);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // 12. Pengaturan Sistem Toko (Key-Value)
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('finances');
        Schema::dropIfExists('booking_returns');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('booking_items');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('promos');
        Schema::dropIfExists('package_items');
        Schema::dropIfExists('packages');
        Schema::dropIfExists('product_units');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
