<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Akun Google Drive yang dihubungkan Owner. Hanya ada satu baris aktif. */
class DriveConnection extends Model
{
    protected $fillable = ['connected_by', 'email', 'refresh_token', 'root_folder_id', 'root_folder_name'];

    protected $hidden = ['refresh_token'];

    protected function casts(): array
    {
        return ['refresh_token' => 'encrypted'];
    }

    public static function current(): ?self
    {
        return static::latest('id')->first();
    }
}
