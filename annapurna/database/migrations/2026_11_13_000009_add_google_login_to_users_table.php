<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 01 · AKUN (tambahan)
 * Masuk / daftar dengan akun Google (Google Cloud Console → OAuth).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id', 64)->nullable()->unique()->after('email');   // ID akun Google yang tersambung
            // false = akun dibuat lewat Google & belum pernah membuat kata sandi sendiri
            // (ganti kata sandi pertama kali tidak meminta kata sandi lama)
            $table->boolean('password_set')->default(true)->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn(['google_id', 'password_set']);
        });
    }
};
