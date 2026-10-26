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
}
