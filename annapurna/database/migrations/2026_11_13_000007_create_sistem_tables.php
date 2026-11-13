<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 08 · SISTEM
 * Pengaturan toko, promo, ulasan, penomoran nota, link nota WhatsApp,
 * jejak aktivitas, log email, dan pertanyaan chatbot.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Pengaturan toko (key → value JSON), diubah Owner
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->longText('value')->nullable();
            $table->timestamps();
        });

        Schema::create('promos', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 150)->nullable();
            $table->text('description')->nullable();
            $table->enum('discount_type', ['persen', 'nominal'])->default('persen');
            $table->unsignedInteger('discount_value');
            $table->enum('applies_to', ['rent', 'buy', 'all'])->default('rent');
            $table->unsignedInteger('min_order')->default(0);
            $table->unsignedInteger('max_discount')->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->unsignedInteger('quota')->default(0);              // 0 = tanpa batas
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('weekday_only')->default(false);
            $table->boolean('show_on_home')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Ulasan customer untuk sewa atau pembelian
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('product_id', 50)->nullable();
            $table->string('customer_name');
            $table->unsignedTinyInteger('rating')->default(5);
            $table->text('comment');
            $table->text('reply')->nullable();
            $table->timestamp('reply_at')->nullable();
            $table->foreignId('replied_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_featured')->default(false);
            $table->unsignedSmallInteger('featured_order')->default(0);
            $table->boolean('is_visible')->default(true);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // Penomoran nota per bulan: RNTL/001/XI/2026, ODR/…, DRY/…
        Schema::create('document_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('prefix', 10);
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();

            $table->unique(['prefix', 'year', 'month'], 'doc_seq_prefix_year_month_unique');
        });

        // Link pendek nota untuk WhatsApp (/n/{token})
        Schema::create('nota_links', function (Blueprint $table) {
            $table->string('token', 16)->primary();
            $table->enum('kind', ['rent', 'sale', 'laundry']);
            $table->string('ref_id', 40);
            $table->longText('payload');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['kind', 'ref_id']);
        });

        // Jejak aktivitas staff/owner, berantai hash agar tidak bisa diubah diam-diam
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('user_name');
            $table->string('role', 20);
            $table->string('type', 30)->index();
            $table->string('action', 500);
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            $table->json('changes')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->char('prev_hash', 64);
            $table->char('hash', 64)->unique();
            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 50)->default('general');
            $table->string('to');
            $table->string('subject');
            $table->enum('status', ['terkirim', 'gagal', 'antre'])->default('terkirim');
            $table->text('error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });

        // Pertanyaan chatbot yang belum ada jawabannya
        Schema::create('chat_misses', function (Blueprint $table) {
            $table->id();
            $table->string('question_norm', 255)->unique();
            $table->text('question_text');
            $table->unsignedInteger('count')->default(1);
            $table->timestamp('first_at')->nullable();
            $table->timestamp('last_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_misses');
        Schema::dropIfExists('email_logs');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('nota_links');
        Schema::dropIfExists('document_sequences');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('promos');
        Schema::dropIfExists('settings');
    }
};
