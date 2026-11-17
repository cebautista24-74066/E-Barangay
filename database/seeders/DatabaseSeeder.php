<?php

namespace Database\Seeders;

use App\Models\BarangayService;
use App\Models\DrrmEvacuationCenter;
use App\Models\DrrmHousehold;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@ebarangay.test'],
            [
                'name' => 'Barangay Administrator',
                'password' => 'Admin@12345',
                'role' => 'Administrator',
                'is_active' => true,
            ],
        );

        User::updateOrCreate(
            ['email' => 'resident@ebarangay.test'],
            [
                'name' => 'Test Resident',
                'password' => 'Resident@12345',
                'role' => 'Resident',
                'is_active' => true,
            ],
        );$defaultServices = [
            ['name' => 'Barangay Clearances', 'description' => 'Issuance of barangay clearance, certificate of indigency, or certificate of residency for residents official transactions.', 'requirements' => 'Valid government-issued ID; completed request details.', 'instructions' => 'Submit the request online and wait for the barangay office confirmation.'],
            ['name' => 'Business Permits', 'description' => 'Application and renewal of barangay business permits for local establishments and entrepreneurs.', 'requirements' => 'Valid ID; business registration documents; proof of address.', 'instructions' => 'Submit the business details and supporting documents for review.'],
            ['name' => 'Special Permits', 'description' => 'Application for special event or activity permits within the barangay, such as public gatherings, fiestas, or road closures.', 'requirements' => 'Valid ID; event details; venue or route plan; schedule of activity.', 'instructions' => 'Submit the event information early for review and approval.'],
        ];

        $admin = User::where('email', 'admin@ebarangay.test')->first();
        foreach ($defaultServices as $service) {
            BarangayService::updateOrCreate(
                ['name' => $service['name']],
                [...$service, 'created_by' => $admin->id, 'is_active' => true],
            );
        }

        $resident = User::where('email', 'resident@ebarangay.test')->firstOrFail();
        $services = BarangayService::orderBy('id')->get();
        $demoRequests = [
            ['reference_code' => 'DEMO-PENDING-001', 'service' => $services[0] ?? null, 'status' => 'Pending', 'purpose' => 'Employment requirement.'],
            ['reference_code' => 'DEMO-PROCESS-002', 'service' => $services[1] ?? $services[0] ?? null, 'status' => 'Processing', 'purpose' => 'Local business registration.'],
            ['reference_code' => 'DEMO-PICKUP-003', 'service' => $services[0] ?? null, 'status' => 'Ready for Pickup', 'purpose' => 'School requirement.', 'ready_for_pickup_at' => now()->subDay(), 'pickup_deadline' => now()->addDays(2)->endOfDay()],
            ['reference_code' => 'DEMO-CLAIMED-004', 'service' => $services[2] ?? $services[0] ?? null, 'status' => 'Claimed', 'purpose' => 'Special permit documentation.', 'ready_for_pickup_at' => now()->subDays(5), 'pickup_deadline' => now()->subDays(2)->endOfDay()],
            ['reference_code' => 'DEMO-REJECTED-005', 'service' => $services[0] ?? null, 'status' => 'Rejected', 'purpose' => 'Incomplete clearance requirements.'],
        ];
        foreach ($demoRequests as $demo) {
            if (! $demo['service']) continue;
            $serviceRequest = ServiceRequest::updateOrCreate(
                ['reference_code' => $demo['reference_code']],
                [
                    'user_id' => $resident->id,
                    'barangay_service_id' => $demo['service']->id,
                    'purpose' => $demo['purpose'],
                    'status' => $demo['status'],
                    'ready_for_pickup_at' => $demo['ready_for_pickup_at'] ?? null,
                    'pickup_deadline' => $demo['pickup_deadline'] ?? null,
                ],
            );
            $serviceRequest->statusHistory()->updateOrCreate(
                ['to_status' => $demo['status']],
                ['changed_by' => $admin->id, 'from_status' => null, 'note' => 'Demo request record.'],
            );
        }

        $demoHouseholds = [
            ['household_number' => 'DEMO-HH-001', 'address' => 'Purok 1, Humayingan', 'sitio' => 'Sitio 1', 'latitude' => 13.9982, 'longitude' => 120.6674, 'resident_count' => 4, 'senior_count' => 1, 'pwd_count' => 0, 'notes' => 'Demo priority household.'],
            ['household_number' => 'DEMO-HH-002', 'address' => 'Purok 3, Humayingan', 'sitio' => 'Sitio 3', 'latitude' => 13.9963, 'longitude' => 120.6662, 'resident_count' => 3, 'senior_count' => 0, 'pwd_count' => 1, 'notes' => 'Demo household record.'],
        ];
        foreach ($demoHouseholds as $attributes) {
            $household = DrrmHousehold::updateOrCreate(['household_number' => $attributes['household_number']], [...$attributes, 'location_type' => 'House', 'is_active' => true]);
            $household->recalculatePriority();
        }
        DrrmEvacuationCenter::updateOrCreate(
            ['name' => 'DEMO Humayingan Covered Court'],
            ['address' => 'Purok 2, Humayingan', 'latitude' => 13.9965, 'longitude' => 120.6732, 'capacity' => 70, 'current_occupants' => 12, 'status' => 'Open', 'is_active' => true],
        );
    }
}
