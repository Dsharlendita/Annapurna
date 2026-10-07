<?php

use App\Http\Controllers\Annapurna\AdminController;
use App\Http\Controllers\Annapurna\ApiController;
use App\Http\Controllers\Annapurna\AuthController;
use App\Http\Controllers\Annapurna\OwnerController;
use App\Http\Controllers\Annapurna\PageController;
use Illuminate\Support\Facades\Route;

// Halaman Publik
Route::controller(PageController::class)->group(function () {
    Route::get('/', 'home')->name('home');
    Route::get('/katalog', 'katalog')->name('katalog');
    Route::get('/produk', 'produk')->name('produk');
    Route::get('/paket', 'paket')->name('paket');
    Route::get('/tentang', 'tentang')->name('tentang');
    Route::get('/kontak', 'kontak')->name('kontak');

    Route::get('/masuk', 'masuk')->name('masuk');
    Route::get('/daftar', 'daftar')->name('daftar');

    Route::get('/keranjang', 'keranjang')->name('keranjang');
    Route::get('/checkout', 'checkout')->name('checkout');
    Route::get('/pembayaran', 'pembayaran')->name('pembayaran');
    Route::get('/pesanan', 'pesanan')->name('pesanan');
    Route::get('/invoice', 'invoice')->name('invoice');
    Route::get('/profil', 'profil')->name('profil');
});

// Autentikasi Pengguna
Route::controller(AuthController::class)->group(function () {
    Route::post('/masuk', 'login')->name('masuk.submit');
    Route::post('/daftar', 'register')->name('daftar.submit');
    Route::match(['get', 'post'], '/keluar', 'logout')->name('logout');
    Route::get('/api/me', 'me')->name('api.me');
});

// REST API Endpoints untuk Interaksi Frontend
Route::prefix('api')->name('api.')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->name('login');
    Route::post('/register', [AuthController::class, 'register'])->name('register');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::controller(ApiController::class)->group(function () {
        Route::get('/katalog', 'products')->name('katalog');
        Route::get('/kategori', 'categories')->name('categories');
        Route::get('/produk/{id}', 'productDetail')->name('product.detail');
        Route::get('/paket', 'packages')->name('packages');
        Route::post('/cek-stok', 'checkAvailability')->name('check.availability');
        Route::post('/booking', 'storeBooking')->name('booking.store');
        Route::post('/pembayaran/upload', 'uploadPayment')->name('payment.upload');
    });
});

// Panel Admin (Role: Admin & Owner)
Route::prefix('admin')->name('admin.')->middleware(['auth', 'role:admin,owner'])->controller(AdminController::class)->group(function () {
    Route::redirect('/', '/admin/dashboard');
    Route::get('/dashboard', 'dashboard')->name('dashboard');
    Route::get('/booking', 'booking')->name('booking');
    Route::get('/pengembalian', 'pengembalian')->name('pengembalian');
    Route::get('/permintaan', 'permintaan')->name('permintaan');
    Route::get('/barang', 'barang')->name('barang');
    Route::get('/penjualan', 'penjualan')->name('penjualan');
    Route::get('/keuangan', 'keuangan')->name('keuangan');
    Route::get('/laporan', 'laporan')->name('laporan');
    Route::get('/ulasan', 'ulasan')->name('ulasan');
    Route::get('/pengaturan', 'pengaturan')->name('pengaturan');
    Route::get('/sop', 'sop')->name('sop');
    Route::get('/perawatan', 'perawatan')->name('perawatan');
    Route::get('/kalender', 'kalender')->name('kalender');
});

// Panel Owner / Super Admin (Khusus Role: Owner)
Route::prefix('owner')->name('owner.')->middleware(['auth', 'role:owner'])->controller(OwnerController::class)->group(function () {
    Route::redirect('/', '/owner/dashboard');
    Route::get('/dashboard', 'dashboard')->name('dashboard');
    Route::get('/histori', 'histori')->name('histori');
    Route::get('/staff', 'staff')->name('staff');
    Route::get('/integrasi', 'integrasi')->name('integrasi');
    Route::get('/konfigurasi', 'konfigurasi')->name('konfigurasi');
    Route::get('/pelanggan', 'pelanggan')->name('pelanggan');
    Route::get('/promo', 'promo')->name('promo');
});

Route::redirect('/login', '/masuk')->name('login');
Route::redirect('/register', '/daftar')->name('register');
