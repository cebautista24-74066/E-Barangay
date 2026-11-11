<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void { Schema::create('audit_logs', function (Blueprint $table): void { $table->id(); $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); $table->string('action', 80); $table->string('module', 80); $table->text('description')->nullable(); $table->string('subject_type')->nullable(); $table->unsignedBigInteger('subject_id')->nullable(); $table->json('old_values')->nullable(); $table->json('new_values')->nullable(); $table->ipAddress('ip_address')->nullable(); $table->text('user_agent')->nullable(); $table->string('status', 20)->default('success'); $table->timestamps(); $table->index(['module', 'action']); $table->index('created_at'); }); }
    public function down(): void { Schema::dropIfExists('audit_logs'); }
};
