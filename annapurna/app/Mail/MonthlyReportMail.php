<?php

namespace App\Mail;

use App\Models\ReportArchive;
use App\Support\Rekap;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Ringkasan rekap bulanan + link folder Google Drive, dikirim ke Owner (dan CC). */
class MonthlyReportMail extends Mailable
{
    public function __construct(public ReportArchive $archive) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Rekap Laporan Annapurna Adventure – ' . Rekap::monthName($this->archive->period));
    }

    public function content(): Content
    {
        return new Content(view: 'emails.monthly-report', with: [
            'month' => Rekap::monthName($this->archive->period),
            's' => $this->archive->summary ?: [],
            'panelUrl' => url('owner/integrasi?folder=' . $this->archive->period),
        ]);
    }
}
