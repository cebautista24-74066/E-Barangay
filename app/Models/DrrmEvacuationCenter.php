<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrrmEvacuationCenter extends Model
{
    protected $table = 'drrm_evacuation_centers';
    protected $fillable = ['name', 'address', 'latitude', 'longitude', 'capacity', 'current_occupants', 'status', 'is_active'];
    protected $casts = ['latitude' => 'float', 'longitude' => 'float', 'is_active' => 'boolean'];
}