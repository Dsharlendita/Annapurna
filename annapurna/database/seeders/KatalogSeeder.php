<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Category;
use App\Models\Review;
use App\Models\Sale;
use App\Models\Package;
use App\Models\PackageItem;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Promo;
use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Katalog awal toko: kategori, produk, unit fisik, paket, promo, pengaturan, dan ulasan contoh.
 * Isinya sama dengan data contoh di tampilan, supaya website tampil persis seperti rancangan Dita.
 * Datanya ada di database/seeders/data/katalog.json supaya mudah dibaca dan diubah
 * tanpa menyentuh kode. ID produk sama dengan yang dipakai tampilan (public/assets/js/data.js).
 */
class KatalogSeeder extends Seeder
{
    public function run(): void
    {
        $data = json_decode(file_get_contents(database_path('seeders/data/katalog.json')), true, flags: JSON_THROW_ON_ERROR);

        foreach ($data['categories'] as $c) {
            Category::updateOrCreate(['id' => $c['id']], $c);
        }

        foreach ($data['products'] as $p) {
            Product::updateOrCreate(['id' => $p['id']], $p);
        }

        foreach ($data['product_units'] as $u) {
            ProductUnit::updateOrCreate(['unit_code' => $u['unit_code']], $u);
        }

        foreach ($data['packages'] as $k) {
            Package::updateOrCreate(['id' => $k['id']], $k);
        }

        foreach ($data['package_items'] as $i) {
            PackageItem::updateOrCreate(['package_id' => $i['package_id'], 'product_id' => $i['product_id']], $i);
        }

        foreach ($data['promos'] as $pr) {
            Promo::updateOrCreate(['code' => $pr['code']], $pr);
        }

        foreach ($data['settings'] as $key => $value) {
            Setting::set($key, $value);
        }

        // Ulasan contoh (3 di antaranya tampil sebagai testimoni di beranda)
        foreach ($data['reviews'] ?? [] as $r) {
            $ref = $r['ref'] ?? null;
            $attrs = collect($r)->except(['ref', 'seen', 'created_at'])->all() + [
                'booking_id' => $ref ? Booking::where('booking_code', $ref)->value('id') : null,
                'sale_id' => $ref ? Sale::where('sale_code', $ref)->value('id') : null,
                'seen_at' => ! empty($r['seen']) ? now() : null,
            ];
            $review = Review::updateOrCreate(['customer_name' => $r['customer_name'], 'comment' => $r['comment']], $attrs);
            if (! empty($r['created_at'])) {
                $review->forceFill(['created_at' => $r['created_at'], 'updated_at' => $r['created_at']])->saveQuietly();
            }
        }
    }
}
