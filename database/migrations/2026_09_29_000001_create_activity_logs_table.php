<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
