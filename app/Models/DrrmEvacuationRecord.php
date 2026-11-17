<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrrmEvacuationRecord extends Model
{
    protected $table = 'drrm_evacuation_records';
    protected $fillable = ['evacuation_center_id', 'household_id', 'status', 'member_count', 'male_count', 'female_count', 'senior_count', 'pwd_count', 'special_needs_count', 'notes', 'checked_in_at', 'checked_out_at'];
    protected $casts = ['checked_in_at' => 'datetime', 'checked_out_at' => 'datetime'];
    public function center() { return $this->belongsTo(DrrmEvacuationCenter::class, 'evacuation_center_id'); }
    public function household() { return $this->belongsTo(DrrmHousehold::class); }
}
