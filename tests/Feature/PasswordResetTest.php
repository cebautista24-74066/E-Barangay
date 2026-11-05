<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Symfony\Component\Mailer\Exception\TransportException;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_account_can_request_a_password_reset_link(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'resident@example.com']);

        $this->postJson('/auth/forgot-password', [
            'email' => ' RESIDENT@example.com ',
        ])->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');

        Notification::assertSentTo($user, ResetPassword::class);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_unknown_email_receives_the_same_password_reset_response(): void
    {
        Notification::fake();

        $this->postJson('/auth/forgot-password', [
            'email' => 'unknown@example.com',
        ])->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');

        Notification::assertNothingSent();
        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_mail_delivery_errors_do_not_expose_smtp_details_to_the_user(): void
    {
        $exception = new TransportException('SMTP password rejected by the mail server.');

        Password::shouldReceive('sendResetLink')
            ->once()
            ->andThrow($exception);

        Log::shouldReceive('error')
            ->once()
            ->with('Password reset email delivery failed.', [
                'email' => hash('sha256', 'resident@example.com'),
                'exception' => $exception,
            ]);

        $this->postJson('/auth/forgot-password', [
            'email' => 'resident@example.com',
        ])->assertServiceUnavailable()
            ->assertJsonPath('message', 'We could not send the reset email. Please check the email delivery settings and try again.')
            ->assertDontSee('SMTP password rejected by the mail server.');
    }

    public function test_valid_reset_link_changes_password_and_is_single_use(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'email' => 'administrator@example.com',
            'role' => 'Administrator',
        ]);

        $this->postJson('/auth/forgot-password', [
            'email' => $user->email,
        ])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use (&$token): bool {
            $token = $notification->token;

            return true;
        });

        $this->get(route('password.reset', ['token' => $token, 'email' => $user->email]))
            ->assertOk();

        $this->postJson('/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ])->assertOk()
            ->assertJsonStructure(['csrf_token'])
            ->assertJsonPath('message', 'Your password has been reset. Log in using your new password.');

        $user->refresh();
        $this->assertSame('Administrator', $user->role);
        $this->assertTrue(Hash::check('new-secure-password', $user->password));
        $this->assertGuest();

        $this->postJson('/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'another-secure-password',
            'password_confirmation' => 'another-secure-password',
        ])->assertUnprocessable();
    }

    public function test_password_reset_requires_matching_confirmed_password(): void
    {
        $this->postJson('/auth/reset-password', [
            'token' => 'invalid-token',
            'email' => 'resident@example.com',
            'password' => 'new-secure-password',
            'password_confirmation' => 'different-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }
}
