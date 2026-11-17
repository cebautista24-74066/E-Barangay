<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('drrm_evacuation_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evacuation_center_id')->constrained('drrm_evacuation_centers')->cascadeOnDelete();
            $table->foreignId('household_id')->constrained('drrm_households')->restrictOnDelete();
            $table->string('status')->default('Checked In');
            $table->unsignedInteger('member_count')->default(0);
            $table->unsignedInteger('male_count')->default(0);
            $table->unsignedInteger('female_count')->default(0);
            $table->unsignedInteger('senior_count')->default(0);
            $table->unsignedInteger('pwd_count')->default(0);
            $table->unsignedInteger('special_needs_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('checked_in_at');
            $table->timestamp('checked_out_at')->nullable();
            $table->timestamps();
            $table->index(['evacuation_center_id', 'status']);
            $table->index(['household_id', 'status']);
        });

        Schema::create('drrm_occupancy_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evacuation_center_id')->constrained('drrm_evacuation_centers')->cascadeOnDelete();
            $table->foreignId('evacuation_record_id')->nullable()->constrained('drrm_evacuation_records')->nullOnDelete();
            $table->string('action');
            $table->unsignedInteger('occupant_count');
            $table->unsignedInteger('available_capacity')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recorded_at');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drrm_occupancy_history');
        Schema::dropIfExists('drrm_evacuation_records');
    }
};
