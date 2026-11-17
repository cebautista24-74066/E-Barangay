<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('verification_status')->default('approved')->after('role');
            $table->string('verification_proof_path')->nullable()->after('verification_status');
            $table->text('verification_rejection_reason')->nullable()->after('verification_proof_path');
            $table->foreignId('verification_reviewed_by')->nullable()->after('verification_rejection_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('verification_reviewed_at')->nullable()->after('verification_reviewed_by');
            $table->index(['role', 'verification_status']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['verification_reviewed_by']);
            $table->dropIndex(['role', 'verification_status']);
            $table->dropColumn([
                'verification_status',
                'verification_proof_path',
                'verification_rejection_reason',
                'verification_reviewed_by',
                'verification_reviewed_at',
            ]);
        });
    }
};
