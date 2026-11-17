<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AnnouncementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Announcement::query()->with('author:id,name');

        if ($request->user()->role !== 'Administrator') {
            $query->where('is_published', true)
                ->where(function ($query) {
                    $query->whereNull('published_at')
                        ->orWhere('published_at', '<=', now());
                });
        }

        return response()->json([
            'announcements' => $query->latest('published_at')->latest('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdministrator($request);

        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $data['published_at'] = $data['is_published'] ? ($data['published_at'] ?? now()) : null;

        $announcement = Announcement::create($data);

        return response()->json(['announcement' => $announcement], 201);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $this->authorizeAdministrator($request);

        $data = $this->validated($request);
        $data['published_at'] = $data['is_published']
            ? ($data['published_at'] ?? $announcement->published_at ?? now())
            : null;

        $announcement->update($data);

        return response()->json(['announcement' => $announcement->fresh()]);
    }

    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $this->authorizeAdministrator($request);
        $announcement->delete();

        return response()->json(['message' => 'Announcement deleted.']);
    }

    private function validated(Request $request): array
    {
        return Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:10000'],
            'category' => ['required', 'in:General,Community,System,Event'],
            'is_published' => ['required', 'boolean'],
            'published_at' => ['nullable', 'date'],
            'event_date' => ['nullable', 'date'],
            'event_time' => ['nullable', 'date_format:H:i'],
            'event_location' => ['nullable', 'string', 'max:255'],
            'event_organizer' => ['nullable', 'string', 'max:255'],
            'event_contact' => ['nullable', 'string', 'max:255'],
        ])->validate();
    }

    private function authorizeAdministrator(Request $request): void
    {
        abort_unless($request->user()->role === 'Administrator', 403);
    }
}
