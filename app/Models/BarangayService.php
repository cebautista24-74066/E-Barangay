<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BarangayService extends Model
{
    protected $fillable = [
        'created_by',
        'name',
        'description',
        'requirements',
        'instructions',
        'is_active',
        'template_title',
        'template_body',
        'template_footer',
        'template_signature_name',
        'template_signature_position',
        'template_primary_color',
        'template_layout',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'template_layout' => 'array'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class);
    }
}
