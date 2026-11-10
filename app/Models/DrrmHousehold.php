<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DrrmHousehold extends Model
{
    protected $table = 'drrm_households';
    protected $fillable = ['household_number', 'location_type', 'address', 'sitio', 'landmark', 'purok', 'resident_count', 'senior_count', 'pwd_count', 'bedridden_count', 'pregnant_count', 'infant_count', 'transport_assistance_count', 'latitude', 'longitude', 'priority_level', 'is_active', 'notes'];
    protected $casts = ['latitude' => 'float', 'longitude' => 'float'];

    public function members(): HasMany { return $this->hasMany(DrrmHouseholdMember::class, 'household_id'); }
    public function recalculatePriority(): void
    {
        $score = ($this->senior_count * 3) + ($this->pwd_count * 4) + ($this->bedridden_count * 5) + ($this->pregnant_count * 3) + ($this->infant_count * 2) + ($this->transport_assistance_count * 2);
        if ($score === 0) { $score = $this->members->sum(fn ($member) => $member->priorityScore()); }
        $this->priority_level = $score >= 8 ? 'Critical' : ($score >= 5 ? 'High' : ($score >= 2 ? 'Moderate' : 'Low'));
        $this->save();
    }
}