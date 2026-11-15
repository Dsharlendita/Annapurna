<?php

namespace App\Support;

use App\Models\DriveConnection;
use App\Models\ReportArchive;
use App\Models\Setting;
use Carbon\CarbonImmutable;

/**
 * Aturan rekap laporan bulanan (sama dengan Reports.MONTHLY di reports.js).
 *
 * Isi PDF dibuat di browser staff dari data server, lalu diunggah lewat RekapController.
 * Jadwal & penerima email diatur Owner di pengaturan "integration".
 */
class Rekap
{
    /** Jenis laporan → judul file. Urutan = urutan file di folder. */
    public const FILES = [
        'rental' => 'Laporan Rental',
        'penjualan' => 'Laporan Penjualan',
        'keuangan' => 'Laporan Keuangan',
        'stok' => 'Laporan Stok',
        'pengembalian' => 'Laporan Pengembalian',
        'aktivitas' => 'Laporan Aktivitas Staff',
        'login' => 'Histori Login Staff',
    ];

    private const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    /** Jam toko (jadwal rekap ditulis Owner dalam WIB). */
    public const TZ = 'Asia/Jakarta';

    public static function monthName(string $period): string
    {
        [$y, $m] = array_map('intval', explode('-', $period));

        return self::BULAN[$m - 1] . ' ' . $y;
    }

    public static function folderName(string $period): string
    {
        return 'REKAP LAPORAN BULAN ' . mb_strtoupper(self::monthName($period));
    }

    public static function fileName(string $type, string $period): string
    {
        return self::FILES[$type] . ' ' . self::monthName($period) . '.pdf';
    }

    public static function settings(): array
    {
        $s = Setting::get('integration', []);

        return is_array($s) ? $s : [];
    }

    public static function rootName(): string
    {
        $n = trim((string) (self::settings()['driveRoot'] ?? ''));

        return $n !== '' ? mb_strtoupper(mb_substr($n, 0, 80)) : 'ANNAPURNA ADVENTURE';
    }

    /** Penerima email rekap: email Owner + CC (yang valid saja). */
    public static function recipients(): array
    {
        $s = self::settings();
        $all = array_merge([(string) ($s['ownerEmail'] ?? '')], explode(',', (string) ($s['ccEmails'] ?? '')));

        return array_values(array_unique(array_filter(array_map('trim', $all), fn ($e) => filter_var($e, FILTER_VALIDATE_EMAIL))));
    }

    /** Email benar-benar terkirim hanya bila server email sudah diatur (bukan "log"/"array"). */
    public static function mailEnabled(): bool
    {
        return ! in_array(config('mail.default'), ['log', 'array', null, ''], true);
    }

    /**
     * Bulan yang rekap otomatisnya sudah jatuh tempo tapi belum dibuat, atau null.
     * Contoh: tanggal kirim 1 jam 06:00 → mulai 1 Des 06:00 WIB, rekap November jatuh tempo.
     */
    public static function duePeriod(?CarbonImmutable $now = null): ?string
    {
        $s = self::settings();
        if (empty($s['autoMonthly']) || ! DriveConnection::current()) {
            return null;
        }
        $now ??= CarbonImmutable::now(self::TZ);
        [$h, $i] = array_map('intval', explode(':', (string) ($s['sendTime'] ?? '06:00')) + [0, 0]);
        $at = $now->startOfMonth()->setDay(max(1, min(28, (int) ($s['sendDay'] ?? 1))))->setTime($h, $i);
        if ($now->lt($at)) {
            return null;
        }
        $period = $now->subMonthNoOverflow()->format('Y-m');

        return ReportArchive::where('period', $period)->exists() ? null : $period;
    }

    /** Bentuk arsip untuk tampilan (sama dengan objek di DB.archives()). */
    public static function toFe(ReportArchive $a): array
    {
        return [
            'period' => $a->period,
            'createdAt' => $a->updated_at?->copy()->timezone(self::TZ)->format('Y-m-d\TH:i:s'),
            'by' => $a->is_auto ? 'Sistem (terjadwal)' : ($a->created_by_name ?: '-'),
            'auto' => $a->is_auto,
            'version' => $a->version,
            'path' => $a->path,
            'files' => $a->files,
            'summary' => $a->summary ?: (object) [],
            'folderUrl' => $a->drive_folder_url,
            'mailTo' => $a->mail_to,
            'mailStatus' => $a->mail_status,
            'server' => true,
        ];
    }
}
