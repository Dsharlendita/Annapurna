<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Integrasi Google Drive sungguhan.
 *
 *   drive_connections : akun Google yang dihubungkan Owner (token akses disimpan terenkripsi)
 *   report_archives   : rekap laporan bulanan yang sudah diunggah ke Google Drive (satu baris per bulan)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drive_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');                          // akun Google pemilik Drive
            $table->text('refresh_token');                    // terenkripsi (APP_KEY)
            $table->string('root_folder_id')->nullable();     // folder utama di Drive
            $table->string('root_folder_name')->nullable();
            $table->timestamps();
        });

        Schema::create('report_archives', function (Blueprint $table) {
            $table->id();
            $table->char('period', 7)->unique();              // 2026-10
            $table->unsignedSmallInteger('version')->default(1);
            $table->boolean('is_auto')->default(false);       // dibuat otomatis (terjadwal) atau manual
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('created_by_name')->nullable();
            $table->string('drive_folder_id');
            $table->string('drive_folder_url');
            $table->json('path');                             // ["ANNAPURNA ADVENTURE","TAHUN 2026","REKAP LAPORAN BULAN OKTOBER 2026"]
            $table->json('files');                            // [{type,name,id,url}]
            $table->json('summary')->nullable();              // angka ringkasan untuk email & dashboard
            $table->string('mail_to')->nullable();
            $table->enum('mail_status', ['terkirim', 'gagal', 'nonaktif'])->default('nonaktif');
            $table->timestamp('mailed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_archives');
        Schema::dropIfExists('drive_connections');
    }
};
