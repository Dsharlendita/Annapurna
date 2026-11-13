# Struktur Database Annapurna Adventure

Database MySQL dengan 34 tabel aplikasi, dibagi menjadi 8 bagian. Setiap bagian punya satu file migrasi di `database/migrations/`.

| No | Bagian | File migrasi | Tabel |
|---|---|---|---|
| 01 | Akun | `0001_01_01_000000_create_akun_tables` | users, password_reset_tokens, sessions |
| 02 | Katalog | `2026_11_13_000001_create_katalog_tables` | categories, products, product_units, packages, package_items |
| 03 | Sewa | `2026_11_13_000002_create_sewa_tables` | bookings, booking_items, booking_services, booking_returns, booking_extensions, booking_changes, refunds |
| 04 | Penjualan | `2026_11_13_000003_create_penjualan_tables` | sales, sale_items, sale_deliveries |
| 05 | Laundry | `2026_11_13_000004_create_laundry_tables` | laundry_categories, laundry_items, laundry_orders, laundry_order_items, laundry_status_logs |
| 06 | Pembayaran | `2026_11_13_000005_create_payments_table` | payments |
| 07 | Keuangan | `2026_11_13_000006_create_keuangan_tables` | finances, restocks |
| 08 | Sistem | `2026_11_13_000007_create_sistem_tables` | settings, promos, reviews, document_sequences, nota_links, activity_logs, email_logs, chat_misses |

Tabel bawaan Laravel (`cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `migrations`) tidak dibahas di sini.

## Diagram relasi (ERD)

Diagram ini tampil sebagai gambar di GitHub dan di VS Code (dengan ekstensi Mermaid). Hanya kolom kunci yang ditampilkan.

```mermaid
erDiagram
    users ||--o{ bookings : "memesan"
    users ||--o{ sales : "membeli"
    users ||--o{ laundry_orders : "mencuci"
    users ||--o{ reviews : "menulis"

    categories ||--o{ products : "berisi"
    products ||--o{ product_units : "punya unit fisik"
    packages ||--o{ package_items : "berisi"
    products ||--o{ package_items : "masuk paket"

    bookings ||--o{ booking_items : "berisi"
    products ||--o{ booking_items : "disewa"
    product_units ||--o{ booking_items : "unit yang keluar"
    bookings ||--o| booking_services : "antar / pasang"
    bookings ||--o| booking_returns : "pengembalian"
    bookings ||--o{ booking_extensions : "perpanjangan"
    bookings ||--o{ booking_changes : "tukar barang"
    bookings ||--o| refunds : "refund DP"

    sales ||--o{ sale_items : "berisi"
    products ||--o{ sale_items : "dijual"
    sales ||--o| sale_deliveries : "pengiriman"

    laundry_categories ||--o{ laundry_items : "daftar harga"
    laundry_orders ||--o{ laundry_order_items : "berisi"
    laundry_orders ||--o{ laundry_status_logs : "riwayat status"

    bookings ||--o{ payments : "dibayar"
    sales ||--o{ payments : "dibayar"
    laundry_orders ||--o{ payments : "dibayar"
    booking_services ||--o{ payments : "dibayar"

    finances ||--o| restocks : "biaya pembelian"
    products ||--o{ restocks : "ditambah stok"

    users {
        bigint id PK
        string email UK
        enum role "owner | admin | customer"
        enum status "aktif | nonaktif"
    }
    products {
        string id PK "mis. ck-capit"
        string category_id FK
        int rent_price "sewa per hari"
        int sale_price "null = tidak dijual"
        int stock "stok barang jual"
    }
    product_units {
        bigint id PK
        string product_id FK
        string unit_code UK "mis. TND-4P-01"
        enum status "tersedia | disewa | perawatan | rusak | nonaktif"
    }
    bookings {
        bigint id PK
        string booking_code UK
        string nota_no UK "RNTL/001/XI/2026"
        bigint user_id FK
        date start_date
        date end_date
        int total_amount
        int dp_amount
        enum channel "online | offline"
        enum status
        enum payment_status
    }
    payments {
        bigint id PK
        bigint booking_id FK "isi salah satu"
        bigint sale_id FK "isi salah satu"
        bigint laundry_order_id FK "isi salah satu"
        bigint booking_service_id FK "isi salah satu"
        enum payment_type
        int amount
        string payment_method "Tunai | Transfer | QRIS"
        enum status "pending | verified | rejected"
    }
    refunds {
        bigint id PK
        bigint booking_id FK
        int amount
        enum method "transfer | tunai"
        enum status "menunggu | selesai | hangus | tidak_perlu"
    }
    finances {
        bigint id PK
        string finance_code UK
        enum type "income | expense"
        enum line "rent | sale | umum"
        int amount
    }
```

## Penjelasan per bagian

### 01 · Akun
- **users** menyimpan semua orang yang memakai sistem. Kolom `role` membedakan owner, admin (staff toko), dan customer.
- Kolom `auto_created` menandai akun customer yang dibuat otomatis saat staff mencatat transaksi di kasir.

### 02 · Katalog
- **products** dipakai untuk barang sewa sekaligus barang jual. ID produk berupa teks (`ck-capit`) dan sama dengan ID di tampilan.
- **product_units** berisi satu baris untuk setiap barang fisik yang disewakan, lengkap dengan kode unit dan kondisinya. Ketersediaan barang sewa dihitung dari tabel ini.
- `products.stock` adalah stok barang jual. Untuk barang sewa, kolom ini hanya dipakai bila produk belum punya unit fisik.
- Harga sewa bertingkat: `rent_price` (per hari), `rent_price_3` (total 3 hari), dan `rent_price_5` (total 5 hari). Paket memakai pola yang sama (`price_per_day`, `price_3`, `price_5`).

### 03 · Sewa
- **bookings** menyimpan data inti satu transaksi sewa. Data customer disalin ke booking, sehingga nota tetap benar meskipun akun berubah.
- **booking_items** berisi barang yang disewa. Nama dan harga juga disalin, sehingga nota lama tidak ikut berubah saat harga katalog berubah.
- **booking_returns** berisi hasil pemeriksaan saat barang kembali. Denda hanya tercatat di sini (`total_fine`) dan sudah ikut ditambahkan ke `bookings.total_amount`.
- **refunds** mencatat pengembalian DP saat booking dibatalkan: jumlah, metode (transfer/tunai), rekening tujuan, dan foto bukti.
- **booking_services** berisi layanan antar/jemput dan pasang tenda. Pembayarannya ada di `payments`, terpisah dari uang sewa.

### 04 · Penjualan
- **sales**, **sale_items**, dan **sale_deliveries** dipakai untuk pembelian barang, baik di kasir maupun online. `sale_items.unit_cost` menyimpan harga modal saat terjual, untuk menghitung laba.

### 05 · Laundry
- Customer tidak memesan laundry lewat website. Halaman laundry di website hanya berisi daftar harga dan kalkulator estimasi, yang membaca `laundry_categories` dan `laundry_items`.
- Staff mencatat pesanan laundry di kasir (`laundry_orders`, nota `DRY/…`). Pembayarannya diterima saat barang diambil dan dicatat di `payments`.

### 06 · Pembayaran
- Semua uang dari customer dicatat di satu tabel **payments**. Setiap baris mengisi tepat satu dari empat kolom pemilik: `booking_id`, `sale_id`, `laundry_order_id`, atau `booking_service_id`.
- Transfer online berstatus `pending` sampai diverifikasi admin. Pembayaran di toko langsung berstatus `verified`, dan `verified_by` diisi staff yang menerima uang.

### 07 · Keuangan
- **finances** adalah buku kas: pemasukan dan pengeluaran per lini usaha (`rent`, `sale`, `umum`). Pembayaran customer yang sudah diterima ikut dibukukan otomatis di sini.
- **restocks** mencatat pembelian stok atau unit baru. Biayanya dibukukan sebagai pengeluaran di `finances`.

### 08 · Sistem
- **settings** menyimpan pengaturan toko dalam bentuk kunci dan nilai JSON. Nama kunci selalu snake_case (`dp_percent`, `cancel_days`, `dur_rules`). Kunci camelCase dari tampilan (`dpPercent`) otomatis diarahkan ke baris yang sama.
- **document_sequences** menyimpan nomor urut nota per bulan.
- **activity_logs** mencatat jejak aktivitas staff. Setiap baris menyimpan hash baris sebelumnya, sehingga perubahan diam-diam bisa ketahuan.

## Mengisi ulang database

```
php artisan migrate:fresh --seed
```

Perintah ini mengisi:
- 3 akun contoh: owner, admin, dan customer.
- Katalog dari `database/seeders/data/katalog.json`: 14 kategori, 91 produk, 485 unit, 11 paket, 3 promo, dan pengaturan toko.
- Daftar harga laundry.
- Satu contoh booking.

Kalau ingin mengubah katalog awal, cukup ubah file JSON tersebut.
