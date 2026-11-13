<?php

namespace App\Support;

use App\Models\Category;
use App\Models\CustomerFlag;
use App\Models\Finance;
use App\Models\Package;
use App\Models\Product;
use App\Models\Promo;
use App\Models\Review;
use App\Models\Setting;
use App\Models\UserNotification;
use Illuminate\Support\Str;

/**
 * Penerjemah bentuk data antara database dan tampilan (public/assets/js/data.js).
 *
 *   toFe…()   baris database  → objek yang dipakai tampilan (nama kolom camelCase versi FE)
 *   fromFe…() objek tampilan  → atribut kolom database
 *
 * Dipakai oleh BootController (kirim data ke browser) dan SyncController (terima perubahan).
 */
class FeData
{
    /** Pengaturan yang hanya boleh dilihat Owner (alamat email laporan, folder Drive, dll.). */
    public const PRIVATE_SETTINGS = ['integration'];

    /** Pengaturan yang boleh diubah Admin (profil toko & rekening). Sisanya hanya Owner. */
    public const ADMIN_SETTINGS = ['storeName', 'hours', 'phone', 'whatsapp', 'email', 'instagram', 'tiktok', 'address', 'banks'];

    private static function date($d): ?string
    {
        return $d ? substr((string) $d, 0, 10) : null;
    }

    private static function stamp($dt): ?string
    {
        return $dt ? $dt->copy()->timezone(config('app.timezone'))->format('Y-m-d\TH:i:s') : null;
    }

    /** Hapus nilai null supaya nilai bawaan di tampilan tetap dipakai. */
    private static function clean(array $a): array
    {
        return array_filter($a, fn ($v) => $v !== null);
    }

    // ------------------------------------------------------------------ Pengaturan

    /** Semua pengaturan dalam bentuk { camelCase: nilai }. */
    public static function settings(bool $withPrivate): array
    {
        $out = [];
        foreach (Setting::all() as $s) {
            $key = Str::camel($s->key);
            if (! $withPrivate && in_array($key, self::PRIVATE_SETTINGS, true)) {
                continue;
            }
            $v = json_decode($s->value, true);
            $out[$key] = json_last_error() === JSON_ERROR_NONE ? $v : $s->value;
        }

        return $out;
    }

    // ------------------------------------------------------------------ Katalog

    public static function toFeCategory(Category $c): array
    {
        return ['id' => $c->id, 'name' => $c->name, 'img' => $c->img ?? '', 'active' => (bool) $c->is_active];
    }

    public static function fromFeCategory(array $x): array
    {
        return ['id' => $x['id'], 'name' => $x['name'] ?? $x['id'], 'img' => $x['img'] ?? null, 'is_active' => ($x['active'] ?? true) !== false];
    }

    public static function toFeProduct(Product $p, bool $withCost): array
    {
        $variant = $p->variant_data ?: null;

        return self::clean([
            'id' => $p->id,
            'name' => $p->name,
            'cat' => $p->category_id,
            'img' => $p->img ?? '',
            'rent' => (int) $p->rent_price,
            'rent3' => (int) $p->rent_price_3,
            'rent5' => (int) $p->rent_price_5,
            'price' => (int) $p->sale_price,
            'cost' => $withCost && $p->cost_price !== null ? (int) $p->cost_price : null,
            'stock' => (int) $p->stock,
            'rating' => (float) $p->rating,
            'reviews' => (int) $p->reviews_count,
            'cond' => $p->condition,
            'badge' => $p->badge ?? '',
            'featured' => (bool) $p->is_featured,
            'active' => (bool) $p->is_active,
            'minDays' => (int) $p->min_days,
            'brand' => $p->brand,
            'sku' => $p->sku,
            'color' => $p->color,
            'material' => $p->material,
            'weight' => $p->weight,
            'dimension' => $p->dimension,
            'includes' => $p->includes,
            'desc' => $p->description,
            'specs' => $p->specs ?: [],
            'attrs' => $p->attrs ?: (object) [],
            'variant' => $variant,
            'deposit' => (int) $p->deposit,
            'minStock' => $p->min_stock,
            'serviceEvery' => $p->service_every,
            'wash' => $p->wash,
        ]);
    }

    public static function fromFeProduct(array $x): array
    {
        $variant = ! empty($x['variant']['options']) ? $x['variant'] : null;
        $int = fn ($k) => isset($x[$k]) && $x[$k] !== '' ? max(0, (int) $x[$k]) : null;

        return [
            'id' => $x['id'],
            'name' => $x['name'] ?? $x['id'],
            'category_id' => $x['cat'],
            'img' => $x['img'] ?? null,
            'rent_price' => $int('rent') ?? 0,
            'rent_price_3' => $int('rent3'),
            'rent_price_5' => $int('rent5'),
            'sale_price' => $int('price'),
            'cost_price' => $int('cost'),
            'stock' => $int('stock') ?? 0,
            'condition' => $x['cond'] ?? 'Sangat Baik',
            'badge' => $x['badge'] ?? null,
            'is_featured' => ! empty($x['featured']),
            'is_active' => ($x['active'] ?? true) !== false,
            'min_days' => max(1, (int) ($x['minDays'] ?? 1)),
            'brand' => $x['brand'] ?? null,
            'sku' => $x['sku'] ?? null,
            'color' => $x['color'] ?? null,
            'material' => $x['material'] ?? null,
            'weight' => $x['weight'] ?? null,
            'dimension' => $x['dimension'] ?? null,
            'includes' => $x['includes'] ?? null,
            'description' => $x['desc'] ?? null,
            'specs' => array_values((array) ($x['specs'] ?? [])),
            'attrs' => (array) ($x['attrs'] ?? []),
            'has_variant' => $variant !== null,
            'variant_data' => $variant,
            'deposit' => $int('deposit') ?? 0,
            'min_stock' => $int('minStock'),
            'service_every' => $int('serviceEvery'),
            'wash' => array_key_exists('wash', $x) && $x['wash'] !== null ? (bool) $x['wash'] : null,
        ];
    }

    public static function toFePackage(Package $k): array
    {
        return self::clean([
            'id' => $k->id,
            'name' => $k->name,
            'tagline' => $k->tagline ?? '',
            'img' => $k->img ?? '',
            'price' => (int) $k->price_per_day,
            'price3' => (int) $k->price_3,
            'price5' => (int) $k->price_5,
            'people' => $k->people,
            'pMin' => $k->people_min,
            'pMax' => $k->people_max,
            'type' => $k->type,
            'popular' => (bool) $k->is_popular,
            'active' => (bool) $k->is_active,
            'items' => $k->items->map(fn ($i) => ['productId' => $i->product_id, 'qty' => (int) $i->qty])->values()->all(),
        ]);
    }

    // ------------------------------------------------------------------ Promo

    public static function toFePromo(Promo $p): array
    {
        return [
            'id' => 'PR-' . $p->id,
            'code' => $p->code,
            'name' => $p->name ?? $p->code,
            'desc' => $p->description ?? '',
            'type' => $p->discount_type,
            'value' => (int) $p->discount_value,
            'applies' => $p->applies_to,
            'minTotal' => (int) $p->min_order,
            'start' => self::date($p->valid_from) ?? self::date($p->created_at),
            'end' => self::date($p->valid_until) ?? '2099-12-31',
            'weekday' => (bool) $p->weekday_only,
            'quota' => (int) $p->quota,
            'used' => (int) $p->used_count,
            'active' => (bool) $p->is_active,
            'home' => (bool) $p->show_on_home,
        ];
    }

    /** Jumlah pemakaian (used) tidak diterima dari tampilan: dihitung server saat booking dibuat. */
    public static function fromFePromo(array $x): array
    {
        return [
            'code' => strtoupper(preg_replace('/\s+/', '', (string) $x['code'])),
            'name' => $x['name'] ?? null,
            'description' => $x['desc'] ?? null,
            'discount_type' => ($x['type'] ?? 'persen') === 'nominal' ? 'nominal' : 'persen',
            'discount_value' => max(0, (int) ($x['value'] ?? 0)),
            'applies_to' => in_array($x['applies'] ?? 'rent', ['rent', 'buy', 'all'], true) ? $x['applies'] : 'rent',
            'min_order' => max(0, (int) ($x['minTotal'] ?? 0)),
            'valid_from' => $x['start'] ?? null,
            'valid_until' => $x['end'] ?? null,
            'weekday_only' => ! empty($x['weekday']),
            'quota' => max(0, (int) ($x['quota'] ?? 0)),
            'show_on_home' => ! empty($x['home']),
            'is_active' => ($x['active'] ?? true) !== false,
        ];
    }

    // ------------------------------------------------------------------ Ulasan

    public static function toFeReview(Review $r): array
    {
        $ref = $r->booking?->booking_code ?? $r->sale?->sale_code ?? '';

        return self::clean([
            'id' => 'REV-' . $r->id,
            'refId' => $ref,
            'type' => $r->sale_id ? 'buy' : 'rent',
            'name' => $r->customer_name,
            'email' => $r->customer_email ?? '',
            'role' => $r->customer_label ?? '',
            'img' => $r->avatar ?? '',
            'rating' => (int) $r->rating,
            'text' => $r->comment,
            'productIds' => $r->product_ids ?: [],
            'createdAt' => self::stamp($r->created_at),
            'updatedAt' => self::stamp($r->updated_at),
            'visible' => (bool) $r->is_visible,
            'featured' => (bool) $r->is_featured,
            'order' => $r->is_featured ? (int) $r->featured_order : null,
            'reply' => $r->reply ?? '',
            'replyAt' => self::stamp($r->reply_at),
            'seen' => $r->seen_at !== null,
        ]);
    }

    // ------------------------------------------------------------------ Keuangan manual

    /** Baris finances (source = manual) → { id, date, category, desc, amount, line, status, … } */
    public static function toFeFinance(Finance $f): array
    {
        return self::clean([
            'id' => $f->finance_code,
            'date' => self::date($f->transaction_date),
            'category' => $f->category,
            'desc' => $f->description,
            'amount' => (int) $f->amount,
            'line' => $f->line,
            'ref' => $f->ref,
            'status' => $f->status,
            'by' => $f->creator?->name,
            'at' => self::stamp($f->created_at),
            'voidReason' => $f->void_reason,
            'voidAt' => self::stamp($f->voided_at),
            'voidBy' => $f->voider?->name,
        ]);
    }

    // ------------------------------------------------------------------ Notifikasi & pelanggan

    public static function toFeNotification(UserNotification $n, string $email): array
    {
        return self::clean([
            'id' => 'N' . $n->id,
            'email' => $email,
            'at' => self::stamp($n->updated_at),
            'title' => $n->title,
            'text' => $n->body,
            'link' => $n->link ?? '',
            'read' => $n->read_at !== null,
            'count' => $n->count > 1 ? $n->count : null,
        ]);
    }

    /** { email: { flag, note } } — sama dengan kunci customerMeta di tampilan. */
    public static function customerMeta(): array
    {
        $out = [];
        foreach (CustomerFlag::all() as $f) {
            $out[strtolower($f->email)] = ['flag' => $f->flag, 'note' => $f->note ?? ''];
        }

        return $out;
    }
}
