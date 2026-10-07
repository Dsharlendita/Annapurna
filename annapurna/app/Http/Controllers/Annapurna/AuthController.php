<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Proses Login Pengguna (Customer, Admin, Owner).
     */
    public function login(Request $request): JsonResponse|RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ], [
            'email.required' => 'Isi email kamu.',
            'email.email' => 'Format email belum benar.',
            'password.required' => 'Isi kata sandi.',
        ]);

        $user = User::where('email', strtolower(trim($credentials['email'])))->first();

        if (!$user) {
            if ($request->wantsJson()) {
                return response()->json([
                    'ok' => false,
                    'field' => 'email',
                    'msg' => 'Email belum terdaftar. Periksa lagi atau daftar akun baru.',
                ], 422);
            }
            throw ValidationException::withMessages([
                'email' => 'Email belum terdaftar. Periksa lagi atau daftar akun baru.',
            ]);
        }

        if ($user->status === 'nonaktif') {
            if ($request->wantsJson()) {
                return response()->json([
                    'ok' => false,
                    'field' => 'email',
                    'msg' => 'Akun ini sedang dinonaktifkan oleh Owner. Hubungi Owner untuk informasi lebih lanjut.',
                ], 403);
            }
            throw ValidationException::withMessages([
                'email' => 'Akun ini sedang dinonaktifkan oleh Owner. Hubungi Owner.',
            ]);
        }

        if (!Auth::attempt(['email' => $user->email, 'password' => $credentials['password']], $request->boolean('remember', true))) {
            if ($user->isStaff()) {
                ActivityLog::record(
                    $user->id,
                    'login_gagal',
                    'Percobaan login gagal: kata sandi salah'
                );
            }

            if ($request->wantsJson()) {
                return response()->json([
                    'ok' => false,
                    'field' => 'password',
                    'msg' => 'Kata sandi salah. Coba lagi.',
                ], 422);
            }

            throw ValidationException::withMessages([
                'password' => 'Kata sandi salah. Coba lagi.',
            ]);
        }

        $request->session()->regenerate();

        $user->update([
            'last_login_at' => now(),
        ]);

        if ($user->isStaff()) {
            ActivityLog::record(
                $user->id,
                'login',
                "Login ke panel {$user->role}"
            );
        }

        $redirectUrl = match ($user->role) {
            'owner' => route('owner.dashboard'),
            'admin' => route('admin.dashboard'),
            default => route('home'),
        };

        if ($request->filled('next')) {
            $redirectUrl = $request->input('next');
        }

        if ($request->wantsJson()) {
            return response()->json([
                'ok' => true,
                'user' => [
                    'id' => 'u' . $user->id,
                    'userId' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $user->status,
                    'phone' => $user->phone ?? '',
                    'address' => $user->address ?? '',
                    'mustChangePw' => (bool)$user->must_change_password,
                ],
                'redirect' => $redirectUrl,
            ]);
        }

        return redirect()->intended($redirectUrl);
    }

    /**
     * Proses Pendaftaran Akun Customer Baru.
     */
    public function register(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:6'],
            'address' => ['nullable', 'string'],
        ], [
            'name.required' => 'Nama lengkap wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.unique' => 'Email ini sudah terdaftar.',
            'phone.required' => 'Nomor WhatsApp wajib diisi.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.min' => 'Kata sandi minimal 6 karakter.',
        ]);

        $user = User::create([
            'name' => trim($validated['name']),
            'email' => strtolower(trim($validated['email'])),
            'phone' => trim($validated['phone']),
            'password' => $validated['password'], // otomatis di-hash oleh casts 'password' => 'hashed' di User model
            'role' => 'customer',
            'status' => 'aktif',
            'address' => $validated['address'] ?? null,
            'last_login_at' => now(),
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        $redirectUrl = route('home');
        if ($request->filled('next')) {
            $redirectUrl = $request->input('next');
        }

        if ($request->wantsJson()) {
            return response()->json([
                'ok' => true,
                'user' => [
                    'id' => 'u' . $user->id,
                    'userId' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $user->status,
                    'phone' => $user->phone ?? '',
                    'address' => $user->address ?? '',
                ],
                'redirect' => $redirectUrl,
            ]);
        }

        return redirect($redirectUrl);
    }

    /**
     * Proses Keluar / Logout.
     */
    public function logout(Request $request): JsonResponse|RedirectResponse
    {
        $user = Auth::user();

        if ($user && $user->isStaff()) {
            ActivityLog::record(
                $user->id,
                'logout',
                "Logout dari panel {$user->role}"
            );
            $user->update(['last_logout_at' => now()]);
        }

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->wantsJson()) {
            return response()->json([
                'ok' => true,
                'redirect' => route('masuk'),
            ]);
        }

        return redirect()->route('masuk');
    }

    /**
     * Mendapatkan data sesi user yang sedang aktif.
     */
    public function me(): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['authenticated' => false, 'user' => null]);
        }

        return response()->json([
            'authenticated' => true,
            'user' => [
                'id' => 'u' . $user->id,
                'userId' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone ?? '',
                'address' => $user->address ?? '',
                'status' => $user->status,
                'mustChangePw' => (bool)$user->must_change_password,
            ],
        ]);
    }
}
