<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $services = DB::table('barangay_services')->whereIn('name', ['Blotters', 'Complaints'])->get(['id']);
        foreach ($services as $service) {
            $hasRequests = DB::table('service_requests')->where('barangay_service_id', $service->id)->exists();
            if ($hasRequests) {
                DB::table('barangay_services')->where('id', $service->id)->update(['is_active' => false, 'updated_at' => now()]);
            } else {
                DB::table('barangay_services')->where('id', $service->id)->delete();
            }
        }
    }

    public function down(): void
    {
        // Removed services are intentionally not recreated during rollback.
    }
};
