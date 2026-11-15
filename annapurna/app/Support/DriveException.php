<?php

namespace App\Support;

use RuntimeException;

/** Kegagalan Google Drive dengan pesan yang siap ditampilkan ke Owner. */
class DriveException extends RuntimeException
{
    /** @param bool $reconnect true bila Owner perlu menghubungkan ulang Google Drive */
    public function __construct(string $message, public bool $reconnect = false)
    {
        parent::__construct($message);
    }
}
