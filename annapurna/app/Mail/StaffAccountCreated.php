<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Dikirim otomatis saat Owner menambahkan staff.
 * $temporaryPassword = kata sandi yang dibuat Owner, tercantum di email (null = "diberikan langsung oleh Owner").
 * $mustChange = staff wajib membuat kata sandi baru saat pertama login (label "sementara" & langkahnya ikut menyesuaikan).
 * Contoh: Mail::to($staff)->send(new StaffAccountCreated($staff, $owner, 'rahasia123', true));
 */
class StaffAccountCreated extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $staff, public User $owner, public ?string $temporaryPassword = null, public bool $mustChange = true) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Anda telah ditambahkan sebagai Staff Annapurna Adventure Shop');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.staff-account-created', text: 'emails.text.staff-account-created', with: ['loginUrl' => route('masuk')]);
    }
}
