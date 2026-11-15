<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 02 · KATALOG (tambahan)
 * Unit fisik barang sewa dicatat lengkap di server (sebelumnya hanya di browser admin):
 * sedang keluar untuk booking mana, sedang dirawat apa, dan riwayat per unit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_units', function (Blueprint $table) {
            $table->string('out_ref', 50)->nullable()->after('status');         // kode booking yang sedang membawa unit ini
            $table->string('care', 20)->nullable()->after('out_ref');           // cuci / perbaikan (null = siap)
            $table->json('care_info')->nullable()->after('care');               // { issue, since, by }
            $table->json('history')->nullable()->after('notes');                // riwayat unit [{ at, text, by }]
        });
        // Unit barang jual yang sudah laku
        Schema::table('product_units', function (Blueprint $table) {
            $table->enum('status', ['tersedia', 'disewa', 'perawatan', 'rusak', 'nonaktif', 'terjual'])->default('tersedia')->change();
        });
    }

    public function down(): void
    {
        Schema::table('product_units', function (Blueprint $table) {
            $table->dropColumn(['out_ref', 'care', 'care_info', 'history']);
        });
    }
};
