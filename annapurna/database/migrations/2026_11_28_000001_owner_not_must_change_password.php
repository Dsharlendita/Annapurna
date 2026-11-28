<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Owner tidak punya "kata sandi awal" dari orang lain, jadi penanda wajib ganti sandi dimatikan untuk akun Owner
 * (sebelumnya tampil "Belum ganti kata sandi awal" pada Pak Ikun di Manajemen Staff).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('role', 'owner')->where('must_change_password', true)->update(['must_change_password' => false]);
    }

    public function down(): void
    {
        // Tidak dikembalikan.
    }
};
