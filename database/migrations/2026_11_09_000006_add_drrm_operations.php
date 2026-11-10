<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('drrm_evacuation_centers', function (Blueprint $table) {
            $table->unsignedInteger('current_occupants')->default(0)->after('capacity');
            $table->string('status')->default('Open')->after('current_occupants');
        });
        Schema::table('drrm_households', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('priority_level');
        });
        Schema::table('drrm_hazard_zones', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('notes');
        });
        Schema::create('drrm_routes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('route_type')->default('Evacuation Route');
            $table->json('geometry');
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drrm_routes');
        Schema::table('drrm_hazard_zones', fn (Blueprint $table) => $table->dropColumn('is_active'));
        Schema::table('drrm_households', fn (Blueprint $table) => $table->dropColumn('is_active'));
        Schema::table('drrm_evacuation_centers', function (Blueprint $table) {
            $table->dropColumn(['current_occupants', 'status']);
        });
    }
};
