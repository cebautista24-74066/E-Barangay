<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    protected $fillable = [
        'created_by',
        'title',
        'body',
        'category',
        'is_published',
        'published_at',
        'event_date',
        'event_time',
        'event_location',
        'event_organizer',
        'event_contact',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'published_at' => 'datetime',
            'event_date' => 'date:Y-m-d',
            'event_time' => 'string',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
