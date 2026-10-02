<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Dikirim otomatis saat Owner menambahkan staff.
 * Contoh: Mail::to($staff)->queue(new StaffAccountCreated($staff, $owner, $passwordSementara));
 */
class StaffAccountCreated extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $staff, public User $owner, public string $temporaryPassword) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Anda telah ditambahkan sebagai Staff Annapurna Adventure Shop');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.staff-account-created', with: ['loginUrl' => route('masuk')]);
    }
}
