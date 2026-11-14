<?php

namespace App\Http\Controllers;

use App\Models\BarangayService;
use App\Models\ResidentFeedback;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);

        return response()->json([
            'total_residents' => User::query()->where('role', 'Resident')->count(),
            'total_services' => BarangayService::query()->where('is_active', true)->count(),
            'total_requests' => ServiceRequest::query()->count(),
            'expiring_soon' => ServiceRequest::query()->where('status', 'Ready for Pickup')->whereBetween('pickup_deadline', [now(), now()->addDays(3)])->count(),
            'requests_by_status' => ServiceRequest::query()
                ->selectRaw('status, count(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
            'feedback_by_status' => ResidentFeedback::query()
                ->selectRaw('status, count(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
            'requests_by_service' => ServiceRequest::query()
                ->join('barangay_services', 'service_requests.barangay_service_id', '=', 'barangay_services.id')
                ->selectRaw('barangay_services.name as service, count(*) as total')
                ->groupBy('barangay_services.id', 'barangay_services.name')
                ->orderBy('barangay_services.name')
                ->get(),
        ]);
    }

    public function exportRequests(Request $request): StreamedResponse
    {
        $this->authorizeAdministrator($request);

        return response()->streamDownload(function (): void {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['Reference', 'Resident', 'Email', 'Service', 'Purpose', 'Status', 'Submitted At', 'Ready for Pickup', 'Pickup Deadline', 'Archived At', 'Admin Note']);

            ServiceRequest::query()
                ->with(['resident:id,name,email', 'service:id,name'])
                ->orderBy('created_at')
                ->chunk(500, function ($requests) use ($output): void {
                    foreach ($requests as $serviceRequest) {
                        fputcsv($output, [
                            $this->spreadsheetSafe($serviceRequest->reference_code),
                            $this->spreadsheetSafe($serviceRequest->resident->name),
                            $this->spreadsheetSafe($serviceRequest->resident->email),
                            $this->spreadsheetSafe($serviceRequest->service->name),
                            $this->spreadsheetSafe($serviceRequest->purpose),
                            $this->spreadsheetSafe($serviceRequest->status),
                            $this->spreadsheetSafe($serviceRequest->created_at?->toDateTimeString()),
                            $this->spreadsheetSafe($serviceRequest->ready_for_pickup_at?->toDateTimeString()),
                            $this->spreadsheetSafe($serviceRequest->pickup_deadline?->toDateTimeString()),
                            $this->spreadsheetSafe($serviceRequest->archived_at?->toDateTimeString()),
                            $this->spreadsheetSafe($serviceRequest->admin_note),
                        ]);
                    }
                });

            fclose($output);
        }, 'barangay-service-requests.csv', ['Content-Type' => 'text/csv']);
    }

    private function authorizeAdministrator(Request $request): void
    {
        abort_unless($request->user()->role === 'Administrator', 403);
    }

    private function spreadsheetSafe(?string $value): string
    {
        $value ??= '';

        return preg_match('/^[\t\r ]*[=+\-@]/', $value) === 1
            ? "'".$value
            : $value;
    }
}
