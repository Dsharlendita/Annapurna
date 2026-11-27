<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Dikirim otomatis saat Owner mereset kata sandi staf.
 */
class StaffPasswordReset extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $staff,
        public User $owner,
        public ?string $temporaryPassword = null, // kata sandi baru yang tercantum di email (null = tidak dicantumkan)
        public bool $mustChange = true
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Kata sandi sementara akun Staff Annapurna Adventure'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.staff-password-reset',
            text: 'emails.text.staff-password-reset',
            with: [
                'loginUrl' => route('masuk'),
            ]
        );
    }
}
