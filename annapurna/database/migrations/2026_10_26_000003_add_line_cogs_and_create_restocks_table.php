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
        // 1. Tambah kolom line dan ref di tabel finances
        Schema::table('finances', function (Blueprint $table) {
            $table->string('ref', 100)->nullable()->after('finance_code');
            $table->enum('line', ['rent', 'sale', 'umum'])->default('umum')->after('category');
        });

        // 2. Tambah cost_price di products
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('cost_price')->nullable()->after('sale_price');
        });

        // 3. Tambah purchase_cost di product_units
        Schema::table('product_units', function (Blueprint $table) {
            $table->unsignedInteger('purchase_cost')->nullable()->after('size');
        });

        // 4. Tambah unit_cost di sale_items
        Schema::table('sale_items', function (Blueprint $table) {
            $table->unsignedInteger('unit_cost')->nullable()->after('unit_price');
        });

        // 5. Buat tabel restocks
        Schema::create('restocks', function (Blueprint $table) {
            $table->id();
            $table->string('product_id', 50);
            $table->enum('kind', ['sale', 'rent'])->default('sale');
            $table->string('variant', 50)->nullable();
            $table->unsignedInteger('qty');
            $table->unsignedInteger('unit_cost');
            $table->unsignedInteger('total_cost');
            $table->string('supplier', 100)->nullable();
            $table->text('note')->nullable();
            $table->json('unit_codes')->nullable();
            $table->date('restock_date');
            $table->foreignId('finance_id')->nullable()->constrained('finances')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('restocks');

        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('unit_cost');
        });

        Schema::table('product_units', function (Blueprint $table) {
            $table->dropColumn('purchase_cost');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('cost_price');
        });

        Schema::table('finances', function (Blueprint $table) {
            $table->dropColumn(['ref', 'line']);
        });
    }
};
