<?php

namespace App\Http\Controllers;

use App\Models\BarangayService;
use App\Services\AuditLogger;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestFile;
use App\Notifications\ServiceRequestStatusChanged;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class ServiceRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->expireOverdueRequests();
        $query = ServiceRequest::query()
            ->with(['service:id,name', 'resident:id,name,email', 'files:id,service_request_id,original_name,mime_type,size,path', 'statusHistory.changedBy:id,name', 'archivedBy:id,name']);

        if ($request->user()->role !== 'Administrator') {
            $query->where('user_id', $request->user()->id);
            $query->whereNull('archived_at');
        } elseif ($request->input('archive') === 'archived') {
            $query->whereNotNull('archived_at');
        } elseif ($request->input('archive') !== 'all') {
            $query->whereNull('archived_at');
        }
        if ($request->filled('status') && in_array($request->input('status'), ServiceRequest::STATUSES, true)) {
            $query->where('status', $request->input('status'));
        }

        $requests = $query->latest()->get();
        $requests->each(function (ServiceRequest $item): void {
            $item->files->each(function (ServiceRequestFile $file): void {
                if (str_starts_with((string) $file->mime_type, 'image/') && Storage::disk('local')->exists($file->path)) {
                    $file->preview_url = 'data:'.$file->mime_type.';base64,'.base64_encode(Storage::disk('local')->get($file->path));
                }
            });
        });

        return response()->json([
            'requests' => $requests,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'service_id' => ['required', 'integer', 'exists:barangay_services,id'],
            'purpose' => ['required', 'string', 'max:2000'],
            'documents' => ['sometimes', 'array', 'max:5'],
            'documents.*' => ['file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ])->validate();

        $service = BarangayService::query()
            ->whereKey($data['service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $storedPaths = [];

        try {
            $serviceRequest = DB::transaction(function () use ($request, $data, $service, &$storedPaths): ServiceRequest {
                $serviceRequest = ServiceRequest::create([
                    'reference_code' => 'BRG-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
                    'user_id' => $request->user()->id,
                    'barangay_service_id' => $service->id,
                    'purpose' => $data['purpose'],
                    'status' => 'Pending',
                ]);

                foreach ($request->file('documents', []) as $file) {
                    $this->storeDocument($serviceRequest, $file, $storedPaths);
                }

                $serviceRequest->statusHistory()->create([
                    'changed_by' => $request->user()->id,
                    'from_status' => null,
                    'to_status' => 'Pending',
                    'note' => 'Request submitted.',
                ]);

                return $serviceRequest;
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'request' => $this->loadRequest($serviceRequest),
            'message' => 'Your request was submitted successfully.',
        ], 201);
    }

    public function show(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $this->authorizeRequest($request, $serviceRequest);
        $this->expireOverdueRequests($serviceRequest);

        return response()->json(['request' => $this->loadRequest($serviceRequest)]);
    }

    public function updateStatus(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);

        $data = Validator::make($request->all(), [
            'status' => ['required', 'in:'.implode(',', ServiceRequest::STATUSES)],
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        $previousStatus = $serviceRequest->status;
        $allowedTransitions = [
            'Pending' => ['Pending', 'Processing', 'Rejected'],
            'Processing' => ['Processing', 'Ready for Pickup', 'Rejected'],
            'Ready for Pickup' => ['Ready for Pickup', 'Claimed'],
            'Claimed' => ['Claimed'],
            'Expired' => ['Expired'],
            'Rejected' => ['Rejected'],
        ];
        if (! in_array($data['status'], $allowedTransitions[$previousStatus] ?? [$previousStatus], true)) {
            throw ValidationException::withMessages(['status' => "A request marked {$previousStatus} cannot be moved back to {$data['status']}."]);
        }
        $pickupWindowDays = (int) (DB::table('barangay_settings')->where('key', 'pickup_window_days')->value('value') ?: 3);

        DB::transaction(function () use ($request, $serviceRequest, $data, $previousStatus, $pickupWindowDays): void {
            $serviceRequest->update([
                'status' => $data['status'],
                'admin_note' => $data['admin_note'] ?? null,
                'ready_for_pickup_at' => $data['status'] === 'Ready for Pickup' && $previousStatus !== 'Ready for Pickup' ? now() : (in_array($data['status'], ['Ready for Pickup', 'Claimed', 'Expired'], true) ? $serviceRequest->ready_for_pickup_at : null),
                'pickup_deadline' => $data['status'] === 'Ready for Pickup' && $previousStatus !== 'Ready for Pickup' ? now()->addDays($pickupWindowDays)->endOfDay() : (in_array($data['status'], ['Ready for Pickup', 'Claimed', 'Expired'], true) ? $serviceRequest->pickup_deadline : null),
            ]);

            if ($previousStatus !== $data["status"]) {
                $serviceRequest->statusHistory()->create([
                    'changed_by' => $request->user()->id,
                    'from_status' => $previousStatus,
                    'to_status' => $data['status'],
                    'note' => $data['admin_note'] ?? null,
                ]);
            }
        });

            AuditLogger::record(
                $request,
                "status_changed",
                "service_requests",
                "Service request status changed from ".($previousStatus ?: "None")." to ".$data["status"],
                [
                    "subject" => $serviceRequest,
                    "old_values" => ["status" => $previousStatus],
                    "new_values" => [
                        "status" => $data["status"],
                        "admin_note" => $data["admin_note"] ?? null,
                    ],
                ],
            );

            $serviceRequest->resident->notify(new ServiceRequestStatusChanged(
                $serviceRequest->fresh(['service']),
                $data['admin_note'] ?? null,
            ));

        return response()->json([
            'request' => $this->loadRequest($serviceRequest->fresh()),
            'message' => 'Request status updated.',
        ]);
    }

    public function archive(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);
        $data = Validator::make($request->all(), ['reason' => ['nullable', 'string', 'max:2000']])->validate();
        $serviceRequest->update(['archived_at' => now(), 'archived_by' => $request->user()->id, 'archive_reason' => $data['reason'] ?? null]);
        return response()->json(['message' => 'Request archived.']);
    }

    public function restore(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);
        $serviceRequest->update(['archived_at' => null, 'archived_by' => null, 'archive_reason' => null]);
        return response()->json(['message' => 'Request restored.']);
    }

    public function claim(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($request->user()->id === $serviceRequest->user_id, 403);
        $this->expireOverdueRequests($serviceRequest);
        $serviceRequest->refresh();
        abort_unless($serviceRequest->status === 'Ready for Pickup', 422, 'This request is no longer available for claiming.');

        DB::transaction(function () use ($request, $serviceRequest): void {
            $serviceRequest->update(['status' => 'Claimed']);
            $serviceRequest->statusHistory()->create([
                'changed_by' => $request->user()->id,
                'from_status' => 'Ready for Pickup',
                'to_status' => 'Claimed',
                'note' => 'Resident marked the request as claimed.',
            ]);
        });

        return response()->json(['request' => $this->loadRequest($serviceRequest->fresh()), 'message' => 'Request marked as claimed.']);
    }

    public function downloadFile(Request $request, ServiceRequestFile $file): BinaryFileResponse
    {
        $this->authorizeRequest($request, $file->serviceRequest);

        abort_unless(Storage::disk('local')->exists($file->path), 404);

        return response()->file(Storage::disk('local')->path($file->path), ['Content-Disposition' => 'inline']);
    }

    private function storeDocument(ServiceRequest $serviceRequest, UploadedFile $file, array &$storedPaths): void
    {
        $extension = $file->guessExtension() ?: 'bin';
        $path = $file->storeAs(
            'service-requests/'.$serviceRequest->id,
            Str::uuid().'.'.$extension,
            'local',
        );

        if ($path === false) {
            throw new \RuntimeException('Unable to store an uploaded request document.');
        }

        $storedPaths[] = $path;
        $serviceRequest->files()->create([
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'size' => $file->getSize(),
        ]);
    }

    private function loadRequest(ServiceRequest $serviceRequest): ServiceRequest
    {
        $loaded = $serviceRequest->load([
            'service:id,name,requirements,instructions',
            'resident:id,name,email',
            'files:id,service_request_id,original_name,mime_type,size,path',
            'statusHistory.changedBy:id,name',
            'archivedBy:id,name',
        ]);

        $loaded->files->each(function (ServiceRequestFile $file): void {
            if (str_starts_with((string) $file->mime_type, 'image/') && Storage::disk('local')->exists($file->path)) {
                $file->preview_url = 'data:'.$file->mime_type.';base64,'.base64_encode(Storage::disk('local')->get($file->path));
            }
        });

        return $loaded;    }

    private function expireOverdueRequests(?ServiceRequest $only = null): void
    {
        $query = ServiceRequest::query()
            ->where('status', 'Ready for Pickup')
            ->whereNotNull('pickup_deadline')
            ->where('pickup_deadline', '<', now());
        if ($only) $query->whereKey($only->id);
        $query->each(function (ServiceRequest $request): void {
            $request->update(['status' => 'Expired']);
            $request->statusHistory()->create([
                'changed_by' => $request->user_id,
                'from_status' => 'Ready for Pickup',
                'to_status' => 'Expired',
                'note' => 'Pickup deadline passed.',
            ]);
        });
    }

    private function authorizeRequest(Request $request, ServiceRequest $serviceRequest): void
    {
        abort_unless(
            $request->user()->role === 'Administrator'
                || $request->user()->id === $serviceRequest->user_id,
            403,
        );
    }
}
