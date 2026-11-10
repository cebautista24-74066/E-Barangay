<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void { Schema::dropIfExists('drrm_hazard_zones'); }
    public function down(): void { }
};
