<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use App\Mail\MonthlyReportMail;
use App\Models\DriveConnection;
use App\Models\ReportArchive;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Audit;
use App\Support\DriveException;
use App\Support\GoogleDrive;
use App\Support\Rekap;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Laravel\Socialite\Facades\Socialite;

/**
 * Rekap laporan bulanan → Google Drive Owner (sungguhan).
 *
 *   GET    /owner/integrasi/google/hubungkan  → Owner memberi izin Drive (Google, izin drive.file)
 *          (Google kembali ke /auth/google/callback; GoogleAuthController meneruskan ke finishConnect)
 *   DELETE /api/owner/drive                   → putuskan Google Drive (izin dicabut di akun Google)
 *   POST   /api/admin/rekap                   → unggah 8 PDF rekap satu bulan (Rekap::FILES), simpan arsip, kirim email
 *
 * PDF dibuat browser dari data server (laporan yang sama dengan halaman Laporan),
 * jadi server cukup menyimpan file ke folder: folder utama / TAHUN yyyy / REKAP LAPORAN BULAN …
 */
class RekapController extends Controller
{
    public function connect(Request $request): RedirectResponse
    {
        if (! GoogleAuthController::enabled()) {
            return redirect()->route('owner.integrasi', ['drive' => 'belum-aktif']);
        }
        $request->session()->put('google_purpose', 'drive');

        return Socialite::driver('google')
            ->scopes([GoogleDrive::SCOPE])
            // offline + consent: Google memberi refresh token, jadi server bisa mengunggah kapan saja
            ->with(['access_type' => 'offline', 'prompt' => 'consent select_account', 'include_granted_scopes' => 'true'])
            ->redirect();
    }

    /** Lanjutan callback Google untuk menghubungkan Drive (dipanggil GoogleAuthController). */
    public static function finishConnect(Request $request): RedirectResponse
    {
        $owner = Auth::user();
        if (! $owner || $owner->role !== 'owner') {
            return redirect()->route('masuk');
        }
        $back = fn (string $s) => redirect()->route('owner.integrasi', ['drive' => $s]);
        if ($request->filled('error')) {
            return $back('batal');
        }
        try {
            $g = Socialite::driver('google')->user();
        } catch (\Throwable $e) {
            report($e);

            return $back('gagal');
        }
        if (! in_array(GoogleDrive::SCOPE, $g->approvedScopes ?? [], true)) {
            return $back('izin');                 // kotak izin Google Drive tidak dicentang
        }
        if (! $g->refreshToken) {
            return $back('gagal');
        }

        foreach (DriveConnection::all() as $old) {
            if ($old->email !== strtolower((string) $g->getEmail())) {
                (new GoogleDrive($old))->revoke();
            }
            $old->delete();
        }
        DriveConnection::create([
            'connected_by' => $owner->id,
            'email' => strtolower((string) $g->getEmail()),
            'refresh_token' => $g->refreshToken,
        ]);
        BootController::bump();
        Audit::log('pengaturan', 'Menghubungkan Google Drive (' . $g->getEmail() . ')');

        return $back('terhubung');
    }

    public function disconnect(): JsonResponse
    {
        $conn = DriveConnection::current();
        if ($conn) {
            (new GoogleDrive($conn))->revoke();
            DriveConnection::query()->delete();
            BootController::bump();
            Audit::log('pengaturan', 'Memutuskan Google Drive (' . $conn->email . ')');
        }

        return response()->json(['message' => 'Google Drive diputuskan.']);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'period' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'auto' => ['nullable', 'boolean'],
            'summary' => ['nullable', 'json', 'max:20000'],
            'files' => ['required', 'array'],
            'files.*' => ['file', 'mimetypes:application/pdf', 'max:15360'],
        ], ['files.*.mimetypes' => 'File rekap harus PDF.', 'period.regex' => 'Periode tidak valid.']);

        $period = $data['period'];
        if ($period > CarbonImmutable::now(Rekap::TZ)->format('Y-m')) {
            return response()->json(['message' => 'Bulan ini belum dimulai.'], 422);
        }
        $files = array_intersect_key($request->file('files'), Rekap::FILES);
        if (count($files) !== count(Rekap::FILES)) {
            return response()->json(['message' => 'File rekap tidak lengkap (' . count($files) . ' dari ' . count(Rekap::FILES) . ').'], 422);
        }
        $conn = DriveConnection::current();
        if (! $conn) {
            return response()->json(['message' => 'Google Drive belum dihubungkan. Owner perlu menekan "Hubungkan" di halaman Integrasi.', 'reconnect' => true], 409);
        }

        // Dua perangkat bisa menjalankan rekap otomatis bersamaan: yang kedua menunggu lalu memakai hasil pertama
        return Cache::lock('rekap:' . $period, 120)->block(60, function () use ($user, $data, $period, $files, $conn) {
            $old = ReportArchive::where('period', $period)->first();
            $auto = (bool) ($data['auto'] ?? false);
            if ($old && ($auto || $user->role !== 'owner')) {
                // Admin / rekap otomatis tidak menimpa rekap yang sudah ada
                return response()->json(['data' => Rekap::toFe($old), 'existed' => true]);
            }

            try {
                $drive = new GoogleDrive($conn);
                $root = $drive->rootFolder(Rekap::rootName());
                $year = $drive->folder('TAHUN ' . substr($period, 0, 4), $root['id']);
                $month = $drive->folder(Rekap::folderName($period), $year['id']);
                $uploaded = [];
                foreach (Rekap::FILES as $type => $label) {
                    $name = Rekap::fileName($type, $period);
                    $f = $drive->upload($month['id'], $name, file_get_contents($files[$type]->getRealPath()));
                    $uploaded[] = ['type' => $type, 'name' => $name, 'id' => $f['id'] ?? null, 'url' => $f['webViewLink'] ?? null];
                }
            } catch (DriveException $e) {
                if ($e->reconnect) {
                    User::where('role', 'owner')->where('status', 'aktif')->each(fn ($o) => UserNotification::send($o->email,
                        'Google Drive perlu dihubungkan ulang', $e->getMessage(), 'owner/integrasi'));
                }

                return response()->json(['message' => $e->getMessage(), 'reconnect' => $e->reconnect], $e->reconnect ? 409 : 502);
            } catch (\Throwable $e) {
                report($e);

                return response()->json(['message' => 'Tidak dapat terhubung ke Google Drive. Coba lagi beberapa saat lagi.'], 502);
            }

            $archive = ReportArchive::updateOrCreate(['period' => $period], [
                'version' => $old ? $old->version + 1 : 1,
                'is_auto' => $auto,
                'created_by' => $user->id,
                'created_by_name' => $user->name,
                'drive_folder_id' => $month['id'],
                'drive_folder_url' => $month['webViewLink'] ?? ('https://drive.google.com/drive/folders/' . $month['id']),
                'path' => [Rekap::rootName(), 'TAHUN ' . substr($period, 0, 4), Rekap::folderName($period)],
                'files' => $uploaded,
                'summary' => isset($data['summary']) ? (json_decode($data['summary'], true) ?: null) : null,
            ]);
            $archive->touch();
            self::mail($archive);
            Audit::log('laporan', ($old ? 'Memperbarui' : 'Membuat') . ' rekap laporan ' . Rekap::monthName($period) . ' di Google Drive', null, [], $auto ? null : $user, $auto);

            return response()->json(['data' => Rekap::toFe($archive->fresh())]);
        });
    }

    /** Kirim ringkasan ke Owner + CC. Bila server email belum diatur, dicatat "nonaktif" (tidak pura-pura terkirim). */
    private static function mail(ReportArchive $archive): void
    {
        $to = Rekap::recipients();
        $status = 'nonaktif';
        if ($to && Rekap::mailEnabled()) {
            try {
                Mail::to($to[0])->cc(array_slice($to, 1))->send(new MonthlyReportMail($archive));
                $status = 'terkirim';
            } catch (\Throwable $e) {
                report($e);
                $status = 'gagal';
            }
        }
        $archive->update(['mail_to' => implode(', ', $to) ?: null, 'mail_status' => $status, 'mailed_at' => $status === 'terkirim' ? now() : null]);
    }
}
