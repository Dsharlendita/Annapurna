<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Package extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'tagline',
        'img',
        'price_per_day',
        'price_3',
        'price_5',
        'people',
        'people_min',
        'people_max',
        'type',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_per_day' => 'integer',
            'price_3' => 'integer',
            'price_5' => 'integer',
            'people_min' => 'integer',
            'people_max' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PackageItem::class, 'package_id', 'id');
    }
}
