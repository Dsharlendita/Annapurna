<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    protected $fillable = [
        'booking_id',
        'sale_id',
        'user_id',
        'product_ids',
        'customer_name',
        'customer_email',
        'customer_label',
        'avatar',
        'rating',
        'comment',
        'reply',
        'reply_at',
        'replied_by',
        'is_featured',
        'is_visible',
        'featured_order',
        'seen_at',
    ];

    protected function casts(): array
    {
        return [
            'product_ids' => 'array',
            'rating' => 'integer',
            'is_featured' => 'boolean',
            'is_visible' => 'boolean',
            'featured_order' => 'integer',
            'reply_at' => 'datetime',
            'seen_at' => 'datetime',
        ];
    }

    /** Ulasan yang menyebut produk tertentu. */
    public function scopeForProduct(Builder $q, string $productId): Builder
    {
        return $q->whereJsonContains('product_ids', $productId);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replied_by');
    }
}
