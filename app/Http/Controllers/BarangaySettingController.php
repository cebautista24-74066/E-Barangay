<?php

namespace App\Http\Controllers;

use App\Models\BarangaySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BarangaySettingController extends Controller
{
    public function publicContact(): JsonResponse
    {
        return response()->json([
            'phone' => (string) (BarangaySetting::where('key', 'contact_phone')->value('value') ?: ''),
            'email' => (string) (BarangaySetting::where('key', 'contact_email')->value('value') ?: ''),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);
        return response()->json([
            'pickup_window_days' => (int) (BarangaySetting::where('key', 'pickup_window_days')->value('value') ?: 3),
            'office_hours' => (string) (BarangaySetting::where('key', 'office_hours')->value('value') ?: ''),
            'contact_phone' => (string) (BarangaySetting::where('key', 'contact_phone')->value('value') ?: ''),
            'contact_email' => (string) (BarangaySetting::where('key', 'contact_email')->value('value') ?: ''),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);
        $data = Validator::make($request->all(), [
            'pickup_window_days' => ['required', 'integer', 'min:1', 'max:30'],
            'office_hours' => ['nullable', 'string', 'max:1000'],
            'contact_phone' => ['nullable', 'string', 'max:100'],
            'contact_email' => ['nullable', 'email', 'max:255'],
        ])->validate();
        $setting = BarangaySetting::updateOrCreate(['key' => 'pickup_window_days'], ['value' => (string) $data['pickup_window_days']]);
        BarangaySetting::updateOrCreate(['key' => 'office_hours'], ['value' => trim((string) ($data['office_hours'] ?? ''))]);
        BarangaySetting::updateOrCreate(['key' => 'contact_phone'], ['value' => trim((string) ($data['contact_phone'] ?? ''))]);
        BarangaySetting::updateOrCreate(['key' => 'contact_email'], ['value' => trim((string) ($data['contact_email'] ?? ''))]);
        return response()->json([
            'pickup_window_days' => (int) $setting->value,
            'office_hours' => trim((string) ($data['office_hours'] ?? '')),
            'contact_phone' => trim((string) ($data['contact_phone'] ?? '')),
            'contact_email' => trim((string) ($data['contact_email'] ?? '')),
        ]);
    }
}
