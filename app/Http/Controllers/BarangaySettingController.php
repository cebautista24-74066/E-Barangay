<?php

namespace App\Http\Controllers;

use App\Models\BarangaySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BarangaySettingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);
        return response()->json(['pickup_window_days' => (int) (BarangaySetting::where('key', 'pickup_window_days')->value('value') ?: 3)]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);
        $data = Validator::make($request->all(), ['pickup_window_days' => ['required', 'integer', 'min:1', 'max:30']])->validate();
        $setting = BarangaySetting::updateOrCreate(['key' => 'pickup_window_days'], ['value' => (string) $data['pickup_window_days']]);
        return response()->json(['pickup_window_days' => (int) $setting->value]);
    }
}
