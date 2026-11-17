<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DrrmEvacuationCenter extends Model
{
    protected $table = 'drrm_evacuation_centers';
    protected $fillable = ['name', 'address', 'latitude', 'longitude', 'capacity', 'current_occupants', 'status', 'is_active'];
    protected $casts = ['latitude' => 'float', 'longitude' => 'float', 'is_active' => 'boolean'];
    protected $appends = ['available_capacity'];
    public function getAvailableCapacityAttribute(): ?int
    {
        return $this->capacity === null ? null : max(0, (int) $this->capacity - (int) $this->current_occupants);
    }
    public function occupancyRecords(): HasMany { return $this->hasMany(DrrmEvacuationRecord::class, 'evacuation_center_id'); }
}
