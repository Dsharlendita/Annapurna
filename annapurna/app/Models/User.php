<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'address',
        'role',
        'status',
        'must_change_password',
        'created_by',
        'last_login_at',
        'last_logout_at',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'last_login_at' => 'datetime',
            'last_logout_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    /** Owner atau Admin/Staff: aktivitasnya dicatat di histori sistem. */
    public function isStaff(): bool
    {
        return in_array($this->role, ['owner', 'admin'], true);
    }

    public function isActive(): bool
    {
        return $this->status !== 'nonaktif';
    }
}
