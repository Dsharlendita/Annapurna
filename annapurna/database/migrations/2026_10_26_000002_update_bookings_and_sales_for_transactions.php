<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('nota_no', 40)->nullable()->unique()->after('booking_code');
            $table->enum('channel', ['online', 'offline'])->default('online')->after('status');
            $table->boolean('is_walk_in')->default(false)->after('channel');
            $table->timestamp('cancel_at')->nullable()->after('status');
            $table->string('cancel_reason', 255)->nullable()->after('cancel_at');
            $table->boolean('cancel_auto')->default(false)->after('cancel_reason');
            $table->timestamp('expired_at')->nullable()->after('notes');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->string('nota_no', 40)->nullable()->unique()->after('sale_code');
            $table->string('customer_name')->nullable()->change();
            $table->string('customer_phone', 30)->nullable()->change();
            $table->string('customer_email')->nullable()->change();
            $table->enum('channel', ['online', 'offline'])->default('online')->after('status');
            $table->boolean('is_walk_in')->default(false)->after('channel');
            $table->timestamp('cancel_at')->nullable()->after('status');
            $table->string('cancel_reason', 255)->nullable()->after('cancel_at');
            $table->boolean('cancel_auto')->default(false)->after('cancel_reason');
            $table->timestamp('expired_at')->nullable()->after('notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'nota_no',
                'channel',
                'is_walk_in',
                'cancel_at',
                'cancel_reason',
                'cancel_auto',
                'expired_at',
            ]);
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->string('customer_name')->nullable(false)->change();
            $table->string('customer_phone', 30)->nullable(false)->change();
            $table->string('customer_email')->nullable(false)->change();
            $table->dropColumn([
                'nota_no',
                'channel',
                'is_walk_in',
                'cancel_at',
                'cancel_reason',
                'cancel_auto',
                'expired_at',
            ]);
        });
    }
};
