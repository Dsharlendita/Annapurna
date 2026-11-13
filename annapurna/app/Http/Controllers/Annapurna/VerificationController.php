<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Mail\LoginCodeMail;
use App\Models\EmailLog;
use App\Models\LoginCode;
use App\Models\User;
use App\Support\AuthPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Kode verifikasi lewat email untuk:
 *   - "Masuk dengan kode"  (purpose = login, khusus customer)
 *   - "Lupa kata sandi"     (purpose = reset, customer & Owner; Admin minta Owner)
 *
 *   POST /api/kode/kirim       { identifier, purpose }        → kirim kode ke email akun
 *   POST /api/kode/cek         { identifier, purpose, code }  → login: langsung masuk; reset: lanjut buat kata sandi
 *   POST /api/kode/sandi-baru  { password, password_confirmation } → simpan kata sandi baru lalu masuk
 */
class VerificationController extends Controller
{
    private function fail(string $msg, int $status = 422, string $field = 'identifier'): JsonResponse
    {
        return response()->json(['ok' => false, 'field' => $field, 'msg' => $msg], $status);
    }

    /** Cari akun dari email atau nomor HP/WhatsApp. */
    private function findUser(string $identifier): ?User
    {
        $id = strtolower(trim($identifier));
        if (str_contains($id, '@')) {
            return User::where('email', $id)->first();
        }
        $phone = preg_replace('/^62/', '0', preg_replace('/\D/', '', $id));
        if (strlen($phone) < 9) {
            return null;
        }

        return User::whereNotNull('phone')->get(['id', 'phone'])
            ->first(fn ($u) => preg_replace('/^62/', '0', preg_replace('/\D/', '', (string) $u->phone)) === $phone)
            ?->fresh();
    }

    /** nama@gmail.com → na•••@gmail.com */
    private function mask(string $email): string
    {
        return preg_replace('/^(.{2}).*(@.*)$/', '$1•••$2', $email);
    }

    private function hasRealEmail(User $u): bool
    {
        return filter_var($u->email, FILTER_VALIDATE_EMAIL) && ! str_ends_with(strtolower($u->email), '@annapurna.local');
    }

    /** Pemeriksaan bersama: akun ada, aktif, boleh memakai fitur ini. */
    private function checkUser(?User $u, string $purpose): ?JsonResponse
    {
        if (! $u) {
            return $this->fail('Email atau nomor WhatsApp belum terdaftar.');
        }
        if ($u->status === 'nonaktif') {
            return $this->fail('Akun ini sedang dinonaktifkan. Hubungi toko untuk informasi lebih lanjut.', 403);
        }
        if ($purpose === 'login' && $u->isStaff()) {
            return $this->fail('Akun staff masuk memakai email dan kata sandi.');
        }
        if ($purpose === 'reset' && $u->role === 'admin') {
            return $this->fail('Akun staff: minta Owner mengatur ulang kata sandi lewat Manajemen Staff.');
        }
        if (! $this->hasRealEmail($u)) {
            return $this->fail('Akun ini belum punya alamat email. Hubungi toko lewat WhatsApp untuk bantuan masuk.');
        }

        return null;
    }

    public function send(Request $request): JsonResponse
    {
        $v = $request->validate([
            'identifier' => 'required|string|max:120',
            'purpose' => 'required|in:login,reset',
        ], ['identifier.required' => 'Isi email atau nomor WhatsApp.']);

        $u = $this->findUser($v['identifier']);
        if ($err = $this->checkUser($u, $v['purpose'])) {
            return $err;
        }

        $last = LoginCode::where('user_id', $u->id)->where('purpose', $v['purpose'])->latest('id')->first();
        if ($last && $last->created_at->gt(now()->subSeconds(LoginCode::RESEND_SECONDS))) {
            $wait = LoginCode::RESEND_SECONDS - $last->created_at->diffInSeconds(now());

            return $this->fail("Tunggu {$wait} detik sebelum meminta kode baru.", 429);
        }
        if (LoginCode::where('user_id', $u->id)->where('created_at', '>', now()->subHour())->count() >= LoginCode::MAX_PER_HOUR) {
            return $this->fail('Terlalu banyak permintaan kode. Coba lagi dalam 1 jam.', 429);
        }

        [$row, $code] = LoginCode::issue($u, $v['purpose'], $u->email, $request->ip());
        $mail = new LoginCodeMail($u, $code, $v['purpose'], LoginCode::VALID_MINUTES);
        try {
            Mail::to($u->email)->send($mail);
            EmailLog::create(['kind' => 'kode_' . $v['purpose'], 'to' => $u->email, 'subject' => 'Kode verifikasi Annapurna Adventure', 'status' => 'terkirim', 'sent_at' => now()]);
        } catch (\Throwable $e) {
            $row->update(['used_at' => now()]);   // kode yang tidak terkirim langsung tidak berlaku
            EmailLog::create(['kind' => 'kode_' . $v['purpose'], 'to' => $u->email, 'subject' => 'Kode verifikasi Annapurna Adventure', 'status' => 'gagal', 'error' => mb_substr($e->getMessage(), 0, 500)]);
            report($e);

            return $this->fail('Email kode gagal dikirim. Coba lagi beberapa saat, atau hubungi toko lewat WhatsApp.', 503);
        }

        return response()->json([
            'ok' => true,
            'dest' => $this->mask($u->email),
            'name' => $u->name,
            'minutes' => LoginCode::VALID_MINUTES,
            'resendIn' => LoginCode::RESEND_SECONDS,
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $v = $request->validate([
            'identifier' => 'required|string|max:120',
            'purpose' => 'required|in:login,reset',
            'code' => 'required|string',
            'next' => 'nullable|string|max:300',
        ], ['code.required' => 'Isi kode verifikasi.']);

        $u = $this->findUser($v['identifier']);
        if ($err = $this->checkUser($u, $v['purpose'])) {
            return $err;
        }

        return DB::transaction(function () use ($request, $v, $u) {
            $row = LoginCode::where('id', LoginCode::active($u, $v['purpose'])?->id)->lockForUpdate()->first();
            if (! $row) {
                return $this->fail('Kode sudah kedaluwarsa atau sudah dipakai. Kirim ulang kode.', 422, 'code');
            }
            if (! Hash::check(preg_replace('/\D/', '', $v['code']), $row->code_hash)) {
                $row->increment('attempts');
                $left = LoginCode::MAX_ATTEMPTS - $row->attempts;

                return $this->fail($left > 0 ? "Kode tidak cocok. Sisa {$left} kali percobaan." : 'Kode salah 5 kali. Kirim ulang kode baru.', 422, 'code');
            }
            $row->update(['used_at' => now()]);

            if ($v['purpose'] === 'reset') {
                // Lanjut ke langkah "kata sandi baru"; izin berlaku 10 menit di sesi ini saja
                $request->session()->put('pw_reset', ['user_id' => $u->id, 'until' => now()->addMinutes(10)->timestamp]);

                return response()->json(['ok' => true, 'step' => 'password']);
            }

            return $this->signIn($request, $u, $v['next'] ?? null);
        });
    }

    public function newPassword(Request $request): JsonResponse
    {
        $v = $request->validate([
            'password' => 'required|string|min:6|confirmed',
        ], [
            'password.min' => 'Kata sandi minimal 6 karakter.',
            'password.confirmed' => 'Kata sandi tidak sama.',
        ]);

        $grant = $request->session()->get('pw_reset');
        $u = $grant && $grant['until'] >= now()->timestamp ? User::find($grant['user_id']) : null;
        if (! $u) {
            return $this->fail('Waktu verifikasi habis. Ulangi dari kirim kode.', 422, 'password');
        }

        $u->forceFill(['password' => Hash::make($v['password']), 'must_change_password' => false, 'password_set' => true])->save();
        // Semua sesi lama akun ini dikeluarkan (mis. bila kata sandi lama diketahui orang lain)
        DB::table('sessions')->where('user_id', $u->id)->delete();
        $request->session()->forget('pw_reset');

        return $this->signIn($request, $u, null);
    }

    private function signIn(Request $request, User $u, ?string $next): JsonResponse
    {
        Auth::login($u, true);
        $request->session()->regenerate();
        $u->update(['last_login_at' => now()]);

        return response()->json(['ok' => true, 'user' => AuthPayload::user($u), 'redirect' => AuthPayload::redirect($u, $next)]);
    }
}
