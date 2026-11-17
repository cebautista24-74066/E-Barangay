<?php

namespace Tests\Feature;

use App\Models\BarangayService;
use App\Models\ResidentFeedback;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Notifications\ServiceRequestStatusChanged;
use App\Notifications\ResidentFeedbackStatusChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BarangayServiceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_can_publish_services_and_announcements_for_residents(): void
    {
        $administrator = User::factory()->create(['role' => 'Administrator']);
        $resident = User::factory()->create();
        $this->assertTrue($administrator->is_active);
        $this->assertSame('Administrator', $administrator->role);

        $serviceResponse = $this->actingAs($administrator)->postJson('/api/services', [
            'name' => 'Barangay Clearance',
            'description' => 'Request a clearance.',
            'requirements' => "Valid ID\nProof of residency",
            'instructions' => 'Submit the requirements at the barangay office.',
            'is_active' => true,
        ])->assertCreated();

        $serviceId = $serviceResponse->json('service.id');

        $this->postJson('/api/announcements', [
            'title' => 'Barangay Assembly',
            'body' => 'The assembly is scheduled this week.',
            'category' => 'Event',
            'is_published' => true,
        ])->assertCreated();

        $this->actingAs($resident)
            ->getJson('/api/services')
            ->assertOk()
            ->assertJsonPath('services.0.id', $serviceId)
            ->assertJsonPath('services.0.requirements', "Valid ID\nProof of residency");

        $this->getJson('/api/announcements')
            ->assertOk()
            ->assertJsonPath('announcements.0.title', 'Barangay Assembly');

        $this->postJson('/api/services', [
            'name' => 'Unauthorized Service',
            'description' => 'Not allowed.',
            'is_active' => true,
        ])->assertForbidden();
    }

    public function test_resident_can_submit_a_request_and_only_the_owner_or_admin_can_access_it(): void
    {
        Storage::fake('local');
        $resident = User::factory()->create();
        $otherResident = User::factory()->create();
        $administrator = User::factory()->create(['role' => 'Administrator']);
        $service = $this->createService($administrator);

        $response = $this->actingAs($resident)->postJson('/api/requests', [
            'service_id' => $service->id,
            'purpose' => 'Employment requirement',
            'documents' => [UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf')],
        ])->assertCreated();

        $requestId = $response->json('request.id');
        $reference = $response->json('request.reference_code');

        $this->assertDatabaseHas('service_requests', [
            'id' => $requestId,
            'user_id' => $resident->id,
            'status' => 'Pending',
        ]);
        $this->assertDatabaseHas('service_request_status_histories', [
            'service_request_id' => $requestId,
            'to_status' => 'Pending',
        ]);

        $file = $response->json('request.files.0');
        $this->assertNotEmpty($file['id']);
        $this->getJson('/api/requests')->assertJsonPath('requests.0.reference_code', $reference);
        $this->getJson('/api/requests/'.$requestId)->assertOk();
        $this->getJson('/api/request-files/'.$file['id'])->assertOk();

        $this->actingAs($otherResident)
            ->getJson('/api/requests/'.$requestId)
            ->assertForbidden();
        $this->getJson('/api/request-files/'.$file['id'])->assertForbidden();

        $this->actingAs($administrator)
            ->getJson('/api/requests/'.$requestId)
            ->assertOk()
            ->assertJsonPath('request.resident.id', $resident->id);
    }

    public function test_administrator_status_changes_are_recorded_and_notify_resident_by_database_and_email(): void
    {
        Notification::fake();
        $administrator = User::factory()->create(['role' => 'Administrator']);
        $resident = User::factory()->create();
        $service = $this->createService($administrator);
        $serviceRequest = ServiceRequest::create([
            'reference_code' => 'BRG-20261029-TEST1234',
            'user_id' => $resident->id,
            'barangay_service_id' => $service->id,
            'purpose' => 'Proof of residency',
            'status' => 'Pending',
        ]);

        $this->actingAs($administrator)
            ->patchJson('/api/requests/'.$serviceRequest->id.'/status', [
                'status' => 'Processing',
                'admin_note' => 'The submitted documents are being reviewed.',
            ])
            ->assertOk()
            ->assertJsonPath('request.status', 'Processing')
            ->assertJsonPath('request.status_history.0.from_status', 'Pending')
            ->assertJsonPath('request.status_history.0.to_status', 'Processing');

        $this->assertDatabaseHas('service_request_status_histories', [
            'service_request_id' => $serviceRequest->id,
            'from_status' => 'Pending',
            'to_status' => 'Processing',
            'note' => 'The submitted documents are being reviewed.',
        ]);

        Notification::assertSentTo(
            $resident,
            ServiceRequestStatusChanged::class,
            fn (ServiceRequestStatusChanged $notification, array $channels): bool => in_array('database', $channels, true)
                && in_array('mail', $channels, true),
        );
    }

    public function test_residents_can_send_private_feedback_and_only_administrators_can_manage_it(): void
    {
        Notification::fake();
        $resident = User::factory()->create();
        $administrator = User::factory()->create(['role' => 'Administrator']);

        $this->actingAs($resident)->postJson('/api/feedback', [
            'type' => 'Suggestion',
            'subject' => 'Add office hours',
            'message' => 'Please publish the office schedule.',
        ])->assertCreated();

        $feedback = ResidentFeedback::firstOrFail();

        $this->getJson('/api/feedback')
            ->assertOk()
            ->assertJsonPath('feedback.0.subject', 'Add office hours');

        $this->patchJson('/api/feedback/'.$feedback->id, [
            'status' => 'Resolved',
            'admin_note' => 'Office hours have been posted.',
        ])->assertForbidden();

        $this->actingAs($administrator)
            ->patchJson('/api/feedback/'.$feedback->id, [
                'status' => 'Resolved',
                'admin_note' => 'Office hours have been posted.',
            ])
            ->assertOk()
            ->assertJsonPath('feedback.status', 'Resolved');

        Notification::assertSentTo($resident, ResidentFeedbackStatusChanged::class);
    }

    public function test_reports_and_csv_export_are_administrator_only(): void
    {
        $administrator = User::factory()->create(['role' => 'Administrator']);
        $resident = User::factory()->create();
        $service = $this->createService($administrator);
        ServiceRequest::create([
            'reference_code' => 'BRG-20261029-REPORT01',
            'user_id' => $resident->id,
            'barangay_service_id' => $service->id,
            'purpose' => 'Employment requirement',
            'status' => 'Pending',
        ]);

        $this->actingAs($resident)->getJson('/api/admin/reports')->assertForbidden();

        $this->actingAs($administrator)
            ->getJson('/api/admin/reports')
            ->assertOk()
            ->assertJsonPath('total_residents', 1)
            ->assertJsonPath('total_requests', 1)
            ->assertJsonPath('requests_by_status.Pending', 1);

        $this->get('/api/admin/reports/requests.csv')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_inactive_residents_cannot_log_in(): void
    {
        $resident = User::factory()->create([
            'email' => 'inactive@example.com',
            'password' => 'secure-pass-123',
            'is_active' => false,
        ]);

        $this->postJson('/auth/login', [
            'email' => $resident->email,
            'password' => 'secure-pass-123',
        ])->assertForbidden()
            ->assertJsonPath('message', 'This account is inactive. Please contact the barangay office for assistance.');

        $this->assertGuest();
    }

    public function test_deactivated_resident_session_loses_access_to_protected_endpoints(): void
    {
        $resident = User::factory()->create();

        $this->actingAs($resident);
        $resident->update(['is_active' => false]);

        $this->getJson('/api/services')
            ->assertForbidden()
            ->assertJsonPath('message', 'This account is inactive. Please contact the barangay office for assistance.');

        $this->assertGuest();
    }

    public function test_administrator_can_archive_a_service_with_existing_requests_and_resident_cannot_see_it(): void
    {
        $administrator = User::factory()->create(['role' => 'Administrator']);
        $resident = User::factory()->create();
        $service = $this->createService($administrator);
        $serviceRequest = ServiceRequest::create([
            'reference_code' => 'BRG-20261116-ARCHIVE01',
            'user_id' => $resident->id,
            'barangay_service_id' => $service->id,
            'purpose' => 'Ongoing request',
            'status' => 'Processing',
        ]);

        $this->actingAs($administrator)
            ->deleteJson('/api/services/'.$service->id)
            ->assertOk()
            ->assertJsonPath('message', 'Service archived. Existing requests were preserved.')
            ->assertJsonPath('service.is_active', false);

        $this->assertDatabaseHas('barangay_services', ['id' => $service->id, 'is_active' => false]);
        $this->assertDatabaseHas('service_requests', ['id' => $serviceRequest->id, 'barangay_service_id' => $service->id, 'status' => 'Processing']);

        $this->actingAs($resident)->getJson('/api/services')->assertOk()->assertJsonMissing(['id' => $service->id]);
        $this->actingAs($administrator)->getJson('/api/services')->assertOk()->assertJsonPath('services.0.id', $service->id);
    }

    private function createService(User $administrator): BarangayService
    {
        return BarangayService::create([
            'created_by' => $administrator->id,
            'name' => 'Barangay Clearance',
            'description' => 'Request a barangay clearance.',
            'requirements' => 'Valid ID',
            'is_active' => true,
        ]);
    }
}
