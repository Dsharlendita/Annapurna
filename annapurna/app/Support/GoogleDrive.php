<?php

namespace App\Support;

use App\Models\DriveConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Klien kecil Google Drive API v3 (tanpa paket tambahan).
 *
 * Izin yang diminta hanya `drive.file`: aplikasi hanya bisa melihat & mengubah file/folder
 * yang dibuatnya sendiri, bukan isi Drive Owner yang lain.
 */
class GoogleDrive
{
    public const SCOPE = 'https://www.googleapis.com/auth/drive.file';
    private const FOLDER = 'application/vnd.google-apps.folder';
    private const API = 'https://www.googleapis.com/drive/v3/files';
    private const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
    private const TOKEN = 'https://oauth2.googleapis.com/token';

    public function __construct(private DriveConnection $conn) {}

    // ------------------------------------------------------------------ Token

    private function cacheKey(): string
    {
        return 'gdrive_token_' . $this->conn->id;
    }

    private function token(bool $fresh = false): string
    {
        if ($fresh) {
            Cache::forget($this->cacheKey());
        }

        return Cache::remember($this->cacheKey(), now()->addMinutes(50), function () {
            $res = Http::asForm()->timeout(20)->post(self::TOKEN, [
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'refresh_token' => $this->conn->refresh_token,
                'grant_type' => 'refresh_token',
            ]);
            if ($res->json('error') === 'invalid_grant') {
                throw new DriveException('Akses Google Drive sudah dicabut atau kedaluwarsa. Hubungkan ulang Google Drive di halaman Integrasi.', true);
            }
            if (! $res->successful() || ! $res->json('access_token')) {
                throw new DriveException('Gagal masuk ke Google Drive (' . $res->status() . '). Coba lagi beberapa saat lagi.');
            }

            return $res->json('access_token');
        });
    }

    /** Jalankan permintaan; bila token ditolak (401), ambil token baru sekali lalu ulangi. */
    private function call(callable $fn): Response
    {
        $res = $fn($this->http($this->token()));
        if ($res->status() === 401) {
            $res = $fn($this->http($this->token(true)));
        }
        if ($res->failed()) {
            $msg = $res->json('error.message') ?: $res->body();
            if ($res->status() === 403 && (str_contains((string) $msg, 'has not been used') || str_contains((string) $msg, 'is disabled'))) {
                throw new DriveException('Google Drive API belum diaktifkan di Google Cloud Console (APIs & Services → Library → Google Drive API → Enable).');
            }
            throw new DriveException('Google Drive menolak permintaan (' . $res->status() . '): ' . mb_substr((string) $msg, 0, 160));
        }

        return $res;
    }

    private function http(string $token): PendingRequest
    {
        return Http::withToken($token)->acceptJson()->timeout(60);
    }

    // ------------------------------------------------------------------ Folder & file

    private static function q(string $s): string
    {
        return str_replace(['\\', "'"], ['\\\\', "\\'"], $s);
    }

    /** Cari folder bernama $name di dalam $parent ('root' = Drive Saya); buat bila belum ada. */
    public function folder(string $name, string $parent = 'root'): array
    {
        $q = "name = '" . self::q($name) . "' and mimeType = '" . self::FOLDER . "' and '" . self::q($parent) . "' in parents and trashed = false";
        $found = $this->call(fn ($h) => $h->get(self::API, ['q' => $q, 'fields' => 'files(id,name,webViewLink)', 'spaces' => 'drive']))->json('files.0');
        if ($found) {
            return $found;
        }

        return $this->call(fn ($h) => $h->post(self::API . '?fields=id,name,webViewLink', [
            'name' => $name, 'mimeType' => self::FOLDER, 'parents' => [$parent],
        ]))->json();
    }

    /** Folder utama: pakai id tersimpan selama folder itu masih ada (tidak di tempat sampah) & namanya sama. */
    public function rootFolder(string $name): array
    {
        if ($this->conn->root_folder_id && $this->conn->root_folder_name === $name) {
            $res = $this->http($this->token())->get(self::API . '/' . $this->conn->root_folder_id, ['fields' => 'id,name,webViewLink,trashed']);
            if ($res->successful() && ! $res->json('trashed')) {
                return $res->json();
            }
        }
        $f = $this->folder($name);
        $this->conn->update(['root_folder_id' => $f['id'], 'root_folder_name' => $name]);

        return $f;
    }

    /** Unggah PDF ke folder. File dengan nama sama diganti isinya (dipakai saat rekap diperbarui). */
    public function upload(string $folderId, string $name, string $bytes, string $mime = 'application/pdf'): array
    {
        $q = "name = '" . self::q($name) . "' and '" . self::q($folderId) . "' in parents and trashed = false";
        $old = $this->call(fn ($h) => $h->get(self::API, ['q' => $q, 'fields' => 'files(id)', 'spaces' => 'drive']))->json('files.0.id');
        if ($old) {
            return $this->call(fn ($h) => $h->withBody($bytes, $mime)->patch(self::UPLOAD . '/' . $old . '?uploadType=media&fields=id,name,webViewLink'))->json();
        }

        $b = 'annapurna' . bin2hex(random_bytes(8));
        $meta = json_encode(['name' => $name, 'parents' => [$folderId], 'mimeType' => $mime], JSON_UNESCAPED_UNICODE);
        $body = "--{$b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{$meta}\r\n--{$b}\r\nContent-Type: {$mime}\r\n\r\n{$bytes}\r\n--{$b}--";

        return $this->call(fn ($h) => $h->withBody($body, "multipart/related; boundary={$b}")->post(self::UPLOAD . '?uploadType=multipart&fields=id,name,webViewLink'))->json();
    }

    /** Cabut izin aplikasi di akun Google Owner (dipanggil saat "Putuskan"). */
    public function revoke(): void
    {
        try {
            Http::asForm()->timeout(15)->post('https://oauth2.googleapis.com/revoke', ['token' => $this->conn->refresh_token]);
        } catch (\Throwable $e) {
            report($e);   // tetap diputus di sisi kita walau Google tidak bisa dihubungi
        }
        Cache::forget($this->cacheKey());
    }
}
