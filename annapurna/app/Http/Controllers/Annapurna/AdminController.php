<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminController extends Controller
{
    public function dashboard(): View { return view('annapurna.admin.dashboard'); }
    public function booking(): View { return view('annapurna.admin.booking'); }
    public function pengembalian(): View { return view('annapurna.admin.pengembalian'); }
    public function permintaan(): View { return view('annapurna.admin.permintaan'); }
    public function barang(): View { return view('annapurna.admin.barang'); }
    public function penjualan(): View { return view('annapurna.admin.penjualan'); }
    public function keuangan(): View { return view('annapurna.admin.keuangan'); }
    public function laporan(): View { return view('annapurna.admin.laporan'); }
    public function ulasan(): View { return view('annapurna.admin.ulasan'); }
    public function pengaturan(): View { return view('annapurna.admin.pengaturan'); }
    public function sop(): View { return view('annapurna.admin.sop'); }
    public function perawatan(): View { return view('annapurna.admin.perawatan'); }
    public function kalender(): View { return view('annapurna.admin.kalender'); }
    public function kasir(): View { return view('annapurna.admin.kasir'); }
    public function laundry(): View { return view('annapurna.admin.laundry'); }

    /**
     * GET /api/admin/pengaturan
     * Mengambil konfigurasi profil toko dan daftar rekening bank.
     */
    public function getSettings(): JsonResponse
    {
        $settings = [
            'storeName' => Setting::get('store_name', 'Annapurna Adventure'),
            'hours'     => Setting::get('hours', 'Setiap hari, 09.00 – 22.00 WIB'),
            'phone'     => Setting::get('phone', '+62 896 3469 6969'),
            'whatsapp'  => Setting::get('whatsapp', '6289634696969'),
            'email'     => Setting::get('email', 'annapurnaadv@gmail.com'),
            'instagram' => Setting::get('instagram', '@annapurna.adv'),
            'address'   => Setting::get('address', 'Jl. Kampus No. 8-9 Grendeng, Purwokerto, Jawa Tengah'),
            'banks'     => Setting::get('banks', [
                ['bank' => 'BCA', 'number' => '1234567890', 'holder' => 'Annapurna Adventure']
            ]),
        ];

        return response()->json([
            'ok' => true,
            'data' => $settings,
        ]);
    }

    /**
     * POST /api/admin/pengaturan
     * Menyimpan perubahan profil toko dan rekening bank (khusus Owner).
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'storeName' => ['required', 'string', 'max:100'],
            'hours'     => ['nullable', 'string', 'max:100'],
            'phone'     => ['nullable', 'string', 'max:30'],
            'whatsapp'  => ['required', 'regex:/^62\d{8,13}$/'],
            'email'     => ['required', 'email', 'max:100'],
            'instagram' => ['nullable', 'string', 'max:100'],
            'address'   => ['nullable', 'string'],
            'banks'     => ['required', 'array', 'min:1'],
            'banks.*.bank'   => ['required', 'string'],
            'banks.*.number' => ['required', 'string'],
            'banks.*.holder' => ['required', 'string'],
        ], [
            'storeName.required' => 'Nama toko wajib diisi.',
            'whatsapp.regex'     => 'Format WhatsApp harus diawali 62 (contoh: 6281234567890).',
            'banks.required'     => 'Minimal cantumkan satu rekening pembayaran.',
        ]);

        Setting::set('store_name', $validated['storeName']);
        Setting::set('hours', $validated['hours'] ?? '');
        Setting::set('phone', $validated['phone'] ?? '');
        Setting::set('whatsapp', $validated['whatsapp']);
        Setting::set('email', $validated['email']);
        Setting::set('instagram', $validated['instagram'] ?? '');
        Setting::set('address', $validated['address'] ?? '');
        Setting::set('banks', $validated['banks']);

        // Catat ke Audit Trail SHA-256
        Audit::log(
            'pengaturan',
            'Memperbarui profil toko dan rekening pembayaran',
            Auth::user()
        );

        return response()->json([
            'ok' => true,
            'msg' => 'Pengaturan toko berhasil disimpan.',
            'data' => $validated,
        ]);
    }

    /**
     * POST /api/akun/profil
     * Memperbarui nama dan nomor HP pengguna yang sedang login.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();
        if (!$user) {
            return response()->json(['ok' => false, 'msg' => 'Tidak terautentikasi.'], 401);
        }

        $validated = $request->validate([
            'name'  => ['required', 'string', 'min:3', 'max:100'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $user->name = trim($validated['name']);
        $user->phone = isset($validated['phone']) ? trim($validated['phone']) : null;
        $user->save();

        Audit::log('staff', "Memperbarui profil mandiri akun {$user->name}", $user);

        return response()->json([
            'ok' => true,
            'msg' => 'Profil berhasil diperbarui.',
            'user' => [
                'id' => 'u' . $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone ?? '',
            ]
        ]);
    }
}
