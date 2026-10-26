<?php

use App\Http\Controllers\Annapurna\AdminController;
use App\Http\Controllers\Annapurna\ApiController;
use App\Http\Controllers\Annapurna\AuthController;
use App\Http\Controllers\Annapurna\BookingServiceController;
use App\Http\Controllers\Annapurna\ConfigController;
use App\Http\Controllers\Annapurna\FinanceController;
use App\Http\Controllers\Annapurna\LaundryController;
use App\Http\Controllers\Annapurna\OwnerController;
use App\Http\Controllers\Annapurna\PageController;
use App\Http\Controllers\Annapurna\PromoController;
use App\Http\Controllers\Annapurna\ReturnController;
use App\Http\Controllers\Annapurna\ReviewController;
use App\Http\Controllers\Annapurna\StaffController;
use App\Models\EmailLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Halaman Publik
Route::controller(PageController::class)->group(function () {
    Route::get('/', 'home')->name('home');
    Route::get('/katalog', 'katalog')->name('katalog');
    Route::get('/belanja', 'belanja')->name('belanja');
    Route::get('/produk', 'produk')->name('produk');
    Route::get('/paket', 'paket')->name('paket');
    Route::get('/laundry', 'laundry')->name('laundry');
    Route::get('/tentang', 'tentang')->name('tentang');
    Route::get('/ketentuan', 'ketentuan')->name('ketentuan');
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
        Route::post('/sale', 'storeSale')->name('sale.store');
        Route::post('/pembayaran/upload', 'uploadPayment')->name('payment.upload');
        Route::post('/promo/check', [PromoController::class, 'check'])->name('promo.check');
        Route::post('/ulasan', [ReviewController::class, 'store'])->name('ulasan.store');
    });
});

// Panel Admin (Role: Admin & Owner)
Route::prefix('admin')->name('admin.')->middleware(['auth', 'role:admin,owner', 'password.changed'])->controller(AdminController::class)->group(function () {
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
    Route::get('/kasir', 'kasir')->name('kasir');
    Route::get('/laundry', 'laundry')->name('laundry');
});

// Panel Owner / Super Admin (Khusus Role: Owner)
Route::prefix('owner')->name('owner.')->middleware(['auth', 'role:owner', 'password.changed'])->controller(OwnerController::class)->group(function () {
    Route::redirect('/', '/owner/dashboard');
    Route::get('/dashboard', 'dashboard')->name('dashboard');
    Route::get('/histori', 'histori')->name('histori');
    Route::get('/staff', 'staff')->name('staff');
    Route::get('/integrasi', 'integrasi')->name('integrasi');
    Route::get('/konfigurasi', 'konfigurasi')->name('konfigurasi');
    Route::get('/pelanggan', 'pelanggan')->name('pelanggan');
    Route::get('/promo', 'promo')->name('promo');
});

// Endpoint Akun & Profil Pengguna Login
Route::middleware('auth')->group(function () {
    Route::post('/api/akun/profil', [AdminController::class, 'updateProfile'])->name('api.akun.profil');
    Route::post('/api/akun/ganti-sandi', [StaffController::class, 'changePassword'])->name('api.akun.ganti-sandi');
    Route::post('/akun/kata-sandi', [StaffController::class, 'changePassword'])->name('akun.kata-sandi');
});

// API Admin (Pengaturan Toko, Keuangan, & Restock)
Route::prefix('api/admin')->name('api.admin.')->middleware(['auth', 'role:admin,owner'])->group(function () {
    Route::get('/pengaturan', [AdminController::class, 'getSettings'])->name('pengaturan.get');
    Route::post('/pengaturan', [AdminController::class, 'updateSettings'])->middleware('role:owner')->name('pengaturan.update');

    Route::controller(FinanceController::class)->group(function () {
        Route::get('/keuangan/ringkasan', 'summary')->name('keuangan.ringkasan');
        Route::get('/keuangan/transaksi', 'transactions')->name('keuangan.transaksi');
        Route::post('/keuangan', 'store')->name('keuangan.store');
        Route::post('/keuangan/{id}/batal', 'voidTransaction')->name('keuangan.void');
        Route::post('/products/{id}/restock', 'restock')->name('products.restock');
        Route::post('/produk/{id}/restock', 'restock')->name('produk.restock');
        Route::post('/pembayaran/{id}/verifikasi', 'verifyPayment')->name('pembayaran.verifikasi');
    });

    // Manajemen Laundry
    Route::controller(LaundryController::class)->group(function () {
        Route::get('/laundry', 'index')->name('laundry.index');
        Route::get('/laundry/prices', 'getPrices')->name('laundry.prices');
        Route::post('/laundry', 'store')->name('laundry.store');
        Route::get('/laundry/{id}', 'show')->name('laundry.show');
        Route::post('/laundry/{id}/status', 'updateStatus')->name('laundry.status');
        Route::post('/laundry/{id}/bayar', 'addPayment')->name('laundry.bayar');
        Route::post('/laundry/{id}/notify', 'notifyReady')->name('laundry.notify');
    });

    // Layanan Tambahan Sewa (Antar/Jemput & Pasang Tenda)
    Route::controller(BookingServiceController::class)->group(function () {
        Route::post('/booking/{bookingId}/service', 'store')->name('booking.service.store');
        Route::post('/service/{serviceId}/bayar', 'addPayment')->name('booking.service.pay');
    });

    // Pengembalian Barang & Denda Rental
    Route::controller(ReturnController::class)->group(function () {
        Route::get('/pengembalian', 'index')->name('pengembalian.index');
        Route::post('/booking/{id}/pickup', 'pickup')->name('booking.pickup');
        Route::post('/booking/{id}/return', 'processReturn')->name('booking.return');
    });

    // Ulasan & Moderasi Testimoni
    Route::controller(ReviewController::class)->group(function () {
        Route::get('/ulasan', 'index')->name('ulasan.index');
        Route::post('/ulasan/{id}/toggle-feature', 'toggleFeature')->name('ulasan.toggle-feature');
        Route::post('/ulasan/{id}/toggle-visibility', 'toggleVisibility')->name('ulasan.toggle-visibility');
        Route::post('/ulasan/{id}/reply', 'reply')->name('ulasan.reply');
        Route::post('/ulasan/reorder', 'reorder')->name('ulasan.reorder');
    });
});

// API Manajemen Staff, Promo & Konfigurasi (Khusus Role: Owner)
Route::prefix('api/owner')->name('api.owner.')->middleware(['auth', 'role:owner'])->group(function () {
    Route::prefix('staff')->name('staff.')->controller(StaffController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::patch('/{id}', 'update')->name('update');
        Route::post('/{id}/toggle', 'toggle')->name('toggle');
        Route::post('/{id}/reset-password', 'resetPassword')->name('reset-password');
    });

    Route::get('/email-logs', function (Request $request) {
        $logs = EmailLog::latest('id')->paginate(10);
        return response()->json($logs);
    })->name('email-logs');

    Route::get('/keuangan/ringkasan', [FinanceController::class, 'summary'])->name('keuangan.ringkasan');

    // Manajemen Promo & Kupon Diskon
    Route::controller(PromoController::class)->group(function () {
        Route::get('/promos', 'index')->name('promos.index');
        Route::post('/promos', 'store')->name('promos.store');
        Route::put('/promos/{id}', 'update')->name('promos.update');
        Route::post('/promos/{id}/toggle', 'toggle')->name('promos.toggle');
        Route::delete('/promos/{id}', 'destroy')->name('promos.destroy');
    });

    // Konfigurasi Sistem Toko
    Route::controller(ConfigController::class)->group(function () {
        Route::get('/konfigurasi', 'index')->name('konfigurasi.index');
        Route::post('/konfigurasi', 'store')->name('konfigurasi.store');
    });
});

Route::redirect('/login', '/masuk')->name('login');
Route::redirect('/register', '/daftar')->name('register');
