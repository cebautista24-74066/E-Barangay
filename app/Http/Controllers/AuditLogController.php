<?php
namespace App\Http\Controllers;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class AuditLogController extends Controller {
    public function index(Request $request): JsonResponse {
        $isAdmin = $request->user()->role === 'Administrator';
        $data=$request->validate(['from'=>['nullable','date'],'to'=>['nullable','date'],'user_id'=>['nullable','integer'],'action'=>['nullable','string','max:80'],'module'=>['nullable','string','max:80'],'page'=>['nullable','integer','min:1']]);
        $query=AuditLog::with('user:id,name,email,role')->latest();
        if (!$isAdmin) $query->where('user_id', $request->user()->id);
        if(!empty($data['from'])) $query->where('created_at','>=',$data['from'].' 00:00:00');
        if(!empty($data['to'])) $query->where('created_at','<=',$data['to'].' 23:59:59');
        if ($isAdmin) foreach(['user_id','action','module'] as $field) if(!empty($data[$field])) $query->where($field,$data[$field]);
        return response()->json(['logs'=>$query->paginate(25)->withQueryString(),'users'=>$isAdmin ? User::select('id','name')->orderBy('name')->get() : collect([$request->user()->only(['id','name'])]),'modules'=>AuditLog::distinct()->orderBy('module')->pluck('module'),'actions'=>AuditLog::distinct()->orderBy('action')->pluck('action')]);
    }
}