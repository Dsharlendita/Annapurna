<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 08 · SISTEM (tambahan)
 * Catatan histori yang dibuat tampilan (data.js → DB.audit) ikut disimpan di activity_logs.
 * client_ref mencegah catatan yang sama tersimpan dua kali bila dikirim ulang.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->string('client_ref', 120)->nullable()->unique()->after('subject_id');
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropUnique(['client_ref']);
            $table->dropColumn('client_ref');
        });
    }
};
