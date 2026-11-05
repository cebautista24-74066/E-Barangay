<?php

namespace App\Http\Controllers;

use App\Models\ResidentFeedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ResidentFeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ResidentFeedback::query()->with('resident:id,name,email');

        if ($request->user()->role !== 'Administrator') {
            $query->where('user_id', $request->user()->id);
        }

        return response()->json(['feedback' => $query->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'type' => ['required', 'in:Complaint,Suggestion,Feedback'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ])->validate();

        $feedback = ResidentFeedback::create([
            ...$data,
            'user_id' => $request->user()->id,
        ]);

        return response()->json([
            'feedback' => $feedback,
            'message' => 'Your message was sent to the barangay office.',
        ], 201);
    }

    public function update(Request $request, ResidentFeedback $feedback): JsonResponse
    {
        abort_unless($request->user()->role === 'Administrator', 403);

        $data = Validator::make($request->all(), [
            'status' => ['required', 'in:Open,In Review,Resolved,Closed'],
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        $feedback->update($data);

        return response()->json(['feedback' => $feedback->fresh(['resident:id,name,email'])]);
    }
}
