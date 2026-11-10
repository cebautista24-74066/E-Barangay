<?php

namespace Database\Seeders;

use App\Models\BarangayService;
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
            ['name' => 'Blotters', 'description' => 'Recording of incidents, complaints, or community disputes reported to the barangay for documentation and resolution.', 'requirements' => 'Valid ID; incident details; supporting evidence if available.', 'instructions' => 'Describe the incident accurately and provide the date, location, and involved parties.'],
            ['name' => 'Complaints', 'description' => 'Formal filing of grievances or issues by residents for mediation and barangay action.', 'requirements' => 'Valid ID; clear explanation of the concern; supporting documents if available.', 'instructions' => 'Submit the concern and wait for the barangay office to contact you for mediation or action.'],
            ['name' => 'Special Permits', 'description' => 'Application for special event or activity permits within the barangay, such as public gatherings, fiestas, or road closures.', 'requirements' => 'Valid ID; event details; venue or route plan; schedule of activity.', 'instructions' => 'Submit the event information early for review and approval.'],
        ];

        $admin = User::where('email', 'admin@ebarangay.test')->first();
        foreach ($defaultServices as $service) {
            BarangayService::updateOrCreate(
                ['name' => $service['name']],
                [...$service, 'created_by' => $admin->id, 'is_active' => true],
            );
        }
    }
}
