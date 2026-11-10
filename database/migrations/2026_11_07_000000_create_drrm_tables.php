<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('drrm_households', function (Blueprint $table) {
            $table->id();
            $table->string('household_number')->unique();
            $table->string('address');
            $table->string('purok')->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('priority_level')->default('Low');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('drrm_household_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained('drrm_households')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('age')->nullable();
            $table->boolean('is_senior')->default(false);
            $table->boolean('is_pwd')->default(false);
            $table->boolean('is_bedridden')->default(false);
            $table->boolean('is_pregnant')->default(false);
            $table->boolean('has_infant')->default(false);
            $table->boolean('needs_transport')->default(false);
            $table->text('medical_needs')->nullable();
            $table->timestamps();
        });

        Schema::create('drrm_evacuation_centers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('address');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->unsignedInteger('capacity')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drrm_household_members');
        Schema::dropIfExists('drrm_households');
        Schema::dropIfExists('drrm_evacuation_centers');
    }
};