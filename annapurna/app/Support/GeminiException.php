<?php

namespace App\Support;

use RuntimeException;

/** Gagal memanggil Gemini. $status = kode HTTP yang dikirim ke tampilan (503 / 429 / 502). */
class GeminiException extends RuntimeException
{
    public function __construct(string $message, public int $status = 502)
    {
        parent::__construct($message);
    }
}
