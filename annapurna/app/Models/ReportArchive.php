<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Rekap laporan satu bulan yang sudah tersimpan di Google Drive. */
class ReportArchive extends Model
{
    protected $fillable = [
        'period', 'version', 'is_auto', 'created_by', 'created_by_name', 'drive_folder_id', 'drive_folder_url',
        'path', 'files', 'summary', 'mail_to', 'mail_status', 'mailed_at',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'is_auto' => 'boolean',
            'path' => 'array',
            'files' => 'array',
            'summary' => 'array',
            'mailed_at' => 'datetime',
        ];
    }
}
