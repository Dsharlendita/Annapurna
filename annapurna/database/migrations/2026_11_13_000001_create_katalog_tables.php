<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 02 · KATALOG
 * Barang yang disewakan / dijual, unit fisiknya, dan paket sewa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->string('id', 50)->primary();                       // slug, mis. 'tenda', 'carrier'
            $table->string('name');
            $table->string('img')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 50)->primary();                       // mis. 'tnd-4p'
            $table->string('category_id', 50);
            $table->string('name');
            $table->string('brand')->nullable();
            $table->string('sku')->nullable();
            $table->string('img')->nullable();

            // Harga
            $table->unsignedInteger('rent_price')->default(0);         // sewa per hari (1–2 hari)
            $table->unsignedInteger('rent_price_3')->nullable();       // total sewa 3 hari
            $table->unsignedInteger('rent_price_5')->nullable();       // total sewa 5 hari
            $table->unsignedInteger('sale_price')->nullable();         // harga jual (null = tidak dijual)
            $table->unsignedInteger('cost_price')->nullable();         // harga modal, untuk HPP
            // Stok barang jual. Ketersediaan barang sewa dihitung dari product_units;
            // kolom ini hanya cadangan bila produk sewa belum punya unit fisik.
            $table->integer('stock')->default(0);

            // Tampilan katalog
            $table->decimal('rating', 3, 1)->default(5.0);
            $table->unsignedInteger('reviews_count')->default(0);
            $table->string('condition')->default('Sangat Baik');
            $table->string('badge')->nullable();                       // 'Populer', 'Best Seller'
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);

            // Detail produk
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
            $table->json('variant_data')->nullable();                  // daftar ukuran, label, opsi

            // Aturan sewa & perawatan
            $table->unsignedInteger('deposit')->default(0);            // jaminan uang per barang (0 = tidak ada)
            $table->unsignedInteger('min_stock')->nullable();          // batas peringatan stok menipis
            $table->unsignedInteger('service_every')->nullable();      // servis tiap N kali sewa (null = ikut pengaturan toko)
            $table->boolean('wash')->nullable();                       // perlu dicuci setelah kembali (null = ikut kategori)
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('categories')->cascadeOnDelete();
        });

        // Unit fisik barang sewa (satu baris = satu barang berkode)
        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->string('product_id', 50);
            $table->string('unit_code', 50)->unique();                 // mis. 'TND-4P-01'
            $table->string('size')->nullable();
            $table->unsignedInteger('purchase_cost')->nullable();
            $table->string('condition')->default('Baik');
            $table->enum('status', ['tersedia', 'disewa', 'perawatan', 'rusak', 'nonaktif'])->default('tersedia');
            $table->unsignedInteger('rents_count')->default(0);
            $table->unsignedInteger('since_service')->default(0);
            $table->timestamp('last_service')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        Schema::create('packages', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('name');
            $table->text('tagline')->nullable();
            $table->string('img')->nullable();
            $table->unsignedInteger('price_per_day')->default(0);
            $table->unsignedInteger('price_3')->nullable();
            $table->unsignedInteger('price_5')->nullable();
            $table->string('people')->nullable();                      // label, mis. '2–3 orang'
            $table->unsignedInteger('people_min')->nullable();
            $table->unsignedInteger('people_max')->nullable();
            $table->string('type')->default('camping');
            $table->boolean('is_popular')->default(false);             // label "Populer" di halaman paket
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('package_items', function (Blueprint $table) {
            $table->id();
            $table->string('package_id', 50);
            $table->string('product_id', 50);
            $table->unsignedInteger('qty')->default(1);
            $table->timestamps();

            $table->foreign('package_id')->references('id')->on('packages')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_items');
        Schema::dropIfExists('packages');
        Schema::dropIfExists('product_units');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
