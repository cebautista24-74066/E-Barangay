<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->merge([
            'name' => trim((string) $request->input('name')),
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please check the information you entered.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = new User($validator->validated());
        $user->role = 'Resident';
        $user->save();
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Your resident account has been created.',
            'user' => $this->userPayload($user),
            'csrf_token' => csrf_token(),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please enter a valid email address and password.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $credentials = $validator->validated();
        $credentials['email'] = strtolower(trim($credentials['email']));

        if (! Auth::attempt([
            'email' => $credentials['email'],
            'password' => $credentials['password'],
        ], $credentials['remember'] ?? false)) {
            return response()->json([
                'message' => 'The email address or password is incorrect.',
                'errors' => ['email' => ['The email address or password is incorrect.']],
            ], 422);
        }

        if (! $request->user()->is_active) {
            Auth::logout();

            return response()->json([
                'message' => 'This account is inactive. Please contact the barangay office for assistance.',
            ], 403);
        }

        $request->session()->regenerate();

        return response()->json([
            'message' => 'You are now logged in.',
            'user' => $this->userPayload($request->user()),
            'csrf_token' => csrf_token(),
        ]);
    }

    public function sendPasswordResetLink(Request $request): JsonResponse
    {
        $request->merge([
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

        $validator = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please enter a valid email address.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            Password::sendResetLink($validator->validated());
        } catch (TransportExceptionInterface $exception) {
            Log::error('Password reset email delivery failed.', [
                'email' => hash('sha256', $validator->validated()['email']),
                'exception' => $exception,
            ]);

            return response()->json([
                'message' => 'We could not send the reset email. Please check the email delivery settings and try again.',
            ], 503);
        }

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->merge([
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

        $validator = Validator::make($request->all(), [
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please check the information you entered.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $credentials = $validator->validated();
        $status = Password::reset(
            $credentials,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();
            }
        );

        if ($status === Password::RESET_THROTTLED) {
            return response()->json([
                'message' => 'Please wait before trying to reset your password again.',
            ], 429);
        }

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'This password reset link is invalid or has expired. Request a new one.',
            ], 422);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Your password has been reset. Log in using your new password.',
            'csrf_token' => csrf_token(),
        ]);
    }

    public function session(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()
                ? $this->userPayload($request->user())
                : null,
        ]);
    }

    public function residents(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);

        return response()->json([
            'residents' => User::query()
                ->where('role', 'Resident')
                ->orderBy('id')
                ->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'You have been logged out.',
            'csrf_token' => csrf_token(),
        ]);
    }

    /**
     * @return array{name: string, email: string, role: string}
     */
    private function userPayload(User $user): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ];
    }
}
