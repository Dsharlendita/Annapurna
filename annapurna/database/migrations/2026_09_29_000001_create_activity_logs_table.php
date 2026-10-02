<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Histori sistem (audit trail). Tabel ini append-only:
 * aplikasi hanya melakukan INSERT, tidak pernah UPDATE / DELETE.
 * Kolom prev_hash + hash membentuk rantai sehingga perubahan di luar aplikasi terdeteksi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index();      // null = Sistem (mis. rekap terjadwal)
            $table->string('user_name');                             // disalin agar tetap terbaca walau nama staff berubah
            $table->string('role', 20);                              // owner | admin | system
            $table->string('type', 30)->index();                     // login, logout, harga, stok, rental, keuangan, ...
            $table->string('action', 500);                           // "Mengubah harga Tenda 4P"
            $table->string('subject_type')->nullable();              // App\Models\Product, ...
            $table->string('subject_id')->nullable();                // p1, RNT-1001, ...
            $table->json('changes')->nullable();                     // [{field, from, to}]
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->char('prev_hash', 64);
            $table->char('hash', 64)->unique();
            $table->timestamp('created_at')->useCurrent()->index();
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
