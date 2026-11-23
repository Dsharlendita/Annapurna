<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tanda kecil yang dulu hanya tersimpan di browser:
 * - reviews.reply_seen_at          : customer sudah membaca balasan toko
 * - booking_services.customer_wa_at: customer sudah mengirim konfirmasi layanan antar/tenda lewat WhatsApp
 * - sale_deliveries.customer_wa_at : customer sudah menghubungi admin soal ongkir pesanan beli
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->timestamp('reply_seen_at')->nullable()->after('seen_at');
        });
        Schema::table('booking_services', function (Blueprint $table) {
            $table->timestamp('customer_wa_at')->nullable()->after('notes');
        });
        Schema::table('sale_deliveries', function (Blueprint $table) {
            $table->timestamp('customer_wa_at')->nullable()->after('notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('reviews', fn (Blueprint $t) => $t->dropColumn('reply_seen_at'));
        Schema::table('booking_services', fn (Blueprint $t) => $t->dropColumn('customer_wa_at'));
        Schema::table('sale_deliveries', fn (Blueprint $t) => $t->dropColumn('customer_wa_at'));
    }
};
