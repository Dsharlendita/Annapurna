<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Baris kunci rantai histori (lihat ActivityLog::lockHead): semua penulis histori antre di baris ini,
 * sehingga MySQL tidak lagi deadlock (1213) saat beberapa histori disimpan bersamaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('document_sequences')->insertOrIgnore([
            'prefix' => 'AUDIT', 'year' => 0, 'month' => 0, 'last_number' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('document_sequences')->where('prefix', 'AUDIT')->where('year', 0)->where('month', 0)->delete();
    }
};
