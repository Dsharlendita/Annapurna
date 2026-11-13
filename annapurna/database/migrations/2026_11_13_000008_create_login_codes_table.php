<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 01 · AKUN (tambahan)
 * Kode verifikasi 6 digit yang dikirim lewat email untuk "Masuk dengan kode"
 * dan "Lupa kata sandi". Kode disimpan teracak (hash), bukan angka aslinya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('purpose', ['login', 'reset']);               // masuk dengan kode / atur ulang kata sandi
            $table->string('code_hash');
            $table->string('sent_to');                                 // alamat email tujuan
            $table->unsignedTinyInteger('attempts')->default(0);       // jumlah salah ketik
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'purpose', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_codes');
    }
};
