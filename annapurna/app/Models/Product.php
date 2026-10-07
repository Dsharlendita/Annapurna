<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'category_id',
        'brand',
        'sku',
        'img',
        'rent_price',
        'sale_price',
        'stock',
        'rating',
        'reviews_count',
        'condition',
        'badge',
        'is_featured',
        'is_active',
        'description',
        'specs',
        'attrs',
        'color',
        'material',
        'weight',
        'dimension',
        'includes',
        'min_days',
        'has_variant',
        'variant_data',
    ];

    protected function casts(): array
    {
        return [
            'rent_price' => 'integer',
            'sale_price' => 'integer',
            'stock' => 'integer',
            'rating' => 'float',
            'reviews_count' => 'integer',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'min_days' => 'integer',
            'has_variant' => 'boolean',
            'specs' => 'array',
            'attrs' => 'array',
            'variant_data' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }

    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class, 'product_id', 'id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class, 'product_id', 'id');
    }

    public function activeUnits(): HasMany
    {
        return $this->units()->where('status', '!=', 'nonaktif');
    }

    public function availableUnits(): HasMany
    {
        return $this->units()->where('status', 'tersedia');
    }
}
