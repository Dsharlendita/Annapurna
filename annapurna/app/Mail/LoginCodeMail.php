<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Kode verifikasi 6 digit untuk "Masuk dengan kode" / "Lupa kata sandi".
 * Sengaja TIDAK memakai antrean (ShouldQueue): kode harus sampai saat itu juga.
 */
class LoginCodeMail extends Mailable
{
    public function __construct(
        public User $user,
        public string $code,
        public string $purpose,      // login | reset
        public int $minutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->purpose === 'reset'
                ? "{$this->code} adalah kode atur ulang kata sandi Annapurna Adventure"
                : "{$this->code} adalah kode masuk Annapurna Adventure",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.login-code');
    }
}
