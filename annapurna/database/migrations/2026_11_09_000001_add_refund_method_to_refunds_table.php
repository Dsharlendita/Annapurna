<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Metode pengembalian DP pembatalan (H-2): transfer ke rekening customer atau tunai di toko,
 * beserta foto bukti dari admin dan waktu konfirmasi WhatsApp ke customer.
 * Kolom lama `bank_account` tetap ada (diisi ringkasan "BANK NOMOR a.n. NAMA") agar data lama tetap terbaca.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->enum('method', ['transfer', 'tunai'])->nullable()->after('amount');
            $table->string('bank_name', 60)->nullable()->after('method');
            $table->string('account_number', 30)->nullable()->after('bank_name');
            $table->string('account_name', 100)->nullable()->after('account_number');
            $table->string('transfer_ref', 100)->nullable()->after('bank_account');
            $table->string('proof_file')->nullable()->after('transfer_ref');
            $table->enum('requested_by', ['customer', 'admin'])->nullable()->after('status');
            $table->timestamp('notified_at')->nullable()->after('processed_at');
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropColumn(['method', 'bank_name', 'account_number', 'account_name', 'transfer_ref', 'proof_file', 'requested_by', 'notified_at']);
        });
    }
};
