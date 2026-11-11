<?php

namespace App\Http\Middleware;

use App\Services\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditAdminActions
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $user = $request->user();
        $method = strtoupper($request->method());
        $isMutation = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        $isDetailedRequestStatus = $request->is('api/requests/*/status');

        if ($user?->role === 'Administrator' && $isMutation && !$isDetailedRequestStatus && $response->getStatusCode() < 400) {
            [$action, $module, $description] = $this->describe($request, $method);
            AuditLogger::record($request, $action, $module, $description, [
                'new_values' => ['request_path' => $request->path(), 'status_code' => $response->getStatusCode()],
            ]);
        }

        return $response;
    }

    private function describe(Request $request, string $method): array
    {
        $path = trim($request->path(), '/');
        $id = '[0-9]+';
        $rules = [
            ['#^api/residents$#', 'residents', 'resident_created', 'Resident account created'],
            ['#^api/residents/'.$id.'$#', 'residents', 'resident_updated', 'Resident account updated'],
            ['#^api/admin/users/admin$#', 'administrators', 'administrator_created', 'Administrator account created'],
            ['#^api/admin/users/admins/'.$id.'/status$#', 'administrators', 'administrator_status_changed', 'Administrator account status changed'],
            ['#^api/admin/users/admins/'.$id.'$#', 'administrators', 'administrator_deleted', 'Administrator account deleted'],
            ['#^api/announcements$#', 'announcements', null, ''],
            ['#^api/announcements/'.$id.'$#', 'announcements', null, ''],
            ['#^api/services$#', 'services', null, ''],
            ['#^api/services/'.$id.'/status$#', 'services', 'service_status_changed', 'Barangay service status changed'],
            ['#^api/services/'.$id.'/template$#', 'services', 'service_template_updated', 'Barangay service document template updated'],
            ['#^api/services/'.$id.'$#', 'services', null, ''],
            ['#^api/feedback/'.$id.'$#', 'feedback', 'feedback_updated', 'Resident feedback status updated'],
            ['#^api/admin/drrm/households$#', 'drrm', 'household_created', 'DRRM household created'],
            ['#^api/admin/drrm/households/'.$id.'$#', 'drrm', null, ''],
            ['#^api/admin/drrm/evacuation-centers$#', 'drrm', 'evacuation_center_created', 'DRRM evacuation center created'],
            ['#^api/admin/drrm/evacuation-centers/'.$id.'$#', 'drrm', null, ''],
            ['#^api/profile$#', 'profile', 'profile_updated', 'Administrator profile updated'],
            ['#^api/profile/password$#', 'profile', 'password_changed', 'Administrator password changed'],
        ];

        foreach ($rules as [$pattern, $module, $action, $description]) {
            if (preg_match($pattern, $path)) {
                if ($description !== '') {
                    return [$action, $module, $description];
                }

                $noun = match ($module) {
                    'announcements' => 'Announcement',
                    'services' => 'Barangay service',
                    'drrm' => str_contains($path, 'evacuation-centers') ? 'DRRM evacuation center' : 'DRRM household',
                    default => ucfirst($module),
                };
                $verb = match ($method) {
                    'POST' => 'created',
                    'PUT', 'PATCH' => 'updated',
                    'DELETE' => 'deleted',
                    default => 'changed',
                };
                return [strtolower($verb), $module, $noun.' '.$verb];
            }
        }

        return [strtolower($method), 'system', 'Administrator action completed: '.$method.' '.$path];
    }
}