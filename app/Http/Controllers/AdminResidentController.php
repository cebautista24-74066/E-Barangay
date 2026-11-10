<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AdminResidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);

        return response()->json([
            'residents' => User::query()
                ->where('role', 'Resident')
                ->orderBy('id')
                ->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);

        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $resident = new User([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password'],
            'is_active' => true,
        ]);
        $resident->role = 'Resident';
        $resident->save();

        return response()->json([
            'resident' => $resident->only(['id', 'name', 'email', 'role', 'is_active']),
        ], 201);
    }
    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdministrator($request);
        abort_unless($user->role === 'Resident', 404);

        $data = Validator::make($request->all(), [
            'is_active' => ['required', 'boolean'],
        ])->validate();

        $user->update($data);

        return response()->json([
            'resident' => $user->fresh()->only(['id', 'name', 'email', 'role', 'is_active']),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdministrator($request);
        abort_unless($user->role === 'Resident', 404);

        try {
            $user->delete();
        } catch (QueryException) {
            return response()->json(['message' => 'This resident has related records. Deactivate the account instead of deleting it.'], 422);
        }

        return response()->json(['message' => 'Resident deleted.']);
    }
    public function admins(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);

        return response()->json([
            'admins' => User::query()
                ->where('role', 'Administrator')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']),
        ]);
    }
    public function storeAdmin(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);
        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $admin = new User([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password'],
            'is_active' => true,
        ]);
        $admin->role = 'Administrator';
        $admin->save();

        return response()->json(['admin' => $admin->only(['id', 'name', 'email', 'role', 'is_active'])], 201);
    }
    public function toggleAdminStatus(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdministrator($request);
        abort_if($request->user()->is($user), 422, 'You cannot deactivate your own administrator account.');
        abort_unless($user->role === 'Administrator', 404);

        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $user->update(['is_active' => $data['is_active']]);

        return response()->json(['admin' => $user->fresh()->only(['id', 'name', 'email', 'role', 'is_active'])]);
    }

    public function destroyAdmin(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdministrator($request);
        abort_if($request->user()->is($user), 422, 'You cannot delete your own administrator account.');
        abort_unless($user->role === 'Administrator', 404);

        try {
            $user->delete();
        } catch (QueryException) {
            return response()->json(['message' => 'This administrator has related records. Deactivate the account instead of deleting it.'], 422);
        }

        return response()->json(['message' => 'Administrator deleted.']);
    }
    private function authorizeAdministrator(Request $request): void
    {
        abort_unless($request->user()->role === 'Administrator', 403);
    }
}
