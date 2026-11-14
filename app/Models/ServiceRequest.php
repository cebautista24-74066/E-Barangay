<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceRequest extends Model
{
    public const STATUSES = ['Pending', 'Processing', 'Ready for Pickup', 'Claimed', 'Expired', 'Rejected'];

    protected $fillable = [
        'reference_code',
        'user_id',
        'barangay_service_id',
        'purpose',
        'status',
        'admin_note',
        'ready_for_pickup_at',
        'pickup_deadline',
        'archived_at',
        'archived_by',
        'archive_reason',
    ];

    protected $casts = [
        'ready_for_pickup_at' => 'datetime',
        'pickup_deadline' => 'datetime',
        'archived_at' => 'datetime',
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

    public function archivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by');
    }
}
