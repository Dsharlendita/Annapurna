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
        // 1. Tabel Link Nota Pendek WhatsApp (/n/{token})
        if (!Schema::hasTable('nota_links')) {
            Schema::create('nota_links', function (Blueprint $table) {
                $table->string('token', 16)->primary();
                $table->enum('kind', ['rent', 'sale', 'laundry']);
                $table->string('ref_id', 40);
                $table->longText('payload');
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();

                $table->index(['kind', 'ref_id']);
            });
        }

        // 2. Tabel Rincian Pengiriman Penjualan Belanja
        if (!Schema::hasTable('sale_deliveries')) {
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

        // 3. Tabel Permintaan Tukar Barang Sewa
        if (!Schema::hasTable('booking_changes')) {
            Schema::create('booking_changes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
                $table->string('from_product_id', 50)->nullable();
                $table->string('from_product_name')->nullable();
                $table->string('to_product_id', 50)->nullable();
                $table->string('to_product_name')->nullable();
                $table->string('to_size', 50)->nullable();
                $table->unsignedInteger('qty')->default(1);
                $table->integer('price_diff')->default(0);
                $table->text('reason')->nullable();
                $table->text('admin_note')->nullable();
                $table->enum('source', ['customer', 'toko'])->default('customer');
                $table->enum('status', ['menunggu', 'disetujui', 'ditolak'])->default('menunggu');
                $table->foreignId('action_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('action_at')->nullable();
                $table->timestamps();
            });
        }

        // 4. Tabel Permintaan Perpanjangan Sewa
        if (!Schema::hasTable('booking_extensions')) {
            Schema::create('booking_extensions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
                $table->date('from_date');
                $table->date('to_date');
                $table->unsignedInteger('days')->default(1);
                $table->unsignedInteger('cost')->default(0);
                $table->text('reason')->nullable();
                $table->enum('source', ['customer', 'toko'])->default('customer');
                $table->enum('status', ['menunggu', 'disetujui', 'ditolak'])->default('menunggu');
                $table->foreignId('action_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('action_at')->nullable();
                $table->timestamps();
            });
        }

        // 5. Tabel Catatan Refund Pembatalan
        if (!Schema::hasTable('refunds')) {
            Schema::create('refunds', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
                $table->unsignedInteger('amount')->default(0);
                $table->string('bank_account', 100)->nullable();
                $table->text('reason')->nullable();
                $table->enum('status', ['menunggu', 'selesai', 'hangus', 'tidak_perlu'])->default('menunggu');
                $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();
            });
        }

        // 6. Tabel Rekam Pertanyaan Chatbot yang Belum Terjawab
        if (!Schema::hasTable('chat_misses')) {
            Schema::create('chat_misses', function (Blueprint $table) {
                $table->id();
                $table->string('question_norm', 255)->unique();
                $table->text('question_text');
                $table->unsignedInteger('count')->default(1);
                $table->timestamp('first_at')->nullable();
                $table->timestamp('last_at')->nullable();
                $table->timestamp('dismissed_at')->nullable();
                $table->timestamps();
            });
        }

        // 7. Penambahan Kolom Tarif Bertingkat Produk
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'rent_price_3')) {
                $table->unsignedInteger('rent_price_3')->nullable()->after('rent_price');
            }
            if (!Schema::hasColumn('products', 'rent_price_5')) {
                $table->unsignedInteger('rent_price_5')->nullable()->after('rent_price_3');
            }
        });

        // 8. Penambahan Kolom Tarif Bertingkat Paket
        Schema::table('packages', function (Blueprint $table) {
            if (!Schema::hasColumn('packages', 'price_3')) {
                $table->unsignedInteger('price_3')->nullable()->after('price_per_day');
            }
            if (!Schema::hasColumn('packages', 'price_5')) {
                $table->unsignedInteger('price_5')->nullable()->after('price_3');
            }
        });

        // 9. Penambahan Kolom Alasan Diskon & Pelunasan / Piutang di Bookings
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'discount_reason')) {
                $table->string('discount_reason', 150)->nullable()->after('discount_amount');
            }
            if (!Schema::hasColumn('bookings', 'settle_disc_amount')) {
                $table->unsignedInteger('settle_disc_amount')->default(0)->after('discount_reason');
            }
            if (!Schema::hasColumn('bookings', 'settle_disc_reason')) {
                $table->string('settle_disc_reason', 150)->nullable()->after('settle_disc_amount');
            }
            if (!Schema::hasColumn('bookings', 'settle_later')) {
                $table->boolean('settle_later')->default(false)->after('payment_status');
            }
            if (!Schema::hasColumn('bookings', 'piutang_amount')) {
                $table->unsignedInteger('piutang_amount')->default(0)->after('settle_later');
            }
            if (!Schema::hasColumn('bookings', 'piutang_note')) {
                $table->text('piutang_note')->nullable()->after('piutang_amount');
            }
        });

        // 10. Penambahan Kolom Alasan Diskon di Sales
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'discount_amount')) {
                $table->unsignedInteger('discount_amount')->default(0)->after('subtotal');
            }
            if (!Schema::hasColumn('sales', 'discount_reason')) {
                $table->string('discount_reason', 150)->nullable()->after('discount_amount');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('sales', 'discount_reason')) $cols[] = 'discount_reason';
            if (Schema::hasColumn('sales', 'discount_amount')) $cols[] = 'discount_amount';
            if (!empty($cols)) $table->dropColumn($cols);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $cols = [];
            foreach (['discount_reason', 'settle_disc_amount', 'settle_disc_reason', 'settle_later', 'piutang_amount', 'piutang_note'] as $col) {
                if (Schema::hasColumn('bookings', $col)) $cols[] = $col;
            }
            if (!empty($cols)) $table->dropColumn($cols);
        });

        Schema::table('packages', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('packages', 'price_3')) $cols[] = 'price_3';
            if (Schema::hasColumn('packages', 'price_5')) $cols[] = 'price_5';
            if (!empty($cols)) $table->dropColumn($cols);
        });

        Schema::table('products', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('products', 'rent_price_3')) $cols[] = 'rent_price_3';
            if (Schema::hasColumn('products', 'rent_price_5')) $cols[] = 'rent_price_5';
            if (!empty($cols)) $table->dropColumn($cols);
        });

        Schema::dropIfExists('chat_misses');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('booking_extensions');
        Schema::dropIfExists('booking_changes');
        Schema::dropIfExists('sale_deliveries');
        Schema::dropIfExists('nota_links');
    }
};
