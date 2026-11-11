<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barangay_services', function (Blueprint $table): void {
            $table->string('template_title')->nullable();
            $table->text('template_body')->nullable();
            $table->text('template_footer')->nullable();
            $table->string('template_signature_name')->nullable();
            $table->string('template_signature_position')->nullable();
            $table->string('template_primary_color', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('barangay_services', function (Blueprint $table): void {
            $table->dropColumn(['template_title', 'template_body', 'template_footer', 'template_signature_name', 'template_signature_position', 'template_primary_color']);
        });
    }
};