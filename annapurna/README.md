# Annapurna Adventure — Laravel (Frontend Blade)

Website rental & toko alat outdoor **Annapurna Adventure** berbasis **Laravel 12 (PHP 8.2+)**.
Semua halaman sudah berupa **view Blade** dengan route dan controller Laravel.

Tahap ini **frontend saja**: data contoh (barang, booking, penjualan, keuangan) masih dikelola JavaScript di browser (localStorage). Karena itu semua tombol bisa dicoba tanpa database.

## Cara menjalankan

```bash
composer install          # folder vendor tidak disertakan di ZIP
php artisan key:generate  # hanya jika APP_KEY di .env kosong
php artisan serve
```

Buka `http://127.0.0.1:8000`.

File `.env` sudah diatur agar **tidak butuh database**:

```
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

Jika memakai `.env` lama, ubah tiga baris itu, lalu jalankan `php artisan optimize:clear`.

Tidak perlu Node.js atau `npm`, karena CSS/JS sudah jadi di `public/assets`.

## Akun demo

| Peran         | Nama     | Email                  | Kata sandi  |
|---------------|----------|------------------------|-------------|
| Owner         | Pak Ikun | owner@annapurna.id     | owner123    |
| Admin / Staff | Dita     | dita@annapurna.id      | dita123     |
| Admin / Staff | Shely    | shely@annapurna.id     | shely123    |
| Admin / Staff | Aji      | aji@annapurna.id       | aji123      |
| Admin / Staff | Arvan    | arvan@annapurna.id     | arvan123    |
| Customer      | Dimas    | customer@annapurna.id  | customer123 |

Setiap staff login dengan akunnya sendiri. Login, logout, dan semua aktivitas tercatat atas nama staff tersebut dan bisa dilihat Pak Ikun di **Histori Sistem**. Data contoh memakai jadwal jaga: pagi Dita / Shely bergantian, siang Aji / Arvan bergantian.

> Data demo versi ini memakai kunci `ann-v9`. Saat pertama dibuka, data localStorage lama otomatis diganti dengan data contoh baru.

## Route

| URL | Nama route | View |
|-----|-----------|------|
| `/` | `home` | `annapurna.pages.index` |
| `/katalog?cat=tenda&mode=beli` | `katalog` | `annapurna.pages.katalog` |
| `/produk?id=p1` | `produk` | `annapurna.pages.produk` |
| `/paket`, `/tentang`, `/kontak` | `paket`, `tentang`, `kontak` | … |
| `/masuk`, `/daftar` | `masuk`, `daftar` | layout `auth` |
| `/keranjang`, `/checkout`, `/pembayaran?ids=…` | … | … |
| `/pesanan`, `/invoice?id=RNT-1001`, `/profil` | … | … |
| `/admin/dashboard` | `admin.dashboard` | `annapurna.admin.dashboard` |
| `/admin/booking`, `/admin/pengembalian`, `/admin/permintaan` | `admin.*` | … |
| `/admin/barang`, `/admin/penjualan`, `/admin/keuangan` | `admin.*` | … |
| `/admin/laporan`, `/admin/ulasan`, `/admin/pengaturan` | `admin.*` | … |
| `/owner/dashboard` | `owner.dashboard` | `annapurna.owner.dashboard` |
| `/owner/histori`, `/owner/staff`, `/owner/integrasi` | `owner.*` | … |

`/login` dan `/register` diarahkan ke `/masuk` dan `/daftar`.

## Struktur yang ditambahkan / diubah

```
routes/web.php                                      semua route Annapurna
app/Http/Controllers/Annapurna/PageController.php   halaman customer
app/Http/Controllers/Annapurna/AdminController.php  halaman admin
app/Http/Controllers/Annapurna/OwnerController.php  halaman owner
resources/views/annapurna/
  layouts/app.blade.php      layout customer (header & footer)
  layouts/auth.blade.php     layout masuk/daftar
  layouts/admin.blade.php    layout panel admin (sidebar & topbar)
  layouts/partials-head.blade.php
  pages/*.blade.php          14 halaman customer
  admin/*.blade.php          10 halaman admin
  owner/*.blade.php          4 halaman owner (dashboard, histori, staff, integrasi)
  emails/                    template email staff baru
public/assets/
  css/style.css              seluruh gaya (hijau, responsif)
  js/data.js                 data contoh + penyimpanan (DB) + aturan bisnis (Rules)
  js/ui.js, js/site.js, js/admin.js
  js/reports.js              laporan bersama, rekap bulanan, template email
  js/owner/*.js              script halaman owner
  js/pages/*.js, js/admin/*.js   script per halaman
  img/, vendor/              gambar, Font Awesome, font, Chart.js, ExcelJS, jsPDF, html2canvas (offline)
```

Project hanya berisi kode Annapurna di atas Laravel standar. Package yang terpasang: `laravel/framework`, `laravel/tinker`, `barryvdh/laravel-dompdf`, dan `maatwebsite/excel`. Dua package terakhir disiapkan untuk nota & laporan di sisi server saat backend dibuat.

Database sudah disiapkan sederhana: tabel `users` (kolom `phone`, `address`, `role` owner/admin/customer, `status`), `activity_logs`, `sessions`, `cache`, dan `jobs`.
`php artisan migrate --seed` membuat akun Pak Ikun (owner), Dita, Shely, Aji, Arvan (admin), dan customer yang sama dengan akun demo.

## Role: Customer → Admin/Staff → Owner

**Admin / Staff** menjalankan operasional: Tambah → Lihat → Edit → Proses. **Tidak ada tombol hapus.**
- Barang & kategori: *Aktifkan / Nonaktifkan*. Barang nonaktif hilang dari katalog, riwayatnya tetap ada.
- Keuangan: pemasukan lain & pengeluaran bisa diedit atau *dibatalkan dengan alasan* (tidak dihitung di total, tetap terlihat dicoret).
- Kategori pengeluaran gaji dihapus. Kategori: Pembelian Barang, Perawatan Alat, Perbaikan Barang, Operasional, Promosi, Keperluan Usaha Lainnya.
- Menu Pengaturan untuk admin hanya berisi profil & kata sandi. Pengaturan toko hanya untuk Owner.
- Dashboard admin: booking hari ini, rental aktif, harus kembali, terlambat, pesanan penjualan, barang tersedia/disewa, pemasukan & transaksi hari ini.

**Owner** mendapat menu tambahan (dan tetap bisa membuka semua halaman operasional):

| Halaman | Isi |
|---|---|
| Dashboard Owner | Ringkasan bisnis per bulan (rental, penjualan, pemasukan, pengeluaran, laba, stok tersedia/disewa/rusak, pembatalan), grafik 6 bulan, status rekap bulanan, aktivitas & status login staff |
| Histori Sistem | Audit trail otomatis. Tab Aktivitas Staff, Login & Logout, Perubahan Data, Transaksi, Audit Trail Lengkap. Filter staff, jenis, tanggal (hari ini/minggu/bulan/custom), pencarian, ekspor Excel/PDF, detail nilai sebelum → sesudah |
| Manajemen Staff | Tambah staff (email otomatis + kata sandi sementara, wajib diganti saat login pertama), edit, ubah role, aktifkan/nonaktifkan, reset kata sandi, lihat histori per staff. Minimal selalu ada satu Owner aktif |
| Google Drive & Email | Pengaturan folder Drive, jadwal rekap, email Owner/CC, arsip `FOLDER / TAHUN 2026 / REKAP LAPORAN BULAN …` berisi 7 PDF, kotak keluar email |

### Histori sistem (audit trail)

Dicatat otomatis tanpa input manual: login, logout, login gagal/ditolak, membuka halaman (maks. sekali per 30 menit per halaman), tambah/edit data, perubahan harga, stok, kondisi, status, konfirmasi booking, barang keluar/kembali, pembatalan, refund, pergantian barang, penjualan, keuangan, ulasan, staff, pengaturan, dan ekspor laporan.

Histori **append-only**: tidak ada fungsi ubah/hapus dan `DB.set('audit')` ditolak. Di belakang layar tiap catatan dikunci ke catatan sebelumnya; jika ada yang diubah di luar sistem, halaman Histori menampilkan peringatan (kode kunci tidak ditampilkan agar mudah dipahami). Aktivitas customer tidak masuk histori staff (tetap tercatat di riwayat tiap booking).

**Histori vs Laporan**: histori = jejak siapa-melakukan-apa (disimpan terus). Laporan = rekap angka per periode. Menu Laporan menambah *Laporan Aktivitas Staff* dan *Histori Login Staff* (khusus Owner).

### Rekap bulanan otomatis (mode demo)

Saat Owner membuka panel pada atau setelah tanggal kirim, rekap bulan lalu dibuat otomatis bila belum ada. Rekap berisi Laporan Rental, Penjualan, Keuangan, Stok, Pengembalian, Aktivitas Staff, dan Histori Login Staff. Email ringkasan (total rental, penjualan, pemasukan, pengeluaran, barang keluar/kembali, pembatalan, pergantian, aktivitas staff + link folder) masuk ke kotak keluar. File PDF dibuat ulang dari data saat diunduh. Pada tahap frontend ini upload Drive dan pengiriman email masih disimulasikan di browser; lihat bagian fondasi backend untuk versi server.

## Konfigurasi Sistem (Owner)

Menu **Konfigurasi Sistem** (`/owner/konfigurasi`) membuat aturan toko bisa diubah Owner tanpa mengubah kode. Setiap perubahan tercatat di Histori Sistem (jenis *Konfigurasi sistem*).

| Bagian | Isi | Dipakai di |
|---|---|---|
| Kategori Barang | Tambah, edit, nonaktifkan kategori | Katalog, form barang |
| Atribut Barang | Nama, tipe (pilihan/teks/angka), nilai, kategori yang memakai, **varian stok**, wajib | Form barang staff, halaman produk, pilihan ukuran customer |
| Status / Kondisi Barang | Daftar kondisi + apakah bisa disewa + warna label | Form barang; kondisi "tidak bisa disewa" (mis. Dicuci, Rusak) otomatis menutup booking barang itu |
| Aturan Rental | DP %, maksimal lama sewa, jam batas pengembalian, ketentuan rental | Booking, keranjang, nota, Tentang Kami, hitung terlambat |
| Pembatalan & Refund | Batas H-, persentase DP yang dikembalikan, teks kebijakan | Pembatalan customer, proses refund staff |
| Aturan Denda | Persentase harga sewa **atau** nominal tetap per barang per hari, aturan kerusakan | Proses pengembalian |
| Kategori Keuangan | Kategori pemasukan lain & pengeluaran | Menu Keuangan |
| Form & Field Staff | Identitas jaminan, foto, catatan: wajib / opsional / sembunyikan, plus field tambahan (teks, angka, pilihan, centang, foto) | Form barang keluar & pengembalian |
| SOP & Peraturan Staff | Judul, isi, konteks, sematkan di dashboard | Menu **SOP & Peraturan** staff, dashboard, dan otomatis tampil (dengan centang konfirmasi) di form terkait |

Contoh kasus: jaket awalnya tanpa ukuran → Owner menambah atribut *Ukuran pakaian* (S–XXL, varian stok) untuk kategori Jaket → form barang staff langsung menampilkan pilihan ukuran dan stok per ukuran, dan customer wajib memilih ukuran saat menyewa.

Menu **Pengaturan** Owner kini hanya berisi profil toko, rekening pembayaran, dan akun.

## Ukuran / varian produk

- Barang bisa punya pilihan ukuran dengan **stok per ukuran** (jaket S–XXL, sepatu EU 38–45, carrier S/M/L, kapasitas, warna, atau atur sendiri). Stok total dihitung otomatis.
- Ketersediaan dihitung per ukuran di halaman produk, sewa cepat, beli, keranjang, checkout, dan ganti barang. Ukuran yang habis tidak bisa dipilih.
- Form barang (admin & owner): informasi dasar (merek, kode/SKU, kondisi, status), harga & ketentuan (minimal sewa, jaminan), ukuran & stok, serta detail (warna, bahan, berat, dimensi/panduan ukuran, kelengkapan, deskripsi, spesifikasi). Semuanya tampil di tabel **Detail produk** halaman produk.
- Contoh data: Jaket Gunung Waterproof, Jaket Polar Fleece, Sepatu Hiking, Sandal Gunung (jual), dan Carrier 60L dengan ukuran punggung.

## Ganti barang sewa

- **Customer** (Pesanan Saya → Ganti barang): pilih barang yang diganti & jumlahnya, lalu pilih pengganti dari kartu bergambar (cari, filter kategori, stok di tanggal sewa, selisih harga, pilihan ukuran). Permintaan dicek admin di menu Pembatalan & Ganti.
- **Admin / staff** bisa mencatat ganti barang langsung di toko (tombol *Catat ganti barang di toko* atau *Ganti barang* di detail booking), termasuk saat barang sedang disewa: kondisi barang lama, selisih dibayar, atau kelebihan dikembalikan. Langsung berlaku dan tercatat di histori atas nama staff.
- Setiap baris di menu Pembatalan & Ganti punya tombol **Detail**.

## Pengingat pengembalian

Rental yang jadwal kembalinya hari ini otomatis memunculkan notifikasi untuk semua staff. Tombol **Ingatkan** (dashboard, Barang Keluar & Kembali, detail booking) membuka WhatsApp dengan pesan pengingat siap kirim (pesan berbeda untuk yang terlambat) dan mencatatnya di riwayat booking & histori sistem.

## Cache browser

Semua file CSS/JS dipanggil dengan `?v=` dari `config('app.asset_version')` (bisa diatur lewat `ASSET_VERSION` di `.env`). Naikkan nilainya setiap mengubah file di `public/assets` agar browser tidak memakai file lama.

## Fitur penting

- **Nota digital**: `/invoice?id=RNT-…` atau `ORD-…`. Bisa dicetak, diunduh sebagai PDF, dan dikirim ke WhatsApp.
- **Ekspor laporan**: tombol **Excel** (.xlsx dengan logo, ringkasan, format Rupiah, baris total, filter) dan **PDF** (A4, header toko, nomor halaman).
  Tersedia di Laporan, Keuangan, Booking, Penjualan, Barang, serta Barang Keluar & Kembali.
- **Pengambilan hanya di toko**: tidak ada layanan antar/ongkir. Status penjualan: Diproses → Dikemas → Siap Diambil di Toko → Selesai.
- **Ulasan & testimoni**:
  - Customer memberi bintang 1–5 dan komentar setelah rental selesai atau barang sudah diambil (sekali per transaksi).
  - Ulasan tampil di halaman produk dan ikut dihitung dalam rating.
  - Admin (`/admin/ulasan`) memilih maksimal 6 ulasan untuk testimoni beranda, mengatur urutannya, membalas, atau menyembunyikan.
  - Balasan admin bersifat publik: tampil di bawah ulasan di halaman produk dan di kartu testimoni beranda.
  - Customer menerima notifikasi di aplikasi dan label "Balasan baru" di Pesanan Saya. Admin bisa melihat status "Belum/Sudah dibaca customer".
  - Email otomatis bisa ditambahkan saat backend dibuat, memakai Laravel Notification (channel `mail` + `database`) yang dikirim lewat queue.
- **Animasi landing**: teks hero muncul bertahap, parallax, dan elemen muncul saat di-scroll. Otomatis nonaktif bila pengguna memilih "kurangi gerakan" di perangkatnya.

## Fondasi backend yang sudah disiapkan

| File | Fungsi |
|---|---|
| `database/migrations/0001_01_01_000000_create_users_table.php` | role `owner/admin/customer`, `status`, `must_change_password`, `created_by`, `last_login_at`, `last_logout_at` |
| `database/migrations/2026_09_29_000001_create_activity_logs_table.php` | tabel histori + `prev_hash`/`hash` |
| `app/Models/ActivityLog.php` | model append-only (update/delete melempar exception) + `firstBrokenId()` untuk cek rantai |
| `app/Support/Audit.php` | `Audit::log('harga', 'Mengubah harga Tenda 4P', $product, $changes)` dan `Audit::diff()` |
| `app/Http/Middleware/EnsureRole.php` | alias `role` (terdaftar di `bootstrap/app.php`), mengeluarkan staff nonaktif |
| `app/Mail/StaffAccountCreated.php` + `resources/views/emails/staff-account-created.blade.php` | email staff baru |
| `database/seeders/DatabaseSeeder.php` | akun Pak Ikun (owner), Dita, Shely, Aji, Arvan (admin), customer |

Karena migrasi users berubah, jalankan `php artisan migrate:fresh --seed` pada database pengembangan.

Saat backend dibuat:
1. Lindungi route: `admin/*` → `->middleware(['auth', 'role:admin,owner'])`, `owner/*` → `->middleware(['auth', 'role:owner'])`. Saat ini penjagaan akses masih di browser (`admin.js`).
2. Catat login/logout lewat listener event `Illuminate\Auth\Events\Login` / `Logout` / `Failed` yang memanggil `Audit::log(...)`. Panggil `Audit::log` di setiap controller/service yang mengubah data.
3. Beri user database hanya hak `INSERT, SELECT` pada tabel `activity_logs`.
4. Rekap bulanan: buat command (mis. `laporan:bulanan`) yang membuat PDF dengan DomPDF, mengunggah ke Google Drive (mis. package `masbug/flysystem-google-drive-ext` sebagai disk `google`), lalu `Mail::to(ownerEmail)->queue(...)`. Jadwalkan di `routes/console.php`:
   `Schedule::command('laporan:bulanan')->monthlyOn(1, '06:00');` dan jalankan `php artisan schedule:work` / cron `schedule:run`.
5. Untuk produksi, sebaiknya email staff berisi **link atur kata sandi** (password broker Laravel) daripada kata sandi sementara.

## Langkah berikutnya: menyambungkan ke database

1. Buat migrasi dan model: `products`, `categories`, `packages`, `bookings`, `booking_items`, `payments`, `sales`, `sale_items`, `expenses`, `reviews`, `settings`.
   Nota & laporan bisa dipindah ke server memakai DomPDF dan Laravel Excel yang sudah terpasang di project.
2. Kirim data dari controller ke view, contoh:
   `return view('annapurna.pages.katalog', ['products' => Product::all()]);`
   Lalu tampilkan dengan `@foreach` di Blade. Bisa juga dibuat endpoint JSON (misalnya `php artisan install:api`) lalu ganti isi fungsi `DB` di `public/assets/js/data.js` dengan `fetch()`.
3. Ganti login demo dengan autentikasi Laravel (Breeze sudah terpasang). Lindungi route admin dengan `->middleware(['auth', 'role:admin'])`.
4. Formulir yang mengirim data ke server perlu `@csrf`. Meta `csrf-token` sudah ada di layout.
