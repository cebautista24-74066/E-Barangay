<?php

namespace App\Notifications;

use App\Models\ResidentFeedback;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResidentFeedbackStatusChanged extends Notification
{
    use Queueable;

    public function __construct(private readonly ResidentFeedback $feedback) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('Barangay complaint or feedback update')
            ->greeting('Hello '.$notifiable->name.',')
            ->line("Your {$this->feedback->type} titled \"{$this->feedback->subject}\" is now {$this->feedback->status}.");

        if ($this->feedback->admin_note) {
            $mail->line('Staff note: '.$this->feedback->admin_note);
        }

        return $mail->line('Log in to the Barangay Information System to view the full update.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'feedback_id' => $this->feedback->id,
            'type' => $this->feedback->type,
            'subject' => $this->feedback->subject,
            'status' => $this->feedback->status,
            'admin_note' => $this->feedback->admin_note,
            'message' => "Your {$this->feedback->type} is now {$this->feedback->status}.",
        ];
    }
}
