<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Mail\StaffAccountCreated;
use App\Mail\StaffPasswordReset;
use App\Models\ActivityLog;
use App\Models\EmailLog;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StaffController extends Controller
{
    /**
     * Parse input ID yang mungkin diawali 'u' (contoh: 'u1' -> 1).
     */
    protected function parseUserId(mixed $id): int
    {
        if (is_string($id) && str_starts_with($id, 'u')) {
            $id = substr($id, 1);
        }
        return (int) $id;
    }

    /**
     * Hitung jumlah Owner aktif saat ini.
     */
    protected function activeOwnerCount(): int
    {
        return User::where('role', 'owner')
            ->where('status', 'aktif')
            ->count();
    }

    /**
     * Menghapus seluruh sesi login aktif user di tabel sessions.
     */
    protected function invalidateUserSessions(int $userId): void
    {
        if (Schema::hasTable('sessions')) {
            DB::table('sessions')->where('user_id', $userId)->delete();
        }
    }

    /**
     * Format data user untuk respon API panel staf.
     */
    protected function formatUser(User $u): array
    {
        return [
            'id' => 'u' . $u->id,
            'userId' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->phone ?? '',
            'address' => $u->address ?? '',
            'role' => $u->role,
            'status' => $u->status,
            'mustChangePw' => (bool) $u->must_change_password,
            'must_change_password' => (bool) $u->must_change_password,
            'lastLogin' => $u->last_login_at?->toIso8601String(),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
            'lastLogout' => $u->last_logout_at?->toIso8601String(),
            'last_logout_at' => $u->last_logout_at?->toIso8601String(),
            'createdBy' => $u->created_by ? 'u' . $u->created_by : null,
            'created_by' => $u->created_by,
            'createdAt' => $u->created_at?->toIso8601String(),
            'created_at' => $u->created_at?->toIso8601String(),
            'activity_count' => ActivityLog::where('user_id', $u->id)->count(),
        ];
    }

    /**
     * GET /api/owner/staff
     * Daftar seluruh staf (Admin & Owner) beserta filter.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::whereIn('role', ['admin', 'owner']);

        if ($request->filled('q')) {
            $q = strtolower(trim($request->input('q')));
            $query->where(function ($sub) use ($q) {
                $sub->whereRaw('LOWER(name) LIKE ?', ["%{$q}%"])
                    ->orWhereRaw('LOWER(email) LIKE ?', ["%{$q}%"]);
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        $staffs = $query->orderByRaw("CASE WHEN status = 'nonaktif' THEN 1 ELSE 0 END")
            ->orderByRaw("CASE WHEN role = 'owner' THEN 0 ELSE 1 END")
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $staffs->map(fn(User $u) => $this->formatUser($u)),
        ]);
    }

    /**
     * POST /api/owner/staff
     * Menambahkan akun staf baru dengan kata sandi sementara.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['required', Rule::in(['admin', 'owner'])],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'send_email' => ['nullable', 'boolean'],
        ], [
            'name.required' => 'Nama staf wajib diisi.',
            'name.min' => 'Nama minimal 3 huruf.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email belum benar.',
            'email.unique' => 'Email ini sudah terdaftar.',
            'role.required' => 'Pilih role staf (Admin atau Owner).',
        ]);

        // Generate kata sandi sementara 10 karakter acak
        $tempPassword = Str::password(10, letters: true, numbers: true, symbols: false);

        $currentUser = Auth::user();

        $user = User::create([
            'name' => trim($validated['name']),
            'email' => strtolower(trim($validated['email'])),
            'phone' => isset($validated['phone']) ? trim($validated['phone']) : null,
            'role' => $validated['role'],
            'status' => $validated['status'] ?? 'aktif',
            'password' => $tempPassword, // otomatis di-hash oleh casts User model
            'must_change_password' => true,
            'created_by' => $currentUser?->id,
        ]);

        // Catat ke audit log hash chain (tanpa menyimpan kata sandi)
        Audit::log(
            'staff',
            "Menambahkan staf baru: {$user->name} ({$user->role})",
            $user
        );

        $mailStatus = ['status' => 'lewati'];
        $shouldSend = $request->boolean('send_email', true);

        if ($shouldSend) {
            try {
                Mail::to($user->email)->send(new StaffAccountCreated($user, $currentUser ?? $user, $tempPassword));

                EmailLog::create([
                    'kind' => 'staff_invite',
                    'to' => $user->email,
                    'subject' => 'Anda telah ditambahkan sebagai Staff Annapurna Adventure Shop',
                    'status' => 'terkirim',
                    'sent_at' => now(),
                ]);

                $mailStatus = ['status' => 'terkirim'];
            } catch (\Throwable $e) {
                EmailLog::create([
                    'kind' => 'staff_invite',
                    'to' => $user->email,
                    'subject' => 'Anda telah ditambahkan sebagai Staff Annapurna Adventure Shop',
                    'status' => 'gagal',
                    'error' => $e->getMessage(),
                ]);

                $mailStatus = [
                    'status' => 'gagal',
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'ok' => true,
            'user' => $this->formatUser($user),
            'temp_password' => $tempPassword,
            'mail' => $mailStatus,
        ], 201);
    }

    /**
     * PATCH /api/owner/staff/{id}
     * Memperbarui profil, role, atau status staf.
     */
    public function update(Request $request, mixed $id): JsonResponse
    {
        $userId = $this->parseUserId($id);
        $user = User::whereIn('role', ['admin', 'owner'])->findOrFail($userId);
        $currentUser = Auth::user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['nullable', Rule::in(['admin', 'owner'])],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
        ]);

        $isSelf = ($currentUser && $currentUser->id === $user->id);

        // Aturan: Minimal harus ada 1 Owner aktif
        $targetRole = $isSelf ? $user->role : ($validated['role'] ?? $user->role);
        $targetStatus = $isSelf ? $user->status : ($validated['status'] ?? $user->status);

        if ($user->role === 'owner' && $user->status === 'aktif') {
            if (($targetRole !== 'owner' || $targetStatus !== 'aktif') && $this->activeOwnerCount() <= 1) {
                return response()->json([
                    'ok' => false,
                    'msg' => 'Minimal harus ada satu Owner aktif.',
                ], 422);
            }
        }

        $before = $user->only(['name', 'email', 'phone', 'role', 'status']);

        $user->name = trim($validated['name']);
        $user->email = strtolower(trim($validated['email']));
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'] ? trim($validated['phone']) : null;
        }

        if (!$isSelf) {
            if (isset($validated['role'])) {
                $user->role = $validated['role'];
            }
            if (isset($validated['status'])) {
                $user->status = $validated['status'];
            }
        }

        $user->save();

        $after = $user->only(['name', 'email', 'phone', 'role', 'status']);
        $changes = Audit::diff($before, $after, [
            'name' => 'Nama lengkap',
            'email' => 'Email',
            'phone' => 'Nomor WhatsApp',
            'role' => 'Role',
            'status' => 'Status',
        ]);

        if (!empty($changes)) {
            Audit::log(
                'staff',
                "Memperbarui data staf {$user->name}",
                $user,
                $changes
            );
        }

        // Bila status diubah menjadi nonaktif, batalkan sesi login aktifnya
        if ($user->status === 'nonaktif') {
            $this->invalidateUserSessions($user->id);
            $user->update(['remember_token' => Str::random(60)]);
        }

        return response()->json([
            'ok' => true,
            'user' => $this->formatUser($user),
            'changes' => $changes,
        ]);
    }

    /**
     * POST /api/owner/staff/{id}/toggle
     * Mengaktifkan atau menonaktifkan akun staf.
     */
    public function toggle(Request $request, mixed $id): JsonResponse
    {
        $userId = $this->parseUserId($id);
        $user = User::whereIn('role', ['admin', 'owner'])->findOrFail($userId);
        $currentUser = Auth::user();

        if ($currentUser && $currentUser->id === $user->id) {
            return response()->json([
                'ok' => false,
                'msg' => 'Anda tidak dapat menonaktifkan akun Anda sendiri.',
            ], 422);
        }

        $newStatus = ($user->status === 'aktif') ? 'nonaktif' : 'aktif';

        if ($newStatus === 'nonaktif' && $user->role === 'owner' && $this->activeOwnerCount() <= 1) {
            return response()->json([
                'ok' => false,
                'msg' => 'Minimal harus ada satu Owner aktif.',
            ], 422);
        }

        $user->update(['status' => $newStatus]);

        Audit::log(
            'staff',
            "Mengubah status staf {$user->name} menjadi {$newStatus}",
            $user
        );

        if ($newStatus === 'nonaktif') {
            $this->invalidateUserSessions($user->id);
            $user->update(['remember_token' => Str::random(60)]);
        }

        return response()->json([
            'ok' => true,
            'user' => $this->formatUser($user),
        ]);
    }

    /**
     * POST /api/owner/staff/{id}/reset-password
     * Mereset kata sandi staf dan membatalkan semua sesi login lama.
     */
    public function resetPassword(Request $request, mixed $id): JsonResponse
    {
        $userId = $this->parseUserId($id);
        $user = User::whereIn('role', ['admin', 'owner'])->findOrFail($userId);
        $currentUser = Auth::user();

        if ($currentUser && $currentUser->id === $user->id) {
            return response()->json([
                'ok' => false,
                'msg' => 'Gunakan menu ganti sandi profil untuk mengubah kata sandi Anda sendiri.',
            ], 422);
        }

        // Rate limit: maksimal 5x reset sandi per staf per jam
        $throttleKey = "reset-password:{$user->id}";
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'ok' => false,
                'msg' => "Terlalu banyak permintaan reset sandi untuk akun ini. Coba lagi dalam {$seconds} detik.",
            ], 429);
        }
        RateLimiter::hit($throttleKey, 3600);

        // Generate kata sandi baru 10 karakter acak
        $tempPassword = Str::password(10, letters: true, numbers: true, symbols: false);

        $user->password = $tempPassword;
        $user->must_change_password = true;
        $user->remember_token = Str::random(60);
        $user->save();

        // Batalkan seluruh sesi login aktif staf tsb
        $this->invalidateUserSessions($user->id);

        Audit::log(
            'staff',
            "Mereset kata sandi staf {$user->name}",
            $user
        );

        $mailStatus = ['status' => 'terkirim'];
        try {
            Mail::to($user->email)->send(new StaffPasswordReset($user, $currentUser ?? $user, $tempPassword));

            EmailLog::create([
                'kind' => 'password_reset',
                'to' => $user->email,
                'subject' => 'Kata sandi sementara akun Staff Annapurna Adventure',
                'status' => 'terkirim',
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            EmailLog::create([
                'kind' => 'password_reset',
                'to' => $user->email,
                'subject' => 'Kata sandi sementara akun Staff Annapurna Adventure',
                'status' => 'gagal',
                'error' => $e->getMessage(),
            ]);

            $mailStatus = [
                'status' => 'gagal',
                'error' => $e->getMessage(),
            ];
        }

        return response()->json([
            'ok' => true,
            'temp_password' => $tempPassword,
            'mail' => $mailStatus,
        ]);
    }

    /**
     * POST /api/akun/ganti-sandi atau POST /akun/kata-sandi
     * Ganti kata sandi oleh pengguna yang sedang login (wajib ganti atau mandiri).
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'msg' => 'Sesi login tidak valid.',
            ], 401);
        }

        $mustChange = (bool) $user->must_change_password;

        $rules = [
            'password' => ['required', 'string', 'min:6'],
        ];

        // Jika tidak sedang dalam mode wajib ganti, current_password wajib dicek
        if (!$mustChange) {
            $rules['current_password'] = ['required', 'string'];
        } else {
            $rules['current_password'] = ['nullable', 'string'];
        }

        $validated = $request->validate($rules, [
            'current_password.required' => 'Masukkan kata sandi lama / sementara.',
            'password.required' => 'Masukkan kata sandi baru.',
            'password.min' => 'Kata sandi minimal 6 karakter.',
        ]);

        if (!$mustChange && !Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'ok' => false,
                'field' => 'current_password',
                'msg' => 'Kata sandi lama salah.',
                'errors' => [
                    'current_password' => ['Kata sandi lama salah.'],
                ],
            ], 422);
        }

        // Kata sandi baru tidak boleh sama dengan kata sandi saat ini
        if (Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'ok' => false,
                'field' => 'password',
                'msg' => 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
                'errors' => [
                    'password' => ['Kata sandi baru harus berbeda dari kata sandi saat ini.'],
                ],
            ], 422);
        }

        $user->password = $validated['password'];
        $user->must_change_password = false;
        $user->remember_token = Str::random(60);
        $user->save();

        if ($user->isStaff()) {
            Audit::log(
                'staff',
                "Mengubah kata sandi akun {$user->name}",
                $user
            );
        }

        return response()->json([
            'ok' => true,
            'msg' => 'Kata sandi berhasil diperbarui.',
        ]);
    }
}
