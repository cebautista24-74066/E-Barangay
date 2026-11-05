<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResidentFeedback extends Model
{
    protected $table = 'resident_feedback';

    protected $fillable = [
        'user_id',
        'type',
        'subject',
        'message',
        'status',
        'admin_note',
    ];

    public function resident(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
