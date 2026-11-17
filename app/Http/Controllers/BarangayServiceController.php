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

        public function updateTemplate(Request $request, BarangayService $service): JsonResponse
    {
        $this->authorizeAdministrator($request);
        $data = $request->validate([
            'template_title' => ['required', 'string', 'max:255'],
            'template_body' => ['required', 'string', 'max:10000'],
            'template_footer' => ['nullable', 'string', 'max:2000'],
            'template_signature_name' => ['nullable', 'string', 'max:255'],
            'template_signature_position' => ['nullable', 'string', 'max:255'],
            'template_primary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_layout' => ['nullable', 'array', 'max:30'],
            'template_layout.*.type' => ['required_with:template_layout', 'string', 'in:text,logo,lian_logo,resident_name,service_name,reference_code,approved_date,purpose,signature,qr'],
            'template_layout.*.x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'template_layout.*.y' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'template_layout.*.text' => ['nullable', 'string', 'max:1000'],
        ]);
        $service->update($data);
        return response()->json(['service' => $service->fresh(), 'message' => 'Document template saved.']);
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

        $service->update(['is_active' => false]);

        return response()->json(['message' => 'Service archived. Existing requests were preserved.', 'service' => $service->fresh()]);
    }

    private function validated(Request $request): array
    {
        return Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:2000'],
            'service_fee' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
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
