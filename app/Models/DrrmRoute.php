<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrrmRoute extends Model
{
    protected $table = 'drrm_routes';
    protected $fillable = ['name', 'route_type', 'geometry', 'notes', 'is_active'];
    protected $casts = ['geometry' => 'array', 'is_active' => 'boolean'];
}
