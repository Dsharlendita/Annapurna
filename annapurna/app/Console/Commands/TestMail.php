<?php

namespace App\Console\Commands;

use App\Mail\LoginCodeMail;
use App\Mail\StaffAccountCreated;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Tes kirim email dengan pengaturan MAIL_* di .env (pengganti `php artisan tinker`, karena hosting memblokir eval).
 *   php artisan mail:tes alamat@gmail.com               → email informasi lengkap (HTML + teks)
 *   php artisan mail:tes alamat@gmail.com --jenis=kode  → template asli "Kode verifikasi" (kode contoh, tidak bisa dipakai)
 *   php artisan mail:tes alamat@gmail.com --jenis=staff → template asli "Akun staff dibuat"
 * Menampilkan pengaturan yang terbaca (tanpa password) lalu mengirim satu email percobaan.
 * Catatan: isi yang terlalu singkat ("Tes SMTP") dikarantina filter spam keluar hosting, jadi isinya dibuat lengkap.
 */
class TestMail extends Command
{
    protected $signature = 'mail:tes {email : Alamat tujuan email percobaan} {--jenis=info : info | kode | staff}';

    protected $description = 'Kirim satu email percobaan untuk memastikan pengaturan SMTP di .env benar';

    public function handle(): int
    {
        $to = (string) $this->argument('email');
        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("Alamat email tidak valid: {$to}");

            return self::FAILURE;
        }
        $jenis = (string) $this->option('jenis');
        if (! in_array($jenis, ['info', 'kode', 'staff'], true)) {
            $this->error('Pilihan --jenis harus info, kode, atau staff.');

            return self::FAILURE;
        }

        $mailer = (string) config('mail.default');
        $smtp = (array) config('mail.mailers.smtp');
        $this->table(['Pengaturan', 'Nilai terbaca'], [
            ['MAIL_MAILER', $mailer],
            ['MAIL_SCHEME', (string) ($smtp['scheme'] ?? '-')],
            ['MAIL_HOST', (string) ($smtp['host'] ?? '-')],
            ['MAIL_PORT', (string) ($smtp['port'] ?? '-')],
            ['MAIL_USERNAME', (string) ($smtp['username'] ?? '-')],
            ['MAIL_PASSWORD', empty($smtp['password']) ? '(KOSONG)' : '(terisi, disembunyikan)'],
            ['MAIL_FROM_ADDRESS', (string) config('mail.from.address')],
            ['MAIL_REPLY_TO_ADDRESS', (string) (config('mail.reply_to.address') ?: '(tidak diisi)')],
        ]);

        if ($mailer === 'log') {
            $this->warn('MAIL_MAILER masih "log": email hanya ditulis ke log, tidak terkirim.');
            $this->line('Periksa .env, lalu jalankan: php artisan optimize');

            return self::FAILURE;
        }
        foreach (self::gmailProblems($smtp, (string) config('mail.from.address')) as $p) {
            $this->warn('PERIKSA: ' . $p);
        }

        $this->line("Mengirim email percobaan ({$jenis}) ke {$to} ...");
        try {
            $penerima = new User(['name' => 'Pengujian Email', 'email' => $to, 'role' => 'admin']);
            $owner = new User(['name' => 'Owner Annapurna', 'email' => (string) config('mail.from.address'), 'role' => 'owner']);
            match ($jenis) {
                'kode' => Mail::to($to)->send(new LoginCodeMail($penerima, '482913', 'login', 10)),
                'staff' => Mail::to($to)->send(new StaffAccountCreated($penerima, $owner, null, true)),
                default => Mail::send([], [], function ($m) use ($to) {
                    $m->to($to)->subject('Uji pengiriman email sistem Annapurna Adventure')
                        ->html($this->infoHtml())->text($this->infoText());
                }),
            };
        } catch (\Throwable $e) {
            $this->error('GAGAL: ' . $e->getMessage());
            if (preg_match('/535|Username and Password not accepted|BadCredentials|authenticat/i', $e->getMessage())) {
                $this->line('Artinya username / sandi ditolak. Untuk Gmail: MAIL_USERNAME = alamat Gmail lengkap, MAIL_PASSWORD = Sandi Aplikasi 16 huruf');
                $this->line('(bukan kata sandi Gmail biasa; Verifikasi 2 Langkah harus aktif). Setelah mengubah .env: php artisan optimize');
            }

            return self::FAILURE;
        }

        $this->info('TERKIRIM ke server email. Cek kotak masuk (dan folder Spam) ' . $to);
        $this->line('Bila tidak sampai: cPanel → Track Delivery. Status "quarantine" di mail gateway = ditahan filter spam hosting.');

        return self::SUCCESS;
    }

    /** Kesalahan umum saat memakai SMTP Gmail (smtp.gmail.com). Kosong = tidak ada masalah terlihat. */
    public static function gmailProblems(array $smtp, string $from): array
    {
        if (! str_contains(strtolower((string) ($smtp['host'] ?? '')), 'gmail.com')) {
            return [];
        }
        $out = [];
        $user = strtolower(trim((string) ($smtp['username'] ?? '')));
        $pass = (string) ($smtp['password'] ?? '');
        $port = (int) ($smtp['port'] ?? 0);
        $scheme = strtolower((string) ($smtp['scheme'] ?? ''));
        if (! filter_var($user, FILTER_VALIDATE_EMAIL)) {
            $out[] = 'MAIL_USERNAME harus alamat Gmail lengkap, misalnya nama@gmail.com.';
        }
        if ($user !== '' && strtolower(trim($from)) !== $user) {
            $out[] = "MAIL_FROM_ADDRESS ({$from}) berbeda dengan MAIL_USERNAME ({$user}). Gmail tetap mengirim atas nama {$user}; samakan keduanya.";
        }
        if (str_contains($pass, ' ')) {
            $out[] = 'MAIL_PASSWORD berisi spasi. Tulis Sandi Aplikasi 16 huruf tanpa spasi.';
        }
        if (strlen(str_replace(' ', '', $pass)) !== 16) {
            $out[] = 'Sandi Aplikasi Gmail selalu 16 huruf. Kata sandi Gmail biasa akan ditolak.';
        }
        if ($port === 465 && $scheme !== 'smtps') {
            $out[] = 'Port 465 butuh MAIL_SCHEME=smtps.';
        }
        if ($port === 587 && $scheme === 'smtps') {
            $out[] = 'Port 587 tidak memakai MAIL_SCHEME=smtps. Hapus baris MAIL_SCHEME (atau isi smtp).';
        }

        return $out;
    }

    private function infoText(): string
    {
        $site = url('/');

        return "Halo,\n\nEmail ini dikirim oleh sistem website Annapurna Adventure ({$site}) untuk memastikan pengiriman email otomatis sudah berjalan.\n\n"
            . 'Website Annapurna Adventure memakai email untuk mengirim kode verifikasi masuk, kode atur ulang kata sandi, dan informasi akun staff. '
            . "Kalau email ini sampai di kotak masuk, berarti pengaturan pengiriman email sudah benar dan email-email tersebut akan sampai ke penerimanya.\n\n"
            . "Kamu tidak perlu membalas atau melakukan apa pun.\n\nSalam,\nAnnapurna Adventure\nSewa & jual perlengkapan outdoor\n{$site}\n";
    }

    private function infoHtml(): string
    {
        $site = e(url('/'));

        return '<!doctype html><html lang="id"><body style="font-family:Arial,sans-serif;color:#1f2a24;line-height:1.6">'
            . '<p>Halo,</p><p>Email ini dikirim oleh sistem website <strong>Annapurna Adventure</strong> (<a href="' . $site . '">' . $site . '</a>) untuk memastikan pengiriman email otomatis sudah berjalan.</p>'
            . '<p>Website Annapurna Adventure memakai email untuk mengirim kode verifikasi masuk, kode atur ulang kata sandi, dan informasi akun staff. '
            . 'Kalau email ini sampai di kotak masuk, berarti pengaturan pengiriman email sudah benar dan email-email tersebut akan sampai ke penerimanya.</p>'
            . '<p>Kamu tidak perlu membalas atau melakukan apa pun.</p><p>Salam,<br>Annapurna Adventure<br>Sewa &amp; jual perlengkapan outdoor</p></body></html>';
    }
}
