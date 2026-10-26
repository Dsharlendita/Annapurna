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
        // 1. Update promos table
        Schema::table('promos', function (Blueprint $table) {
            $table->string('name', 150)->nullable()->after('code');
            $table->text('description')->nullable()->after('name');
            $table->enum('applies_to', ['rent', 'buy', 'all'])->default('rent')->after('discount_value');
            $table->date('valid_from')->nullable()->after('max_discount');
            $table->unsignedInteger('quota')->default(0)->after('valid_until');
            $table->unsignedInteger('used_count')->default(0)->after('quota');
            $table->boolean('weekday_only')->default(false)->after('used_count');
            $table->boolean('show_on_home')->default(true)->after('weekday_only');
        });

        // 2. Update reviews table
        Schema::table('reviews', function (Blueprint $table) {
            $table->foreignId('sale_id')->nullable()->after('booking_id')->constrained('sales')->nullOnDelete();
            $table->timestamp('reply_at')->nullable()->after('reply');
            $table->foreignId('replied_by')->nullable()->after('reply_at')->constrained('users')->nullOnDelete();
            $table->unsignedSmallInteger('featured_order')->default(0)->after('is_featured');
        });

        // 3. Update booking_returns table
        Schema::table('booking_returns', function (Blueprint $table) {
            $table->string('proof_photo')->nullable()->after('notes');
            $table->json('unit_results')->nullable()->after('proof_photo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('booking_returns', function (Blueprint $table) {
            $table->dropColumn(['proof_photo', 'unit_results']);
        });

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['sale_id']);
            $table->dropForeign(['replied_by']);
            $table->dropColumn(['sale_id', 'reply_at', 'replied_by', 'featured_order']);
        });

        Schema::table('promos', function (Blueprint $table) {
            $table->dropColumn([
                'name',
                'description',
                'applies_to',
                'valid_from',
                'quota',
                'used_count',
                'weekday_only',
                'show_on_home'
            ]);
        });
    }
};
