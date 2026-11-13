<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Category;
use App\Models\CustomerFlag;
use App\Models\Finance;
use App\Models\Product;
use App\Models\Promo;
use App\Models\Review;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Audit;
use App\Support\FeData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * POST /api/sync/{collection}  { items: [...] | {...}, removed: [id, ...] }
 *
 * Menerima perubahan yang dibuat di tampilan (data.js menulis ke penyimpanan browser,
 * lalu mengirim selisihnya ke sini). Setiap koleksi punya aturan siapa yang boleh mengubah.
 * Jawaban: { ok, map: { idLama: idBaru }, skipped: [...] }. Tampilan mengganti ID lokal
 * dengan ID server dari `map`.
 */
class SyncController extends Controller
{
    private const STAFF = ['admin', 'owner'];

    private array $map = [];
    private array $skipped = [];

    public function sync(Request $request, string $collection): JsonResponse
    {
        $handler = match ($collection) {
            'products' => 'products',
            'categories' => 'categories',
            'promos' => 'promos',
            'reviews' => 'reviews',
            'expenses' => 'expenses',
            'incomes' => 'incomes',
            'customerMeta' => 'customerMeta',
            'settings' => 'settings',
            'notifications' => 'notifications',
            default => null,
        };
        abort_unless($handler !== null, 404, 'Jenis data tidak dikenal.');

        $items = $request->input('items', []);
        $removed = array_values(array_filter((array) $request->input('removed', []), 'is_scalar'));
        abort_unless(is_array($items), 422, 'Format data tidak valid.');

        DB::transaction(fn () => $this->{$handler}($items, $removed));
        BootController::bump();

        return response()->json(['ok' => true, 'map' => (object) $this->map, 'skipped' => $this->skipped]);
    }

    private function user(): User
    {
        return Auth::user();
    }

    private function staffOnly(): void
    {
        abort_unless(in_array($this->user()->role, self::STAFF, true), 403, 'Hanya staff yang boleh mengubah data ini.');
    }

    /** Gambar baru dari tampilan dikirim sebagai data URL; simpan sebagai file di storage/public. */
    private function storeImage(?string $img, string $dir): ?string
    {
        if (! $img || ! str_starts_with($img, 'data:image/')) {
            return $img;
        }
        if (! preg_match('#^data:image/(png|jpe?g|webp|gif);base64,(.+)$#', $img, $m)) {
            return null;
        }
        $bin = base64_decode($m[2], true);
        if ($bin === false || strlen($bin) > 5 * 1024 * 1024) {
            return null;
        }
        $path = $dir . '/' . Str::random(20) . '.' . ($m[1] === 'jpeg' ? 'jpg' : $m[1]);
        Storage::disk('public')->put($path, $bin);

        return 'storage/' . $path;
    }

    // ------------------------------------------------------------------ Katalog

    private function categories(array $items, array $removed): void
    {
        $this->staffOnly();
        foreach ($items as $x) {
            if (empty($x['id'])) {
                continue;
            }
            $attrs = FeData::fromFeCategory($x);
            $attrs['img'] = $this->storeImage($attrs['img'], 'categories');
            Category::updateOrCreate(['id' => $attrs['id']], $attrs);
        }
        foreach ($removed as $id) {
            // Kategori yang masih dipakai produk tidak dihapus, cukup dinonaktifkan
            Product::where('category_id', $id)->exists()
                ? Category::whereKey($id)->update(['is_active' => false])
                : Category::whereKey($id)->delete();
        }
        if ($items || $removed) {
            Audit::log('katalog', 'Memperbarui kategori: ' . implode(', ', array_column($items, 'name') ?: $removed));
        }
    }

    private function products(array $items, array $removed): void
    {
        $this->staffOnly();
        foreach ($items as $x) {
            if (empty($x['id']) || empty($x['cat'])) {
                $this->skipped[] = $x['id'] ?? '?';
                continue;
            }
            if (! Category::whereKey($x['cat'])->exists()) {
                Category::create(['id' => $x['cat'], 'name' => Str::headline($x['cat'])]);
            }
            $attrs = FeData::fromFeProduct($x);
            $attrs['img'] = $this->storeImage($attrs['img'], 'products');
            $p = Product::whereKey($attrs['id'])->lockForUpdate()->first();
            // Stok dikirim sebagai selisih dari angka server terakhir yang dilihat tampilan,
            // jadi penjualan online yang sudah mengurangi stok di server tidak tertimpa.
            if ($p && isset($x['_stockFrom']) && is_numeric($x['_stockFrom'])) {
                $attrs['stock'] = max(0, (int) $p->stock + ($attrs['stock'] - (int) $x['_stockFrom']));
            }
            $p ? $p->update($attrs) : Product::create($attrs);
        }
        foreach ($removed as $id) {
            // Produk yang pernah dipakai transaksi hanya dinonaktifkan agar nota lama tetap utuh
            $p = Product::find($id);
            if (! $p) {
                continue;
            }
            $used = DB::table('booking_items')->where('product_id', $id)->exists() || DB::table('sale_items')->where('product_id', $id)->exists();
            $used ? $p->update(['is_active' => false]) : $p->delete();
        }
        if ($items || $removed) {
            Audit::log('katalog', 'Memperbarui barang: ' . implode(', ', array_slice(array_column($items, 'name'), 0, 5) ?: $removed));
        }
    }

    // ------------------------------------------------------------------ Promo

    private function promos(array $items, array $removed): void
    {
        $this->staffOnly();
        foreach ($items as $x) {
            if (empty($x['code'])) {
                continue;
            }
            $attrs = FeData::fromFePromo($x);
            $srvId = preg_match('/^PR-(\d+)$/', (string) ($x['id'] ?? ''), $m) ? (int) $m[1] : null;
            $promo = ($srvId ? Promo::find($srvId) : null) ?? Promo::where('code', $attrs['code'])->first();
            if ($promo && $promo->code !== $attrs['code'] && Promo::where('code', $attrs['code'])->exists()) {
                $this->skipped[] = $x['id'];   // kode baru bentrok dengan promo lain
                continue;
            }
            $promo ? $promo->update($attrs) : $promo = Promo::create($attrs);
            if (($x['id'] ?? null) !== 'PR-' . $promo->id) {
                $this->map[$x['id'] ?? $attrs['code']] = 'PR-' . $promo->id;
            }
        }
        foreach ($removed as $id) {
            if (preg_match('/^PR-(\d+)$/', (string) $id, $m)) {
                Promo::whereKey((int) $m[1])->delete();
            }
        }
        if ($items) {
            Audit::log('promo', 'Memperbarui promo: ' . implode(', ', array_column($items, 'code')));
        }
    }

    // ------------------------------------------------------------------ Ulasan

    private function reviews(array $items, array $removed): void
    {
        $u = $this->user();
        $isStaff = in_array($u->role, self::STAFF, true);

        foreach ($items as $x) {
            $srvId = preg_match('/^REV-(\d+)$/', (string) ($x['id'] ?? ''), $m) ? (int) $m[1] : null;
            $review = $srvId ? Review::find($srvId) : null;
            $ref = (string) ($x['refId'] ?? '');
            $booking = $ref !== '' ? Booking::findByRef($ref) : null;
            $sale = $ref !== '' && ! $booking ? Sale::where('sale_code', $ref)->orWhere('nota_no', $ref)->first() : null;

            if (! $isStaff) {
                // Customer hanya boleh menulis / mengubah ulasannya sendiri untuk transaksinya sendiri
                $own = ($booking && $booking->user_id === $u->id) || ($sale && $sale->user_id === $u->id)
                    || ($booking && strcasecmp($booking->customer_email, $u->email) === 0) || ($sale && strcasecmp((string) $sale->customer_email, $u->email) === 0);
                if (! $own || ($review && $review->user_id !== $u->id)) {
                    $this->skipped[] = $x['id'] ?? '?';
                    continue;
                }
                // Ulasan untuk transaksi yang sama: perbarui, jangan dobel
                $review ??= Review::where('user_id', $u->id)->where($booking ? 'booking_id' : 'sale_id', $booking?->id ?? $sale?->id)->first();
            }

            $attrs = [
                'customer_name' => mb_substr((string) ($x['name'] ?? $u->name), 0, 255),
                'rating' => max(1, min(5, (int) ($x['rating'] ?? 5))),
                'comment' => mb_substr((string) ($x['text'] ?? ''), 0, 2000),
                'product_ids' => array_values(array_filter((array) ($x['productIds'] ?? []), 'is_string')),
            ];
            if (! $review) {
                $attrs += [
                    'booking_id' => $booking?->id,
                    'sale_id' => $sale?->id,
                    'user_id' => $isStaff ? null : $u->id,
                    'customer_email' => $isStaff ? ($x['email'] ?? null) : $u->email,
                ];
            }
            if ($isStaff) {
                $replyChanged = $review && (string) $review->reply !== (string) ($x['reply'] ?? '');
                $attrs += [
                    'customer_label' => $x['role'] ?? null,
                    'avatar' => $this->storeImage($x['img'] ?? null, 'reviews'),
                    'is_visible' => ($x['visible'] ?? true) !== false,
                    'is_featured' => ! empty($x['featured']) && ($x['visible'] ?? true) !== false,
                    'featured_order' => (int) ($x['order'] ?? 0),
                    'reply' => ($x['reply'] ?? '') !== '' ? $x['reply'] : null,
                    'seen_at' => ! empty($x['seen']) ? ($review?->seen_at ?? now()) : null,
                ];
                if ($replyChanged || (! $review && ! empty($x['reply']))) {
                    $attrs += ['reply_at' => now(), 'replied_by' => $u->id];
                }
                if (! $review) {
                    $attrs['customer_email'] = $x['email'] ?? null;
                }
            } elseif (! $review) {
                $attrs += ['customer_label' => $sale ? 'Pembeli' : 'Penyewa', 'is_visible' => true];
            } else {
                $attrs['seen_at'] = null;   // diubah customer â†’ tandai belum dibaca staff
            }

            $review ? $review->update($attrs) : $review = Review::create($attrs);
            if (($x['id'] ?? null) !== 'REV-' . $review->id) {
                $this->map[$x['id'] ?? ('new' . $review->id)] = 'REV-' . $review->id;
            }
        }

        if ($isStaff) {
            foreach ($removed as $id) {
                if (preg_match('/^REV-(\d+)$/', (string) $id, $m)) {
                    Review::whereKey((int) $m[1])->delete();
                }
            }
        }
    }

    // ------------------------------------------------------------------ Keuangan manual

    private function expenses(array $items, array $removed): void
    {
        $this->finance('expense', $items);
    }

    private function incomes(array $items, array $removed): void
    {
        $this->finance('income', $items);
    }

    /** Pemasukan lain / pengeluaran yang dicatat staff. Tidak bisa dihapus, hanya dibatalkan. */
    private function finance(string $type, array $items): void
    {
        $this->staffOnly();
        $u = $this->user();
        foreach ($items as $x) {
            $newCode = null;
            $amount = (int) ($x['amount'] ?? 0);
            if (empty($x['id']) || $amount <= 0) {
                $this->skipped[] = $x['id'] ?? '?';
                continue;
            }
            $f = Finance::where('finance_code', $x['id'])->first();
            if ($f && ($f->source !== 'manual' || $f->type !== $type)) {
                $f = null;   // kode sama milik baris lain â†’ buat kode baru
                $newCode = Finance::generateCode($type);
            }
            $line = in_array($x['line'] ?? null, ['rent', 'sale', 'umum'], true) ? $x['line'] : null;
            $attrs = [
                'type' => $type,
                'category' => mb_substr((string) ($x['category'] ?? 'Lainnya'), 0, 255),
                'line' => $line,
                'amount' => $amount,
                'transaction_date' => preg_match('/^\d{4}-\d{2}-\d{2}/', (string) ($x['date'] ?? ''), $m) ? $m[0] : now()->toDateString(),
                'description' => (string) ($x['desc'] ?? '-'),
                'ref' => $x['ref'] ?? null,
                'source' => 'manual',
            ];
            $voided = ($x['status'] ?? 'aktif') === 'dibatalkan';
            if ($voided && (! $f || $f->status !== 'dibatalkan')) {
                $attrs += ['status' => 'dibatalkan', 'void_reason' => $x['voidReason'] ?? null, 'voided_by' => $u->id, 'voided_at' => now()];
            }
            if ($f) {
                // Entri yang sudah dibatalkan tidak bisa diaktifkan atau diubah lagi
                if ($f->status !== 'dibatalkan') {
                    $f->update($attrs);
                }
                continue;
            }
            $code = $newCode ?? (preg_match('/^(INC|EXP)-[\w-]{1,40}$/', $x['id']) ? $x['id'] : Finance::generateCode($type));
            $f = Finance::create($attrs + ['finance_code' => $code, 'status' => $voided ? 'dibatalkan' : 'aktif', 'created_by' => $u->id]);
            if ($code !== $x['id']) {
                $this->map[$x['id']] = $code;
            }
        }
    }

    // ------------------------------------------------------------------ Pelanggan

    private function customerMeta(array $items, array $removed): void
    {
        $this->staffOnly();
        foreach ($items as $email => $meta) {
            $email = strtolower(trim((string) $email));
            if (! filter_var($email, FILTER_VALIDATE_EMAIL) || ! is_array($meta)) {
                continue;
            }
            $flag = in_array($meta['flag'] ?? 'normal', ['normal', 'jaminan', 'blacklist'], true) ? $meta['flag'] : 'normal';
            $phone = User::where('email', $email)->value('phone') ?? Booking::where('customer_email', $email)->latest('id')->value('customer_phone');
            CustomerFlag::updateOrCreate(['email' => $email], ['flag' => $flag, 'note' => $meta['note'] ?? null, 'phone' => $phone, 'updated_by' => $this->user()->id]);
            Audit::log('pelanggan', "Mengubah status pelanggan {$email} menjadi {$flag}");
        }
    }

    // ------------------------------------------------------------------ Pengaturan

    private function settings(array $items, array $removed): void
    {
        $this->staffOnly();
        $isOwner = $this->user()->role === 'owner';
        $changed = [];
        foreach ($items as $key => $value) {
            if (! is_string($key) || ! preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/', $key)) {
                continue;
            }
            if (! $isOwner && ! in_array($key, FeData::ADMIN_SETTINGS, true)) {
                $this->skipped[] = $key;
                continue;
            }
            Setting::set($key, $value);
            $changed[] = $key;
        }
        if ($changed) {
            Audit::log('konfigurasi', 'Mengubah pengaturan: ' . implode(', ', $changed));
        }
    }

    // ------------------------------------------------------------------ Notifikasi

    private function notifications(array $items, array $removed): void
    {
        $u = $this->user();
        $isStaff = in_array($u->role, self::STAFF, true);
        $staffEmails = User::whereIn('role', self::STAFF)->pluck('email')->map(fn ($e) => strtolower($e))->all();

        foreach ($items as $x) {
            $email = strtolower((string) ($x['email'] ?? ''));
            $srvId = preg_match('/^N(\d+)$/', (string) ($x['id'] ?? ''), $m) ? (int) $m[1] : null;

            if ($srvId) {
                // Notifikasi yang sudah ada: hanya pemiliknya yang boleh menandai dibaca
                $n = UserNotification::where('id', $srvId)->where('user_id', $u->id)->first();
                if ($n) {
                    $n->update(['read_at' => ! empty($x['read']) ? ($n->read_at ?? now()) : null]);
                }
                continue;
            }
            // Notifikasi baru: customer hanya boleh mengirim ke staff atau ke dirinya sendiri
            if (! $isStaff && ! in_array($email, $staffEmails, true) && $email !== strtolower($u->email)) {
                $this->skipped[] = $x['id'] ?? '?';
                continue;
            }
            $n = UserNotification::send($email, mb_substr((string) ($x['title'] ?? ''), 0, 150), (string) ($x['text'] ?? ''), $x['link'] ?? null);
            if ($n && $email === strtolower($u->email) && isset($x['id'])) {
                $this->map[$x['id']] = 'N' . $n->id;
            }
        }

        foreach ($removed as $id) {
            if (preg_match('/^N(\d+)$/', (string) $id, $m)) {
                UserNotification::where('id', (int) $m[1])->where('user_id', $u->id)->delete();
            }
        }
    }
}
