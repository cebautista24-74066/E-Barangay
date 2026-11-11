<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ResidentAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_resident_can_register_and_is_assigned_resident_role(): void
    {
        $response = $this->postJson('/auth/register', [
            'name' => 'Jamie Resident',
            'email' => 'JAMIE@example.com',
            'password' => 'secure-pass-123',
            'password_confirmation' => 'secure-pass-123',
            'role' => 'Administrator',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'Jamie Resident')
            ->assertJsonPath('user.email', 'jamie@example.com')
            ->assertJsonPath('user.role', 'Resident')
            ->assertJsonStructure(['csrf_token']);

        $user = User::where('email', 'jamie@example.com')->firstOrFail();

        $this->assertSame('Resident', $user->role);
        $this->assertTrue(Hash::check('secure-pass-123', $user->password));
        $this->assertAuthenticatedAs($user);
    }

    public function test_registration_requires_matching_password_confirmation(): void
    {
        $this->postJson('/auth/register', [
            'name' => 'Jamie Resident',
            'email' => 'jamie@example.com',
            'password' => 'secure-pass-123',
            'password_confirmation' => 'different-pass-123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseCount('users', 0);
    }

    public function test_registration_rejects_duplicate_email_addresses(): void
    {
        User::factory()->create(['email' => 'jamie@example.com']);

        $this->postJson('/auth/register', [
            'name' => 'Another Resident',
            'email' => 'JAMIE@example.com',
            'password' => 'secure-pass-123',
            'password_confirmation' => 'secure-pass-123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('users', 1);
    }

    public function test_resident_can_log_in_and_log_out(): void
    {
        $user = User::factory()->create([
            'name' => 'Jamie Resident',
            'email' => 'jamie@example.com',
            'password' => 'secure-pass-123',
            'role' => 'Resident',
        ]);

        $this->postJson('/auth/login', [
            'email' => 'JAMIE@example.com',
            'password' => 'secure-pass-123',
            'remember' => true,
        ])->assertOk()
            ->assertJsonPath('user.email', 'jamie@example.com')
            ->assertJsonPath('user.role', 'Resident')
            ->assertJsonStructure(['csrf_token']);

        $this->assertAuthenticatedAs($user);

        $this->postJson('/auth/logout')
            ->assertOk()
            ->assertJsonStructure(['csrf_token']);

        $this->assertGuest();
    }

    public function test_resident_can_log_in_with_whitespace_around_email(): void
    {
        User::factory()->create(['email' => 'resident@example.com', 'password' => 'secure-pass-123', 'role' => 'Resident']);
        $this->postJson('/auth/login', ['email' => '  RESIDENT@EXAMPLE.COM  ', 'password' => 'secure-pass-123'])->assertOk()->assertJsonPath('user.email', 'resident@example.com');
    }

    public function test_only_administrators_can_view_resident_database_ids(): void
    {
        $resident = User::factory()->create([
            'name' => 'Database Resident',
            'email' => 'resident@example.com',
            'role' => 'Resident',
        ]);
        User::factory()->create([
            'name' => 'Database Administrator',
            'email' => 'admin@example.com',
            'role' => 'Administrator',
        ]);

        $this->getJson('/admin/residents')->assertUnauthorized();

        $this->actingAs($resident)
            ->getJson('/admin/residents')
            ->assertForbidden();

        $administrator = User::where('email', 'admin@example.com')->firstOrFail();

        $this->actingAs($administrator)
            ->getJson('/admin/residents')
            ->assertOk()
            ->assertJsonPath('residents.0.id', $resident->id)
            ->assertJsonPath('residents.0.name', 'Database Resident')
            ->assertJsonPath('residents.0.email', 'resident@example.com')
            ->assertJsonCount(1, 'residents');
    }

    public function test_invalid_password_does_not_authenticate(): void
    {
        User::factory()->create([
            'email' => 'jamie@example.com',
            'password' => 'secure-pass-123',
        ]);

        $this->postJson('/auth/login', [
            'email' => 'jamie@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
    }
}
