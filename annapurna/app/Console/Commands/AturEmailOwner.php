<?php

namespace App\Console\Commands;

use App\Http\Controllers\Annapurna\BootController;
use App\Models\Setting;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Console\Command;

/**
 * Pasang email asli Owner dalam satu langkah (dijalankan di terminal hosting):
 *   php artisan owner:email pemilik@gmail.com
 *
 * 1. Email akun Owner (untuk masuk website & kode lupa kata sandi Owner) diganti ke alamat ini.
 * 2. "Email Owner (penerima utama)" rekap bulanan di Google Drive & Email ikut diisi alamat ini.
 * Kata sandi Owner tidak berubah. Alamat tidak ditulis di kode karena repo publik.
 * Bila ada lebih dari satu Owner aktif, pilih dengan --dari=email-lama.
 */
class AturEmailOwner extends Command
{
    protected $signature = 'owner:email {email : Email asli Owner} {--dari= : Email lama Owner (bila Owner aktif lebih dari satu)}';

    protected $description = 'Ganti email akun Owner dan email penerima rekap bulanan sekaligus';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("Alamat email tidak valid: {$email}");

            return self::FAILURE;
        }

        $owners = User::where('role', 'owner')->where('status', 'aktif')->orderBy('id')->get();
        $dari = strtolower(trim((string) $this->option('dari')));
        $owner = $dari !== '' ? $owners->firstWhere('email', $dari) : ($owners->count() === 1 ? $owners->first() : null);
        if (! $owner) {
            $this->error($dari !== '' ? "Owner aktif dengan email {$dari} tidak ditemukan." : 'Ada lebih dari satu Owner aktif. Pilih dengan --dari=email-lama.');
            $this->table(['Nama', 'Email'], $owners->map(fn ($o) => [$o->name, $o->email])->all());

            return self::FAILURE;
        }

        $other = User::where('email', $email)->where('id', '!=', $owner->id)->first();
        if ($other) {
            $this->error("Email {$email} sudah dipakai akun lain ({$other->name}, {$other->role}). Ganti dulu email akun itu, atau pakai email lain.");

            return self::FAILURE;
        }

        // 1) Email akun Owner
        $oldEmail = $owner->email;
        if ($oldEmail !== $email) {
            $owner->forceFill(['email' => $email])->save();
            Audit::log('staff', "Mengganti email akun Owner {$owner->name} (perintah owner:email)", $owner,
                [['field' => 'Email', 'from' => $oldEmail, 'to' => $email]], null, true);
        }

        // 2) Penerima email rekap bulanan
        $s = Setting::get('integration', []);
        $s = is_array($s) ? $s : [];
        $oldRekap = (string) ($s['ownerEmail'] ?? '');
        if ($oldRekap !== $email) {
            $s['ownerEmail'] = $email;
            Setting::set('integration', $s);
            Audit::log('konfigurasi', 'Mengubah email penerima rekap bulanan (perintah owner:email)', null,
                [['field' => 'Email penerima laporan', 'from' => $oldRekap, 'to' => $email]], null, true);
        }
        BootController::bump();          // panel yang terbuka memuat data terbaru

        $this->table(['Bagian', 'Sebelum', 'Sesudah'], [
            ["Email akun Owner ({$owner->name})", $oldEmail, $email],
            ['Email Owner penerima rekap', $oldRekap ?: '(kosong)', $email],
        ]);
        $this->info('Selesai. Owner sekarang masuk dengan ' . $email . ' (kata sandi tetap sama), atau tombol "Masuk dengan Google" bila ini akun Gmail.');

        $reply = (string) config('mail.reply_to.address');
        if (strtolower($reply) !== $email) {
            $this->warn('Balasan email sistem (Reply-To) masih ' . ($reply ?: '(tidak diisi)') . ". Supaya balasan masuk ke Owner, isi di .env:\n  MAIL_REPLY_TO_ADDRESS={$email}\nlalu jalankan: php artisan optimize");
        }

        return self::SUCCESS;
    }
}
