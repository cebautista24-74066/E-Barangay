<?php

use App\Http\Controllers\AdminResidentController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\DrrmController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BarangayServiceController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ResidentFeedbackController;
use App\Http\Controllers\ServiceRequestController;
use App\Http\Controllers\BarangaySettingController;
use App\Http\Middleware\EnsureActiveAccount;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('bis.index');
});

Route::middleware('throttle:6,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register'])->name('auth.register');
    Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
    Route::post('/auth/forgot-password', [AuthController::class, 'sendPasswordResetLink'])->name('password.email');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->name('password.update');
});

Route::get('/password/reset/{token}', function () {
    return view('bis.index');
})->middleware('guest')->name('password.reset');

Route::get('/auth/session', [AuthController::class, 'session'])
    ->middleware(EnsureActiveAccount::class)
    ->name('auth.session');
Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
Route::middleware(['auth', EnsureActiveAccount::class, 'admin.audit'])->group(function () {
    Route::patch('/api/profile', [AuthController::class, 'updateProfile']);
    Route::post('/api/profile/password', [AuthController::class, 'changePassword']);
});
Route::middleware(['auth', EnsureActiveAccount::class])
    ->get('/admin/residents', [AuthController::class, 'residents'])
    ->name('admin.residents');

Route::middleware(['auth', EnsureActiveAccount::class, 'admin.audit'])->group(function () {
    Route::get('/api/residents', [AdminResidentController::class, 'index']);
    Route::post('/api/residents', [AdminResidentController::class, 'store']);
    Route::patch('/api/residents/{user}', [AdminResidentController::class, 'update']);
    Route::delete('/api/residents/{user}', [AdminResidentController::class, 'destroy']);
    Route::get('/api/admin/users/admins', [AdminResidentController::class, 'admins']);
    Route::get('/api/admin/settings', [BarangaySettingController::class, 'show']);
    Route::patch('/api/admin/settings', [BarangaySettingController::class, 'update']);
    Route::post('/api/admin/users/admin', [AdminResidentController::class, 'storeAdmin']);
    Route::patch('/api/admin/users/admins/{user}/status', [AdminResidentController::class, 'toggleAdminStatus']);
    Route::delete('/api/admin/users/admins/{user}', [AdminResidentController::class, 'destroyAdmin']);

    Route::get('/api/announcements', [AnnouncementController::class, 'index']);
    Route::post('/api/announcements', [AnnouncementController::class, 'store']);
    Route::put('/api/announcements/{announcement}', [AnnouncementController::class, 'update']);
    Route::delete('/api/announcements/{announcement}', [AnnouncementController::class, 'destroy']);

    Route::get('/api/services', [BarangayServiceController::class, 'index']);
    Route::post('/api/services', [BarangayServiceController::class, 'store']);
    Route::put('/api/services/{service}', [BarangayServiceController::class, 'update']);
    Route::patch('/api/services/{service}/status', [BarangayServiceController::class, 'toggleStatus']);
    Route::patch('/api/services/{service}/template', [BarangayServiceController::class, 'updateTemplate']);
    Route::delete('/api/services/{service}', [BarangayServiceController::class, 'destroy']);

    Route::get('/api/requests', [ServiceRequestController::class, 'index']);
    Route::post('/api/requests', [ServiceRequestController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/api/requests/{serviceRequest}', [ServiceRequestController::class, 'show']);
    Route::patch('/api/requests/{serviceRequest}/status', [ServiceRequestController::class, 'updateStatus']);
    Route::patch('/api/requests/{serviceRequest}/claim', [ServiceRequestController::class, 'claim']);
    Route::patch('/api/requests/{serviceRequest}/archive', [ServiceRequestController::class, 'archive']);
    Route::patch('/api/requests/{serviceRequest}/restore', [ServiceRequestController::class, 'restore']);
    Route::get('/api/request-files/{file}', [ServiceRequestController::class, 'downloadFile']);

    Route::get('/api/feedback', [ResidentFeedbackController::class, 'index']);
    Route::post('/api/feedback', [ResidentFeedbackController::class, 'store'])->middleware('throttle:10,1');
    Route::patch('/api/feedback/{feedback}', [ResidentFeedbackController::class, 'update']);

    Route::get('/api/notifications', [NotificationController::class, 'index']);
    Route::patch('/api/notifications/{notificationId}/read', [NotificationController::class, 'markRead']);

    Route::get('/api/admin/reports', [ReportController::class, 'index']);
    Route::get('/api/admin/reports/requests.csv', [ReportController::class, 'exportRequests']);
    Route::get('/api/admin/audit-logs', [AuditLogController::class, 'index']);

    Route::get('/api/admin/drrm', [DrrmController::class, 'index']);
    Route::post('/api/admin/drrm/households', [DrrmController::class, 'storeHousehold']);
    Route::post('/api/admin/drrm/evacuation-centers', [DrrmController::class, 'storeCenter']);
    Route::patch('/api/admin/drrm/households/{household}', [DrrmController::class, 'updateHousehold']);
    Route::delete('/api/admin/drrm/households/{household}', [DrrmController::class, 'destroyHousehold']);
    Route::patch('/api/admin/drrm/evacuation-centers/{center}', [DrrmController::class, 'updateCenter']);
    Route::delete('/api/admin/drrm/evacuation-centers/{center}', [DrrmController::class, 'destroyCenter']);
});
