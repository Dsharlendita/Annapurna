<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMiss extends Model
{
    protected $fillable = [
        'question_norm',
        'question_text',
        'count',
        'first_at',
        'last_at',
        'dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'count' => 'integer',
            'first_at' => 'datetime',
            'last_at' => 'datetime',
            'dismissed_at' => 'datetime',
        ];
    }

    /** Catat pertanyaan yang belum bisa dijawab chatbot (digabung per teks yang sama). Yang sudah diabaikan Owner tetap tersembunyi. */
    public static function record(string $raw): ?self
    {
        $raw = trim($raw);
        $norm = trim(preg_replace('/\s+/', ' ', strtolower(preg_replace('/[^a-z0-9 ]+/i', ' ', $raw))));
        $norm = substr($norm, 0, 255);
        if (strlen($norm) < 3) {
            return null;
        }
        $miss = static::where('question_norm', $norm)->first();
        if ($miss) {
            $miss->update(['count' => $miss->count + 1, 'last_at' => now()]);

            return $miss;
        }

        return static::create(['question_norm' => $norm, 'question_text' => mb_substr($raw, 0, 255), 'count' => 1, 'first_at' => now(), 'last_at' => now()]);
    }
}
