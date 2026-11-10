<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void { Schema::create('drrm_hazard_zones', function (Blueprint $table) { $table->id(); $table->string('name'); $table->string('hazard_type'); $table->string('severity')->default('High'); $table->json('geometry'); $table->text('notes')->nullable(); $table->timestamps(); }); }
 public function down(): void { Schema::dropIfExists('drrm_hazard_zones'); }
};