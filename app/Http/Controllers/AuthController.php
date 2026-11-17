<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
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
            'password' => [
                'required',
                'string',
                'confirmed',
                PasswordRule::min(8)->mixedCase()->numbers(),
            'proof_image' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            ],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please check the information you entered.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $proofPath = $request->file('proof_image')->store('resident-verification', 'local');
        $user = new User([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'is_active' => false,
            'verification_status' => 'pending',
            'verification_proof_path' => $proofPath,
        ]);
        $user->role = 'Resident';
        $user->save();

        return response()->json([
            'message' => 'Your account application was submitted and is pending admin approval.',
            'csrf_token' => csrf_token(),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        // Normalize pasted/user-entered email addresses before validation.
        $request->merge([
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

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

        $account = User::where('email', $credentials['email'])->first();
        if ($account && $account->verification_status === 'pending') {
            return response()->json(['message' => 'Your account is still pending admin approval.'], 403);
        }
        if ($account && $account->verification_status === 'rejected') {
            return response()->json([
                'message' => 'Your account application was rejected.',
                'rejection_reason' => $account->verification_rejection_reason,
            ], 403);
        }

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

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
        ])->validate();
        $user->update(['name' => trim($data['name']), 'email' => strtolower(trim($data['email']))]);
        return response()->json(['message' => 'Profile updated.', 'user' => $this->userPayload($user->fresh()), 'csrf_token' => csrf_token()]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ])->validate();
        abort_unless(Hash::check($data['current_password'], $request->user()->password), 422, 'The current password is incorrect.');
        $request->user()->update(['password' => $data['password']]);
        Auth::logoutOtherDevices($data['password']);
        $request->session()->regenerate();
        return response()->json(['message' => 'Password changed successfully.']);
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
            'verification_status' => $user->verification_status,
        ];
    }
}
