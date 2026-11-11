<?php

namespace App\Http\Controllers;

use App\Models\DrrmEvacuationCenter;
use App\Models\DrrmHousehold;
use App\Models\DrrmRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class DrrmController extends Controller
{
    private function admin(Request $request): void { abort_unless($request->user()->role === 'Administrator', 403); }

    public function index(Request $request): JsonResponse
    {
        $this->admin($request);
        Log::info('DRRM map viewed', ['user_id' => $request->user()->id]);
        return response()->json([
            'households' => DrrmHousehold::where('is_active', true)->with('members')->orderBy('household_number')->get(),
            'evacuation_centers' => DrrmEvacuationCenter::where('is_active', true)->orderBy('name')->get(),
            'routes' => DrrmRoute::where('is_active', true)->orderBy('name')->get(),
            'summary' => [
                'total_households' => DrrmHousehold::where('is_active', true)->count(),
                'total_vulnerable_residents' => DrrmHousehold::where('is_active', true)->sum('senior_count') + DrrmHousehold::where('is_active', true)->sum('pwd_count') + DrrmHousehold::where('is_active', true)->sum('bedridden_count') + DrrmHousehold::where('is_active', true)->sum('pregnant_count') + DrrmHousehold::where('is_active', true)->sum('infant_count'),
                'critical' => DrrmHousehold::where('priority_level', 'Critical')->count(),
                'high' => DrrmHousehold::where('priority_level', 'High')->count(),
                'moderate' => DrrmHousehold::where('priority_level', 'Moderate')->count(),
                'low' => DrrmHousehold::where('priority_level', 'Low')->count(),
                'evacuation_centers' => DrrmEvacuationCenter::where('is_active', true)->count(),
                'evacuation_capacity' => DrrmEvacuationCenter::where('is_active', true)->sum('capacity'),
                'evacuation_occupied' => DrrmEvacuationCenter::where('is_active', true)->sum('current_occupants'),
            ],
        ]);
    }

    public function storeHousehold(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = Validator::make($request->all(), [
            'household_number' => ['required', 'string', 'max:50', 'unique:drrm_households,household_number'],
            'address' => ['required', 'string', 'max:255'], 'sitio' => ['nullable', 'string', 'max:100'], 'landmark' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:2000'], 'resident_count' => ['required', 'integer', 'min:0'], 'senior_count' => ['nullable', 'integer', 'min:0'], 'pwd_count' => ['nullable', 'integer', 'min:0'], 'bedridden_count' => ['nullable', 'integer', 'min:0'], 'pregnant_count' => ['nullable', 'integer', 'min:0'], 'infant_count' => ['nullable', 'integer', 'min:0'], 'transport_assistance_count' => ['nullable', 'integer', 'min:0'], 'members' => ['array'],
            'members.*.name' => ['required', 'string', 'max:255'], 'members.*.age' => ['nullable', 'integer', 'min:0', 'max:130'],
            'members.*.is_senior' => ['boolean'], 'members.*.is_pwd' => ['boolean'], 'members.*.is_bedridden' => ['boolean'],
            'members.*.is_pregnant' => ['boolean'], 'members.*.has_infant' => ['boolean'], 'members.*.needs_transport' => ['boolean'],
            'members.*.medical_needs' => ['nullable', 'string', 'max:1000'],
        ])->validate();
        $data['location_type'] = 'House';
        $household = DB::transaction(function () use ($data) {
            $household = DrrmHousehold::create(collect($data)->except('members')->all());
            $household->members()->createMany($data['members'] ?? []);
            $household->load('members'); $household->recalculatePriority(); return $household->fresh('members');
        });
        return response()->json(['household' => $household], 201);
    }

public function storeCenter(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['name' => ['required','string','max:255'], 'address' => ['required','string','max:255'], 'latitude' => ['required','numeric','between:-90,90'], 'longitude' => ['required','numeric','between:-180,180'], 'capacity' => ['nullable','integer','min:1'], 'current_occupants' => ['nullable','integer','min:0'], 'status' => ['nullable','in:Open,Full,Temporarily Closed']]);
        return response()->json(['evacuation_center' => DrrmEvacuationCenter::create($data)], 201);
    }

    public function updateHousehold(Request $request, DrrmHousehold $household): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['address' => ['required','string','max:255'], 'sitio' => ['nullable','string','max:100'], 'landmark' => ['nullable','string','max:255'], 'latitude' => ['required','numeric','between:-90,90'], 'longitude' => ['required','numeric','between:-180,180'], 'notes' => ['nullable','string','max:2000'], 'resident_count' => ['required','integer','min:0'], 'senior_count' => ['nullable','integer','min:0'], 'pwd_count' => ['nullable','integer','min:0'], 'bedridden_count' => ['nullable','integer','min:0'], 'pregnant_count' => ['nullable','integer','min:0'], 'infant_count' => ['nullable','integer','min:0'], 'transport_assistance_count' => ['nullable','integer','min:0']]);
        $household->update($data);
        $household->recalculatePriority();
        return response()->json(['household' => $household->fresh('members')]);
    }

    public function destroyHousehold(Request $request, DrrmHousehold $household): JsonResponse { $this->admin($request); $household->delete(); Log::info('DRRM household permanently deleted', ['user_id' => $request->user()->id, 'household_id' => $household->id]); return response()->json(['message' => 'Household deleted.']); }

    public function updateCenter(Request $request, DrrmEvacuationCenter $center): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['name' => ['required','string','max:255'], 'address' => ['required','string','max:255'], 'latitude' => ['required','numeric','between:-90,90'], 'longitude' => ['required','numeric','between:-180,180'], 'capacity' => ['nullable','integer','min:1'], 'current_occupants' => ['nullable','integer','min:0'], 'status' => ['required','in:Open,Full,Temporarily Closed']]);
        $center->update($data);
        return response()->json(['evacuation_center' => $center]);
    }

    public function destroyCenter(Request $request, DrrmEvacuationCenter $center): JsonResponse { $this->admin($request); $center->delete(); Log::info('DRRM evacuation center permanently deleted', ['user_id' => $request->user()->id, 'center_id' => $center->id]); return response()->json(['message' => 'Evacuation center deleted.']); }

    public function storeRoute(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['name' => ['required','string','max:255'], 'route_type' => ['required','in:Evacuation Route,Access Route'], 'notes' => ['nullable','string','max:2000'], 'geometry' => ['required','array'], 'geometry.type' => ['required','in:LineString'], 'geometry.coordinates' => ['required','array','min:2']]);
        return response()->json(['route' => DrrmRoute::create($data)], 201);
    }
}
