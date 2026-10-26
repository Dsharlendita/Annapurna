<?php

namespace Database\Seeders;

use App\Models\LaundryCategory;
use App\Models\LaundryItem;
use Illuminate\Database\Seeder;

class LaundrySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'id' => 'tenda',
                'name' => 'Tenda',
                'icon' => 'fa-tent',
                'items' => [
                    ['id' => 'ld-t2s', 'name' => 'Tenda 2P Single Layer', 'price' => 25000, 'img' => 'assets/img/wa/tnd-2.jpg'],
                    ['id' => 'ld-t2d', 'name' => 'Tenda 2P Double Layer', 'price' => 30000, 'img' => 'assets/img/wa/pk-2p.jpg'],
                    ['id' => 'ld-t45', 'name' => 'Tenda 4P - 5P Double Layer', 'price' => 35000, 'img' => 'assets/img/wa/tnd-45.jpg'],
                    ['id' => 'ld-t6', 'name' => 'Tenda 6P Up / Family', 'price' => 50000, 'img' => 'assets/img/wa/tnd-6.jpg'],
                ]
            ],
            [
                'id' => 'sb',
                'name' => 'Sleeping Bag',
                'icon' => 'fa-bed',
                'items' => [
                    ['id' => 'ld-sb', 'name' => 'Sleeping Bag Biasa', 'price' => 10000, 'img' => 'assets/img/wa/oe-sb.jpg'],
                    ['id' => 'ld-sbb', 'name' => 'Sleeping Bag Besar / Bulu', 'price' => 15000, 'img' => 'assets/img/products/sleeping-bag.jpg'],
                ]
            ],
            [
                'id' => 'jaket',
                'name' => 'Jaket',
                'icon' => 'fa-shirt',
                'items' => [
                    ['id' => 'ld-jw', 'name' => 'Jaket Waterproof', 'price' => 10000, 'img' => 'assets/img/wa/fs-jkt.jpg'],
                    ['id' => 'ld-ji', 'name' => 'Jaket Insulated', 'price' => 15000, 'img' => 'assets/img/wa/fs-insulated.jpg'],
                ]
            ],
            [
                'id' => 'tas',
                'name' => 'Carrier & Daypack',
                'icon' => 'fa-suitcase-rolling',
                'items' => [
                    ['id' => 'ld-dp', 'name' => 'Daypack', 'price' => 15000, 'img' => 'assets/img/wa/tas-day.jpg'],
                    ['id' => 'ld-c45', 'name' => 'Carrier 40L - 50L', 'price' => 15000, 'img' => 'assets/img/wa/crr-4050m.jpg'],
                    ['id' => 'ld-c60', 'name' => 'Carrier 60L Up', 'price' => 20000, 'img' => 'assets/img/wa/crr-60m.jpg'],
                ]
            ],
            [
                'id' => 'sepatu',
                'name' => 'Sepatu',
                'icon' => 'fa-shoe-prints',
                'items' => [
                    ['id' => 'ld-sth', 'name' => 'Sepatu Trekking / Hiking', 'price' => 20000, 'img' => 'assets/img/wa/fw-mid.jpg'],
                    ['id' => 'ld-str', 'name' => 'Sepatu Trail Run / Running', 'price' => 20000, 'img' => 'assets/img/wa/fw-trail.jpg'],
                ]
            ],
            [
                'id' => 'matras',
                'name' => 'Matras',
                'icon' => 'fa-rug',
                'items' => [
                    ['id' => 'ld-ms', 'name' => 'Matras Spon', 'price' => 5000, 'img' => 'assets/img/wa/oe-matras.jpg'],
                    ['id' => 'ld-mf', 'name' => 'Matras Foil', 'price' => 5000, 'img' => 'assets/img/categories/matras.jpg'],
                ]
            ],
        ];

        foreach ($categories as $catData) {
            $cat = LaundryCategory::updateOrCreate(
                ['id' => $catData['id']],
                ['name' => $catData['name'], 'icon' => $catData['icon'], 'is_active' => true]
            );

            foreach ($catData['items'] as $item) {
                LaundryItem::updateOrCreate(
                    ['id' => $item['id']],
                    [
                        'category_id' => $cat->id,
                        'name' => $item['name'],
                        'price' => $item['price'],
                        'img' => $item['img'],
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
