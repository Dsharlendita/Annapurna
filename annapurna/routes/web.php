<?php

use App\Http\Controllers\Annapurna\AdminController;
use App\Http\Controllers\Annapurna\OwnerController;
use App\Http\Controllers\Annapurna\PageController;
use Illuminate\Support\Facades\Route;

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

Route::prefix('admin')->name('admin.')->controller(AdminController::class)->group(function () {
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
});

// Panel Owner / Super Admin (hanya role owner; saat ini dijaga di sisi browser, lihat README).
Route::prefix('owner')->name('owner.')->controller(OwnerController::class)->group(function () {
    Route::redirect('/', '/owner/dashboard');
    Route::get('/dashboard', 'dashboard')->name('dashboard');
    Route::get('/histori', 'histori')->name('histori');
    Route::get('/staff', 'staff')->name('staff');
    Route::get('/integrasi', 'integrasi')->name('integrasi');
    Route::get('/konfigurasi', 'konfigurasi')->name('konfigurasi');
});

Route::redirect('/login', '/masuk')->name('login');
Route::redirect('/register', '/daftar')->name('register');
