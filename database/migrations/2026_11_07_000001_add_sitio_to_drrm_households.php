<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('drrm_households', function (Blueprint $table) {
            $table->string('sitio')->nullable()->after('address');
        });
    }

    public function down(): void
    {
        Schema::table('drrm_households', function (Blueprint $table) {
            $table->dropColumn('sitio');
        });
    }
};