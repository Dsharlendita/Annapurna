<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\AuthPayload;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

/**
 * Masuk / daftar dengan akun Google.
 *
 *   GET /auth/google            → diarahkan ke halaman pilih akun Google
 *   GET /auth/google/callback   → Google mengembalikan nama & email yang sudah terverifikasi
 *
 * Email sudah ada  → masuk ke akun itu (akun Google ikut disambungkan).
 * Email belum ada  → akun customer baru dibuat otomatis, tanpa kata sandi.
 * Kunci aplikasi Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) diisi di .env.
 */
class GoogleAuthController extends Controller
{
    public static function enabled(): bool
    {
        return filled(config('services.google.client_id')) && filled(config('services.google.client_secret'));
    }

    private function back(string $reason): RedirectResponse
    {
        return redirect()->route('masuk', ['google' => $reason]);
    }

    public function redirect(Request $request): RedirectResponse
    {
        if (! self::enabled()) {
            return $this->back('belum-aktif');
        }
        // Halaman tujuan setelah masuk (hanya alamat di website ini)
        // Tolak alamat luar (https://…, //situs-lain, \\…) supaya tidak bisa dipakai mengalihkan ke situs palsu
        $next = (string) $request->query('next', '');
        $request->session()->put('google_next', preg_match('#^([a-z][a-z0-9+.\-]*:|//|\\\\)#i', $next) ? '' : $next);

        return Socialite::driver('google')->with(['prompt' => 'select_account'])->redirect();
    }

    public function callback(Request $request): RedirectResponse
    {
        if (! self::enabled()) {
            return $this->back('belum-aktif');
        }
        // Owner sedang menghubungkan Google Drive (alamat callback sama, jadi tidak perlu didaftarkan lagi)
        if ($request->session()->pull('google_purpose') === 'drive') {
            return RekapController::finishConnect($request);
        }
        if ($request->filled('error')) {
            return $this->back('batal');               // pengguna menekan "Batal" di halaman Google
        }
        try {
            $g = Socialite::driver('google')->user();
        } catch (\Throwable $e) {
            report($e);

            return $this->back('gagal');
        }

        $email = strtolower((string) $g->getEmail());
        $verified = (bool) data_get($g->user, 'email_verified', data_get($g->user, 'verified_email', true));
        if ($email === '' || ! $verified) {
            return $this->back('email');
        }

        $user = User::where('google_id', $g->getId())->first() ?? User::where('email', $email)->first();
        if ($user && $user->status === 'nonaktif') {
            return redirect()->route('masuk', ['nonaktif' => 1]);
        }

        if (! $user) {
            $user = User::create([
                'name' => $g->getName() ?: Str::before($email, '@'),
                'email' => $email,
                'google_id' => $g->getId(),
                'role' => 'customer',
                'status' => 'aktif',
                'password' => Str::random(40),       // tidak diketahui siapa pun; masuk lewat Google
                'password_set' => false,
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
        } elseif (! $user->google_id) {
            $user->forceFill(['google_id' => $g->getId(), 'email_verified_at' => $user->email_verified_at ?? now()])->save();
        }

        Auth::login($user, true);
        $request->session()->regenerate();
        $user->update(['last_login_at' => now()]);
        if ($user->isStaff()) {
            ActivityLog::record($user->id, 'login', "Login ke panel {$user->role} dengan akun Google");
        }

        $next = $request->session()->pull('google_next') ?: null;

        return redirect()->to(AuthPayload::redirect($user, $next));
    }
}
