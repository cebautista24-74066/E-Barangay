<?php

namespace App\Http\Controllers;

use App\Models\DrrmEvacuationCenter;
use App\Models\DrrmHousehold;
use App\Models\DrrmRoute;
use App\Models\DrrmEvacuationRecord;
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
            'evacuation_centers' => DrrmEvacuationCenter::where('is_active', true)->with(['occupancyRecords' => fn ($q) => $q->where('status', 'Checked In')->with('household')])->orderBy('name')->get(),
            'occupancy_history' => DB::table('drrm_occupancy_history')->latest('recorded_at')->limit(100)->get(),
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
        $data['current_occupants'] = (int) ($data['current_occupants'] ?? 0);
        if ($data['capacity'] !== null && $data['current_occupants'] > $data['capacity']) abort(422, 'Current occupants cannot exceed capacity.');
        $data['status'] = ($data['capacity'] !== null && $data['current_occupants'] >= $data['capacity']) ? 'Full' : ($data['status'] ?? 'Open');
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

    public function destroyHousehold(Request $request, DrrmHousehold $household): JsonResponse
    {
        $this->admin($request);
        $householdId = $household->id;
        DB::transaction(function () use ($householdId, $household) {
            $records = DrrmEvacuationRecord::where('household_id', $householdId)->lockForUpdate()->get();
            foreach ($records->where('status', 'Checked In') as $record) {
                $center = DrrmEvacuationCenter::whereKey($record->evacuation_center_id)->lockForUpdate()->first();
                if ($center) {
                    $center->current_occupants = max(0, (int) $center->current_occupants - (int) $record->member_count);
                    $center->status = $center->capacity !== null && $center->current_occupants >= $center->capacity ? 'Full' : 'Open';
                    $center->save();
                }
            }
            DrrmEvacuationRecord::where('household_id', $householdId)->delete();
            $household->delete();
        });
        Log::info('DRRM household permanently deleted', ['user_id' => $request->user()->id, 'household_id' => $householdId]);
        return response()->json(['message' => 'Household deleted.']);
    }

    public function updateCenter(Request $request, DrrmEvacuationCenter $center): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['name' => ['required','string','max:255'], 'address' => ['required','string','max:255'], 'latitude' => ['required','numeric','between:-90,90'], 'longitude' => ['required','numeric','between:-180,180'], 'capacity' => ['nullable','integer','min:1'], 'status' => ['required','in:Open,Full,Temporarily Closed']]);
        if ($data['capacity'] !== null && (int) $center->current_occupants > $data['capacity']) abort(422, 'Capacity cannot be lower than current occupants.');
        if ($data['capacity'] !== null && (int) $center->current_occupants >= $data['capacity']) $data['status'] = 'Full';
        $center->update($data);
        return response()->json(['evacuation_center' => $center]);
    }

    public function checkInHousehold(Request $request, DrrmEvacuationCenter $center): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['household_id' => ['required','exists:drrm_households,id'], 'member_count' => ['required','integer','min:1'], 'male_count' => ['nullable','integer','min:0'], 'female_count' => ['nullable','integer','min:0'], 'senior_count' => ['nullable','integer','min:0'], 'pwd_count' => ['nullable','integer','min:0'], 'special_needs_count' => ['nullable','integer','min:0'], 'notes' => ['nullable','string','max:2000']]);
        return DB::transaction(function () use ($request, $center, $data) {
            $center = DrrmEvacuationCenter::whereKey($center->id)->lockForUpdate()->firstOrFail();
            if (DrrmEvacuationRecord::where('household_id', $data['household_id'])->where('status', 'Checked In')->exists()) abort(422, 'This household is already checked in.');
            if ($center->capacity !== null && $center->current_occupants + $data['member_count'] > $center->capacity) abort(422, 'Not enough available capacity.');
            $record = DrrmEvacuationRecord::create([...$data, 'evacuation_center_id' => $center->id, 'status' => 'Checked In', 'checked_in_at' => now()]);
            $center->increment('current_occupants', $data['member_count']);
            $center->refresh()->update(['status' => $center->capacity !== null && $center->current_occupants >= $center->capacity ? 'Full' : 'Open']);
            DB::table('drrm_occupancy_history')->insert(['evacuation_center_id' => $center->id, 'evacuation_record_id' => $record->id, 'action' => 'Check In', 'occupant_count' => $center->current_occupants, 'available_capacity' => $center->available_capacity, 'recorded_by' => $request->user()->id, 'recorded_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            return response()->json(['record' => $record->load('household'), 'evacuation_center' => $center]);
        });
    }

    public function checkOutHousehold(Request $request, DrrmEvacuationRecord $record): JsonResponse
    {
        $this->admin($request);
        return DB::transaction(function () use ($request, $record) {
            $record = DrrmEvacuationRecord::whereKey($record->id)->lockForUpdate()->firstOrFail();
            if ($record->status !== 'Checked In') abort(422, 'This household is already checked out.');
            $center = DrrmEvacuationCenter::whereKey($record->evacuation_center_id)->lockForUpdate()->firstOrFail();
            $record->update(['status' => 'Checked Out', 'checked_out_at' => now()]);
            $center->decrement('current_occupants', $record->member_count);
            $center->refresh()->update(['status' => $center->status === 'Temporarily Closed' ? $center->status : 'Open']);
            DB::table('drrm_occupancy_history')->insert(['evacuation_center_id' => $center->id, 'evacuation_record_id' => $record->id, 'action' => 'Check Out', 'occupant_count' => $center->current_occupants, 'available_capacity' => $center->available_capacity, 'recorded_by' => $request->user()->id, 'recorded_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            return response()->json(['record' => $record, 'evacuation_center' => $center]);
        });
    }

    public function destroyCenter(Request $request, DrrmEvacuationCenter $center): JsonResponse { $this->admin($request); $center->delete(); Log::info('DRRM evacuation center permanently deleted', ['user_id' => $request->user()->id, 'center_id' => $center->id]); return response()->json(['message' => 'Evacuation center deleted.']); }

    public function storeRoute(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['name' => ['required','string','max:255'], 'route_type' => ['required','in:Evacuation Route,Access Route'], 'notes' => ['nullable','string','max:2000'], 'geometry' => ['required','array'], 'geometry.type' => ['required','in:LineString'], 'geometry.coordinates' => ['required','array','min:2']]);
        return response()->json(['route' => DrrmRoute::create($data)], 201);
    }
}
