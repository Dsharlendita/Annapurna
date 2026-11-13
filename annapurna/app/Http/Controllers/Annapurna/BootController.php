<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\CustomerFlag;
use App\Models\Finance;
use App\Models\Package;
use App\Models\PackageItem;
use App\Models\Product;
use App\Models\Promo;
use App\Models\Review;
use App\Models\Setting;
use App\Models\UserNotification;
use App\Support\FeData;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

/**
 * Mengirim data server ke tampilan sebelum halaman digambar.
 *
 *   GET /boot.js        → katalog, pengaturan, promo, ulasan tampil (untuk semua pengunjung)
 *   GET /boot-staff.js  → tambahan untuk staff: harga modal, semua ulasan, status pelanggan,
 *                         pemasukan/pengeluaran manual, pengaturan khusus Owner
 *   BootController::userData() → notifikasi akun yang sedang masuk (ditulis langsung di layout)
 *
 * File .js memakai parameter ?v= berisi versi data. Versi berubah setiap kali data berubah,
 * jadi browser boleh menyimpan file lama di cache tanpa takut menampilkan data basi.
 */
class BootController extends Controller
{
    /** Naikkan versi secara manual (dipanggil setelah sinkronisasi dari tampilan). */
    public static function bump(): void
    {
        Cache::forever('boot_bump', (int) Cache::get('boot_bump', 0) + 1);
    }

    private static function stamp(string $model): string
    {
        return $model::max('updated_at') . '#' . $model::count();
    }

    public static function version(string $scope = 'public'): string
    {
        try {
            return self::computeVersion($scope);
        } catch (\Throwable $e) {
            return '0';   // database belum siap (mis. sebelum migrate): halaman tetap tampil
        }
    }

    private static function computeVersion(string $scope): string
    {
        $parts = [Cache::get('boot_bump', 0)];
        foreach ([Category::class, Product::class, Package::class, PackageItem::class, Promo::class, Review::class, Setting::class] as $m) {
            $parts[] = self::stamp($m);
        }
        if ($scope === 'staff') {
            $parts[] = Finance::where('source', 'manual')->max('updated_at') . '#' . Finance::where('source', 'manual')->count();
            $parts[] = self::stamp(CustomerFlag::class);
            $parts[] = Auth::user()?->role;
        }

        return substr(md5(implode('|', $parts)), 0, 12);
    }

    private function js(array $snap, bool $private): Response
    {
        $json = json_encode($snap, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);

        return response("window.Ann&&Ann.DB&&Ann.DB.applyServer({$json});\n", 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            // Versi ada di URL, jadi aman di-cache lama
            'Cache-Control' => ($private ? 'private' : 'public') . ', max-age=31536000, immutable',
        ]);
    }

    public function public(): Response
    {
        return $this->js([
            'scope' => 'public',
            'settings' => FeData::settings(false),
            'categories' => Category::orderBy('sort_order')->orderBy('name')->get()->map(fn ($c) => FeData::toFeCategory($c))->all(),
            'products' => Product::orderBy('sort_order')->orderBy('id')->get()->map(fn ($p) => FeData::toFeProduct($p, false))->all(),
            'packages' => Package::with('items')->orderBy('sort_order')->orderBy('id')->get()->map(fn ($k) => FeData::toFePackage($k))->all(),
            'promos' => Promo::orderBy('id')->get()->map(fn ($p) => FeData::toFePromo($p))->all(),
            'reviews' => Review::with(['booking', 'sale'])->where('is_visible', true)->latest('id')->get()->map(fn ($r) => FeData::toFeReview($r))->all(),
            // Data staff yang mungkin tertinggal dari data demo di browser pengunjung dibersihkan
            'clear' => ['expenses', 'incomes', 'customerMeta'],
        ], false);
    }

    public function staff(): Response
    {
        $isOwner = Auth::user()?->role === 'owner';
        $manual = Finance::with(['creator', 'voider'])->where('source', 'manual')->orderByDesc('transaction_date')->orderByDesc('id')->get();

        return $this->js([
            'scope' => 'staff',
            'settings' => $isOwner ? FeData::settings(true) : [],
            'products' => Product::orderBy('sort_order')->orderBy('id')->get()->map(fn ($p) => FeData::toFeProduct($p, true))->all(),
            'reviews' => Review::with(['booking', 'sale'])->latest('id')->get()->map(fn ($r) => FeData::toFeReview($r))->all(),
            'customerMeta' => (object) FeData::customerMeta(),   // objek {email: …}, bukan array kosong []
            'expenses' => $manual->where('type', 'expense')->map(fn ($f) => FeData::toFeFinance($f))->values()->all(),
            'incomes' => $manual->where('type', 'income')->map(fn ($f) => FeData::toFeFinance($f))->values()->all(),
        ], true);
    }

    /** Data milik akun yang sedang masuk, ditulis langsung di layout (tidak di-cache). */
    public static function userData(): array
    {
        $u = Auth::user();
        if (! $u) {
            return [];
        }

        return [
            'scope' => 'user',
            'email' => $u->email,
            'notifications' => UserNotification::where('user_id', $u->id)->latest('updated_at')->limit(150)->get()
                ->map(fn ($n) => FeData::toFeNotification($n, $u->email))->all(),
        ];
    }
}
