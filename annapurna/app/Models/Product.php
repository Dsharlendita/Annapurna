<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    /** Harga modal tidak ikut terkirim ke publik (JSON); staff membacanya lewat atribut langsung. */
    protected $hidden = ['cost_price'];

    protected $fillable = [
        'id',
        'name',
        'category_id',
        'brand',
        'sku',
        'img',
        'rent_price',
        'rent_price_3',
        'rent_price_5',
        'sale_price',
        'cost_price',
        'stock',
        'rating',
        'reviews_count',
        'condition',
        'badge',
        'is_featured',
        'is_active',
        'sort_order',
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
        'deposit',
        'min_stock',
        'service_every',
        'wash',
    ];

    protected function casts(): array
    {
        return [
            'rent_price' => 'integer',
            'rent_price_3' => 'integer',
            'rent_price_5' => 'integer',
            'sale_price' => 'integer',
            'stock' => 'integer',
            'rating' => 'float',
            'reviews_count' => 'integer',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'min_days' => 'integer',
            'has_variant' => 'boolean',
            'cost_price' => 'integer',
            'specs' => 'array',
            'attrs' => 'array',
            'variant_data' => 'array',
            'deposit' => 'integer',
            'min_stock' => 'integer',
            'service_every' => 'integer',
            'wash' => 'boolean',
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

    public function restocks(): HasMany
    {
        return $this->hasMany(Restock::class, 'product_id', 'id');
    }

    /** Ulasan tampil yang menyebut produk ini (satu ulasan bisa untuk beberapa produk). */
    public function reviewList()
    {
        return Review::forProduct($this->id)->where('is_visible', true)->latest()->get();
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
