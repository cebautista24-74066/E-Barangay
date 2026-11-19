<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use App\Models\Announcement;
use App\Models\BarangayService;
use App\Models\ServiceRequest;
use App\Models\BarangaySetting;

class AskBotController extends Controller
{
    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            'history' => ['sometimes', 'array', 'max:10'],
        ]);

        $apiKey = config('services.gemini.key');
        if (!$apiKey) {
            return response()->json(['message' => 'AskBot is not configured yet. Please contact the Barangay Office.'], 503);
        }

        $contents = collect($validated['history'] ?? [])
            ->filter(fn ($item) => isset($item['role'], $item['text']) && in_array($item['role'], ['user', 'model'], true))
            ->map(fn ($item) => ['role' => $item['role'], 'parts' => [['text' => substr((string) $item['text'], 0, 1000)]]])
            ->values()->all();
        $contents[] = ['role' => 'user', 'parts' => [['text' => $validated['message']]]];

        $services = BarangayService::where('is_active', true)->orderBy('name')
            ->get(['name', 'description', 'requirements', 'instructions', 'service_fee'])
            ->toArray();
        $announcements = Announcement::where('is_published', true)
            ->where(fn ($query) => $query->whereNull('published_at')->orWhere('published_at', '<=', now()))
            ->latest('published_at')->latest('id')->limit(5)
            ->get(['title', 'body', 'category', 'published_at'])->toArray();
        $residentRequests = [];
        if (Auth::check() && Auth::user()->role === 'Resident') {
            $residentRequests = ServiceRequest::where('user_id', Auth::id())
                ->with('service:id,name')->latest()->limit(5)
                ->get(['reference_code', 'barangay_service_id', 'purpose', 'status', 'admin_note', 'created_at'])
                ->map(fn ($request) => [
                    'reference_code' => $request->reference_code,
                    'service' => $request->service?->name,
                    'purpose' => $request->purpose,
                    'status' => $request->status,
                    'admin_note' => $request->admin_note,
                    'submitted_at' => $request->created_at?->toDateString(),
                ])->values()->all();
        }
        $pickupWindowDays = (int) (BarangaySetting::where('key', 'pickup_window_days')->value('value') ?: 3);
        $officeHours = $this->formatOfficeHoursForBot((string) (BarangaySetting::where('key', 'office_hours')->value('value') ?: ''));
        $systemInstruction = 'You are BarangayBot for E-Barangay Humayingan. Answer in clear, friendly English or Taglish. '
            . 'The system context is loaded from the current website database for every question, so treat it as the latest official information. '
            . 'Always write office hours using 12-hour time with AM/PM, never military time. Group Monday through Friday when their schedule is the same, then list Saturday and Sunday separately. '
            . 'Understand common typos, misspellings, abbreviations, short phrases, informal English, Tagalog, and Taglish. '
            . 'Infer the user\'s likely intent from context; for example, "req clear", "clearance kailangan", and "what do I need for clearance" '
            . 'all refer to service requirements. Do not reject a question just because its grammar is incomplete. '
            . 'If the intent is reasonably clear, answer directly. Ask one short clarification question only when multiple interpretations are genuinely possible. '
            . 'When the user asks for requirements, answer directly with '
            . '"Here are the requirements for [service name]:" followed by the requirements only. Do not add the procedure or fee unless asked. '
            . 'Never invent requirements, fees, schedules, announcements, '
            . 'or request statuses. Only discuss resident_requests for the currently authenticated resident. '
            . 'If the answer is not in the context, say the information is unavailable and direct the user to the Barangay Office. '
            . 'Never ask for passwords, one-time codes, or unnecessary sensitive personal data. Keep answers concise but complete; '
            . 'Do not use Markdown, asterisks, hashtags, or code formatting. Use plain text and hyphen bullets only.\n\nSYSTEM CONTEXT:\n'
            . json_encode([
                'account_creation' => [
                    'steps' => [
                        'Click Create an account on the landing page.',
                        'Enter your full name and email address.',
                        'Create a password with at least 8 characters, including uppercase, lowercase, and a number.',
                        'Confirm the password.',
                        'Upload a JPEG or PNG government ID or proof of residency, up to 5 MB.',
                        'Submit the application and wait for administrator approval before logging in.',
                    ],
                    'approval_note' => 'New resident accounts are reviewed and approved by the Barangay Office.',
                ],
                'website_features' => [
                    'landing_page' => 'Public visitors can view the BarangayBot, log in, create an account, or start a password reset.',
                    'resident_dashboard' => [
                        'E-Services' => 'View active barangay services, official requirements, procedures, and fees, then submit a request.',
                        'My Requests' => 'Track the resident\'s own service requests using the reference code and status.',
                        'Notifications' => 'Read updates about the resident\'s requests and mark notifications as read.',
                        'Complaints & Feedback' => 'Submit a complaint, concern, suggestion, or other feedback and monitor its status.',
                        'Announcements' => 'Read published barangay news and public notices.',
                        'Community Events' => 'View published barangay events, schedules, locations, and related details.',
                        'My Profile' => 'Update account information and change the account password.',
                    ],
                    'request_statuses' => [
                        'Pending' => 'The request was submitted and is waiting for review.',
                        'Processing' => 'The Barangay Office is reviewing or preparing the request.',
                        'Ready for Pickup' => 'The document or service is ready for pickup.',
                        'Claimed' => 'The resident has claimed the completed request.',
                        'Expired' => 'The pickup deadline passed before the request was claimed.',
                        'Rejected' => 'The request was not approved; check the office note or contact the Barangay Office.',
                    ],
                    'important_rules' => [
                        'Only active and published services and announcements are shown to residents.',
                        'A resident can view only their own request status and personal records.',
                        'The BarangayBot cannot approve requests, change statuses, issue documents, or confirm policies outside the system data.',
                    ],
                ],
                'active_services' => $services,
                'published_announcements' => $announcements,
                'system_settings' => [
                    'pickup_window_days' => $pickupWindowDays,
                    'office_hours' => $officeHours,
                ],
                'resident_requests' => $residentRequests,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $payload = [
                'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
                'contents' => $contents,
                'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 350],
        ];

        // Try the current model first so a stale cached GEMINI_MODEL cannot break the landing-page bot.
        $models = array_values(array_unique([
            'gemini-3.5-flash-lite',
            (string) config('services.gemini.model'),
        ]));
        $response = null;
        foreach ($models as $model) {
            $candidate = Http::connectTimeout(5)
                ->timeout(20)
                ->retry(1, 250)
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->post('https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent', $payload);
            if ($candidate->successful()) {
                $response = $candidate;
                break;
            }
            report($candidate->toException());
        }

        if (!$response) {
            return response()->json(['message' => 'I cannot reach the AI service right now. Please try again later.'], 502);
        }

        $text = collect(data_get($response->json(), 'candidates.0.content.parts', []))
            ->pluck('text')
            ->filter()
            ->implode("\n");
        return response()->json(['reply' => $text ?: 'I could not generate an answer. Please contact the Barangay Office.']);
    }

    private function formatOfficeHoursForBot(string $value): string
    {
        $schedule = [];
        foreach (preg_split('/\r?\n/', $value) as $line) {
            if (!preg_match('/^([^:]+):\s*(.+)$/', trim($line), $match)) continue;
            $schedule[trim($match[1])] = trim($match[2]);
        }

        $format = function (string $time): string {
            $parsed = \DateTime::createFromFormat('H:i', $time);
            return $parsed ? $parsed->format('g:i A') : $time;
        };
        $convert = function (?string $hours) use ($format): string {
            if (!$hours || strtolower($hours) === 'closed') return 'Closed';
            if (preg_match('/(\d{2}:\d{2}).*?(\d{2}:\d{2})/', $hours, $match)) {
                return $format($match[1]) . '–' . $format($match[2]);
            }
            return $hours;
        };

        $monFri = array_map(fn ($day) => $convert($schedule[$day] ?? null), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        $lines = [];
        if (count(array_unique($monFri)) === 1) $lines[] = 'Monday–Friday: ' . $monFri[0];
        else foreach (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as $day) $lines[] = $day . ': ' . $convert($schedule[$day] ?? null);
        $lines[] = 'Saturday: ' . $convert($schedule['Saturday'] ?? null);
        $lines[] = 'Sunday: ' . $convert($schedule['Sunday'] ?? null);
        return implode("\n", $lines);
    }
}
