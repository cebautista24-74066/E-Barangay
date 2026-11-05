<?php

namespace App\Notifications;

use App\Models\ServiceRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ServiceRequestStatusChanged extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ServiceRequest $serviceRequest,
        private readonly ?string $note,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('Barangay request status update')
            ->greeting('Hello '.$notifiable->name.',')
            ->line("Your request {$this->serviceRequest->reference_code} is now {$this->serviceRequest->status}.");

        if ($this->note) {
            $mail->line('Staff note: '.$this->note);
        }

        return $mail->line('Log in to the Barangay Information System to view your request history.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->serviceRequest->id,
            'reference_code' => $this->serviceRequest->reference_code,
            'status' => $this->serviceRequest->status,
            'note' => $this->note,
            'message' => "Your request {$this->serviceRequest->reference_code} is now {$this->serviceRequest->status}.",
        ];
    }
}
