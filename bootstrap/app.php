<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin.audit' => App\Http\Middleware\AuditAdminActions::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->withSchedule(function (Schedule $schedule): void {
        $schedule->call(function (): void {
            \App\Models\ServiceRequest::where('status', 'Ready for Pickup')->whereNotNull('pickup_deadline')->where('pickup_deadline', '<', now())->update(['status' => 'Expired']);
        })->daily();
    })->create();
