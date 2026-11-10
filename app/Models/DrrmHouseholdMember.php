<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DrrmHouseholdMember extends Model
{
    protected $table = 'drrm_household_members';
    protected $fillable = ['household_id', 'name', 'age', 'is_senior', 'is_pwd', 'is_bedridden', 'is_pregnant', 'has_infant', 'needs_transport', 'medical_needs'];
    protected $casts = ['is_senior' => 'boolean', 'is_pwd' => 'boolean', 'is_bedridden' => 'boolean', 'is_pregnant' => 'boolean', 'has_infant' => 'boolean', 'needs_transport' => 'boolean'];
    public function household(): BelongsTo { return $this->belongsTo(DrrmHousehold::class, 'household_id'); }
    public function priorityScore(): int
    {
        return ($this->is_bedridden ? 5 : 0) + ($this->is_pwd ? 4 : 0) + ($this->is_senior ? 3 : 0) + ($this->is_pregnant ? 3 : 0) + ($this->has_infant ? 2 : 0) + ($this->needs_transport ? 2 : 0);
    }
}