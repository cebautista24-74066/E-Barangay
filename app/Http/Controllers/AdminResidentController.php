<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
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

    private function authorizeAdministrator(Request $request): void
    {
        abort_unless($request->user()->role === 'Administrator', 403);
    }
}
