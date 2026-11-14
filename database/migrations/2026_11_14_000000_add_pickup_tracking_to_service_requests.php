<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table): void {
            $table->timestamp('ready_for_pickup_at')->nullable()->after('status');
            $table->timestamp('pickup_deadline')->nullable()->after('ready_for_pickup_at');
            $table->index(['status', 'pickup_deadline']);
        });

        Schema::create('barangay_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('value');
            $table->timestamps();
        });
        DB::table('barangay_settings')->insert(['key' => 'pickup_window_days', 'value' => '3', 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('barangay_settings');
        Schema::table('service_requests', function (Blueprint $table): void {
            $table->dropIndex(['status', 'pickup_deadline']);
            $table->dropColumn(['ready_for_pickup_at', 'pickup_deadline']);
        });
    }
};
