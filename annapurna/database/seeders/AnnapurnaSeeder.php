<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Package;
use App\Models\PackageItem;
use App\Models\Promo;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class AnnapurnaSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Kategori
        $categories = [
            ['id' => 'tenda', 'name' => 'Tenda', 'img' => 'assets/img/categories/tenda.jpg', 'active' => true],
            ['id' => 'sleeping-bag', 'name' => 'Sleeping Bag', 'img' => 'assets/img/categories/sleeping-bag.jpg', 'active' => true],
            ['id' => 'kursi', 'name' => 'Kursi Camping', 'img' => 'assets/img/categories/kursi.jpg', 'active' => true],
            ['id' => 'carrier', 'name' => 'Carrier', 'img' => 'assets/img/categories/carrier.jpg', 'active' => true],
            ['id' => 'kompor', 'name' => 'Kompor & Cooking Set', 'img' => 'assets/img/categories/kompor.jpg', 'active' => true],
            ['id' => 'lampu', 'name' => 'Lampu', 'img' => 'assets/img/categories/lampu.jpg', 'active' => true],
            ['id' => 'matras', 'name' => 'Matras', 'img' => 'assets/img/categories/matras.jpg', 'active' => true],
            ['id' => 'jaket', 'name' => 'Jaket & Pakaian', 'img' => 'assets/img/products/jaket.svg', 'active' => true],
            ['id' => 'sepatu', 'name' => 'Sepatu & Sandal', 'img' => 'assets/img/products/sepatu.svg', 'active' => true],
        ];

        foreach ($categories as $cat) {
            Category::updateOrCreate(['id' => $cat['id']], $cat);
        }

        // 2. Produk
        $products = [
            [
                'id' => 'p1',
                'name' => 'Tenda Camping',
                'category_id' => 'tenda',
                'img' => 'assets/img/products/tenda.jpg',
                'rent_price' => 75000,
                'sale_price' => 1850000,
                'stock' => 6,
                'rating' => 4.8,
                'reviews_count' => 124,
                'badge' => 'Populer',
                'is_featured' => true,
                'condition' => 'Sangat Baik',
                'brand' => 'Consina',
                'sku' => 'TND-4P-01',
                'color' => 'Hijau army',
                'material' => 'Polyester 190T, frame alloy',
                'weight' => '3,2 kg',
                'dimension' => '210 × 240 × 140 cm',
                'includes' => 'Inner, flysheet, 2 frame alloy, 12 pasak, tali, tas',
                'description' => 'Tenda dome kapasitas 4 orang dengan double layer dan flysheet waterproof 3000mm. Rangka alloy ringan, cepat dipasang dalam 10 menit.',
                'specs' => ['Kapasitas 4 orang', 'Waterproof 3000mm', 'Berat 3,2 kg', 'Ukuran 210 × 240 × 140 cm'],
                'attrs' => ['at-kapasitas' => '4 orang', 'at-tipe-tenda' => 'Dome'],
                'min_days' => 1,
            ],
            [
                'id' => 'p2',
                'name' => 'Kursi Camping',
                'category_id' => 'kursi',
                'img' => 'assets/img/products/kursi.jpg',
                'rent_price' => 15000,
                'sale_price' => 185000,
                'stock' => 12,
                'rating' => 4.7,
                'reviews_count' => 98,
                'badge' => 'Best Seller',
                'is_featured' => true,
                'condition' => 'Sangat Baik',
                'description' => 'Kursi lipat dengan sandaran tinggi dan tempat gelas. Kokoh menahan beban hingga 120 kg, bisa dilipat ringkas ke dalam tas.',
                'specs' => ['Beban maks. 120 kg', 'Rangka baja', 'Tas penyimpanan', 'Berat 2,1 kg'],
                'min_days' => 1,
            ],
            [
                'id' => 'p3',
                'name' => 'Sleeping Bag',
                'category_id' => 'sleeping-bag',
                'img' => 'assets/img/products/sleeping-bag.jpg',
                'rent_price' => 20000,
                'sale_price' => 275000,
                'stock' => 10,
                'rating' => 4.6,
                'reviews_count' => 87,
                'is_featured' => true,
                'condition' => 'Sangat Baik',
                'description' => 'Sleeping bag polar dengan lapisan dalam lembut, nyaman untuk suhu 10–18°C. Selalu dicuci bersih setelah setiap penyewaan.',
                'specs' => ['Suhu nyaman 10–18°C', 'Bahan polar', 'Ukuran 190 × 75 cm', 'Bisa dibuka jadi selimut'],
                'min_days' => 1,
            ],
            [
                'id' => 'p4',
                'name' => 'Kompor Portable',
                'category_id' => 'kompor',
                'img' => 'assets/img/products/kompor.jpg',
                'rent_price' => 25000,
                'sale_price' => 320000,
                'stock' => 8,
                'rating' => 4.8,
                'reviews_count' => 76,
                'is_featured' => true,
                'condition' => 'Sangat Baik',
                'description' => 'Kompor gas portable dengan koper, api stabil dan hemat gas. Dilengkapi pengaman tekanan gas otomatis.',
                'specs' => ['Gas kaleng 230 g', 'Pemantik otomatis', 'Koper pelindung', 'Berat 1,8 kg'],
                'min_days' => 1,
            ],
            [
                'id' => 'p5',
                'name' => 'Carrier',
                'category_id' => 'carrier',
                'img' => 'assets/img/products/carrier.jpg',
                'rent_price' => 35000,
                'sale_price' => 850000,
                'stock' => 7,
                'rating' => 4.8,
                'reviews_count' => 65,
                'is_featured' => true,
                'condition' => 'Sangat Baik',
                'brand' => 'Eiger',
                'sku' => 'CRR-60-01',
                'color' => 'Hitam / abu',
                'material' => 'Nylon ripstop 420D',
                'weight' => '1,9 kg',
                'dimension' => '60 liter',
                'includes' => 'Rain cover',
                'description' => 'Carrier 60 liter dengan backsystem adjustable, rain cover, dan banyak kantong. Cocok untuk pendakian 2–4 hari.',
                'specs' => ['Kapasitas 60 L', 'Rain cover', 'Backsystem adjustable', 'Hip belt empuk'],
                'attrs' => ['at-kapasitas' => '60 L'],
                'has_variant' => true,
                'variant_data' => [
                    'label' => 'Ukuran punggung',
                    'options' => [
                        ['name' => 'S (torso 40–45 cm)', 'stock' => 2],
                        ['name' => 'M (torso 45–50 cm)', 'stock' => 3],
                        ['name' => 'L (torso 50–55 cm)', 'stock' => 2],
                    ]
                ],
                'min_days' => 1,
            ],
            [
                'id' => 'p6',
                'name' => 'Lampu Camping',
                'category_id' => 'lampu',
                'img' => 'assets/img/products/lampu.jpg',
                'rent_price' => 15000,
                'sale_price' => 150000,
                'stock' => 9,
                'rating' => 4.6,
                'reviews_count' => 58,
                'is_featured' => true,
                'condition' => 'Sangat Baik',
                'description' => 'Lentera camping dengan cahaya hangat dan tiga mode terang. Baterai isi ulang tahan hingga 12 jam.',
                'specs' => ['3 mode cahaya', 'Baterai isi ulang', 'Tahan 12 jam', 'Gantungan besi'],
                'min_days' => 1,
            ],
            [
                'id' => 'p7',
                'name' => 'Tenda Dome 2P Ultralight',
                'category_id' => 'tenda',
                'img' => 'assets/img/categories/tenda.jpg',
                'rent_price' => 55000,
                'sale_price' => 1250000,
                'stock' => 5,
                'rating' => 4.7,
                'reviews_count' => 41,
                'condition' => 'Sangat Baik',
                'description' => 'Tenda ultralight untuk 2 orang, favorit pendaki solo dan berdua. Muat masuk carrier dengan mudah.',
                'specs' => ['Kapasitas 2 orang', 'Berat 1,9 kg', 'Waterproof 2000mm', 'Frame aluminium'],
                'min_days' => 1,
            ],
            [
                'id' => 'p8',
                'name' => 'Sleeping Bag Mummy -5°C',
                'category_id' => 'sleeping-bag',
                'img' => 'assets/img/categories/sleeping-bag.jpg',
                'rent_price' => 30000,
                'sale_price' => 450000,
                'stock' => 6,
                'rating' => 4.8,
                'reviews_count' => 33,
                'condition' => 'Sangat Baik',
                'description' => 'Sleeping bag bentuk mummy untuk gunung dengan suhu dingin, lengkap dengan hoodie dan resleting dua arah.',
                'specs' => ['Suhu ekstrem -5°C', 'Model mummy + hoodie', 'Isian dacron', 'Compression sack'],
                'min_days' => 1,
            ],
            [
                'id' => 'p9',
                'name' => 'Kursi Camping Director',
                'category_id' => 'kursi',
                'img' => 'assets/img/categories/kursi.jpg',
                'rent_price' => 20000,
                'sale_price' => 240000,
                'stock' => 6,
                'rating' => 4.5,
                'reviews_count' => 22,
                'condition' => 'Sangat Baik',
                'description' => 'Kursi director dengan sandaran tangan, nyaman untuk bersantai lama di area camping ground.',
                'specs' => ['Sandaran tangan', 'Beban maks. 110 kg', 'Rangka baja', 'Berat 2,8 kg'],
                'min_days' => 1,
            ],
            [
                'id' => 'p10',
                'name' => 'Carrier Daypack 40L',
                'category_id' => 'carrier',
                'img' => 'assets/img/categories/carrier.jpg',
                'rent_price' => 25000,
                'sale_price' => 550000,
                'stock' => 6,
                'rating' => 4.6,
                'reviews_count' => 29,
                'condition' => 'Sangat Baik',
                'brand' => 'Consina',
                'sku' => 'CRR-40-01',
                'color' => 'Biru navy',
                'material' => 'Polyester 600D',
                'weight' => '1,1 kg',
                'dimension' => '40 liter',
                'includes' => 'Rain cover',
                'description' => 'Daypack 40 liter untuk tektok dan pendakian satu hari. Ringan dengan ventilasi punggung.',
                'specs' => ['Kapasitas 40 L', 'Ventilasi punggung', 'Slot hydration', 'Berat 1,1 kg'],
                'attrs' => ['at-kapasitas' => '40 L'],
                'min_days' => 1,
            ],
            [
                'id' => 'p11',
                'name' => 'Kompor & Cooking Set',
                'category_id' => 'kompor',
                'img' => 'assets/img/categories/kompor.jpg',
                'rent_price' => 30000,
                'sale_price' => 395000,
                'stock' => 5,
                'rating' => 4.7,
                'reviews_count' => 37,
                'condition' => 'Sangat Baik',
                'description' => 'Paket kompor koper dengan nesting 3 panci, wajan, dan sendok. Praktis untuk masak bareng di camping.',
                'specs' => ['Kompor koper', 'Nesting 3 panci + wajan', 'Sendok & sutil', 'Tas jaring'],
                'min_days' => 1,
            ],
            [
                'id' => 'p12',
                'name' => 'Lentera LED Retro',
                'category_id' => 'lampu',
                'img' => 'assets/img/categories/lampu.jpg',
                'rent_price' => 12000,
                'sale_price' => 120000,
                'stock' => 10,
                'rating' => 4.5,
                'reviews_count' => 19,
                'condition' => 'Sangat Baik',
                'description' => 'Lentera LED gaya klasik dengan dimmer. Aman dipakai di dalam tenda.',
                'specs' => ['Dimmer', '3× baterai AA', 'Tahan 20 jam', 'Tahan cipratan air'],
                'min_days' => 1,
            ],
            [
                'id' => 'p13',
                'name' => 'Matras Angin Ultralight',
                'category_id' => 'matras',
                'img' => 'assets/img/categories/matras.jpg',
                'rent_price' => 15000,
                'sale_price' => 225000,
                'stock' => 8,
                'rating' => 4.6,
                'reviews_count' => 27,
                'condition' => 'Sangat Baik',
                'description' => 'Matras tiup ringan dengan bantal terintegrasi. Menjaga badan tetap hangat dari tanah.',
                'specs' => ['Tebal 6 cm', 'Bantal terintegrasi', 'Berat 560 g', 'Pompa kantong'],
                'min_days' => 1,
            ],
            [
                'id' => 'p14',
                'name' => 'Matras Foam Lipat',
                'category_id' => 'matras',
                'img' => 'assets/img/categories/matras.jpg',
                'rent_price' => 8000,
                'sale_price' => 95000,
                'stock' => 12,
                'rating' => 4.4,
                'reviews_count' => 45,
                'condition' => 'Sangat Baik',
                'description' => 'Matras foam lipat model telur. Tidak perlu ditiup dan tahan tusukan.',
                'specs' => ['Model egg-crate', 'Tebal 2 cm', 'Lipat 8 bagian', 'Berat 400 g'],
                'min_days' => 1,
            ],
            [
                'id' => 'p15',
                'name' => 'Tenda Keluarga 6P',
                'category_id' => 'tenda',
                'img' => 'assets/img/products/tenda.jpg',
                'rent_price' => 120000,
                'sale_price' => null,
                'stock' => 3,
                'rating' => 4.9,
                'reviews_count' => 18,
                'condition' => 'Sangat Baik',
                'description' => 'Tenda besar untuk keluarga dengan dua ruang tidur dan teras. Hanya tersedia untuk disewa.',
                'specs' => ['Kapasitas 6 orang', '2 kamar + teras', 'Tinggi 190 cm', 'Waterproof 3000mm'],
                'min_days' => 1,
            ],
            [
                'id' => 'p16',
                'name' => 'Gas Kaleng 230 g',
                'category_id' => 'kompor',
                'img' => 'assets/img/categories/kompor.jpg',
                'rent_price' => 0,
                'sale_price' => 18000,
                'stock' => 60,
                'rating' => 4.8,
                'reviews_count' => 112,
                'condition' => 'Baru',
                'description' => 'Gas butana kaleng 230 g untuk kompor portable. Hanya tersedia untuk dibeli.',
                'specs' => ['Isi 230 g', 'Butana', 'Untuk kompor portable', 'Satuan'],
                'min_days' => 1,
            ],
            [
                'id' => 'p21',
                'name' => 'Tenda Eiger Kaliandra 4P',
                'category_id' => 'tenda',
                'img' => 'assets/img/products/tenda.jpg',
                'rent_price' => 90000,
                'sale_price' => 2450000,
                'stock' => 4,
                'rating' => 4.8,
                'reviews_count' => 38,
                'condition' => 'Sangat Baik',
                'brand' => 'Eiger',
                'sku' => 'TND-EGR-4P',
                'color' => 'Abu-abu / oranye',
                'material' => 'Polyester 210T PU 5000mm, frame aluminium 7001',
                'weight' => '3,6 kg',
                'dimension' => '220 × 240 × 135 cm',
                'includes' => 'Inner, flysheet, 3 frame aluminium, 14 pasak, tali, tas',
                'description' => 'Tenda 4 orang merek Eiger dengan double layer, frame aluminium, dan vestibule luas untuk menyimpan carrier.',
                'specs' => ['Kapasitas 4 orang', 'Waterproof 5000mm', 'Frame aluminium', 'Vestibule depan'],
                'min_days' => 1,
            ],
        ];

        foreach ($products as $prod) {
            Product::updateOrCreate(['id' => $prod['id']], $prod);

            // Buat Unit Fisik otomatis untuk produk yang bisa disewa
            if ($prod['rent_price'] > 0) {
                $prefix = strtoupper($prod['sku'] ?? $prod['id']);
                for ($i = 1; $i <= $prod['stock']; $i++) {
                    $code = sprintf('%s-%02d', $prefix, $i);
                    ProductUnit::updateOrCreate(
                        ['unit_code' => $code],
                        [
                            'product_id' => $prod['id'],
                            'condition' => 'Baik',
                            'status' => 'tersedia',
                            'rents_count' => rand(2, 10),
                            'since_service' => rand(0, 5),
                            'last_service' => now()->subDays(rand(10, 50)),
                        ]
                    );
                }
            }
        }

        // 3. Paket Hemat
        $packages = [
            [
                'id' => 'pk1',
                'name' => 'Paket Solo Hiking',
                'tagline' => 'Semua yang kamu butuhkan untuk naik gunung sendiri.',
                'img' => 'assets/img/products/carrier.jpg',
                'price_per_day' => 120000,
                'people' => '1 orang',
                'people_min' => 1,
                'people_max' => 1,
                'type' => 'hiking',
                'items' => [
                    ['product_id' => 'p7', 'qty' => 1],
                    ['product_id' => 'p8', 'qty' => 1],
                    ['product_id' => 'p13', 'qty' => 1],
                    ['product_id' => 'p5', 'qty' => 1],
                    ['product_id' => 'p6', 'qty' => 1],
                ]
            ],
            [
                'id' => 'pk2',
                'name' => 'Paket Camping Berdua',
                'tagline' => 'Tenda, alas tidur, dan dapur kecil untuk dua orang.',
                'img' => 'assets/img/products/tenda.jpg',
                'price_per_day' => 145000,
                'people' => '2 orang',
                'people_min' => 2,
                'people_max' => 2,
                'type' => 'camping',
                'items' => [
                    ['product_id' => 'p1', 'qty' => 1],
                    ['product_id' => 'p3', 'qty' => 2],
                    ['product_id' => 'p14', 'qty' => 2],
                    ['product_id' => 'p4', 'qty' => 1],
                    ['product_id' => 'p6', 'qty' => 1],
                ]
            ],
        ];

        foreach ($packages as $pkg) {
            $items = $pkg['items'];
            unset($pkg['items']);
            $package = Package::updateOrCreate(['id' => $pkg['id']], $pkg);

            foreach ($items as $item) {
                PackageItem::updateOrCreate(
                    ['package_id' => $package->id, 'product_id' => $item['product_id']],
                    ['qty' => $item['qty']]
                );
            }
        }

        // 4. Promo
        $promos = [
            ['code' => 'WEEKDAY15', 'discount_type' => 'persen', 'discount_value' => 15, 'min_order' => 0, 'valid_until' => now()->addDays(60)],
            ['code' => 'ANNAPURNA10', 'discount_type' => 'persen', 'discount_value' => 10, 'min_order' => 200000, 'valid_until' => now()->addDays(30)],
            ['code' => 'GASKEUN', 'discount_type' => 'nominal', 'discount_value' => 10000, 'min_order' => 100000, 'valid_until' => now()->addDays(25)],
        ];

        foreach ($promos as $promo) {
            Promo::updateOrCreate(['code' => $promo['code']], $promo);
        }

        // 5. Pengaturan Sistem
        Setting::set('store_name', 'Annapurna Adventure');
        Setting::set('phone', '+62 896 3469 6969');
        Setting::set('whatsapp', '6289634696969');
        Setting::set('email', 'annapurnaadv@gmail.com');
        Setting::set('address', 'Jl. Kampus No. 8-9 Grendeng, Purwokerto, Jawa Tengah, Indonesia');
        Setting::set('hours', 'Setiap hari, 09.00 – 22.00 WIB');
        Setting::set('dp_percent', 50);
        Setting::set('banks', [
            ['bank' => 'BCA', 'number' => '1234567890', 'holder' => 'Annapurna Adventure'],
            ['bank' => 'BRI', 'number' => '0987 6543 2100 123', 'holder' => 'Annapurna Adventure'],
        ]);

        // 6. Contoh Transaksi Booking Rental
        $customer = User::where('role', 'customer')->first();
        if ($customer) {
            $booking = Booking::updateOrCreate(
                ['booking_code' => 'RNT-1001'],
                [
                    'user_id' => $customer->id,
                    'customer_name' => $customer->name,
                    'customer_phone' => $customer->phone ?? '081390001122',
                    'customer_email' => $customer->email,
                    'customer_address' => $customer->address ?? 'Purwokerto',
                    'start_date' => now()->addDays(3),
                    'end_date' => now()->addDays(5),
                    'days' => 2,
                    'subtotal' => 280000,
                    'discount_amount' => 0,
                    'fine_amount' => 0,
                    'total_amount' => 280000,
                    'dp_amount' => 140000,
                    'payment_method' => 'Transfer BCA',
                    'status' => 'dikonfirmasi',
                    'payment_status' => 'dp_paid',
                    'delivery_mode' => 'ambil',
                    'notes' => 'Diambil pagi hari',
                ]
            );

            BookingItem::updateOrCreate(
                ['booking_id' => $booking->id, 'product_id' => 'p1'],
                [
                    'product_name' => 'Tenda Camping',
                    'product_img' => 'assets/img/products/tenda.jpg',
                    'qty' => 1,
                    'price_per_day' => 75000,
                    'subtotal' => 150000,
                ]
            );

            Payment::updateOrCreate(
                ['booking_id' => $booking->id, 'payment_type' => 'DP'],
                [
                    'amount' => 140000,
                    'bank_name' => 'BCA',
                    'status' => 'verified',
                    'paid_at' => now()->subDay(),
                    'verified_at' => now()->subHours(12),
                ]
            );
        }
    }
}
