<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceRequest extends Model
{
    public const STATUSES = ['Pending', 'Processing', 'Approved', 'Rejected', 'Completed'];

    protected $fillable = [
        'reference_code',
        'user_id',
        'barangay_service_id',
        'purpose',
        'status',
        'admin_note',
    ];

    public function resident(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(BarangayService::class, 'barangay_service_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(ServiceRequestFile::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ServiceRequestStatusHistory::class)->latest();
    }
}
