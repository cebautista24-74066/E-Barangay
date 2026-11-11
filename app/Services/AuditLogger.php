<?php
namespace App\Services;
use App\Models\AuditLog;
use Illuminate\Http\Request;
class AuditLogger {
    public static function record(Request $request, string $action, string $module, string $description, array $data = [], string $status = 'success'): AuditLog {
        $subject = $data['subject'] ?? null; unset($data['subject']);
        return AuditLog::create(['user_id'=>$request->user()?->id,'action'=>$action,'module'=>$module,'description'=>$description,'subject_type'=>$subject ? $subject::class : null,'subject_id'=>$subject?->getKey(),'old_values'=>$data['old_values'] ?? null,'new_values'=>$data['new_values'] ?? null,'ip_address'=>$request->ip(),'user_agent'=>substr((string)$request->userAgent(),0,1000),'status'=>$status]);
    }
}
