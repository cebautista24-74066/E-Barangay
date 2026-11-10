<?php

namespace App\Http\Controllers;

use App\Models\BarangayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BarangayServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = BarangayService::query()->withCount('requests')->orderBy('name');

        if ($request->user()->role !== 'Administrator') {
            $query->where('is_active', true);
        }

        return response()->json(['services' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);

        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $service = BarangayService::create($data);

        return response()->json(['service' => $service], 201);
    }

    public function update(Request $request, BarangayService $service): JsonResponse
    {
        $this->authorizeAdministrator($request);
        $service->update($this->validated($request));

        return response()->json(['service' => $service->fresh()]);
    }

        public function toggleStatus(Request $request, BarangayService $service): JsonResponse
    {
        $this->authorizeAdministrator($request);
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $service->update(['is_active' => $data['is_active']]);

        return response()->json(['service' => $service->fresh()]);
    }
public function destroy(Request $request, BarangayService $service): JsonResponse
    {
        $this->authorizeAdministrator($request);

        if ($service->requests()->exists()) {
            return response()->json([
                'message' => 'This service has request history. Deactivate it instead of deleting it.',
            ], 422);
        }

        $service->delete();

        return response()->json(['message' => 'Service deleted.']);
    }

    private function validated(Request $request): array
    {
        return Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:2000'],
            'requirements' => ['nullable', 'string', 'max:5000'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['required', 'boolean'],
        ])->validate();
    }

    private function authorizeAdministrator(Request $request): void
    {
        abort_unless($request->user()->role === 'Administrator', 403);
    }
}
