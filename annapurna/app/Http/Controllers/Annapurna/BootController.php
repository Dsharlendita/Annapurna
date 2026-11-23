<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\DriveConnection;
use App\Models\CustomerFlag;
use App\Models\Finance;
use App\Models\Package;
use App\Models\PackageItem;
use App\Models\Product;
use App\Models\Promo;
use App\Models\ReportArchive;
use App\Models\Review;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\FeData;
use App\Support\Rekap;
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
            $parts[] = self::stamp(\App\Models\ProductUnit::class);
            // Riwayat restock & daftar staf ikut dikirim di data staf: versi harus berubah bila keduanya berubah
            $parts[] = self::stamp(\App\Models\Restock::class);
            $parts[] = User::whereIn('role', ['owner', 'admin'])->max('updated_at') . '#' . User::whereIn('role', ['owner', 'admin'])->count();
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
            // Data publik (dibaca siapa pun): email pemberi ulasan tidak ikut. Staf mendapatkannya lewat boot-staff.js.
            'reviews' => Review::with(['booking', 'sale'])->where('is_visible', true)->latest('id')->get()->map(fn ($r) => array_merge(FeData::toFeReview($r), ['email' => '']))->all(),
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
            'auditTrack' => true,   // catatan histori baru di perangkat ini dikirim ke server
            'settings' => $isOwner ? FeData::settings(true) : [],
            // Staff: harga modal + unit fisik (kode, keluar/dirawat, riwayat)
            'products' => Product::with('units')->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn ($p) => FeData::toFeProduct($p, true) + ($p->units->isNotEmpty() ? ['units' => $p->units->sortBy('unit_code')->values()->map(fn ($u) => FeData::toFeUnit($u))->all()] : []))->all(),
            'reviews' => Review::with(['booking', 'sale'])->latest('id')->get()->map(fn ($r) => FeData::toFeReview($r))->all(),
            'customerMeta' => (object) FeData::customerMeta(),   // objek {email: …}, bukan array kosong []
            'expenses' => $manual->where('type', 'expense')->map(fn ($f) => FeData::toFeFinance($f))->values()->all(),
            'incomes' => $manual->where('type', 'income')->map(fn ($f) => FeData::toFeFinance($f))->values()->all(),
            // Riwayat restock dari server (dulu hanya tersimpan di browser yang mencatatnya)
            'restocks' => \App\Models\Restock::with(['product:id,name', 'finance:id,finance_code', 'creator:id,name'])->latest('id')->limit(500)->get()->map(fn ($r) => [
                'id' => 'RST' . $r->id, 'productId' => $r->product_id, 'name' => $r->product?->name ?? $r->product_id, 'size' => $r->variant ?? '',
                'qty' => (int) $r->qty, 'cost' => (int) $r->unit_cost, 'date' => $r->restock_date?->toDateString() ?? (string) $r->restock_date,
                'supplier' => $r->supplier ?? '', 'note' => $r->note ?? '', 'by' => $r->creator?->name ?? '',
                'at' => $r->created_at?->copy()->utc()->format('Y-m-d\TH:i:s\Z'), 'expenseId' => $r->finance?->finance_code,
                'kind' => $r->kind, 'units' => $r->unit_codes ?: [],
            ])->all(),
            // Owner: daftar staf yang sebenarnya (dashboard, histori, Manajemen Staff). Dulu memakai daftar bawaan di browser.
            'staffList' => $isOwner ? User::whereIn('role', ['owner', 'admin'])->orderBy('id')->get()->map(fn ($u) => [
                'id' => 'u' . $u->id, 'userId' => $u->id, 'name' => $u->name, 'email' => $u->email, 'phone' => $u->phone ?? '',
                'role' => $u->role, 'status' => $u->status ?? 'aktif', 'mustChangePw' => (bool) $u->must_change_password,
                'lastLogin' => $u->last_login_at?->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
                'lastLogout' => $u->last_logout_at?->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
                'createdAt' => $u->created_at?->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            ])->all() : null,
        ], true);
    }

    /** GET /api/akun/data — data akun yang sama dengan yang ditulis layout (notifikasi dll.), untuk pembaruan otomatis tanpa muat ulang. */
    public function account(): \Illuminate\Http\JsonResponse
    {
        return response()->json(self::userData());
    }

    /** Data milik akun yang sedang masuk, ditulis langsung di layout (tidak di-cache). */
    public static function userData(): array
    {
        $u = Auth::user();
        if (! $u) {
            return [];
        }

        $out = [
            'scope' => 'user',
            'email' => $u->email,
            'notifications' => UserNotification::where('user_id', $u->id)->latest('updated_at')->limit(150)->get()
                ->map(fn ($n) => FeData::toFeNotification($n, $u->email))->all(),
        ];
        if ($u->isStaff()) {
            try {
                // Rekap bulanan yang sudah jatuh tempo: dibuat otomatis oleh perangkat staff yang sedang membuka panel
                $out['rekapDue'] = Rekap::duePeriod();
                if ($u->role === 'owner') {
                    $c = DriveConnection::current();
                    $out['drive'] = [
                        'enabled' => GoogleAuthController::enabled(),
                        'connected' => (bool) $c,
                        'email' => $c?->email,
                        'rootUrl' => $c?->root_folder_id ? 'https://drive.google.com/drive/folders/' . $c->root_folder_id : null,
                        'mailOn' => Rekap::mailEnabled(),
                    ];
                    $out['archives'] = ReportArchive::orderByDesc('period')->get()->map(fn ($a) => Rekap::toFe($a))->all();
                }
            } catch (\Throwable $e) {
                report($e);   // tabel belum dimigrasi: halaman tetap tampil
            }
        }

        return $out;
    }
}
