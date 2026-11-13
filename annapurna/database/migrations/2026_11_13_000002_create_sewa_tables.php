<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 03 · SEWA
 * Booking sewa alat beserta barangnya, layanan antar/pasang, pengembalian,
 * perpanjangan, tukar barang, dan refund DP.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_code', 50)->unique();              // kode sistem, mis. 'RNT-20261113-0001'
            $table->string('nota_no', 40)->nullable()->unique();       // nomor nota, mis. 'RNTL/001/XI/2026'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            // Data customer (disalin saat booking, tetap ada walau akun dihapus)
            $table->string('customer_name');
            $table->string('customer_phone', 30);
            $table->string('customer_email');
            $table->text('customer_address')->nullable();
            $table->string('guarantee_type')->nullable();              // jaminan: KTP, KTM, SIM
            $table->string('guarantee_file')->nullable();

            // Jadwal sewa
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('days')->default(1);
            $table->string('delivery_mode')->default('ambil');         // ambil / antar (detail di booking_services)

            // Nominal. Denda tidak disimpan di sini, lihat booking_returns.total_fine.
            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->string('discount_reason', 150)->nullable();
            $table->unsignedInteger('settle_disc_amount')->default(0); // diskon saat pelunasan
            $table->string('settle_disc_reason', 150)->nullable();
            $table->unsignedInteger('total_amount')->default(0);       // subtotal − diskon + denda + biaya tambahan
            $table->unsignedInteger('dp_amount')->default(0);
            $table->string('payment_method')->nullable();

            // Status
            $table->enum('channel', ['online', 'offline'])->default('online'); // offline = dicatat di kasir toko
            $table->enum('status', [
                'menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa', 'selesai', 'dibatalkan',
            ])->default('menunggu_pembayaran');
            $table->enum('payment_status', [
                'unpaid', 'dp_verifying', 'dp_paid', 'lunas', 'refund_pending', 'refunded', 'forfeited',
            ])->default('unpaid');
            $table->timestamp('expired_at')->nullable();               // batas waktu bayar DP

            // Piutang (customer mengambil barang, pelunasan menyusul)
            $table->boolean('settle_later')->default(false);
            $table->unsignedInteger('piutang_amount')->default(0);
            $table->text('piutang_note')->nullable();

            // Pembatalan (rincian pengembalian DP di tabel refunds)
            $table->timestamp('cancel_at')->nullable();
            $table->string('cancel_reason', 255)->nullable();
            $table->boolean('cancel_auto')->default(false);            // dibatalkan otomatis karena lewat batas bayar

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['start_date', 'end_date']);
        });

        Schema::create('booking_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('product_id', 50);
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->nullOnDelete();
            $table->string('product_name');                            // disalin agar nota tetap benar walau produk berubah
            $table->string('product_img')->nullable();
            $table->string('size')->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedInteger('price_per_day')->default(0);
            $table->unsignedInteger('subtotal')->default(0);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        // Layanan tambahan: antar/jemput barang dan jasa pasang/bongkar tenda
        Schema::create('booking_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('service_mode')->default('ambil');          // ambil, antar, jemput, bongkar_pasang, pasang, bongkar
            $table->unsignedInteger('tents_count')->default(0);
            $table->text('address')->nullable();
            $table->date('scheduled_date')->nullable();
            $table->string('scheduled_time', 20)->nullable();
            $table->date('back_date')->nullable();
            $table->string('back_time', 20)->nullable();
            $table->unsignedInteger('fee')->default(0);                // jasa pasang/bongkar
            $table->unsignedInteger('ongkir')->default(0);             // antar/jemput
            $table->unsignedInteger('total_service')->default(0);
            $table->enum('status', ['menunggu', 'dijadwalkan', 'selesai', 'dibatalkan'])->default('menunggu');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Pemeriksaan saat barang kembali, termasuk denda
        Schema::create('booking_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->timestamp('return_date');
            $table->string('condition')->default('Baik');
            $table->unsignedInteger('late_days')->default(0);
            $table->unsignedInteger('late_fee')->default(0);
            $table->unsignedInteger('damage_fee')->default(0);
            $table->unsignedInteger('total_fine')->default(0);         // satu-satunya sumber nilai denda booking
            $table->text('notes')->nullable();
            $table->string('proof_photo')->nullable();
            $table->json('unit_results')->nullable();                  // hasil cek per unit
            $table->foreignId('inspected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

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

        // Pengembalian DP saat booking dibatalkan
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->unsignedInteger('amount')->default(0);
            $table->enum('method', ['transfer', 'tunai'])->nullable();
            $table->string('bank_name', 60)->nullable();
            $table->string('account_number', 30)->nullable();
            $table->string('account_name', 100)->nullable();
            $table->string('transfer_ref', 100)->nullable();
            $table->string('proof_file')->nullable();
            $table->text('reason')->nullable();
            $table->enum('status', ['menunggu', 'selesai', 'hangus', 'tidak_perlu'])->default('menunggu');
            $table->enum('requested_by', ['customer', 'admin'])->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('notified_at')->nullable();              // customer sudah dikabari via WhatsApp
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('booking_changes');
        Schema::dropIfExists('booking_extensions');
        Schema::dropIfExists('booking_returns');
        Schema::dropIfExists('booking_services');
        Schema::dropIfExists('booking_items');
        Schema::dropIfExists('bookings');
    }
};
