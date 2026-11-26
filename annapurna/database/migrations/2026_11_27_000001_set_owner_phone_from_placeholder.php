<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Nomor HP Owner (Pak Ikun) untuk tombol "Hubungi Owner" di Lupa kata sandi staff.
 * Hanya mengganti nomor contoh bawaan seeder (081200001111); nomor yang sudah diisi Owner sendiri tidak disentuh.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('role', 'owner')->whereIn('phone', ['081200001111', '0812-0000-1111'])
            ->update(['phone' => '085742202043', 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Tidak dikembalikan: nomor contoh tidak pernah benar.
    }
};
