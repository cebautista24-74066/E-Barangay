<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('event_location')->nullable()->after('event_time');
            $table->string('event_organizer')->nullable()->after('event_location');
            $table->string('event_contact')->nullable()->after('event_organizer');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['event_location', 'event_organizer', 'event_contact']);
        });
    }
};
